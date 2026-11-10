import type { ReactNode } from 'react';

/** Sous-section d'une rubrique de la fiche : un seul format de titre partout (spec v2 § 4). */
export function SousSection({ id, titre, pied, action, children }: { id: string; titre: string; pied?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id={`${id}-h`} className="text-lg font-medium text-ivory">{titre}</h3>
        {action}
      </div>
      {children}
      {pied && <p className="mt-2 text-xs text-faint">{pied}</p>}
    </section>
  );
}
