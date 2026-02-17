import type { GroupId, UserId, WebSocketEvent } from '@microchat/shared';
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
  private db: Database | null = null;

  constructor(
    private readonly state: DurableObjectState,
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
}
