/**
 * Polyfills runtime, doit etre le PREMIER import de l'entree CLI.
 */
import fs from 'fs';
import ws from 'ws';

// Sentinelles synchrones (fs.writeSync bypasse le buffer de process.stdout
// pour garantir l'affichage meme si le process crash avant flush).
const log = (msg: string): void => {
  try { fs.writeSync(1, `${msg}\n`); } catch { /* fd ferme */ }
};

log(`[polyfills] LOADED ws=${typeof ws} node=${process.version}`);

// 1) WebSocket global — requis par @supabase/realtime-js sur Node < 22.
if (!(globalThis as { WebSocket?: unknown }).WebSocket) {
  (globalThis as unknown as Record<string, unknown>).WebSocket = ws;
  log(`[polyfills] WebSocket installed on globalThis`);
}

// 2) TLS — BDFIN cert intermediaire non reconnu sur Ubuntu 22.04.
// NODE_TLS_REJECT_UNAUTHORIZED desactive la validation TLS globalement.
// Le module https natif de Node respecte cette variable d'environment.
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
log(`[polyfills] TLS verification disabled`);

export { ws };
