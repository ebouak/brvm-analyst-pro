import { IncomeStatement as IS } from '@/lib/financials/types';
import { formatXOF } from '@/lib/financials/formatters';

interface Props {
  statements: IS[];
}

interface Row {
  key: keyof IS;
  label: string;
  bold: boolean;
}

const ROWS: Row[] = [
  { key: 'revenu_total', label: 'Revenus totaux', bold: true },
  { key: 'cout_ventes', label: 'Coût des ventes', bold: false },
  { key: 'marge_brute', label: 'Marge brute', bold: true },
  { key: 'depenses_exploitation', label: "Dépenses d'exploitation", bold: false },
  { key: 'frais_generaux_admin', label: 'Frais généraux et admin.', bold: false },
  { key: 'depenses_rd', label: 'R&D', bold: false },
  { key: 'autres_depenses', label: 'Autres dépenses', bold: false },
  { key: 'resultat_exploitation', label: "Résultat d'exploitation", bold: true },
  { key: 'charges_financieres_nettes', label: 'Charges financières nettes', bold: false },
  { key: 'resultat_avant_impots', label: 'Résultat avant impôts', bold: true },
  { key: 'impots', label: 'Impôts', bold: false },
  { key: 'resultat_net', label: 'Résultat net', bold: true },
  { key: 'benefice_par_action', label: 'BPA (de base)', bold: false },
  { key: 'benefice_par_action_dilue', label: 'BPA (dilué)', bold: false },
  { key: 'dividende_par_action', label: 'Dividende par action', bold: false },
  { key: 'actions_en_circulation', label: 'Actions en circulation', bold: false },
];

export default function IncomeStatement({ statements }: Props) {
  if (statements.length === 0) {
    return <p className="text-muted text-sm">Aucune donnée disponible.</p>;
  }

  const sorted = [...statements].sort((a, b) => a.periode.localeCompare(b.periode));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 pr-4 text-muted font-normal text-xs uppercase tracking-wider w-56">
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
          {ROWS.map((row) => (
            <tr key={row.key} className={row.bold ? 'font-semibold' : ''}>
              <td className="py-2 pr-4 text-muted text-xs">{row.label}</td>
              {sorted.map((s) => (
                <td key={s.periode} className="py-2 px-3 text-right tabular-nums">
                  {formatXOF(s[row.key] as number | null)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
