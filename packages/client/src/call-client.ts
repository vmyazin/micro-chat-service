import type { GroupCipher } from '@microchat/crypto';
import {
  decryptCallerId,
  deriveCallSigningKey,
  encryptCallerId,
} from '@microchat/crypto';
import type {
  CallId,
  CallState,
  GroupId,
  SealedSenderToken,
  UserId,
  WebSocketEvent,
} from '@microchat/shared';
import type { SenderTokenStore } from './sender-token-store';
import type { WebSocketClient } from './websocket-client';

export type IncomingCallHandler = (session: IncomingCallSession) => void;
export type MissedCallHandler = (event: {
  groupId: GroupId;
  callId: CallId;
  fromUserId: UserId | null;
}) => void;
export type CallStateChangeHandler = (state: CallState) => void;

interface CallClientOptions {
  baseUrl?: string;
  iceServers?: RTCIceServer[];
  tokenStore?: SenderTokenStore;
  callCipher?: GroupCipher;
  getGroupEpoch?: (groupId: GroupId) => number | Promise<number>;
}

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

interface OutgoingSignalOptions {
  fromUserId: UserId | null;
  sealedSender?: string;
  senderToken?: SealedSenderToken;
}

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
  private answerProcessed = false;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];

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

  private clearDisconnectTimer(): void {
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }
  }

  private scheduleDisconnectHangup(): void {
    if (this.disconnectTimer) return;

    this.disconnectTimer = setTimeout(() => {
      this.disconnectTimer = null;
      if (this.pc?.connectionState === 'disconnected') {
        console.warn(
          '[call] Connection stayed disconnected; hanging up to avoid a stuck call',
        );
        this.hangup();
      }
    }, 8000);
  }

  private handleConnectionStateChange(): void {
    const state = this.pc?.connectionState;
    console.log('[call] Connection state changed:', state);

    if (state === 'connected') {
      this.clearDisconnectTimer();
      this.setState('active');
      return;
    }

    if (state === 'disconnected') {
      // Disconnected can be transient during ICE restarts or network switches.
      // Allow a grace period before tearing down the call.
      this.scheduleDisconnectHangup();
      return;
    }

    this.clearDisconnectTimer();

    if (state === 'failed' || state === 'closed') {
      this.hangup();
    }
  }

  private queueIceCandidate(candidate: RTCIceCandidateInit): void {
    this.pendingIceCandidates.push(candidate);
  }

  private flushPendingIceCandidates(): void {
    if (!this.pc || !this.pc.remoteDescription) {
      return;
    }

    const pending = this.pendingIceCandidates;
    if (pending.length === 0) {
      return;
    }

    this.pendingIceCandidates = [];
    for (const candidate of pending) {
      this.addIceCandidateInternal(candidate);
    }
  }

  private addIceCandidateInternal(candidate: RTCIceCandidateInit): void {
    if (!this.pc) return;

    this.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((err) => {
      if (
        err instanceof DOMException &&
        (err.name === 'InvalidStateError' ||
          err.message.includes('remote description'))
      ) {
        this.queueIceCandidate(candidate);
        return;
      }
      console.error('[call] Failed to add ICE candidate:', err);
    });
  }

  async initOutgoing(
    targetUserId: UserId,
    signalOptions: OutgoingSignalOptions,
  ): Promise<void> {
    this.setState('ringing-out');

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      this.pc = new RTCPeerConnection({ iceServers: this.iceServers });

      // Force a bogus data channel just to guarantee ICE gathering starts
      this.pc.createDataChannel('ice-kickstart');

      // Add local tracks
      for (const track of this.localStream.getTracks()) {
        this.pc.addTrack(track, this.localStream);
      }

      // Handle remote stream
      this.pc.ontrack = (event) => {
        if (event.streams[0]) {
          this.remoteStream = event.streams[0];
        } else {
          this.remoteStream = new MediaStream([event.track]);
        }
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

      this.pc.onconnectionstatechange = () => {
        this.handleConnectionStateChange();
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
        fromUserId: signalOptions.fromUserId,
        senderToken: signalOptions.senderToken,
        sealedSender: signalOptions.sealedSender,
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

      if (this._state === 'ended') {
        for (const track of this.localStream.getTracks()) {
          track.stop();
        }
        this.localStream = null;
        return;
      }

      this.pc = new RTCPeerConnection({ iceServers: this.iceServers });

      // Add local tracks
      for (const track of this.localStream.getTracks()) {
        this.pc.addTrack(track, this.localStream);
      }

      // Handle remote stream
      this.pc.ontrack = (event) => {
        if (event.streams[0]) {
          this.remoteStream = event.streams[0];
        } else {
          this.remoteStream = new MediaStream([event.track]);
        }
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
        this.handleConnectionStateChange();
      };

      await this.pc.setRemoteDescription(offer);
      this.flushPendingIceCandidates();
    } catch (err) {
      console.error('[call] Failed to handle incoming offer:', err);
      this.cleanup();
      throw err;
    }
  }

  async accept(): Promise<void> {
    if (this._state === 'ended') {
      console.log('[call] Accept ignored: session already ended');
      return;
    }
    if (this._state === 'connecting' || this._state === 'active') {
      console.log('[call] Call already accepted');
      return;
    }
    if (!this.pc || this.direction !== 'incoming') {
      console.log('[call] Accept rejected: invalid session', {
        hasPeerConnection: !!this.pc,
        direction: this.direction,
      });
      throw new Error('Can only accept incoming calls');
    }

    // Can only create answer if we have a remote offer
    if (this.pc.signalingState !== 'have-remote-offer') {
      console.log(
        '[call] Cannot accept: peer connection not in have-remote-offer state, current state:',
        this.pc.signalingState,
      );
      throw new Error('Cannot accept call: no remote offer');
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
    if (this._state === 'ended') {
      return;
    }
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
    if (!this.pc) {
      console.log('[call] Cannot handle answer: no peer connection');
      return;
    }

    // Prevent processing answer multiple times
    if (this.answerProcessed) {
      console.log('[call] Ignoring duplicate answer (already processed)');
      return;
    }

    // The peer connection signaling state should be 'have-local-offer' when we receive an answer
    // If it's 'stable', the answer was already processed
    // If it's anything else, we're in an invalid state
    const signalingState = this.pc.signalingState;

    if (signalingState !== 'have-local-offer') {
      return;
    }

    this.answerProcessed = true;
    this.setState('connecting');

    // Capture pc locally — this.pc could be nulled by cleanup() before the
    // promise resolves, so we hold a stable reference.
    const pc = this.pc;
    pc.setRemoteDescription(answer)
      .then(() => {
        this.flushPendingIceCandidates();
      })
      .catch((err: unknown) => {
        // If the PC is already stable (e.g. due to a race with a duplicate
        // answer), just log and ignore — do NOT hang up, the call may still
        // be progressing normally on the other path.
        if (
          err instanceof DOMException &&
          (err.name === 'InvalidStateError' || err.message.includes('stable'))
        ) {
          console.warn(
            '[call] setRemoteDescription rejected because PC is already stable — ignoring duplicate answer',
          );
          return;
        }
        console.error('[call] Failed to set remote description:', err);
        this.hangup();
      });
  }

  handleIceCandidate(candidate: RTCIceCandidateInit): void {
    if (!this.pc) {
      return;
    }

    if (!this.pc.remoteDescription) {
      this.queueIceCandidate(candidate);
      return;
    }

    this.addIceCandidateInternal(candidate);
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

    this.clearDisconnectTimer();

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

    // Reset answer processed flag
    this.answerProcessed = false;
    this.pendingIceCandidates = [];
  }
}

export class CallClient {
  private incomingHandlers = new Set<IncomingCallHandler>();
  private missedHandlers = new Set<MissedCallHandler>();
  private activeSession: CallSessionImpl | null = null;
  private cachedIceServers: {
    servers: RTCIceServer[];
    expiresAt: number;
  } | null = null;
  private iceServersOverride?: RTCIceServer[];
  private tokenStore?: SenderTokenStore;
  private callCipher?: GroupCipher;
  private getGroupEpoch?: (groupId: GroupId) => number | Promise<number>;
  private baseUrl?: string;

  constructor(
    private wsClient: WebSocketClient,
    options: CallClientOptions = {},
  ) {
    this.iceServersOverride = options.iceServers;
    this.tokenStore = options.tokenStore;
    this.callCipher = options.callCipher;
    this.getGroupEpoch = options.getGroupEpoch;
    this.baseUrl = options.baseUrl;
    this.wsClient.onEvent(this.handleEvent);
  }

  async startCall(options: {
    groupId: GroupId;
    toUserId: UserId;
    remoteUserName?: string | null;
    callerId?: UserId | null;
    callerName?: string | null;
    epoch?: number;
  }): Promise<CallSession> {
    if (this.activeSession) {
      throw new Error('Already in a call');
    }

    const callId = generateCallId();
    const iceServers = await this.getIceServers();

    const session = new CallSessionImpl({
      callId,
      groupId: options.groupId,
      direction: 'outgoing',
      remoteUserId: options.toUserId,
      remoteUserName: options.remoteUserName ?? null,
      wsClient: this.wsClient,
      iceServers,
    });

    this.activeSession = session;

    // Auto-cleanup when session ends
    session.onStateChange((state) => {
      if (state === 'ended') {
        this.activeSession = null;
      }
    });

    const signalOptions = await this.buildOutgoingSignalOptions({
      groupId: options.groupId,
      callId,
      callerId: options.callerId ?? null,
      callerName: options.callerName ?? null,
      epoch: options.epoch,
    });

    await session.initOutgoing(options.toUserId, signalOptions);

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

  private async handleIncomingOffer(
    event: Extract<WebSocketEvent, { type: 'callOffer' }>,
  ): Promise<void> {
    if (this.activeSession) {
      console.log('[call] Ignoring incoming call (already in a call)');
      return;
    }

    const iceServers = await this.getIceServers();

    if (this.activeSession) {
      return;
    }

    const session = new CallSessionImpl({
      callId: event.callId,
      groupId: event.groupId,
      direction: 'incoming',
      remoteUserId: event.fromUserId,
      remoteUserName: event.fromUserId,
      wsClient: this.wsClient,
      iceServers,
    });

    this.activeSession = session;

    // Auto-cleanup when session ends
    session.onStateChange((state) => {
      if (state === 'ended') {
        this.activeSession = null;
      }
    });

    const callerIdentity = await this.tryDecryptCallerIdentity(
      event.groupId,
      event.callId,
      event.sealedSender,
    );

    if (callerIdentity) {
      session.remoteUserId = callerIdentity.senderId;
      session.remoteUserName = callerIdentity.senderName;
    }

    // Handle the offer (this sets up the peer connection but doesn't send answer yet)
    try {
      await session.handleIncomingOffer({ type: 'offer', sdp: event.sdp });
    } catch (err) {
      console.error('[call] Failed to handle incoming offer:', err);
      this.activeSession = null;
      return;
    }

    if (this.activeSession !== session || session.state === 'ended') {
      return;
    }

    // Notify listeners
    for (const handler of this.incomingHandlers) {
      handler(session as IncomingCallSession);
    }
  }

  private async buildOutgoingSignalOptions(options: {
    groupId: GroupId;
    callId: CallId;
    callerId: UserId | null;
    callerName: string | null;
    epoch?: number;
  }): Promise<OutgoingSignalOptions> {
    let sealedSender: string | undefined;
    let senderToken: SealedSenderToken | undefined;
    let fromUserId = options.callerId ?? null;

    if (this.tokenStore) {
      const token = await this.tokenStore.getToken(options.groupId);
      if (token) {
        senderToken = token;
      }
    }

    const callKey = await this.tryDeriveCallKey(
      options.groupId,
      options.callId,
      options.epoch,
    );

    if (callKey && options.callerId && options.callerName) {
      sealedSender = await encryptCallerId(
        options.callerId,
        options.callerName,
        callKey,
      );
      fromUserId = null;
    }

    return {
      fromUserId,
      sealedSender,
      senderToken,
    };
  }

  private async tryDeriveCallKey(
    groupId: GroupId,
    callId: CallId,
    epoch?: number,
  ): Promise<CryptoKey | null> {
    if (!this.callCipher) {
      return null;
    }

    const resolvedEpoch =
      epoch !== undefined ? epoch : await this.resolveGroupEpoch(groupId);

    if (resolvedEpoch === null) {
      return null;
    }

    try {
      return await deriveCallSigningKey(
        this.callCipher,
        groupId,
        resolvedEpoch,
        callId,
      );
    } catch (error) {
      console.error('[call] Failed to derive call key', error);
      return null;
    }
  }

  private async tryDecryptCallerIdentity(
    groupId: GroupId,
    callId: CallId,
    sealedSender?: string,
  ): Promise<{
    senderId: UserId;
    senderName: string;
  } | null> {
    if (!sealedSender) {
      return null;
    }

    try {
      const callKey = await this.tryDeriveCallKey(groupId, callId);
      if (!callKey) {
        return null;
      }
      const payload = await decryptCallerId(sealedSender, callKey);
      return { senderId: payload.senderId, senderName: payload.senderName };
    } catch (error) {
      console.error(
        '[call] Failed to decrypt caller identity or derive key',
        error,
      );
      return null;
    }
  }

  private async resolveGroupEpoch(groupId: GroupId): Promise<number | null> {
    if (!this.getGroupEpoch) {
      return null;
    }

    try {
      return await this.getGroupEpoch(groupId);
    } catch (error) {
      console.error('[call] Failed to resolve group epoch', error);
      return null;
    }
  }

  private async getIceServers(): Promise<RTCIceServer[]> {
    if (this.iceServersOverride) {
      return this.iceServersOverride;
    }

    if (this.cachedIceServers && Date.now() < this.cachedIceServers.expiresAt) {
      return this.cachedIceServers.servers;
    }

    if (!this.baseUrl) {
      return DEFAULT_ICE_SERVERS;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/calls/ice-servers`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        console.error('[call] Failed to fetch ICE servers', response.status);
        return DEFAULT_ICE_SERVERS;
      }

      const data = (await response.json()) as {
        iceServers?: RTCIceServer[];
        ttl?: number;
      };

      const servers =
        Array.isArray(data.iceServers) && data.iceServers.length > 0
          ? data.iceServers
          : DEFAULT_ICE_SERVERS;

      if (typeof data.ttl === 'number' && data.ttl > 0) {
        this.cachedIceServers = {
          servers,
          expiresAt: Date.now() + data.ttl * 1000,
        };
      }

      return servers;
    } catch (error) {
      console.error('[call] Failed to fetch ICE servers', error);
      return DEFAULT_ICE_SERVERS;
    }
  }

  private handleEvent = (event: WebSocketEvent): void => {
    switch (event.type) {
      case 'callOffer': {
        void this.handleIncomingOffer(event);
        break;
      }

      case 'callAnswer': {
        if (!this.activeSession || this.activeSession.callId !== event.callId) {
          return;
        }

        // Only the outgoing side (caller) should process answers
        // The incoming side (callee) sends the answer and shouldn't receive it back
        if (this.activeSession.direction !== 'outgoing') {
          return;
        }

        this.activeSession.handleAnswer({ type: 'answer', sdp: event.sdp });
        break;
      }

      case 'iceCandidate': {
        if (!this.activeSession || this.activeSession.callId !== event.callId) {
          return;
        }

        this.activeSession.handleIceCandidate(event.candidate);
        break;
      }

      case 'callEnd': {
        if (!this.activeSession || this.activeSession.callId !== event.callId) {
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
