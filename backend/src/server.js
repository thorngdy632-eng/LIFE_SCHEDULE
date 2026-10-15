import 'dotenv/config';
import { StorageService } from './services/storage.service.js';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT) || 3000;
const storage = new StorageService(process.env.DATA_FILE || 'text.txt');

try {
  await storage.init();
} catch (e) {
  console.error(`Storage failed to initialise: ${e.message}`);
  process.exit(1);
}

const app = createApp(storage, { corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:4200' });
app.listen(PORT, () => console.log(`LIFE SCHEDULE API listening on http://localhost:${PORT}/api (data: ${storage.file})`));
