'use client';

import {
  type GroupId,
  type MessageListItem,
  type MessagePayload,
  type UserId,
  uint8ArrayToBase64,
} from '@microchat/client';
import {
  GearIcon,
  HighlighterIcon,
  SpinnerGapIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { AnimatePresence, motion } from 'framer-motion';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { CallButton } from '@/components/CallButton';
import GroupSettings from '@/components/GroupSettings';
import { ImageMessage } from '@/components/ImageMessage';
import { IncomingCallModal } from '@/components/IncomingCallModal';
import { MessageInput } from '@/components/MessageInput';
import { VoiceMessagePlayer } from '@/components/VoiceMessagePlayer';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useDeleteMessage } from '@/hooks/useDeleteMessage';
import { useJoinGroup } from '@/hooks/useJoinGroup';
import { useMembers } from '@/hooks/useMembers';
import { useMessages } from '@/hooks/useMessages';
import { useSendMessage } from '@/hooks/useSendMessage';
import { useSfx } from '@/hooks/useSfx';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useCallStore } from '@/stores/call-store';
import { useChatClientStore } from '@/stores/chat-client-store';
import { useChatStore } from '@/stores/chat-store';
import { usePresenceStore } from '@/stores/presence-store';

export default function ConversationPage() {
  const params = useParams();
  const groupId = params?.groupId as string | undefined;
  const t = useTranslations('GroupChat');

  const { getClient } = useChatClientStore();
  const client = getClient();
  const _playSfx = useSfx();

  // Server state with React Query
  const {
    data: messages = [],
    isLoading: loading,
    error,
    refetch,
  } = useMessages(groupId as GroupId);
  const { data: members = [] } = useMembers(groupId as GroupId);
  const { data: currentUser } = useCurrentUser();

  // Mutations
  const joinGroup = useJoinGroup();
  const sendMessage = useSendMessage(groupId as GroupId);
  const deleteMessage = useDeleteMessage(groupId as GroupId);

  // UI state from Zustand stores
  const connectionStatus = useChatStore((state) => state.connectionStatus);
  const showSettings = useChatStore((state) => state.showSettings);
  const setShowSettings = useChatStore((state) => state.setShowSettings);
  const deleteConfirmId = useChatStore((state) => state.deleteConfirmId);
  const setDeleteConfirmId = useChatStore((state) => state.setDeleteConfirmId);
  const deleting = useChatStore((state) => state.deleting);
  const setDeleting = useChatStore((state) => state.setDeleting);
  const highlightedIds = useChatStore((state) => state.highlightedIds);
  const toggleHighlightedId = useChatStore(
    (state) => state.toggleHighlightedId,
  );
  const _addHighlightedId = useChatStore((state) => state.addHighlightedId);
  const _removeHighlightedId = useChatStore(
    (state) => state.removeHighlightedId,
  );

  // Call state from Zustand
  const activeSession = useCallStore((state) => state.activeSession);
  const setActiveSession = useCallStore((state) => state.setActiveSession);
  const incomingSession = useCallStore((state) => state.incomingSession);
  const setIncomingSession = useCallStore((state) => state.setIncomingSession);
  const isCalling = useCallStore((state) => state.isCalling);
  const setIsCalling = useCallStore((state) => state.setIsCalling);
  const targetUserId = useCallStore((state) => state.targetUserId);
  const setTargetUserId = useCallStore((state) => state.setTargetUserId);
  const targetUserName = useCallStore((state) => state.targetUserName);
  const setTargetUserName = useCallStore((state) => state.setTargetUserName);
  const memberCount = useCallStore((state) => state.memberCount);
  const setMemberCount = useCallStore((state) => state.setMemberCount);
  const callState = useCallStore((state) => state.callState);
  const setCallState = useCallStore((state) => state.setCallState);

  // Presence state
  const onlineUsersByGroup = usePresenceStore(
    (state) => state.onlineUsersByGroup,
  );
  const onlineUsers = onlineUsersByGroup[groupId as GroupId];
  const isTargetUserOnline = targetUserId
    ? onlineUsers?.has(targetUserId)
    : false;
  const onlineUserCount = onlineUsers?.size ?? 0;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [_callDuration, setCallDuration] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Periodically update UI so messages fade/expire on time
  useEffect(() => {
    const int = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(int);
  }, []);

  // Get call key initializer from store
  const ensureCallKey = useChatClientStore((state) => state.ensureCallKey);

  // Initialize WebSocket connection
  useWebSocket(groupId as GroupId | null);

  // Initialize call key
  useEffect(() => {
    if (!groupId) return;
    ensureCallKey(groupId as GroupId).catch((err: Error) => {
      console.error('[call] Failed to initialize call cipher', err);
    });
  }, [groupId, ensureCallKey]);

  // Auto-join group if not a member
  const joinAttemptedRef = useRef(false);
  useEffect(() => {
    if (groupId && error && error.message.includes('Not a member')) {
      if (!joinAttemptedRef.current) {
        joinAttemptedRef.current = true;
        joinGroup.mutate(groupId as GroupId);
      }
    }
  }, [groupId, error, joinGroup.mutate]); // intentionally omit joinGroup to avoid loop

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  });

  useEffect(() => {
    if (callState !== 'in-call') {
      setCallDuration(0);
      return;
    }

    const interval = window.setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [callState]);

  // Setup call event listeners
  useEffect(() => {
    if (!client.calls) return;

    const offIncoming = client.calls.onIncomingCall((session) => {
      console.log('[call] Incoming call received', session);
      setIncomingSession(session);
      setCallState('incoming');

      // Subscribe to state changes
      let offState = () => {};
      offState = session.onStateChange((state) => {
        if (state === 'active') {
          setActiveSession(session);
          setIncomingSession(null);
          setIsCalling(false);
          setCallState('in-call');
        } else if (state === 'ended') {
          setActiveSession(null);
          setIncomingSession(null);
          setIsCalling(false);
          setCallState('idle');
          offState();
        }
      });
    });

    const offMissed = client.calls.onMissedCall((event) => {
      console.log('[call] Missed call', event);
    });

    return () => {
      offIncoming();
      offMissed();
    };
  }, [
    client,
    setActiveSession,
    setIncomingSession,
    setIsCalling,
    setCallState,
  ]);

  // Update call target info when members change
  useEffect(() => {
    if (!groupId || !currentUser) {
      setTargetUserId(null);
      setMemberCount(null);
      setTargetUserName(null);
      return;
    }

    setMemberCount(members.length);
    const otherMember = members.find((m) => m.userId !== currentUser.userId);
    setTargetUserId(otherMember?.userId ?? null);
    setTargetUserName(otherMember?.displayName ?? null);
  }, [
    groupId,
    currentUser,
    members,
    setTargetUserId,
    setMemberCount,
    setTargetUserName,
  ]);

  // Remote audio handling
  useEffect(() => {
    const audioEl = remoteAudioRef.current;
    if (!audioEl) return;

    if (!activeSession) {
      audioEl.srcObject = null;
      return;
    }

    let cancelled = false;
    const attachStream = () => {
      if (cancelled || !activeSession.remoteStream) return false;
      if (audioEl.srcObject !== activeSession.remoteStream) {
        audioEl.srcObject = activeSession.remoteStream;
        audioEl.play().catch(() => {});
      }
      return true;
    };

    if (attachStream()) {
      return () => {
        cancelled = true;
        audioEl.srcObject = null;
      };
    }

    const interval = window.setInterval(() => {
      if (attachStream()) {
        window.clearInterval(interval);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      audioEl.srcObject = null;
    };
  }, [activeSession]);

  // Stable callbacks for IncomingCallModal — must not change identity on re-render
  // to prevent useEffect in IncomingCallModal from re-running and calling accept() twice.
  const handleAcceptCall = useCallback(() => {
    if (!incomingSession) {
      console.warn('[call] Accept clicked but no incoming session');
      return;
    }

    console.log('[call] Accepting incoming call', {
      callId: incomingSession.callId,
      state: incomingSession.state,
      direction: incomingSession.direction,
    });

    incomingSession
      .accept()
      .then(() => {
        console.log(
          '[call] Accept resolved, session state:',
          incomingSession.state,
        );
        setActiveSession(incomingSession);
        setIncomingSession(null);
        setIsCalling(false);
        setCallState('calling');
      })
      .catch((error) => {
        console.error('[call] Accept failed', error);
      });
  }, [
    incomingSession,
    setActiveSession,
    setIncomingSession,
    setIsCalling,
    setCallState,
  ]);

  const handleRejectCall = useCallback(() => {
    incomingSession?.reject().catch(console.error);
    setIncomingSession(null);
    setCallState('idle');
  }, [incomingSession, setIncomingSession, setCallState]);

  // Handle call button click
  async function handleStartCall() {
    if (!client.calls || !targetUserId || !groupId) return;

    try {
      const session = await client.calls.startCall({
        groupId: groupId as GroupId,
        toUserId: targetUserId,
        remoteUserName: targetUserName,
        callerId: currentUser?.userId ?? null,
        callerName: currentUser?.displayName ?? null,
      });

      setActiveSession(session);
      setIsCalling(true);
      setCallState('calling');

      let offState = () => {};
      offState = session.onStateChange((state) => {
        if (state === 'active') {
          setIsCalling(false);
          setCallState('in-call');
        }
        if (state === 'ended') {
          setActiveSession(null);
          setIsCalling(false);
          setCallState('idle');
          offState();
        }
      });
    } catch (err) {
      console.error('[call] Failed to start call:', err);
      if (err instanceof Error && err.message.includes('Already in a call')) {
        setIsCalling(true);
      }
    }
  }

  async function handleSendMessage(content: string) {
    if (!groupId) return;
    await sendMessage.mutateAsync({ content });
  }

  async function handleSendVoiceMessage(audioBlob: Blob, duration: number) {
    if (!groupId) return;

    try {
      const result = await client.sendVoiceMessage(
        groupId as GroupId,
        audioBlob,
        duration,
      );

      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64 = uint8ArrayToBase64(new Uint8Array(arrayBuffer));
      const _payload: MessagePayload = {
        type: 'audio',
        data: base64,
        duration,
        mimeType: audioBlob.type,
      };

      // The message will be added by the WebSocket handler or mutation success
      console.log('Voice message sent:', result);
    } catch (err) {
      console.error('Failed to send voice message:', err);
    }
  }

  async function handleSendImage(blob: Blob, width: number, height: number) {
    if (!groupId) return;

    try {
      const result = await client.sendImageMessage(
        groupId as GroupId,
        blob,
        width,
        height,
      );

      console.log('Image message sent:', result);
    } catch (err) {
      console.error('Failed to send image message:', err);
    }
  }

  async function handleDeleteMessage(messageId: string) {
    if (!groupId) return;

    try {
      setDeleting(true);
      await deleteMessage.mutateAsync(messageId);
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Failed to delete message:', err);
      alert(t('deleteFailed'));
    } finally {
      setDeleting(false);
    }
  }

  function isOwnMessage(message: MessageListItem): boolean {
    if (!currentUser) return false;
    // Check both actual user ID and optimistic 'me' placeholder
    // Sealed Sender messages have null senderId and are treated as "other"
    if (message.senderId === null) return false;
    return (
      message.senderId === currentUser.userId ||
      message.senderId === ('me' as UserId)
    );
  }

  function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return t('today');
    } else if (date.toDateString() === yesterday.toDateString()) {
      return t('yesterday');
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  if (!groupId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500 dark:text-gray-400">{t('selectGroup')}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        {joinGroup.isPending || joinGroup.isSuccess ? (
          <div className="flex flex-col items-center gap-3 text-emerald-600 dark:text-emerald-400">
            <LoadingSpinner />
            <p>{t('joining')}</p>
          </div>
        ) : (
          <div className="p-4 border-base bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 max-w-md">
            <p className="mb-2">{error.message}</p>
            <Button
              variant="ghost"
              type="button"
              onClick={() => refetch()}
              className="text-sm underline hover:no-underline"
            >
              {t('retry')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  const TTL_MS = 24 * 60 * 60 * 1000;
  const visibleMessages = messages.filter((m) => {
    if (m.deleted) return false;
    const ageMs = nowMs - new Date(m.createdAt).getTime();
    return ageMs < TTL_MS;
  });

  return (
    <div className="chat-area flex flex-col flex-1 min-h-0 h-full w-full">
      {/* Incoming Call Modal */}
      <IncomingCallModal
        session={incomingSession}
        onAccept={handleAcceptCall}
        onReject={handleRejectCall}
      />

      {callState === 'in-call' || callState === 'calling' ? (
        <header className="chat-header shrink-0 z-20 w-full flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-emerald-200/70 dark:border-emerald-800/60 bg-emerald-50/80 dark:bg-emerald-950/40 shadow-[0_1px_0_rgba(16,185,129,0.12),0_8px_24px_rgba(0,0,0,0.18)]">
          <div className="flex items-center gap-3 min-w-0">
            {callState === 'in-call' ? (
              <span
                className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.18)] animate-pulse"
                aria-hidden="true"
              />
            ) : (
              <span
                className="inline-flex h-3 w-3 rounded-full border-2 border-emerald-500/70 border-t-transparent animate-spin"
                aria-hidden="true"
              />
            )}
            <div className="min-w-0">
              <p className="text-lg font-semibold text-emerald-950 dark:text-emerald-100 truncate">
                {callState === 'in-call' ? t('liveCall') : t('connectingCall')}
                {targetUserName ? ` ${t('with')} ${targetUserName}` : ''}
              </p>
            </div>
          </div>
          <div className="chat-actions flex items-center gap-2">
            <CallButton
              client={client}
              groupId={groupId as GroupId}
              currentUserId={currentUser?.userId}
              onStartCall={handleStartCall}
              memberCount={memberCount}
              targetUserId={targetUserId}
              calling={isCalling}
              activeSession={activeSession}
            />
            <Button
              variant="ghost"
              type="button"
              onClick={() => setShowSettings(true)}
              className="chat-action-settings p-2 border-base hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Group Settings"
            >
              <GearIcon
                aria-hidden="true"
                className="chat-action-icon w-5 h-5"
              />
            </Button>
          </div>
        </header>
      ) : (
        <header className="chat-header shrink-0 z-20 w-full flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-(--surface-elevated)">
          <div className="flex flex-col min-w-0">
            <h1 className="chat-title text-lg font-bold truncate">
              {t('groupChat')}
            </h1>
            <div className="flex items-center gap-1.5 text-xs text-(--text-muted) select-none">
              {(memberCount ?? 0) <= 2 ? (
                <>
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${isTargetUserOnline ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-500'}`}
                    aria-hidden="true"
                  />
                  <span>{isTargetUserOnline ? t('online') : t('offline')}</span>
                </>
              ) : (
                <>
                  <span
                    className="inline-block w-2 h-2 rounded-full bg-green-500"
                    aria-hidden="true"
                  />
                  <span>
                    {onlineUserCount}{' '}
                    {onlineUserCount === 1
                      ? t('memberOnline')
                      : t('membersOnline')}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="chat-actions flex items-center gap-2">
            <CallButton
              client={client}
              groupId={groupId as GroupId}
              currentUserId={currentUser?.userId}
              onStartCall={handleStartCall}
              memberCount={memberCount}
              targetUserId={targetUserId}
              calling={isCalling}
              activeSession={activeSession}
            />
            <Button
              variant="ghost"
              type="button"
              onClick={() => setShowSettings(true)}
              className="chat-action-settings p-2 border-base hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Group Settings"
            >
              <GearIcon
                aria-hidden="true"
                className="chat-action-icon w-5 h-5"
              />
            </Button>
          </div>
        </header>
      )}
      <section className="chat-surface flex-1 w-full min-h-0 overflow-hidden">
        <div className="chat-container min-h-0 h-full flex flex-col">
          {connectionStatus === 'reconnecting' && (
            <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 text-sm text-center">
              {t('reconnecting')}
            </div>
          )}
          {sendMessage.isError && (
            <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm text-center">
              <span>{sendMessage.error?.message || t('failedToSend')}</span>
              <Button
                variant="ghost"
                type="button"
                onClick={() => sendMessage.reset()}
                className="ml-3 text-xs underline hover:no-underline"
              >
                {t('dismiss')}
              </Button>
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-3 space-y-1.5">
            {visibleMessages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500 dark:text-gray-400 text-center">
                  {t('noMessages')}
                </p>
              </div>
            ) : (
              <>
                <AnimatePresence initial={false}>
                  {visibleMessages.map((message, index, filteredMessages) => {
                    const showDateHeader =
                      index === 0 ||
                      formatDate(message.createdAt) !==
                        formatDate(filteredMessages[index - 1].createdAt);

                    return (
                      <motion.div
                        key={message.id}
                        layout="position"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{
                          opacity: 0,
                          scale: 0.95,
                          height: 0,
                          overflow: 'hidden',
                          padding: 0,
                        }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                      >
                        {showDateHeader && (
                          <div className="flex items-center justify-center my-3">
                            <span className="px-3 py-1 rounded-full text-xs text-(--text-muted) bg-(--surface-muted)">
                              {formatDate(message.createdAt)}
                            </span>
                          </div>
                        )}
                        <MessageBubble
                          message={message}
                          formatTime={formatTime}
                          isOwn={isOwnMessage(message)}
                          showDeleteConfirm={deleteConfirmId === message.id}
                          onRequestDelete={() => setDeleteConfirmId(message.id)}
                          onConfirmDelete={() =>
                            handleDeleteMessage(message.id)
                          }
                          onCancelDelete={() => setDeleteConfirmId(null)}
                          deleting={deleting && deleteConfirmId === message.id}
                          isHighlighted={highlightedIds.has(message.id)}
                          onToggleHighlight={() =>
                            toggleHighlightedId(message.id)
                          }
                          isSenderOnline={
                            message.senderId
                              ? onlineUsers?.has(message.senderId)
                              : false
                          }
                        />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
          <div className="shrink-0 w-full">
            <MessageInput
              onSend={handleSendMessage}
              onSendVoice={handleSendVoiceMessage}
              onSendImage={handleSendImage}
              disabled={loading}
            />
          </div>
        </div>
      </section>
      <GroupSettings
        groupId={groupId as GroupId}
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />
      {/* biome-ignore lint/a11y/useMediaCaption: live call audio has no captions */}
      <audio ref={remoteAudioRef} autoPlay playsInline />
    </div>
  );
}

interface MessageBubbleProps {
  message: MessageListItem;
  formatTime: (date: string) => string;
  isOwn: boolean;
  showDeleteConfirm: boolean;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  deleting: boolean;
  isHighlighted: boolean;
  onToggleHighlight: () => void;
  isSenderOnline?: boolean;
}

function MessageBubble({
  message,
  formatTime,
  isOwn,
  showDeleteConfirm,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
  deleting,
  isHighlighted,
  onToggleHighlight,
  isSenderOnline,
}: MessageBubbleProps) {
  const t = useTranslations('GroupChat');
  const isSystem = message.senderId === ('system' as UserId);

  // System messages: centered pill (always plain text)
  if (isSystem) {
    return (
      <div className="flex justify-center my-1">
        <span className="px-3 py-1 rounded-full text-xs text-(--text-muted) bg-(--surface-muted)">
          {message.encryptedContent}
        </span>
      </div>
    );
  }

  const decoded = decodeContent(message.encryptedContent);
  const isObject = typeof decoded === 'object' && decoded !== null;
  const isAudio = isObject && (decoded as MessagePayload).type === 'audio';
  const isImage = isObject && (decoded as MessagePayload).type === 'image';
  const decodedObj = isObject ? (decoded as MessagePayload) : null;

  // Opacity fading logic for ephemeral messages
  // Messages expire 24 hours after creation.
  // We start fading them 1 hour before they expire.
  const now = new Date();
  const createdAtDate = new Date(message.createdAt);
  const ageMs = now.getTime() - createdAtDate.getTime();
  const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  const FADE_START_MS = TTL_MS - 1 * 60 * 60 * 1000; // 1 hour before expiration

  let opacityStyle = 1;
  const isFading = ageMs > FADE_START_MS && ageMs < TTL_MS;

  if (ageMs >= TTL_MS) {
    // Should be deleted by the server soon, just hide or show it extremely faint locally
    opacityStyle = 0.05;
  } else if (isFading) {
    const fadeProgress = (ageMs - FADE_START_MS) / (TTL_MS - FADE_START_MS);
    // Ease-in curve (starts slow, accelerates towards the end)
    const easedProgress = fadeProgress ** 3;
    opacityStyle = 1 - easedProgress * 0.95;
  }

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          className={`flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}
        >
          {/* Avatar for others */}
          {!isOwn && (
            <div className="relative">
              <div
                className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white select-none"
                style={{
                  background: avatarColor(message.senderName ?? t('anonymous')),
                }}
                aria-hidden="true"
              >
                {(message.senderName ?? '?').charAt(0).toUpperCase()}
              </div>
              {isSenderOnline && (
                <span
                  className="absolute bottom-0 right-0 block w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-(--surface-elevated)"
                  aria-hidden="true"
                />
              )}
            </div>
          )}

          <div
            className={`max-w-[72%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
          >
            {/* Sender name — only for others */}
            {!isOwn && (
              <span
                className="text-xs font-semibold mb-1 px-1"
                style={{
                  color: avatarColor(message.senderName ?? t('anonymous')),
                }}
              >
                {message.senderName ?? t('anonymous')}
              </span>
            )}

            {/* Bubble */}
            <div
              className={`relative px-4 py-2.5 text-base leading-relaxed wrap-break-word transition-all duration-200 ${
                isHighlighted
                  ? `scale-[1.15] z-10 ring-4 ring-(--highlight) ${isOwn ? 'origin-right' : 'origin-left'}`
                  : ''
              } ${
                isOwn
                  ? 'bg-(--accent) text-white rounded-t-2xl rounded-bl-2xl rounded-br-md'
                  : 'bg-(--surface-elevated) text-(--text-primary) rounded-t-2xl rounded-br-2xl rounded-bl-md shadow-sm border border-(--text-muted)/20'
              }`}
              style={{
                boxShadow: isHighlighted
                  ? '0 0 16px 4px var(--highlight-glow)'
                  : undefined,
                opacity: opacityStyle,
              }}
            >
              {isAudio && decodedObj?.type === 'audio' ? (
                <VoiceMessagePlayer
                  audioData={decodedObj.data}
                  mimeType={decodedObj.mimeType}
                  duration={decodedObj.duration}
                  isOwn={isOwn}
                />
              ) : isImage && decodedObj?.type === 'image' ? (
                <ImageMessage
                  groupId={message.groupId}
                  r2Key={decodedObj.r2Key}
                  width={decodedObj.width}
                  height={decodedObj.height}
                  isOwn={isOwn}
                />
              ) : typeof decoded === 'string' ? (
                decoded
              ) : decodedObj?.type === 'text' ? (
                decodedObj.content
              ) : null}

              {/* Timestamp row */}
              <div
                className={`flex items-center gap-2 mt-1.5 ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <span
                  className={`text-[11px] leading-none ${isOwn ? 'text-blue-200' : 'text-(--text-muted)'}`}
                >
                  {formatTime(message.createdAt)}
                </span>
              </div>

              {/* Delete confirmation */}
              {showDeleteConfirm && (
                <div
                  className={`mt-2 pt-2 border-t ${isOwn ? 'border-blue-400/30' : 'border-gray-200 dark:border-gray-600'}`}
                >
                  <p
                    className={`text-xs mb-2 ${isOwn ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}
                  >
                    {t('deletePrompt')}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={onConfirmDelete}
                      disabled={deleting}
                      className="flex-1 text-xs bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                    >
                      {deleting ? t('deleting') : t('delete')}
                    </Button>
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={onCancelDelete}
                      disabled={deleting}
                      className={`flex-1 text-xs px-2 py-1 rounded-lg disabled:opacity-50 transition-colors ${
                        isOwn
                          ? 'bg-white/20 hover:bg-white/30'
                          : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {t('cancel')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </ContextMenu.Trigger>

      <ContextMenu.Portal>
        <ContextMenu.Content className="min-w-[160px] bg-(--surface-elevated) border-base rounded-lg p-1 shadow-lg z-50">
          <ContextMenu.Item
            className="flex items-center gap-2 px-3 py-2 text-sm text-(--text-primary) hover:bg-(--surface-muted) rounded-md cursor-pointer outline-none transition-colors"
            onSelect={onToggleHighlight}
          >
            <HighlighterIcon className="w-4 h-4" />
            {isHighlighted ? t('unhighlight') : t('highlight')}
          </ContextMenu.Item>

          {isOwn && (
            <>
              <ContextMenu.Separator className="h-px bg-(--border-color) my-1" />
              <ContextMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md cursor-pointer outline-none transition-colors"
                onSelect={onRequestDelete}
              >
                <TrashIcon className="w-4 h-4" />
                {t('delete')}
              </ContextMenu.Item>
            </>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

/** Deterministic color from a display name for avatars and sender labels */
function avatarColor(name: string): string {
  const palette = [
    '#E53E3E',
    '#DD6B20',
    '#D69E2E',
    '#38A169',
    '#319795',
    '#3182CE',
    '#805AD5',
    '#D53F8C',
    '#00B5D8',
    '#F6AD55',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

function decodeContent(encryptedContent: string): MessagePayload | string {
  try {
    const parsed = JSON.parse(encryptedContent);
    if (
      parsed &&
      typeof parsed === 'object' &&
      (parsed.type === 'text' ||
        parsed.type === 'audio' ||
        parsed.type === 'image')
    ) {
      return parsed as MessagePayload;
    }
  } catch {
    // Not JSON — legacy plain text message
  }
  return encryptedContent;
}

function LoadingSpinner() {
  return <SpinnerGapIcon aria-hidden="true" className="animate-spin h-6 w-6" />;
}
