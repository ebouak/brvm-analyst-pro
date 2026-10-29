import { NextResponse } from 'next/server';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';

export const runtime = 'nodejs';

/**
 * Image CARRÉE d'un article publié, en JPEG — pour TikTok, qui refuse le PNG
 * (photos : JPEG ou WebP seulement, 1080p au plus) et ne prend une photo que
 * par URL publique, sur un préfixe vérifié dans le portail développeur
 * (`https://www.westbourse.com/api/articles/`).
 *
 * L'image est celle de la route Edge /image?format=carre (une seule source de
 * dessin), ré-encodée en JPEG par deux bibliothèques en JavaScript pur — pas
 * de `sharp` (voir CLAUDE.md sur libheif). On ne rend PAS next/og ici : en
 * Node, sous Windows, il ne résout pas le chemin de sa police (mesuré le
 * 2026-10-29, « Invalid URL »). La route Edge applique déjà la RLS : un
 * brouillon y renvoie 404, et ici aussi.
 */
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const origine = new URL(req.url).origin;
  const r = await fetch(`${origine}/api/articles/${encodeURIComponent(params.slug)}/image?format=carre`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (r.status === 404) return NextResponse.json({ erreur: 'Article introuvable.' }, { status: 404 });
  if (!r.ok) return NextResponse.json({ erreur: 'Image indisponible.' }, { status: 502 });

  const brut = PNG.sync.read(Buffer.from(await r.arrayBuffer()));
  const jpg = jpeg.encode({ data: brut.data, width: brut.width, height: brut.height }, 88).data;
  return new NextResponse(new Uint8Array(jpg), {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=3600, s-maxage=86400' },
  });
}
