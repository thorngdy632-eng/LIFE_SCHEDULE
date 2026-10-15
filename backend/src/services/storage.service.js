import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.resolve(__dirname, '..', '..', 'data');
export const BACKUP_DIR = path.join(DATA_DIR, 'backups');

export class StorageError extends Error {
  constructor(message, status = 500, code = 'STORAGE_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const emptyData = () => ({ version: 1, tasks: [], events: [], journalEntries: [], goals: [] });
export const COLLECTIONS = ['tasks', 'events', 'journalEntries', 'goals'];

export function validateStructure(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 'Root must be an object';
  if (data.version !== 1) return 'Unsupported or missing version';
  for (const c of COLLECTIONS) {
    if (!Array.isArray(data[c])) return `"${c}" must be an array`;
    for (const r of data[c]) {
      if (!r || typeof r !== 'object' || typeof r.id !== 'string') return `Every record in "${c}" needs a string id`;
    }
  }
  return null;
}

/**
 * File-backed store. All mutations go through `mutate`, which is serialized by a
 * promise queue so concurrent requests cannot overwrite each other's changes.
 * Writes use temp file + rename so a crash never leaves a half-written file.
 * A corrupted file is never overwritten: reads fail loudly instead.
 */
export class StorageService {
  constructor(fileName = 'text.txt', dataDir = DATA_DIR) {
    this.dir = dataDir;
    this.backupDir = path.join(dataDir, 'backups');
    const resolved = path.resolve(dataDir, path.basename(fileName)); // basename blocks traversal
    if (path.dirname(resolved) !== path.resolve(dataDir)) throw new StorageError('Invalid data file name', 500);
    this.file = resolved;
    this.queue = Promise.resolve();
  }

  async init() {
    await fs.mkdir(this.dir, { recursive: true });
    await fs.mkdir(this.backupDir, { recursive: true });
    try {
      await fs.access(this.file);
    } catch {
      await this.#write(emptyData());
    }
    await this.read(); // fail fast on corruption
  }

  async read() {
    let raw;
    try {
      raw = await fs.readFile(this.file, 'utf8');
    } catch (e) {
      throw new StorageError(`Cannot read data file: ${e.message}`);
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new StorageError('Data file is not valid JSON. It was left untouched; restore a backup or fix it manually.', 500, 'CORRUPTED');
    }
    const err = validateStructure(data);
    if (err) throw new StorageError(`Data file structure invalid: ${err}. File left untouched.`, 500, 'CORRUPTED');
    return data;
  }

  /** Run fn(data) exclusively; fn mutates data in place and may return a value. */
  mutate(fn) {
    const run = async () => {
      const data = await this.read();
      const result = await fn(data);
      const err = validateStructure(data);
      if (err) throw new StorageError(`Refusing to write invalid data: ${err}`);
      await this.#write(data);
      return result;
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => {});
    return p;
  }

  async backup(label = 'manual') {
    await fs.mkdir(this.backupDir, { recursive: true });
    const name = `text-${label}-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    await fs.copyFile(this.file, path.join(this.backupDir, name));
    return name;
  }

  async replaceAll(newData) {
    const err = validateStructure(newData);
    if (err) throw new StorageError(`Import rejected: ${err}`, 400, 'INVALID_IMPORT');
    return this.mutate(async (data) => {
      await this.backup('before-restore');
      for (const c of COLLECTIONS) data[c] = newData[c];
    });
  }

  async #write(data) {
    const tmp = `${this.file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    try {
      await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
      await fs.rename(tmp, this.file);
    } catch (e) {
      await fs.rm(tmp, { force: true }).catch(() => {});
      throw new StorageError(`Cannot write data file: ${e.message}`);
    }
  }
}
