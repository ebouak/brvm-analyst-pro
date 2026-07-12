import { BalanceSheet as BS } from '@/lib/financials/types';
import type { Famille } from '@/lib/financials/sectors';
import { BALANCE_ROWS, getRowValue, visibleRows } from '@/lib/financials/statementRows';
import { formatStatementValue } from '@/lib/financials/formatters';

interface Props {
  statements: BS[];
  /** Détermine la structure du bilan (banque : dépôts/crédits ; assurance : provisions). */
  famille: Famille;
}

/**
 * Bilan présenté selon la famille comptable : un bilan bancaire n'a ni stocks
 * ni fournisseurs (crédits à l'actif, dépôts au passif) ; une assurance est
 * dominée par ses placements et ses provisions techniques.
 */
export default function BalanceSheet({ statements, famille }: Props) {
  if (statements.length === 0) {
    return <p className="text-muted text-sm">Aucune donnée disponible.</p>;
  }

  const sorted = [...statements].sort((a, b) => a.periode.localeCompare(b.periode));
  const rows = visibleRows(BALANCE_ROWS[famille], sorted);

  if (rows.length === 0) {
    return <p className="text-muted text-sm">Aucun poste renseigné pour cette période.</p>;
  }

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
          {rows.map((row, idx) => {
            if (row.section) {
              return (
                <tr key={`section-${row.key}`} className="bg-surface/50">
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
                    {formatStatementValue(getRowValue(row, s), row.format)}
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
