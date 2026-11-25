'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, Compass, Target } from 'lucide-react';
import type { ResumeMissions } from '@/lib/academy/missions';
import { NIVEAUX, NIVEAU_LABEL, type Niveau } from '@/lib/academy/types';

export default function MissionsPratiques({
  resume,
  isLoggedIn,
}: {
  resume: ResumeMissions;
  isLoggedIn: boolean;
}) {
  const [filtreNiveau, setFiltreNiveau] = useState<'tous' | Niveau>('tous');

  const items = useMemo(
    () => (filtreNiveau === 'tous' ? resume.missions : resume.missions.filter((m) => m.niveau === filtreNiveau)),
    [resume.missions, filtreNiveau],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border-strong bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent-ink">
              <Target size={13} aria-hidden />
              Apprendre → Pratiquer
            </span>
            <h2 className="font-display text-xl font-medium text-ivory">
              Missions pratiques synchronisées avec vos outils WestBourse
            </h2>
            <p className="text-sm text-muted">
              Chaque mission se valide automatiquement dès que vous utilisez les outils réels de la plateforme
              (watchlist, Paper Trading, journal de thèses, alertes et suivi de portefeuille).
            </p>
          </div>

          <div className="min-w-[190px] rounded-xl border border-border bg-bg/60 p-3.5 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">Progression pratique</p>
            <p className="tabular mt-1 font-display text-2xl font-semibold text-ivory">
              {resume.done} <span className="text-sm font-normal text-muted">/ {resume.total}</span>
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-up transition-all" style={{ width: `${resume.pct}%` }} />
            </div>
          </div>
        </div>

        {!isLoggedIn && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-xs">
            <span className="text-ivory">
              Connectez-vous pour enregistrer automatiquement vos actions et cocher ces 8 missions pratiques.
            </span>
            <Link
              href="/login?next=/formations/academy"
              className="rounded-lg bg-accent px-3.5 py-1.5 font-semibold text-bg hover:bg-gold-2"
            >
              Se connecter →
            </Link>
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrer les missions par niveau">
        <button
          type="button"
          onClick={() => setFiltreNiveau('tous')}
          aria-pressed={filtreNiveau === 'tous'}
          className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
            filtreNiveau === 'tous'
              ? 'bg-ivory font-semibold text-bg'
              : 'border border-border bg-surface text-muted hover:text-ivory'
          }`}
        >
          Tous les niveaux ({resume.total})
        </button>
        {NIVEAUX.map((niv) => (
          <button
            key={niv}
            type="button"
            onClick={() => setFiltreNiveau(niv)}
            aria-pressed={filtreNiveau === niv}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
              filtreNiveau === niv
                ? 'bg-ivory font-semibold text-bg'
                : 'border border-border bg-surface text-muted hover:text-ivory'
            }`}
          >
            {NIVEAU_LABEL[niv]}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((m) => {
          const ratio = m.cible > 0 ? Math.round((m.actuel / m.cible) * 100) : 0;
          return (
            <article
              key={m.id}
              className={`flex flex-col justify-between rounded-2xl border p-5 transition ${
                m.complete
                  ? 'border-up/40 bg-up/5'
                  : 'border-border bg-surface hover:border-border-strong'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg/60 px-2.5 py-0.5 text-[11px] font-medium text-muted">
                    <Compass size={11} aria-hidden className="text-accent-ink" />
                    {NIVEAU_LABEL[m.niveau]}
                  </span>
                  {m.complete ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-up/15 px-2.5 py-0.5 text-[11px] font-semibold text-up">
                      <CheckCircle2 size={13} aria-hidden />
                      Validée
                    </span>
                  ) : (
                    <span className="tabular inline-flex items-center gap-1 text-xs font-medium text-muted">
                      <Circle size={12} aria-hidden className="text-faint" />
                      {m.actuel} / {m.cible}
                    </span>
                  )}
                </div>

                <h3 className="mt-3 font-display text-base font-semibold text-ivory">{m.titre}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">{m.description}</p>
              </div>

              <div className="mt-4 space-y-3">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className={`h-full rounded-full transition-all ${m.complete ? 'bg-up' : 'bg-accent'}`}
                    style={{ width: `${ratio}%` }}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="tabular text-[11px] text-faint">
                    {m.complete ? `Objectif atteint (${m.cible}/${m.cible})` : `${m.actuel} sur ${m.cible}`}
                  </span>
                  <Link
                    href={m.href}
                    className={`text-xs font-semibold hover:underline ${
                      m.complete ? 'text-up' : 'text-accent-ink'
                    }`}
                  >
                    {m.complete ? 'Revoir l’outil →' : `${m.cta} →`}
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
