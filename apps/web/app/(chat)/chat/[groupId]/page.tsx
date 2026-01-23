'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { MicroChatClient, type MessageListItem } from '@microchat/client';

export default function ConversationPage() {
  const params = useParams();
  const groupId = params?.groupId as string | undefined;
  
  const [messages, setMessages] = useState<MessageListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (groupId) {
      fetchMessages();
    }
  }, [groupId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function fetchMessages() {
    if (!groupId) return;
    
    try {
      setLoading(true);
      setError(null);
      const client = new MicroChatClient({
        baseUrl: process.env.NEXT_PUBLIC_API_URL || '',
      });
      const result = await client.getMessages(groupId);
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
