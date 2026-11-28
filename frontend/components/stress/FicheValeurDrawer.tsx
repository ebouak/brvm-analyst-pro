'use client';

import Link from 'next/link';
import { AlertTriangle, ExternalLink, X } from 'lucide-react';
import { fmtDateFR, fmtFcfa, fmtNumber, fmtPctSigne } from '@/lib/format';
import type { ActionResilienceRow } from '@/lib/stress/resilienceTypes';

export function FicheValeurDrawer({
  action,
  onClose,
}: {
  action: ActionResilienceRow | null;
  onClose: () => void;
}) {
  if (!action) return null;
  const f = action.fondamentaux;
  const d = action.dividendes;
  const l = action.liquidite;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-titre-valeur"
      className="fixed inset-0 z-50 flex justify-end bg-black/60"
      onClick={onClose}
    >
      <div
        className="h-full w-full max-w-2xl overflow-y-auto border-l border-border bg-bg p-6 shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <p className="text-xs text-muted">
              {action.secteur} · {action.pays ?? 'UEMOA'} · {f.famille_comptable === 'banque' ? 'Banque' : 'Entreprise'}
            </p>
            <h2 id="drawer-titre-valeur" className="mt-1 font-display text-2xl font-semibold text-ivory">
              {action.code} — {action.designation}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              <span className="tabular font-semibold text-ivory">
                Cours : {action.cours_jour != null ? `${fmtNumber(action.cours_jour, 0)} FCFA` : '—'}
              </span>
              <span className="tabular text-down">
                Drawdown : {action.drawdown_pct != null ? fmtPctSigne(action.drawdown_pct, 2) : '—'}
              </span>
              {action.illiquide_flag && (
                <span className="rounded-full border border-warn/40 bg-warn/10 px-2.5 py-0.5 text-warn">
                  Peu liquide
                </span>
              )}
              <Link
                href={`/actions/${action.code}`}
                className="inline-flex items-center gap-1 text-accent-ink hover:underline"
              >
                <span>Fiche complète</span>
                <ExternalLink className="h-3 w-3" strokeWidth={1.75} />
              </Link>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la fiche"
            className="rounded-lg border border-border p-2 text-muted hover:text-ivory"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="mt-6 space-y-6 text-xs">
          {/* Anomalies / vigilance */}
          {action.anomalies_donnees.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-warn/30 bg-warn/10 p-3 text-warn">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
              <ul className="space-y-0.5">
                {action.anomalies_donnees.map((an, i) => (
                  <li key={i}>{an}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Performances prix vs Total Return */}
          <section className="rounded-card border border-border bg-surface p-4">
            <h3 className="font-semibold text-ivory">Performances en cours vs Performance totale</h3>
            <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
              {[
                ['1 séance', action.perf_1j_pct],
                ['5 séances', action.perf_5j_pct],
                ['1 mois', action.perf_1m_pct],
                ['3 mois', action.perf_3m_pct],
                ['1 an (prix)', action.perf_1a_pct],
                ['1 an (totale)', action.perf_totale_1a_pct],
                ['YTD (prix)', action.perf_ytd_pct],
                ['Volatilité ann.', action.volatilite_ann_pct],
                ['Bêta Composite', action.beta],
              ].map(([lbl, val]) => (
                <div key={String(lbl)} className="rounded-lg border border-border/50 bg-sunken p-2.5">
                  <p className="text-faint">{lbl}</p>
                  <p className="tabular mt-0.5 font-semibold text-ivory">
                    {val == null
                      ? '—'
                      : lbl === 'Volatilité ann.'
                        ? `${fmtNumber(Number(val), 1)} %`
                        : lbl === 'Bêta Composite'
                          ? fmtNumber(Number(val), 2)
                          : fmtPctSigne(Number(val), 1)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Analyse du décrochage */}
          <section className="rounded-card border border-border bg-surface p-4">
            <h3 className="font-semibold text-ivory">
              Analyse du décrochage ({action.decrochage_anormal ? 'Décrochage anormal détecté' : 'Évolution en ligne'})
            </h3>
            <p className="mt-1 text-muted">
              Écart relatif vs Composite :{' '}
              <span className="tabular text-ivory">
                {action.decrochage_relatif_pct != null ? `${fmtPctSigne(action.decrochage_relatif_pct, 1).replace(' %', '')} pts` : '—'}
              </span>{' '}
              · Alpha ajusté bêta :{' '}
              <span className="tabular text-ivory">
                {action.alpha_anormal_pct != null ? fmtPctSigne(action.alpha_anormal_pct, 1) : '—'}
              </span>
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-muted">
              {action.explication_decrochage.facteurs_observes.length > 0 ? (
                action.explication_decrochage.facteurs_observes.map((fac, i) => (
                  <li key={i}>{fac.detail}</li>
                ))
              ) : (
                <li>Aucun facteur spécifique isolé sur la fenêtre récente.</li>
              )}
            </ul>
          </section>

          {/* Fondamentaux sectorisés */}
          <section className="rounded-card border border-border bg-surface p-4">
            <h3 className="font-semibold text-ivory">
              Fondamentaux ({f.famille_comptable === 'banque' ? 'Référentiel bancaire' : 'Entreprise'} · exercice {f.exercice ?? '—'})
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div><p className="text-faint">PER (méd. sec. {f.per_median_secteur != null ? `${fmtNumber(f.per_median_secteur, 1)}x` : '—'})</p><p className="tabular font-semibold text-ivory">{f.per != null ? `${fmtNumber(f.per, 1)}x` : '—'}</p></div>
              <div><p className="text-faint">PBR (méd. sec. {f.pbr_median_secteur != null ? `${fmtNumber(f.pbr_median_secteur, 2)}x` : '—'})</p><p className="tabular font-semibold text-ivory">{f.pbr != null ? `${fmtNumber(f.pbr, 2)}x` : '—'}</p></div>
              <div><p className="text-faint">ROE</p><p className="tabular font-semibold text-ivory">{f.roe_pct != null ? `${fmtNumber(f.roe_pct, 1)} %` : '—'}</p></div>
              <div><p className="text-faint">Résultat net</p><p className="tabular font-semibold text-ivory">{fmtFcfa(f.resultat_net)}</p></div>
              {f.famille_comptable === 'banque' ? (
                <>
                  <div><p className="text-faint">Produit Net Bancaire</p><p className="tabular font-semibold text-ivory">{fmtFcfa(f.pnb)}</p></div>
                  <div><p className="text-faint">Coeff. d&apos;exploitation</p><p className="tabular font-semibold text-ivory">{f.coefficient_exploitation_pct != null ? `${fmtNumber(f.coefficient_exploitation_pct, 1)} %` : '—'}</p></div>
                  <div><p className="text-faint">Ratio solvabilité</p><p className="tabular font-semibold text-ivory">{f.ratio_solvabilite_pct != null ? `${fmtNumber(f.ratio_solvabilite_pct, 1)} %` : '—'}</p></div>
                  <div><p className="text-faint">Créances en souffrance</p><p className="tabular font-semibold text-ivory">{f.taux_creances_souffrance_pct != null ? `${fmtNumber(f.taux_creances_souffrance_pct, 1)} %` : '—'}</p></div>
                </>
              ) : (
                <>
                  <div><p className="text-faint">Chiffre d&apos;affaires</p><p className="tabular font-semibold text-ivory">{fmtFcfa(f.chiffre_affaires)}</p></div>
                  <div><p className="text-faint">Marge nette</p><p className="tabular font-semibold text-ivory">{f.marge_nette_pct != null ? `${fmtNumber(f.marge_nette_pct, 1)} %` : '—'}</p></div>
                  <div><p className="text-faint">Gearing (Dette/FP)</p><p className="tabular font-semibold text-ivory">{f.gearing_pct != null ? `${fmtNumber(f.gearing_pct, 1)} %` : '—'}</p></div>
                  <div><p className="text-faint">EV/EBITDA</p><p className="tabular font-semibold text-ivory">{f.ev_ebitda != null ? `${fmtNumber(f.ev_ebitda, 1)}x` : '—'}</p></div>
                </>
              )}
            </div>
          </section>

          {/* Dividendes & Liquidité & Score */}
          <div className="grid gap-4 sm:grid-cols-2">
            <section className="rounded-card border border-border bg-surface p-4 space-y-1.5">
              <h3 className="font-semibold text-ivory">Dividendes & Liquidité</h3>
              <p className="text-muted">
                Dividende ({d.base_fiscale}) : <span className="tabular text-ivory">{d.montant_net != null ? `${fmtNumber(d.montant_net, 0)} FCFA` : '—'}</span>
                {d.rendement_pct != null && ` (${fmtNumber(d.rendement_pct, 2)} %)`}
              </p>
              <p className="text-muted">Détachement : <span className="tabular text-ivory">{d.derniere_ex_date ? fmtDateFR(d.derniere_ex_date) : '—'}</span></p>
              <p className="text-muted">Score liquidité v2 : <span className="tabular text-ivory">{l.score_v2 != null ? `${fmtNumber(l.score_v2, 0)}/100 (classe ${l.classe ?? '—'})` : '—'}</span></p>
              <p className="text-muted">Présence : <span className="tabular text-ivory">{l.presence_pct != null ? `${fmtNumber(l.presence_pct, 0)} %` : '—'}</span></p>
            </section>

            <section className="rounded-card border border-border bg-surface p-4 space-y-1.5">
              <h3 className="font-semibold text-ivory">Couverture & comportement en séance</h3>
              <p className="text-muted">
                Dernier exercice publié : <span className="tabular text-ivory">{f.exercice ?? '—'}</span>
              </p>
              <p className="text-muted">
                Séances cotées (60 j) : <span className="tabular text-ivory">{fmtNumber(l.seances_cotees_60j, 0)}</span>
              </p>
              <p className="text-muted">
                Fréq. séances positives :{' '}
                <span className="tabular text-ivory">
                  {action.freq_seances_positives_pct != null ? `${fmtNumber(action.freq_seances_positives_pct, 0)} %` : '—'}
                </span>
              </p>
              <p className="text-muted">
                Tenue les jours de baisse indice :{' '}
                <span className="tabular text-ivory">
                  {action.resistance_jours_baisse_pct != null ? fmtPctSigne(action.resistance_jours_baisse_pct, 2) : '—'}
                </span>
              </p>
            </section>
          </div>

          <p className="text-faint">
            Données factuelles issues des publications et clôtures BRVM ; aucune pondération composite ni recommandation d&apos;achat ou de vente.
          </p>
        </div>
      </div>
    </div>
  );
}
