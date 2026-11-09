import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import { LIBELLE_TYPE } from '@/lib/articles/types';
import { EmptyStatePremium } from '@/components/ui/premium';
import { EnTeteCote } from '@/components/marche/EnTeteCote';
import { LigneSource } from '@/components/marche/LigneSource';
import { Chapitre } from '@/components/fiche/Chapitre';
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

  const dernier = news[0]?.date_publication ?? null;
  let n = 0;
  const numero = () => String(++n).padStart(2, '0');

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <EnTeteCote
        titre="Actualités"
        description="Communiqués officiels et presse économique sur la BRVM et l’UEMOA, mis à jour chaque jour. La source de chaque article est indiquée."
        seance={dernier}
        libelleSeance="Dernière parution le"
        source={null}
      />
      <div className="mt-6">
        <ViewTabs tabs={INTEL_TABS} current="/actualites" />
      </div>

      {articles.length > 0 && (
        <section aria-labelledby="nos-articles">
          <Chapitre
            id="nos-articles"
            numero={numero()}
            titre="Nos articles"
            sousTitre="Rédigés à partir des données de la cote et des publications officielles."
            premier
          />
          <ul className="mt-6 space-y-3">
            {articles.map((a) => (
              <li key={a.slug} className="rounded-card border border-border bg-surface p-4 transition-colors hover:border-accent/40">
                <Link href={`/actualites/${a.slug}`} className="block space-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                  <span className="text-xs text-accent-ink">{LIBELLE_TYPE[a.type] ?? 'Article'}</span>
                  <p className="font-medium text-ivory">{a.titre}</p>
                  <p className="line-clamp-2 text-sm text-muted">{a.chapo}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="fil">
        <Chapitre
          id="fil"
          numero={numero()}
          titre="Fil de veille"
          sousTitre="Communiqués et presse, du plus récent au plus ancien, filtrables par source et par période."
          premier={articles.length === 0}
        />
        <div className="mt-6">
          {news.length === 0 ? (
            <EmptyStatePremium
              title="Aucune actualité pour le moment"
              hint="Le fil se met à jour automatiquement chaque jour ouvré."
            />
          ) : (
            <NewsList items={news} />
          )}
        </div>
        {news.length > 0 && <LigneSource>Chaque article renvoie à sa source d’origine. Fil limité aux {news.length} parutions les plus récentes, avant filtres.</LigneSource>}
      </section>
    </div>
  );
}
