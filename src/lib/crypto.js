// AES-GCM Encryption using Web Crypto API
// Fast, hardware-accelerated, and minimal overhead (perfect for 2G)

const SALT = new TextEncoder().encode('ash-ephemeral-messenger-v1');

export async function deriveKey(roomId) {
  const enc = new TextEncoder();
  
  // Import the roomId as raw key material
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(roomId),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  // Derive a 256-bit AES-GCM key using PBKDF2
  // 100,000 iterations is a good balance between security and mobile performance
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: SALT,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
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

export async function encryptBuffer(key, buffer) {
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

export async function decryptBuffer(key, payload) {
  const iv = payload.slice(0, 12);
  const ciphertext = payload.slice(12);
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    ciphertext
  );
  return decrypted;
}
