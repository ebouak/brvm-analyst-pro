import type { ReactNode } from 'react';

const SPAN = { 4: 'lg:col-span-4', 6: 'lg:col-span-6', 8: 'lg:col-span-8', 12: 'lg:col-span-12' } as const;

/** Rangée interne d'une section (sans filet bas : la page le pose). */
export function GrilleInterne({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 lg:grid-cols-12">{children}</div>;
}

export function Cellule({ span, children }: { span: keyof typeof SPAN; children: ReactNode }) {
  return (
    <div className={`min-w-0 ${SPAN[span]} border-t border-border first:border-t-0 lg:border-t-0 lg:border-l lg:first:border-l-0`}>
      {children}
    </div>
  );
}

/** En-tête de bloc : titre en serif d'affichage, élément à droite (lien, pastille). */
export function TeteBloc({ id, titre, droite }: { id: string; titre: ReactNode; droite?: ReactNode }) {
  return (
    <header className="mb-3.5 flex flex-wrap items-baseline justify-between gap-3">
      <h2 id={id} className="font-display text-[19px] leading-tight text-ivory">{titre}</h2>
      {droite}
    </header>
  );
}

/** Bloc plat : padding seul ; les filets viennent de la rangée et des cellules. */
export function Bloc({ id, children, className = '' }: { id: string; children: ReactNode; className?: string }) {
  return <section aria-labelledby={id} className={`h-full min-w-0 py-5 lg:px-5 ${className}`}>{children}</section>;
}
