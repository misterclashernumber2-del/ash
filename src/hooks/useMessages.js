import { useState, useEffect, useCallback } from 'react';
import { nanoid } from 'nanoid';

const EXPIRY_TIME_MS = 5 * 60 * 1000; // 5 minutes
const MAX_MESSAGES = 200;

export function useMessages() {
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setMessages((prev) => 
        prev
          .filter((msg) => now <= msg.expiresAt)
          .map((msg) => ({
            ...msg,
            timeLeft: Math.max(0, Math.floor((msg.expiresAt - now) / 1000)),
          }))
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        setUnreadCount(0);
        document.title = 'Ash';
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (document.hidden && unreadCount > 0) {
      document.title = `(${unreadCount}) Ash`;
    }
  }, [unreadCount]);

  const addMessage = useCallback((rawMsg, fromMe = false) => {
    const now = Date.now();
    const message = {
      id: rawMsg.id || nanoid(),
      text: rawMsg.text,
      fromMe,
      timestamp: rawMsg.ts || now,
      expiresAt: (rawMsg.ts || now) + EXPIRY_TIME_MS,
      timeLeft: Math.floor(EXPIRY_TIME_MS / 1000),
    };

    setMessages((prev) => {
      const newMessages = [...prev, message];
      if (newMessages.length > MAX_MESSAGES) {
        return newMessages.slice(newMessages.length - MAX_MESSAGES);
      }
      return newMessages;
    });

    if (!fromMe && document.hidden) {
      setUnreadCount((prev) => prev + 1);
    }

    return message;
  }, []);

  const clearExpired = useCallback(() => {
    const now = Date.now();
    setMessages((prev) => prev.filter((msg) => now <= msg.expiresAt));
  }, []);

  return { messages, addMessage, clearExpired };
}
