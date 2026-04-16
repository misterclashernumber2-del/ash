import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGroup } from '../hooks/useGroup';
import { ArrowLeft, Users, Send } from 'lucide-react';

export function GroupRoom({ groupId, isHost }) {
  const navigate = useNavigate();
  const { status, peers, messages, broadcastMessage, myId } = useGroup(groupId, isHost);
  const [text, setText] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    broadcastMessage(text);
    setText('');
  };

  return (
    <div className="flex flex-col h-[100dvh] max-w-3xl mx-auto w-full bg-zinc-950 font-sans relative">
      <header className="px-4 py-3 border-b border-zinc-800/80 flex justify-between items-center bg-zinc-950/80 backdrop-blur-md z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/')} 
            className="p-2 -ml-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-full transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5 bg-zinc-900/50 px-3 py-1.5 rounded-full border border-zinc-800/50">
            <div className="relative flex items-center justify-center">
              <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            </div>
            <span className="text-xs font-medium text-zinc-300">
              {status === 'connected' ? 'Connected' : status}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-zinc-400 text-sm font-medium">
          <Users className="w-4 h-4" />
          {peers.length + 1}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex w-full ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
            <div className="flex flex-col max-w-[85%] sm:max-w-[75%]">
              {!msg.fromMe && (
                <span className="text-[10px] text-zinc-500 mb-1 ml-1 font-mono">
                  {msg.sender.substring(0, 6)}
                </span>
              )}
              <div 
                className={`px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
                  msg.fromMe 
                    ? 'bg-zinc-800 text-zinc-100 rounded-2xl rounded-br-sm' 
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-2xl rounded-bl-sm'
                }`}
              >
                {msg.text}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} className="h-1" />
      </div>

      <div className="p-4 bg-zinc-950 border-t border-zinc-800">
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Message group..."
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-700 text-zinc-300"
          />
          <button
            type="submit"
            disabled={!text.trim() || status !== 'connected'}
            className="p-3 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
