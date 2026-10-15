import { StorageService } from '../services/storage.service.js';
import { MemoryStorage } from '../storage/memory.js';

export async function createStorage() {
  const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
  if (hasBlob) {
    const { BlobStorage } = await import('../storage/blob.js');
    const s = new BlobStorage();
    await s.init();
    return s;
  }
  if (process.env.NODE_ENV === 'production') {
    const s = new MemoryStorage();
    await s.init();
    return s;
  }
  const s = new StorageService(process.env.DATA_FILE || 'text.txt');
  await s.init();
  return s;
}
