# API V4.1

Entry point: `server.js` (Node.js + Express). Routes live under `src/routes`, Mongoose models under `src/models`, security middleware under `src/middleware`, and pure request validation under `src/utils`.

The API uses MongoDB from `MONGO_URI`. It fails fast when the URI is missing or still a placeholder. Production requires a strong `SESSION_SECRET` and a newly configured `ADMIN_PASSWORD`.
