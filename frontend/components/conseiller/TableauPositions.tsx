import Link from 'next/link';
import { FAMILLES, libelleTier, type LigneFacteurs } from '@/lib/conseiller/facteurs';

/** Positions par famille pour toute la cote. Jamais de verdict ni de couleur sémantique. */
export function TableauPositions({ lignes }: { lignes: LigneFacteurs[] }) {
  const tri = [...lignes].sort((a, b) => a.code.localeCompare(b.code));
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Positions par famille, défilement horizontal"
      className="mt-6 overflow-x-auto rounded-card border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <table className="w-full text-sm">
        <caption className="sr-only">
          Position de chaque valeur dans la cote du jour, famille par famille. Tiers haut : tiers le plus favorable de la famille. Ce n&apos;est pas une recommandation.
        </caption>
        <thead>
          <tr className="border-b border-border bg-elevated/40 text-xs text-muted">
            <th scope="col" className="px-3 py-2.5 text-left font-semibold">Valeur</th>
            <th scope="col" className="px-3 py-2.5 text-left font-semibold">Liquidité</th>
            {FAMILLES.map((f) => (
              <th key={f.cle} scope="col" className="px-3 py-2.5 text-left font-semibold">{f.titre}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tri.map((l) => (
            <tr key={l.code} className="border-b border-border/30">
              <th scope="row" className="px-3 py-2.5 text-left">
                <Link href={`/actions/${l.code}`} className="font-medium text-ivory hover:underline">{l.code}</Link>
              </th>
              <td className="px-3 py-2.5 text-xs text-ivory">{l.classe_liquidite ?? '—'}</td>
              {FAMILLES.map((f) => {
                const t = l.tiers?.[f.cle] ?? null;
                return (
                  <td key={f.cle} className={`px-3 py-2.5 text-xs ${t ? 'text-ivory' : 'text-faint'}`}>{libelleTier(t)}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
