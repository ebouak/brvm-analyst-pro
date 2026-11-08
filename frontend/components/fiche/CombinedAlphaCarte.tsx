import Link from 'next/link';
import { fmtDateCourte } from '@/lib/format';
import { libellePenalite } from '@/lib/fiche/affichage';

interface Props {
  code: string;
  score: number | null;
  rang: number | null;
  piliers: { libelle: string; valeur: number | null }[];
  penalite: number | null;
  /** Pénalité réellement appliquée (somme pondérée − score). */
  penaliteAppliquee?: number | null;
  calculeLe: string | null;
  derniereSeance: string;
  /** Phrase des garde-fous, même source que la page Quant (resumeGardeFous). Prioritaire sur le calcul local. */
  resumePenalite?: string | null;
}

export function CombinedAlphaCarte({ code, score, rang, piliers, penalite, penaliteAppliquee, calculeLe, derniereSeance, resumePenalite }: Props) {
  const lignePenalite = resumePenalite ?? libellePenalite(penalite, penaliteAppliquee);
  const anterieur = calculeLe != null && calculeLe < derniereSeance;
  return (
    <section aria-labelledby="t-ca" className="rounded-card border border-border bg-surface p-5 md:p-6">
      <h3 id="t-ca" className="text-base font-semibold text-ivory">Combined Alpha</h3>
      <p className="mt-1 text-[13px] text-muted">
        Un score de 0 à 100 pour comparer toutes les actions BRVM. 5 piliers (valorisation, momentum, qualité bénéficiaire, solidité financière et dividende), puis une pénalité risque (25 pts au plus) si des garde-fous se déclenchent.
      </p>
      {score == null ? (
        <p className="mt-4 text-sm text-muted">Score non calculé pour cette valeur.</p>
      ) : (
        <>
          <p className="mt-4 flex items-baseline gap-2">
            <span className="tabular font-display text-4xl text-ivory">{Math.round(score)}</span>
            <span className="text-sm text-faint">/ 100</span>
            {rang != null && <span className="tabular ml-auto text-xs text-muted">Rang n° {rang}</span>}
          </p>
          <div className="mt-4 space-y-2.5">
            {piliers.map((p) => (
              <div key={p.libelle} className="grid grid-cols-[9rem_1fr_2.5rem] items-center gap-3 text-xs">
                <span className="text-muted">{p.libelle}</span>
                <div className="relative h-2 rounded bg-border">
                  {p.valeur != null && <div className="absolute inset-y-0 left-0 rounded bg-muted" style={{ width: `${Math.max(0, Math.min(100, p.valeur))}%` }} />}
                  <span aria-hidden className="absolute -inset-y-0.5 w-px bg-border-strong" style={{ left: '50%' }} />
                  <span aria-hidden className="absolute -inset-y-0.5 w-px bg-border-strong" style={{ left: '65%' }} />
                </div>
                <span className="tabular text-right text-ivory">{p.valeur != null ? Math.round(p.valeur) : '—'}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-faint">Repères à 50 et 65.</p>
          {lignePenalite && <p className="mt-2 text-xs text-muted">{lignePenalite}</p>}
        </>
      )}
      {calculeLe && (
        <p className="mt-3 text-xs text-faint">
          Calculé le {fmtDateCourte(calculeLe)}{anterieur ? ' · antérieur à la dernière séance' : ''}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-4 text-xs">
        <Link href={`/actions/${code}/quant`} className="text-accent-ink hover:underline">Détail du score</Link>
        <Link href="/analyse/combined-alpha" className="text-accent-ink hover:underline">Classement complet</Link>
      </div>
    </section>
  );
}
