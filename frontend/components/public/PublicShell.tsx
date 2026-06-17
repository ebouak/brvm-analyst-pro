import Link from 'next/link';
import { RATING_DISCLAIMER } from '@/lib/rating';

/**
 * Shell des pages publiques SEO (/societes, /simulateur, /brief) :
 * header léger avec CTA inscription, footer avec disclaimer.
 * Composant serveur — aucun état client.
 */
export default function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <header className="border-b border-border/60 bg-surface/60 backdrop-blur sticky top-0 z-40 print:hidden">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-4">
          <Link href="/" className="font-display text-white text-lg tracking-tight hover:text-accent transition-colors">
            BRVM <span className="text-accent">Analyst Pro</span>
          </Link>
          <nav className="flex items-center gap-2 md:gap-4 text-sm" aria-label="Navigation principale">
            <Link href="/societes" className="text-muted hover:text-white transition-colors hidden sm:block">
              Sociétés
            </Link>
            <Link href="/comparateur-sgi" className="text-muted hover:text-white transition-colors hidden sm:block">
              SGI
            </Link>
            <Link href="/simulateur" className="text-muted hover:text-white transition-colors hidden sm:block">
              Simulateur
            </Link>
            <Link href="/simulateur-budget" className="text-muted hover:text-white transition-colors hidden md:block">
              Budget
            </Link>
            <Link href="/brief" className="text-muted hover:text-white transition-colors hidden md:block">
              Brief
            </Link>
            <Link href="/login" className="text-muted hover:text-white transition-colors">
              Connexion
            </Link>
            <Link
              href="/signup"
              className="px-3.5 py-1.5 rounded-lg bg-accent text-bg font-semibold hover:bg-gold-2 transition-colors active:scale-95"
            >
              Créer un compte
            </Link>
          </nav>
        </div>
        {/* Rangée mobile : les sections publiques restent accessibles au pouce */}
        <nav
          className="sm:hidden border-t border-border/40 px-4 h-10 flex items-center gap-5 text-[13px] overflow-x-auto"
          aria-label="Sections publiques"
        >
          <Link href="/societes" className="text-muted hover:text-white transition-colors shrink-0">
            Sociétés
          </Link>
          <Link href="/comparateur-sgi" className="text-muted hover:text-white transition-colors shrink-0">
            SGI
          </Link>
          <Link href="/simulateur" className="text-muted hover:text-white transition-colors shrink-0">
            Simulateur
          </Link>
          <Link href="/simulateur-budget" className="text-muted hover:text-white transition-colors shrink-0">
            Budget
          </Link>
          <Link href="/brief" className="text-muted hover:text-white transition-colors shrink-0">
            Brief
          </Link>
        </nav>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 md:px-6 py-8">{children}</main>

      <footer className="border-t border-border/60 mt-12 print:hidden">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-2">
          <p className="text-[11px] text-faint leading-relaxed">{RATING_DISCLAIMER}</p>
          <p className="text-[11px] text-faint">
            Données : BRVM, publications officielles des émetteurs. Performances passées ne préjugent pas des
            performances futures. ·{' '}
            <Link href="/mentions-legales" className="underline hover:text-muted">
              Mentions légales
            </Link>{' '}
            ·{' '}
            <Link href="/methodologie" className="underline hover:text-muted">
              Méthodologie
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
