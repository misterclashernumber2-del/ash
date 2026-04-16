/**
 * @file musicStorage.js
 * @description Управление хранилищем музыки через IndexedDB
 */

const DB_NAME = 'ash-music';
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
      if (!db.objectStoreNames.contains('tracks')) {
        db.createObjectStore('tracks', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Извлекает базовые метаданные из аудио файла
 * @param {File} file 
 * @returns {Promise<Object>}
 */
async function extractMetadata(file) {
  // Базовое извлечение без тяжелых библиотек
  let name = file.name.replace(/\.[^/.]+$/, ""); // Убираем расширение
  let artist = 'Unknown Artist';
  let duration = 0;

  try {
    // Пытаемся получить длительность через Audio элемент
    duration = await new Promise((resolve) => {
      const audio = new Audio();
      const url = URL.createObjectURL(file);
      audio.onloadedmetadata = () => {
        resolve(audio.duration);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        resolve(0);
        URL.revokeObjectURL(url);
      };
      audio.src = url;
    });
  } catch (e) {
    console.warn('Failed to extract duration', e);
  }

  return { name, artist, duration };
}

/**
 * Добавляет трек в хранилище
 * @param {File} file 
 * @returns {Promise<Object>} Добавленный трек (без blob)
 */
export async function addTrack(file) {
  const db = await openDB();
  const id = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  const metadata = await extractMetadata(file);
  
  const track = {
    id,
    name: metadata.name,
    artist: metadata.artist,
    album: 'Unknown Album',
    duration: metadata.duration,
    size: file.size,
    blob: file,
    addedAt: Date.now(),
    // coverBlob: null // Можно добавить позже если подключим jsmediatags
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('tracks', 'readwrite');
    const store = tx.objectStore('tracks');
    store.put(track);
    
    tx.oncomplete = () => {
      const { blob, ...trackWithoutBlob } = track;
      resolve(trackWithoutBlob);
    };
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Удаляет трек
 * @param {string} id 
 * @returns {Promise<void>}
 */
export async function removeTrack(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tracks', 'readwrite');
    tx.objectStore('tracks').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Получает список всех треков (без blob для экономии памяти)
 * @returns {Promise<Array>}
 */
export async function getAllTracks() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tracks', 'readonly');
    const store = tx.objectStore('tracks');
    const request = store.getAll();
    
    request.onsuccess = () => {
      const tracks = request.result.map(t => {
        const { blob, ...rest } = t;
        return rest;
      }).sort((a, b) => b.addedAt - a.addedAt);
      resolve(tracks);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Получает blob конкретного трека
 * @param {string} id 
 * @returns {Promise<Blob|null>}
 */
export async function getTrackBlob(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tracks', 'readonly');
    const store = tx.objectStore('tracks');
    const request = store.get(id);
    
    request.onsuccess = () => resolve(request.result ? request.result.blob : null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Считает общий размер занятого места
 * @returns {Promise<number>} Размер в байтах
 */
export async function getTotalSize() {
  const tracks = await getAllTracks();
  return tracks.reduce((total, track) => total + (track.size || 0), 0);
}

/**
 * Очищает всю музыку
 * @returns {Promise<void>}
 */
export async function clearAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tracks', 'readwrite');
    tx.objectStore('tracks').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
