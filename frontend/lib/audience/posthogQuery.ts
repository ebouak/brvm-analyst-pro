import 'server-only';

/**
 * Client HogQL de PostHog (UE) — SERVEUR UNIQUEMENT.
 *
 * La clé personnelle (lecture seule) ne quitte jamais le serveur et n'est jamais
 * journalisée : les erreurs portent un CODE (config / http / reseau), pas l'URL,
 * pas l'en-tête, pas le corps de la requête.
 */
export type CodeErreurPosthog = 'config' | 'http' | 'reseau' | 'format';

export class ErreurPosthog extends Error {
  constructor(public readonly code: CodeErreurPosthog, public readonly statut?: number) {
    super(code === 'http' ? `PostHog HTTP ${statut}` : `PostHog ${code}`);
    this.name = 'ErreurPosthog';
  }
}

export interface ResultatHogql { columns: string[]; results: unknown[][] }
const DELAI_MS = 20_000;

export async function requeteHogQL(sql: string): Promise<ResultatHogql> {
  const cle = process.env.POSTHOG_PERSONAL_API_KEY;
  const projet = process.env.POSTHOG_PROJECT_ID;
  const hote = (process.env.POSTHOG_API_HOST ?? '').replace(/\/+$/, '');
  if (!cle || !projet || !/^\d+$/.test(projet) || !/^https:\/\/[a-z0-9.-]+$/i.test(hote)) throw new ErreurPosthog('config');

  let res: Response;
  try {
    res = await fetch(`${hote}/api/projects/${projet}/query/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query: sql } }),
      signal: AbortSignal.timeout(DELAI_MS),
      cache: 'no-store',
    });
  } catch {
    throw new ErreurPosthog('reseau');
  }
  if (!res.ok) throw new ErreurPosthog('http', res.status);
  let json: unknown;
  try { json = await res.json(); } catch { throw new ErreurPosthog('format'); }
  const j = json as { columns?: unknown; results?: unknown };
  if (!Array.isArray(j.columns) || !Array.isArray(j.results)) throw new ErreurPosthog('format');
  return { columns: j.columns.map(String), results: j.results as unknown[][] };
}

/** Code d'erreur sûr à journaliser. */
export const codeErreur = (e: unknown): string => (e instanceof ErreurPosthog ? (e.code === 'http' ? `http_${e.statut}` : e.code) : 'inconnue');
