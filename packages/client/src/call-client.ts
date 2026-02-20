import type {
  CallId,
  GroupId,
  UserId,
  WebSocketEvent,
} from '@microchat/shared';
import type { WebSocketClient } from './websocket-client';

export type IncomingCallHandler = (
  event: Extract<WebSocketEvent, { type: 'callOffer' }>,
) => void;
export type MissedCallHandler = (
  event: Extract<WebSocketEvent, { type: 'callEnd' }>,
) => void;

const FAKE_OFFER_SDP = 'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=MicroChat\r\n';
const FAKE_ANSWER_SDP =
  'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=MicroChatAnswer\r\n';

function generateCallId(): CallId {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID() as CallId;
  }

  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}` as CallId;
}

function createFakeCandidate(): WebSocketEvent & { type: 'iceCandidate' } {
  return {
    type: 'iceCandidate',
    groupId: '' as GroupId,
    callId: '' as CallId,
    fromUserId: null,
    candidate: {
      candidate: 'candidate:0 1 UDP 2122252543 0.0.0.0 9 typ host',
      sdpMid: '0',
      sdpMLineIndex: 0,
    },
  };
}

export class CallClient {
  private incomingHandlers = new Set<IncomingCallHandler>();
  private missedHandlers = new Set<MissedCallHandler>();

  constructor(private wsClient: WebSocketClient) {
    this.wsClient.onEvent(this.handleEvent);
  }

  startCall(options: { groupId: GroupId; toUserId: UserId }): CallId {
    const callId = generateCallId();

    console.log('[call] startCall called', {
      groupId: options.groupId,
      callId,
      toUserId: options.toUserId,
    });

    this.wsClient.sendEvent({
      type: 'callOffer',
      groupId: options.groupId,
      callId,
      toUserId: options.toUserId,
      fromUserId: null,
      sdp: FAKE_OFFER_SDP,
      timestamp: new Date().toISOString(),
    });

    const candidate = createFakeCandidate();
    this.wsClient.sendEvent({
      ...candidate,
      groupId: options.groupId,
      callId,
    });

    return callId;
  }

  onIncomingCall(handler: IncomingCallHandler): () => void {
    this.incomingHandlers.add(handler);
    return () => this.incomingHandlers.delete(handler);
  }

  onMissedCall(handler: MissedCallHandler): () => void {
    this.missedHandlers.add(handler);
    return () => this.missedHandlers.delete(handler);
  }

  private handleEvent = (event: WebSocketEvent): void => {
    switch (event.type) {
      case 'callOffer':
        console.log('[call] callOffer received', event);
        for (const handler of this.incomingHandlers) {
          handler(event);
        }

        this.wsClient.sendEvent({
          type: 'callAnswer',
          groupId: event.groupId,
          callId: event.callId,
          fromUserId: null,
          sdp: FAKE_ANSWER_SDP,
        });

        this.wsClient.sendEvent({
          ...createFakeCandidate(),
          groupId: event.groupId,
          callId: event.callId,
        });
        break;
      case 'callAnswer':
        console.log('[call] callAnswer received', event);
        break;
      case 'iceCandidate':
        console.log('[call] iceCandidate received', event);
        break;
      case 'callEnd':
        console.log('[call] callEnd received', event);
        if (event.reason === 'missed') {
          for (const handler of this.missedHandlers) {
            handler(event);
          }
        }
        break;
      case 'callRinging':
        console.log('[call] callRinging received', event);
        break;
    }
  };
}
