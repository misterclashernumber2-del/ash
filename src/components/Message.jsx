import React, { useState, useRef, useEffect } from 'react';
import { Clock, Play, SmilePlus, Check, CheckCheck, Download } from 'lucide-react';
import { getStickerBlob } from '../lib/stickerStorage';

const QUICK_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🔥'];

export function Message({ message, onViewMedia, onReact, onReply, onRequestSticker }) {
  const { text, fromMe, timeLeft, type, url, mimeType, name, reactions, status, packId, stickerId, packName } = message;
  const [showReactions, setShowReactions] = useState(false);
  const [stickerUrl, setStickerUrl] = useState(null);

  useEffect(() => {
    if (type === 'sticker' && stickerId) {
      getStickerBlob(stickerId).then(blob => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          setStickerUrl(url);
        }
      }).catch(console.error);
    }
    return () => {
      if (stickerUrl) URL.revokeObjectURL(stickerUrl);
    };
  }, [type, stickerId, message]);

  let timerColorClass = 'text-zinc-500';
  let pulseClass = '';
  let timerText = '';
  let glitchClass = '';

  if (timeLeft > 0) {
    if (timeLeft > 60) {
      const m = Math.floor(timeLeft / 60);
      const s = timeLeft % 60;
      timerText = `${m}m ${s}s`;
    } else {
      timerText = `${timeLeft}s`;
      if (timeLeft <= 10) {
        timerColorClass = 'text-red-400';
        pulseClass = 'animate-pulse';
      } else {
        timerColorClass = 'text-amber-400';
      }
      if (timeLeft <= 3) {
        glitchClass = 'animate-glitch text-red-500 opacity-80';
      }
    }
  }

  const isImage = mimeType?.startsWith('image/') || name?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  const isVideo = mimeType?.startsWith('video/') || name?.match(/\.(mp4|webm|ogg|mov|avi|mkv)$/i);

  if (type === 'system') {
    return (
      <div className="flex w-full justify-center my-4">
        <span className="bg-zinc-900/60 border border-zinc-800/50 text-zinc-400 text-xs px-3 py-1.5 rounded-full">
          {text}
        </span>
      </div>
    );
  }

  const renderTextWithLinks = (text) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline break-all">
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const [swipeOffset, setSwipeOffset] = useState(0);
  const swipeRef = useRef(null);
  const startXRef = useRef(null);

  const handleTouchStart = (e) => {
    startXRef.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    if (startXRef.current === null) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - startXRef.current;
    
    // Only allow swipe left (to reply)
    if (diff < 0 && diff > -60) {
      setSwipeOffset(diff);
    }
  };

  const handleTouchEnd = () => {
    if (swipeOffset < -40) {
      onReply && onReply(message);
    }
    setSwipeOffset(0);
    startXRef.current = null;
  };

  return (
    <div 
      className={`flex w-full ${fromMe ? 'justify-end' : 'justify-start'} mb-2 ${glitchClass} group relative`}
      onMouseLeave={() => setShowReactions(false)}
    >
      <div 
        className={`flex flex-col max-w-[85%] sm:max-w-[75%] relative ${fromMe ? 'items-end' : 'items-start'} transition-transform duration-200`}
        style={{ transform: `translateX(${swipeOffset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        
        {/* Reaction Picker Popup */}
        {showReactions && (
          <div className={`absolute -top-10 ${fromMe ? 'right-0' : 'left-0'} bg-zinc-900 border border-zinc-800 rounded-full shadow-xl p-1.5 flex gap-1 z-10 animate-in slide-in-from-bottom-2`}>
            {QUICK_REACTIONS.map(emoji => (
              <button
                key={emoji}
                onClick={() => {
                  onReact && onReact(message.id, emoji);
                  setShowReactions(false);
                }}
                className="w-8 h-8 flex items-center justify-center hover:bg-zinc-800 rounded-full transition-colors text-lg"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <div className="relative group/msg">
          {type === 'sticker' ? (
            <div className="relative hover:scale-105 transition-transform duration-200">
              {stickerUrl ? (
                <img src={stickerUrl} alt="sticker" className="w-40 h-40 object-contain drop-shadow-xl" />
              ) : (
                <div 
                  className="w-40 h-40 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-zinc-800 transition-colors"
                  onClick={() => onRequestSticker && onRequestSticker(packId, stickerId)}
                >
                  <Download className="w-6 h-6 text-emerald-500" />
                  <span className="text-xs text-zinc-400 font-medium text-center px-2">
                    Tap to download<br/>{packName}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div 
              className={`px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
                fromMe 
                  ? 'bg-zinc-800 text-zinc-100 rounded-2xl rounded-br-sm' 
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-2xl rounded-bl-sm'
              }`}
            >
              {type === 'voice' ? (
            <div className="flex items-center gap-3 w-48 sm:w-64">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  const audio = document.getElementById(`audio-${message.id}`);
                  if (audio) {
                    if (audio.paused) audio.play();
                    else audio.pause();
                  }
                }}
                className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${fromMe ? 'bg-zinc-700 text-zinc-100 hover:bg-zinc-600' : 'bg-zinc-800 text-emerald-400 hover:bg-zinc-700'} transition-colors`}
              >
                <Play className="w-5 h-5 ml-0.5" />
              </button>
              <div className="flex-1 flex flex-col gap-1">
                <div className="h-6 w-full bg-zinc-900/50 rounded flex items-center px-1 overflow-hidden">
                  {/* Fake waveform for now, could be real if we saved it */}
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div key={i} className="flex-1 mx-[1px] bg-emerald-500/60 rounded-full" style={{ height: `${Math.max(20, Math.random() * 100)}%` }} />
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                  <span>0:00</span>
                  <span>{message.duration ? `${Math.floor(message.duration / 60)}:${(message.duration % 60).toString().padStart(2, '0')}` : ''}</span>
                </div>
              </div>
              <audio id={`audio-${message.id}`} src={url} className="hidden" />
            </div>
          ) : type === 'file' ? (
            <div className="flex flex-col gap-2">
              {isImage ? (
                <img 
                  src={url} 
                  alt="attachment" 
                  className="max-w-full rounded-lg max-h-64 object-contain cursor-pointer hover:opacity-90 transition-opacity" 
                  onClick={() => onViewMedia(message)}
                />
              ) : isVideo ? (
                <div className="relative cursor-pointer group" onClick={() => onViewMedia(message)}>
                  <video src={url} className="max-w-full rounded-lg max-h-64 object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors rounded-lg">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                      <Play className="w-6 h-6 text-white ml-1" />
                    </div>
                  </div>
                </div>
              ) : (
                <a href={url} download={name} className="text-emerald-400 underline">{name || 'Download File'}</a>
              )}
              {text && <span className="mt-1">{renderTextWithLinks(text)}</span>}
            </div>
          ) : (
            renderTextWithLinks(text)
          )}
            </div>
          )}
          
          {/* Reaction Trigger Button */}
          {!showReactions && (
            <button
              onClick={() => setShowReactions(true)}
              className={`absolute top-1/2 -translate-y-1/2 ${fromMe ? '-left-10' : '-right-10'} p-1.5 bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-full opacity-0 group-hover/msg:opacity-100 transition-opacity shadow-lg z-10`}
            >
              <SmilePlus className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {/* Reactions Display */}
        {reactions && Object.keys(reactions).length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${fromMe ? 'justify-end' : 'justify-start'}`}>
            {Object.entries(reactions).map(([emoji, count]) => (
              <button
                key={emoji}
                onClick={() => onReact && onReact(message.id, emoji)}
                className={`px-1.5 py-0.5 rounded-full text-xs flex items-center gap-1 border transition-colors ${
                  message.myReaction === emoji 
                    ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' 
                    : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                <span>{emoji}</span>
                <span className="font-medium">{count}</span>
              </button>
            ))}
          </div>
        )}

        {timeLeft > 0 && (
          <div className={`flex items-center gap-1 mt-1.5 text-[11px] font-medium ${fromMe ? 'justify-end' : 'justify-start'} ${timerColorClass} ${pulseClass}`}>
            <Clock className="w-3 h-3" />
            {timerText}
          </div>
        )}
        {fromMe && !timeLeft && (
          <div className="flex items-center justify-end mt-1 text-zinc-500">
            {status === 'read' ? (
              <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
            ) : status === 'delivered' ? (
              <CheckCheck className="w-3.5 h-3.5" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
