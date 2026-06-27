import { createPublicClient } from '@/lib/supabase/public';
import VeilleDashboard from '@/components/veille/VeilleDashboard';
import { SectionHeader } from '@/components/ui/premium';

export const revalidate = 300;
export const metadata = { title: 'Veille Intelligence BRVM — WESTBOURSE' };

export type VeilleNews = {
  id: string;
  titre: string;
  date_publication: string;
  source: string;
  source_label: string | null;
  source_url: string | null;
  resume: string | null;
  instrument_code: string | null;
  secteur: string | null;
  sentiment: string | null;
  score_impact: number | null;
  ticker_codes: string[] | null;
  image_url: string | null;
  created_at: string;
};

async function fetchVeilleData() {
  const sb = createPublicClient();
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const { data: news } = await sb
    .from('brvm_news')
    .select(
      'id,titre,date_publication,source,source_label,source_url,resume,' +
        'instrument_code,secteur,sentiment,score_impact,ticker_codes,image_url,created_at',
    )
    .gte('date_publication', since7d)
    .lte('date_publication', today)
    .eq('hidden', false)
    .order('date_publication', { ascending: false })
    .order('score_impact', { ascending: false })
    .limit(200);

  const items = (news ?? []) as unknown as VeilleNews[];
  const todayItems = items.filter((n) => n.date_publication === today);
  const alertes = items.filter((n) => (n.score_impact ?? 0) >= 70);

  const coveredTickers = new Set<string>();
  for (const n of items) {
    if (n.instrument_code) coveredTickers.add(n.instrument_code);
    for (const t of n.ticker_codes ?? []) coveredTickers.add(t);
  }

  const secteurMap = new Map<string, number>();
  for (const n of items) {
    if (n.secteur) secteurMap.set(n.secteur, (secteurMap.get(n.secteur) ?? 0) + 1);
  }
  const secteurs = [...secteurMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([secteur, count]) => ({ secteur, count }));

  const sourceMap = new Map<string, number>();
  for (const n of items) {
    const lbl = n.source_label ?? n.source;
    sourceMap.set(lbl, (sourceMap.get(lbl) ?? 0) + 1);
  }
  const topSources = [...sourceMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, count]) => ({ label, count }));

  return {
    news: items,
    stats: {
      total7d: items.length,
      today: todayItems.length,
      alertes: alertes.length,
      covered: coveredTickers.size,
      totalSocietes: 47,
    },
    secteurs,
    topSources,
  };
}

export default async function VeillePage() {
  const { news, stats, secteurs, topSources } = await fetchVeilleData();

  return (
    <div className="min-h-screen bg-bg px-4 py-6 space-y-6 max-w-7xl mx-auto">
      <SectionHeader
        kicker="Intelligence · 47 sociétés · 150+ sources"
        title="Veille BRVM"
        subtitle="Surveillance automatisée des actualités marché — mis à jour quotidiennement."
      />
      <VeilleDashboard
        news={news}
        stats={stats}
        secteurs={secteurs}
        topSources={topSources}
      />
    </div>
  );
}
