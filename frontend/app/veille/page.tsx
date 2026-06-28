import { createPublicClient } from '@/lib/supabase/public';
import VeilleDashboard from '@/components/veille/VeilleDashboard';
import { SectionHeader } from '@/components/ui/premium';

export const revalidate = 60;
export const metadata = { title: 'Veille Intelligence BRVM — WESTBOURSE' };

export type VeilleNews = {
  id: string;
  titre: string;
  date_publication: string;
  source: string;
  source_label: string | null;
  source_type: string | null;
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
  // 90 jours côté serveur — le client filtre ensuite par période (7j/30j/90j)
  const since90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data: news } = await sb
    .from('brvm_news')
    .select('*')
    .gte('date_publication', since90d)
    .order('date_publication', { ascending: false })
    .limit(2000);

  return { news: (news ?? []) as unknown as VeilleNews[] };
}

export default async function VeillePage() {
  const { news } = await fetchVeilleData();

  return (
    <div className="min-h-screen bg-bg px-4 py-6 space-y-6 max-w-7xl mx-auto">
      <SectionHeader
        kicker="Intelligence · 47 sociétés · 150+ sources"
        title="Veille BRVM"
        subtitle="Surveillance automatisée des actualités marché — mis à jour quotidiennement."
      />
      <VeilleDashboard news={news} />
    </div>
  );
}
