'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { phCapture } from '@/lib/analytics/posthogClient';

/** Lien qui capture un événement au clic (sans effet tant que le consentement manque, cf. phCapture). */
export function LienSuivi({
  href,
  evenement,
  proprietes,
  className,
  children,
}: {
  href: string;
  evenement: string;
  proprietes?: Record<string, unknown>;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={className} onClick={() => { void phCapture(evenement, proprietes); }}>
      {children}
    </Link>
  );
}
