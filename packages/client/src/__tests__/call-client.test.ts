import type {
  CallId,
  CallState,
  GroupId,
  UserId,
  WebSocketEvent,
} from '@microchat/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CallClient } from '../call-client';
import type { WebSocketClient, WebSocketEventHandler } from '../websocket-client';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

/** Minimal mock RTCPeerConnection that exposes controllable state. */
function createMockPC() {
  let _connectionState: RTCPeerConnectionState = 'new';
  let _signalingState: RTCSignalingState = 'stable';
  let onconnectionstatechange: (() => void) | null = null;
  let onicecandidate: ((e: { candidate: RTCIceCandidate | null }) => void) | null = null;
  let ontrack: ((e: unknown) => void) | null = null;

  const pc: Record<string, unknown> = {
    get connectionState() {
      return _connectionState;
    },
    get signalingState() {
      return _signalingState;
    },
    set onconnectionstatechange(fn: (() => void) | null) {
      onconnectionstatechange = fn;
    },
    get onconnectionstatechange() {
      return onconnectionstatechange;
    },
    set onicecandidate(fn: ((e: { candidate: RTCIceCandidate | null }) => void) | null) {
      onicecandidate = fn;
    },
    get onicecandidate() {
      return onicecandidate;
    },
    set ontrack(fn: ((e: unknown) => void) | null) {
      ontrack = fn;
    },
    get ontrack() {
      return ontrack;
    },
    createDataChannel: vi.fn(),
    addTrack: vi.fn(),
    createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-offer-sdp' }),
    createAnswer: vi.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-answer-sdp' }),
    setLocalDescription: vi.fn().mockResolvedValue(undefined),
    setRemoteDescription: vi.fn(async (desc: RTCSessionDescriptionInit) => {
      _signalingState = 'stable';
      (pc as Record<string, unknown>)._remoteDescription = desc;
    }),
    addIceCandidate: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
    _remoteDescription: null as RTCSessionDescriptionInit | null,
    get remoteDescription() {
      return (pc as Record<string, unknown>)._remoteDescription ?? null;
    },
    get localDescription() {
      return { sdp: 'mock-offer-sdp', type: 'offer' };
    },
  };

  // Helpers to drive state from tests
  const helpers = {
    simulateConnectionState(state: RTCPeerConnectionState) {
      _connectionState = state;
      onconnectionstatechange?.();
    },
    simulateSignalingState(state: RTCSignalingState) {
      _signalingState = state;
    },
    setSignalingForOffer() {
      _signalingState = 'have-local-offer';
    },
    setSignalingForAnswer() {
      _signalingState = 'have-remote-offer';
    },
  };

  return { pc, helpers };
}

/** Captures events sent through the mock WebSocketClient. */
function createMockWsClient() {
  const handlers = new Set<WebSocketEventHandler>();
  const sentEvents: WebSocketEvent[] = [];

  const wsClient = {
    onEvent(handler: WebSocketEventHandler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    sendEvent(event: WebSocketEvent) {
      sentEvents.push(event);
    },
  } as unknown as WebSocketClient;

  return {
    wsClient,
    sentEvents,
    /** Simulate receiving an event from the server. */
    receive(event: WebSocketEvent) {
      for (const handler of handlers) {
        handler(event);
      }
    },
  };
}

// Shared constants
const GROUP_ID = 'group-1' as GroupId;
const CALLER_ID = 'user-caller' as UserId;
const CALLEE_ID = 'user-callee' as UserId;
const CALL_ID = 'call-123' as CallId;

// ---------------------------------------------------------------------------
// Stub browser globals
// ---------------------------------------------------------------------------

let latestMockPC: ReturnType<typeof createMockPC>;

beforeEach(() => {
  vi.useFakeTimers();

  latestMockPC = createMockPC();

  vi.stubGlobal(
    'RTCPeerConnection',
    class {
      constructor() {
        return latestMockPC.pc;
      }
    },
  );
  vi.stubGlobal(
    'RTCIceCandidate',
    class {
      constructor(init: RTCIceCandidateInit) {
        return init;
      }
    },
  );
  vi.stubGlobal(
    'RTCSessionDescription',
    class {
      constructor(init: RTCSessionDescriptionInit) {
        return init;
      }
    },
  );

  // Mock getUserMedia — no navigator.mediaDevices in Node
  const mockTrack = { stop: vi.fn(), enabled: true, kind: 'audio' };
  const mockStream = {
    getTracks: () => [mockTrack],
    getAudioTracks: () => [mockTrack],
  };
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue(mockStream),
    },
  });

  // Mock fetch for ICE server endpoint
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      iceServers: [{ urls: 'stun:stun.test.com:3478' }],
      ttl: 3600,
    }),
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CallClient', () => {
  describe('outgoing call flow', () => {
    it('transitions through ringing-out → connecting → active on successful call', async () => {
      const { wsClient, sentEvents, receive } = createMockWsClient();
      const client = new CallClient(wsClient, { baseUrl: 'http://localhost' });

      const states: CallState[] = [];
      const session = await client.startCall({
        groupId: GROUP_ID,
        toUserId: CALLEE_ID,
        callerId: CALLER_ID,
      });
      session.onStateChange((s) => states.push(s));

      // Should have sent a callOffer
      const offer = sentEvents.find((e) => e.type === 'callOffer');
      expect(offer).toBeDefined();
      expect(offer!.type).toBe('callOffer');

      // Simulate callee answering
      latestMockPC.helpers.setSignalingForOffer();
      receive({
        type: 'callAnswer',
        groupId: GROUP_ID,
        callId: session.callId,
        fromUserId: CALLEE_ID,
        sdp: 'mock-answer-sdp',
      });

      // Wait for async setRemoteDescription
      await vi.advanceTimersByTimeAsync(0);

      expect(states).toContain('connecting');

      // Simulate WebRTC connected
      latestMockPC.helpers.simulateConnectionState('connected');
      expect(states).toContain('active');
      expect(session.state).toBe('active');
    });

    it('sends callEnd on hangup', async () => {
      const { wsClient, sentEvents } = createMockWsClient();
      const client = new CallClient(wsClient, { baseUrl: 'http://localhost' });

      const session = await client.startCall({
        groupId: GROUP_ID,
        toUserId: CALLEE_ID,
        callerId: CALLER_ID,
      });

      await session.hangup();

      const end = sentEvents.find((e) => e.type === 'callEnd');
      expect(end).toBeDefined();
      expect(session.state).toBe('ended');
    });
  });

  describe('incoming call flow', () => {
    it('creates an incoming session and transitions on accept', async () => {
      const { wsClient, receive } = createMockWsClient();
      const client = new CallClient(wsClient, { baseUrl: 'http://localhost' });

      const incomingPromise = new Promise<Awaited<ReturnType<typeof client.startCall>>>((resolve) => {
        client.onIncomingCall((session) => resolve(session));
      });

      receive({
        type: 'callOffer',
        groupId: GROUP_ID,
        callId: CALL_ID,
        toUserId: CALLEE_ID,
        fromUserId: CALLER_ID,
        sdp: 'mock-offer-sdp',
        timestamp: new Date().toISOString(),
      });

      // Wait for async handling
      await vi.advanceTimersByTimeAsync(0);

      const session = await incomingPromise;
      expect(session.direction).toBe('incoming');
      expect(session.state).toBe('ringing-in');

      // Accept the call
      latestMockPC.helpers.setSignalingForAnswer();
      await session.accept();

      expect(session.state).toBe('connecting');
    });

    it('sends callEnd with reason rejected on reject', async () => {
      const { wsClient, sentEvents, receive } = createMockWsClient();
      const client = new CallClient(wsClient, { baseUrl: 'http://localhost' });

      const incomingPromise = new Promise<Awaited<ReturnType<typeof client.startCall>>>((resolve) => {
        client.onIncomingCall((session) => resolve(session));
      });

      receive({
        type: 'callOffer',
        groupId: GROUP_ID,
        callId: CALL_ID,
        toUserId: CALLEE_ID,
        fromUserId: CALLER_ID,
        sdp: 'mock-offer-sdp',
        timestamp: new Date().toISOString(),
      });

      await vi.advanceTimersByTimeAsync(0);
      const session = await incomingPromise;

      await session.reject();

      const end = sentEvents.find((e) => e.type === 'callEnd');
      expect(end).toBeDefined();
      expect(end!.type === 'callEnd' && end!.reason).toBe('rejected');
      expect(session.state).toBe('ended');
    });
  });

  describe('ICE restart on failure', () => {
    it('attempts ICE restart when connection fails on outgoing call', async () => {
      const { wsClient, sentEvents } = createMockWsClient();
      const client = new CallClient(wsClient, { baseUrl: 'http://localhost' });

      const session = await client.startCall({
        groupId: GROUP_ID,
        toUserId: CALLEE_ID,
        callerId: CALLER_ID,
      });

      const offerCountBefore = sentEvents.filter((e) => e.type === 'callOffer').length;

      // Simulate connection failure
      latestMockPC.helpers.simulateConnectionState('failed');

      // Wait for async ICE restart
      await vi.advanceTimersByTimeAsync(0);

      // Should have sent a new offer (ICE restart)
      expect(latestMockPC.pc.createOffer).toHaveBeenCalledWith({ iceRestart: true });
      const offerCountAfter = sentEvents.filter((e) => e.type === 'callOffer').length;
      expect(offerCountAfter).toBe(offerCountBefore + 1);

      // Session should NOT be ended yet (gave ICE restart a chance)
      expect(session.state).not.toBe('ended');
    });

    it('hangs up on second failure after ICE restart already attempted', async () => {
      const { wsClient } = createMockWsClient();
      const client = new CallClient(wsClient, { baseUrl: 'http://localhost' });

      const session = await client.startCall({
        groupId: GROUP_ID,
        toUserId: CALLEE_ID,
        callerId: CALLER_ID,
      });

      // First failure → triggers ICE restart
      latestMockPC.helpers.simulateConnectionState('failed');
      await vi.advanceTimersByTimeAsync(0);
      expect(session.state).not.toBe('ended');

      // Briefly go back to new so the second 'failed' transition fires the handler
      latestMockPC.helpers.simulateConnectionState('new');

      // Second failure → should hang up
      latestMockPC.helpers.simulateConnectionState('failed');
      await vi.advanceTimersByTimeAsync(0);
      expect(session.state).toBe('ended');
    });

    it('resets ICE restart flag when connection succeeds', async () => {
      const { wsClient, sentEvents } = createMockWsClient();
      const client = new CallClient(wsClient, { baseUrl: 'http://localhost' });

      const session = await client.startCall({
        groupId: GROUP_ID,
        toUserId: CALLEE_ID,
        callerId: CALLER_ID,
      });

      // First failure → ICE restart
      latestMockPC.helpers.simulateConnectionState('failed');
      await vi.advanceTimersByTimeAsync(0);

      // Connection recovers
      latestMockPC.helpers.simulateConnectionState('connected');
      expect(session.state).toBe('active');

      // Another failure → should attempt ICE restart again (flag was reset)
      latestMockPC.helpers.simulateConnectionState('failed');
      await vi.advanceTimersByTimeAsync(0);

      const iceRestartOffers = (latestMockPC.pc.createOffer as ReturnType<typeof vi.fn>).mock.calls.filter(
        (args: unknown[]) => (args[0] as { iceRestart?: boolean })?.iceRestart,
      );
      expect(iceRestartOffers).toHaveLength(2);
      expect(session.state).not.toBe('ended');
    });
  });

  describe('disconnect grace period (15s)', () => {
    it('does not hang up immediately on disconnect', async () => {
      const { wsClient } = createMockWsClient();
      const client = new CallClient(wsClient, { baseUrl: 'http://localhost' });

      const session = await client.startCall({
        groupId: GROUP_ID,
        toUserId: CALLEE_ID,
        callerId: CALLER_ID,
      });

      // Get to active state first
      latestMockPC.helpers.simulateConnectionState('connected');
      expect(session.state).toBe('active');

      // Simulate transient disconnect
      latestMockPC.helpers.simulateConnectionState('disconnected');

      // Advance 10s — should still be alive
      await vi.advanceTimersByTimeAsync(10_000);
      expect(session.state).not.toBe('ended');
    });

    it('hangs up after 15s of sustained disconnect', async () => {
      const { wsClient } = createMockWsClient();
      const client = new CallClient(wsClient, { baseUrl: 'http://localhost' });

      const session = await client.startCall({
        groupId: GROUP_ID,
        toUserId: CALLEE_ID,
        callerId: CALLER_ID,
      });

      latestMockPC.helpers.simulateConnectionState('connected');
      latestMockPC.helpers.simulateConnectionState('disconnected');

      // Advance past 15s grace period
      await vi.advanceTimersByTimeAsync(16_000);
      expect(session.state).toBe('ended');
    });

    it('cancels disconnect timer if connection recovers', async () => {
      const { wsClient } = createMockWsClient();
      const client = new CallClient(wsClient, { baseUrl: 'http://localhost' });

      const session = await client.startCall({
        groupId: GROUP_ID,
        toUserId: CALLEE_ID,
        callerId: CALLER_ID,
      });

      latestMockPC.helpers.simulateConnectionState('connected');
      latestMockPC.helpers.simulateConnectionState('disconnected');

      // Advance 10s then recover
      await vi.advanceTimersByTimeAsync(10_000);
      latestMockPC.helpers.simulateConnectionState('connected');

      // Advance well past the original 15s
      await vi.advanceTimersByTimeAsync(20_000);
      expect(session.state).toBe('active');
    });
  });

  describe('connecting timeout (30s)', () => {
    it('hangs up if call stays in ringing-out for 30s', async () => {
      const { wsClient } = createMockWsClient();
      const client = new CallClient(wsClient, { baseUrl: 'http://localhost' });

      const session = await client.startCall({
        groupId: GROUP_ID,
        toUserId: CALLEE_ID,
        callerId: CALLER_ID,
      });

      expect(session.state).toBe('ringing-out');

      // Advance to 29s — should still be ringing
      await vi.advanceTimersByTimeAsync(29_000);
      expect(session.state).toBe('ringing-out');

      // Advance past 30s
      await vi.advanceTimersByTimeAsync(2_000);
      expect(session.state).toBe('ended');
    });

    it('hangs up if call stays in connecting for 30s', async () => {
      const { wsClient, receive } = createMockWsClient();
      const client = new CallClient(wsClient, { baseUrl: 'http://localhost' });

      const session = await client.startCall({
        groupId: GROUP_ID,
        toUserId: CALLEE_ID,
        callerId: CALLER_ID,
      });

      // Simulate answer to move to connecting
      latestMockPC.helpers.setSignalingForOffer();
      receive({
        type: 'callAnswer',
        groupId: GROUP_ID,
        callId: session.callId,
        fromUserId: CALLEE_ID,
        sdp: 'mock-answer-sdp',
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(session.state).toBe('connecting');

      // Advance past 30s without connecting
      await vi.advanceTimersByTimeAsync(31_000);
      expect(session.state).toBe('ended');
    });

    it('cancels connecting timeout when connection succeeds', async () => {
      const { wsClient, receive } = createMockWsClient();
      const client = new CallClient(wsClient, { baseUrl: 'http://localhost' });

      const session = await client.startCall({
        groupId: GROUP_ID,
        toUserId: CALLEE_ID,
        callerId: CALLER_ID,
      });

      latestMockPC.helpers.setSignalingForOffer();
      receive({
        type: 'callAnswer',
        groupId: GROUP_ID,
        callId: session.callId,
        fromUserId: CALLEE_ID,
        sdp: 'mock-answer-sdp',
      });
      await vi.advanceTimersByTimeAsync(0);

      // Connect successfully at 10s
      await vi.advanceTimersByTimeAsync(10_000);
      latestMockPC.helpers.simulateConnectionState('connected');
      expect(session.state).toBe('active');

      // Advance well past 30s — should still be active
      await vi.advanceTimersByTimeAsync(30_000);
      expect(session.state).toBe('active');
    });
  });

  describe('ICE candidate handling', () => {
    it('queues ICE candidates received before remote description is set', async () => {
      const { wsClient, receive } = createMockWsClient();
      const client = new CallClient(wsClient, { baseUrl: 'http://localhost' });

      const session = await client.startCall({
        groupId: GROUP_ID,
        toUserId: CALLEE_ID,
        callerId: CALLER_ID,
      });

      // Send ICE candidate before answer
      receive({
        type: 'iceCandidate',
        groupId: GROUP_ID,
        callId: session.callId,
        fromUserId: CALLEE_ID,
        candidate: {
          candidate: 'candidate:1 1 udp 2113937151 192.168.1.1 5000 typ host',
          sdpMid: '0',
          sdpMLineIndex: 0,
        },
      });

      // Should not have called addIceCandidate yet (no remote description)
      expect(latestMockPC.pc.addIceCandidate).not.toHaveBeenCalled();

      // Now receive the answer
      latestMockPC.helpers.setSignalingForOffer();
      receive({
        type: 'callAnswer',
        groupId: GROUP_ID,
        callId: session.callId,
        fromUserId: CALLEE_ID,
        sdp: 'mock-answer-sdp',
      });
      await vi.advanceTimersByTimeAsync(0);

      // Queued candidate should now be flushed
      expect(latestMockPC.pc.addIceCandidate).toHaveBeenCalled();
    });
  });

  describe('missed call handling', () => {
    it('notifies missed call handlers when callEnd with reason missed is received', async () => {
      const { wsClient, receive } = createMockWsClient();
      const client = new CallClient(wsClient, { baseUrl: 'http://localhost' });

      const session = await client.startCall({
        groupId: GROUP_ID,
        toUserId: CALLEE_ID,
        callerId: CALLER_ID,
      });

      const missedCalls: Array<{ groupId: GroupId; callId: CallId }> = [];
      client.onMissedCall((event) => missedCalls.push(event));

      receive({
        type: 'callEnd',
        groupId: GROUP_ID,
        callId: session.callId,
        fromUserId: CALLEE_ID,
        reason: 'missed',
      });

      expect(missedCalls).toHaveLength(1);
      expect(missedCalls[0].callId).toBe(session.callId);
      expect(session.state).toBe('ended');
    });
  });

  describe('mute', () => {
    it('toggles audio track enabled state', async () => {
      const { wsClient } = createMockWsClient();
      const client = new CallClient(wsClient, { baseUrl: 'http://localhost' });

      const session = await client.startCall({
        groupId: GROUP_ID,
        toUserId: CALLEE_ID,
        callerId: CALLER_ID,
      });

      // The mock stream tracks should be accessible
      const tracks = session.localStream?.getAudioTracks();
      expect(tracks).toBeDefined();

      session.setMute(true);
      for (const track of session.localStream?.getAudioTracks() ?? []) {
        expect(track.enabled).toBe(false);
      }

      session.setMute(false);
      for (const track of session.localStream?.getAudioTracks() ?? []) {
        expect(track.enabled).toBe(true);
      }
    });
  });

  describe('duplicate call prevention', () => {
    it('throws when starting a second call while one is active', async () => {
      const { wsClient } = createMockWsClient();
      const client = new CallClient(wsClient, { baseUrl: 'http://localhost' });

      await client.startCall({
        groupId: GROUP_ID,
        toUserId: CALLEE_ID,
        callerId: CALLER_ID,
      });

      await expect(
        client.startCall({
          groupId: GROUP_ID,
          toUserId: 'user-other' as UserId,
          callerId: CALLER_ID,
        }),
      ).rejects.toThrow('Already in a call');
    });

    it('allows a new call after the previous one ends', async () => {
      const { wsClient } = createMockWsClient();
      const client = new CallClient(wsClient, { baseUrl: 'http://localhost' });

      const session1 = await client.startCall({
        groupId: GROUP_ID,
        toUserId: CALLEE_ID,
        callerId: CALLER_ID,
      });

      await session1.hangup();

      // Should succeed
      const session2 = await client.startCall({
        groupId: GROUP_ID,
        toUserId: CALLEE_ID,
        callerId: CALLER_ID,
      });
      expect(session2.callId).not.toBe(session1.callId);
    });
  });
});
