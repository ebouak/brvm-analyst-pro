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
  synthese: { haussiers: number; neutres: number; baissiers: number; tendancePct: number | null } | null;
  saisonnalite: ReactNode;
  detections: { label: string; ok: boolean }[];
  position: ReactNode;
  detailScore: ReactNode;
}

const fr2 = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Liste({ titre, items, marque }: { titre: string; items: string[]; marque: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold text-ivory">{titre}</h4>
      <ul className="mt-2 space-y-1.5">
        {items.map((t) => (
          <li key={t} className="flex gap-2 text-[13px] text-muted">
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
    <section aria-labelledby="t-lecture" className="rounded-card border border-border bg-surface p-5 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h3 id="t-lecture" className="text-base font-semibold text-ivory">Lecture technique</h3>
        {signal && <span className="rounded-full border border-border-strong px-2.5 py-0.5 text-xs text-ivory">{libelleSignal(signal)}</span>}
        {qualiteDonnees != null && <span className="tabular text-xs text-faint">qualité des données {Math.round(qualiteDonnees <= 1 ? qualiteDonnees * 100 : qualiteDonnees)} %</span>}
      </div>

      {pos != null && score != null && (
        <div className="mt-4">
          <div role="img" aria-label={`Score ${fr2(score)} sur une échelle de −1 à +1`} className="relative h-2 rounded bg-border">
            <div className="absolute inset-y-0 left-0 rounded-l bg-down/30" style={{ width: '20%' }} />
            <div className="absolute inset-y-0 right-0 rounded-r bg-up/30" style={{ width: '20%' }} />
            <span className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded bg-ivory" style={{ left: `${pos}%` }} />
          </div>
          <div className="tabular mt-1.5 flex justify-between text-[11px] text-faint">
            <span>−1</span><span>−0,6</span><span>0</span><span>+0,6</span><span>+1</span>
          </div>
          <p className="tabular mt-1 text-xs text-muted">Score {fr2(score)}</p>
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
        {synthese && (
          <div className="rounded-card border border-border p-4">
            <h4 className="text-xs font-semibold text-ivory">Synthèse des indicateurs</h4>
            <p className="tabular mt-2 text-[13px] text-muted">
              {synthese.haussiers} haussiers · {synthese.neutres} neutres · {synthese.baissiers} baissiers
            </p>
            {synthese.tendancePct != null && <p className="tabular mt-1 text-xs text-faint">Tendance {Math.round(synthese.tendancePct)} %</p>}
          </div>
        )}
        <div className="rounded-card border border-border p-4">{saisonnalite}</div>
        {detections.length > 0 && (
          <div className="rounded-card border border-border p-4">
            <h4 className="text-xs font-semibold text-ivory">Détections actives</h4>
            {actives.length > 0 ? (
              <ul className="mt-2 space-y-1">{actives.map((d) => <li key={d.label} className="text-[13px] text-muted">{d.label}</li>)}</ul>
            ) : (
              <p className="mt-2 text-[13px] text-muted">Aucune détection active.</p>
            )}
            {inactives.length > 0 && actives.length > 0 && (
              <p className="mt-2 text-xs text-faint">{inactives.length} autre{inactives.length > 1 ? 's' : ''} détection{inactives.length > 1 ? 's' : ''} non déclenchée{inactives.length > 1 ? 's' : ''}.</p>
            )}
          </div>
        )}
        <div className="rounded-card border border-border p-4">
          <h4 className="text-xs font-semibold text-ivory">Votre position</h4>
          <div className="mt-2 text-[13px] text-muted">{position}</div>
          <Link href="/signaux" className="mt-3 inline-block text-xs text-accent-ink hover:underline">Voir tous les signaux</Link>
        </div>
      </div>

      <details className="mt-6 rounded-card border border-border p-4">
        <summary className="cursor-pointer text-sm text-ivory">Comment le score est calculé</summary>
        <div className="mt-3">{detailScore}</div>
      </details>
    </section>
  );
}
