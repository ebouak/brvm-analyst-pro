'use client';

import { usePathname } from 'next/navigation';

/**
 * Masque tout le chrome applicatif (splash, bannière cookies, analytics,
 * service worker, palette, onboarding) sur les pages `/embed/*`, qui sont
 * servies dans des iframes de sites tiers : aucun cookie, aucun traceur.
 *
 * C'est ce qui permet de promettre aux médias partenaires que l'intégration
 * d'un widget ne déclenche aucune obligation de consentement chez eux.
 */
export default function NonEmbedChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith('/embed')) return null;
  return <>{children}</>;
}
