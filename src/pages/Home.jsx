import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { useLanguage } from '../lib/i18n';

export function Home() {
  const navigate = useNavigate();
  const { t, toggleLang } = useLanguage();
  const [roomId, setRoomId] = useState('');
  const [joinId, setJoinId] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setRoomId(nanoid(10));
  }, []);

  const shareLink = roomId ? `${window.location.origin}/r/${roomId}` : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleOpen = () => {
    if (roomId) {
      navigate(`/r/${roomId}`);
    }
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (joinId.trim()) {
      navigate(`/r/${joinId.trim()}`);
    }
  };

  if (!roomId) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#0a0a0a] text-[#e5e5e5] font-mono relative">
      <button 
        onClick={toggleLang} 
        className="absolute top-4 right-4 text-[#888] hover:text-white px-3 py-1 border border-[#333] rounded transition-colors"
      >
        {t('langToggle')}
      </button>

      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold tracking-tight">{t('tagline')}</h1>
          <p className="text-[#888888] text-sm">
            {t('subTagline')}
          </p>
        </div>

        <div className="space-y-4 bg-[#121212] p-6 rounded-lg border border-[#222]">
          <div className="space-y-2">
            <label className="text-xs text-[#888888] uppercase tracking-wider">{t('shareLabel')}</label>
            <div className="flex items-center gap-2">
              <input 
                type="text" 
                readOnly 
                value={shareLink}
                className="flex-1 bg-[#0a0a0a] border border-[#333] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#555] text-[#ccc]"
              />
              <button 
                onClick={handleCopy}
                className="px-4 py-2 bg-[#222] hover:bg-[#333] border border-[#333] rounded text-sm transition-colors"
              >
                {copied ? t('copied') : t('copy')}
              </button>
            </div>
          </div>

          <button 
            onClick={handleOpen}
            className="w-full py-3 bg-[#e5e5e5] hover:bg-white text-[#0a0a0a] font-bold rounded transition-colors mt-4"
          >
            {t('openRoom')}
          </button>

          <div className="mt-6 pt-6 border-t border-[#222]">
            <p className="text-center text-[#888] text-xs mb-4">{t('or')}</p>
            <form onSubmit={handleJoin} className="flex gap-2">
              <input
                type="text"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
                placeholder={t('enterRoomId')}
                className="flex-1 bg-[#0a0a0a] border border-[#333] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#555] text-[#ccc]"
              />
              <button
                type="submit"
                disabled={!joinId.trim()}
                className="px-4 py-2 bg-[#222] hover:bg-[#333] border border-[#333] rounded text-sm transition-colors disabled:opacity-50"
              >
                {t('joinRoom')}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
