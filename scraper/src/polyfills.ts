/**
 * Polyfills runtime, doit être le PREMIER import de l'entrée CLI.
 * En ESM, les modules importés s'évaluent en profondeur dans l'ordre source :
 * ce fichier doit donc précéder tout import qui pourrait, à l'évaluation,
 * instancier un client Supabase ou ouvrir une connexion HTTPS.
 */
import https from 'https';
import ws from 'ws';

// Sentinelle visible dans les logs CI pour vérifier que le polyfill tourne.
// (process.stdout.write pour bypasser pino et apparaître brut.)
process.stdout.write(`[polyfills] loaded — ws=${typeof ws}, node=${process.version}\n`);

// 1) WebSocket global — requis par @supabase/realtime-js sur Node < 22.
if (!(globalThis as { WebSocket?: unknown }).WebSocket) {
  (globalThis as unknown as Record<string, unknown>).WebSocket = ws;
  process.stdout.write(`[polyfills] globalThis.WebSocket installed\n`);
}

// 2) Désactivation de la validation TLS — BDFIN sert un certificat avec
//    chaîne intermédiaire non reconnue par le store CA d'Ubuntu 22.04.
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
https.globalAgent.options.rejectUnauthorized = false;
process.stdout.write(`[polyfills] TLS verification disabled\n`);

// Export du module ws pour utilisation explicite (transport Supabase).
export { ws };
