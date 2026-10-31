/**
 * Post PHOTO TikTok d'un article.
 *
 * - Compte ayant accordé `video.publish` : publication DIRECTE, avec la
 *   visibilité la plus ouverte que TikTok autorise pour ce compte
 *   (`creator_info`). Une application NON AUDITÉE ne peut publier qu'en privé
 *   (SELF_ONLY) : l'exploitant la passe en public dans l'appli.
 * - Sinon : brouillon dans la boîte de réception (`video.upload`).
 *
 * TikTok n'accepte les photos que par URL (`PULL_FROM_URL`), en JPEG ou WebP,
 * sur un domaine VÉRIFIÉ dans le portail développeur — d'où la route
 * /api/articles/[slug]/photo.jpg servie par westbourse.com.
 */
export type ModeTikTok = 'public' | 'prive' | 'brouillon';

export function peutPublierDirect(scopes: string | null | undefined): boolean {
  return String(scopes ?? '').split(/[,\s]+/).includes('video.publish');
}

/** La visibilité la plus ouverte proposée par TikTok pour ce compte. */
export function choisirVisibilite(options: unknown): string {
  const o = Array.isArray(options) ? (options as string[]) : [];
  if (o.includes('PUBLIC_TO_EVERYONE')) return 'PUBLIC_TO_EVERYONE';
  if (o.includes('SELF_ONLY')) return 'SELF_ONLY';
  return o[0] ?? 'SELF_ONLY';
}

async function appel<T>(token: string, chemin: string, corps?: unknown): Promise<T> {
  const r = await fetch(`https://open.tiktokapis.com/v2${chemin}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(corps ?? {}),
  });
  const j = (await r.json().catch(() => ({}))) as { data?: T; error?: { code?: string; message?: string } };
  if (!r.ok || (j.error?.code && j.error.code !== 'ok')) {
    const quoi = j.error?.code === 'url_ownership_unverified' ? ' — vérifiez le domaine westbourse.com dans le portail TikTok' : '';
    throw new Error(`TikTok ${chemin} : HTTP ${r.status} ${j.error?.code ?? ''} ${j.error?.message?.slice(0, 160) ?? ''}${quoi}`.trim());
  }
  return (j.data ?? {}) as T;
}

export async function publierPhotoTikTok(o: {
  token: string;
  titre: string;
  description: string;
  urls: string[];
  direct: boolean;
}): Promise<{ publishId: string; mode: ModeTikTok }> {
  const source_info = { source: 'PULL_FROM_URL', photo_cover_index: 0, photo_images: o.urls };
  if (!o.direct) {
    const d = await appel<{ publish_id?: string }>(o.token, '/post/publish/content/init/', {
      post_info: { title: o.titre, description: o.description },
      source_info,
      post_mode: 'MEDIA_UPLOAD',
      media_type: 'PHOTO',
    });
    return { publishId: d.publish_id ?? 'depose', mode: 'brouillon' };
  }
  const info = await appel<{ privacy_level_options?: string[] }>(o.token, '/post/publish/creator_info/query/');
  let vis = choisirVisibilite(info.privacy_level_options);
  const essayer = (v: string) =>
    appel<{ publish_id?: string }>(o.token, '/post/publish/content/init/', {
      post_info: { title: o.titre, description: o.description, privacy_level: v, disable_comment: false, auto_add_music: true },
      source_info,
      post_mode: 'DIRECT_POST',
      media_type: 'PHOTO',
    });
  let d: { publish_id?: string };
  try {
    d = await essayer(vis);
  } catch (e) {
    if (vis === 'SELF_ONLY' || !/unaudited/i.test((e as Error).message)) throw e;
    vis = 'SELF_ONLY';
    d = await essayer(vis);
  }
  return { publishId: d.publish_id ?? 'publie', mode: vis === 'SELF_ONLY' ? 'prive' : 'public' };
}
