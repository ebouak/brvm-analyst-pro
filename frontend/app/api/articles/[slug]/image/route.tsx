import { NextResponse } from 'next/server';
import { createPublicClient } from '@/lib/supabase/public';
import { imageArticle, type FormatImage } from '@/lib/articles/image';
import { COLONNES_ARTICLE, type Article } from '@/lib/articles/types';
import brvmLogos from '@/lib/brvmLogos.json';

export const runtime = 'edge';

/**
 * Image publique d'un article PUBLIÉ : la clé anon ne voit que ceux-là (RLS de
 * 0167). Un brouillon renvoie 404. `?format=carre` pour WhatsApp et Telegram.
 */
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const url = new URL(req.url);
  const format: FormatImage = url.searchParams.get('format') === 'carre' ? 'carre' : 'paysage';
  const { data } = await createPublicClient().from('articles').select(COLONNES_ARTICLE).eq('slug', params.slug).maybeSingle();
  if (!data) return NextResponse.json({ erreur: 'Article introuvable.' }, { status: 404 });
  const a = data as Article;
  // next/og ne lit que PNG et JPEG : un logo GIF ou SVG retombe sur les initiales.
  const chemin = a.code ? (brvmLogos as Record<string, string>)[a.code] : undefined;
  const logo = chemin && /\.(png|jpe?g)$/i.test(chemin) ? `${url.origin}${chemin}` : null;
  return imageArticle(a, format, logo);
}
