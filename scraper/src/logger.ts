/**
 * Logger structuré (pino). En dev, pretty-print lisible.
 * Les logs techniques du scraping sont séparés des données utilisateur
 * (cf. exigence §6.6).
 */
import { pino } from 'pino';
import { getConfig } from './config.js';

const cfg = getConfig();

export const logger = pino({
  level: cfg.LOG_LEVEL,
  // En production (LOG_LEVEL=info via env), on garde le JSON pour ingestion.
  transport:
    process.env.NODE_ENV === 'production'
      ? undefined
      : {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
        },
  // Ne jamais logger les secrets, même par accident.
  redact: {
    paths: [
      'password',
      'BDFIN_PASSWORD',
      'SUPABASE_SERVICE_ROLE_KEY',
      '*.password',
      'headers.cookie',
      'headers.authorization',
    ],
    censor: '[redacted]',
  },
});
