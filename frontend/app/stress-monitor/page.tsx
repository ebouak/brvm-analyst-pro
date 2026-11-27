import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen, Download, FileSpreadsheet } from 'lucide-react';
import { createPublicClient } from '@/lib/supabase/public';
import { chargerDonneesCrises } from '@/lib/stress/lecture';
import { chargerStressIndexOverview } from '@/lib/stress/lectureStressIndex';
import {
  LIBELLES_COMPOSANTES_STRESS,
  LIBELLES_REGIMES_STRESS,
  type CleComposanteStress,
} from '@/lib/stress/stressIndexTypes';
import { EnTeteCote } from '@/components/marche/EnTeteCote';
import { LigneSource } from '@/components/marche/LigneSource';
import { EmptyStatePremium, MetricCard, PremiumPanel } from '@/components/ui/premium';
import { StressSubNav } from '@/components/stress/StressSubNav';
import { CouvertureDonneesBanner } from '@/components/stress/CouvertureDonneesBanner';
import {
  BoutonImprimerStress,
  StressHistoriqueChart,
} from '@/components/stress/StressHistoriqueChart';
import { fmtDateCourte, fmtNumber, fmtPctSigne } from '@/lib/format';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'BRVM Market Stress Monitor · Intelligence de marché WESTBOURSE',
  description:
    'Mesurer objectivement la tension du marché BRVM (0–100), comparer les crises historiques depuis 1998 et observer la dynamique de séance.',
  alternates: { canonical: '/stress-monitor' },
};

const ORDRE_COMPOSANTES: readonly CleComposanteStress[] = [
  'drawdown_composite',
  'largeur_baissiere',
  'volatilite_brvmv',
  'diffusion_sectorielle',
  'pression_volumes',
  'momentum_court_terme',
];

export default async function StressMonitorPage() {
  const sb = createPublicClient();
  const [data, stressOverview] = await Promise.all([
    chargerDonneesCrises(sb),
    chargerStressIndexOverview(sb, 180),
  ]);

  const brvmc = data.indices_actuels.find((i) => i.code === 'BRVMC') ?? data.indices_actuels[0] ?? null;
  const brvm30 = data.indices_actuels.find((i) => i.code === 'BRVM30') ?? null;
  const sectoriels = data.indices_actuels.filter(
    (i) => !['BRVMC', 'BRVM30', 'BRVMPRES', 'BRVMPRIN'].includes(i.code),
  );

  const episodesBrvmc10 = data.episodes.filter(
    (e) => e.indice_code === (brvmc?.code ?? 'BRVMC') && Number(e.seuil_pct) === -10,
  );
  const enCours = episodesBrvmc10.find((e) => e.statut === 'en_cours') ?? null;
  const plusSimilaire =
    episodesBrvmc10
      .filter((e) => e.statut === 'termine' && e.similarite_actuelle != null)
      .sort((a, b) => (b.similarite_actuelle ?? 0) - (a.similarite_actuelle ?? 0))[0] ?? null;

  const stressActuel = stressOverview.actuel;
  const obs = stressActuel?.observables_marche ?? null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <EnTeteCote
        titre="BRVM Market Stress Monitor"
        description="Thermomètre objectif de tension du marché BRVM (0–100), comparateur des crises historiques et observables de séance."
        seance={stressActuel?.date_marche ?? data.derniere_seance}
        compte={
          data.indices_actuels.length > 0
            ? { n: data.indices_actuels.length, libelle: 'indices suivis' }
            : null
        }
        source="Source BRVM & WESTBOURSE"
        actions={
          <div className="print:hidden flex flex-wrap items-center gap-2">
            <a
              href="/api/stress/export?format=xlsx"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-strong bg-elevated px-3 py-2 text-xs font-medium text-ivory transition-colors hover:border-accent"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-accent-ink" strokeWidth={1.75} />
              <span>Excel (.xlsx)</span>
            </a>
            <a
              href="/api/stress/export?format=csv"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-strong bg-elevated px-3 py-2 text-xs font-medium text-ivory transition-colors hover:border-accent"
            >
              <Download className="h-3.5 w-3.5 text-accent-ink" strokeWidth={1.75} />
              <span>CSV</span>
            </a>
            <BoutonImprimerStress />
          </div>
        }
      />

      <div className="print:hidden">
        <StressSubNav actif="overview" />
      </div>

      {data.indices_actuels.length === 0 ? (
        <div className="mt-8">
          <EmptyStatePremium
            title="Aucune donnée d'indice disponible"
            hint="Le diagnostic de stress s'affichera dès qu'une série d'indices sera présente en base."
          />
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {/* ZONE A — Stress Index 0-100 & décomposition des 6 composantes */}
          <section aria-labelledby="zone-a-titre" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="Indice de tension BRVM (0–100)"
                value={stressActuel ? `${fmtNumber(stressActuel.stress_index, 1)}` : '—'}
                unit={stressActuel ? LIBELLES_REGIMES_STRESS[stressActuel.regime] : undefined}
                delta={
                  stressActuel?.variation_20j_pts != null
                    ? `${stressActuel.variation_20j_pts >= 0 ? '+' : ''}${fmtNumber(stressActuel.variation_20j_pts, 1)} pts sur 20 séances`
                    : undefined
                }
                deltaDir={
                  (stressActuel?.variation_20j_pts ?? 0) > 2
                    ? 'down'
                    : (stressActuel?.variation_20j_pts ?? 0) < -2
                      ? 'up'
                      : 'flat'
                }
                accent="gold"
              />
              {brvmc && (
                <MetricCard
                  label={`${brvmc.libelle} — Drawdown`}
                  value={fmtPctSigne(brvmc.drawdown_pct, 2)}
                  delta={`Sommet ${fmtNumber(brvmc.sommet_observe, 2)} (${fmtDateCourte(brvmc.date_sommet)})`}
                  deltaDir={brvmc.drawdown_pct < 0 ? 'down' : 'flat'}
                />
              )}
              {brvm30 && (
                <MetricCard
                  label={`${brvm30.libelle} — Drawdown`}
                  value={fmtPctSigne(brvm30.drawdown_pct, 2)}
                  delta={`Clôture ${fmtNumber(brvm30.valeur, 2)} pts`}
                  deltaDir={brvm30.drawdown_pct < 0 ? 'down' : 'flat'}
                />
              )}
              <MetricCard
                label="Volatilité réalisée BRVM-V"
                value={
                  data.nervosite?.valeur != null ? `${fmtNumber(data.nervosite.valeur, 2)} %` : '—'
                }
                delta={
                  data.nervosite?.rang != null
                    ? `Régime ${data.nervosite.regime ?? '—'} · rang ${fmtNumber(data.nervosite.rang, 0)}/100`
                    : undefined
                }
                deltaDir="flat"
              />
            </div>

            {stressActuel && (
              <PremiumPanel glow className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 id="zone-a-titre" className="text-base font-semibold text-ivory">
                      Décomposition des 6 composantes de tension
                    </h2>
                    <p className="text-xs text-muted">
                      Couverture des composantes :{' '}
                      <span className="tabular font-semibold text-ivory">
                        {fmtNumber(stressActuel.couverture_composantes_pct, 0)} %
                      </span>{' '}
                      ({stressActuel.nb_composantes_actives}/6 actives) · Variations :{' '}
                      <span className="tabular">
                        5j {stressActuel.variation_5j_pts != null ? `${stressActuel.variation_5j_pts >= 0 ? '+' : ''}${fmtNumber(stressActuel.variation_5j_pts, 1)} pts` : '—'}
                      </span>{' '}
                      ·{' '}
                      <span className="tabular">
                        60j {stressActuel.variation_60j_pts != null ? `${stressActuel.variation_60j_pts >= 0 ? '+' : ''}${fmtNumber(stressActuel.variation_60j_pts, 1)} pts` : '—'}
                      </span>
                    </p>
                  </div>
                  <Link
                    href="/stress-monitor/methodologie"
                    className="print:hidden inline-flex items-center gap-1 text-xs text-accent-ink hover:underline"
                  >
                    <BookOpen className="h-3.5 w-3.5" strokeWidth={1.75} />
                    <span>Formules & pondérations</span>
                  </Link>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {ORDRE_COMPOSANTES.map((cle) => {
                    const c = stressActuel.composantes[cle];
                    const score = c?.score_0_100 ?? null;
                    return (
                      <div key={cle} className="rounded-lg border border-border/70 bg-sunken p-3 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-ivory">{LIBELLES_COMPOSANTES_STRESS[cle]}</span>
                          <span className="tabular text-faint">
                            poids {fmtNumber((c?.poids_effectif ?? c?.poids_nominal ?? 0) * 100, 0)} %
                          </span>
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                          <span className="tabular text-sm font-semibold text-ivory">
                            {score != null ? `${fmtNumber(score, 0)} / 100` : 'Indisponible'}
                          </span>
                          <span className="tabular text-muted">
                            {c?.valeur_brute != null ? `${fmtNumber(c.valeur_brute, 1)} ${c.unite_brute}` : '—'}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-elevated">
                          <div
                            className={`h-full rounded-full ${
                              (score ?? 0) >= 75
                                ? 'bg-down'
                                : (score ?? 0) >= 50
                                  ? 'bg-warn'
                                  : 'bg-accent-ink'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, score ?? 0))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </PremiumPanel>
            )}
          </section>

          {/* ZONE B — Courbe historique 0-100 & Comparaison à l'épisode historique le plus proche */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-panel border border-border bg-surface p-5 lg:col-span-2">
              <StressHistoriqueChart historique={stressOverview.historique} />
            </div>

            <PremiumPanel className="p-5 flex flex-col justify-between">
              <div>
                <h2 className="text-base font-semibold text-ivory">Épisode en cours (seuil −10 %)</h2>
                {enCours ? (
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <dt className="text-faint">Sommet de référence</dt>
                      <dd className="tabular mt-0.5 font-semibold text-ivory">
                        {fmtNumber(enCours.valeur_sommet, 2)} ({fmtDateCourte(enCours.date_sommet)})
                      </dd>
                    </div>
                    <div>
                      <dt className="text-faint">Point bas observé</dt>
                      <dd className="tabular mt-0.5 font-semibold text-down">
                        {fmtPctSigne(enCours.perte_max_pct, 2)} ({fmtDateCourte(enCours.date_creux)})
                      </dd>
                    </div>
                    <div>
                      <dt className="text-faint">Durée de baisse</dt>
                      <dd className="tabular mt-0.5 font-semibold text-ivory">
                        {fmtNumber(enCours.nb_seances_baisse, 0)} séances ({fmtNumber(enCours.duree_calendaire_baisse, 0)} j)
                      </dd>
                    </div>
                    <div>
                      <dt className="text-faint">Crise la plus similaire</dt>
                      <dd className="mt-0.5 font-semibold text-ivory">
                        {plusSimilaire
                          ? `${plusSimilaire.libelle} (${fmtNumber(plusSimilaire.similarite_actuelle ?? 0, 0)}/100)`
                          : 'Aucune référence'}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="mt-3 text-xs text-muted">
                    Aucun épisode en cours détecté au seuil de −10 % sur les données disponibles.
                  </p>
                )}
              </div>

              <LigneSource>
                Détection sur séries quotidiennes consolidées ·{' '}
                <Link href="/stress-monitor/crises" className="text-accent-ink hover:underline">
                  Ouvrir le comparateur 2007–2026
                </Link>
              </LigneSource>
            </PremiumPanel>
          </div>

          {/* ZONE C — Observables factuels de dynamique de marché (SANS signal d'achat) */}
          {obs && (
            <section className="rounded-panel border border-border bg-surface p-5 space-y-3">
              <div>
                <h2 className="text-base font-semibold text-ivory">
                  Indicateurs factuels d&apos;observation de séance (sans signal)
                </h2>
                <p className="text-xs text-muted">
                  Ces quatre grandeurs décrivent l&apos;état courant du marché à la clôture. Testées sur 2007–2026 au
                  banc d&apos;évaluation, elles ne constituent pas un signal d&apos;achat statistiquement prouvé.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                <div className="rounded-lg border border-border/60 bg-sunken p-3">
                  <p className="text-faint">Largeur hausses (moy. 5 séances)</p>
                  <p className="tabular mt-1 text-lg font-semibold text-ivory">
                    {obs.largeur_hausses_5j_pct != null ? `${fmtNumber(obs.largeur_hausses_5j_pct, 1)} %` : '—'}
                  </p>
                  <p className="text-faint">des titres cotés en variation &gt; 0</p>
                </div>

                <div className="rounded-lg border border-border/60 bg-sunken p-3">
                  <p className="text-faint">Écart BRVMC vs moyenne 20 séances</p>
                  <p
                    className={`tabular mt-1 text-lg font-semibold ${
                      (obs.ecart_brvmc_mm20_pct ?? 0) >= 0 ? 'text-up' : 'text-down'
                    }`}
                  >
                    {obs.ecart_brvmc_mm20_pct != null ? fmtPctSigne(obs.ecart_brvmc_mm20_pct, 2) : '—'}
                  </p>
                  <p className="text-faint">position relative à la MM20</p>
                </div>

                <div className="rounded-lg border border-border/60 bg-sunken p-3">
                  <p className="text-faint">Évolution BRVM-V sur 20 séances</p>
                  <p className="tabular mt-1 text-lg font-semibold text-ivory">
                    {obs.variation_brvmv_20j_pts != null
                      ? `${obs.variation_brvmv_20j_pts >= 0 ? '+' : ''}${fmtNumber(obs.variation_brvmv_20j_pts, 2)} pts`
                      : '—'}
                  </p>
                  <p className="text-faint">variation de volatilité réalisée</p>
                </div>

                <div className="rounded-lg border border-border/60 bg-sunken p-3">
                  <p className="text-faint">Volume séance vs médiane 60 séances</p>
                  <p className="tabular mt-1 text-lg font-semibold text-ivory">
                    {obs.ratio_volume_60j != null ? `${fmtNumber(obs.ratio_volume_60j, 2)}×` : '—'}
                  </p>
                  <p className="text-faint">intensité relative des échanges</p>
                </div>
              </div>
            </section>
          )}

          {/* ZONE D — Pression par indice sectoriel & passerelles analytiques */}
          <div className="grid gap-6 lg:grid-cols-2">
            <PremiumPanel className="p-5">
              <h2 className="text-base font-semibold text-ivory">Pression par indice sectoriel</h2>
              {sectoriels.length === 0 ? (
                <p className="mt-3 text-xs text-muted">Aucun indice sectoriel disponible.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {sectoriels.map((s) => (
                    <div
                      key={s.code}
                      className="flex items-center justify-between gap-3 border-b border-border/50 pb-2 text-xs last:border-b-0 last:pb-0"
                    >
                      <span className="text-muted">{s.libelle}</span>
                      <div className="flex items-center gap-3">
                        <span className="tabular text-faint">{fmtNumber(s.valeur, 2)}</span>
                        <span
                          className={`tabular font-semibold ${
                            s.drawdown_pct < -20 ? 'text-down' : 'text-ivory'
                          }`}
                        >
                          {fmtPctSigne(s.drawdown_pct, 2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <LigneSource>
                Drawdown calculé par rapport au sommet observé sur la série disponible de chaque indice sectoriel.
              </LigneSource>
            </PremiumPanel>

            {/* ZONE E — Passerelles vers les 3 moteurs analytiques */}
            <div className="print:hidden grid gap-3">
              {[
                {
                  href: '/stress-monitor/crises',
                  titre: 'Moteur 1 — Crises historiques (2007–2026)',
                  desc: 'Superposition Base 100 / Drawdown, durées de baisse et de récupération, contexte macro BCEAO/UEMOA.',
                },
                {
                  href: '/stress-monitor/valeurs',
                  titre: 'Moteur 2 — Analyse des valeurs & décrochages (Premium)',
                  desc: 'Tenue individuelle hors illiquides, décrochages anormaux vs indice, heatmap sectorielle pondérée et ratios publiés.',
                },
                {
                  href: '/stress-monitor/rebonds',
                  titre: 'Moteur 3 — Statistiques de rebond & stratégies (Premium)',
                  desc: 'Rendements à 1/3/6/12/24 mois sans chevauchement, intervalles bootstrap 95 % et simulations walk-forward.',
                },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center justify-between gap-4 rounded-card border border-border bg-surface p-4 transition-colors hover:border-accent"
                >
                  <div>
                    <h3 className="text-sm font-semibold text-ivory group-hover:text-accent-ink">
                      {item.titre}
                    </h3>
                    <p className="mt-1 text-xs text-muted">{item.desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted group-hover:text-accent-ink" strokeWidth={1.75} />
                </Link>
              ))}
            </div>
          </div>

          <p className="rounded-card border border-border bg-surface p-4 text-xs leading-relaxed text-muted">
            Avertissement réglementaire : le BRVM Market Stress Monitor est un outil quantitatif descriptif d&apos;aide
            à la lecture du marché. Ni l&apos;indice de tension (0–100), ni les comparaisons historiques ne constituent
            un conseil en investissement, une incitation à l&apos;achat ou à la vente, ni une garantie de performance
            future.
          </p>
        </div>
      )}

      <CouvertureDonneesBanner couverture={data.couverture} sourceMode={data.source_mode} />
    </div>
  );
}
