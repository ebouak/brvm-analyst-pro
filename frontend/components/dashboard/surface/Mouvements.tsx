import Link from 'next/link';
import { fmtNumber, fmtPctSigne } from '@/lib/format';
import { cheminSparkline } from '@/lib/dashboard/graphe';
import { TeteBloc } from './Grille';

export interface LigneMouvement { code: string; nom: string; cours: number | null; variation: number | null; serie: number[] }

function Sparkline({ serie }: { serie: number[] }) {
  const p = cheminSparkline(serie, 84, 24);
  if (!p) return <span className="text-faint">—</span>;
  return (
    <svg width={84} height={24} viewBox="0 0 84 24" aria-hidden className="inline-block">
      <polyline points={p.points} fill="none" className={p.hausse ? 'stroke-up' : 'stroke-down'} strokeWidth={1.5} />
      <circle cx={p.dernier[0]} cy={p.dernier[1]} r={2.2} className={p.hausse ? 'fill-up' : 'fill-down'} />
    </svg>
  );
}

/** Spec §12 — plus fortes hausses ou baisses, tendance sur 20 séances. */
export default function Mouvements({ id, titre, lignes }: { id: string; titre: string; lignes: LigneMouvement[] }) {
  return (
    <section aria-labelledby={id} className="py-5 lg:px-5">
      <TeteBloc id={id} titre={titre} droite={<Link href="/actions" className="text-xs text-accent-ink hover:underline">Tout le marché</Link>} />
      {lignes.length === 0 ? <p className="text-sm text-muted">Aucune variation connue pour cette séance.</p> : (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[19rem] text-sm" aria-labelledby={id}>
            <thead className="text-[11px] uppercase tracking-wide text-faint">
              <tr>
                <th scope="col" className="px-1 pb-2 text-left font-medium">Valeur</th>
                <th scope="col" className="px-1 pb-2 text-right font-medium">Cours</th>
                <th scope="col" className="px-1 pb-2 text-right font-medium">Var.</th>
                <th scope="col" className="px-1 pb-2 text-right font-medium">20 séances</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l, i) => (
                <tr key={`${l.code}-${i}`} className="border-t border-border">
                  <th scope="row" className="px-1 py-1.5 text-left font-normal">
                    <Link href={`/actions/${l.code}`} className="tabular block text-[13px] text-ivory hover:text-accent-ink">{l.code}</Link>
                    <span className="block max-w-[16ch] truncate text-[11.5px] text-faint" title={l.nom}>{l.nom}</span>
                  </th>
                  <td className="tabular px-1 py-1.5 text-right text-ivory">{l.cours != null ? fmtNumber(l.cours, 0) : '—'}</td>
                  <td className={`tabular px-1 py-1.5 text-right ${l.variation == null ? 'text-faint' : l.variation > 0 ? 'text-up' : l.variation < 0 ? 'text-down' : 'text-muted'}`}>{l.variation != null ? fmtPctSigne(l.variation) : '—'}</td>
                  <td className="px-1 py-1.5 text-right"><Sparkline serie={l.serie} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
