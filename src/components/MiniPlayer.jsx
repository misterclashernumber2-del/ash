import React from 'react';
import { useMusicPlayer } from '../hooks/useMusicPlayer';
import { Play, Pause, SkipForward, Music } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function MiniPlayer() {
  const { currentTrack, isPlaying, togglePlay, playNext, progress, duration } = useMusicPlayer();
  const navigate = useNavigate();

  if (!currentTrack) return null;

  const progressPercent = duration ? (progress / duration) * 100 : 0;

  return (
    <div className="bg-zinc-900 border-t border-zinc-800 p-2 flex items-center gap-3 relative overflow-hidden group">
      {/* Progress bar background */}
      <div className="absolute top-0 left-0 h-[2px] bg-zinc-800 w-full">
        <div 
          className="h-full bg-emerald-500 transition-all duration-300 ease-linear" 
          style={{ width: `${progressPercent}%` }} 
        />
      </div>

      <button 
        onClick={() => navigate('/music')}
        className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center shrink-0 hover:bg-zinc-700 transition-colors"
      >
        <Music className="w-5 h-5 text-emerald-500" />
      </button>
      
      <div 
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => navigate('/music')}
      >
        <div className="text-sm font-medium text-zinc-200 truncate">
          {currentTrack.name}
        </div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
          Now Playing
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button 
          onClick={togglePlay}
          className="w-8 h-8 flex items-center justify-center text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
        >
          {isPlaying ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4 ml-0.5" fill="currentColor" />}
        </button>
        <button 
          onClick={playNext}
          className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
        >
          <SkipForward className="w-4 h-4" fill="currentColor" />
        </button>
      </div>
    </div>
  );
}
