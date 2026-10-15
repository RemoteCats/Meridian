'use strict';

/**
 * Meridian Constructions server entry point.
 * Boots the HTTP server and wires graceful shutdown.
 */

const http = require('http');

// Local .env, if there is one. Must run before anything reads configuration:
// on a platform (Vercel, a container) there is no file and this does nothing.
require('./src/utils/env').loadEnv();

const app = require('./src/app');

const PORT = Number(process.env.PORT) || 3000;

const server = http.createServer(app);

server.listen(PORT, () => {
  const mode = process.env.NODE_ENV || 'development';
  console.log(`[meridian] server listening on http://localhost:${PORT} (${mode})`);
});

// Graceful shutdown so runtime data flushes cleanly.
function shutdown(signal) {
  console.log(`[meridian] received ${signal}, shutting down...`);
  server.close(() => {
    console.log('[meridian] closed remaining connections. bye.');
    process.exit(0);
  });
  // Force-exit if connections hang.
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
