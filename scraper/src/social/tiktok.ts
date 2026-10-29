/**
 * Dépôt d'un post PHOTO dans la boîte de réception TikTok (mode brouillon,
 * portée `video.upload`) : l'exploitant le termine dans l'application.
 *
 * TikTok n'accepte les photos que par URL (`PULL_FROM_URL`), en JPEG ou WebP,
 * sur un préfixe VÉRIFIÉ dans le portail développeur — d'où la route
 * /api/articles/[slug]/photo.jpg servie par westbourse.com.
 */
export async function deposerPhotoTikTok(o: { token: string; titre: string; description: string; urls: string[] }): Promise<string> {
  const r = await fetch('https://open.tiktokapis.com/v2/post/publish/content/init/', {
    method: 'POST',
    headers: { Authorization: `Bearer ${o.token}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({
      post_info: { title: o.titre, description: o.description },
      source_info: { source: 'PULL_FROM_URL', photo_cover_index: 0, photo_images: o.urls },
      post_mode: 'MEDIA_UPLOAD',
      media_type: 'PHOTO',
    }),
  });
  const j = (await r.json().catch(() => ({}))) as { data?: { publish_id?: string }; error?: { code?: string; message?: string } };
  if (!r.ok || (j.error?.code && j.error.code !== 'ok')) {
    const quoi = j.error?.code === 'url_ownership_unverified' ? ' — vérifiez le préfixe westbourse.com dans le portail TikTok' : '';
    throw new Error(`TikTok photo : HTTP ${r.status} ${j.error?.code ?? ''} ${j.error?.message?.slice(0, 160) ?? ''}${quoi}`.trim());
  }
  return j.data?.publish_id ?? 'depose';
}
