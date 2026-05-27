/**
 * Polyfills runtime, doit être le PREMIER import de l'entrée CLI.
 */
import fs from 'fs';
import https from 'https';
import ws from 'ws';

// Sentinelles synchrones (fs.writeSync bypasse le buffer de process.stdout
// pour garantir l'affichage même si le process crash avant flush).
const log = (msg: string): void => {
  try { fs.writeSync(1, `${msg}\n`); } catch { /* fd fermé */ }
};

log(`[polyfills] LOADED ws=${typeof ws} node=${process.version}`);

// 1) WebSocket global — requis par @supabase/realtime-js sur Node < 22.
if (!(globalThis as { WebSocket?: unknown }).WebSocket) {
  (globalThis as unknown as Record<string, unknown>).WebSocket = ws;
  log(`[polyfills] WebSocket installed on globalThis`);
}

// 2) TLS — BDFIN cert intermédiaire non reconnu sur Ubuntu 22.04.
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
https.globalAgent.options.rejectUnauthorized = false;
log(`[polyfills] TLS verification disabled`);

export { ws };
