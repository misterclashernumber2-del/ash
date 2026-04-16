import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePeer } from '../hooks/usePeer';
import { useMessages } from '../hooks/useMessages';
import { useCall } from '../hooks/useCall';
import { Message } from './Message';
import { MessageInput } from './MessageInput';
import { CallUI } from './CallUI';
import { ProfileModal } from './ProfileModal';
import { MiniPlayer } from './MiniPlayer';
import { useLanguage } from '../lib/i18n';
import { ArrowLeft, Copy, ShieldAlert, WifiOff, X, Download, Phone, Video, QrCode, Settings2, Check, AlertTriangle, User } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';

export function Room({ roomId, importedMessages }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  
  // Parse settings from roomId (format: baseId_ttl_maxMsgs)
  const initialSettings = useMemo(() => {
    const parts = roomId.split('_');
    return {
      ttl: parts.length === 3 ? (parseInt(parts[1], 10) || 300) : 300,
      maxMsgs: parts.length === 3 ? (parseInt(parts[2], 10) || 0) : 0
    };
  }, [roomId]);

  const [roomSettings, setRoomSettings] = useState(initialSettings);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [pendingSettings, setPendingSettings] = useState(null);
  const [remoteProfile, setRemoteProfile] = useState(null);

  const { messages, addMessage, updateMessage, setMessages } = useMessages(roomSettings.ttl, roomSettings.maxMsgs);
  const messagesEndRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [transfers, setTransfers] = useState({});
  const [viewMedia, setViewMedia] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedFile, setDraggedFile] = useState(null);

  useEffect(() => {
    if (importedMessages && importedMessages.length > 0) {
      setMessages(importedMessages);
    }
  }, [importedMessages, setMessages]);

  useEffect(() => {
    const onOffline = () => setIsOffline(true);
    const onOnline = () => setIsOffline(false);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    
    const onBeforeUnload = (e) => {
      if (messages.length > 0 || Object.keys(transfers).length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [messages.length, transfers]);

  useEffect(() => {
    let escCount = 0;
    let escTimeout;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        escCount++;
        if (escCount === 2) {
          // Panic Button!
          navigate('/');
          window.location.reload();
        }
        clearTimeout(escTimeout);
        escTimeout = setTimeout(() => { escCount = 0; }, 500);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const handleDragOver = (e) => {
    e.preventDefault();
    if (status === 'connected' && !isOffline) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (status === 'connected' && !isOffline && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setDraggedFile(e.dataTransfer.files[0]);
    }
  };

  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const typingTimeoutRef = useRef(null);

  const handleReceiveMessage = useCallback((data) => {
    if (data.__profile) {
      setRemoteProfile({ nick: data.nick, avatarEmoji: data.avatarEmoji, color: data.color });
      return;
    }
    if (data.type === 'reaction') {
      updateMessage(data.messageId, (msg) => {
        const currentReactions = msg.reactions || {};
        const newReactions = { ...currentReactions };
        if (data.action === 'add') {
          newReactions[data.reaction] = (newReactions[data.reaction] || 0) + 1;
        } else if (data.action === 'remove') {
          if (newReactions[data.reaction] > 0) {
            newReactions[data.reaction] -= 1;
            if (newReactions[data.reaction] === 0) {
              delete newReactions[data.reaction];
            }
          }
        }
        return { ...msg, reactions: newReactions };
      });
      return;
    }
    if (data.type === 'status') {
      updateMessage(data.messageId, (msg) => ({ ...msg, status: data.status }));
      return;
    }
    if (data.type === 'settings-proposal') {
      setPendingSettings(data.settings);
      return;
    }
    if (data.type === 'settings-accept') {
      setRoomSettings(data.settings);
      toast.success('Room settings updated');
      return;
    }
    if (data.type === 'settings-reject') {
      toast.error('Peer rejected settings change');
      return;
    }
    
    if (data.type === 'typing') {
      setIsPeerTyping(data.isTyping);
      if (data.isTyping) {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setIsPeerTyping(false), 3000);
      }
      return;
    }
    
    if (data.type === 'sticker-data') {
      import('../lib/stickerStorage').then(({ saveReceivedSticker }) => {
        const stickerId = data.name.replace('.webp', '');
        const packId = stickerId.split('_')[0];
        fetch(data.url).then(res => res.blob()).then(blob => {
          saveReceivedSticker(stickerId, packId, blob).then(() => {
            // Update any messages waiting for this sticker
            setMessages(prev => [...prev]); // Force re-render so Message components reload the blob
          });
        });
      });
      return;
    }

    if (data.type !== 'typing') {
      setIsPeerTyping(false);
    }
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

  const callSignalHandlerRef = useRef(null);

  const handleCallSignalProxy = useCallback((msg) => {
    if (callSignalHandlerRef.current) {
      return callSignalHandlerRef.current(msg);
    }
    return false;
  }, []);

  const handleStickerReq = useCallback(async (packId, stickerId) => {
    try {
      const { getStickerBlob } = await import('../lib/stickerStorage');
      const blob = await getStickerBlob(stickerId);
      if (blob) {
        const file = new File([blob], `${stickerId}.webp`, { type: blob.type });
        // Send as sticker-data
        sendFile(file, 'original', '', 'sticker-data');
      }
    } catch (err) {
      console.error('Failed to send requested sticker', err);
    }
  }, [sendFile]);

  const { status, fingerprint, sendMessage, sendFile, sendTyping, sendSettingsSignal, cancelTransfer, sendProfile, sendReaction, sendStatus, connRef, cryptoKeyRef } = usePeer({
    roomId,
    onMessage: handleReceiveMessage,
    onTransferProgress: handleTransferProgress,
    onCallSignal: handleCallSignalProxy,
    onStickerReq: handleStickerReq
  });

  const handleSystemMessage = useCallback((text) => {
    addMessage({ type: 'system', text, ts: Date.now() });
  }, [addMessage]);

  const callProps = useCall({
    connRef,
    cryptoKeyRef,
    onSystemMessage: handleSystemMessage
  });

  useEffect(() => {
    callSignalHandlerRef.current = callProps.handleCallSignal;
  }, [callProps.handleCallSignal]);

  const {
    callState, callType, isMuted, isVideoOff, quality, callStats,
    localStream, remoteStream, insertableStreamsSupported,
    startCall, acceptCall, rejectCall, endCall,
    toggleMute, toggleVideo, CALL_STATES
  } = callProps;

  const prevStatusRef = useRef(status);
  useEffect(() => {
    if (prevStatusRef.current !== status) {
      if (status === 'connected') {
        addMessage({ type: 'system', text: t('peerJoined') || 'Peer joined the room', id: Date.now().toString() }, false);
      } else if (status === 'disconnected' && prevStatusRef.current === 'connected') {
        addMessage({ type: 'system', text: t('peerLeft') || 'Peer left the room', id: Date.now().toString() }, false);
      }
      
      if (status === 'disconnected' || status === 'reconnecting') {
        if (callState !== CALL_STATES.IDLE) {
          endCall();
        }
      }
      
      prevStatusRef.current = status;
    }
  }, [status, addMessage, t, callState, endCall, CALL_STATES]);

  useEffect(() => {
    // Send read receipts for unread messages from the peer
    const unreadMessages = messages.filter(m => !m.fromMe && m.status !== 'read' && m.type !== 'system');
    if (unreadMessages.length > 0 && status === 'connected') {
      unreadMessages.forEach(msg => {
        sendStatus(msg.id, 'read');
        updateMessage(msg.id, (m) => ({ ...m, status: 'read' }));
      });
    }
  }, [messages, status, sendStatus, updateMessage]);

  const handleSend = async (payload, type = 'text') => {
    const sentMsg = await sendMessage(payload, type);
    if (sentMsg) {
      addMessage({ ...sentMsg, status: 'delivered', type }, true);
    }
  };

  const handleSendFile = async (file, qualityMode, caption) => {
    const sentMsg = await sendFile(file, qualityMode, caption);
    if (sentMsg) {
      addMessage({ ...sentMsg, status: 'delivered' }, true);
    }
  };

  const handleReact = useCallback((messageId, reaction) => {
    updateMessage(messageId, (msg) => {
      const currentReactions = msg.reactions || {};
      const isAdding = msg.myReaction !== reaction;
      
      const newReactions = { ...currentReactions };
      
      // Remove old reaction if it exists
      if (msg.myReaction && msg.myReaction !== reaction) {
        newReactions[msg.myReaction] = Math.max(0, (newReactions[msg.myReaction] || 0) - 1);
        if (newReactions[msg.myReaction] === 0) delete newReactions[msg.myReaction];
        sendReaction(messageId, msg.myReaction, 'remove');
      }

      if (isAdding) {
        newReactions[reaction] = (newReactions[reaction] || 0) + 1;
        sendReaction(messageId, reaction, 'add');
      } else {
        newReactions[reaction] = Math.max(0, (newReactions[reaction] || 0) - 1);
        if (newReactions[reaction] === 0) delete newReactions[reaction];
        sendReaction(messageId, reaction, 'remove');
      }

      return { 
        ...msg, 
        reactions: newReactions,
        myReaction: isAdding ? reaction : null
      };
    });
  }, [updateMessage, sendReaction]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const shareLink = `${window.location.origin}/r/${roomId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      toast.success(t('copied') || 'Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
      toast.error('Failed to copy link');
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    return messages.filter(m => m.text?.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [messages, searchQuery]);

  const handleRequestSticker = useCallback(async (packId, stickerId) => {
    if (connRef.current && status === 'connected' && cryptoKeyRef.current) {
      try {
        const msg = { __stickerReq: true, packId, stickerId };
        const encryptedPayload = await encryptPayload(cryptoKeyRef.current, JSON.stringify(msg));
        const payloadWithType = new Uint8Array(1 + encryptedPayload.byteLength);
        payloadWithType[0] = 0;
        payloadWithType.set(encryptedPayload, 1);
        connRef.current.send(payloadWithType);
        toast.info('Requesting sticker...');
      } catch (err) {
        console.error('Failed to request sticker', err);
      }
    }
  }, [status, connRef, cryptoKeyRef]);

  return (
    <div 
      className="flex flex-col h-[100dvh] max-w-3xl mx-auto w-full bg-zinc-950 font-sans relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-emerald-500/10 border-2 border-emerald-500 border-dashed rounded-xl flex items-center justify-center pointer-events-none">
          <div className="bg-zinc-900 px-6 py-3 rounded-xl text-emerald-500 font-medium shadow-xl">
            Drop file to send
          </div>
        </div>
      )}
      <header className="px-4 py-3 border-b border-zinc-800/80 flex flex-col gap-3 bg-zinc-950/80 backdrop-blur-md z-10 sticky top-0">
        <div className="flex justify-between items-center">
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
                {(status === 'connecting' || status === 'reconnecting' || status === 'negotiating') && <div className="absolute w-2 h-2 rounded-full bg-amber-500 animate-ping opacity-75" />}
              </div>
              <span className="text-xs font-medium text-zinc-300">
                {status === 'connected' ? t('connected') : 
                 status === 'waiting' ? t('waiting') : 
                 status === 'connecting' ? t('connecting') : 
                 status === 'negotiating' ? 'Negotiating E2EE...' :
                 status === 'reconnecting' ? 'Reconnecting...' :
                 t('disconnected')}
              </span>
              {status === 'connected' && (
                <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-zinc-800">
                  {remoteProfile ? (
                    <div 
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                      style={{ backgroundColor: remoteProfile.color }}
                      title={remoteProfile.nick}
                    >
                      {remoteProfile.avatarEmoji}
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-500">
                      ?
                    </div>
                  )}
                  <span className="text-xs text-zinc-400 max-w-[80px] truncate">
                    {remoteProfile ? remoteProfile.nick : 'Peer'}
                  </span>
                </div>
              )}
            </div>
            {fingerprint && status === 'connected' && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/30 rounded-full border border-zinc-800/30" title="E2EE Fingerprint (Safety Number)">
                <ShieldAlert className="w-3 h-3 text-emerald-500" />
                <span className="text-[10px] font-mono text-zinc-500 tracking-wider">{fingerprint}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowSearch(!showSearch)}
              className={`p-2 rounded-full transition-all ${showSearch ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'}`}
              title="Search Messages"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </button>
            <button 
              onClick={() => {
                const dataStr = "data:text/json;charset=utf-use," + encodeURIComponent(JSON.stringify(messages));
                const downloadAnchorNode = document.createElement('a');
                downloadAnchorNode.setAttribute("href",     dataStr);
                downloadAnchorNode.setAttribute("download", `chat-export-${roomId}.json`);
                document.body.appendChild(downloadAnchorNode); // required for firefox
                downloadAnchorNode.click();
                downloadAnchorNode.remove();
              }}
              className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-full transition-all"
              title="Export Chat"
            >
              <Download className="w-5 h-5" />
            </button>
            <button onClick={() => setShowProfileModal(true)}
              className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-full transition-all"
              title="Profile">
              <User className="w-5 h-5" />
            </button>
            <button onClick={() => setShowSettingsModal(true)}
              className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-full transition-all">
              <Settings2 className="w-5 h-5" />
            </button>
            <button onClick={() => startCall('audio')}
              disabled={status !== 'connected'}
              className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-full transition-all disabled:opacity-30">
              <Phone className="w-5 h-5" />
            </button>
            <button onClick={() => startCall('video')}
              disabled={status !== 'connected'}
              className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-full transition-all disabled:opacity-30">
              <Video className="w-5 h-5" />
            </button>
          </div>
        </div>
        {showSearch && (
          <div className="flex items-center gap-2 animate-in slide-in-from-top-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages..."
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-700 text-zinc-300"
              autoFocus
            />
            <button 
              onClick={() => {
                setSearchQuery('');
                setShowSearch(false);
              }}
              className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-xl transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </header>

      <CallUI 
        callState={callState} 
        callType={callType} 
        isMuted={isMuted} 
        isVideoOff={isVideoOff} 
        quality={quality}
        callStats={callStats}
        localStream={localStream} 
        remoteStream={remoteStream} 
        insertableStreamsSupported={insertableStreamsSupported}
        onAccept={acceptCall} 
        onReject={rejectCall} 
        onEnd={endCall} 
        onMute={toggleMute} 
        onVideoToggle={toggleVideo}
        CALL_STATES={CALL_STATES}
        fingerprint={fingerprint}
      />

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
          
          <div className="bg-white p-3 rounded-xl shadow-lg">
            <QRCodeSVG value={shareLink} size={120} level="M" includeMargin={false} />
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
        {filteredMessages.length === 0 && searchQuery && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-50 select-none">
            <p className="text-sm text-zinc-500">No messages found for "{searchQuery}"</p>
          </div>
        )}
        {filteredMessages.length === 0 && !searchQuery && messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-50 select-none">
            <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-zinc-500" />
            </div>
            <p className="text-xs text-zinc-500 max-w-[200px] leading-relaxed">
              {t('encryptionNotice')}
              {roomSettings.ttl > 0 && (
                <span className="block mt-1">
                  · {t('vanishIn')} {roomSettings.ttl >= 60 ? `${roomSettings.ttl / 60} ${t('minutes')}` : `${roomSettings.ttl} ${t('seconds')}`}
                </span>
              )}
            </p>
          </div>
        )}
        {filteredMessages.map((msg) => (
          <Message key={msg.id} message={msg} onViewMedia={setViewMedia} onReact={handleReact} onRequestSticker={handleRequestSticker} />
        ))}
        <div ref={messagesEndRef} className="h-1" />
      </div>

      <div className="p-4 sm:p-6 pt-2 bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent flex flex-col gap-2">
        {Object.entries(transfers).map(([id, transfer]) => (
          <div key={id} className="px-4 py-3 bg-zinc-900/80 border border-zinc-800 rounded-xl flex items-center justify-between text-xs text-zinc-400 backdrop-blur-sm">
            <span className="font-medium">
              {transfer.type === 'processing' ? t('processingFile') : 
               transfer.type === 'sending' ? t('sendingFile') : 
               transfer.type === 'error' ? 'Transfer failed' :
               t('receivingFile')}
            </span>
            {transfer.type !== 'error' && (
              <div className="flex-1 mx-4 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all duration-300 ease-out" style={{ width: `${transfer.progress * 100}%` }} />
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="font-mono">{transfer.type !== 'error' ? `${Math.round(transfer.progress * 100)}%` : '❌'}</span>
              {transfer.type !== 'error' && transfer.type !== 'processing' && (
                <button 
                  onClick={() => cancelTransfer(id)}
                  className="p-1 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-red-400 transition-colors"
                  title="Cancel transfer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
        {isPeerTyping && (
          <div className="text-xs text-zinc-500 italic px-4 py-1 animate-pulse">
            {t('peerTyping') || 'Peer is typing...'}
          </div>
        )}
        <MiniPlayer />
        <MessageInput 
          onSend={handleSend} 
          onSendFile={handleSendFile} 
          onTyping={sendTyping}
          disabled={status !== 'connected' || isOffline} 
          draggedFile={draggedFile}
          onClearDraggedFile={() => setDraggedFile(null)}
        />
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

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
              <h3 className="font-medium text-zinc-100 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-emerald-500" />
                Room Settings
              </h3>
              <button onClick={() => setShowSettingsModal(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-3">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Message TTL (Seconds)</label>
                <select 
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors appearance-none"
                  value={roomSettings.ttl}
                  onChange={(e) => setRoomSettings(s => ({ ...s, ttl: parseInt(e.target.value, 10) }))}
                >
                  <option value="10">10 Seconds (Burn after reading)</option>
                  <option value="60">1 Minute</option>
                  <option value="300">5 Minutes</option>
                  <option value="3600">1 Hour</option>
                  <option value="0">Never Expire</option>
                </select>
              </div>
              <div className="space-y-3">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Max Messages</label>
                <select 
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors appearance-none"
                  value={roomSettings.maxMsgs}
                  onChange={(e) => setRoomSettings(s => ({ ...s, maxMsgs: parseInt(e.target.value, 10) }))}
                >
                  <option value="10">10 Messages</option>
                  <option value="50">50 Messages</option>
                  <option value="100">100 Messages</option>
                  <option value="0">Unlimited</option>
                </select>
              </div>
              
              <div className="pt-2">
                <button 
                  onClick={() => {
                    if (status === 'connected') {
                      sendSettingsSignal('settings-proposal', roomSettings);
                      toast.info('Proposed settings to peer...');
                      setShowSettingsModal(false);
                    } else {
                      toast.error('Must be connected to change settings');
                    }
                  }}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors shadow-lg shadow-emerald-500/20"
                >
                  Propose Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pending Settings Modal */}
      {pendingSettings && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in zoom-in-95">
          <div className="bg-zinc-900 border border-emerald-500/30 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl shadow-emerald-500/10">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                <AlertTriangle className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="text-lg font-medium text-zinc-100">Settings Change Request</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Peer wants to change room settings:
                <br/>
                <span className="text-zinc-200 font-medium">TTL:</span> {pendingSettings.ttl === 0 ? 'Never' : `${pendingSettings.ttl}s`}
                <br/>
                <span className="text-zinc-200 font-medium">Max Msgs:</span> {pendingSettings.maxMsgs === 0 ? 'Unlimited' : pendingSettings.maxMsgs}
              </p>
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => {
                    sendSettingsSignal('settings-reject');
                    setPendingSettings(null);
                  }}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-medium transition-colors"
                >
                  Reject
                </button>
                <button 
                  onClick={() => {
                    sendSettingsSignal('settings-accept', pendingSettings);
                    setRoomSettings(pendingSettings);
                    setPendingSettings(null);
                    toast.success('Settings updated');
                  }}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" /> Accept
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ProfileModal 
        isOpen={showProfileModal} 
        onClose={() => setShowProfileModal(false)}
        onSave={(profile) => {
          if (status === 'connected') {
            sendProfile(profile);
          }
        }}
      />
    </div>
  );
}
