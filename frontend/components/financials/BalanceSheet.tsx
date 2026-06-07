import { BalanceSheet as BS } from '@/lib/financials/types';
import { formatXOF } from '@/lib/financials/formatters';

interface Props {
  statements: BS[];
}

interface Row {
  key: keyof BS | '__section__';
  label: string;
  bold: boolean;
  indent: boolean;
  section?: boolean;
}

const ROWS: Row[] = [
  { key: '__section__', label: 'ACTIF', bold: true, indent: false, section: true },
  { key: 'total_actifs', label: 'Total des actifs', bold: true, indent: false },
  { key: 'total_actif_circulant', label: 'Actif circulant', bold: true, indent: true },
  { key: 'tresorerie_equivalents', label: 'Trésorerie & équivalents', bold: false, indent: true },
  { key: 'investissements_court_terme', label: 'Investissements CT', bold: false, indent: true },
  { key: 'creances_clients', label: 'Créances clients', bold: false, indent: true },
  { key: 'stocks', label: 'Stocks', bold: false, indent: true },
  { key: 'autres_actifs_courants', label: 'Autres actifs courants', bold: false, indent: true },
  { key: 'total_actif_non_courant', label: 'Actif non courant', bold: true, indent: true },
  { key: 'immobilisations_nettes', label: 'Immobilisations nettes', bold: false, indent: true },
  { key: 'goodwill', label: 'Goodwill', bold: false, indent: true },
  { key: 'actifs_incorporels', label: 'Actifs incorporels', bold: false, indent: true },
  { key: 'investissements_long_terme', label: 'Investissements LT', bold: false, indent: true },
  { key: 'autres_actifs_financiers', label: 'Autres actifs financiers', bold: false, indent: true },

  { key: '__section__', label: 'PASSIF', bold: true, indent: false, section: true },
  { key: 'total_passif', label: 'Total du passif', bold: true, indent: false },
  { key: 'passif_courant', label: 'Passif courant', bold: true, indent: true },
  { key: 'fournisseurs', label: 'Fournisseurs', bold: false, indent: true },
  { key: 'dette_court_terme', label: 'Dettes CT', bold: false, indent: true },
  { key: 'revenus_differes_courants', label: 'Revenus différés', bold: false, indent: true },
  { key: 'autres_passifs_courants', label: 'Autres passifs courants', bold: false, indent: true },
  { key: 'passif_non_courant', label: 'Passif non courant', bold: true, indent: true },
  { key: 'dette_long_terme', label: 'Dettes LT', bold: false, indent: true },
  { key: 'autres_passifs_non_courants', label: 'Autres passifs non courants', bold: false, indent: true },
  { key: 'impots_differes_passifs', label: 'Impôts différés passifs', bold: false, indent: true },

  { key: '__section__', label: 'CAPITAUX PROPRES', bold: true, indent: false, section: true },
  { key: 'total_capitaux_propres', label: 'Total capitaux propres', bold: true, indent: false },
  { key: 'capital_social', label: 'Capital social', bold: false, indent: true },
  { key: 'reserves_benefices_non_repartis', label: 'Réserves & bénéfices non répartis', bold: false, indent: true },
  { key: 'autres_capitaux_propres', label: 'Autres capitaux propres', bold: false, indent: true },
  { key: 'interets_minoritaires', label: 'Intérêts minoritaires', bold: false, indent: true },
];

export default function BalanceSheet({ statements }: Props) {
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
                    {formatXOF(s[row.key as keyof BS] as number | null)}
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
