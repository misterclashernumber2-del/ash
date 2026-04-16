import React, { useRef } from 'react';
import { useMusicPlayer } from '../hooks/useMusicPlayer';
import { Play, Pause, SkipBack, SkipForward, Volume2, Music, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function MusicPage() {
  const { 
    playlist, currentTrack, currentIndex, isPlaying, 
    volume, progress, duration, addTracks, playTrack, 
    togglePlay, playNext, playPrev, setVolume, seek 
  } = useMusicPlayer();
  
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-6 flex flex-col items-center">
      <div className="w-full max-w-2xl flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Music className="w-6 h-6 text-emerald-500" />
          Music Player
        </h1>
        <button 
          onClick={() => navigate(-1)}
          className="text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          Back
        </button>
      </div>

      <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-8 shadow-xl">
        {currentTrack ? (
          <div className="flex flex-col items-center gap-6">
            <div className="w-32 h-32 bg-zinc-800 rounded-2xl flex items-center justify-center shadow-lg">
              <Music className="w-12 h-12 text-zinc-600" />
            </div>
            
            <div className="text-center w-full">
              <h2 className="text-lg font-semibold truncate px-4">{currentTrack.name}</h2>
              <p className="text-sm text-zinc-500 mt-1">Local File</p>
            </div>

            <div className="w-full flex items-center gap-3 text-xs text-zinc-400 font-mono">
              <span>{formatTime(progress)}</span>
              <input 
                type="range" 
                min={0} 
                max={duration || 100} 
                value={progress}
                onChange={(e) => seek(Number(e.target.value))}
                className="flex-1 h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:rounded-full"
              />
              <span>{formatTime(duration)}</span>
            </div>

            <div className="flex items-center gap-6">
              <button onClick={playPrev} className="p-2 text-zinc-400 hover:text-zinc-100 transition-colors">
                <SkipBack className="w-6 h-6" fill="currentColor" />
              </button>
              <button 
                onClick={togglePlay} 
                className="w-14 h-14 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-full flex items-center justify-center transition-colors shadow-lg shadow-emerald-500/20"
              >
                {isPlaying ? <Pause className="w-6 h-6" fill="currentColor" /> : <Play className="w-6 h-6 ml-1" fill="currentColor" />}
              </button>
              <button onClick={playNext} className="p-2 text-zinc-400 hover:text-zinc-100 transition-colors">
                <SkipForward className="w-6 h-6" fill="currentColor" />
              </button>
            </div>

            <div className="flex items-center gap-3 w-full max-w-xs mt-2">
              <Volume2 className="w-4 h-4 text-zinc-500" />
              <input 
                type="range" 
                min={0} 
                max={1} 
                step={0.01}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="flex-1 h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-zinc-400 [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-zinc-500">
            <Music className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No tracks loaded</p>
          </div>
        )}
      </div>

      <div className="w-full max-w-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-zinc-300">Playlist</h3>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 text-sm bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors text-zinc-300"
          >
            <Upload className="w-4 h-4" />
            Add Tracks
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={(e) => addTracks(e.target.files)} 
            accept="audio/*" 
            multiple 
            className="hidden" 
          />
        </div>

        <div className="space-y-2">
          {playlist.map((track, i) => (
            <div 
              key={track.id}
              onClick={() => playTrack(i)}
              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                i === currentIndex ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-zinc-900/50 border border-transparent hover:bg-zinc-800 text-zinc-300'
              }`}
            >
              <div className="w-8 h-8 flex items-center justify-center shrink-0">
                {i === currentIndex && isPlaying ? (
                  <div className="flex gap-0.5 items-end h-4">
                    <div className="w-1 bg-emerald-500 animate-[bounce_1s_infinite] h-full" />
                    <div className="w-1 bg-emerald-500 animate-[bounce_1.2s_infinite] h-2/3" />
                    <div className="w-1 bg-emerald-500 animate-[bounce_0.8s_infinite] h-4/5" />
                  </div>
                ) : (
                  <span className="text-xs font-mono opacity-50">{i + 1}</span>
                )}
              </div>
              <div className="flex-1 truncate text-sm font-medium">
                {track.name}
              </div>
            </div>
          ))}
          {playlist.length === 0 && (
            <div className="text-center py-8 text-sm text-zinc-600 border border-dashed border-zinc-800 rounded-xl">
              Click "Add Tracks" to build your playlist
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
