import type { SignVideoLesson, StudioSampleRecord } from '../types/signlens';

const VIDEOS_DB_NAME = 'SignLensVideosDB';
const VIDEOS_DB_VERSION = 1;

const STUDIO_DB_NAME = 'SignLensStudioDB';
const STUDIO_DB_VERSION = 1;

const STUDIO_LABELS_KEY = 'signlens_labels';

export const DEFAULT_STUDIO_LABELS = [
  'XIN_CHAO',
  'CAM_ON',
  'TAM_BIET',
  'GIUP_TOI',
  'TOI',
  'BAN',
  'CO',
  'KHONG',
];

function openVideosDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(VIDEOS_DB_NAME, VIDEOS_DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('videos')) {
        const store = db.createObjectStore('videos', { keyPath: 'id' });
        store.createIndex('category', 'category', { unique: false });
        store.createIndex('lang', 'lang', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const INITIAL_SEED_LESSONS: SignVideoLesson[] = [
  {
    id: 'sample_xin_chao',
    name: 'Xin chào (VSL)',
    category: 'chào_hỏi',
    lang: 'VSL',
    difficulty: 'cơ_bản',
    videoType: 'youtube',
    youtubeId: 'k3T3Z6sM8yA',
    youtubeUrl: 'https://www.youtube.com/watch?v=k3T3Z6sM8yA',
    description:
      'Đưa bàn tay mở lên ngang tầm mặt hoặc ngực, hướng lòng bàn tay về phía người đối diện rồi vẫy nhẹ sang 2 bên.',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'sample_cam_on',
    name: 'Cảm ơn (VSL)',
    category: 'chào_hỏi',
    lang: 'VSL',
    difficulty: 'cơ_bản',
    videoType: 'youtube',
    youtubeId: '7wtfhZwyrcc',
    youtubeUrl: 'https://www.youtube.com/watch?v=7wtfhZwyrcc',
    description:
      'Đặt các ngón tay của bàn tay thuận chạm nhẹ vào cằm hoặc môi, sau đó đưa bàn tay hướng thẳng về phía trước với nét mặt thân thiện.',
    createdAt: '2025-01-02T00:00:00.000Z',
  },
  {
    id: 'sample_so_1_5',
    name: 'Đếm số 1 đến 5 (VSL)',
    category: 'số_đếm',
    lang: 'VSL',
    difficulty: 'cơ_bản',
    videoType: 'youtube',
    youtubeId: 'jNQXAC9IVRw',
    youtubeUrl: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    description:
      'Giơ lần lượt từng ngón tay từ ngón trỏ (1), ngón trỏ và ngón giữa (2), ba ngón (3), bốn ngón (4) đến cả bàn tay mở (5).',
    createdAt: '2025-01-03T00:00:00.000Z',
  },
];

export async function getAllVideoLessons(): Promise<SignVideoLesson[]> {
  const db = await openVideosDb();
  const list = await new Promise<SignVideoLesson[]>((resolve, reject) => {
    const tx = db.transaction('videos', 'readonly');
    const store = tx.objectStore('videos');
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as SignVideoLesson[]) || []);
    req.onerror = () => reject(req.error);
  });

  if (list.length === 0) {
    const tx = db.transaction('videos', 'readwrite');
    const store = tx.objectStore('videos');
    for (const item of INITIAL_SEED_LESSONS) {
      store.put(item);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return [...INITIAL_SEED_LESSONS];
  }

  return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export async function saveVideoLesson(lesson: SignVideoLesson): Promise<void> {
  const db = await openVideosDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('videos', 'readwrite');
    const store = tx.objectStore('videos');
    const req = store.put(lesson);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteVideoLesson(id: string): Promise<void> {
  const db = await openVideosDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('videos', 'readwrite');
    const store = tx.objectStore('videos');
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/* ── STUDIO INDEXEDDB ──────────────────────────────── */
function openStudioDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(STUDIO_DB_NAME, STUDIO_DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('samples')) {
        const store = db.createObjectStore('samples', { keyPath: 'id' });
        store.createIndex('label', 'label', { unique: false });
        store.createIndex('signLang', 'signLang', { unique: false });
      }
      if (!db.objectStoreNames.contains('labels')) {
        db.createObjectStore('labels', { keyPath: 'name' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllStudioSamples(): Promise<StudioSampleRecord[]> {
  const db = await openStudioDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('samples', 'readonly');
    const store = tx.objectStore('samples');
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as StudioSampleRecord[]) || []);
    req.onerror = () => reject(req.error);
  });
}

export async function saveStudioSample(sample: StudioSampleRecord): Promise<void> {
  const db = await openStudioDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('samples', 'readwrite');
    const store = tx.objectStore('samples');
    const req = store.put(sample);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearAllStudioSamples(): Promise<void> {
  const db = await openStudioDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('samples', 'readwrite');
    const store = tx.objectStore('samples');
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export function loadStudioLabels(): string[] {
  try {
    const raw = localStorage.getItem(STUDIO_LABELS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((x): x is string => typeof x === 'string');
      }
    }
  } catch {
    // ignore storage errors
  }
  return [...DEFAULT_STUDIO_LABELS];
}

export function saveStudioLabels(labels: string[]): void {
  try {
    localStorage.setItem(STUDIO_LABELS_KEY, JSON.stringify(labels));
  } catch {
    // ignore storage errors
  }
}
