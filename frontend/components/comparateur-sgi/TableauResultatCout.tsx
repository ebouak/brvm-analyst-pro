'use client';

import { useMemo, useState } from 'react';
import type { CoutSGIResult } from '@/lib/sgi-frais/calculateur';
import { estSousDepotMinimum } from '@/lib/sgi-frais/calculateur';
import type { SgiFrais, ConfianceNiveau, Frequence } from '@/lib/sgi-frais/types';
import { CONFIANCE_LABEL, CONFIANCE_BADGE_CLASS } from '@/lib/sgi-frais/types';
import { PAYS, type Sgi } from '@/lib/sgi-frais/directory';

type SortKey = 'sgiNom' | 'pays' | 'depotMinimum' | 'courtagePct' | 'gardePct' | 'total';

const FREQ_ABBR: Record<Frequence, string> = { annuel: 'an', trimestriel: 'trim', semestriel: 'sem' };

function fmt(n: number): string {
  return Math.round(n).toLocaleString('fr-FR') + ' FCFA';
}

function Badge({ niveau }: { niveau: ConfianceNiveau }) {
  return (
    <span className={`inline-block rounded-full border px-1.5 py-0.5 text-[9px] font-semibold leading-none ${CONFIANCE_BADGE_CLASS[niveau]}`}>
      {CONFIANCE_LABEL[niveau]}
    </span>
  );
}

interface Row {
  sgiNom: string;
  pays: string;
  type: string;
  depotMinimum: number;
  courtagePct: number | null;
  gardePct: number | null;
  gardeFreq: Frequence | null;
  confiance: ConfianceNiveau;
  total: number;
  sousDepotMin: boolean;
  champCourtageManquant: boolean;
  champGardeManquant: boolean;
}

/**
 * Tableau comparatif du coût réel — toutes les SGI filtrées, triées par
 * défaut par coût total croissant, triable par colonne. Les taux (courtage,
 * conservation) sont affichés bruts pour comparer indépendamment du montant ;
 * le Total reflète le scénario saisi. Champs manquants toujours signalés
 * (jamais un 0 silencieux). Pas de colonne « app mobile »/« ordre en ligne » :
 * aucune donnée vérifiée n'existe sur ces critères.
 */
export function TableauResultatCout({
  resultats,
  sgiParNom,
  directoryParNom,
  montant,
}: {
  resultats: CoutSGIResult[];
  sgiParNom: Map<string, SgiFrais>;
  directoryParNom: Map<string, Sgi>;
  montant: number;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('total');
  const [asc, setAsc] = useState(true);

  const rows = useMemo<Row[]>(
    () =>
      resultats.map((r) => {
        const sgi = sgiParNom.get(r.sgiNom);
        const dir = directoryParNom.get(r.sgiNom);
        const courtagePct = sgi ? sgi.courtagePctMax ?? sgi.courtagePctMin : null;
        const gardePct = sgi ? sgi.droitsGardePctMax ?? sgi.droitsGardePctMin : null;
        return {
          sgiNom: r.sgiNom,
          pays: dir ? PAYS[dir.pays].nom : '—',
          type: dir?.type ?? '—',
          depotMinimum: sgi?.depotMinimum ?? 0,
          courtagePct,
          gardePct,
          gardeFreq: sgi?.droitsGardeFrequence ?? null,
          confiance: sgi?.confiance ?? 'saisie_utilisateur',
          total: r.total,
          sousDepotMin: sgi ? estSousDepotMinimum(sgi, montant) : false,
          champCourtageManquant: r.champsManquants.includes('courtage'),
          champGardeManquant: r.champsManquants.includes('droits_garde'),
        };
      }),
    [resultats, sgiParNom, directoryParNom, montant],
  );

  const tries = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return asc ? cmp : -cmp;
    });
    return arr;
  }, [rows, sortKey, asc]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setAsc(!asc);
    else {
      setSortKey(k);
      setAsc(true);
    }
  }

  const Th = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <th
      onClick={() => toggleSort(k)}
      aria-sort={sortKey === k ? (asc ? 'ascending' : 'descending') : 'none'}
      className={`px-3 py-2 cursor-pointer select-none hover:text-white ${right ? 'text-right' : 'text-left'}`}
    >
      {label}
      {sortKey === k && <span className="ml-1 text-info">{asc ? '▲' : '▼'}</span>}
    </th>
  );

  if (tries.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
        Aucune SGI ne correspond à ces filtres.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs text-muted">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <Th k="sgiNom" label="SGI" />
              <Th k="pays" label="Pays" />
              <th className="px-3 py-2 text-left">Type</th>
              <Th k="depotMinimum" label="Dépôt min." right />
              <Th k="courtagePct" label="Courtage" right />
              <Th k="gardePct" label="Conservation" right />
              <Th k="total" label="Total" right />
            </tr>
          </thead>
          <tbody>
            {tries.map((r, i) => (
              <tr key={r.sgiNom} className={`border-t border-border/50 ${i === 0 ? 'bg-up/5' : ''}`}>
                <td className="px-3 py-2 tabular text-faint">{i + 1}</td>
                <td className="px-3 py-2">
                  <span className="font-medium text-white">{r.sgiNom}</span>
                  {i === 0 && <span className="ml-2 text-[10px] text-up">★ moins cher</span>}
                  <div className="mt-0.5">
                    <Badge niveau={r.confiance} />
                  </div>
                </td>
                <td className="px-3 py-2 text-muted">{r.pays}</td>
                <td className="px-3 py-2 text-muted">{r.type}</td>
                <td className="px-3 py-2 text-right">
                  <div className="tabular">{r.depotMinimum > 0 ? fmt(r.depotMinimum) : 'Aucun'}</div>
                  {r.sousDepotMin && (
                    <span className="text-[10px] text-warn" title="Montant investi inférieur au dépôt minimum">
                      ⚠ insuffisant
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {r.champCourtageManquant ? (
                    <span className="text-[10px] text-warn">Non renseigné</span>
                  ) : (
                    <span className="tabular">{r.courtagePct}%</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {r.champGardeManquant || r.gardePct == null ? (
                    <span className="text-[10px] text-warn">Non renseigné</span>
                  ) : (
                    <span className="tabular">
                      {r.gardePct}%{r.gardeFreq ? `/${FREQ_ABBR[r.gardeFreq]}` : ''}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <span className="tabular font-semibold text-white">{fmt(r.total)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.some((r) => r.champCourtageManquant || r.champGardeManquant) && (
        <p className="text-[11px] text-warn">
          ⚠ Certains taux non renseignés comptent pour 0 FCFA dans le Total — le coût réel de ces SGI est
          possiblement plus élevé.
        </p>
      )}

      <p className="text-[11px] text-faint leading-relaxed">
        Taux indicatifs sauf mention « barème homologué CREPMF ». Le Total inclut aussi la tenue de compte et les
        frais de virement quand connus (non détaillés dans ce tableau). Demandez toujours le barème complet écrit à
        la SGI avant d&apos;ouvrir un compte.
      </p>
    </div>
  );
}
