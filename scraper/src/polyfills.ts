/**
 * Polyfills runtime, doit être le PREMIER import de l'entrée CLI.
 * En ESM, les modules importés s'évaluent en profondeur dans l'ordre source :
 * ce fichier doit donc précéder tout import qui pourrait, à l'évaluation,
 * instancier un client Supabase ou ouvrir une connexion HTTPS.
 */
import https from 'https';
import ws from 'ws';

// 1) WebSocket global — requis par @supabase/realtime-js sur Node < 22.
if (!(globalThis as { WebSocket?: unknown }).WebSocket) {
  (globalThis as unknown as Record<string, unknown>).WebSocket = ws;
}

// 2) Désactivation de la validation TLS — BDFIN sert un certificat avec
//    chaîne intermédiaire non reconnue par le store CA d'Ubuntu 22.04.
//    NODE_TLS_REJECT_UNAUTHORIZED n'est pas suffisant dans tous les runtimes
//    (notamment tsx + ESM), on force aussi le httpsAgent global.
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
https.globalAgent.options.rejectUnauthorized = false;
