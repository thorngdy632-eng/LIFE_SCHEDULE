import { emptyData, validateStructure, COLLECTIONS } from '../services/storage.service.js';

export class MemoryStorage {
  constructor(initial = emptyData()) {
    this.data = JSON.parse(JSON.stringify(initial));
  }
  async init() {}
  async read() {
    return JSON.parse(JSON.stringify(this.data));
  }
  mutate(fn) {
    const result = fn(this.data);
    const err = validateStructure(this.data);
    if (err) throw new Error(err);
    return Promise.resolve(result);
  }
  async replaceAll(newData) {
    const err = validateStructure(newData);
    if (err) throw new Error(err);
    for (const c of COLLECTIONS) this.data[c] = newData[c];
  }
  async backup() {
    return 'memory-backup.json';
  }
  get file() {
    return 'memory';
  }
}
