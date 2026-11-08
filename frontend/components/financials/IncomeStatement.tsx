import { IncomeStatement as IS } from '@/lib/financials/types';
import type { Famille } from '@/lib/financials/sectors';
import { INCOME_ROWS, getRowValue, visibleRows } from '@/lib/financials/statementRows';
import { formatStatementValue } from '@/lib/financials/formatters';

interface Props {
  statements: IS[];
  /** Détermine la cascade comptable (banque : PNB ; assurance : primes). */
  famille: Famille;
}

/**
 * Compte de résultat présenté selon la famille comptable de l'émetteur :
 * cascade bancaire (PNB), assurantielle (primes/sinistres) ou industrielle.
 * Les postes sans aucune valeur sur la période sont masqués (pas de tableau
 * de tirets), et chaque valeur est formatée dans SON unité.
 */
export default function IncomeStatement({ statements, famille }: Props) {
  if (statements.length === 0) {
    return <p className="text-muted text-sm">Aucune donnée disponible.</p>;
  }

  const sorted = [...statements].sort((a, b) => a.periode.localeCompare(b.periode));
  const rows = visibleRows(INCOME_ROWS[famille], sorted);

  if (rows.length === 0) {
    return <p className="text-muted text-sm">Aucun poste renseigné pour cette période.</p>;
  }

  return (
    <div className="overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" tabIndex={0} role="region" aria-label="Tableau défilant : faites défiler horizontalement avec les flèches du clavier">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 pr-4 text-muted font-normal text-xs w-56">
              Poste
            </th>
            {sorted.map((s) => (
              <th
                key={s.periode}
                className="text-right py-2 px-3 text-muted font-normal text-xs min-w-[120px]"
              >
                {s.periode}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {rows.map((row) => (
            <tr key={row.key} className={row.bold ? 'font-semibold' : ''}>
              <td className="py-2 pr-4 text-muted text-xs">{row.label}</td>
              {sorted.map((s) => (
                <td key={s.periode} className="py-2 px-3 text-right tabular-nums">
                  {formatStatementValue(getRowValue(row, s), row.format)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
