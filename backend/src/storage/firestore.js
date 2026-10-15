import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { emptyData, validateStructure, COLLECTIONS, StorageError } from '../services/storage.service.js';

function ensureApp() {
  if (getApps().length) return;
  // Serverless hosts (e.g. Vercel) provide the whole service-account JSON via env.
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw) {
    const creds = JSON.parse(raw);
    initializeApp({ credential: cert(creds), projectId: creds.project_id });
    return;
  }
  // Otherwise use Application Default Credentials automatically:
  // - Cloud Functions: the runtime service account
  // - locally: GOOGLE_APPLICATION_CREDENTIALS or the Firestore emulator
  initializeApp();
}

/**
 * Cloud Firestore storage adapter.
 *
 * Layout (keeps the app's "read whole structure / write whole structure" contract):
 *   <collection>/{tasks|events|journalEntries|goals} -> { items: [...], updatedAt }
 *   <backups>/{ISO-timestamp}-{label}                -> { createdAt, label, data }
 *
 * Mutations are serialized per instance and only changed collections are written,
 * keeping Firestore reads/writes well inside the Spark/Blaze no-cost quota.
 */
export class FirestoreStorage {
  constructor({ collection = 'lifeSchedule', backups = 'lifeScheduleBackups' } = {}) {
    ensureApp();
    this.db = getFirestore();
    this.collection = collection;
    this.backups = backups;
    this.queue = Promise.resolve();
  }

  get file() {
    return `firestore:${this.collection}`;
  }

  async init() {
    const snap = await this.db.collection(this.collection).get();
    const existing = new Set(snap.docs.map((d) => d.id));
    const missing = COLLECTIONS.filter((c) => !existing.has(c));
    if (missing.length) {
      const batch = this.db.batch();
      for (const c of missing) batch.set(this.collectionRef(c), { items: [], updatedAt: new Date().toISOString() });
      await batch.commit();
    }
  }

  async read() {
    const snap = await this.db.collection(this.collection).get();
    const byId = new Map(snap.docs.map((d) => [d.id, d.data()?.items]));
    const data = emptyData();
    for (const c of COLLECTIONS) if (Array.isArray(byId.get(c))) data[c] = byId.get(c);
    return data;
  }

  /** Run fn(data) exclusively; fn mutates data in place and may return a value. */
  mutate(fn) {
    const run = async () => {
      const data = await this.read();
      const before = JSON.parse(JSON.stringify(data));
      const result = await fn(data);
      const err = validateStructure(data);
      if (err) throw new StorageError(`Refusing to write invalid data: ${err}`);
      await this.#write(data, before);
      return result;
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => {});
    return p;
  }

  async replaceAll(newData) {
    const err = validateStructure(newData);
    if (err) throw new StorageError(`Import rejected: ${err}`, 400, 'INVALID_IMPORT');
    return this.mutate(async (data) => {
      await this.#backup(data, 'before-restore');
      for (const c of COLLECTIONS) data[c] = newData[c];
    });
  }

  async backup(label = 'manual') {
    return this.#backup(await this.read(), label);
  }

  async #backup(data, label) {
    const name = `${new Date().toISOString().replace(/[:.]/g, '-')}-${label}`;
    await this.db
      .collection(this.backups)
      .doc(name)
      .set({ createdAt: new Date().toISOString(), label, version: data.version, data });
    return name;
  }

  collectionRef(id) {
    return this.db.collection(this.collection).doc(id);
  }

  async #write(data, previous) {
    const batch = this.db.batch();
    let writes = 0;
    for (const c of COLLECTIONS) {
      const next = JSON.stringify(data[c]);
      if (previous && JSON.stringify(previous[c]) === next) continue; // skip untouched collections
      batch.set(this.collectionRef(c), { items: data[c], updatedAt: new Date().toISOString() });
      writes++;
    }
    if (writes) await batch.commit();
  }
}
