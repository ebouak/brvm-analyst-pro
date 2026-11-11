import Link from 'next/link';
import { RATING_DISCLAIMER } from '@/lib/rating';
import { SiteHeader } from '@/components/layout/SiteHeader';
import FilAriane from '@/components/nav/FilAriane';

/**
 * Pages publiques SEO — header unifie SiteHeader, footer disclaimer conserve.
 * Fil d'Ariane public (avec données structurées BreadcrumbList) en tête du
 * contenu ; `filLibelle` nomme le dernier maillon d'une page dynamique ;
 * `fil={false}` quand la page est déjà dans le shell applicatif (qui pose le sien).
 * `pleineLargeur` : la page gère elle-même largeur et marges (bandeau bord à
 * bord du comparateur SGI) ; sinon, colonne centrée de 1 152 px.
 */
export default function PublicShell({
  children,
  pleineLargeur = false,
  fil = true,
  filLibelle,
}: {
  children: React.ReactNode;
  pleineLargeur?: boolean;
  fil?: boolean;
  filLibelle?: string | null;
}) {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <SiteHeader />
      <main className={pleineLargeur ? 'flex-1 w-full' : 'flex-1 max-w-6xl mx-auto w-full px-4 md:px-6 py-8'}>
        {fil && (
          <FilAriane
            variante="public"
            libelle={filLibelle}
            className={pleineLargeur ? 'mx-auto max-w-6xl px-4 pt-4 md:px-6' : 'mb-6'}
          />
        )}
        {children}
      </main>
      <footer className="border-t border-border/60 mt-12 print:hidden">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-2">
          <p className="text-[11px] text-faint leading-relaxed">{RATING_DISCLAIMER}</p>
          <p className="text-[11px] text-faint">
            Données : BRVM, publications officielles. Performances passées ne préjugent pas des performances futures. ·{' '}
            <Link href="/mentions-legales" className="underline hover:text-muted">Mentions légales</Link> ·{' '}
            <Link href="/methodologie" className="underline hover:text-muted">Méthodologie</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
