import React from 'react';
import { Clock, Play } from 'lucide-react';

export function Message({ message, onViewMedia }) {
  const { text, fromMe, timeLeft, type, url, mimeType, name } = message;

  let timerColorClass = 'text-zinc-500';
  let pulseClass = '';
  let timerText = '';

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

  return (
    <div className={`flex w-full ${fromMe ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className="flex flex-col max-w-[85%] sm:max-w-[75%]">
        <div 
          className={`px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
            fromMe 
              ? 'bg-zinc-800 text-zinc-100 rounded-2xl rounded-br-sm' 
              : 'bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-2xl rounded-bl-sm'
          }`}
        >
          {type === 'file' ? (
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
        {timeLeft > 0 && (
          <div className={`flex items-center gap-1 mt-1.5 text-[11px] font-medium ${fromMe ? 'justify-end' : 'justify-start'} ${timerColorClass} ${pulseClass}`}>
            <Clock className="w-3 h-3" />
            {timerText}
          </div>
        )}
      </div>
    </div>
  );
}
