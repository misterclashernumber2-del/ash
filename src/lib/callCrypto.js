export async function deriveCallKey(ecdhSharedKey) {
  const keyMaterial = await crypto.subtle.exportKey('raw', ecdhSharedKey);
  const callSalt = new TextEncoder().encode('ash-call-key-v1');
  
  const baseKey = await crypto.subtle.importKey('raw', keyMaterial, 'HKDF', false, ['deriveKey']);
  
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: callSalt, info: new Uint8Array() },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

let encryptFrameCounter = 0;

export function createEncryptTransform(callKey) {
  return new TransformStream({
    async transform(encodedFrame, controller) {
      const frameCounter = encryptFrameCounter++;
      
      const iv = new Uint8Array(12);
      new DataView(iv.buffer).setBigUint64(0, BigInt(frameCounter));
      
      const data = new Uint8Array(encodedFrame.data);
      
      const HEADER_SIZE = 3;
      const header = data.slice(0, HEADER_SIZE);
      const payload = data.slice(HEADER_SIZE);
      
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        callKey,
        payload
      );
      
      const newData = new ArrayBuffer(HEADER_SIZE + 8 + encrypted.byteLength);
      const view = new Uint8Array(newData);
      view.set(header, 0);
      new DataView(newData).setBigUint64(HEADER_SIZE, BigInt(frameCounter));
      view.set(new Uint8Array(encrypted), HEADER_SIZE + 8);
      
      encodedFrame.data = newData;
      controller.enqueue(encodedFrame);
    }
  });
}

export function createDecryptTransform(callKey) {
  return new TransformStream({
    async transform(encodedFrame, controller) {
      const HEADER_SIZE = 3;
      const data = new Uint8Array(encodedFrame.data);
      
      const header = data.slice(0, HEADER_SIZE);
      const frameCounter = new DataView(encodedFrame.data).getBigUint64(HEADER_SIZE);
      const encrypted = data.slice(HEADER_SIZE + 8);
      
      const iv = new Uint8Array(12);
      new DataView(iv.buffer).setBigUint64(0, frameCounter);
      
      try {
        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          callKey,
          encrypted
        );
        
        const newData = new ArrayBuffer(HEADER_SIZE + decrypted.byteLength);
        const view = new Uint8Array(newData);
        view.set(header, 0);
        view.set(new Uint8Array(decrypted), HEADER_SIZE);
        
        encodedFrame.data = newData;
        controller.enqueue(encodedFrame);
      } catch {
        // Drop corrupted frame
      }
    }
  });
}
