/**
 * @file stickerStorage.js
 * @description Управление хранилищем стикеров через IndexedDB
 */

const DB_NAME = 'ash-stickers';
const DB_VERSION = 1;

/**
 * Открывает или создает базу данных IndexedDB
 * @returns {Promise<IDBDatabase>}
 */
export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('packs')) {
        db.createObjectStore('packs', { keyPath: 'packId' });
      }
      if (!db.objectStoreNames.contains('stickers')) {
        const stickerStore = db.createObjectStore('stickers', { keyPath: 'id' });
        stickerStore.createIndex('packId', 'packId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Создает новый пак стикеров
 * @param {string} name Название пака
 * @returns {Promise<string>} packId
 */
export async function createPack(name) {
  const db = await openDB();
  const packId = Math.random().toString(36).substring(2, 10);
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('packs', 'readwrite');
    const store = tx.objectStore('packs');
    store.put({
      packId,
      name,
      createdAt: Date.now(),
      stickerCount: 0
    });
    tx.oncomplete = () => resolve(packId);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Генерирует миниатюру для стикера
 * @param {File|Blob} file 
 * @returns {Promise<Blob>}
 */
async function generateThumbnail(file) {
  const img = new Image();
  const url = URL.createObjectURL(file);
  
  return new Promise((resolve, reject) => {
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');
      
      // Object-fit: contain
      const scale = Math.min(100 / img.width, 100 / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (100 - w) / 2;
      const y = (100 - h) / 2;
      
      ctx.drawImage(img, x, y, w, h);
      canvas.toBlob(blob => resolve(blob), 'image/webp', 0.7);
    };
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Добавляет стикер в пак
 * @param {string} packId 
 * @param {File} imageFile 
 * @returns {Promise<string>} stickerId
 */
export async function addSticker(packId, imageFile) {
  const db = await openDB();
  const thumbnailBlob = await generateThumbnail(imageFile);
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['packs', 'stickers'], 'readwrite');
    const packsStore = tx.objectStore('packs');
    const stickersStore = tx.objectStore('stickers');
    
    packsStore.get(packId).onsuccess = (e) => {
      const pack = e.target.result;
      if (!pack) return reject(new Error('Pack not found'));
      
      const idx = pack.stickerCount;
      const stickerId = `${packId}_${idx}`;
      
      stickersStore.put({
        id: stickerId,
        packId,
        blob: imageFile,
        mimeType: imageFile.type,
        thumbnailBlob
      });
      
      pack.stickerCount++;
      packsStore.put(pack);
      
      tx.oncomplete = () => resolve(stickerId);
      tx.onerror = () => reject(tx.error);
    };
  });
}

/**
 * Получает все стикеры пака
 * @param {string} packId 
 * @returns {Promise<Array>}
 */
export async function getPackStickers(packId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('stickers', 'readonly');
    const store = tx.objectStore('stickers');
    const index = store.index('packId');
    const request = index.getAll(packId);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Получает список всех паков
 * @returns {Promise<Array>}
 */
export async function getAllPacks() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('packs', 'readonly');
    const store = tx.objectStore('packs');
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result.sort((a, b) => b.createdAt - a.createdAt));
    request.onerror = () => reject(request.error);
  });
}

/**
 * Удаляет пак и все его стикеры
 * @param {string} packId 
 * @returns {Promise<void>}
 */
export async function deletePack(packId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['packs', 'stickers'], 'readwrite');
    tx.objectStore('packs').delete(packId);
    
    const stickersStore = tx.objectStore('stickers');
    const index = stickersStore.index('packId');
    index.getAllKeys(packId).onsuccess = (e) => {
      e.target.result.forEach(key => stickersStore.delete(key));
    };
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Получает blob конкретного стикера
 * @param {string} id 
 * @returns {Promise<Blob|null>}
 */
export async function getStickerBlob(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('stickers', 'readonly');
    const store = tx.objectStore('stickers');
    const request = store.get(id);
    
    request.onsuccess = () => resolve(request.result ? request.result.blob : null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Сохраняет полученный по сети стикер
 * @param {string} packId 
 * @param {string} stickerId 
 * @param {Blob} blob 
 */
export async function saveReceivedSticker(packId, stickerId, blob) {
  const db = await openDB();
  const thumbnailBlob = await generateThumbnail(blob);
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['packs', 'stickers'], 'readwrite');
    const packsStore = tx.objectStore('packs');
    const stickersStore = tx.objectStore('stickers');
    
    packsStore.get(packId).onsuccess = (e) => {
      let pack = e.target.result;
      if (!pack) {
        pack = { packId, name: 'Downloaded Pack', createdAt: Date.now(), stickerCount: 1 };
      } else {
        pack.stickerCount++;
      }
      packsStore.put(pack);
      
      stickersStore.put({
        id: stickerId,
        packId,
        blob,
        mimeType: blob.type,
        thumbnailBlob
      });
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
  });
}
