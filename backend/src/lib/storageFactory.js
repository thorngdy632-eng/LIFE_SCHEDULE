import { StorageService } from '../services/storage.service.js';
import { MemoryStorage } from '../storage/memory.js';

const isFirebaseRuntime = () =>
  !!(process.env.FIREBASE_CONFIG
    || process.env.GCLOUD_PROJECT
    || process.env.K_SERVICE
    || process.env.FUNCTION_TARGET
    || process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

function resolveDriver() {
  const explicit = (process.env.STORAGE_DRIVER || '').toLowerCase();
  if (explicit) return explicit;
  if (isFirebaseRuntime()) return 'firestore';
  return process.env.NODE_ENV === 'production' ? 'memory' : 'file';
}

/**
 * Selects the storage backend:
 *   firestore -> Cloud Firestore (default on Firebase Functions)
 *   file      -> local JSON file (default in dev)
 *   memory    -> in-memory (fallback for production without Firestore)
 * Override with STORAGE_DRIVER.
 */
export async function createStorage() {
  const driver = resolveDriver();

  if (driver === 'firestore') {
    const { FirestoreStorage } = await import('../storage/firestore.js');
    const s = new FirestoreStorage();
    await s.init();
    return s;
  }

  if (driver === 'memory') {
    const s = new MemoryStorage();
    await s.init();
    return s;
  }

  const s = new StorageService(process.env.DATA_FILE || 'text.txt');
  await s.init();
  return s;
}
