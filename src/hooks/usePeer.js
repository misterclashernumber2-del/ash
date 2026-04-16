import { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';
import { supabase } from '../lib/supabase';
import { ICE_SERVERS } from '../lib/peerConfig';
import { 
  generateECDHKeyPair, 
  exportPublicKey, 
  deriveSharedSecret, 
  encryptPayload, 
  decryptPayload, 
  encryptChunk, 
  decryptChunk,
  generateFingerprint
} from '../lib/crypto';
import { compressImage } from '../lib/fileUtils';
import { nanoid } from 'nanoid';
import { toast } from 'sonner';

export function usePeer({ roomId, onMessage, onTransferProgress, onCallSignal, onPeerProfile, onStickerReq }) {
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
  const onCallSignalRef = useRef(onCallSignal);
  const onPeerProfileRef = useRef(onPeerProfile);
  const onStickerReqRef = useRef(onStickerReq);
  
  const [fingerprint, setFingerprint] = useState(null);
  const ecdhKeyPairRef = useRef(null);
  const cryptoKeyRef = useRef(null);
  const incomingFilesRef = useRef({});

  const setupConnectionRef = useRef(null);
  const handleDisconnectRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pubKeyIntervalRef = useRef(null);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onTransferProgressRef.current = onTransferProgress;
  }, [onTransferProgress]);

  useEffect(() => {
    onCallSignalRef.current = onCallSignal;
  }, [onCallSignal]);

  useEffect(() => {
    onPeerProfileRef.current = onPeerProfile;
  }, [onPeerProfile]);

  useEffect(() => {
    onStickerReqRef.current = onStickerReq;
  }, [onStickerReq]);

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
      channelRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    // Generate new ECDH key pair on reconnect for forward secrecy
    generateECDHKeyPair().then(keyPair => {
      ecdhKeyPairRef.current = keyPair;
      cryptoKeyRef.current = null;
      setFingerprint(null);
    }).catch(err => console.error('Failed to generate new ECDH key pair', err));

    const jitter = Math.random() * 1000;
    const delay = reconnectAttempts.current === 1 ? jitter : Math.min(1000 * Math.pow(2, reconnectAttempts.current - 1), 15000) + jitter;

    reconnectTimeoutRef.current = setTimeout(() => {
      if (!navigator.onLine) return;

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

    const connectionTimeout = setTimeout(() => {
      if (!conn.open) {
        console.warn('Connection timeout, forcing reconnect');
        conn.close();
        handleDisconnectRef.current();
      }
    }, 15000);

    const handleOpen = async () => {
      clearTimeout(connectionTimeout);
      setStatus('negotiating'); // New status for ECDH
      reconnectAttempts.current = 0;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      lastPong = Date.now();

      const sendPubKey = async () => {
        if (statusRef.current !== 'negotiating' || !conn.open) return;
        try {
          const pubKeyBytes = await exportPublicKey(ecdhKeyPairRef.current);
          const payload = new Uint8Array(1 + pubKeyBytes.byteLength);
          payload[0] = 2; // Type 2: ECDH Public Key
          payload.set(pubKeyBytes, 1);
          conn.send(payload);
        } catch (err) {
          console.error('Failed to export/send public key', err);
        }
      };

      sendPubKey();
      if (pubKeyIntervalRef.current) clearInterval(pubKeyIntervalRef.current);
      pubKeyIntervalRef.current = setInterval(sendPubKey, 2000);

      heartbeatInterval = setInterval(() => {
        if (conn.open) {
          conn.send(new Uint8Array([3])); // Type 3: Ping
          if (Date.now() - lastPong > 15000) {
            console.warn('P2P connection dead (ping timeout)');
            conn.close();
          }
        }
      }, 5000);
    };

    if (conn.open) {
      handleOpen();
    } else {
      conn.on('open', handleOpen);
    }

    conn.on('data', async (data) => {
      if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
        const buffer = new Uint8Array(data);
        const type = buffer[0];
        
        if (type === 3) { // Ping
          conn.send(new Uint8Array([4])); // Pong
          return;
        }
        if (type === 4) { // Pong
          lastPong = Date.now();
          return;
        }
        
        const sendProfile = async () => {
          const profile = JSON.parse(localStorage.getItem('ash_profile') || 'null');
          if (profile && cryptoKeyRef.current) {
            try {
              const msg = { __profile: true, nick: profile.nick, avatarEmoji: profile.avatarEmoji, color: profile.color };
              const encryptedPayload = await encryptPayload(cryptoKeyRef.current, JSON.stringify(msg));
              const payloadWithType = new Uint8Array(1 + encryptedPayload.byteLength);
              payloadWithType[0] = 0;
              payloadWithType.set(encryptedPayload, 1);
              conn.send(payloadWithType);
            } catch (err) {
              console.error('Failed to send profile', err);
            }
          }
        };

        if (type === 2) { // ECDH Public Key
          try {
            const remotePubKeyBytes = buffer.slice(1);
            const sharedSecret = await deriveSharedSecret(ecdhKeyPairRef.current.privateKey, remotePubKeyBytes);
            cryptoKeyRef.current = sharedSecret;
            
            const localPubKeyBytes = await exportPublicKey(ecdhKeyPairRef.current);
            const fp = await generateFingerprint(localPubKeyBytes, remotePubKeyBytes);
            setFingerprint(fp);
            
            setStatus('connected');
            if (pubKeyIntervalRef.current) clearInterval(pubKeyIntervalRef.current); // Stop sending pubkey
            
            // Send ACK to confirm key exchange
            conn.send(new Uint8Array([5])); // Type 5: ECDH ACK
            sendProfile();
          } catch (err) {
            console.error('Failed to derive shared secret', err);
          }
          return;
        }

        if (type === 5) { // ECDH ACK
          if (cryptoKeyRef.current) {
            setStatus('connected');
            if (pubKeyIntervalRef.current) clearInterval(pubKeyIntervalRef.current); // Stop sending pubkey
            sendProfile();
          }
          return;
        }

        if (cryptoKeyRef.current) {
          try {
            if (type === 0) { // JSON message
              const encryptedPayload = buffer.slice(1);
              const decryptedStr = await decryptPayload(cryptoKeyRef.current, encryptedPayload);
              const msg = JSON.parse(decryptedStr);
              
              if (msg.__call) {
                if (onCallSignalRef.current) onCallSignalRef.current(msg);
                return;
              }

              if (msg.__profile) {
                if (onPeerProfileRef.current) onPeerProfileRef.current(msg);
                return;
              }

              if (msg.__stickerReq) {
                if (onStickerReqRef.current) onStickerReqRef.current(msg.packId, msg.stickerId);
                return;
              }

              if (msg.type === 'file-start') {
                incomingFilesRef.current[msg.id] = {
                  chunks: {}, // Use object/map for sparse chunks
                  receivedChunks: 0,
                  metadata: msg
                };
              } else if (msg.type === 'file-end') {
                const fileData = incomingFilesRef.current[msg.id];
                if (fileData) {
                  if (fileData.receivedChunks !== fileData.metadata.totalChunks) {
                    console.error('Missing chunks, transfer failed');
                    delete incomingFilesRef.current[msg.id];
                    if (onTransferProgressRef.current) {
                      onTransferProgressRef.current(msg.id, 1, 'error');
                    }
                    toast.error(`Transfer failed: ${fileData.metadata.name}`);
                    return;
                  }

                  if (onTransferProgressRef.current) {
                    onTransferProgressRef.current(msg.id, 1, 'processing');
                  }
                  await new Promise(r => setTimeout(r, 50));

                  const chunksArray = [];
                  for (let i = 0; i < fileData.metadata.totalChunks; i++) {
                    chunksArray.push(fileData.chunks[i]);
                  }
                  
                  const blob = new Blob(chunksArray, { type: fileData.metadata.mimeType });
                  const url = URL.createObjectURL(blob);
                  
                  if (onMessageRef.current) {
                    onMessageRef.current({
                      id: msg.id,
                      type: fileData.metadata.messageType || 'file',
                      url,
                      mimeType: fileData.metadata.mimeType,
                      name: fileData.metadata.name,
                      text: fileData.metadata.caption,
                      duration: fileData.metadata.duration,
                      ts: Date.now()
                    });
                  }
                  delete incomingFilesRef.current[msg.id];
                  if (onTransferProgressRef.current) {
                    onTransferProgressRef.current(msg.id, 1, 'receiving');
                  }
                }
              } else if (msg.type === 'file-cancel') {
                cancelTransferRef.current[msg.id] = true;
                delete incomingFilesRef.current[msg.id];
                if (onTransferProgressRef.current) {
                  onTransferProgressRef.current(msg.id, 1, 'error');
                }
                toast.error('File transfer cancelled by peer');
              } else {
                if (onMessageRef.current) onMessageRef.current(msg);
              }
            } else if (type === 1) { // File chunk
              const idBytes = buffer.slice(1, 22);
              const fileId = new TextDecoder().decode(idBytes).trim();
              const index = new DataView(buffer.buffer, buffer.byteOffset + 22, 4).getUint32(0, true);
              const encryptedChunk = buffer.slice(26);
              
              const aad = buffer.slice(1, 26); // fileId + index
              
              const fileData = incomingFilesRef.current[fileId];
              if (fileData && index < fileData.metadata.totalChunks) {
                try {
                  const decryptedChunk = await decryptChunk(cryptoKeyRef.current, encryptedChunk, aad);
                  if (!fileData.chunks[index]) {
                    fileData.chunks[index] = decryptedChunk;
                    fileData.receivedChunks++;
                    
                    if (onTransferProgressRef.current) {
                      onTransferProgressRef.current(fileId, fileData.receivedChunks / fileData.metadata.totalChunks, 'receiving');
                    }
                  }
                } catch (err) {
                  console.error('Failed to decrypt chunk', err);
                }
              }
            }
          } catch (err) {
            console.error('Data processing error:', err);
          }
        }
      }
    });

    conn.on('close', () => {
      clearInterval(heartbeatInterval);
      if (pubKeyIntervalRef.current) clearInterval(pubKeyIntervalRef.current);
      clearTimeout(connectionTimeout);
      handleDisconnectRef.current();
    });

    conn.on('error', (err) => {
      console.error('Connection error:', err);
      clearInterval(heartbeatInterval);
      if (pubKeyIntervalRef.current) clearInterval(pubKeyIntervalRef.current);
      clearTimeout(connectionTimeout);
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

    let mounted = true;

    const init = async () => {
      try {
        const keyPair = await generateECDHKeyPair();
        if (!mounted) return;
        ecdhKeyPairRef.current = keyPair;

        const peerId = `${roomId}-${nanoid(7)}`;
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

      } catch (err) {
        console.error("Init failed", err);
      }
    };

    init();

    return () => {
      mounted = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pubKeyIntervalRef.current) clearInterval(pubKeyIntervalRef.current);
      connRef.current?.close();
      peerRef.current?.destroy();
      channelRef.current?.unsubscribe();
    };
  }, [roomId]);

  const sendMessage = useCallback(async (payload, type = 'text') => {
    if (connRef.current && statusRef.current === 'connected' && cryptoKeyRef.current) {
      const msg = { 
        id: nanoid(), 
        type, 
        ts: Date.now(),
        ...(typeof payload === 'object' ? payload : { text: payload })
      };
      // Ensure type is not overwritten if it's passed in payload
      if (typeof payload === 'object' && payload.type) {
        msg.type = payload.type;
      }
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

  const sendTyping = useCallback(async (isTyping) => {
    if (connRef.current && statusRef.current === 'connected' && cryptoKeyRef.current) {
      try {
        const msg = { type: 'typing', isTyping };
        const encryptedPayload = await encryptPayload(cryptoKeyRef.current, JSON.stringify(msg));
        const payloadWithType = new Uint8Array(1 + encryptedPayload.byteLength);
        payloadWithType[0] = 0;
        payloadWithType.set(encryptedPayload, 1);
        connRef.current.send(payloadWithType);
      } catch (err) {
        // Ignore typing errors
      }
    }
  }, []);

  const sendStatus = useCallback(async (messageId, status) => {
    if (connRef.current && statusRef.current === 'connected' && cryptoKeyRef.current) {
      try {
        const msg = { type: 'status', messageId, status };
        const encryptedPayload = await encryptPayload(cryptoKeyRef.current, JSON.stringify(msg));
        const payloadWithType = new Uint8Array(1 + encryptedPayload.byteLength);
        payloadWithType[0] = 0;
        payloadWithType.set(encryptedPayload, 1);
        connRef.current.send(payloadWithType);
      } catch (err) {
        console.error('Failed to send status', err);
      }
    }
  }, []);

  const sendReaction = useCallback(async (messageId, reaction, action) => {
    if (connRef.current && statusRef.current === 'connected' && cryptoKeyRef.current) {
      try {
        const msg = { type: 'reaction', messageId, reaction, action };
        const encryptedPayload = await encryptPayload(cryptoKeyRef.current, JSON.stringify(msg));
        const payloadWithType = new Uint8Array(1 + encryptedPayload.byteLength);
        payloadWithType[0] = 0;
        payloadWithType.set(encryptedPayload, 1);
        connRef.current.send(payloadWithType);
      } catch (err) {
        console.error('Failed to send reaction', err);
      }
    }
  }, []);

  const sendSettingsSignal = useCallback(async (signalType, settings) => {
    if (connRef.current && statusRef.current === 'connected' && cryptoKeyRef.current) {
      try {
        const msg = { type: signalType, settings };
        const encryptedPayload = await encryptPayload(cryptoKeyRef.current, JSON.stringify(msg));
        const payloadWithType = new Uint8Array(1 + encryptedPayload.byteLength);
        payloadWithType[0] = 0;
        payloadWithType.set(encryptedPayload, 1);
        connRef.current.send(payloadWithType);
      } catch (err) {
        console.error('Failed to send settings signal', err);
      }
    }
  }, []);

  const cancelTransferRef = useRef({});

  const cancelTransfer = useCallback(async (id) => {
    cancelTransferRef.current[id] = true;
    if (connRef.current && statusRef.current === 'connected' && cryptoKeyRef.current) {
      try {
        const cancelMsg = { type: 'file-cancel', id };
        const encCancel = await encryptPayload(cryptoKeyRef.current, JSON.stringify(cancelMsg));
        const cancelPayload = new Uint8Array(1 + encCancel.byteLength);
        cancelPayload[0] = 0;
        cancelPayload.set(encCancel, 1);
        connRef.current.send(cancelPayload);
      } catch (err) {
        console.error('Failed to send cancel message', err);
      }
    }
  }, []);

  const sendFile = useCallback(async (file, qualityMode = 'original', caption = '', messageType = 'file', duration = 0) => {
    if (!connRef.current || statusRef.current !== 'connected' || !cryptoKeyRef.current) return null;
    
    let fileId;
    try {
      fileId = nanoid();
      if (onTransferProgressRef.current) {
        onTransferProgressRef.current(fileId, 0, 'processing');
      }

      await new Promise(r => setTimeout(r, 50));

      let processedFile = file;
      const isImage = file.type.startsWith('image/') || file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i);
      if (isImage && qualityMode !== 'original') {
        processedFile = await compressImage(file, qualityMode);
      }
      
      const CHUNK_SIZE = 64 * 1024; // 64KB chunks before encryption
      const MAX_BUFFER = 1024 * 1024; // 1MB
      const totalChunks = Math.ceil(processedFile.size / CHUNK_SIZE);
      
      const startMsg = { type: 'file-start', id: fileId, name: file.name, size: processedFile.size, totalChunks, mimeType: processedFile.type, caption, messageType, duration };
      const encStart = await encryptPayload(cryptoKeyRef.current, JSON.stringify(startMsg));
      
      const startPayload = new Uint8Array(1 + encStart.byteLength);
      startPayload[0] = 0;
      startPayload.set(encStart, 1);
      connRef.current.send(startPayload);
      
      const idBytes = new TextEncoder().encode(fileId.padEnd(21, ' '));
      
      for (let i = 0; i < totalChunks; i++) {
        if (statusRef.current !== 'connected') {
          throw new Error('Connection lost during transfer');
        }
        if (cancelTransferRef.current[fileId]) {
          delete cancelTransferRef.current[fileId];
          throw new Error('Transfer cancelled');
        }
        
        const dataChannel = connRef.current.dataChannel;
        if (dataChannel) {
          let waitCount = 0;
          while (dataChannel.bufferedAmount > MAX_BUFFER) {
            if (statusRef.current !== 'connected') throw new Error('Connection lost');
            await new Promise(r => setTimeout(r, 50));
            waitCount++;
            if (waitCount > 600) { // 30 seconds timeout
              throw new Error('Transfer timeout');
            }
          }
        } else {
          if (i % 16 === 0) await new Promise(r => setTimeout(r, 10));
        }
        
        const header = new Uint8Array(1 + 21 + 4);
        header[0] = 1;
        header.set(idBytes, 1);
        new DataView(header.buffer).setUint32(22, i, true);
        
        const aad = header.slice(1);
        const chunkBlob = processedFile.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const chunkBuffer = await chunkBlob.arrayBuffer();
        const encryptedChunk = await encryptChunk(cryptoKeyRef.current, chunkBuffer, aad);
        
        const chunkPayload = new Uint8Array(header.length + encryptedChunk.byteLength);
        chunkPayload.set(header, 0);
        chunkPayload.set(encryptedChunk, header.length);
        
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
      if (fileId && onTransferProgressRef.current) {
        onTransferProgressRef.current(fileId, 1, 'error');
      }
      toast.error(err.message === 'Transfer cancelled' ? 'Transfer cancelled' : 'Failed to send file');
      return null;
    }
  }, []);

  const sendProfile = useCallback(async (profile) => {
    if (connRef.current && statusRef.current === 'connected' && cryptoKeyRef.current) {
      try {
        const msg = { __profile: true, nick: profile.nick, avatarEmoji: profile.avatarEmoji, color: profile.color };
        const encryptedPayload = await encryptPayload(cryptoKeyRef.current, JSON.stringify(msg));
        const payloadWithType = new Uint8Array(1 + encryptedPayload.byteLength);
        payloadWithType[0] = 0;
        payloadWithType.set(encryptedPayload, 1);
        connRef.current.send(payloadWithType);
      } catch (err) {
        console.error('Failed to send profile', err);
      }
    }
  }, []);

  const manualConnect = useCallback(() => {
    if (remotePeerIdRef.current && peerRef.current && (!connRef.current || !connRef.current.open)) {
      const conn = peerRef.current.connect(remotePeerIdRef.current, { reliable: true });
      setupConnectionRef.current(conn);
    }
  }, []);

  return { status, fingerprint, sendMessage, sendFile, sendTyping, sendSettingsSignal, cancelTransfer, sendProfile, sendReaction, sendStatus, manualConnect, connRef, cryptoKeyRef };
}
