// Единое хранилище blob URL (в памяти, не в localStorage)
const store = new Map<string, string>();

export function setBlob(key: string, url: string) {
  store.set(key, url);
}

export function getBlob(key: string): string | undefined {
  return store.get(key);
}

export function hasBlob(key: string): boolean {
  return store.has(key);
}

// Сохраняем blob URL в localStorage как флаг, но сам blob URL живёт только в памяти
// При перезагрузке blob URL теряется — это ограничение браузера
const BLOB_INDEX_KEY = 'animeworld_blob_index';

export function saveBlobIndex() {
  try {
    const keys = Array.from(store.keys());
    localStorage.setItem(BLOB_INDEX_KEY, JSON.stringify(keys));
  } catch {}
}

export function loadBlobIndex(): string[] {
  try {
    const raw = localStorage.getItem(BLOB_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// Для видео: сохраняем сам файл в IndexedDB (если размер позволяет)
export async function saveVideoToIndexedDB(cardId: number, file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('animeworld_videos', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('videos')) {
        db.createObjectStore('videos', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('videos', 'readwrite');
      const os = tx.objectStore('videos');
      os.put({ id: cardId, file });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getVideoFromIndexedDB(cardId: number): Promise<File | null> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('animeworld_videos', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('videos')) {
        db.createObjectStore('videos', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('videos', 'readonly');
      const os = tx.objectStore('videos');
      const getReq = os.get(cardId);
      getReq.onsuccess = () => {
        db.close();
        resolve(getReq.result?.file || null);
      };
      getReq.onerror = () => { db.close(); reject(getReq.error); };
    };
    request.onerror = () => reject(request.error);
  });
}

// Баннеры сохраняем как data:URL в localStorage (сжатые)
const POSTER_STORE_KEY = 'animeworld_posters';

export function savePoster(cardId: number, dataUrl: string) {
  try {
    const posters: Record<number, string> = JSON.parse(localStorage.getItem(POSTER_STORE_KEY) || '{}');
    posters[cardId] = dataUrl;
    localStorage.setItem(POSTER_STORE_KEY, JSON.stringify(posters));
  } catch {}
}

export function getPoster(cardId: number): string | undefined {
  try {
    const posters: Record<number, string> = JSON.parse(localStorage.getItem(POSTER_STORE_KEY) || '{}');
    return posters[cardId];
  } catch { return undefined; }
}
