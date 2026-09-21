import Link from 'next/link';
import { OutilsMenu } from './OutilsMenu';
import { MenuMobile } from './MenuMobile';
import { AnimatedLogo } from '@/components/brand/AnimatedLogo';

/**
 * En-tête des pages publiques claires (/ et /debutant). Toutes les cibles
 * existent : /societes, /analyses, /formations, /methodologie (« À propos »),
 * /login, /signup. « Marchés » renvoie à la séance sur la landing.
 * Sous 1 000 px : logo, CTA d'inscription (toujours visible) et un menu
 * dépliant propre aux pages publiques (MenuMobile).
 */
export function LandingNav({ marchesHref = '/#marche' }: { marchesHref?: string }) {
  return (
    <header className="nav">
      <Link className="brand" href="/" aria-label="WESTBOURSE, accueil">
        <AnimatedLogo size={36} variant="mark" animate={false} />
        <span><b>WESTBOURSE</b><small>Comprendre aujourd&apos;hui, investir demain</small></span>
      </Link>
      <nav className="nav-links" aria-label="Principal">
        <Link href={marchesHref} className="opt">Marchés</Link>
        <Link href="/societes" className="opt">Sociétés</Link>
        <Link href="/analyses" className="opt">Analyses</Link>
        <Link href="/formations" className="opt">Formations</Link>
        <OutilsMenu />
        <Link href="/methodologie" className="opt">À propos</Link>
        <Link href="/login" className="opt login">Se connecter</Link>
        <Link href="/signup" className="btn btn-ink btn-sm" style={{ marginLeft: 8 }}>Créer mon compte gratuit</Link>
        <MenuMobile />
      </nav>
    </header>
  );
}
