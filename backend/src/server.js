import 'dotenv/config';
import { createStorage } from './lib/storageFactory.js';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT) || 3000;

let storage;
try {
  storage = await createStorage();
} catch (e) {
  console.error(`Storage failed to initialise: ${e.message}`);
  process.exit(1);
}

const app = createApp(storage, { corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:4200' });
app.listen(PORT, () => console.log(`LIFE SCHEDULE API listening on http://localhost:${PORT}/api (storage: ${storage.file})`));
