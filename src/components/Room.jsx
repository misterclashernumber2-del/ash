import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePeer } from '../hooks/usePeer';
import { useMessages } from '../hooks/useMessages';
import { Message } from './Message';
import { MessageInput } from './MessageInput';
import { useLanguage } from '../lib/i18n';
import { ArrowLeft, Copy, ShieldAlert, WifiOff, X, Download } from 'lucide-react';

export function Room({ roomId }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  
  // Parse settings from roomId (format: baseId_ttl_maxMsgs)
  const { ttl, maxMsgs } = useMemo(() => {
    const parts = roomId.split('_');
    return {
      ttl: parts.length === 3 ? parseInt(parts[1], 10) : 300,
      maxMsgs: parts.length === 3 ? parseInt(parts[2], 10) : 0
    };
  }, [roomId]);

  const { messages, addMessage } = useMessages(ttl, maxMsgs);
  const messagesEndRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [transfers, setTransfers] = useState({});
  const [viewMedia, setViewMedia] = useState(null);

  useEffect(() => {
    const onOffline = () => setIsOffline(true);
    const onOnline = () => setIsOffline(false);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  const handleReceiveMessage = useCallback((data) => {
    addMessage(data, false);
  }, [addMessage]);

  const handleTransferProgress = useCallback((id, progress, type) => {
    setTransfers(prev => {
      const existing = prev[id];
      if (existing && progress < 1 && progress - existing.progress < 0.05) {
        return prev;
      }
      if (progress >= 1) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: { progress, type } };
    });
  }, []);

  const { status, sendMessage, sendFile } = usePeer({
    roomId,
    onMessage: handleReceiveMessage,
    onTransferProgress: handleTransferProgress
  });

  const handleSend = async (text) => {
    const sentMsg = await sendMessage(text);
    if (sentMsg) {
      addMessage(sentMsg, true);
    }
  };

  const handleSendFile = async (file, qualityMode, caption) => {
    const sentMsg = await sendFile(file, qualityMode, caption);
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

  return (
    <div className="flex flex-col h-[100dvh] max-w-3xl mx-auto w-full bg-zinc-950 font-sans">
      <header className="px-4 py-3 border-b border-zinc-800/80 flex justify-between items-center bg-zinc-950/80 backdrop-blur-md z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/')} 
            className="p-2 -ml-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-full transition-all"
            title={t('leaveRoom')}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5 bg-zinc-900/50 px-3 py-1.5 rounded-full border border-zinc-800/50">
            <div className="relative flex items-center justify-center">
              <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : status === 'disconnected' ? 'bg-red-500' : 'bg-amber-500'}`} />
              {status === 'connecting' && <div className="absolute w-2 h-2 rounded-full bg-amber-500 animate-ping opacity-75" />}
            </div>
            <span className="text-xs font-medium text-zinc-300">
              {status === 'connected' ? t('connected') : 
               status === 'waiting' ? t('waiting') : 
               status === 'connecting' ? t('connecting') : 
               t('disconnected')}
            </span>
          </div>
        </div>
      </header>

      {isOffline && (
        <div className="bg-amber-500/10 text-amber-500 text-xs font-medium px-4 py-2.5 flex items-center justify-center gap-2 border-b border-amber-500/20">
          <WifiOff className="w-4 h-4" />
          {t('offlineWarning')}
        </div>
      )}

      {status === 'waiting' && (
        <div className="bg-zinc-900/40 border-b border-zinc-800/50 p-4 sm:p-6 flex flex-col items-center justify-center gap-4 shadow-inner">
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-zinc-300">{t('shareToConnect')}</p>
            <p className="text-xs text-zinc-500 max-w-xs mx-auto leading-relaxed">{t('oneLinkWarning')}</p>
          </div>
          <div className="flex items-center gap-2 w-full max-w-md bg-zinc-950 p-1.5 rounded-2xl border border-zinc-800">
            <input 
              type="text" 
              readOnly 
              value={shareLink} 
              className="flex-1 bg-transparent px-3 py-2 text-xs text-zinc-400 font-mono focus:outline-none" 
            />
            <button 
              onClick={handleCopy} 
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-medium text-zinc-200 transition-all flex items-center gap-2 shrink-0"
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? t('copied') : t('copy')}
            </button>
          </div>
        </div>
      )}

      {status === 'disconnected' && (
        <div className="bg-red-500/10 border-b border-red-500/20 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-red-400">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{t('disconnected')}</p>
          </div>
          <button 
            onClick={() => navigate('/')} 
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-xl text-sm font-medium text-red-300 transition-all whitespace-nowrap w-full sm:w-auto"
          >
            {t('startNew')}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scroll-smooth">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-50 select-none">
            <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-zinc-500" />
            </div>
            <p className="text-xs text-zinc-500 max-w-[200px] leading-relaxed">
              {t('encryptionNotice')}
              {ttl > 0 && (
                <span className="block mt-1">
                  · {t('vanishIn')} {ttl >= 60 ? `${ttl / 60} ${t('minutes')}` : `${ttl} ${t('seconds')}`}
                </span>
              )}
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <Message key={msg.id} message={msg} onViewMedia={setViewMedia} />
        ))}
        <div ref={messagesEndRef} className="h-1" />
      </div>

      <div className="p-4 sm:p-6 pt-2 bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent flex flex-col gap-2">
        {Object.entries(transfers).map(([id, transfer]) => (
          <div key={id} className="px-4 py-3 bg-zinc-900/80 border border-zinc-800 rounded-xl flex items-center justify-between text-xs text-zinc-400 backdrop-blur-sm">
            <span className="font-medium">
              {transfer.type === 'processing' ? t('processingFile') : 
               transfer.type === 'sending' ? t('sendingFile') : 
               t('receivingFile')}
            </span>
            <div className="flex-1 mx-4 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all duration-300 ease-out" style={{ width: `${transfer.progress * 100}%` }} />
            </div>
            <span className="font-mono">{Math.round(transfer.progress * 100)}%</span>
          </div>
        ))}
        <MessageInput onSend={handleSend} onSendFile={handleSendFile} disabled={status !== 'connected' || isOffline} />
      </div>

      {/* Lightbox */}
      {viewMedia && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 sm:p-8 animate-in fade-in duration-200" 
          onClick={() => setViewMedia(null)}
        >
          <button 
            className="absolute top-4 right-4 sm:top-6 sm:right-6 text-zinc-400 hover:text-white p-2 bg-zinc-900/50 hover:bg-zinc-800 rounded-full transition-all z-10"
            onClick={() => setViewMedia(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <div className="relative max-w-full max-h-full flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
            {(viewMedia.mimeType?.startsWith('image/') || viewMedia.name?.match(/\.(jpg|jpeg|png|gif|webp)$/i)) ? (
              <img src={viewMedia.url} className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl" />
            ) : (
              <video src={viewMedia.url} controls autoPlay className="max-w-full max-h-[80vh] rounded-lg shadow-2xl" />
            )}
            <div className="mt-6 flex gap-4">
              <a 
                href={viewMedia.url} 
                download={viewMedia.name} 
                className="px-6 py-3 bg-zinc-800 text-white rounded-xl flex items-center gap-2 hover:bg-zinc-700 transition-colors font-medium shadow-lg"
              >
                <Download className="w-5 h-5" />
                {t('download')}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
