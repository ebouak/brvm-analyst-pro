'use client';

import { fmtFcfa, fmtNumber, fmtPctSigne } from '@/lib/format';
import type { SecteurStressRow } from '@/lib/stress/resilienceTypes';

export function HeatmapSectorielle({
  secteurs,
  secteurActif,
  onSelectSecteur,
}: {
  secteurs: readonly SecteurStressRow[];
  secteurActif: string;
  onSelectSecteur: (secteur: string) => void;
}) {
  if (secteurs.length === 0) {
    return <p className="text-xs text-muted">Aucune agrégation sectorielle disponible.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-ivory">Heatmap sectorielle & contribution au marché</h3>
          <p className="text-xs text-muted">
            Distinction entre performance sectorielle (pondérée par capitalisation) et contribution en points de % à la variation globale. Cliquez sur un secteur pour filtrer le scanner.
          </p>
        </div>
        {secteurActif !== 'TOUS' && (
          <button
            type="button"
            onClick={() => onSelectSecteur('TOUS')}
            className="rounded-lg border border-border-strong bg-elevated px-2.5 py-1 text-xs text-ivory hover:border-accent"
          >
            Réinitialiser le filtre ({secteurActif})
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {secteurs.map((s) => {
          const actif = secteurActif === s.secteur;
          const perf = s.perf_1m_pct ?? s.perf_1j_pct ?? 0;
          const bord = actif
            ? 'border-accent-ink bg-accent/10'
            : perf <= -10
              ? 'border-down/35 bg-down/[0.06]'
              : perf < 0
                ? 'border-border bg-surface'
                : 'border-up/30 bg-up/[0.05]';

          return (
            <button
              key={s.secteur}
              type="button"
              onClick={() => onSelectSecteur(actif ? 'TOUS' : s.secteur)}
              className={`rounded-card border p-4 text-left transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${bord}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-ivory">{s.secteur}</p>
                  <p className="tabular text-xs text-faint">
                    {s.nb_valeurs} valeurs · poids {fmtNumber(s.poids_marche_pct, 1)} % · cap. {fmtFcfa(s.capitalisation_totale)}
                  </p>
                </div>
                <span
                  className={`tabular text-sm font-semibold ${
                    (s.perf_1m_pct ?? 0) < 0 ? 'text-down' : 'text-up'
                  }`}
                >
                  {s.perf_1m_pct != null ? fmtPctSigne(s.perf_1m_pct, 1) : '—'}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/50 pt-2.5 text-xs">
                <div>
                  <p className="text-faint">1 sem.</p>
                  <p className={`tabular font-medium ${(s.perf_1s_pct ?? 0) < 0 ? 'text-down' : 'text-up'}`}>
                    {s.perf_1s_pct != null ? fmtPctSigne(s.perf_1s_pct, 1) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-faint">YTD</p>
                  <p className={`tabular font-medium ${(s.perf_ytd_pct ?? 0) < 0 ? 'text-down' : 'text-up'}`}>
                    {s.perf_ytd_pct != null ? fmtPctSigne(s.perf_ytd_pct, 1) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-faint">Contrib. 1M</p>
                  <p className={`tabular font-medium ${(s.contribution_1m_pts ?? 0) < 0 ? 'text-down' : 'text-up'}`}>
                    {s.contribution_1m_pts != null ? `${fmtPctSigne(s.contribution_1m_pts, 2).replace(' %', '')} pts` : '—'}
                  </p>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between text-xs text-faint">
                <span>
                  <span className="tabular text-up">{s.nb_hausses}</span> hausses ·{' '}
                  <span className="tabular text-down">{s.nb_baisses}</span> baisses
                </span>
                <span className="tabular">Vol. {fmtFcfa(s.valeur_echangee_jour)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
