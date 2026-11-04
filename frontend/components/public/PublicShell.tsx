import Link from 'next/link';
import { RATING_DISCLAIMER } from '@/lib/rating';
import { SiteHeader } from '@/components/layout/SiteHeader';

/**
 * Pages publiques SEO — header unifie SiteHeader, footer disclaimer conserve.
 * `pleineLargeur` : la page gère elle-même largeur et marges (bandeau bord à
 * bord du comparateur SGI) ; sinon, colonne centrée de 1 152 px.
 */
export default function PublicShell({ children, pleineLargeur = false }: { children: React.ReactNode; pleineLargeur?: boolean }) {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <SiteHeader />
      <main className={pleineLargeur ? 'flex-1 w-full' : 'flex-1 max-w-6xl mx-auto w-full px-4 md:px-6 py-8'}>{children}</main>
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
