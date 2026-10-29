import 'server-only';
import { ENV_CLIENT, type Reseau } from '@/lib/social/oauth';

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
