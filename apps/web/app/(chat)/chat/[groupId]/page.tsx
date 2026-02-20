'use client';

import {
  type CurrentUser,
  type GroupId,
  type MessageListItem,
  type MessagePayload,
  MicroChatClient,
  type UserId,
  uint8ArrayToBase64,
  type WebSocketEvent,
} from '@microchat/client';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import GroupSettings from '@/components/GroupSettings';
import { ImageMessage } from '@/components/ImageMessage';
import { MessageInput } from '@/components/MessageInput';
import { VoiceMessagePlayer } from '@/components/VoiceMessagePlayer';
import { useSfx } from '@/hooks/useSfx';

export default function ConversationPage() {
  const params = useParams();
  const groupId = params?.groupId as string | undefined;

  const [messages, setMessages] = useState<MessageListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    'connected' | 'disconnected' | 'reconnecting'
  >('disconnected');
  const [showSettings, setShowSettings] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<MicroChatClient | null>(null);
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;
  const playSfx = useSfx();

  // Load highlighted IDs from sessionStorage
  useEffect(() => {
    if (!groupId) return;
    const storageKey = `microchat:highlighted:${groupId}`;
    const saved = sessionStorage.getItem(storageKey);
    if (saved) {
      try {
        const ids = JSON.parse(saved) as string[];
        setHighlightedIds(new Set(ids));
      } catch {
        // Ignore parse errors
      }
    }
  }, [groupId]);

  // Save highlighted IDs to sessionStorage
  useEffect(() => {
    if (!groupId) return;
    const storageKey = `microchat:highlighted:${groupId}`;
    sessionStorage.setItem(
      storageKey,
      JSON.stringify(Array.from(highlightedIds)),
    );
  }, [highlightedIds, groupId]);

  const getClient = useCallback(() => {
    if (!clientRef.current) {
      clientRef.current = new MicroChatClient({
        baseUrl: process.env.NEXT_PUBLIC_API_URL || '',
        wsUrl: process.env.NEXT_PUBLIC_WS_URL,
      });
    }
    return clientRef.current;
  }, []);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const client = getClient();
      const user = await client.getCurrentUser();
      setCurrentUser(user);
    } catch (err) {
      console.error('Failed to get current user:', err);
    }
  }, [getClient]);

  const fetchMessages = useCallback(async () => {
    if (!groupId) return;

    try {
      setLoading(true);
      setError(null);
      const client = getClient();
      const result = await client.getMessages(groupId as GroupId);
      setMessages(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [groupId, getClient]);

  useEffect(() => {
    if (groupId) {
      fetchMessages();
      fetchCurrentUser();
    }
  }, [groupId, fetchCurrentUser, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  });

  useEffect(() => {
    if (!groupId) return;

    const client = getClient();

    const handleEvent = (event: WebSocketEvent) => {
      switch (event.type) {
        case 'connected':
          setConnectionStatus('connected');
          client.subscribe(groupId as GroupId);
          break;

        case 'disconnected':
          setConnectionStatus('reconnecting');
          break;

        case 'message':
          if (event.groupId === groupId) {
            const newMessage: MessageListItem = {
              id: event.messageId,
              groupId: event.groupId,
              senderId: event.senderId,
              senderName: event.senderName,
              encryptedContent: event.encryptedContent,
              createdAt: event.timestamp,
              deleted: false,
            };
            setMessages((prev) => {
              const exists = prev.some((m) => m.id === event.messageId);
              if (exists) return prev;
              return [...prev, newMessage];
            });
            if (
              document.hidden &&
              event.senderId !== currentUserRef.current?.userId
            ) {
              playSfx('message');
            }
          }
          break;

        case 'messageDeleted':
          if (event.groupId === groupId) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === event.messageId ? { ...m, deleted: true } : m,
              ),
            );
          }
          break;

        case 'memberJoined':
          if (event.groupId === groupId) {
            const systemMessage: MessageListItem = {
              id: `system-join-${event.userId}-${Date.now()}`,
              groupId: event.groupId,
              senderId: 'system' as UserId,
              senderName: 'system',
              encryptedContent: `${event.displayName} joined the group`,
              createdAt: new Date().toISOString(),
              deleted: false,
            };
            setMessages((prev) => [...prev, systemMessage]);
            playSfx('memberJoined');
          }
          break;

        case 'memberLeft':
          if (event.groupId === groupId) {
            const systemMessage: MessageListItem = {
              id: `system-left-${event.userId}-${Date.now()}`,
              groupId: event.groupId,
              senderId: 'system' as UserId,
              senderName: 'system',
              encryptedContent: `User ${event.userId} left the group`,
              createdAt: new Date().toISOString(),
              deleted: false,
            };
            setMessages((prev) => [...prev, systemMessage]);
          }
          break;

        case 'error':
          console.error('WebSocket error:', event.error);
          break;
      }
    };

    const unsubscribe = client.onEvent(handleEvent);
    client.connect();

    if (connectionStatus === 'connected') {
      client.subscribe(groupId as GroupId);
    }

    return () => {
      unsubscribe();
      client.unsubscribe(groupId as GroupId);
    };
  }, [groupId, getClient, connectionStatus, playSfx]);

  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
    };
  }, []);

  async function handleSendMessage(content: string) {
    if (!groupId) return;

    const client = getClient();
    const result = await client.sendMessage(groupId as GroupId, content);

    const payload: MessagePayload = { type: 'text', content };
    const newMessage: MessageListItem = {
      id: result.messageId,
      groupId: groupId as GroupId,
      senderId: (currentUser?.userId ?? 'me') as UserId,
      senderName: currentUser?.displayName ?? 'me',
      encryptedContent: JSON.stringify(payload),
      createdAt: result.timestamp,
      deleted: false,
    };
    setMessages((prev) => {
      const exists = prev.some((m) => m.id === result.messageId);
      if (exists) return prev;
      return [...prev, newMessage];
    });
  }

  async function handleSendVoiceMessage(audioBlob: Blob, duration: number) {
    if (!groupId) return;

    setSendError(null);

    try {
      const client = getClient();
      const result = await client.sendVoiceMessage(
        groupId as GroupId,
        audioBlob,
        duration,
      );

      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64 = uint8ArrayToBase64(new Uint8Array(arrayBuffer));
      const payload: MessagePayload = {
        type: 'audio',
        data: base64,
        duration,
        mimeType: audioBlob.type,
      };

      const newMessage: MessageListItem = {
        id: result.messageId,
        groupId: groupId as GroupId,
        senderId: (currentUser?.userId ?? 'me') as UserId,
        senderName: currentUser?.displayName ?? 'me',
        encryptedContent: JSON.stringify(payload),
        createdAt: result.timestamp,
        deleted: false,
      };
      setMessages((prev) => {
        if (prev.some((m) => m.id === result.messageId)) return prev;
        return [...prev, newMessage];
      });
    } catch (err) {
      console.error('Failed to send voice message:', err);
      setSendError(
        err instanceof Error ? err.message : 'Failed to send voice message',
      );
    }
  }

  async function handleSendImage(blob: Blob, width: number, height: number) {
    if (!groupId) return;

    const client = getClient();
    const result = await client.sendImageMessage(
      groupId as GroupId,
      blob,
      width,
      height,
    );

    const payload: MessagePayload = {
      type: 'image',
      r2Key: result.r2Key,
      nonce: '',
      width,
      height,
    };

    const newMessage: MessageListItem = {
      id: result.messageId,
      groupId: groupId as GroupId,
      senderId: (currentUser?.userId ?? 'me') as UserId,
      senderName: currentUser?.displayName ?? 'me',
      encryptedContent: JSON.stringify(payload),
      createdAt: result.timestamp,
      deleted: false,
    };
    setMessages((prev) => {
      if (prev.some((m) => m.id === result.messageId)) return prev;
      return [...prev, newMessage];
    });
  }

  async function handleDeleteMessage(messageId: string) {
    if (!groupId) return;

    try {
      setDeleting(true);
      const client = getClient();
      await client.deleteMessage(groupId as GroupId, messageId);
      // Optimistic update - mark as deleted locally
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, deleted: true } : m)),
      );
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Failed to delete message:', err);
      alert('Failed to delete message');
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
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  if (!groupId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500 dark:text-gray-400">
          Select a group to view messages
        </p>
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
        <div className="p-4 brutal-border bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 max-w-md">
          <p className="mb-2">{error}</p>
          <button
            type="button"
            onClick={fetchMessages}
            className="text-sm underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-lg font-bold truncate">Group Chat</h1>
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="p-2 brutal-border hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Group Settings"
        >
          <svg
            aria-hidden="true"
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      </div>
      {connectionStatus === 'reconnecting' && (
        <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 text-sm text-center">
          Reconnecting to real-time updates...
        </div>
      )}
      {sendError && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm text-center">
          <span>{sendError}</span>
          <button
            type="button"
            onClick={() => setSendError(null)}
            className="ml-3 text-xs underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 space-y-1.5">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 dark:text-gray-400 text-center">
              No messages yet. Start the conversation!
            </p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              const showDateHeader =
                index === 0 ||
                formatDate(message.createdAt) !==
                  formatDate(messages[index - 1].createdAt);

              return (
                <div key={message.id}>
                  {showDateHeader && (
                    <div className="flex items-center justify-center my-3">
                      <span className="px-3 py-1 rounded-full text-xs text-[var(--text-muted)] bg-[var(--surface-muted)]">
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
                    onConfirmDelete={() => handleDeleteMessage(message.id)}
                    onCancelDelete={() => setDeleteConfirmId(null)}
                    deleting={deleting && deleteConfirmId === message.id}
                    isHighlighted={highlightedIds.has(message.id)}
                    onToggleHighlight={() =>
                      setHighlightedIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(message.id)) {
                          next.delete(message.id);
                        } else {
                          next.add(message.id);
                        }
                        return next;
                      })
                    }
                  />
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
      <MessageInput
        onSend={handleSendMessage}
        onSendVoice={handleSendVoiceMessage}
        onSendImage={handleSendImage}
        disabled={loading}
      />
      <GroupSettings
        groupId={groupId as GroupId}
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />
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
}: MessageBubbleProps) {
  const isSystem = message.senderId === ('system' as UserId);

  // System messages: centered pill (always plain text)
  if (isSystem) {
    return (
      <div className="flex justify-center my-1">
        <span className="px-3 py-1 rounded-full text-xs text-[var(--text-muted)] bg-[var(--surface-muted)]">
          {message.encryptedContent}
        </span>
      </div>
    );
  }

  const decoded = decodeContent(message.encryptedContent);
  const isAudio = typeof decoded === 'object' && decoded.type === 'audio';
  const isImage = typeof decoded === 'object' && decoded.type === 'image';

  // Deleted message: subtle tombstone aligned to sender side
  if (message.deleted) {
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
        <div className="max-w-[72%] px-4 py-2.5 rounded-2xl bg-[var(--surface-muted)] opacity-60">
          <p className="text-sm italic text-[var(--text-muted)]">
            Message deleted
          </p>
        </div>
      </div>
    );
  }

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          className={`flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}
        >
          {/* Avatar for others */}
          {!isOwn && (
            <div
              className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white select-none"
              style={{
                background: avatarColor(message.senderName ?? 'Anonymous'),
              }}
              aria-hidden="true"
            >
              {(message.senderName ?? '?').charAt(0).toUpperCase()}
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
                  color: avatarColor(message.senderName ?? 'Anonymous'),
                }}
              >
                {message.senderName ?? 'Anonymous'}
              </span>
            )}

            {/* Bubble */}
            <div
              className={`relative px-4 py-2.5 text-base leading-relaxed break-words transition-all duration-200 ${
                isHighlighted
                  ? `scale-[1.15] z-10 ring-4 ring-[var(--highlight)] ${isOwn ? 'origin-right' : 'origin-left'}`
                  : ''
              } ${
                isOwn
                  ? 'bg-[var(--accent)] text-white rounded-t-2xl rounded-bl-2xl rounded-br-md'
                  : 'bg-[var(--surface-elevated)] text-[var(--text-primary)] rounded-t-2xl rounded-br-2xl rounded-bl-md shadow-sm border border-[var(--text-muted)]/20'
              }`}
              style={{
                boxShadow: isHighlighted
                  ? '0 0 16px 4px var(--highlight-glow)'
                  : undefined,
              }}
            >
              {isAudio ? (
                <VoiceMessagePlayer
                  audioData={decoded.data}
                  mimeType={decoded.mimeType}
                  duration={decoded.duration}
                  isOwn={isOwn}
                />
              ) : isImage ? (
                <ImageMessage
                  groupId={message.groupId}
                  r2Key={decoded.r2Key}
                  width={decoded.width}
                  height={decoded.height}
                  isOwn={isOwn}
                />
              ) : typeof decoded === 'string' ? (
                decoded
              ) : decoded.type === 'text' ? (
                decoded.content
              ) : null}

              {/* Timestamp row */}
              <div
                className={`flex items-center gap-2 mt-1.5 ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <span
                  className={`text-[11px] leading-none ${isOwn ? 'text-blue-200' : 'text-[var(--text-muted)]'}`}
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
                    Delete this message?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={onConfirmDelete}
                      disabled={deleting}
                      className="flex-1 text-xs px-2 py-1 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                    >
                      {deleting ? 'Deleting...' : 'Delete'}
                    </button>
                    <button
                      type="button"
                      onClick={onCancelDelete}
                      disabled={deleting}
                      className={`flex-1 text-xs px-2 py-1 rounded-lg disabled:opacity-50 transition-colors ${
                        isOwn
                          ? 'bg-white/20 hover:bg-white/30'
                          : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </ContextMenu.Trigger>

      <ContextMenu.Portal>
        <ContextMenu.Content className="min-w-[160px] bg-[var(--surface-elevated)] brutal-border rounded-lg p-1 shadow-lg z-50">
          <ContextMenu.Item
            className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-muted)] rounded-md cursor-pointer outline-none transition-colors"
            onSelect={onToggleHighlight}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <title>Highlight message</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
            {isHighlighted ? 'Unhighlight' : 'Highlight'}
          </ContextMenu.Item>

          {isOwn && (
            <>
              <ContextMenu.Separator className="h-px bg-[var(--border-color)] my-1" />
              <ContextMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md cursor-pointer outline-none transition-colors"
                onSelect={onRequestDelete}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <title>Delete message</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Delete
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
  return (
    <svg
      aria-hidden="true"
      className="animate-spin h-6 w-6"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
