'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import MobileNav from '@/components/MobileNav';
import BottomNav from '@/components/BottomNav';
import Footer from '@/components/Footer';
import BeginnerBanner from '@/components/BeginnerBanner';
import ContactNudge from '@/components/contact/ContactNudge';

/** Routes affichées en plein écran, sans la sidebar (landing + auth). */
const BARE_ROUTES = new Set<string>(['/', '/login', '/signup']);

/** Sections publiques SEO : plein écran avec leur propre header (PublicShell). */
const BARE_PREFIXES = [
  '/societes',
  '/simulateur',
  '/simulateur-budget',
  '/brief',
  '/pricing',
  '/comparateur-sgi',
  '/fiscalite',
  '/rendement-reel',
  // Widgets embarquables : rendus nus dans des iframes tierces (ni sidebar,
  // ni footer, ni encart de contact) — cf. spec widgets §5.
  '/embed',
  '/debutant',
  '/developers',
  '/formations/academy', // plein écran — l'Academy a sa propre UI (sidebar, nav)
];

/** Pages légales : publiques, plein écran, AVEC footer. */
const LEGAL_PREFIXES = ['/mentions-legales', '/cgu', '/confidentialite'];

/** Routes publiques qui doivent afficher le footer global. */
function showsFooter(pathname: string): boolean {
  if (pathname === '/login' || pathname === '/signup') return false;
  // /debutant a son propre thème clair (cream/teal) → pas du footer global sombre.
  if (pathname.startsWith('/debutant')) return false;
  // /formations/academy est plein écran (iframe) → aucun chrome global.
  if (pathname.startsWith('/formations/academy')) return false;
  // /embed : widget dans une iframe tierce — un footer y serait absurde.
  if (pathname.startsWith('/embed')) return false;
  if (pathname === '/') return true;
  return [...BARE_PREFIXES, ...LEGAL_PREFIXES].some((p) => pathname.startsWith(p));
}

/**
 * Décide d'envelopper ou non les pages dans le shell applicatif (sidebar + main).
 * La landing (`/`), les pages publiques et les pages légales sont rendues plein
 * écran ; toutes les autres pages gardent le shell. Le footer global s'affiche
 * sur les routes publiques (jamais dans l'app authentifiée, ni sur /login·/signup).
 */
export default function ConditionalShell({
  isPremium,
  isAdmin = false,
  children,
}: {
  isPremium: boolean;
  isAdmin?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Encart de contact : partout sauf authentification, console admin et Academy plein écran.
  const showNudge =
    pathname !== '/login' &&
    pathname !== '/signup' &&
    !pathname.startsWith('/admin') &&
    !pathname.startsWith('/embed') && // widget tiers : aucun chrome
    !pathname.startsWith('/formations/academy');
  // /admin a sa propre console (layout dédié) → pas de shell applicatif ni footer.
  const bare =
    BARE_ROUTES.has(pathname) ||
    pathname.startsWith('/admin') ||
    BARE_PREFIXES.some((p) => pathname.startsWith(p)) ||
    LEGAL_PREFIXES.some((p) => pathname.startsWith(p));

  if (bare) {
    return (
      <>
        {pathname === '/' && <BeginnerBanner />}
        {children}
        {showsFooter(pathname) && <Footer />}
        {showNudge && <ContactNudge />}
      </>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar isPremium={isPremium} isAdmin={isAdmin} />
      <div className="flex-1 min-w-0">
        <MobileNav isPremium={isPremium} isAdmin={isAdmin} />
        {/* pb-16 : réserve la hauteur de la BottomNav mobile (56px + safe-area). */}
        <main className="min-w-0 pb-16 md:pb-0">{children}</main>
      </div>
      <BottomNav />
      {showNudge && <ContactNudge />}
    </div>
  );
}
