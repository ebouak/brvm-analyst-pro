'use client';

import { useMemo, useState } from 'react';
import type { CoutSGIResult } from '@/lib/sgi-frais/calculateur';
import type { SgiFrais, ConfianceNiveau } from '@/lib/sgi-frais/types';
import { CONFIANCE_LABEL, CONFIANCE_BADGE_CLASS } from '@/lib/sgi-frais/types';

type SortKey = 'sgiNom' | 'coutCourtage' | 'coutGarde' | 'coutTenue' | 'total' | 'pctCapital';

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

/**
 * Tableau comparatif du coût réel, une colonne par SGI, triable (par défaut
 * coût total croissant). Chaque cellule porte son badge de confiance —
 * jamais un chiffre sans son niveau de fiabilité affiché. Les champs
 * manquants sont signalés explicitement (jamais un 0 silencieux).
 */
export function TableauResultatCout({
  resultats,
  sgiParNom,
}: {
  resultats: CoutSGIResult[];
  sgiParNom: Map<string, SgiFrais>;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('total');
  const [asc, setAsc] = useState(true);

  const tries = useMemo(() => {
    const arr = [...resultats];
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return asc ? cmp : -cmp;
    });
    return arr;
  }, [resultats, sortKey, asc]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setAsc(!asc);
    else { setSortKey(k); setAsc(true); }
  }

  const Th = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <th
      onClick={() => toggleSort(k)}
      className={`px-3 py-2 cursor-pointer select-none hover:text-white ${right ? 'text-right' : 'text-left'}`}
    >
      {label}
      {sortKey === k && <span className="ml-1 text-info">{asc ? '▲' : '▼'}</span>}
    </th>
  );

  // Le "moins cher" reste toujours défini par le coût total, indépendamment du tri affiché.
  const moinsCherNom = useMemo(
    () => (resultats.length ? [...resultats].sort((a, b) => a.total - b.total)[0]!.sgiNom : null),
    [resultats],
  );

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs text-muted">
            <tr>
              <Th k="sgiNom" label="SGI" />
              <Th k="coutCourtage" label="Courtage" right />
              <th className="px-3 py-2 text-right">Réglementaire (BRVM/DC-BR)</th>
              <Th k="coutGarde" label="Droits de garde" right />
              <Th k="coutTenue" label="Tenue de compte" right />
              <th className="px-3 py-2 text-right">Virement</th>
              <Th k="total" label="Total" right />
              <Th k="pctCapital" label="% capital" right />
            </tr>
          </thead>
          <tbody>
            {tries.map((r) => {
              const sgi = sgiParNom.get(r.sgiNom);
              const confiance = sgi?.confiance ?? 'saisie_utilisateur';
              const estMoinsCher = r.sgiNom === moinsCherNom;
              return (
                <tr key={r.sgiNom} className={`border-t border-border/50 ${estMoinsCher ? 'bg-up/5' : ''}`}>
                  <td className="px-3 py-2">
                    <span className="font-medium text-white">{r.sgiNom}</span>
                    {estMoinsCher && <span className="ml-2 text-[10px] text-up">★ moins cher</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="tabular">{fmt(r.coutCourtage)}</div>
                    {r.champsManquants.includes('courtage') ? (
                      <span className="text-[10px] text-warn">Non renseigné</span>
                    ) : (
                      <Badge niveau={confiance} />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="tabular">{fmt(r.coutReglementaire)}</div>
                    <Badge niveau="homologue_crepmf" />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="tabular">{fmt(r.coutGarde)}</div>
                    {r.champsManquants.includes('droits_garde') ? (
                      <span className="text-[10px] text-warn">Non renseigné</span>
                    ) : (
                      <Badge niveau={confiance} />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="tabular">{fmt(r.coutTenue)}</div>
                    {r.champsManquants.includes('tenue_compte') ? (
                      <span className="text-[10px] text-warn">Non renseigné</span>
                    ) : (
                      <Badge niveau={confiance} />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="tabular">{fmt(r.coutVirement)}</div>
                    {r.champsManquants.includes('frais_virement') ? (
                      <span className="text-[10px] text-warn">Non renseigné</span>
                    ) : (
                      <Badge niveau={confiance} />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className="tabular font-semibold text-white">{fmt(r.total)}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular text-muted">{r.pctCapital.toFixed(2)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {resultats.some((r) => r.champsManquants.length > 0) && (
        <p className="text-[11px] text-warn">
          ⚠ Certains champs non renseignés comptent pour 0 FCFA dans le calcul — le coût réel de ces SGI est
          possiblement plus élevé. Renseignez-les si vous les connaissez.
        </p>
      )}

      <p className="text-[11px] text-faint leading-relaxed">
        Frais indicatifs sauf mention « barème homologué CREPMF ». Demandez toujours le barème complet écrit à la
        SGI avant d&apos;ouvrir un compte.
      </p>
    </div>
  );
}
