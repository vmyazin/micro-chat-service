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
      this.handleSessionClose(server);
    });

    server.addEventListener('error', () => {
      this.handleSessionClose(server);
    });

    // Send connected event
    this.sendTo(server, { type: 'connected' });

    return new Response(null, { status: 101, webSocket: client });
  }

  private handleSessionClose(ws: WebSocket): void {
    const session = this.sessions.get(ws);
    if (!session) return;

    const groups = Array.from(session.groups);
    this.sessions.delete(ws);

    for (const groupId of groups) {
      this.checkAndBroadcastOfflineStatus(session.userId, groupId);
    }
  }

  private checkAndBroadcastOfflineStatus(
    userId: UserId,
    groupId: GroupId,
  ): void {
    let stillInGroup = false;
    for (const otherSession of this.sessions.values()) {
      if (otherSession.userId === userId && otherSession.groups.has(groupId)) {
        stillInGroup = true;
        break;
      }
    }

    if (!stillInGroup) {
      this.broadcastPresence(groupId, userId, 'offline');
    }
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
        const groupId = data.groupId as GroupId;
        session.groups.delete(groupId);
        this.checkAndBroadcastOfflineStatus(session.userId, groupId);
      } else if (data.type === 'deliveryReceipt') {
        const receiptEvent = data as Extract<
          WebSocketEvent,
          { type: 'deliveryReceipt' }
        >;
        await this.handleDeliveryReceipt(session, receiptEvent);
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

    // Get currently online members (excluding self)
    const onlineUsers = new Set<UserId>();
    for (const otherSession of this.sessions.values()) {
      if (otherSession.ws !== session.ws && otherSession.groups.has(groupId)) {
        onlineUsers.add(otherSession.userId);
      }
    }

    // Send the batch of online users to the subscribing user
    if (onlineUsers.size > 0) {
      for (const onlineUserId of onlineUsers) {
        this.sendTo(session.ws, {
          type: 'presenceUpdate',
          groupId,
          userId: onlineUserId,
          status: 'online',
        });
      }
    }

    // Inform others that this user is online
    // If this is the user's first connection to this group
    let wasAlreadyInGroup = false;
    for (const [ws, otherSession] of this.sessions.entries()) {
      if (
        ws !== session.ws &&
        otherSession.userId === session.userId &&
        otherSession.groups.has(groupId)
      ) {
        wasAlreadyInGroup = true;
        break;
      }
    }

    if (!wasAlreadyInGroup) {
      this.broadcastPresence(groupId, session.userId, 'online', session.ws);
    }
  }

  private broadcastPresence(
    groupId: GroupId,
    userId: UserId,
    status: 'online' | 'offline',
    excludeWs?: WebSocket,
  ) {
    for (const [ws, session] of this.sessions.entries()) {
      if (ws !== excludeWs && session.groups.has(groupId)) {
        this.sendTo(ws, {
          type: 'presenceUpdate',
          groupId,
          userId,
          status,
        });
      }
    }
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

  private async handleDeliveryReceipt(
    session: WebSocketSession,
    event: Extract<WebSocketEvent, { type: 'deliveryReceipt' }>,
  ): Promise<void> {
    const { messageId, groupId } = event;
    const db = this.getDb();
    const now = new Date().toISOString();

    // 1. Record the delivery receipt using raw SQL since Drizzle ORM is not set up here
    try {
      await db.execute(
        'INSERT INTO delivery_receipts (id, message_id, user_id, delivered_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING',
        [crypto.randomUUID(), messageId, session.userId, now],
      );
    } catch (err) {
      console.error('[chathub] Error inserting delivery receipt', err);
      // It might fail if message is already deleted; that's fine.
      return;
    }

    // 2. Determine if all members have received it
    // First, how many total members are in the group?
    const membersData = await db.query<{ count: number }>(
      'SELECT COUNT(*) as count FROM group_members WHERE group_id = ?',
      [groupId],
    );
    const totalMembers = membersData[0]?.count || 0;

    // Next, how many distinct delivery receipts exist for this message?
    const receiptsData = await db.query<{ count: number }>(
      'SELECT COUNT(DISTINCT user_id) as count FROM delivery_receipts WHERE message_id = ?',
      [messageId],
    );
    const receiptCount = receiptsData[0]?.count || 0;

    // If everyone in the group has received the message, tear it down!
    // A message is fully delivered if (Total Members - 1 (sender)) <= receipts.
    // To be strictly safe and truly ephemeral, if receiptCount >= totalMembers - 1
    if (totalMembers > 1 && receiptCount >= totalMembers - 1) {
      console.log(`[chathub] Message ${messageId} fully delivered. Erasing.`);

      // Get any associated R2 image keys so the client/server can clean those up too
      const _imageRows = await db.query<{ r2_key: string }>(
        'SELECT r2_key FROM image_attachments WHERE message_id = ?',
        [messageId],
      );

      // (We can't easily delete R2 from ChatHub as it doesn't have the IMAGES binding,
      // but the retention cron handles orphaned images later, or we let the API handle it.
      // For immediate DB deletion, we drop it.)
      await db.execute('DELETE FROM image_attachments WHERE message_id = ?', [
        messageId,
      ]);
      await db.execute('DELETE FROM delivery_receipts WHERE message_id = ?', [
        messageId,
      ]);
      await db.execute('DELETE FROM messages WHERE id = ?', [messageId]);

      // Broadcast an event to UI that it was completely deleted from server (optional,
      // but good to notify clients if they need to update sync status).
      // For secrecy, we ensure the cloud is wiped.
    }
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
      if (event.type === 'callEnd') {
        // Call already ended on the other side; ignore late hangup/reject.
        return;
      }
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
