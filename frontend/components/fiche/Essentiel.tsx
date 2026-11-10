import Link from 'next/link';
import type { ReactNode } from 'react';
export interface CarteEssentiel { href: string; etiquette: string; titre: ReactNode; detail: ReactNode }
export function Essentiel({ cartes }: { cartes: CarteEssentiel[] }) {
  if (cartes.length === 0) return null;
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cartes.map((c) => (
          <Link key={c.etiquette} href={c.href} className="block rounded-card border border-border bg-surface p-5 transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <p className="text-xs text-faint">{c.etiquette}</p>
            <p className="mt-1 text-[17px] text-ivory">{c.titre}</p>
            <p className="mt-2 text-[13px] text-muted">{c.detail}</p>
          </Link>
        ))}
      </div>
      <p className="mt-3 text-xs text-faint">Constats tirés de la séance et des comptes publiés. Ce n&apos;est pas un conseil en investissement.</p>
    </div>
  );
}
