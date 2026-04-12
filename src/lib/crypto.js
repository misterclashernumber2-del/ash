// AES-GCM Encryption using Web Crypto API
// Fast, hardware-accelerated, and minimal overhead (perfect for 2G)

export async function generateECDHKeyPair() {
  return await window.crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
}

export async function exportPublicKey(keyPair) {
  const exported = await window.crypto.subtle.exportKey('raw', keyPair.publicKey);
  return new Uint8Array(exported);
}

export async function deriveSharedSecret(privateKey, publicKeyBytes) {
  const publicKey = await window.crypto.subtle.importKey(
    'raw',
    publicKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
  
  return await window.crypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptPayload(key, text) {
  // 12-byte IV is standard for AES-GCM
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    enc.encode(text)
  );
  
  // Combine IV and Ciphertext into a single Uint8Array
  // Sending raw binary instead of Base64 saves ~33% bandwidth (crucial for 2G)
  const payload = new Uint8Array(iv.length + ciphertext.byteLength);
  payload.set(iv, 0);
  payload.set(new Uint8Array(ciphertext), iv.length);
  
  return payload;
}

export async function decryptPayload(key, payload) {
  // Extract the 12-byte IV
  const iv = payload.slice(0, 12);
  // Extract the ciphertext
  const ciphertext = payload.slice(12);
  
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    ciphertext
  );
  
  const dec = new TextDecoder();
  return dec.decode(decrypted);
}

export async function encryptChunk(key, buffer) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    buffer
  );
  const payload = new Uint8Array(iv.length + ciphertext.byteLength);
  payload.set(iv, 0);
  payload.set(new Uint8Array(ciphertext), iv.length);
  return payload;
}

export async function decryptChunk(key, payload) {
  const iv = payload.slice(0, 12);
  const ciphertext = payload.slice(12);
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    ciphertext
  );
  return decrypted;
}
