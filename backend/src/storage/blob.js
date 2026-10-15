import { put, list, del } from '@vercel/blob';
import { emptyData, validateStructure, COLLECTIONS } from '../services/storage.service.js';

const BLOB_KEY = 'life-schedule-data.json';

export class BlobStorage {
  constructor() {
    this._data = null;
  }
  async init() {
    try {
      const { blobs } = await list({ prefix: BLOB_KEY });
      if (blobs.length === 0) {
        this._data = emptyData();
        await this.#write(this._data);
        return;
      }
      const res = await fetch(blobs[0].url);
      const raw = await res.text();
      const data = JSON.parse(raw);
      const err = validateStructure(data);
      if (err) throw new Error(err);
      this._data = data;
    } catch (e) {
      this._data = emptyData();
      try { await this.#write(this._data); } catch {}
    }
  }
  async read() {
    if (this._data) return JSON.parse(JSON.stringify(this._data));
    await this.init();
    return JSON.parse(JSON.stringify(this._data));
  }
  mutate(fn) {
    const run = async () => {
      const data = await this.read();
      const result = fn(data);
      const err = validateStructure(data);
      if (err) throw new Error(err);
      await this.#write(data);
      this._data = data;
      return result;
    };
    return run();
  }
  async replaceAll(newData) {
    const err = validateStructure(newData);
    if (err) throw new Error(err);
    this._data = newData;
    await this.#write(this._data);
  }
  async backup() {
    const name = life-schedule-backup-.json;
    await put(name, JSON.stringify(await this.read(), null, 2), { access: 'private', addRandomSuffix: false });
    return name;
  }
  async #write(data) {
    await put(BLOB_KEY, JSON.stringify(data, null, 2), { access: 'private', addRandomSuffix: false });
  }
  get file() {
    return 'vercel-blob:' + BLOB_KEY;
  }
}
