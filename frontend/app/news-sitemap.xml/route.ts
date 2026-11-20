import { NextResponse } from 'next/server';
import { loadSyndicationArticles } from '@/lib/syndication/articles';
import { buildNewsSitemapXml } from '@/lib/syndication/newsSitemap';

export const revalidate = 300;

export async function GET() {
  try {
    const xml = buildNewsSitemapXml(await loadSyndicationArticles(1000));
    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });
  } catch (error) {
    console.error('[news-sitemap] Génération impossible', error);
    return new NextResponse('News sitemap temporairement indisponible', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
}
