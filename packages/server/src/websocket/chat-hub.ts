import type {
  CallId,
  GroupId,
  UserId,
  WebSocketEvent,
} from '@microchat/shared';
import type { D1Database } from '../db/client';
import { Database } from '../db/client';

interface WebSocketSession {
  ws: WebSocket;
  userId: UserId;
  displayName: string;
  groups: Set<GroupId>;
}

/**
 * Durable Object that manages WebSocket connections and message routing.
 * Each instance acts as a hub for real-time event delivery.
 */
export class ChatHub implements DurableObject {
  private sessions = new Map<WebSocket, WebSocketSession>();
  private calls = new Map<
    CallId,
    { callerId: UserId; calleeId: UserId; groupId: GroupId }
  >();
  private db: Database | null = null;

  constructor(
    _state: DurableObjectState,
    private readonly env: { DB: D1Database },
  ) {}

  private getDb(): Database {
    if (!this.db) {
      this.db = new Database(this.env.DB);
    }
    return this.db;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/ws') {
      return this.handleWebSocket(request);
    }

    if (url.pathname === '/broadcast' && request.method === 'POST') {
      return this.handleBroadcast(request);
    }

    return new Response('Not found', { status: 404 });
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId') as UserId | null;
    const displayName = url.searchParams.get('displayName');

    if (!userId || !displayName) {
      return new Response('Missing userId or displayName', { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    const session: WebSocketSession = {
      ws: server,
      userId,
      displayName,
      groups: new Set(),
    };

    this.sessions.set(server, session);

    server.accept();

    server.addEventListener('message', (event) => {
      this.handleMessage(session, event);
    });

    server.addEventListener('close', () => {
      this.sessions.delete(server);
    });

    server.addEventListener('error', () => {
      this.sessions.delete(server);
    });

    // Send connected event
    this.sendTo(server, { type: 'connected' });

    return new Response(null, { status: 101, webSocket: client });
  }

  private async handleMessage(
    session: WebSocketSession,
    event: MessageEvent,
  ): Promise<void> {
    try {
      const data = JSON.parse(event.data as string);

      if (data.action === 'subscribe' && data.groupId) {
        await this.handleSubscribe(session, data.groupId as GroupId);
      } else if (data.action === 'unsubscribe' && data.groupId) {
        session.groups.delete(data.groupId as GroupId);
      } else if (this.isCallEvent(data)) {
        await this.handleCallEvent(session, data as WebSocketEvent);
      }
    } catch {
      this.sendTo(session.ws, {
        type: 'error',
        error: 'Invalid message format',
      });
    }
  }

  private async handleSubscribe(
    session: WebSocketSession,
    groupId: GroupId,
  ): Promise<void> {
    // Verify membership before allowing subscription
    const db = this.getDb();
    const membership = await db.query<{ id: string }>(
      'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, session.userId],
    );

    if (membership.length === 0) {
      this.sendTo(session.ws, {
        type: 'error',
        error: `Not a member of group ${groupId}`,
      });
      return;
    }

    session.groups.add(groupId);
  }

  private async handleBroadcast(request: Request): Promise<Response> {
    const event = (await request.json()) as WebSocketEvent & {
      groupId?: GroupId;
    };

    if (!event.groupId) {
      return new Response('Missing groupId', { status: 400 });
    }

    const groupId = event.groupId;
    let delivered = 0;

    for (const session of this.sessions.values()) {
      if (session.groups.has(groupId)) {
        this.sendTo(session.ws, event);
        delivered++;
      }
    }

    return Response.json({ delivered });
  }

  private sendTo(ws: WebSocket, event: WebSocketEvent): void {
    try {
      ws.send(JSON.stringify(event));
    } catch {
      // Connection may be closed
      this.sessions.delete(ws);
    }
  }

  private sendToUser(userId: UserId, event: WebSocketEvent): number {
    let delivered = 0;

    for (const session of this.sessions.values()) {
      if (session.userId === userId) {
        this.sendTo(session.ws, event);
        delivered++;
      }
    }

    return delivered;
  }

  private isCallEvent(data: unknown): data is WebSocketEvent {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const type = (data as { type?: string }).type;
    return (
      type === 'callOffer' ||
      type === 'callAnswer' ||
      type === 'iceCandidate' ||
      type === 'callEnd' ||
      type === 'callRinging'
    );
  }

  private async handleCallEvent(
    session: WebSocketSession,
    event: WebSocketEvent,
  ): Promise<void> {
    switch (event.type) {
      case 'callOffer':
        this.handleCallOffer(session, event);
        return;
      case 'callAnswer':
      case 'iceCandidate':
      case 'callEnd':
      case 'callRinging':
        this.handleCallRelay(session, event);
        return;
    }
  }

  private handleCallOffer(
    session: WebSocketSession,
    event: Extract<WebSocketEvent, { type: 'callOffer' }>,
  ): void {
    const { callId, groupId, toUserId } = event;
    const callerId = session.userId;

    this.calls.set(callId, { callerId, calleeId: toUserId, groupId });

    const delivered = this.sendToUser(toUserId, event);

    if (delivered === 0) {
      this.calls.delete(callId);
      this.sendToUser(callerId, {
        type: 'callEnd',
        groupId,
        callId,
        fromUserId: null,
        reason: 'missed',
      });
    }
  }

  private handleCallRelay(
    session: WebSocketSession,
    event: Extract<
      WebSocketEvent,
      { type: 'callAnswer' | 'iceCandidate' | 'callEnd' | 'callRinging' }
    >,
  ): void {
    if (!('callId' in event)) {
      return;
    }

    const callId = event.callId as CallId;
    const call = this.calls.get(callId);

    if (!call) {
      this.sendTo(session.ws, {
        type: 'error',
        error: 'Call not found',
      });
      return;
    }

    const senderId = session.userId;
    let targetUserId: UserId | null = null;

    if (senderId === call.callerId) {
      targetUserId = call.calleeId;
    } else if (senderId === call.calleeId) {
      targetUserId = call.callerId;
    }

    if (!targetUserId) {
      this.sendTo(session.ws, {
        type: 'error',
        error: 'Not a participant in this call',
      });
      return;
    }

    this.sendToUser(targetUserId, event);

    if (event.type === 'callEnd') {
      this.calls.delete(callId);
    }
  }
}
