import type {
  CallId,
  CallState,
  GroupId,
  UserId,
  WebSocketEvent,
} from '@microchat/shared';
import type { WebSocketClient } from './websocket-client';

export type IncomingCallHandler = (session: IncomingCallSession) => void;
export type MissedCallHandler = (event: {
  groupId: GroupId;
  callId: CallId;
  fromUserId: UserId | null;
}) => void;
export type CallStateChangeHandler = (state: CallState) => void;

export interface CallSession {
  callId: CallId;
  groupId: GroupId;
  direction: 'outgoing' | 'incoming';
  remoteUserId: UserId | null;
  remoteUserName: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  state: CallState;

  accept(): Promise<void>;
  reject(): Promise<void>;
  hangup(): Promise<void>;
  setMute(muted: boolean): void;

  onStateChange(handler: CallStateChangeHandler): () => void;
}

export interface IncomingCallSession extends CallSession {
  direction: 'incoming';
}

function generateCallId(): CallId {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID() as CallId;
  }

  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}` as CallId;
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

class CallSessionImpl implements CallSession {
  callId: CallId;
  groupId: GroupId;
  direction: 'outgoing' | 'incoming';
  remoteUserId: UserId | null;
  remoteUserName: string | null;
  localStream: MediaStream | null = null;
  remoteStream: MediaStream | null = null;
  private pc: RTCPeerConnection | null = null;
  private stateHandlers = new Set<CallStateChangeHandler>();
  private _state: CallState = 'idle';
  private wsClient: WebSocketClient;
  private iceServers: RTCIceServer[];

  constructor(options: {
    callId: CallId;
    groupId: GroupId;
    direction: 'outgoing' | 'incoming';
    remoteUserId: UserId | null;
    remoteUserName: string | null;
    wsClient: WebSocketClient;
    iceServers?: RTCIceServer[];
  }) {
    this.callId = options.callId;
    this.groupId = options.groupId;
    this.direction = options.direction;
    this.remoteUserId = options.remoteUserId;
    this.remoteUserName = options.remoteUserName;
    this.wsClient = options.wsClient;
    this.iceServers = options.iceServers ?? DEFAULT_ICE_SERVERS;
  }

  get state(): CallState {
    return this._state;
  }

  private setState(newState: CallState): void {
    if (this._state !== newState) {
      this._state = newState;
      for (const handler of this.stateHandlers) {
        handler(newState);
      }
    }
  }

  async initOutgoing(targetUserId: UserId): Promise<void> {
    this.setState('ringing-out');

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      this.pc = new RTCPeerConnection({ iceServers: this.iceServers });

      // Add local tracks
      for (const track of this.localStream.getTracks()) {
        this.pc.addTrack(track, this.localStream);
      }

      // Handle remote stream
      this.pc.ontrack = (event) => {
        this.remoteStream = event.streams[0];
      };

      // ICE candidate handling
      this.pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.wsClient.sendEvent({
            type: 'iceCandidate',
            groupId: this.groupId,
            callId: this.callId,
            fromUserId: null,
            sealedSender: undefined,
            candidate: {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
            },
          });
        }
      };

      // Connection state changes
      this.pc.onconnectionstatechange = () => {
        const state = this.pc?.connectionState;
        if (state === 'connected') {
          this.setState('active');
        } else if (
          state === 'failed' ||
          state === 'disconnected' ||
          state === 'closed'
        ) {
          this.hangup();
        }
      };

      // Create offer
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      // Send offer
      if (!offer.sdp) {
        throw new Error('Failed to create offer: no SDP');
      }
      this.wsClient.sendEvent({
        type: 'callOffer',
        groupId: this.groupId,
        callId: this.callId,
        toUserId: targetUserId,
        fromUserId: null,
        sealedSender: undefined,
        sdp: offer.sdp,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[call] Failed to start outgoing call:', err);
      this.cleanup();
      throw err;
    }
  }

  async handleIncomingOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    this.setState('ringing-in');

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      this.pc = new RTCPeerConnection({ iceServers: this.iceServers });

      // Add local tracks
      for (const track of this.localStream.getTracks()) {
        this.pc.addTrack(track, this.localStream);
      }

      // Handle remote stream
      this.pc.ontrack = (event) => {
        this.remoteStream = event.streams[0];
      };

      // ICE candidate handling
      this.pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.wsClient.sendEvent({
            type: 'iceCandidate',
            groupId: this.groupId,
            callId: this.callId,
            fromUserId: null,
            sealedSender: undefined,
            candidate: {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
            },
          });
        }
      };

      // Connection state changes
      this.pc.onconnectionstatechange = () => {
        const state = this.pc?.connectionState;
        if (state === 'connected') {
          this.setState('active');
        } else if (
          state === 'failed' ||
          state === 'disconnected' ||
          state === 'closed'
        ) {
          this.hangup();
        }
      };

      await this.pc.setRemoteDescription(offer);
    } catch (err) {
      console.error('[call] Failed to handle incoming offer:', err);
      this.cleanup();
      throw err;
    }
  }

  async accept(): Promise<void> {
    if (!this.pc || this.direction !== 'incoming') {
      throw new Error('Can only accept incoming calls');
    }

    try {
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);

      this.setState('connecting');

      if (!answer.sdp) {
        throw new Error('Failed to create answer: no SDP');
      }
      this.wsClient.sendEvent({
        type: 'callAnswer',
        groupId: this.groupId,
        callId: this.callId,
        fromUserId: null,
        sealedSender: undefined,
        sdp: answer.sdp,
      });
    } catch (err) {
      console.error('[call] Failed to accept call:', err);
      this.hangup();
      throw err;
    }
  }

  async reject(): Promise<void> {
    if (this.direction !== 'incoming') {
      throw new Error('Can only reject incoming calls');
    }

    this.wsClient.sendEvent({
      type: 'callEnd',
      groupId: this.groupId,
      callId: this.callId,
      fromUserId: null,
      sealedSender: undefined,
      reason: 'rejected',
    });

    this.cleanup();
  }

  async hangup(): Promise<void> {
    if (this._state === 'ended') return;

    this.wsClient.sendEvent({
      type: 'callEnd',
      groupId: this.groupId,
      callId: this.callId,
      fromUserId: null,
      sealedSender: undefined,
      reason: 'hangup',
    });

    this.cleanup();
  }

  handleAnswer(answer: RTCSessionDescriptionInit): void {
    if (!this.pc) return;

    this.setState('connecting');
    this.pc.setRemoteDescription(answer).catch((err) => {
      console.error('[call] Failed to set remote description:', err);
      this.hangup();
    });
  }

  handleIceCandidate(candidate: RTCIceCandidateInit): void {
    if (!this.pc) return;

    this.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((err) => {
      console.error('[call] Failed to add ICE candidate:', err);
    });
  }

  handleEnd(reason: 'hangup' | 'rejected' | 'missed' | 'error'): void {
    this.cleanup();

    if (reason === 'missed' && this.direction === 'outgoing') {
      // This will be handled by the CallClient via onMissedCall
    }
  }

  setMute(muted: boolean): void {
    for (const track of this.localStream?.getAudioTracks() ?? []) {
      track.enabled = !muted;
    }
  }

  onStateChange(handler: CallStateChangeHandler): () => void {
    this.stateHandlers.add(handler);
    return () => this.stateHandlers.delete(handler);
  }

  private cleanup(): void {
    this.setState('ended');

    // Stop all tracks
    for (const track of this.localStream?.getTracks() ?? []) {
      track.stop();
    }
    for (const track of this.remoteStream?.getTracks() ?? []) {
      track.stop();
    }

    this.localStream = null;
    this.remoteStream = null;

    // Close peer connection
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
  }
}

export class CallClient {
  private incomingHandlers = new Set<IncomingCallHandler>();
  private missedHandlers = new Set<MissedCallHandler>();
  private activeSession: CallSessionImpl | null = null;

  constructor(
    private wsClient: WebSocketClient,
    private iceServers?: RTCIceServer[],
  ) {
    this.wsClient.onEvent(this.handleEvent);
  }

  async startCall(options: {
    groupId: GroupId;
    toUserId: UserId;
    remoteUserName?: string | null;
  }): Promise<CallSession> {
    if (this.activeSession) {
      throw new Error('Already in a call');
    }

    const callId = generateCallId();

    const session = new CallSessionImpl({
      callId,
      groupId: options.groupId,
      direction: 'outgoing',
      remoteUserId: options.toUserId,
      remoteUserName: options.remoteUserName ?? null,
      wsClient: this.wsClient,
      iceServers: this.iceServers,
    });

    this.activeSession = session;

    // Auto-cleanup when session ends
    session.onStateChange((state) => {
      if (state === 'ended') {
        this.activeSession = null;
      }
    });

    await session.initOutgoing(options.toUserId);

    return session;
  }

  getActiveSession(): CallSession | null {
    return this.activeSession;
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
      case 'callOffer': {
        // Ignore if already in a call
        if (this.activeSession) {
          console.log('[call] Ignoring incoming call (already in a call)');
          return;
        }

        const session = new CallSessionImpl({
          callId: event.callId,
          groupId: event.groupId,
          direction: 'incoming',
          remoteUserId: event.fromUserId,
          remoteUserName: event.fromUserId, // Will be decrypted in Phase 3
          wsClient: this.wsClient,
          iceServers: this.iceServers,
        });

        this.activeSession = session;

        // Auto-cleanup when session ends
        session.onStateChange((state) => {
          if (state === 'ended') {
            this.activeSession = null;
          }
        });

        // Handle the offer (this sets up the peer connection but doesn't send answer yet)
        session
          .handleIncomingOffer({ type: 'offer', sdp: event.sdp })
          .catch((err) => {
            console.error('[call] Failed to handle incoming offer:', err);
            this.activeSession = null;
          });

        // Notify listeners
        for (const handler of this.incomingHandlers) {
          handler(session as IncomingCallSession);
        }
        break;
      }

      case 'callAnswer': {
        if (!this.activeSession || this.activeSession.callId !== event.callId) {
          console.log('[call] Ignoring answer for unknown call');
          return;
        }

        this.activeSession.handleAnswer({ type: 'answer', sdp: event.sdp });
        break;
      }

      case 'iceCandidate': {
        if (!this.activeSession || this.activeSession.callId !== event.callId) {
          console.log('[call] Ignoring ICE candidate for unknown call');
          return;
        }

        this.activeSession.handleIceCandidate(event.candidate);
        break;
      }

      case 'callEnd': {
        if (!this.activeSession || this.activeSession.callId !== event.callId) {
          console.log('[call] Ignoring callEnd for unknown call');
          return;
        }

        this.activeSession.handleEnd(event.reason);
        this.activeSession = null;

        if (event.reason === 'missed') {
          for (const handler of this.missedHandlers) {
            handler({
              groupId: event.groupId,
              callId: event.callId,
              fromUserId: event.fromUserId,
            });
          }
        }
        break;
      }

      case 'callRinging': {
        console.log('[call] Call is ringing at remote peer');
        break;
      }
    }
  };
}
