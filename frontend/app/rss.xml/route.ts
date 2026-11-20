import { NextResponse } from 'next/server';
import { loadSyndicationArticles } from '@/lib/syndication/articles';
import { buildRssXml } from '@/lib/syndication/rss';

export const revalidate = 300;

export async function GET() {
  try {
    const xml = buildRssXml(await loadSyndicationArticles());
    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });
  } catch (error) {
    console.error('[rss] Chargement du flux impossible', error);
    return new NextResponse('Flux RSS temporairement indisponible', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
}
