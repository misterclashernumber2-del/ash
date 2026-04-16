import { useState, useEffect, useCallback } from 'react';
import { nanoid } from 'nanoid';

export function useMessages(ttlSeconds = 300, maxMessages = 0) {
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (ttlSeconds <= 0) return; // 0 means unlimited time

    const interval = setInterval(() => {
      const now = Date.now();
      setMessages((prev) => {
        const expired = prev.filter((msg) => now > msg.expiresAt);
        expired.forEach(msg => {
          if (msg.url && msg.url.startsWith('blob:')) {
            URL.revokeObjectURL(msg.url);
          }
        });
        
        return prev
          .filter((msg) => now <= msg.expiresAt)
          .map((msg) => ({
            ...msg,
            timeLeft: Math.max(0, Math.floor((msg.expiresAt - now) / 1000)),
          }));
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [ttlSeconds]);

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

  useEffect(() => {
    return () => {
      // Cleanup all blob URLs on unmount
      setMessages(prev => {
        prev.forEach(msg => {
          if (msg.url && msg.url.startsWith('blob:')) {
            URL.revokeObjectURL(msg.url);
          }
        });
        return [];
      });
    };
  }, []);

  const addMessage = useCallback((rawMsg, fromMe = false) => {
    const now = Date.now();
    const expiryTimeMs = ttlSeconds * 1000;
    const isSystem = rawMsg.type === 'system';
    
    const message = {
      id: rawMsg.id || nanoid(),
      text: rawMsg.text,
      type: rawMsg.type || 'text',
      url: rawMsg.url,
      mimeType: rawMsg.mimeType,
      name: rawMsg.name,
      packId: rawMsg.packId,
      stickerId: rawMsg.stickerId,
      packName: rawMsg.packName,
      fromMe,
      timestamp: rawMsg.ts || now,
      expiresAt: (isSystem || ttlSeconds <= 0) ? Infinity : (rawMsg.ts || now) + expiryTimeMs,
      timeLeft: isSystem ? 0 : ttlSeconds,
    };

    setMessages((prev) => {
      const newMessages = [...prev, message];
      if (maxMessages > 0) {
        while (newMessages.filter(m => m.type !== 'system').length > maxMessages) {
          const idx = newMessages.findIndex(m => m.type !== 'system');
          if (idx !== -1) {
            const removed = newMessages.splice(idx, 1)[0];
            if (removed.url && removed.url.startsWith('blob:')) {
              URL.revokeObjectURL(removed.url);
            }
          } else {
            break;
          }
        }
      }
      return newMessages;
    });

    if (!fromMe && document.hidden && !isSystem) {
      setUnreadCount((prev) => prev + 1);
    }

    return message;
  }, [ttlSeconds, maxMessages]);

  const updateMessage = useCallback((id, updater) => {
    setMessages(prev => prev.map(msg => msg.id === id ? updater(msg) : msg));
  }, []);

  const clearExpired = useCallback(() => {
    const now = Date.now();
    setMessages((prev) => {
      const expired = prev.filter((msg) => now > msg.expiresAt);
      expired.forEach(msg => {
        if (msg.url && msg.url.startsWith('blob:')) {
          URL.revokeObjectURL(msg.url);
        }
      });
      return prev.filter((msg) => now <= msg.expiresAt);
    });
  }, []);

  return { messages, addMessage, updateMessage, clearExpired, setMessages };
}
