import { createPublicClient } from '@/lib/supabase/public';

export const revalidate = 900;

const SITE = 'https://www.westbourse.com';

/**
 * Flux RSS 2.0 public : dernières actualités BRVM (brvm_news publiées) +
 * briefs quotidiens. Lisible par tout agrégateur (Feedly, lecteurs mail,
 * n8n/Zapier des partenaires…). Données réelles, aucun contenu inventé.
 */

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

interface Item {
  title: string;
  link: string;
  date: Date;
  description: string;
  guid: string;
}

export async function GET() {
  const sb = createPublicClient();

  const [{ data: news }, { data: briefs }] = await Promise.all([
    sb
      .from('brvm_news')
      .select('id, titre, resume, slug, date_publication, source_url, source_label, source_type')
      .order('date_publication', { ascending: false })
      .limit(30),
    sb
      .from('brief_daily')
      .select('date_marche, contenu')
      .order('date_marche', { ascending: false })
      .limit(7),
  ]);

  const items: Item[] = [];

  for (const n of (news ?? []) as {
    id: string; titre: string; resume: string | null; slug: string | null;
    date_publication: string; source_url: string | null; source_label: string | null; source_type: string | null;
  }[]) {
    // Lien interne quand l'article vit chez nous (analyses hebdo), sinon la veille.
    const link = n.slug?.startsWith('westbourse-commodities-weekly-')
      ? `${SITE}/weekly/${n.slug}`
      : `${SITE}/veille`;
    items.push({
      title: n.titre,
      link,
      date: new Date(`${n.date_publication}T07:00:00Z`),
      description: n.resume ?? `${n.source_label ?? 'Actualité'} — via la veille WESTBOURSE.`,
      guid: `news-${n.id}`,
    });
  }

  for (const b of (briefs ?? []) as { date_marche: string; contenu: string }[]) {
    items.push({
      title: `Brief BRVM — séance du ${b.date_marche}`,
      link: `${SITE}/brief/${b.date_marche}`,
      date: new Date(`${b.date_marche}T17:30:00Z`),
      description: b.contenu.slice(0, 600),
      guid: `brief-${b.date_marche}`,
    });
  }

  items.sort((a, b) => b.date.getTime() - a.date.getTime());

  const xmlItems = items
    .slice(0, 40)
    .map(
      (i) => `    <item>
      <title>${xmlEscape(i.title)}</title>
      <link>${xmlEscape(i.link)}</link>
      <guid isPermaLink="false">${xmlEscape(i.guid)}</guid>
      <pubDate>${i.date.toUTCString()}</pubDate>
      <description>${xmlEscape(i.description)}</description>
    </item>`,
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>WESTBOURSE — Actualités &amp; briefs BRVM</title>
    <link>${SITE}</link>
    <atom:link href="${SITE}/api/rss" rel="self" type="application/rss+xml"/>
    <description>Actualités du marché BRVM (UEMOA) et brief quotidien de séance — données réelles, veille automatisée WESTBOURSE.</description>
    <language>fr</language>
    <ttl>15</ttl>
${xmlItems}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=900',
    },
  });
}
