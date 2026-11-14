import { timingSafeEqual } from 'node:crypto';

/** Longueur minimale d'un secret de cron : en dessous, il se devine. */
export const SECRET_CRON_MIN = 32;

/**
 * Autorise une requête de cron : `Authorization: Bearer <secret>` UNIQUEMENT,
 * comparé à temps constant. Refuse :
 *  - un secret absent ou de moins de 32 caractères (configuration faible) ;
 *  - tout autre vecteur (query string, en-tête personnalisé) : une URL se
 *    retrouve dans les journaux des proxys, un en-tête maison n'a aucune
 *    raison d'exister quand Vercel Cron et curl savent poser `Authorization`.
 */
export function cronAutorise(
  req: { headers: { get(nom: string): string | null } },
  secret: string | undefined = process.env.CRON_SECRET,
): boolean {
  if (!secret || secret.length < SECRET_CRON_MIN) return false;
  const entete = req.headers.get('authorization') ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(entete);
  if (!m) return false;
  const a = Buffer.from(secret, 'utf8');
  const b = Buffer.from(m[1], 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
