/**
 * Chargement et validation de la configuration via zod.
 * Échoue tôt et clairement si une variable critique manque.
 */
import 'dotenv/config';
import { z } from 'zod';

const boolFromEnv = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const numFromEnv = (def: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? def : Number(v)))
    .pipe(z.number().finite());

const schema = z.object({
  BDFIN_BASE_URL: z.string().url().default('https://bfin.brvm.org'),
  BDFIN_LOGIN_PATH: z.string().default('/login.aspx?ReturnUrl=%2fdefault.aspx'),
  BDFIN_MARKET_PATH: z.string().default('/Activites_marche.aspx'),
  // Les identifiants ne sont obligatoires qu'en mode réel (validé au runtime).
  BDFIN_USERNAME: z.string().optional().default(''),
  BDFIN_PASSWORD: z.string().optional().default(''),

  HTTP_TIMEOUT_MS: numFromEnv(30000),
  HTTP_MAX_RETRIES: numFromEnv(4),
  HTTP_RETRY_BASE_MS: numFromEnv(1000),
  HTTP_USER_AGENT: z
    .string()
    .default('BRVMAnalystPro-Scraper/0.1 (+contact@example.com)'),

  SUPABASE_URL: z.string().optional().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(''),

  QUALITY_MAX_ABS_VARIATION_PCT: numFromEnv(30),
  QUALITY_STRICT: boolFromEnv,

  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error'])
    .default('info'),
  DRY_RUN: boolFromEnv,
  USE_MOCK: boolFromEnv,
  MARKET_TZ: z.string().default('Africa/Abidjan'),
});

export type Config = z.infer<typeof schema>;

let cached: Config | null = null;

/** Vide le cache de configuration — utile uniquement dans les tests. */
export function resetConfigCache(): void {
  cached = null;
}

export function getConfig(): Config {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    throw new Error(
      `Configuration invalide:\n${JSON.stringify(flat.fieldErrors, null, 2)}`,
    );
  }
  cached = parsed.data;
  return cached;
}

/**
 * Vérifie que les secrets requis pour un run RÉEL sont présents.
 * Lève une erreur explicite sinon (sauf en mode mock).
 */
export function assertRealRunReady(cfg: Config): void {
  const missing: string[] = [];
  if (!cfg.BDFIN_USERNAME) missing.push('BDFIN_USERNAME');
  if (!cfg.BDFIN_PASSWORD) missing.push('BDFIN_PASSWORD');
  if (!cfg.DRY_RUN) {
    if (!cfg.SUPABASE_URL) missing.push('SUPABASE_URL');
    if (!cfg.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  }
  if (missing.length > 0) {
    throw new Error(
      `Variables manquantes pour un run réel: ${missing.join(', ')}. ` +
        `Renseignez-les dans .env.local ou utilisez --mock / DRY_RUN=true.`,
    );
  }
}
