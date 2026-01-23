'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { MicroChatClient, type MessageListItem, type GroupId, type UserId, type WebSocketEvent } from '@microchat/client';
import { MessageInput } from '@/components/MessageInput';
import GroupSettings from '@/components/GroupSettings';

export default function ConversationPage() {
  const params = useParams();
  const groupId = params?.groupId as string | undefined;
  
  const [messages, setMessages] = useState<MessageListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<MicroChatClient | null>(null);

  const getClient = useCallback(() => {
    if (!clientRef.current) {
      clientRef.current = new MicroChatClient({
        baseUrl: process.env.NEXT_PUBLIC_API_URL || '',
      });
    }
    return clientRef.current;
  }, []);

  useEffect(() => {
    if (groupId) {
      fetchMessages();
    }
  }, [groupId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
              encryptedContent: event.encryptedContent,
              createdAt: event.timestamp,
              deleted: false,
            };
            setMessages((prev) => {
              const exists = prev.some((m) => m.id === event.messageId);
              if (exists) return prev;
              return [...prev, newMessage];
            });
          }
          break;
        
        case 'messageDeleted':
          if (event.groupId === groupId) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === event.messageId ? { ...m, deleted: true } : m
              )
            );
          }
          break;
        
        case 'memberJoined':
          if (event.groupId === groupId) {
            const systemMessage: MessageListItem = {
              id: `system-join-${event.userId}-${Date.now()}`,
              groupId: event.groupId,
              senderId: 'system' as UserId,
              encryptedContent: `${event.displayName} joined the group`,
              createdAt: new Date().toISOString(),
              deleted: false,
            };
            setMessages((prev) => [...prev, systemMessage]);
          }
          break;
        
        case 'memberLeft':
          if (event.groupId === groupId) {
            const systemMessage: MessageListItem = {
              id: `system-left-${event.userId}-${Date.now()}`,
              groupId: event.groupId,
              senderId: 'system' as UserId,
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
  }, [groupId, getClient, connectionStatus]);

  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
    };
  }, []);

  async function fetchMessages() {
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
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function handleSendMessage(content: string) {
    if (!groupId) return;
    
    const client = getClient();
    const result = await client.sendMessage(groupId as GroupId, content);
    
    // Add the new message to the list optimistically
    // The real-time WebSocket update will deduplicate by messageId
    const newMessage: MessageListItem = {
      id: result.messageId,
      groupId: groupId as GroupId,
      senderId: 'me' as UserId,
      encryptedContent: content,
      createdAt: result.timestamp,
      deleted: false,
    };
    setMessages((prev) => {
      const exists = prev.some((m) => m.id === result.messageId);
      if (exists) return prev;
      return [...prev, newMessage];
    });
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
          onClick={() => setShowSettings(true)}
          className="p-2 brutal-border hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Group Settings"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
      {connectionStatus === 'reconnecting' && (
        <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 text-sm text-center">
          Reconnecting to real-time updates...
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                    <div className="flex items-center justify-center my-4">
                      <span className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 brutal-border bg-gray-50 dark:bg-gray-800">
                        {formatDate(message.createdAt)}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    message={message}
                    formatTime={formatTime}
                  />
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
      <MessageInput onSend={handleSendMessage} disabled={loading} />
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
}

function MessageBubble({ message, formatTime }: MessageBubbleProps) {
  if (message.deleted) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[70%] p-3 brutal-border bg-gray-100 dark:bg-gray-800 opacity-60">
          <p className="text-sm italic text-gray-500 dark:text-gray-400">
            Message deleted
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[70%] p-3 brutal-border bg-white dark:bg-gray-900">
        <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
          {message.senderId}
        </div>
        <p className="text-sm break-words">
          {decodeContent(message.encryptedContent)}
        </p>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
          {formatTime(message.createdAt)}
        </div>
      </div>
    </div>
  );
}

function decodeContent(encryptedContent: string): string {
  return encryptedContent;
}

function LoadingSpinner() {
  return (
    <svg
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
