import { getSupabase } from '../persistence/supabase.js';

/**
 * Jetons de publication, lus dans `social_tokens` (migration 0170) — source
 * UNIQUE partagée avec le worker vidéo (video/reseaux.mjs, même logique).
 *
 * TikTok : le jeton d'accès dure 24 h. Expiré, on l'échange contre le jeton
 * de rafraîchissement, qui TOURNE à chaque échange. L'écriture du nouveau
 * couple est conditionnée à l'ancien jeton de rafraîchissement (verrou
 * optimiste) : si un autre worker l'a déjà tourné, on relit sa version au
 * lieu d'écraser un jeton valide par un jeton déjà consommé.
 */
export type ReseauSocial = 'linkedin' | 'tiktok';

interface Ligne {
  reseau: ReseauSocial;
  access_token: string;
  refresh_token: string | null;
  expire_le: string | null;
  compte_id: string | null;
  actif: boolean;
  scopes: string | null;
}

export type Jeton =
  | { ok: true; token: string; compteId: string | null; scopes: string | null }
  | { ok: false; raison: string; alerter: boolean };

const MARGE_MS = 5 * 60_000;
const valide = (expire: string | null) => !expire || new Date(expire).getTime() > Date.now() + MARGE_MS;

async function lire(reseau: ReseauSocial): Promise<Ligne | null | 'table_absente'> {
  const { data, error } = await getSupabase()
    .from('social_tokens')
    .select('reseau, access_token, refresh_token, expire_le, compte_id, actif, scopes')
    .eq('reseau', reseau)
    .maybeSingle();
  if (error) return error.code === '42P01' || error.code === 'PGRST205' ? 'table_absente' : null;
  return (data as Ligne | null) ?? null;
}

async function rafraichirTikTok(l: Ligne): Promise<Jeton> {
  const cle = process.env.TIKTOK_CLIENT_KEY?.trim();
  const secret = process.env.TIKTOK_CLIENT_SECRET?.trim();
  if (!cle || !secret) return { ok: false, raison: 'TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET absents du job', alerter: true };
  if (!l.refresh_token) return { ok: false, raison: 'aucun jeton de rafraîchissement, reconnectez TikTok', alerter: true };

  const r = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: cle, client_secret: secret, grant_type: 'refresh_token', refresh_token: l.refresh_token }),
  });
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok || typeof j.access_token !== 'string') {
    const d = String(j.error_description ?? j.error ?? '').slice(0, 160);
    return { ok: false, raison: `rafraîchissement TikTok refusé (HTTP ${r.status}${d ? ` — ${d}` : ''}), reconnectez TikTok`, alerter: true };
  }
  const dans = (s: unknown) => (typeof s === 'number' ? new Date(Date.now() + s * 1000).toISOString() : null);
  const { data: maj } = await getSupabase()
    .from('social_tokens')
    .update({
      access_token: j.access_token,
      refresh_token: typeof j.refresh_token === 'string' ? j.refresh_token : l.refresh_token,
      expire_le: dans(j.expires_in),
      refresh_expire_le: dans(j.refresh_expires_in),
      maj_le: new Date().toISOString(),
    })
    .eq('reseau', 'tiktok')
    .eq('refresh_token', l.refresh_token)
    .select('reseau');
  if (maj && maj.length > 0) return { ok: true, token: j.access_token, compteId: l.compte_id, scopes: l.scopes };
  // Un autre worker a tourné le jeton entre-temps : sa version fait foi.
  const relue = await lire('tiktok');
  if (relue && relue !== 'table_absente' && valide(relue.expire_le)) return { ok: true, token: relue.access_token, compteId: relue.compte_id, scopes: relue.scopes };
  return { ok: false, raison: 'jeton TikTok tourné par un autre worker et illisible', alerter: true };
}

/**
 * Jeton prêt à l'emploi, ou la raison de s'abstenir. `alerter` distingue un
 * choix de l'exploitant (non connecté, coupé : silence) d'une panne (jeton
 * expiré, rafraîchissement refusé : alerte Telegram).
 */
export async function jetonUtilisable(reseau: ReseauSocial): Promise<Jeton> {
  const l = await lire(reseau);
  if (l === 'table_absente') return { ok: false, raison: 'migration 0170 non appliquée', alerter: false };
  if (!l) return { ok: false, raison: 'compte non connecté', alerter: false };
  if (!l.actif) return { ok: false, raison: 'publication coupée par l’exploitant', alerter: false };
  if (valide(l.expire_le)) return { ok: true, token: l.access_token, compteId: l.compte_id, scopes: l.scopes };
  if (reseau === 'linkedin') return { ok: false, raison: 'jeton LinkedIn expiré, reconnectez LinkedIn depuis /admin/reseaux', alerter: true };
  return rafraichirTikTok(l);
}
