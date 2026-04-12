import { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';
import { supabase } from '../lib/supabase';
import { ICE_SERVERS } from '../lib/peerConfig';
import { deriveKey, encryptPayload, decryptPayload, encryptBuffer, decryptBuffer } from '../lib/crypto';
import { compressImage } from '../lib/fileUtils';
import { nanoid } from 'nanoid';

export function usePeer({ roomId, onMessage, onTransferProgress }) {
  const [status, setStatusState] = useState('waiting');
  const statusRef = useRef('waiting');
  const setStatus = (s) => {
    statusRef.current = s;
    setStatusState(s);
  };

  const [remotePeerId, setRemotePeerId] = useState(null);
  const peerRef = useRef(null);
  const connRef = useRef(null);
  const channelRef = useRef(null);
  const localIdRef = useRef(null);
  const remotePeerIdRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const onMessageRef = useRef(onMessage);
  const onTransferProgressRef = useRef(onTransferProgress);
  const cryptoKeyRef = useRef(null);
  const incomingFilesRef = useRef({});

  const setupConnectionRef = useRef(null);
  const handleDisconnectRef = useRef(null);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onTransferProgressRef.current = onTransferProgress;
  }, [onTransferProgress]);

  const setRemoteId = (id) => {
    remotePeerIdRef.current = id;
    setRemotePeerId(id);
  };

  handleDisconnectRef.current = () => {
    if (reconnectAttempts.current >= 5) {
      setStatus('disconnected');
      return;
    }
    setStatus('reconnecting');
    reconnectAttempts.current += 1;

    if (channelRef.current) {
      channelRef.current.unsubscribe();
    }

    // Exponential backoff: 0s, 2s, 4s, 8s, 15s
    const delay = reconnectAttempts.current === 1 ? 0 : Math.min(1000 * Math.pow(2, reconnectAttempts.current - 1), 15000);

    setTimeout(() => {
      if (!navigator.onLine) return; // Wait for online event

      const newChannel = supabase.channel(`room:${roomId}`);
      channelRef.current = newChannel;
      
      newChannel.on('broadcast', { event: 'announce' }, ({ payload }) => {
        if (payload.peerId !== localIdRef.current && (!connRef.current || !connRef.current.open)) {
          setRemoteId(payload.peerId);
          setStatus('connecting');
          if (localIdRef.current < payload.peerId) {
            const conn = peerRef.current.connect(payload.peerId, { reliable: true });
            setupConnectionRef.current(conn);
          }
          
          setTimeout(() => {
            if (statusRef.current === 'connecting') {
              handleDisconnectRef.current();
            }
          }, 30000); // 30s timeout for 2G networks
        }
      }).subscribe(async (subStatus) => {
        if (subStatus === 'SUBSCRIBED') {
          newChannel.send({
            type: 'broadcast',
            event: 'announce',
            payload: { peerId: localIdRef.current },
          });
        }
      });
    }, delay);
  };

  setupConnectionRef.current = (conn) => {
    connRef.current = conn;
    let heartbeatInterval;
    let lastPong = Date.now();

    conn.on('open', () => {
      setStatus('connected');
      reconnectAttempts.current = 0;
      channelRef.current?.unsubscribe();
      lastPong = Date.now();

      // Heartbeat to keep NAT bindings alive on mobile/2G
      heartbeatInterval = setInterval(() => {
        if (conn.open) {
          conn.send({ __type: 'ping' });
          if (Date.now() - lastPong > 15000) {
            console.warn('P2P connection dead (ping timeout)');
            conn.close();
          }
        }
      }, 5000);
    });

    conn.on('data', async (data) => {
      if (data && data.__type === 'ping') {
        conn.send({ __type: 'pong' });
        return;
      }
      if (data && data.__type === 'pong') {
        lastPong = Date.now();
        return;
      }
      
      if (cryptoKeyRef.current) {
        try {
          if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
            const buffer = new Uint8Array(data);
            const type = buffer[0];
            
            if (type === 0) {
              // JSON message
              const encryptedPayload = buffer.slice(1);
              const decryptedStr = await decryptPayload(cryptoKeyRef.current, encryptedPayload);
              const msg = JSON.parse(decryptedStr);
              
              if (msg.type === 'file-start') {
                incomingFilesRef.current[msg.id] = {
                  chunks: new Array(msg.totalChunks),
                  receivedChunks: 0,
                  metadata: msg
                };
              } else if (msg.type === 'file-end') {
                const fileData = incomingFilesRef.current[msg.id];
                if (fileData) {
                  if (onTransferProgressRef.current) {
                    onTransferProgressRef.current(msg.id, 1, 'processing');
                  }
                  // Yield to allow UI to render processing state
                  await new Promise(r => setTimeout(r, 50));

                  const totalLength = fileData.chunks.reduce((acc, chunk) => acc + chunk.length, 0);
                  const encryptedFile = new Uint8Array(totalLength);
                  let offset = 0;
                  for (const chunk of fileData.chunks) {
                    encryptedFile.set(chunk, offset);
                    offset += chunk.length;
                  }
                  
                  try {
                    const decryptedBuffer = await decryptBuffer(cryptoKeyRef.current, encryptedFile);
                    const blob = new Blob([decryptedBuffer], { type: fileData.metadata.mimeType });
                    const url = URL.createObjectURL(blob);
                    
                    if (onMessageRef.current) {
                      onMessageRef.current({
                        id: msg.id,
                        type: 'file',
                        url,
                        mimeType: fileData.metadata.mimeType,
                        name: fileData.metadata.name,
                        text: fileData.metadata.caption,
                        ts: Date.now()
                      });
                    }
                  } catch (err) {
                    console.error('File decryption failed', err);
                  }
                  delete incomingFilesRef.current[msg.id];
                  if (onTransferProgressRef.current) {
                    onTransferProgressRef.current(msg.id, 1, 'receiving');
                  }
                }
              } else {
                if (onMessageRef.current) onMessageRef.current(msg);
              }
            } else if (type === 1) {
              // File chunk
              const idBytes = buffer.slice(1, 22);
              const fileId = new TextDecoder().decode(idBytes).trim();
              const index = new DataView(buffer.buffer, buffer.byteOffset + 22, 4).getUint32(0, true);
              const chunkData = buffer.slice(26);
              
              const fileData = incomingFilesRef.current[fileId];
              if (fileData) {
                fileData.chunks[index] = chunkData;
                fileData.receivedChunks++;
                
                if (onTransferProgressRef.current) {
                  onTransferProgressRef.current(fileId, fileData.receivedChunks / fileData.metadata.totalChunks, 'receiving');
                }
              }
            }
          }
        } catch (err) {
          console.error('Data processing error:', err);
        }
      }
    });

    conn.on('close', () => {
      clearInterval(heartbeatInterval);
      handleDisconnectRef.current();
    });

    conn.on('error', (err) => {
      console.error('Connection error:', err);
      clearInterval(heartbeatInterval);
      handleDisconnectRef.current();
    });
  };

  useEffect(() => {
    const handleOnline = () => {
      if (statusRef.current === 'disconnected' || statusRef.current === 'reconnecting') {
        reconnectAttempts.current = 0;
        handleDisconnectRef.current();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  useEffect(() => {
    if (!roomId) return;

    // Derive E2EE key asynchronously
    deriveKey(roomId)
      .then(key => {
        cryptoKeyRef.current = key;
      })
      .catch(err => console.error("Key derivation failed", err));

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
            setRemoteId(payload.peerId);
            setStatus('connecting');
            if (id < payload.peerId) {
              const conn = peer.connect(payload.peerId, { reliable: true });
              setupConnectionRef.current(conn);
            }
            
            setTimeout(() => {
              if (statusRef.current === 'connecting') {
                handleDisconnectRef.current();
              }
            }, 30000); // 30s timeout for 2G networks
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
      if (remotePeerIdRef.current && localIdRef.current < remotePeerIdRef.current) {
        conn.close();
        return;
      }
      if (!connRef.current || !connRef.current.open) {
        setStatus('connecting');
        setRemoteId(conn.peer);
        setupConnectionRef.current(conn);
      } else {
        conn.close();
      }
    });

    return () => {
      connRef.current?.close();
      peerRef.current?.destroy();
      channelRef.current?.unsubscribe();
    };
  }, [roomId]);

  const sendMessage = useCallback(async (text) => {
    if (connRef.current && statusRef.current === 'connected' && cryptoKeyRef.current) {
      const msg = { id: nanoid(), text, ts: Date.now() };
      try {
        const encryptedPayload = await encryptPayload(cryptoKeyRef.current, JSON.stringify(msg));
        const payloadWithType = new Uint8Array(1 + encryptedPayload.byteLength);
        payloadWithType[0] = 0;
        payloadWithType.set(encryptedPayload, 1);
        connRef.current.send(payloadWithType);
        return msg;
      } catch (err) {
        console.error('Encryption error:', err);
        return null;
      }
    }
    return null;
  }, []);

  const sendFile = useCallback(async (file, qualityMode = 'original', caption = '') => {
    if (!connRef.current || statusRef.current !== 'connected' || !cryptoKeyRef.current) return null;
    
    try {
      const fileId = nanoid();
      if (onTransferProgressRef.current) {
        onTransferProgressRef.current(fileId, 0, 'processing');
      }

      // Yield to allow UI to render processing state
      await new Promise(r => setTimeout(r, 50));

      let processedFile = file;
      const isImage = file.type.startsWith('image/') || file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i);
      if (isImage && qualityMode !== 'original') {
        processedFile = await compressImage(file, qualityMode);
      }
      
      const buffer = await processedFile.arrayBuffer();
      const encryptedPayload = await encryptBuffer(cryptoKeyRef.current, buffer);
      
      // Reduce chunk size to 16KB to prevent WebRTC message size limits from dropping connection
      const CHUNK_SIZE = 16 * 1024;
      const MAX_BUFFER = 256 * 1024;
      const totalChunks = Math.ceil(encryptedPayload.byteLength / CHUNK_SIZE);
      
      const startMsg = { type: 'file-start', id: fileId, name: file.name, size: encryptedPayload.byteLength, totalChunks, mimeType: processedFile.type, caption };
      const encStart = await encryptPayload(cryptoKeyRef.current, JSON.stringify(startMsg));
      
      const startPayload = new Uint8Array(1 + encStart.byteLength);
      startPayload[0] = 0;
      startPayload.set(encStart, 1);
      connRef.current.send(startPayload);
      
      const idBytes = new TextEncoder().encode(fileId.padEnd(21, ' '));
      
      for (let i = 0; i < totalChunks; i++) {
        const dataChannel = connRef.current.dataChannel;
        if (dataChannel) {
          while (dataChannel.bufferedAmount > MAX_BUFFER) {
            await new Promise(r => setTimeout(r, 50));
          }
        } else {
          // Fallback if dataChannel is not exposed
          if (i % 16 === 0) await new Promise(r => setTimeout(r, 10));
        }
        
        const chunk = encryptedPayload.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const header = new Uint8Array(1 + 21 + 4);
        header[0] = 1;
        header.set(idBytes, 1);
        new DataView(header.buffer).setUint32(22, i, true);
        
        const chunkPayload = new Uint8Array(header.length + chunk.byteLength);
        chunkPayload.set(header, 0);
        chunkPayload.set(chunk, header.length);
        
        connRef.current.send(chunkPayload);
        
        if (onTransferProgressRef.current) {
          onTransferProgressRef.current(fileId, (i + 1) / totalChunks, 'sending');
        }
      }
      
      const endMsg = { type: 'file-end', id: fileId };
      const encEnd = await encryptPayload(cryptoKeyRef.current, JSON.stringify(endMsg));
      const endPayload = new Uint8Array(1 + encEnd.byteLength);
      endPayload[0] = 0;
      endPayload.set(encEnd, 1);
      connRef.current.send(endPayload);
      
      return { 
        id: fileId, 
        type: 'file', 
        url: URL.createObjectURL(processedFile), 
        mimeType: processedFile.type, 
        name: file.name,
        text: caption,
        ts: Date.now()
      };
    } catch (err) {
      console.error('File send error:', err);
      return null;
    }
  }, []);

  const manualConnect = useCallback(() => {
    if (remotePeerIdRef.current && peerRef.current && (!connRef.current || !connRef.current.open)) {
      const conn = peerRef.current.connect(remotePeerIdRef.current, { reliable: true });
      setupConnectionRef.current(conn);
    }
  }, []);

  return { status, sendMessage, sendFile, manualConnect };
}
