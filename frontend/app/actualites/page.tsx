import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import { LIBELLE_TYPE } from '@/lib/articles/types';
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
    .not('hidden', 'is', true) // modération rédactionnelle
    .lte('date_publication', new Date().toISOString().slice(0, 10)) // jamais d'actu datée dans le futur
    .order('date_publication', { ascending: false })
    .limit(100);

  const news = (data ?? []) as NewsItem[];

  // Nos articles (donnée BRVM, spec 2026-10-28) : la RLS ne laisse voir que les publiés.
  const { data: arts } = await supabase
    .from('articles')
    .select('slug, type, titre, chapo, publie_le')
    .order('publie_le', { ascending: false })
    .limit(12);
  const articles = (arts ?? []) as { slug: string; type: string; titre: string; chapo: string }[];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <SectionHeader
        kicker="Marché · BRVM · COSUMAF"
        title="Actualités"
        subtitle="Communiqués officiels et presse économique sur la BRVM et l’UEMOA, mis à jour chaque jour. La source de chaque article est indiquée."
      />
      <ViewTabs tabs={INTEL_TABS} current="/actualites" />

      {articles.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[11px] uppercase tracking-wide text-faint">Nos articles</h2>
          <ul className="space-y-3">
            {articles.map((a) => (
              <li key={a.slug} className="rounded-xl border border-border bg-surface p-4 transition hover:border-accent/40">
                <Link href={`/actualites/${a.slug}`} className="block space-y-1">
                  <span className="text-[11px] uppercase tracking-wide text-accent">{LIBELLE_TYPE[a.type] ?? 'Article'}</span>
                  <p className="font-medium text-white">{a.titre}</p>
                  <p className="line-clamp-2 text-sm text-muted">{a.chapo}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

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
