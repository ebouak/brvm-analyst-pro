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

// 2) TLS — la verification est ACTIVE. Ce fichier posait
// NODE_TLS_REJECT_UNAUTHORIZED=0 (cert intermediaire BDFIN non reconnu sur
// Ubuntu 22.04, en 2026-05) : aucune verification de certificat, y compris
// vers Supabase avec la cle secrete. Sonde du 2026-09-18 : les 12 hotes du
// scraper servent une chaine complete. Si un hote casse de nouveau, corriger
// cet hote-la (CA supplementaire via NODE_EXTRA_CA_CERTS), jamais le global.
if (process.env['NODE_TLS_REJECT_UNAUTHORIZED'] === '0') {
  log(`[polyfills] ATTENTION : NODE_TLS_REJECT_UNAUTHORIZED=0 pose par l'environnement — verification TLS desactivee`);
}

export { ws };
