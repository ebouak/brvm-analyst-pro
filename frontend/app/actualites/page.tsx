import { createPublicClient } from '@/lib/supabase/public';
import { SectionHeader } from '@/components/ui/premium';
import NewsList, { type NewsItem } from '@/components/actualites/NewsList';
import ViewTabs from '@/components/ViewTabs';
import { INTEL_TABS } from '@/lib/viewTabsPresets';

// Données publiques (RLS lecture publique) rafraîchies par le scraper :
// ISR 5 min suffit, pas besoin de rendu dynamique par visiteur.
export const revalidate = 300;
export const metadata = { title: 'Actualités BRVM' };

export default async function ActualitesPage() {
  const supabase = createPublicClient();
  // select('*') → inclut image_url dès que la migration 0054 est appliquée
  // (sans casser avant : la colonne est simplement absente).
  const { data } = await supabase
    .from('brvm_news')
    .select('*')
    .lte('date_publication', new Date().toISOString().slice(0, 10)) // jamais d'actu datée dans le futur
    .order('date_publication', { ascending: false })
    .limit(100);

  const news = (data ?? []) as NewsItem[];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <SectionHeader
        kicker="Marché · BRVM · COSUMAF"
        title="Actualités"
        subtitle="Communiqués officiels BRVM et COSUMAF mis à jour quotidiennement."
      />
      <ViewTabs tabs={INTEL_TABS} current="/actualites" />

      {news.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-10 text-center">
          <p className="text-muted text-sm">
            Aucune actualité pour le moment. Le fil se met à jour automatiquement chaque jour ouvré.
          </p>
        </div>
      ) : (
        <NewsList items={news} />
      )}
    </div>
  );
}
