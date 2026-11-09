'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import type { SectorPerf } from '@/lib/sectors';
import { fmtFcfa, fmtNumber, fmtPctSigne } from '@/lib/format';

type Col = 'secteur' | 'count' | 'coursMean' | 'varDay' | 'var5d' | 'var30d' | 'var90d' | 'var1y' | 'volumeDay';

interface Props {
  perfs: SectorPerf[];
}

/**
 * Libellés en toutes lettres, et la définition de chaque colonne telle que
 * `lib/sectors.ts` la calcule (moyennes simples, jours calendaires).
 */
const COLS: { key: Col; label: string; definition: string; numerique: boolean }[] = [
  { key: 'secteur', label: 'Secteur', definition: 'Secteur de cotation de la société.', numerique: false },
  { key: 'varDay', label: 'Séance', definition: 'Moyenne des variations de la séance des valeurs du secteur.', numerique: true },
  { key: 'count', label: 'Valeurs', definition: 'Nombre de sociétés cotées dans le secteur.', numerique: true },
  { key: 'coursMean', label: 'Cours moyen', definition: 'Moyenne simple des derniers cours de clôture du secteur, en FCFA.', numerique: true },
  { key: 'var5d', label: '5 jours', definition: 'Moyenne des variations de chaque valeur depuis le cours d’il y a 5 jours calendaires.', numerique: true },
  { key: 'var30d', label: '30 jours', definition: 'Même calcul sur 30 jours calendaires : la tendance du mois.', numerique: true },
  { key: 'var90d', label: '90 jours', definition: 'Même calcul sur 90 jours calendaires : la tendance du trimestre.', numerique: true },
  { key: 'var1y', label: '1 an', definition: 'Même calcul sur 365 jours.', numerique: true },
  { key: 'volumeDay', label: 'Échangé', definition: 'Valeur totale échangée sur la séance par les valeurs du secteur, en FCFA. « — » : pas encore publiée pour la séance.', numerique: true },
];

function VarCell({ v }: { v: number | null }) {
  if (v == null) return <span className="text-faint">—</span>;
  const cls = v > 0 ? 'text-up' : v < 0 ? 'text-down' : 'text-muted';
  return <span className={`tabular font-medium ${cls}`}>{fmtPctSigne(v)}</span>;
}

export default function SectorRankingTable({ perfs }: Props) {
  const [sortCol, setSortCol] = useState<Col>('varDay');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  function handleSort(col: Col) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir(col === 'secteur' ? 'asc' : 'desc');
    }
  }

  const sorted = [...perfs].sort((a, b) => {
    const av = a[sortCol];
    const bv = b[sortCol];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = typeof av === 'string'
      ? av.localeCompare(bv as string, 'fr')
      : (av as number) - (bv as number);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const colTri = COLS.find((c) => c.key === sortCol);

  return (
    <div>
      <div
        tabIndex={0}
        role="region"
        aria-label="Performance des secteurs, défilement horizontal"
        className="overflow-x-auto rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <table className="w-full text-sm">
          <caption className="sr-only">
            Performance de chaque secteur sur la séance, 5 jours, 30 jours, 90 jours et un an.
            {colTri && ` Trié par ${colTri.label.toLowerCase()}, ordre ${sortDir === 'asc' ? 'croissant' : 'décroissant'}.`}
          </caption>
          <thead>
            <tr className="border-b border-border">
              {COLS.map((col, i) => {
                const actif = sortCol === col.key;
                const Icone = !actif ? ChevronsUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={actif ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={`whitespace-nowrap px-2 py-1.5 font-medium ${col.numerique ? 'text-right' : 'text-left'} ${i === 0 ? 'sticky left-0 z-10 bg-surface' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      title={col.definition}
                      className={`inline-flex min-h-[44px] items-center gap-1 rounded-md px-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${col.numerique ? 'flex-row-reverse' : ''} ${actif ? 'text-ivory' : 'text-muted hover:text-ivory'}`}
                    >
                      {col.label}
                      <Icone size={13} strokeWidth={1.75} aria-hidden className={actif ? 'text-accent-ink' : 'text-faint'} />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const href = `/heatmap?secteur=${encodeURIComponent(p.secteur)}`;
              return (
                <tr key={p.secteur} className="group border-b border-border/60 transition-colors last:border-0 hover:bg-sunken">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 whitespace-nowrap bg-surface px-4 py-3 text-left font-medium transition-colors group-hover:bg-sunken"
                  >
                    <Link
                      href={href}
                      className="rounded-sm text-ivory transition-colors hover:text-accent-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {p.secteur}
                    </Link>
                  </th>
                  <td className="px-4 py-3 text-right"><VarCell v={p.varDay} /></td>
                  <td className="tabular px-4 py-3 text-right text-muted">{p.count}</td>
                  <td className="tabular px-4 py-3 text-right text-ivory">
                    {p.coursMean != null ? fmtNumber(p.coursMean, 0) : <span className="text-faint">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right"><VarCell v={p.var5d} /></td>
                  <td className="px-4 py-3 text-right"><VarCell v={p.var30d} /></td>
                  <td className="px-4 py-3 text-right"><VarCell v={p.var90d} /></td>
                  <td className="px-4 py-3 text-right"><VarCell v={p.var1y} /></td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-ivory">
                    {p.volumeDay != null
                      ? <><span className="tabular">{fmtFcfa(p.volumeDay)}</span> <span className="text-xs text-faint">FCFA</span></>
                      : <span className="text-faint" title="Valeur échangée non publiée pour cette séance">—</span>}
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={COLS.length} className="px-4 py-8 text-center text-muted">
                  Aucun secteur à classer pour cette séance.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Définition des colonnes : lisible au clavier et au doigt, pas seulement au survol. */}
      <details className="group/def border-t border-border px-4 py-3 text-xs text-muted">
        <summary className="inline-flex min-h-[44px] cursor-pointer items-center rounded-sm text-muted transition-colors hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:min-h-0">
          Comment lire ce tableau
        </summary>
        <dl className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
          {COLS.slice(1).map((c) => (
            <div key={c.key}>
              <dt className="inline font-medium text-ivory">{c.label} : </dt>
              <dd className="inline">{c.definition}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-faint">Cliquez sur un en-tête pour trier ; un second clic inverse l’ordre.</p>
      </details>
    </div>
  );
}
