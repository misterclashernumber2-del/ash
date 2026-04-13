import React, { useState, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../lib/i18n';

export function TestPage() {
  const [roomId, setRoomId] = useState('');
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    setRoomId(`test-${nanoid(10)}`);
  }, []);

  if (!roomId) return null;

  const url = `${window.location.origin}/r/${roomId}`;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0a0a0a] text-[#e5e5e5] font-mono">
      <header className="p-3 border-b border-[#222] flex justify-between items-center bg-[#121212] z-10">
        <div className="flex items-center gap-4">
          <h1 className="font-bold text-sm text-green-500 flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            {t('devTestMode')}
          </h1>
          <span className="text-xs text-[#666] hidden sm:inline">Room: {roomId}</span>
        </div>
        <button 
          onClick={() => navigate('/')} 
          className="px-3 py-1.5 bg-[#222] hover:bg-[#333] border border-[#333] rounded text-xs transition-colors"
        >
          {t('closeTest')}
        </button>
      </header>
      
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="flex-1 border-b md:border-b-0 md:border-r border-[#222] relative">
          <div className="absolute top-0 left-0 bg-[#222] text-[#888] text-[10px] px-2 py-1 rounded-br z-20 font-bold tracking-wider">
            PEER 1
          </div>
          <iframe src={`${url}?slot=1`} className="w-full h-full border-none" title="Peer 1" />
        </div>
        <div className="flex-1 relative">
          <div className="absolute top-0 left-0 bg-[#222] text-[#888] text-[10px] px-2 py-1 rounded-br z-20 font-bold tracking-wider">
            PEER 2
          </div>
          <iframe src={`${url}?slot=2`} className="w-full h-full border-none" title="Peer 2" />
        </div>
      </div>
    </div>
  );
}
