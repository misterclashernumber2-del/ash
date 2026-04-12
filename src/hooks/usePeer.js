import { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';
import { supabase } from '../lib/supabase';
import { ICE_SERVERS } from '../lib/peerConfig';
import { nanoid } from 'nanoid';

export function usePeer({ roomId, onMessage }) {
  const [status, setStatus] = useState('waiting');
  const [remotePeerId, setRemotePeerId] = useState(null);
  const peerRef = useRef(null);
  const connRef = useRef(null);
  const channelRef = useRef(null);
  const localIdRef = useRef(null);
  const reconnectAttempts = useRef(0);

  const setupConnection = useCallback((conn) => {
    connRef.current = conn;

    conn.on('open', () => {
      setStatus('connected');
      reconnectAttempts.current = 0;
      channelRef.current?.unsubscribe();
    });

    conn.on('data', (data) => {
      if (onMessage) onMessage(data);
    });

    conn.on('close', () => {
      handleDisconnect();
    });

    conn.on('error', (err) => {
      console.error('Connection error:', err);
      handleDisconnect();
    });
  }, [onMessage, roomId]);

  const handleDisconnect = useCallback(() => {
    if (reconnectAttempts.current >= 1) {
      setStatus('disconnected');
      return;
    }
    setStatus('reconnecting');
    reconnectAttempts.current += 1;

    const newChannel = supabase.channel(`room:${roomId}`);
    channelRef.current = newChannel;
    
    newChannel.on('broadcast', { event: 'announce' }, ({ payload }) => {
      if (payload.peerId !== localIdRef.current && (!connRef.current || !connRef.current.open)) {
        setRemotePeerId(payload.peerId);
        if (localIdRef.current < payload.peerId) {
          const conn = peerRef.current.connect(payload.peerId, { reliable: true });
          setupConnection(conn);
        }
      }
    }).subscribe(async (subStatus) => {
      if (subStatus === 'SUBSCRIBED') {
        newChannel.send({
          type: 'broadcast',
          event: 'announce',
          payload: { peerId: localIdRef.current },
        });
        setTimeout(() => {
          if (!connRef.current?.open) setStatus('disconnected');
        }, 5000);
      }
    });
  }, [roomId, setupConnection]);

  useEffect(() => {
    if (!roomId) return;

    const peerId = `${roomId}-${Math.random().toString(36).slice(2, 7)}`;
    localIdRef.current = peerId;
    const peer = new Peer(peerId, { config: ICE_SERVERS });
    peerRef.current = peer;

    const channel = supabase.channel(`room:${roomId}`);
    channelRef.current = channel;

    peer.on('open', (id) => {
      channel
        .on('broadcast', { event: 'announce' }, ({ payload }) => {
          if (payload.peerId !== id && (!connRef.current || !connRef.current.open)) {
            setRemotePeerId(payload.peerId);
            setStatus('connecting');
            if (id < payload.peerId) {
              const conn = peer.connect(payload.peerId, { reliable: true });
              setupConnection(conn);
            }
          }
        })
        .subscribe(async (subStatus) => {
          if (subStatus === 'SUBSCRIBED') {
            channel.send({
              type: 'broadcast',
              event: 'announce',
              payload: { peerId: id },
            });
          }
        });
    });

    peer.on('connection', (conn) => {
      if (!connRef.current || !connRef.current.open) {
        setStatus('connecting');
        setRemotePeerId(conn.peer);
        setupConnection(conn);
      } else {
        conn.close();
      }
    });

    return () => {
      connRef.current?.close();
      peerRef.current?.destroy();
      channelRef.current?.unsubscribe();
    };
  }, [roomId, setupConnection]);

  const sendMessage = useCallback((text) => {
    if (connRef.current && status === 'connected') {
      const msg = { id: nanoid(), text, ts: Date.now() };
      connRef.current.send(msg);
      return msg;
    }
    return null;
  }, [status]);

  const manualConnect = useCallback(() => {
    if (remotePeerId && peerRef.current && (!connRef.current || !connRef.current.open)) {
      const conn = peerRef.current.connect(remotePeerId, { reliable: true });
      setupConnection(conn);
    }
  }, [remotePeerId, setupConnection]);

  return { status, sendMessage, manualConnect };
}
