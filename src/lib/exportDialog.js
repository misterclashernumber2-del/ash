/**
 * @file exportDialog.js
 * @description Экспорт и импорт диалогов с шифрованием PBKDF2/AES-GCM
 */

/**
 * Генерирует ключ из пароля
 * @param {string} password 
 * @param {Uint8Array} salt 
 * @returns {Promise<CryptoKey>}
 */
async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Экспортирует сообщения в зашифрованный файл
 * @param {Array} messages 
 * @param {string} roomId 
 * @param {string} password 
 * @returns {Promise<Blob>}
 */
export async function exportDialog(messages, roomId, password) {
  if (password.length < 8) throw new Error('Password must be at least 8 characters');

  // Подготавливаем данные (без тяжелых blob)
  const cleanMessages = messages.map(m => {
    const clean = {
      id: m.id,
      type: m.type,
      text: m.text,
      fromMe: m.fromMe,
      ts: m.ts,
      senderNick: m.senderNick
    };
    
    if (m.type === 'file') {
      clean.name = m.name;
      clean.mimeType = m.mimeType;
      // blob не сохраняем
    } else if (m.type === 'voice') {
      clean.duration = m.duration;
      // blob не сохраняем
    } else if (m.type === 'sticker') {
      clean.packId = m.packId;
      clean.stickerId = m.stickerId;
    }
    
    return clean;
  });

  const payload = {
    version: 1,
    exportedAt: Date.now(),
    roomId: roomId.split('_')[0], // только base id
    messages: cleanMessages
  };

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);

  const enc = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(JSON.stringify(payload))
  );

  // Конвертируем в base64 для сохранения в текстовый файл
  const bufferToBase64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  
  const exportData = {
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    data: bufferToBase64(encrypted)
  };

  return new Blob([JSON.stringify(exportData)], { type: 'text/plain' });
}

/**
 * Импортирует и расшифровывает диалог
 * @param {File} file 
 * @param {string} password 
 * @returns {Promise<Object>}
 */
export async function importDialog(file, password) {
  const text = await file.text();
  const exportData = JSON.parse(text);
  
  if (!exportData.salt || !exportData.iv || !exportData.data) {
    throw new Error('Invalid file format');
  }

  const base64ToBuffer = (b64) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  
  const salt = base64ToBuffer(exportData.salt);
  const iv = base64ToBuffer(exportData.iv);
  const encryptedData = base64ToBuffer(exportData.data);

  const key = await deriveKey(password, salt);

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedData
    );
    
    const dec = new TextDecoder();
    return JSON.parse(dec.decode(decrypted));
  } catch (e) {
    throw new Error('Incorrect password or corrupted file');
  }
}
