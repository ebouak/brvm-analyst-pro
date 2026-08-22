import Link from 'next/link';
import type { IndiceDaily } from '@/lib/types';

/**
 * Carte « Indices BRVM » compacte — 4ᵉ colonne de la grille « Marché en
 * direct ». Variante volontairement resserrée de LandingIndices (qui, lui,
 * déploie les 11 indices en pleine largeur) : ici on ne montre que les 4
 * indices principaux en liste, avec un lien vers le détail.
 */

const LABELS: Record<string, string> = {
  BRVMC: 'BRVM Composite',
  BRVM30: 'BRVM 30',
  BRVMPRES: 'BRVM Prestige',
  BRVMPRIN: 'BRVM Principal',
};
const MAIN = ['BRVMC', 'BRVM30', 'BRVMPRES', 'BRVMPRIN'];

const nf = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function IndicesCompactCard({ indices }: { indices: IndiceDaily[] }) {
  const byCode = new Map(indices.filter((i) => i.valeur != null).map((i) => [i.code, i]));
  const main = MAIN.map((c) => byCode.get(c)).filter((i): i is IndiceDaily => Boolean(i));
  const total = indices.filter((i) => i.valeur != null).length;

  return (
    <div className="rounded-panel border border-white/10 bg-white/[0.02] p-5">
      <p className="overline mb-3 text-gold-2">Indices BRVM</p>

      {main.length > 0 ? (
        <ul className="space-y-3">
          {main.map((i) => {
            const v = i.variation_pct ?? 0;
            const up = v > 0;
            const down = v < 0;
            return (
              <li key={i.code} className="border-b border-white/[0.06] pb-2.5 last:border-0 last:pb-0">
                <p className="text-[10px] uppercase tracking-wide text-faint">{LABELS[i.code] ?? i.code}</p>
                <div className="mt-0.5 flex items-baseline justify-between gap-2">
                  <span className="tabular text-sm font-bold text-ivory">
                    {i.valeur != null ? nf(i.valeur as number) : '—'}
                  </span>
                  <span
                    className={`tabular text-xs font-bold ${up ? 'text-up' : down ? 'text-down' : 'text-muted'}`}
                  >
                    {up ? '+' : ''}
                    {v.toFixed(2)} %
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="py-6 text-center text-xs text-faint">Indices indisponibles pour cette séance.</p>
      )}

      {total > 0 && (
        <Link
          href="/dashboard"
          className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-medium text-ivory/80 transition-colors hover:text-gold-2"
        >
          Voir les {total} indices <span aria-hidden>→</span>
        </Link>
      )}
    </div>
  );
}
