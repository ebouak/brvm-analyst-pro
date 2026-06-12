'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import MobileNav from '@/components/MobileNav';

/** Routes affichées en plein écran, sans la sidebar (landing + auth). */
const BARE_ROUTES = new Set<string>(['/', '/login', '/signup']);

/** Sections publiques SEO : plein écran avec leur propre header (PublicShell). */
const BARE_PREFIXES = ['/societes', '/simulateur', '/brief'];

/**
 * Décide d'envelopper ou non les pages dans le shell applicatif (sidebar + main).
 * La landing (`/`) et les pages publiques sont rendues plein écran ;
 * toutes les autres pages gardent le shell.
 */
export default function ConditionalShell({
  isPremium,
  children,
}: {
  isPremium: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (BARE_ROUTES.has(pathname) || BARE_PREFIXES.some((p) => pathname.startsWith(p)))
    return <>{children}</>;

  return (
    <div className="flex min-h-screen">
      <Sidebar isPremium={isPremium} />
      <div className="flex-1 min-w-0">
        <MobileNav isPremium={isPremium} />
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
