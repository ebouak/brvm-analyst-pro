import Link from 'next/link';

/**
 * Navigation commune aux sous-pages de la fiche action (états financiers,
 * revue, fiche quant, rapport) : retour à la fiche + la même rangée de
 * documents que la barre de la fiche. Largeur et marges alignées sur la fiche.
 */
export function documentsFiche(code: string) {
  return [
    { href: `/actions/${code}/revue`, label: 'Revue de résultats' },
    { href: `/actions/${code}/financials`, label: 'États financiers' },
    { href: `/rapports/dossier/${code}`, label: 'Dossier A4' },
    { href: `/actions/${code}/quant`, label: 'Fiche Quant' },
  ];
}

const pastille =
  'inline-flex items-center max-md:min-h-[44px] whitespace-nowrap rounded-full border px-2.5 py-1 text-xs transition-colors';

export default function SousPageNav({ code, courant }: { code: string; courant?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-xs text-faint">
        <Link href={`/actions/${code}`} className="inline-flex items-center gap-1 text-muted transition-colors hover:text-accent-ink">
          <span aria-hidden>‹</span> Retour à la fiche {code}
        </Link>
      </nav>
      <div className="flex flex-wrap gap-2">
        {documentsFiche(code).map((d) => {
          const actif = d.label === courant;
          return (
            <Link
              key={d.href}
              href={d.href}
              aria-current={actif ? 'page' : undefined}
              className={`${pastille} ${actif ? 'border-accent bg-accent/10 text-accent-ink' : 'border-border text-muted hover:border-accent hover:text-accent-ink'}`}
            >
              {d.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
