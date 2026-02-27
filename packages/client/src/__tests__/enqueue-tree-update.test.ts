/**
 * Unit tests for the enqueueTreeUpdate coalescing algorithm used in useWebSocket.
 *
 * The function guarantees two properties:
 *   1. Burst coalescing — when N treeUpdate events arrive for the same group
 *      before any of them have processed, invalidateQueries fires only ONCE
 *      (for the last update in the chain), not N times.
 *   2. Background-group guard — invalidateQueries is NEVER called for a group
 *      that is not currently active (activeGroupIdRef.current).
 *
 * We test the algorithm directly without React to keep tests fast and dependency-free.
 */
import type { GroupId } from '@microchat/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Minimal reproduction of the enqueueTreeUpdate algorithm
// ---------------------------------------------------------------------------

type TreeUpdateEvent = { type: 'treeUpdate'; groupId: GroupId };

function makeEnqueueTreeUpdate(deps: {
  handleTreeUpdate: (event: TreeUpdateEvent) => Promise<void>;
  invalidateQueries: (groupId: GroupId) => void;
  activeGroupIdRef: { current: GroupId | null };
}) {
  const chainMap = new Map<GroupId, Promise<void>>();

  return function enqueueTreeUpdate(event: TreeUpdateEvent) {
    const prev = chainMap.get(event.groupId) ?? Promise.resolve();

    const next = prev
      .catch(() => {})
      .then(async () => {
        await deps.handleTreeUpdate(event);
      });

    chainMap.set(event.groupId, next);
    next
      .catch(() => {})
      .finally(() => {
        if (chainMap.get(event.groupId) === next) {
          chainMap.delete(event.groupId);
          if (event.groupId === deps.activeGroupIdRef.current) {
            deps.invalidateQueries(event.groupId);
          }
        }
      });

    return next;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(groupId: GroupId): TreeUpdateEvent {
  return { type: 'treeUpdate', groupId };
}

/** Flushes the microtask / promise queue. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('enqueueTreeUpdate — burst coalescing', () => {
  let invalidateQueries: ReturnType<typeof vi.fn>;
  let handleTreeUpdate: ReturnType<typeof vi.fn>;
  let activeGroupIdRef: { current: GroupId | null };

  const GROUP = 'group-1' as GroupId;

  beforeEach(() => {
    invalidateQueries = vi.fn();
    handleTreeUpdate = vi.fn().mockResolvedValue(undefined);
    activeGroupIdRef = { current: GROUP };
  });

  it('calls invalidateQueries exactly once for a single update', async () => {
    const enqueue = makeEnqueueTreeUpdate({
      handleTreeUpdate,
      invalidateQueries,
      activeGroupIdRef,
    });

    enqueue(makeEvent(GROUP));
    await flush();

    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith(GROUP);
  });

  it('coalesces a burst — invalidateQueries fires only once for N rapid updates', async () => {
    const enqueue = makeEnqueueTreeUpdate({
      handleTreeUpdate,
      invalidateQueries,
      activeGroupIdRef,
    });

    // Enqueue 5 updates synchronously before any promise resolves
    enqueue(makeEvent(GROUP));
    enqueue(makeEvent(GROUP));
    enqueue(makeEvent(GROUP));
    enqueue(makeEvent(GROUP));
    enqueue(makeEvent(GROUP));

    await flush();

    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith(GROUP);
  });

  it('calls handleTreeUpdate for every event even in a burst', async () => {
    const enqueue = makeEnqueueTreeUpdate({
      handleTreeUpdate,
      invalidateQueries,
      activeGroupIdRef,
    });

    enqueue(makeEvent(GROUP));
    enqueue(makeEvent(GROUP));
    enqueue(makeEvent(GROUP));

    await flush();

    // All three tree updates must be processed
    expect(handleTreeUpdate).toHaveBeenCalledTimes(3);
    // But only one invalidation
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
  });

  it('fires again for a second burst after the first settles', async () => {
    const enqueue = makeEnqueueTreeUpdate({
      handleTreeUpdate,
      invalidateQueries,
      activeGroupIdRef,
    });

    // First burst
    enqueue(makeEvent(GROUP));
    enqueue(makeEvent(GROUP));
    await flush();
    expect(invalidateQueries).toHaveBeenCalledTimes(1);

    // Second burst after a tick
    enqueue(makeEvent(GROUP));
    enqueue(makeEvent(GROUP));
    await flush();
    expect(invalidateQueries).toHaveBeenCalledTimes(2);
  });

  it('keeps queues independent per group — each group coalesces separately', async () => {
    const GROUP_A = 'group-a' as GroupId;
    const GROUP_B = 'group-b' as GroupId;
    activeGroupIdRef.current = GROUP_A; // only A is active

    const enqueue = makeEnqueueTreeUpdate({
      handleTreeUpdate,
      invalidateQueries,
      activeGroupIdRef,
    });

    enqueue(makeEvent(GROUP_A));
    enqueue(makeEvent(GROUP_A));
    enqueue(makeEvent(GROUP_B));
    enqueue(makeEvent(GROUP_B));

    await flush();

    // Only group A is active → only one invalidation call, for A
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith(GROUP_A);
    expect(invalidateQueries).not.toHaveBeenCalledWith(GROUP_B);
  });
});

describe('enqueueTreeUpdate — background-group guard', () => {
  it('does NOT call invalidateQueries when the group is not active', async () => {
    const invalidateQueries = vi.fn();
    const handleTreeUpdate = vi.fn().mockResolvedValue(undefined);
    const activeGroupIdRef: { current: GroupId | null } = {
      current: 'other-group' as GroupId,
    };

    const enqueue = makeEnqueueTreeUpdate({
      handleTreeUpdate,
      invalidateQueries,
      activeGroupIdRef,
    });

    enqueue(makeEvent('background-group' as GroupId));
    await flush();

    expect(handleTreeUpdate).toHaveBeenCalledTimes(1); // still processes
    expect(invalidateQueries).not.toHaveBeenCalled();  // but no refetch
  });

  it('does NOT call invalidateQueries when activeGroupId is null', async () => {
    const invalidateQueries = vi.fn();
    const handleTreeUpdate = vi.fn().mockResolvedValue(undefined);
    const activeGroupIdRef: { current: GroupId | null } = { current: null };

    const enqueue = makeEnqueueTreeUpdate({
      handleTreeUpdate,
      invalidateQueries,
      activeGroupIdRef,
    });

    enqueue(makeEvent('group-1' as GroupId));
    await flush();

    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it('calls invalidateQueries for the newly active group after ref update', async () => {
    const invalidateQueries = vi.fn();
    const handleTreeUpdate = vi.fn().mockResolvedValue(undefined);
    const activeGroupIdRef: { current: GroupId | null } = {
      current: null, // starts with no active group
    };

    const enqueue = makeEnqueueTreeUpdate({
      handleTreeUpdate,
      invalidateQueries,
      activeGroupIdRef,
    });

    // User navigates to group-1 before the update settles
    activeGroupIdRef.current = 'group-1' as GroupId;
    enqueue(makeEvent('group-1' as GroupId));
    await flush();

    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith('group-1');
  });
});

describe('enqueueTreeUpdate — failure resilience', () => {
  it('continues processing subsequent updates after a handleTreeUpdate failure', async () => {
    const invalidateQueries = vi.fn();
    let callCount = 0;
    const handleTreeUpdate = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) throw new Error('tree error');
    });
    const activeGroupIdRef: { current: GroupId | null } = {
      current: 'group-1' as GroupId,
    };

    const enqueue = makeEnqueueTreeUpdate({
      handleTreeUpdate,
      invalidateQueries,
      activeGroupIdRef,
    });

    enqueue(makeEvent('group-1' as GroupId));
    enqueue(makeEvent('group-1' as GroupId));

    await flush();

    // Both updates were attempted
    expect(handleTreeUpdate).toHaveBeenCalledTimes(2);
    // The last (successful) update triggers invalidation
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
  });
});
