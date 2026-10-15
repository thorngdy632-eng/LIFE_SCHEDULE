import { createApp } from "../../backend/src/app.js";
import { createStorage } from "../../backend/src/lib/storageFactory.js";

let app;

export default async function handler(req, res) {
  if (!app) {
    const storage = await createStorage();
    app = createApp(storage, { corsOrigin: process.env.CORS_ORIGIN || "*" });
  }
  return app(req, res);
}
