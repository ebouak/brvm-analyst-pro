import Link from 'next/link';
import { OutilsMenu } from './OutilsMenu';

/**
 * En-tête des pages publiques claires (/ et /debutant). Toutes les cibles
 * existent : /societes, /analyses, /formations, /methodologie (« À propos »),
 * /login, /signup. « Marchés » renvoie à la séance sur la landing.
 * Sur mobile, seuls le logo et « Créer un compte » restent visibles — le CTA
 * d'inscription ne quitte jamais l'écran.
 */
export function LandingNav({ marchesHref = '/#marche' }: { marchesHref?: string }) {
  return (
    <header className="nav">
      <Link className="brand" href="/" aria-label="WESTBOURSE, accueil">
        <svg width="34" height="34" viewBox="0 0 40 40" aria-hidden="true"><path d="M4 8l8 24 8-16 8 16 8-24" fill="none" stroke="#1f6fb3" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" /><path d="M12 8l8 16" stroke="#1ba8c9" strokeWidth="5" strokeLinecap="round" /></svg>
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
        <Link href="/signup" className="btn btn-ink btn-sm" style={{ marginLeft: 8 }}>Créer un compte</Link>
      </nav>
    </header>
  );
}
