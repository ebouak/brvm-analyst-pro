import type { Famille } from '@/lib/financials/sectors';
import { SECTOR_KEYS } from '@/lib/financials/sectors';
import { SECTOR_LABELS } from '@/lib/financials/sectorLabels';

interface Props {
  famille: Famille;
  /** lignes_specifiques fusionnées (income + balance) du dernier exercice. */
  lignes: Record<string, number | null> | null;
}

function fmtValeur(key: string, v: number): string {
  // Les ratios (clé contenant exploitation/solvabilite/combine) sont des %.
  if (/exploitation|solvabilite|combine/.test(key)) return `${v.toFixed(1)} %`;
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)} Md`;
  return v.toLocaleString('fr-FR');
}

/** Affiche les lignes propres à la famille, dans l'ordre SECTOR_KEYS, en omettant les absentes. */
export default function SectorSpecificBlock({ famille, lignes }: Props) {
  if (famille === 'general' || !lignes) return null;
  const labels = SECTOR_LABELS[famille];
  const rows = SECTOR_KEYS[famille]
    .filter((k) => lignes[k] != null)
    .map((k) => ({ key: k, label: labels[k] ?? k, value: lignes[k] as number }));
  if (rows.length === 0) return null;

  const titre = famille === 'banque' ? 'Spécificités bancaires' : 'Spécificités assurance';
  return (
    <div className="bg-surface border border-border rounded-xl p-5 space-y-2">
      <h2 className="text-sm font-semibold text-white">{titre}</h2>
      <div className="space-y-0">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
            <span className="text-xs text-muted">{r.label}</span>
            <span className="tabular text-sm font-medium text-white">{fmtValeur(r.key, r.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
