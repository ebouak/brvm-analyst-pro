import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Lecture } from '@/lib/fiche/lecture';
import { libelleSignal } from '@/lib/signalLabel';

interface Props {
  lecture: Lecture;
  signal: string | null;
  score: number | null;
  qualiteDonnees: number | null;
  graphiques: ReactNode;
  synthese: {
    haussiers: number; neutres: number; baissiers: number;
    /** Détail de chaque indicateur de la synthèse, déplié à la demande. */
    indicateurs?: { texte: string; sens: 'up' | 'down' | 'neutral' | 'na' }[];
  } | null;
  saisonnalite: ReactNode;
  detections: { label: string; ok: boolean }[];
  position: ReactNode;
  detailScore: ReactNode;
}

/** Libellés des seuils, placés sur l'échelle −1…+1 (−0,6 et +0,6 bordent les zones colorées de 20 %). */
const SEUILS: [string, number][] = [['−1', 0], ['−0,6', 20], ['0', 50], ['+0,6', 80], ['+1', 100]];

const fr2 = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Liste({ titre, items, marque }: { titre: string; items: string[]; marque: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold text-ivory">{titre}</h4>
      <ul className="mt-2 space-y-1.5">
        {items.map((t, i) => (
          <li key={`${i}-${t}`} className="flex gap-2 text-[13px] text-muted">
            <span aria-hidden className="text-faint">{marque}</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LectureTechnique({ lecture, signal, score, qualiteDonnees, graphiques, synthese, saisonnalite, detections, position, detailScore }: Props) {
  const actives = detections.filter((d) => d.ok);
  const inactives = detections.filter((d) => !d.ok);
  const pos = score != null ? Math.max(0, Math.min(1, (score + 1) / 2)) * 100 : null;
  const vide = lecture.soutient.length + lecture.retient.length + lecture.neutres.length === 0;
  return (
    <section aria-labelledby="technique-h" className="rounded-card border border-border bg-surface p-5 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        {signal && <span className="rounded-full border border-border-strong px-2.5 py-0.5 text-xs text-ivory">{libelleSignal(signal)}</span>}
        {qualiteDonnees != null && <span className="text-xs text-faint">qualité des données <span className="tabular">{Math.round(qualiteDonnees <= 1 ? qualiteDonnees * 100 : qualiteDonnees)} %</span></span>}
      </div>

      {pos != null && score != null && (
        <div className="mt-4">
          <div role="img" aria-label={`Score ${fr2(score)} sur une échelle de −1 à +1`} className="relative h-2 rounded bg-border">
            <div className="absolute inset-y-0 left-0 rounded-l bg-down/30" style={{ width: '20%' }} />
            <div className="absolute inset-y-0 right-0 rounded-r bg-up/30" style={{ width: '20%' }} />
            <span className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded bg-ivory" style={{ left: `${pos}%` }} />
          </div>
          <div aria-hidden className="tabular relative mt-1.5 h-4 text-[11px] text-faint">
            {SEUILS.map(([t, x], i) => (
              <span key={t} className={`absolute ${i === 0 ? '' : i === SEUILS.length - 1 ? '-translate-x-full' : '-translate-x-1/2'}`} style={{ left: `${x}%` }}>{t}</span>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">Score <span className="tabular">{fr2(score)}</span></p>
        </div>
      )}

      {vide ? (
        <p className="mt-4 text-sm text-muted">Pas assez d&apos;indicateurs pour une lecture technique.</p>
      ) : (
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          <Liste titre="Ce qui soutient" items={lecture.soutient} marque="+" />
          <Liste titre="Ce qui retient" items={lecture.retient} marque="−" />
          <Liste titre="Neutres" items={lecture.neutres} marque="·" />
        </div>
      )}

      <div className="mt-6">{graphiques}</div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-card border border-border p-4">{saisonnalite}</div>
        <div className="rounded-card border border-border p-4">
          <h4 className="text-xs font-semibold text-ivory">Votre position</h4>
          <div className="mt-2 text-[13px] text-muted">{position}</div>
          <Link href="/signaux" className="mt-3 inline-block text-xs text-accent-ink hover:underline">Voir tous les signaux</Link>
        </div>
      </div>

      {(synthese || detections.length > 0) && (
        <details className="mt-6 rounded-card border border-border p-4">
          <summary className="cursor-pointer text-sm text-ivory">
            Détail des {synthese?.indicateurs?.length ?? 0} indicateurs et des {detections.length} détections
          </summary>
          <p className="mt-2 text-xs text-faint">Données brutes de la lecture ci-dessus : elles la documentent, elles ne la remplacent pas.</p>
          <div className="mt-3 grid gap-5 md:grid-cols-2">
            {synthese && (
              <div>
                <h4 className="text-xs font-semibold text-ivory">Indicateurs</h4>
                <p className="mt-1 text-[13px] text-muted">
                  <span className="tabular">{synthese.haussiers}</span> en hausse · <span className="tabular">{synthese.neutres}</span> neutres · <span className="tabular">{synthese.baissiers}</span> en baisse
                </p>
                {synthese.indicateurs && synthese.indicateurs.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {synthese.indicateurs.map((ind, i) => (
                      <li key={`${i}-${ind.texte}`} className="flex gap-2 text-xs text-muted">
                        <span aria-hidden className="text-faint">
                          {ind.sens === 'up' ? '↑' : ind.sens === 'down' ? '↓' : ind.sens === 'neutral' ? '→' : '·'}
                        </span>
                        <span className={ind.sens === 'na' ? 'italic text-faint' : ''}>{ind.texte}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {detections.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-ivory">Détections</h4>
                <p className="mt-1 text-[13px] text-muted">
                  <span className="tabular">{actives.length}</span> déclenchée{actives.length > 1 ? 's' : ''} sur <span className="tabular">{detections.length}</span>
                </p>
                <ul className="mt-2 space-y-1.5">
                  {actives.map((d) => <li key={d.label} className="text-xs text-muted">{d.label}</li>)}
                  {inactives.map((d) => <li key={d.label} className="text-xs text-faint">{d.label} : non déclenchée</li>)}
                </ul>
              </div>
            )}
          </div>
        </details>
      )}

      <details className="mt-6 rounded-card border border-border p-4">
        <summary className="cursor-pointer text-sm text-ivory">Comment le score est calculé</summary>
        <div className="mt-3">{detailScore}</div>
      </details>
    </section>
  );
}
