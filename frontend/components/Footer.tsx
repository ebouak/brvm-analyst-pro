import Link from 'next/link';
import { FooterCookieLink } from '@/components/FooterCookieLink';
import { FINANCIAL_DISCLAIMER } from '@/lib/legal/disclaimer';

const PRODUIT = [
  { href: '/societes', label: 'Sociétés' },
  { href: '/simulateur', label: 'Simulateur' },
  { href: '/brief', label: 'Brief du jour' },
];

const LEGAL = [
  { href: '/mentions-legales', label: 'Mentions légales' },
  { href: '/cgu', label: "Conditions d'utilisation" },
  { href: '/confidentialite', label: 'Confidentialité' },
];

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-white/10 bg-[#06090b] px-6 py-12 text-sm">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-[#56d7fd]/40 bg-[#56d7fd]/10 font-display text-lg font-bold text-[#56d7fd]">B</span>
            <span className="font-display font-semibold text-white">BRVM Analyst Pro</span>
          </div>
          <p className="mt-3 max-w-xs text-xs text-white/45">Analyse et aide à la décision d&apos;investissement sur la BRVM (UEMOA).</p>
        </div>

        <nav aria-label="Produit">
          <p className="text-xs uppercase tracking-wider text-white/35">Produit</p>
          <ul className="mt-3 space-y-2">
            {PRODUIT.map((l) => (
              <li key={l.href}><Link href={l.href} className="text-white/55 transition-colors hover:text-white">{l.label}</Link></li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Légal">
          <p className="text-xs uppercase tracking-wider text-white/35">Légal</p>
          <ul className="mt-3 space-y-2">
            {LEGAL.map((l) => (
              <li key={l.href}><Link href={l.href} className="text-white/55 transition-colors hover:text-white">{l.label}</Link></li>
            ))}
            <li><FooterCookieLink /></li>
          </ul>
        </nav>

        <nav aria-label="Compte">
          <p className="text-xs uppercase tracking-wider text-white/35">Compte</p>
          <ul className="mt-3 space-y-2">
            <li><Link href="/login" className="text-white/55 transition-colors hover:text-white">Connexion</Link></li>
            <li><Link href="/signup" className="text-white/55 transition-colors hover:text-white">Créer un compte</Link></li>
          </ul>
        </nav>
      </div>

      <div className="mx-auto mt-10 max-w-6xl border-t border-white/5 pt-6">
        <p className="text-[11px] leading-relaxed text-white/35">{FINANCIAL_DISCLAIMER}</p>
        <p className="mt-3 text-[11px] text-white/30">© {year} BRVM Analyst Pro. Tous droits réservés.</p>
      </div>
    </footer>
  );
}
