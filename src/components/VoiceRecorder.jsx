import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Send, X, Play, Pause } from 'lucide-react';
import { toast } from 'sonner';

export function VoiceRecorder({ onSend, onCancel }) {
  const [state, setState] = useState('idle'); // idle, recording, preview
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const blobRef = useRef(null);

  useEffect(() => {
    return () => {
      stopRecording();
      if (audioCtxRef.current) audioCtxRef.current.close();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (blobRef.current) URL.revokeObjectURL(audioRef.current?.src);
    };
  }, []);

  const getSupportedMimeType = () => {
    const types = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm'];
    for (let t of types) {
      if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      
      if (!mimeType) {
        toast.error('Audio recording not supported in this browser');
        return;
      }

      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      // Setup Web Audio API for live waveform
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtxRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioCtxRef.current.createAnalyser();
      analyserRef.current.fftSize = 64;
      source.connect(analyserRef.current);

      mediaRecorderRef.current.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        blobRef.current = blob;
        setState('preview');
        
        // Draw static waveform
        if (canvasRef.current) {
          await drawStaticWaveform(blob, canvasRef.current);
        }
        
        // Setup audio element for preview
        if (audioRef.current) {
          audioRef.current.src = URL.createObjectURL(blob);
        }
        
        // Stop all tracks
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorderRef.current.start(100); // 100ms chunks
      setState('recording');
      setDuration(0);
      
      timerRef.current = setInterval(() => {
        setDuration(d => {
          if (d >= 300) { // 5 minutes max
            stopRecording();
            toast.warning('Maximum recording time reached (5 min)');
            return d;
          }
          return d + 1;
        });
      }, 1000);

      drawLiveWaveform();

    } catch (err) {
      console.error('Error accessing microphone', err);
      toast.error('Could not access microphone');
      setState('idle');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };

  const handleSend = () => {
    if (blobRef.current) {
      const file = new File([blobRef.current], `voice_${Date.now()}.webm`, { type: blobRef.current.type });
      onSend(file, duration);
    }
    reset();
  };

  const reset = () => {
    setState('idle');
    setDuration(0);
    setIsPlaying(false);
    chunksRef.current = [];
    if (blobRef.current) {
      URL.revokeObjectURL(audioRef.current?.src);
      blobRef.current = null;
    }
    onCancel();
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const drawLiveWaveform = () => {
    if (!canvasRef.current || !analyserRef.current || state !== 'recording') return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      if (state !== 'recording') return;
      rafRef.current = requestAnimationFrame(draw);
      
      analyserRef.current.getByteFrequencyData(dataArray);
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ef4444'; // red-500
      
      const bars = 20;
      const barWidth = (canvas.width / bars) - 2;
      
      for (let i = 0; i < bars; i++) {
        const value = dataArray[i] || 0;
        const percent = value / 255;
        const height = Math.max(2, percent * canvas.height);
        const x = i * (canvas.width / bars);
        const y = (canvas.height - height) / 2;
        
        ctx.fillRect(x, y, barWidth, height);
      }
    };
    
    draw();
  };

  const drawStaticWaveform = async (audioBlob, canvas) => {
    try {
      const ctx = canvas.getContext('2d');
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const data = audioBuffer.getChannelData(0);
      
      const samples = 60;
      const blockSize = Math.floor(data.length / samples);
      const bars = [];
      
      for (let i = 0; i < samples; i++) {
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(data[i * blockSize + j]);
        }
        bars.push(sum / blockSize);
      }
      
      const max = Math.max(...bars, 0.01);
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      bars.forEach((bar, i) => {
        const h = Math.max(2, (bar / max) * 36);
        ctx.fillStyle = '#10b981'; // emerald-500
        ctx.fillRect(i * (canvas.width / samples), (canvas.height - h) / 2, (canvas.width / samples) - 1, h);
      });
      
      audioCtx.close();
    } catch (e) {
      console.error('Error drawing static waveform', e);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (state === 'idle') {
    return (
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          startRecording();
        }}
        className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl transition-all"
        title="Hold to record"
      >
        <Mic className="w-5 h-5" />
      </button>
    );
  }

  if (state === 'recording') {
    return (
      <div className="flex-1 flex items-center gap-3 bg-red-500/10 rounded-xl px-3 py-1 border border-red-500/20">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-red-400 font-mono text-sm">{formatTime(duration)}</span>
        <div className="flex-1 h-8 flex items-center justify-center">
          <canvas ref={canvasRef} width={100} height={32} className="w-full max-w-[100px] h-full" />
        </div>
        <button
          type="button"
          onClick={stopRecording}
          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
        >
          <Square className="w-4 h-4" fill="currentColor" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center gap-2 bg-zinc-900 rounded-xl px-2 py-1 border border-zinc-800">
      <button
        type="button"
        onClick={reset}
        className="p-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
      
      <button
        type="button"
        onClick={togglePlay}
        className="w-8 h-8 flex items-center justify-center bg-emerald-500 text-zinc-950 rounded-full hover:bg-emerald-400 transition-colors shrink-0"
      >
        {isPlaying ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4 ml-0.5" fill="currentColor" />}
      </button>
      
      <div className="flex-1 h-10 flex items-center px-2">
        <canvas ref={canvasRef} width={200} height={40} className="w-full h-full" />
      </div>
      
      <span className="text-zinc-400 font-mono text-xs px-1">{formatTime(duration)}</span>
      
      <button
        type="button"
        onClick={handleSend}
        className="p-2 text-emerald-500 hover:bg-emerald-500/20 rounded-lg transition-colors"
      >
        <Send className="w-4 h-4" />
      </button>
      
      <audio 
        ref={audioRef} 
        onEnded={() => setIsPlaying(false)} 
        className="hidden" 
      />
    </div>
  );
}
