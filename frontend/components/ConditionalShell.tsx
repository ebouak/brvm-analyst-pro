'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

/** Routes affichées en plein écran, sans la sidebar (landing publique). */
const BARE_ROUTES = new Set<string>(['/']);

/**
 * Décide d'envelopper ou non les pages dans le shell applicatif (sidebar + main).
 * La landing (`/`) est rendue plein écran ; toutes les autres pages gardent le shell.
 */
export default function ConditionalShell({
  isPremium,
  children,
}: {
  isPremium: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (BARE_ROUTES.has(pathname)) return <>{children}</>;

  return (
    <div className="flex min-h-screen">
      <Sidebar isPremium={isPremium} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
