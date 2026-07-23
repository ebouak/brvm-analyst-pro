import type { FundamentalRatios } from '@/lib/financials/types';
import { computeValuation, VERDICT_LABELS, VERDICT_COLORS } from '@/lib/financials/valuation';

interface FundaRow {
  code: string;
  designation: string | null;
  ratios: FundamentalRatios;
  coursActuel: number | null;
  fcf: number | null;
  shares: number | null;
}

const COLORS = ['#3fe18b', '#56D7FD', '#ffb300', '#7e57c2', '#f44336', '#e6e9f0'];

/**
 * Multiples sans signification quand le denominateur est negatif : un PER
 * negatif dit que la societe perd de l'argent, pas que le titre est bon marche.
 * Meme regle que FundamentalsTable (lib/fundamentals.ts, qualite 'ns').
 */
const NS_SI_NEGATIF = new Set<keyof FundamentalRatios>(['per', 'pb']);

const ROWS: { key: keyof FundamentalRatios; label: string; fmt: (v: number) => string }[] = [
  { key: 'per',                label: 'PER',                     fmt: (v) => v.toFixed(1) + 'x' },
  { key: 'pb',                 label: 'P/B',                     fmt: (v) => v.toFixed(2) + 'x' },
  { key: 'rendement_dividende',label: 'Rdt dividende',            fmt: (v) => v.toFixed(2) + '%' },
  { key: 'roe',                label: 'ROE',                     fmt: (v) => v.toFixed(1) + '%' },
  { key: 'marge_nette',        label: 'Marge nette',             fmt: (v) => v.toFixed(1) + '%' },
  { key: 'bpa',                label: 'BPA (FCFA)',              fmt: (v) => Math.round(v).toLocaleString('fr-FR') },
  { key: 'dette_sur_capitaux_propres', label: 'Dette / Capitaux', fmt: (v) => v.toFixed(2) + 'x' },
  { key: 'croissance_ca',      label: 'Croiss. CA',             fmt: (v) => (v >= 0 ? '+' : '') + v.toFixed(1) + '%' },
];

export default function CompareFundamentals({ rows }: { rows: FundaRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <span className="text-xs text-muted uppercase tracking-wide">Fondamentaux comparés</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-2 text-left text-faint font-normal">Indicateur</th>
              {rows.map((r, i) => (
                <th key={r.code} className="px-4 py-2 text-right font-semibold"
                  style={{ color: COLORS[i % COLORS.length] }}>
                  {r.code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(({ key, label, fmt }) => (
              <tr key={key} className="border-b border-border/50 last:border-0 hover:bg-white/2 transition">
                <td className="px-4 py-2 text-muted">{label}</td>
                {rows.map((r) => {
                  const v = r.ratios[key];
                  if (v != null && NS_SI_NEGATIF.has(key) && (v as number) < 0) {
                    return (
                      <td key={r.code} className="px-4 py-2 text-right text-muted/70"
                          title="Non significatif : résultat (ou capitaux propres) négatif — le ratio n'a pas de sens financier, la donnée est correcte.">
                        n.s.
                      </td>
                    );
                  }
                  return (
                    <td key={r.code} className="px-4 py-2 text-right tabular text-ivory">
                      {v != null ? fmt(v as number) : <span className="text-faint">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* Ligne valorisation */}
            <tr className="border-b border-border/50 hover:bg-white/2 transition">
              <td className="px-4 py-2 text-muted font-semibold">Valorisation</td>
              {rows.map((r) => {
                const val = computeValuation(r.ratios, r.coursActuel, r.fcf, r.shares);
                return (
                  <td key={r.code} className="px-4 py-2 text-right">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${VERDICT_COLORS[val.verdict]}`}>
                      {VERDICT_LABELS[val.verdict]}
                    </span>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
