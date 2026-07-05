import Link from 'next/link';
import { FooterCookieLink } from '@/components/FooterCookieLink';
import { FINANCIAL_DISCLAIMER } from '@/lib/legal/disclaimer';
import { AnimatedLogo } from '@/components/brand/AnimatedLogo';
import { SocialLinks } from '@/components/SocialLinks';
import InstallPwaButton from '@/components/InstallPwaButton';

const PRODUIT = [
  { href: '/societes', label: 'Sociétés' },
  { href: '/simulateur', label: 'Simulateur' },
  { href: '/classement', label: 'Classement papier' },
  { href: '/brief', label: 'Brief du jour' },
  { href: '/methodologie', label: 'Méthodologie' },
  { href: '/pricing', label: 'Tarifs' },
  { href: '/developers', label: 'API développeurs' },
  { href: '/api/rss', label: 'Flux RSS' },
];

const LEGAL = [
  { href: '/mentions-legales', label: 'Mentions légales' },
  { href: '/cgu', label: "Conditions d'utilisation" },
  { href: '/confidentialite', label: 'Confidentialité' },
];

/** Lien de footer premium : soulignement cyan qui se déploie + léger décalage au survol. */
function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group/link relative inline-flex w-fit items-center text-[#fff]/75 transition-all duration-200 hover:translate-x-0.5 hover:text-[#fff] focus:outline-none focus-visible:text-[#fff]"
    >
      {label}
      <span className="pointer-events-none absolute -bottom-0.5 left-0 h-px w-0 bg-gradient-to-r from-[#56d7fd] to-transparent transition-all duration-300 ease-out group-hover/link:w-full" />
    </Link>
  );
}

/** En-tête de colonne avec point d'accent qui s'allume au survol de la colonne. */
function ColHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-[#fff]/55">
      <span className="h-1 w-1 rounded-full bg-[#fff]/35 transition-colors duration-300 group-hover/col:bg-[#56d7fd]" />
      {children}
    </p>
  );
}

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    // Fond FIXE sombre quel que soit le thème → couleurs littérales (#fff/…),
    // pas de tokens : `text-white` est aliasé sur l'ivoire réactif au thème et
    // deviendrait quasi noir (illisible) en mode clair sur ce fond sombre.
    <footer className="relative overflow-hidden border-t border-[rgba(255,255,255,0.1)] bg-[#06090b] px-6 py-12 text-sm">
      {/* Filet dégradé animé en haut */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#56d7fd]/60 to-transparent footer-sheen" />
      {/* Halo cyan diffus en fond */}
      <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[40rem] -translate-x-1/2 rounded-full bg-[#56d7fd]/[0.04] blur-3xl" />

      <div className="relative mx-auto grid max-w-6xl grid-cols-2 gap-8 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <Link
            href="/"
            aria-label="WESTBOURSE — accueil"
            className="group inline-flex items-center gap-2 rounded-lg transition-all duration-300 hover:[filter:drop-shadow(0_0_10px_rgba(86,215,253,0.45))] focus:outline-none focus:ring-2 focus:ring-[#56d7fd]/50"
          >
            <span className="transition-transform duration-300 group-hover:scale-105">
              <AnimatedLogo size={34} variant="mark" animate={false} />
            </span>
            <span className="font-display font-semibold text-[#fff] transition-colors duration-300 group-hover:text-[#56d7fd]">
              WESTBOURSE
            </span>
          </Link>
          <p className="mt-3 max-w-xs text-xs text-[#fff]/65">
            Analyse et aide à la décision d&apos;investissement sur la BRVM (UEMOA).
          </p>
          <div className="mt-4">
            <p className="mb-2 text-xs uppercase tracking-wider text-[#fff]/55">Suivez-nous</p>
            <SocialLinks />
          </div>
          {/* N'apparaît que si le navigateur propose l'installation PWA. */}
          <div className="mt-4">
            <InstallPwaButton />
          </div>
        </div>

        <nav aria-label="Produit" className="group/col">
          <ColHeader>Produit</ColHeader>
          <ul className="mt-3 space-y-2">
            {PRODUIT.map((l) => (
              <li key={l.href}>
                <FooterLink href={l.href} label={l.label} />
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Légal" className="group/col">
          <ColHeader>Légal</ColHeader>
          <ul className="mt-3 space-y-2">
            {LEGAL.map((l) => (
              <li key={l.href}>
                <FooterLink href={l.href} label={l.label} />
              </li>
            ))}
            <li><FooterCookieLink /></li>
          </ul>
        </nav>

        <nav aria-label="Compte" className="group/col">
          <ColHeader>Compte</ColHeader>
          <ul className="mt-3 space-y-2">
            <li><FooterLink href="/login" label="Connexion" /></li>
            <li><FooterLink href="/signup" label="Créer un compte" /></li>
          </ul>
        </nav>
      </div>

      <div className="relative mx-auto mt-10 max-w-6xl border-t border-[rgba(255,255,255,0.05)] pt-6">
        <p className="text-[11px] leading-relaxed text-[#fff]/50">{FINANCIAL_DISCLAIMER}</p>
        <p className="mt-3 text-[11px] text-[#fff]/45">© {year} WESTBOURSE. Tous droits réservés.</p>
      </div>
    </footer>
  );
}
