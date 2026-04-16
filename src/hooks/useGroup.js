import { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';
import { nanoid } from 'nanoid';

export function useGroup(groupId, isHost) {
  const [status, setStatus] = useState('initializing');
  const [peers, setPeers] = useState([]); // Array of connected peer IDs
  const [messages, setMessages] = useState([]);
  const peerRef = useRef(null);
  const connsRef = useRef({}); // Map of peerId -> DataConnection
  const myIdRef = useRef(null);

  const addMessage = useCallback((msg) => {
    setMessages(prev => {
      if (prev.some(m => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const id = isHost ? groupId : `g-${nanoid(10)}`;
        myIdRef.current = id;
        const peer = new Peer(id, {
          debug: 2,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' }
            ]
          }
        });
        peerRef.current = peer;

        peer.on('open', (peerId) => {
          if (!mounted) return;
          if (isHost) {
            setStatus('connected');
          } else {
            setStatus('connecting');
            connectToPeer(groupId);
          }
        });

        peer.on('connection', (conn) => {
          setupConnection(conn);
        });

        peer.on('error', (err) => {
          console.error('Peer error:', err);
          if (err.type === 'peer-unavailable' && !isHost) {
            setStatus('disconnected');
          }
        });
      } catch (err) {
        console.error('Failed to init group peer', err);
      }
    };

    init();

    return () => {
      mounted = false;
      Object.values(connsRef.current).forEach(c => c.close());
      peerRef.current?.destroy();
    };
  }, [groupId, isHost]);

  const setupConnection = useCallback((conn) => {
    conn.on('open', () => {
      connsRef.current[conn.peer] = conn;
      setPeers(Object.keys(connsRef.current));
      
      if (isHost) {
        // Send list of other peers to the new peer
        const otherPeers = Object.keys(connsRef.current).filter(p => p !== conn.peer);
        if (otherPeers.length > 0) {
          conn.send({ type: 'peer-list', peers: otherPeers });
        }
      }
    });

    conn.on('data', (data) => {
      if (data.type === 'peer-list') {
        // Connect to other peers in the mesh
        data.peers.forEach(p => {
          if (!connsRef.current[p] && p !== myIdRef.current) {
            connectToPeer(p);
          }
        });
      } else if (data.type === 'chat') {
        addMessage(data.message);
      }
    });

    conn.on('close', () => {
      delete connsRef.current[conn.peer];
      setPeers(Object.keys(connsRef.current));
    });
    
    conn.on('error', () => {
      delete connsRef.current[conn.peer];
      setPeers(Object.keys(connsRef.current));
    });
  }, [isHost, addMessage]);

  const connectToPeer = useCallback((targetId) => {
    if (!peerRef.current || connsRef.current[targetId]) return;
    const conn = peerRef.current.connect(targetId, { reliable: true });
    setupConnection(conn);
  }, [setupConnection]);

  const broadcastMessage = useCallback((text) => {
    const msg = {
      id: nanoid(),
      text,
      sender: myIdRef.current,
      ts: Date.now()
    };
    
    addMessage({ ...msg, fromMe: true });
    
    const payload = { type: 'chat', message: msg };
    Object.values(connsRef.current).forEach(conn => {
      if (conn.open) {
        conn.send(payload);
      }
    });
  }, [addMessage]);

  // Derived status for non-hosts
  const currentStatus = isHost ? status : (peers.length > 0 ? 'connected' : status);

  return { status: currentStatus, peers, messages, broadcastMessage, myId: myIdRef.current };
}
