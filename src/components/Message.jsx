import React from 'react';

export function Message({ message }) {
  const { text, fromMe, timeLeft } = message;

  let timerColorClass = 'text-[#888888]';
  let pulseClass = '';
  let timerText = '';

  if (timeLeft > 60) {
    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;
    timerText = `⏱ ${m}m ${s}s`;
  } else {
    timerText = `⏱ ${timeLeft}s`;
    if (timeLeft <= 10) {
      timerColorClass = 'text-red-500';
      pulseClass = 'animate-pulse-fast';
    } else {
      timerColorClass = 'text-amber-500';
    }
  }

  return (
    <div className={`flex w-full ${fromMe ? 'justify-end' : 'justify-start'}`}>
      <div className="flex flex-col max-w-[85%] sm:max-w-[75%]">
        <div 
          className={`px-4 py-3 rounded-lg whitespace-pre-wrap break-words ${
            fromMe 
              ? 'bg-[#112233] border border-[#1a3a5a] text-[#e5e5e5] rounded-br-none' 
              : 'bg-[#1a1a1a] border border-[#2a2a2a] text-[#e5e5e5] rounded-bl-none'
          }`}
        >
          {text}
        </div>
        <div className={`text-[10px] mt-1 ${fromMe ? 'text-right' : 'text-left'} ${timerColorClass} ${pulseClass}`}>
          {timerText}
        </div>
      </div>
    </div>
  );
}
