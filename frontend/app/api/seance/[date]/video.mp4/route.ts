export const runtime = 'nodejs';

/**
 * Vidéo de séance servie depuis westbourse.com : TikTok ne va chercher un média
 * (PULL_FROM_URL) que sur un domaine VÉRIFIÉ dans son portail, et le fichier vit
 * dans le bucket public Supabase `seance-video`. Simple relais, en flux, avec
 * les requêtes partielles (Range) transmises — aucune copie en mémoire.
 */
export async function GET(req: Request, { params }: { params: { date: string } }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) return new Response('Date invalide.', { status: 400 });
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return new Response('Stockage indisponible.', { status: 503 });
  const range = req.headers.get('range');
  const r = await fetch(`${base}/storage/v1/object/public/seance-video/seance/${params.date}.mp4`, {
    headers: range ? { Range: range } : {},
    cache: 'no-store',
  });
  if (r.status === 404 || r.status === 400) return new Response('Vidéo introuvable.', { status: 404 });
  if (!r.ok || !r.body) return new Response('Vidéo indisponible.', { status: 502 });
  const entetes = new Headers({ 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=3600' });
  for (const h of ['content-length', 'content-range']) {
    const v = r.headers.get(h);
    if (v) entetes.set(h, v);
  }
  return new Response(r.body, { status: r.status, headers: entetes });
}
