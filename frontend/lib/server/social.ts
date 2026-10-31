import 'server-only';
import { ENV_CLIENT, type Reseau } from '@/lib/social/oauth';
import { getServiceClient } from '@/lib/billing/serviceClient';
import type { CreatorInfo, TypeContenu } from '@/lib/social/tiktokRegles';

const TT = 'https://open.tiktokapis.com/v2';

/**
 * Jeton TikTok prêt à l'emploi, lu dans `social_tokens`. Expiré (24 h), il est
 * échangé contre le jeton de rafraîchissement, qui TOURNE : l'écriture est
 * conditionnée à l'ancien (même verrou optimiste que les workers, cf.
 * scraper/src/social/jetons.ts) — on ne remplace jamais un jeton valide par un
 * jeton déjà consommé.
 */
export async function jetonTikTok(): Promise<{ ok: true; token: string } | { ok: false; raison: string }> {
  const db = getServiceClient();
  const lire = async () =>
    (await db.from('social_tokens').select('access_token, refresh_token, expire_le, actif').eq('reseau', 'tiktok').maybeSingle()).data as
      | { access_token: string; refresh_token: string | null; expire_le: string | null; actif: boolean }
      | null;
  const l = await lire();
  if (!l) return { ok: false, raison: 'Compte TikTok non connecté.' };
  if (!l.actif) return { ok: false, raison: 'Publication TikTok coupée (interrupteur).' };
  const valide = (e: string | null) => !e || new Date(e).getTime() > Date.now() + 5 * 60_000;
  if (valide(l.expire_le)) return { ok: true, token: l.access_token };
  const client = identifiantsClient('tiktok');
  if (!client || !l.refresh_token) return { ok: false, raison: 'Jeton TikTok expiré, reconnectez TikTok.' };
  const r = await fetch(`${TT}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: client.id, client_secret: client.secret, grant_type: 'refresh_token', refresh_token: l.refresh_token }),
  });
  const j = await json(r);
  if (!r.ok || typeof j.access_token !== 'string') return { ok: false, raison: 'Renouvellement TikTok refusé, reconnectez TikTok.' };
  const { data } = await db
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
  if (data && data.length > 0) return { ok: true, token: j.access_token };
  const relue = await lire();
  return relue && valide(relue.expire_le) ? { ok: true, token: relue.access_token } : { ok: false, raison: 'Jeton TikTok illisible, reconnectez TikTok.' };
}

async function appelTikTok<T>(token: string, chemin: string, corps?: unknown): Promise<T> {
  const r = await fetch(`${TT}${chemin}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(corps ?? {}),
    cache: 'no-store',
  });
  const j = (await r.json().catch(() => ({}))) as { data?: T; error?: { code?: string; message?: string } };
  if (!r.ok || (j.error?.code && j.error.code !== 'ok')) {
    throw new Error(`${j.error?.code ?? `HTTP ${r.status}`}${j.error?.message ? ` — ${j.error.message.slice(0, 160)}` : ''}`);
  }
  return (j.data ?? {}) as T;
}

/** Règle 1 : informations du compte, relues à CHAQUE affichage et à chaque envoi. */
export async function creatorInfoTikTok(token: string): Promise<CreatorInfo> {
  const d = await appelTikTok<Partial<CreatorInfo>>(token, '/post/publish/creator_info/query/');
  return {
    creator_nickname: d.creator_nickname ?? null,
    creator_username: d.creator_username ?? null,
    creator_avatar_url: d.creator_avatar_url ?? null,
    privacy_level_options: Array.isArray(d.privacy_level_options) ? d.privacy_level_options : [],
    comment_disabled: Boolean(d.comment_disabled),
    duet_disabled: Boolean(d.duet_disabled),
    stitch_disabled: Boolean(d.stitch_disabled),
    max_video_post_duration_sec: typeof d.max_video_post_duration_sec === 'number' ? d.max_video_post_duration_sec : null,
  };
}

/** Publication directe ; TikTok va chercher le média sur westbourse.com (domaine vérifié). */
export async function publierDirectTikTok(token: string, type: TypeContenu, postInfo: Record<string, unknown>, urls: string[]): Promise<string> {
  const d =
    type === 'video'
      ? await appelTikTok<{ publish_id?: string }>(token, '/post/publish/video/init/', {
          post_info: postInfo,
          source_info: { source: 'PULL_FROM_URL', video_url: urls[0] },
        })
      : await appelTikTok<{ publish_id?: string }>(token, '/post/publish/content/init/', {
          post_info: postInfo,
          source_info: { source: 'PULL_FROM_URL', photo_cover_index: 0, photo_images: urls },
          post_mode: 'DIRECT_POST',
          media_type: 'PHOTO',
        });
  if (!d.publish_id) throw new Error('TikTok n’a pas renvoyé d’identifiant de publication.');
  return d.publish_id;
}

/** Règle 5 : statut de la publication (PROCESSING_DOWNLOAD, PUBLISH_COMPLETE, FAILED…). */
export async function statutTikTok(token: string, publishId: string): Promise<{ statut: string; raison: string | null }> {
  const d = await appelTikTok<{ status?: string; fail_reason?: string }>(token, '/post/publish/status/fetch/', { publish_id: publishId });
  return { statut: d.status ?? 'INCONNU', raison: d.fail_reason ?? null };
}

/**
 * Échange du code OAuth contre les jetons, côté serveur uniquement. Aucun
 * jeton n'est journalisé ni renvoyé au navigateur : seules les erreurs des
 * fournisseurs (code + description) remontent, tronquées.
 */
export interface JetonsReseau {
  access_token: string;
  refresh_token: string | null;
  expire_le: string | null;
  refresh_expire_le: string | null;
  compte_id: string | null;
  compte_nom: string | null;
  scopes: string | null;
}

export function identifiantsClient(r: Reseau): { id: string; secret: string } | null {
  const id = process.env[ENV_CLIENT[r].id]?.trim();
  const secret = process.env[ENV_CLIENT[r].secret]?.trim();
  return id && secret ? { id, secret } : null;
}

const dans = (secondes: unknown) =>
  typeof secondes === 'number' && secondes > 0 ? new Date(Date.now() + secondes * 1000).toISOString() : null;

async function json(r: Response): Promise<Record<string, unknown>> {
  return (await r.json().catch(() => ({}))) as Record<string, unknown>;
}

function echec(etape: string, r: Response, j: Record<string, unknown>): Error {
  const d = (j.error_description ?? j.message ?? j.error ?? '') as string;
  return new Error(`${etape} : HTTP ${r.status}${d ? ` — ${String(d).slice(0, 160)}` : ''}`);
}

export async function echangerCode(r: Reseau, code: string, redirectUri: string): Promise<JetonsReseau> {
  const client = identifiantsClient(r);
  if (!client) throw new Error(`Identifiants ${ENV_CLIENT[r].id} / ${ENV_CLIENT[r].secret} absents.`);

  if (r === 'linkedin') {
    const t = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: client.id, client_secret: client.secret }),
    });
    const jt = await json(t);
    if (!t.ok || typeof jt.access_token !== 'string') throw echec('Jeton LinkedIn', t, jt);
    const u = await fetch('https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${jt.access_token}` } });
    const ju = await json(u);
    if (!u.ok || typeof ju.sub !== 'string') throw echec('Profil LinkedIn', u, ju);
    return {
      access_token: jt.access_token,
      refresh_token: typeof jt.refresh_token === 'string' ? jt.refresh_token : null,
      expire_le: dans(jt.expires_in),
      refresh_expire_le: dans(jt.refresh_token_expires_in),
      compte_id: `urn:li:person:${ju.sub}`,
      compte_nom: typeof ju.name === 'string' ? ju.name : null,
      scopes: typeof jt.scope === 'string' ? jt.scope : null,
    };
  }

  const t = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: client.id, client_secret: client.secret, code, grant_type: 'authorization_code', redirect_uri: redirectUri }),
  });
  const jt = await json(t);
  if (!t.ok || typeof jt.access_token !== 'string') throw echec('Jeton TikTok', t, jt);
  let nom: string | null = null;
  const u = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=display_name', { headers: { Authorization: `Bearer ${jt.access_token}` } });
  if (u.ok) {
    const ju = (await json(u)) as { data?: { user?: { display_name?: string } } };
    nom = ju.data?.user?.display_name ?? null;
  }
  return {
    access_token: jt.access_token,
    refresh_token: typeof jt.refresh_token === 'string' ? jt.refresh_token : null,
    expire_le: dans(jt.expires_in),
    refresh_expire_le: dans(jt.refresh_expires_in),
    compte_id: typeof jt.open_id === 'string' ? jt.open_id : null,
    compte_nom: nom,
    scopes: typeof jt.scope === 'string' ? jt.scope : null,
  };
}
