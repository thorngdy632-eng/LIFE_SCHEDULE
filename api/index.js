import { createApp } from '../backend/src/app.js';
import { createStorage } from '../backend/src/lib/storageFactory.js';

let appPromise;

function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      const storage = await createStorage();
      return createApp(storage, { corsOrigin: process.env.CORS_ORIGIN || '*' });
    })().catch((err) => {
      appPromise = null;
      throw err;
    });
  }
  return appPromise;
}

export default async function handler(req, res) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (err) {
    console.error('[api] initialization failed:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({
        success: false,
        error: { message: err.message || 'Server initialization failed', details: [] },
      }));
    }
  }
}
