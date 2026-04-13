import { useState, useRef, useCallback, useEffect } from 'react';
import { deriveCallKey, createEncryptTransform, createDecryptTransform } from '../lib/callCrypto';
import { ICE_SERVERS } from '../lib/peerConfig';
import { encryptPayload } from '../lib/crypto';

const CALL_STATES = {
  IDLE: 'idle',
  CALLING: 'calling',
  INCOMING: 'incoming',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ENDED: 'ended',
};

function optimizeSDP(sdp, quality = 'low') {
  const configs = {
    low: 'useinbandfec=1;usedtx=1;maxaveragebitrate=16000;minptime=60',
    medium: 'useinbandfec=1;usedtx=1;maxaveragebitrate=32000;minptime=20',
    high: 'useinbandfec=1;usedtx=1;maxaveragebitrate=64000;minptime=10',
  };
  
  // Find Opus payload type
  const match = sdp.match(/a=rtpmap:(\d+) opus\/48000\/2/);
  if (!match) return sdp;
  
  const pt = match[1];
  const fmtpRegex = new RegExp(`a=fmtp:${pt} (.*)`);
  
  if (sdp.match(fmtpRegex)) {
    return sdp.replace(fmtpRegex, `a=fmtp:${pt} ${configs[quality]}`);
  } else {
    // If fmtp doesn't exist, append it after rtpmap
    return sdp.replace(
      new RegExp(`(a=rtpmap:${pt} opus\\/48000\\/2\\r\\n)`),
      `$1a=fmtp:${pt} ${configs[quality]}\r\n`
    );
  }
}

export function useCall({ connRef, cryptoKeyRef, onSystemMessage }) {
  const [callState, setCallState] = useState(CALL_STATES.IDLE);
  const [callType, setCallType] = useState('audio');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [quality, setQuality] = useState('good');
  
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const callKeyRef = useRef(null);
  const qualityIntervalRef = useRef(null);
  const callTimeoutRef = useRef(null);
  const insertableStreamsSupported = typeof RTCRtpSender !== 'undefined' && 
    'createEncodedStreams' in RTCRtpSender.prototype;

  const initCallKey = useCallback(async () => {
    if (cryptoKeyRef.current && !callKeyRef.current) {
      callKeyRef.current = await deriveCallKey(cryptoKeyRef.current);
    }
  }, [cryptoKeyRef]);

  const sendCallSignal = useCallback(async (payload) => {
    if (!connRef.current?.open || !cryptoKeyRef.current) return;
    const encrypted = await encryptPayload(cryptoKeyRef.current, JSON.stringify({ __call: true, ...payload }));
    const packet = new Uint8Array(1 + encrypted.byteLength);
    packet[0] = 0;
    packet.set(encrypted, 1);
    connRef.current.send(packet);
  }, [connRef, cryptoKeyRef]);

  const cleanupCall = useCallback(() => {
    clearInterval(qualityIntervalRef.current);
    clearTimeout(callTimeoutRef.current);
    
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    
    callKeyRef.current = null;
    setCallState(CALL_STATES.IDLE);
    setQuality('good');
  }, []);

  const createPeerConnection = useCallback(async (type, isInitiator) => {
    await initCallKey();
    
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS.iceServers,
    });
    peerConnectionRef.current = pc;

    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 16000,
        channelCount: 1,
      },
      video: type === 'video' ? {
        width: { ideal: 640, max: 1280 },
        height: { ideal: 480, max: 720 },
        frameRate: { ideal: 15, max: 30 },
      } : false,
    };
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      
      stream.getTracks().forEach(track => {
        const sender = pc.addTrack(track, stream);
        
        if (insertableStreamsSupported && callKeyRef.current) {
          const { readable, writable } = sender.createEncodedStreams();
          readable
            .pipeThrough(createEncryptTransform(callKeyRef.current))
            .pipeTo(writable);
        }
      });
    } catch (err) {
      console.error('Failed to get media devices', err);
      cleanupCall();
      return null;
    }

    pc.ontrack = ({ streams: [remoteStream] }) => {
      remoteStreamRef.current = remoteStream;
      
      if (insertableStreamsSupported && callKeyRef.current) {
        pc.getReceivers().forEach(receiver => {
          if (receiver.track.kind === 'audio' || receiver.track.kind === 'video') {
            const { readable, writable } = receiver.createEncodedStreams();
            readable
              .pipeThrough(createDecryptTransform(callKeyRef.current))
              .pipeTo(writable);
          }
        });
      }
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        sendCallSignal({ type: 'call-ice', candidate: candidate.toJSON() });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCallState(CALL_STATES.CONNECTED);
        startQualityMonitor(pc);
      } else if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
        if (pc.connectionState === 'failed') {
          pc.restartIce();
        } else {
          cleanupCall();
        }
      }
    };

    return pc;
  }, [initCallKey, insertableStreamsSupported, cleanupCall, sendCallSignal]);

  const startQualityMonitor = useCallback((pc) => {
    qualityIntervalRef.current = setInterval(async () => {
      const stats = await pc.getStats();
      let packetLoss = 0, rtt = 0, jitter = 0;
      
      stats.forEach(r => {
        if (r.type === 'inbound-rtp' && r.kind === 'audio') {
          const total = r.packetsReceived + (r.packetsLost || 0);
          if (total > 0) packetLoss = (r.packetsLost || 0) / total;
          jitter = r.jitter || 0;
        }
        if (r.type === 'candidate-pair' && r.nominated) {
          rtt = r.currentRoundTripTime || 0;
        }
      });

      let newQuality;
      if (packetLoss > 0.15 || rtt > 0.8 || jitter > 0.1) newQuality = 'bad';
      else if (packetLoss > 0.05 || rtt > 0.3 || jitter > 0.04) newQuality = 'medium';
      else newQuality = 'good';
      
      setQuality(newQuality);
      
      const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
      if (sender) {
        const params = sender.getParameters();
        if (params.encodings?.length > 0) {
          const bitrates = { bad: 16000, medium: 32000, good: 64000 };
          params.encodings[0].maxBitrate = bitrates[newQuality];
          await sender.setParameters(params).catch(() => {});
        }
      }
    }, 2000);
  }, []);

  const startCall = useCallback(async (type = 'audio') => {
    if (callState !== CALL_STATES.IDLE) return;
    setCallState(CALL_STATES.CALLING);
    setCallType(type);
    
    await sendCallSignal({ type: 'call-offer', callType: type });
    
    callTimeoutRef.current = setTimeout(() => {
      sendCallSignal({ type: 'call-cancel' });
      cleanupCall();
      onSystemMessage?.('No answer');
    }, 30000);
  }, [callState, sendCallSignal, cleanupCall, onSystemMessage]);

  const acceptCall = useCallback(async (incomingCallType) => {
    clearTimeout(callTimeoutRef.current);
    setCallState(CALL_STATES.CONNECTING);
    
    const pc = await createPeerConnection(incomingCallType, false);
    if (pc) {
      await sendCallSignal({ type: 'call-accept' });
    }
  }, [createPeerConnection, sendCallSignal]);

  const rejectCall = useCallback(async () => {
    await sendCallSignal({ type: 'call-reject' });
    cleanupCall();
  }, [sendCallSignal, cleanupCall]);

  const endCall = useCallback(async () => {
    await sendCallSignal({ type: 'call-end' });
    cleanupCall();
  }, [sendCallSignal, cleanupCall]);

  const handleCallSignal = useCallback(async (msg) => {
    if (!msg.__call) return false;

    switch (msg.type) {
      case 'call-offer':
        if (callState === CALL_STATES.IDLE) {
          setCallState(CALL_STATES.INCOMING);
          setCallType(msg.callType);
          clearTimeout(callTimeoutRef.current);
          callTimeoutRef.current = setTimeout(() => {
            sendCallSignal({ type: 'call-missed' });
            cleanupCall();
          }, 30000);
        }
        break;

      case 'call-accept': {
        clearTimeout(callTimeoutRef.current);
        setCallState(CALL_STATES.CONNECTING);
        
        const pc = await createPeerConnection(callType, true);
        if (!pc) break;
        
        const offer = await pc.createOffer();
        offer.sdp = optimizeSDP(offer.sdp);
        await pc.setLocalDescription(offer);
        await sendCallSignal({ type: 'call-sdp-offer', sdp: offer.sdp });
        break;
      }

      case 'call-sdp-offer': {
        const pc = peerConnectionRef.current;
        if (!pc) break;
        await pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp });
        const answer = await pc.createAnswer();
        answer.sdp = optimizeSDP(answer.sdp);
        await pc.setLocalDescription(answer);
        await sendCallSignal({ type: 'call-sdp-answer', sdp: answer.sdp });
        break;
      }

      case 'call-sdp-answer': {
        const pc = peerConnectionRef.current;
        if (pc) await pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp });
        break;
      }

      case 'call-ice': {
        const pc = peerConnectionRef.current;
        if (pc && msg.candidate) {
          await pc.addIceCandidate(msg.candidate).catch(() => {});
        }
        break;
      }

      case 'call-end':
      case 'call-reject':
      case 'call-cancel':
      case 'call-missed':
        cleanupCall();
        onSystemMessage?.(msg.type === 'call-reject' ? 'Call rejected' : msg.type === 'call-missed' ? 'Missed call' : 'Call ended');
        break;

      default:
        return false;
    }
    return true;
  }, [callState, callType, createPeerConnection, sendCallSignal, cleanupCall, onSystemMessage]);

  const toggleMute = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach(t => {
      t.enabled = !t.enabled;
    });
    setIsMuted(m => !m);
  }, []);

  const toggleVideo = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach(t => {
      t.enabled = !t.enabled;
    });
    setIsVideoOff(v => !v);
  }, []);

  useEffect(() => () => cleanupCall(), [cleanupCall]);

  return {
    callState, callType, isMuted, isVideoOff, quality,
    localStream: localStreamRef.current,
    remoteStream: remoteStreamRef.current,
    insertableStreamsSupported,
    startCall, acceptCall, rejectCall, endCall,
    toggleMute, toggleVideo,
    handleCallSignal,
    CALL_STATES,
  };
}
