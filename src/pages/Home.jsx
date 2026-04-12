import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { useLanguage } from '../lib/i18n';
import { Copy, ArrowRight, Shield, LogIn, Settings2 } from 'lucide-react';

export function Home() {
  const navigate = useNavigate();
  const { t, toggleLang } = useLanguage();
  const [baseId, setBaseId] = useState('');
  const [joinId, setJoinId] = useState('');
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Settings
  const [ttl, setTtl] = useState(300); // 5 minutes default
  const [maxMsgs, setMaxMsgs] = useState(0); // Unlimited default

  useEffect(() => {
    setBaseId(nanoid(10));
  }, []);

  const fullRoomId = baseId ? `${baseId}_${ttl}_${maxMsgs}` : '';
  const shareLink = fullRoomId ? `${window.location.origin}/r/${fullRoomId}` : '';

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
    if (fullRoomId) {
      navigate(`/r/${fullRoomId}`);
    }
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (joinId.trim()) {
      navigate(`/r/${joinId.trim()}`);
    }
  };

  if (!baseId) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-zinc-950 text-zinc-50 font-sans relative selection:bg-zinc-800">
      <button 
        onClick={toggleLang} 
        className="absolute top-6 right-6 text-zinc-400 hover:text-zinc-100 px-3 py-1.5 border border-zinc-800 hover:bg-zinc-900 rounded-lg transition-all text-sm font-medium"
      >
        {t('langToggle')}
      </button>

      <div className="max-w-md w-full space-y-10">
        <div className="text-center space-y-5 flex flex-col items-center">
          <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mb-2 shadow-xl">
            <Shield className="w-8 h-8 text-zinc-300" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">{t('tagline')}</h1>
          <p className="text-zinc-400 text-sm leading-relaxed max-w-[280px] mx-auto">
            {t('subTagline')}
          </p>
        </div>

        <div className="space-y-6 bg-zinc-900/50 p-6 sm:p-8 rounded-2xl border border-zinc-800/80 shadow-2xl backdrop-blur-sm">
          
          {/* Settings Section */}
          <div className="space-y-4">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <Settings2 className="w-4 h-4" />
              {t('roomSettings')}
            </button>
            
            {showSettings && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-zinc-950/50 rounded-xl border border-zinc-800/50">
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-500 font-medium">{t('messageLifespan')}</label>
                  <select 
                    value={ttl} 
                    onChange={(e) => setTtl(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-700"
                  >
                    <option value={5}>5 {t('seconds')}</option>
                    <option value={10}>10 {t('seconds')}</option>
                    <option value={30}>30 {t('seconds')}</option>
                    <option value={60}>1 {t('minutes')}</option>
                    <option value={300}>5 {t('minutes')}</option>
                    <option value={3600}>1 {t('hours')}</option>
                    <option value={0}>{t('unlimited')}</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-500 font-medium">{t('maxMessages')}</label>
                  <select 
                    value={maxMsgs} 
                    onChange={(e) => setMaxMsgs(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-700"
                  >
                    <option value={0}>{t('unlimited')}</option>
                    <option value={10}>10</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">{t('shareLabel')}</label>
            <div className="flex items-center gap-2">
              <input 
                type="text" 
                readOnly 
                value={shareLink}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-700 text-zinc-300 font-mono transition-all"
              />
              <button 
                onClick={handleCopy}
                className="p-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-zinc-200 transition-all flex items-center justify-center shrink-0"
                title={t('copy')}
              >
                <Copy className="w-5 h-5" />
              </button>
            </div>
          </div>

          <button 
            onClick={handleOpen}
            className="w-full py-3.5 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-zinc-100/10"
          >
            {t('openRoom')}
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-zinc-900 px-3 text-zinc-500 font-medium">{t('or')}</span>
            </div>
          </div>

          <form onSubmit={handleJoin} className="flex gap-2">
            <input
              type="text"
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              placeholder={t('enterRoomId')}
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-700 text-zinc-300 font-mono transition-all"
            />
            <button
              type="submit"
              disabled={!joinId.trim()}
              className="px-5 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-zinc-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shrink-0"
            >
              <LogIn className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>

      <div className="absolute bottom-6">
        <button 
          onClick={() => navigate('/test')}
          className="text-zinc-700 hover:text-zinc-500 text-xs font-medium transition-colors"
        >
          {t('testLocally')}
        </button>
      </div>
    </div>
  );
}
