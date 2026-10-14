'use client';

import { useState } from 'react';
import Link from 'next/link';
import { fmtDateFR } from '@/lib/format';
import type { PublicationBloc } from '@/lib/dashboard/publications';
import { Pastille } from './Cadre';
import OngletsFiltre, { type Onglet } from './OngletsFiltre';

/** Onglets par type : `libelle` est la valeur exacte de `typeLibelle`. */
const PAR_TYPE = [
  { cle: 'etats', libelle: 'États financiers', type: 'États financiers', toujours: true },
  { cle: 'rapports', libelle: 'Rapports', type: 'Rapport', toujours: true },
  { cle: 'communiques', libelle: 'Communiqués', type: 'Communiqué', toujours: true },
  { cle: 'ag', libelle: 'Assemblées générales', type: 'Assemblée générale', toujours: false },
  { cle: 'notations', libelle: 'Notations', type: 'Notation', toujours: false },
] as const;

/** Liste de publications filtrable (props sérialisables). */
export default function FiltresPublications({ items }: { items: PublicationBloc[] }) {
  const [actif, setActif] = useState('tous');
  const onglets: Onglet[] = [{ cle: 'tous', libelle: 'Tous' }];
  if (items.some((p) => p.mienne)) onglets.push({ cle: 'miennes', libelle: 'Mes valeurs' });
  for (const t of PAR_TYPE) {
    if (t.toujours || items.some((p) => p.typeLibelle === t.type)) onglets.push({ cle: t.cle, libelle: t.libelle });
  }

  const type = PAR_TYPE.find((t) => t.cle === actif)?.type;
  const liste = items.filter((p) => (actif === 'tous' ? true : actif === 'miennes' ? p.mienne : p.typeLibelle === type));

  return (
    <>
      <OngletsFiltre onglets={onglets} actif={actif} onChange={setActif} label="Filtrer les publications" />
      {liste.length === 0 ? (
        <p className="py-3 text-sm text-muted">Aucun élément pour ce filtre.</p>
      ) : (
        <ul className="divide-y divide-border/50">
          {liste.map((p, i) => (
            <li key={`${p.code}-${p.date}-${p.url ?? p.libelle}-${i}`} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="tabular text-xs text-muted">{fmtDateFR(p.date)}</span>
                <Pastille>{p.typeLibelle}</Pastille>
                {p.mienne && <Pastille accent>Détenue</Pastille>}
                <Link href={`/actions/${p.code}`} className="text-xs font-semibold text-accent-ink hover:underline">{p.code}</Link>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 break-words text-sm text-ivory">{p.libelle}</p>
                {p.url && (
                  <a href={p.url} target="_blank" rel="noopener noreferrer" aria-label={`Document : ${p.libelle} (nouvel onglet)`} className="shrink-0 text-xs text-accent-ink hover:underline">
                    Document <span aria-hidden>↗</span>
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
