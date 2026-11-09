import type { ReactNode } from 'react';
import { fmtDateCourte } from '@/lib/format';

/**
 * En-tête des pages de marché, sur le modèle de la fiche action : le titre,
 * puis une ligne de cote (séance, compte, source) tirée de la donnée. Une
 * information absente retire son segment, jamais de « — » de remplissage.
 */
export function EnTeteCote({
  titre,
  description,
  seance,
  libelleSeance = 'Séance du',
  compte,
  source = 'Source BRVM',
  actions,
}: {
  titre: string;
  description: ReactNode;
  seance?: string | null;
  libelleSeance?: string;
  compte?: { n: number; libelle: string } | null;
  source?: string | null;
  actions?: ReactNode;
}) {
  const segments: ReactNode[] = [];
  if (seance) {
    segments.push(
      <span key="s" className="whitespace-nowrap">
        {libelleSeance} <time dateTime={seance} className="text-ivory">{fmtDateCourte(seance)}</time>
      </span>,
    );
  }
  if (compte) {
    segments.push(
      <span key="c" className="whitespace-nowrap">
        <span className="tabular text-ivory">{compte.n.toLocaleString('fr-FR')}</span> {compte.libelle}
      </span>,
    );
  }
  if (source) segments.push(<span key="o" className="whitespace-nowrap">{source}</span>);

  return (
    <header>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight text-ivory md:text-4xl">{titre}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {segments.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          {segments.map((s, i) => (
            <span key={i}>
              {i > 0 && <span aria-hidden className="mx-2 text-faint">·</span>}
              {s}
            </span>
          ))}
        </p>
      )}
    </header>
  );
}
