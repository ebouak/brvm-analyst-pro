import { CashFlowStatement as CFS } from '@/lib/financials/types';
import { formatXOF } from '@/lib/financials/formatters';

interface Props {
  statements: CFS[];
}

interface Row {
  key: keyof CFS | '__section__';
  label: string;
  bold: boolean;
  indent: boolean;
  section?: boolean;
}

const ROWS: Row[] = [
  { key: '__section__', label: 'EXPLOITATION', bold: true, indent: false, section: true },
  { key: 'flux_exploitation', label: "Flux d'exploitation", bold: true, indent: false },
  { key: 'resultat_net', label: 'Résultat net', bold: false, indent: true },
  { key: 'depreciation_amortissement', label: 'Amortissements & dépréciations', bold: false, indent: true },
  { key: 'impots_reportes', label: 'Impôts reportés', bold: false, indent: true },
  { key: 'remuneration_actions', label: 'Rémunération en actions', bold: false, indent: true },
  { key: 'variation_bfr', label: 'Variation du BFR', bold: false, indent: true },
  { key: 'autres_elements_hors_caisse', label: 'Autres éléments hors caisse', bold: false, indent: true },

  { key: '__section__', label: 'INVESTISSEMENT', bold: true, indent: false, section: true },
  { key: 'flux_investissement', label: "Flux d'investissement", bold: true, indent: false },
  { key: 'investissements_ppe', label: 'Investissements (PP&E)', bold: false, indent: true },
  { key: 'acquisitions', label: 'Acquisitions', bold: false, indent: true },
  { key: 'achats_placements', label: 'Achats de placements', bold: false, indent: true },
  { key: 'ventes_placements', label: 'Ventes de placements', bold: false, indent: true },
  { key: 'autres_activites_investissement', label: 'Autres activités', bold: false, indent: true },

  { key: '__section__', label: 'FINANCEMENT', bold: true, indent: false, section: true },
  { key: 'flux_financement', label: 'Flux de financement', bold: true, indent: false },
  { key: 'remboursement_dette', label: 'Remboursement de dettes', bold: false, indent: true },
  { key: 'dividendes_verses', label: 'Dividendes versés', bold: false, indent: true },
  { key: 'rachats_actions', label: "Rachats d'actions", bold: false, indent: true },
  { key: 'emissions_actions', label: "Émissions d'actions", bold: false, indent: true },
  { key: 'autres_activites_financement', label: 'Autres activités', bold: false, indent: true },

  { key: '__section__', label: 'RÉCAPITULATIF', bold: true, indent: false, section: true },
  { key: 'effet_forex_tresorerie', label: 'Effet change trésorerie', bold: false, indent: false },
  { key: 'variation_tresorerie', label: 'Variation de trésorerie', bold: true, indent: false },
  { key: 'tresorerie_debut_periode', label: 'Trésorerie début période', bold: false, indent: false },
  { key: 'tresorerie_fin_periode', label: 'Trésorerie fin période', bold: false, indent: false },
  { key: 'depenses_capital', label: "Dépenses d'investissement (CapEx)", bold: false, indent: false },
  { key: 'flux_tresorerie_disponible', label: 'Flux de trésorerie disponible', bold: true, indent: false },
];

export default function CashFlowStatement({ statements }: Props) {
  if (statements.length === 0) {
    return <p className="text-muted text-sm">Aucune donnée disponible.</p>;
  }

  const sorted = [...statements].sort((a, b) => a.periode.localeCompare(b.periode));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 pr-4 text-muted font-normal text-xs uppercase tracking-wider w-64">
              Poste
            </th>
            {sorted.map((s) => (
              <th
                key={s.periode}
                className="text-right py-2 px-3 text-muted font-normal text-xs uppercase tracking-wider min-w-[120px]"
              >
                {s.periode}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {ROWS.map((row, idx) => {
            if (row.section) {
              return (
                <tr key={`section-${idx}`} className="bg-surface/50">
                  <td
                    colSpan={sorted.length + 1}
                    className="py-2 pr-4 text-xs uppercase tracking-widest text-gray-400 font-semibold pt-4"
                  >
                    {row.label}
                  </td>
                </tr>
              );
            }
            return (
              <tr key={`${row.key}-${idx}`} className={row.bold ? 'font-semibold' : ''}>
                <td className={`py-2 pr-4 text-muted text-xs${row.indent ? ' pl-4' : ''}`}>
                  {row.label}
                </td>
                {sorted.map((s) => (
                  <td key={s.periode} className="py-2 px-3 text-right tabular-nums">
                    {formatXOF(s[row.key as keyof CFS] as number | null)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
