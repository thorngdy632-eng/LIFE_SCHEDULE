import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { createApp } from './src/app.js';
import { createStorage } from './src/lib/storageFactory.js';

const REGION = process.env.FUNCTION_REGION || 'asia-southeast1';

setGlobalOptions({
  region: REGION,
  maxInstances: 10,
  memory: '256MiB',
  concurrency: 80,
});

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

/**
 * Single HTTP endpoint that hosts the whole Express API under /api.
 * URL: https://<REGION>-<PROJECT_ID>.cloudfunctions.net/api
 */
export const api = onRequest({ invoker: 'public' }, async (req, res) => {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (err) {
    console.error('[api] initialization failed:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: { message: err.message || 'Server initialization failed', details: [] },
      });
    }
  }
});
