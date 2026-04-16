import React, { useEffect, useRef } from 'react';

export function CallUI({ callState, callType, isMuted, isVideoOff, quality, callStats,
                         localStream, remoteStream, insertableStreamsSupported,
                         onAccept, onReject, onEnd, onMute, onVideoToggle,
                         CALL_STATES, fingerprint }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callState]);
  
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callState]);

  const qualityColors = { good: 'text-emerald-400', medium: 'text-amber-400', bad: 'text-red-400' };
  const qualityIcons = { good: '●●●', medium: '●●○', bad: '●○○' };

  if (callState === CALL_STATES.IDLE) return null;

  if (callState === CALL_STATES.INCOMING) {
    return (
      <div className="fixed inset-0 z-[200] flex items-end justify-center pb-12 bg-black/60 backdrop-blur-sm">
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-80 shadow-2xl animate-in slide-in-from-bottom-4">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-zinc-800 rounded-full mx-auto mb-3 flex items-center justify-center">
              <span className="text-2xl">{callType === 'video' ? '📹' : '📞'}</span>
            </div>
            <p className="text-zinc-200 font-medium">Incoming {callType} call</p>
          </div>
          <div className="flex gap-4">
            <button onClick={onReject}
              className="flex-1 py-4 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-2xl text-2xl transition-all">
              ✕
            </button>
            <button onClick={() => onAccept(callType)}
              className="flex-1 py-4 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-2xl text-2xl transition-all">
              ✓
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (callState === CALL_STATES.CALLING || callState === CALL_STATES.CONNECTING) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-zinc-950/95 backdrop-blur-sm">
        <div className="text-zinc-400 animate-pulse text-lg mb-8">
          {callState === CALL_STATES.CALLING ? 'Calling...' : 'Connecting...'}
        </div>
        <button onClick={onEnd}
          className="w-16 h-16 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-full text-2xl transition-all">
          ✕
        </button>
      </div>
    );
  }

  if (callState === CALL_STATES.CONNECTED) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col bg-zinc-950">
        {/* Видео */}
        {callType === 'video' && (
          <div className="flex-1 relative bg-black">
            <video ref={remoteVideoRef} autoPlay playsInline
              className="w-full h-full object-cover" />
            <video ref={localVideoRef} autoPlay playsInline muted
              className="absolute bottom-4 right-4 w-32 h-24 object-cover rounded-xl border border-zinc-700" />
          </div>
        )}
        
        {/* Аудио визуализация */}
        {callType === 'audio' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="w-24 h-24 bg-zinc-800 rounded-full flex items-center justify-center text-4xl">
              🎙
            </div>
            <p className="text-zinc-300 font-medium">Voice call</p>
            <audio ref={remoteVideoRef} autoPlay playsInline className="hidden" />
          </div>
        )}

        {/* Статус качества */}
        <div className={`text-center text-xs py-2 flex flex-col items-center gap-1 ${qualityColors[quality]}`}>
          <div className="flex items-center gap-1.5 font-medium">
            {qualityIcons[quality]} <span className="uppercase tracking-wider">{quality}</span>
            {!insertableStreamsSupported && <span className="text-zinc-500 ml-1">· DTLS only</span>}
          </div>
          {callStats && (
            <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-mono opacity-80">
              <span title="Packet Loss">PL: {(callStats.packetLoss * 100).toFixed(1)}%</span>
              <span title="Latency (RTT)">RTT: {Math.round(callStats.rtt * 1000)}ms</span>
              <span title="Jitter">JIT: {Math.round(callStats.jitter * 1000)}ms</span>
            </div>
          )}
        </div>

        {/* E2EE индикатор */}
        <div className="text-center text-xs text-zinc-600 py-1 flex flex-col items-center gap-1">
          <span>{insertableStreamsSupported ? '🔒 E2E encrypted' : '🔐 DTLS encrypted'}</span>
          {fingerprint && (
            <span className="font-mono text-[10px] opacity-50">FP: {fingerprint.substring(0, 16)}...</span>
          )}
        </div>

        {/* Контролы */}
        <div className="p-6 flex items-center justify-center gap-4">
          <button onClick={onMute}
            className={`w-14 h-14 rounded-full flex items-center justify-center text-xl transition-all
              ${isMuted ? 'bg-red-500/30 text-red-400' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}>
            {isMuted ? '🔇' : '🎙'}
          </button>
          
          {callType === 'video' && (
            <button onClick={onVideoToggle}
              className={`w-14 h-14 rounded-full flex items-center justify-center text-xl transition-all
                ${isVideoOff ? 'bg-red-500/30 text-red-400' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}>
              {isVideoOff ? '📵' : '📹'}
            </button>
          )}
          
          <button onClick={onEnd}
            className="w-16 h-16 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-2xl transition-all shadow-lg">
            ✕
          </button>
        </div>
      </div>
    );
  }
  
  return null;
}
