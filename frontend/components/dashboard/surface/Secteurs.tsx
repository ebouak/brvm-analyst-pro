import Link from 'next/link';
import { fmtPctSigne } from '@/lib/format';
import { barresDivergentes } from '@/lib/dashboard/graphe';
import { TeteBloc } from './Grille';

/** Spec §12 — indices sectoriels BRVM en barres divergentes autour de zéro. */
export default function Secteurs({ secteurs }: { secteurs: { code: string; nom: string; variation: number }[] }) {
  const tries = [...secteurs].sort((a, b) => b.variation - a.variation);
  const barres = barresDivergentes(tries.map((s) => ({ cle: s.code, v: s.variation })));
  return (
    <section aria-labelledby="t-secteurs" className="py-5 lg:px-5">
      <TeteBloc id="t-secteurs" titre="Indices sectoriels" droite={<Link href="/secteurs" className="text-xs text-accent-ink hover:underline">Secteurs</Link>} />
      {tries.length === 0 ? <p className="text-sm text-muted">Indices sectoriels non publiés pour cette séance.</p> : (
        <ul>
          {tries.map((s, i) => {
            const b = barres[i]!;
            return (
              <li key={s.code} className="grid grid-cols-[minmax(0,1fr)_5rem_4.25rem] items-center gap-2.5 border-t border-border py-1.5 text-[13px] first:border-t-0">
                <span className="min-w-0 break-words leading-snug text-ivory">{s.nom}</span>
                <span className="relative h-2" aria-hidden>
                  <span className="absolute -inset-y-[3px] left-1/2 w-px bg-border" />
                  {b.sens !== 'flat' && (
                    <span className={`absolute inset-y-0 rounded-sm ${b.sens === 'up' ? 'left-1/2 bg-up' : 'right-1/2 bg-down'}`} style={{ width: `${b.largeur}%` }} />
                  )}
                </span>
                <span className={`tabular whitespace-nowrap text-right ${s.variation > 0 ? 'text-up' : s.variation < 0 ? 'text-down' : 'text-muted'}`}>{fmtPctSigne(s.variation)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
