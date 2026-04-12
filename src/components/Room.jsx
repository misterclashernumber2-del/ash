import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePeer } from '../hooks/usePeer';
import { useMessages } from '../hooks/useMessages';
import { Message } from './Message';
import { MessageInput } from './MessageInput';
import { useLanguage } from '../lib/i18n';

export function Room({ roomId }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { messages, addMessage } = useMessages();
  const messagesEndRef = useRef(null);
  const [copied, setCopied] = useState(false);

  const handleReceiveMessage = (data) => {
    addMessage(data, false);
  };

  const { status, sendMessage } = usePeer({
    roomId,
    onMessage: handleReceiveMessage,
  });

  const handleSend = (text) => {
    const sentMsg = sendMessage(text);
    if (sentMsg) {
      addMessage(sentMsg, true);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const shareLink = `${window.location.origin}/r/${roomId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  if (status === 'waiting') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 space-y-6">
        <div className="text-center space-y-2">
          <p className="text-lg">{t('waiting')}</p>
          <p className="text-[#888888] text-sm">{t('shareToConnect')}</p>
        </div>
        <div className="flex items-center gap-2 w-full max-w-md">
          <input 
            type="text" 
            readOnly 
            value={shareLink}
            className="flex-1 bg-[#121212] border border-[#333] rounded px-3 py-2 text-sm focus:outline-none text-[#ccc]"
          />
          <button 
            onClick={handleCopy}
            className="px-4 py-2 bg-[#222] hover:bg-[#333] border border-[#333] rounded text-sm transition-colors"
          >
            {copied ? t('copied') : t('copy')}
          </button>
        </div>
        <button 
          onClick={() => navigate('/')}
          className="mt-4 px-4 py-2 text-[#888] hover:text-white text-sm transition-colors"
        >
          {t('cancel')}
        </button>
      </div>
    );
  }

  if (status === 'connecting') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 space-y-6">
        <p className="text-[#888888] animate-pulse">{t('connecting')}</p>
        <button 
          onClick={() => navigate('/')}
          className="mt-4 px-4 py-2 text-[#888] hover:text-white text-sm transition-colors"
        >
          {t('cancel')}
        </button>
      </div>
    );
  }

  if (status === 'disconnected') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 space-y-6">
        <p className="text-red-500">{t('disconnected')}</p>
        <button 
          onClick={() => navigate('/')}
          className="px-6 py-2 bg-[#222] hover:bg-[#333] border border-[#333] rounded transition-colors"
        >
          {t('startNew')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto w-full">
      <header className="p-4 border-b border-[#222] flex justify-between items-center">
        <p className="text-xs text-[#888888] flex-1 text-center">
          {t('encryptionNotice')}
        </p>
        <button 
          onClick={() => navigate('/')} 
          className="text-[#888] hover:text-white text-xs ml-4 transition-colors"
        >
          {t('leaveRoom')}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <Message key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-[#222]">
        <MessageInput onSend={handleSend} disabled={status !== 'connected'} />
      </div>
    </div>
  );
}
