import { put, list } from '@vercel/blob';
import { emptyData, validateStructure, StorageError } from '../services/storage.service.js';

const BLOB_KEY = 'life-schedule-data.json';

/**
 * Load the schedule data from Vercel Blob.
 * - Finds the existing store file with `list({ prefix })`.
 * - If present, fetches and parses the JSON.
 * - If missing/empty, creates and returns a default initial state.
 * Throws StorageError on any Blob/network/parse failure so callers can
 * return a clean JSON error instead of silently losing data.
 */
export async function loadDataFromBlob() {
  let found;
  try {
    const { blobs } = await list({ prefix: BLOB_KEY });
    found = blobs.find((b) => b.pathname === BLOB_KEY) || blobs[0];
  } catch (e) {
    throw new StorageError(`Blob list failed: ${e.message}`, 500, 'BLOB_LIST_FAILED');
  }

  if (!found) {
    const initial = emptyData();
    await saveDataToBlob(initial);
    return initial;
  }

  let raw;
  try {
    const res = await fetch(found.url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    raw = await res.text();
  } catch (e) {
    throw new StorageError(`Blob fetch failed: ${e.message}`, 500, 'BLOB_FETCH_FAILED');
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new StorageError('Blob data is not valid JSON', 500, 'BLOB_CORRUPTED');
  }

  const err = validateStructure(data);
  if (err) throw new StorageError(`Blob data structure invalid: ${err}`, 500, 'BLOB_CORRUPTED');
  return data;
}

/**
 * Persist the schedule data to Vercel Blob (overwrites the single store file).
 * @vercel/blob@0.23.x only supports public access.
 */
export async function saveDataToBlob(data) {
  const err = validateStructure(data);
  if (err) throw new StorageError(`Refusing to save invalid data: ${err}`, 500, 'INVALID_DATA');
  try {
    await put(BLOB_KEY, JSON.stringify(data, null, 2), {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json',
      cacheControlMaxAge: 60,
    });
  } catch (e) {
    throw new StorageError(`Blob save failed: ${e.message}`, 500, 'BLOB_SAVE_FAILED');
  }
}

/** Storage adapter used by the Express app. */
export class BlobStorage {
  constructor() {
    this._data = null;
  }

  async init() {
    if (this._data === null) this._data = await loadDataFromBlob();
  }

  async read() {
    if (this._data === null) this._data = await loadDataFromBlob();
    return JSON.parse(JSON.stringify(this._data));
  }

  async mutate(fn) {
    const data = await this.read();
    const result = await fn(data);
    const err = validateStructure(data);
    if (err) throw new StorageError(`Refusing to write invalid data: ${err}`, 500, 'INVALID_DATA');
    await saveDataToBlob(data);
    this._data = data;
    return result;
  }

  async replaceAll(newData) {
    const err = validateStructure(newData);
    if (err) throw new StorageError(`Import rejected: ${err}`, 400, 'INVALID_IMPORT');
    await saveDataToBlob(newData);
    this._data = JSON.parse(JSON.stringify(newData));
  }

  async backup() {
    const name = `life-schedule-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    try {
      await put(name, JSON.stringify(await this.read(), null, 2), {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json',
        cacheControlMaxAge: 60,
      });
    } catch (e) {
      throw new StorageError(`Blob backup failed: ${e.message}`, 500, 'BLOB_BACKUP_FAILED');
    }
    return name;
  }

  get file() {
    return 'vercel-blob:' + BLOB_KEY;
  }
}
