import type { Metadata } from 'next';
import Link from 'next/link';
import { buildTrueReturn, listCodesEligibles, ANNEE_DEBUT, ANNEE_FIN } from '@/lib/macro/trueReturnData';
import { SectionHeader } from '@/components/ui/premium';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Rendement vrai BRVM : cours + dividendes − impôt − inflation — WESTBOURSE',
  description:
    "Ce qu'une action BRVM vous a réellement rapporté : cours, dividendes réinvestis, impôt IRVM de votre pays et inflation. Le seul calcul complet du marché.",
};

const DEFAUT = 'SNTS';
const nf = new Intl.NumberFormat('fr-FR');
const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)} %`;

export default async function Page({ searchParams }: { searchParams: { code?: string } }) {
  const code = (searchParams.code ?? DEFAUT).toUpperCase();
  const [codes, r] = await Promise.all([listCodesEligibles(), buildTrueReturn(code)]);

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border/60 bg-surface/60 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="font-display tracking-tight text-white hover:text-accent">
            WESTBOURSE
          </Link>
          <Link href="/" className="text-sm text-muted hover:text-white">← Accueil</Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
        <SectionHeader
          kicker="Pouvoir d'achat"
          title="Le rendement vrai"
          subtitle="Le cours ne dit qu'une partie de l'histoire. Voici ce que votre action vous a réellement rapporté : dividendes réinvestis, impôt de votre pays, inflation de votre pays."
        />

        <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4">
          <label className="block">
            <span className="text-xs text-muted">Action</span>
            <select
              name="code"
              defaultValue={code}
              className="mt-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              {codes.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}{c.designation ? ` — ${c.designation}` : ''}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-[#03222b] transition active:scale-95"
          >
            Calculer
          </button>
          <span className="ml-auto text-xs text-faint">
            {codes.length} titres · {ANNEE_DEBUT}–{ANNEE_FIN}
          </span>
        </form>

        {!r ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center">
            <p className="text-sm text-muted">
              Données incomplètes pour <strong className="text-white">{code}</strong>.
            </p>
            <p className="mt-1 text-xs text-faint">
              Un exercice manquant n&apos;est pas un dividende nul : plutôt que de sous-estimer le
              rendement, nous préférons ne rien afficher.
            </p>
          </div>
        ) : (
          <>
            {/* ── Le contraste : ce que tout le monde affiche vs la réalité ── */}
            <section className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-surface p-5">
                <p className="overline text-faint">Ce que tout le monde affiche</p>
                <p className="mt-1 text-xs text-muted">Performance du cours seul</p>
                <p
                  className={`tabular mt-2 text-3xl font-semibold ${
                    r.pays[0]!.resultat.prixSeulPct >= 0 ? 'text-up' : 'text-down'
                  }`}
                >
                  {pct(r.pays[0]!.resultat.prixSeulPct)}
                </p>
                <p className="mt-2 text-xs text-faint">
                  {nf.format(r.coursDebut)} → {nf.format(r.coursFin)} FCFA
                </p>
              </div>

              <div className="rounded-xl border border-accent/40 bg-accent/5 p-5">
                <p className="overline text-accent">Ce que vous avez vraiment gagné</p>
                <p className="mt-1 text-xs text-muted">
                  Dividendes réinvestis, net d&apos;impôt, après inflation ({r.pays[0]!.nom})
                </p>
                <p
                  className={`tabular mt-2 text-3xl font-semibold ${
                    r.pays[0]!.resultat.perteReelle ? 'text-down' : 'text-up'
                  }`}
                >
                  {pct(r.pays[0]!.resultat.vraiPct)}
                </p>
                <p className="mt-2 text-xs text-faint">
                  dont <strong className="text-ivory">{pct(r.pays[0]!.resultat.apportDividendesPts)}</strong>{' '}
                  apportés par les dividendes
                </p>
              </div>
            </section>

            {/* ── Les dividendes encaissés ── */}
            <section className="rounded-xl border border-border bg-surface p-5">
              <h2 className="text-sm font-semibold text-ivory">
                {r.code}{r.designation ? ` — ${r.designation}` : ''} · dividendes encaissés
              </h2>
              <div className="mt-3 flex flex-wrap gap-3">
                {r.dividendes.map((d) => (
                  <div key={d.exercice} className="rounded-lg border border-border/60 bg-bg px-3 py-2">
                    <p className="text-[11px] text-faint">Exercice {d.exercice}</p>
                    <p className="tabular text-sm font-semibold text-ivory">
                      {nf.format(d.montantBrut)} FCFA
                    </p>
                    <p className="text-[10px] text-faint">
                      réinvesti à {nf.format(d.coursReinvest)}
                    </p>
                  </div>
                ))}
                <div className="rounded-lg border border-up/30 bg-up/5 px-3 py-2">
                  <p className="text-[11px] text-faint">Total brut</p>
                  <p className="tabular text-sm font-semibold text-up">
                    {nf.format(r.totalDividendesBruts)} FCFA
                  </p>
                  <p className="text-[10px] text-faint">par action détenue</p>
                </div>
              </div>
            </section>

            {/* ── LE cœur : le même titre n'enrichit pas également ── */}
            <section className="space-y-3">
              <div>
                <h2 className="font-display text-xl text-white">
                  Le même titre, huit résultats différents
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Même action, même cours, mêmes dividendes. Mais l&apos;
                  <strong className="text-white">impôt</strong> et l&apos;
                  <strong className="text-white">inflation de votre pays</strong> décident de ce
                  qu&apos;il vous en reste.
                </p>
              </div>

              <div className="overflow-x-auto rounded-xl border border-border bg-surface">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-xs text-muted">
                      <th className="px-4 py-3 font-medium">Pays</th>
                      <th className="px-4 py-3 text-right font-medium">IRVM</th>
                      <th className="px-4 py-3 text-right font-medium">Cours seul</th>
                      <th className="px-4 py-3 text-right font-medium">+ dividendes</th>
                      <th className="px-4 py-3 text-right font-medium">Inflation</th>
                      <th className="px-4 py-3 text-right font-medium">RENDEMENT VRAI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {r.pays.map((p) => (
                      <tr key={p.iso3} className={p.resultat.perteReelle ? 'bg-down/5' : undefined}>
                        <td className="px-4 py-3 font-medium text-ivory">
                          {p.nom}
                          {p.resultat.impotNonConfirme && (
                            <span className="ml-1.5 text-[10px] text-warn" title="Taux fiscal non confirmé : le chiffre est un majorant">
                              ⚠
                            </span>
                          )}
                        </td>
                        <td className="tabular px-4 py-3 text-right text-muted">
                          {p.tauxIrvm === null ? '—' : `${(p.tauxIrvm * 100).toFixed(1)} %`}
                        </td>
                        <td className="tabular px-4 py-3 text-right text-faint">
                          {pct(p.resultat.prixSeulPct)}
                        </td>
                        <td className="tabular px-4 py-3 text-right text-muted">
                          {pct(p.resultat.totalNominalPct)}
                        </td>
                        <td className="tabular px-4 py-3 text-right text-muted">
                          +{p.resultat.inflationCumulPct.toFixed(2)} %
                        </td>
                        <td
                          className={`tabular px-4 py-3 text-right text-base font-semibold ${
                            p.resultat.perteReelle ? 'text-down' : 'text-up'
                          }`}
                        >
                          {pct(p.resultat.vraiPct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {r.pays.some((p) => p.resultat.impotNonConfirme) && (
                <p className="rounded-lg border border-warn/30 bg-warn/5 px-4 py-2 text-xs text-warn">
                  ⚠ Taux d&apos;IRVM non confirmé pour certains pays : le calcul est fait{' '}
                  <strong>sans impôt</strong>, le rendement vrai y est donc un{' '}
                  <strong>majorant</strong>. Nous n&apos;inventons pas un taux fiscal.
                </p>
              )}

              {r.pays.some((p) => p.resultat.perteReelle) && (
                <p className="rounded-lg border border-down/30 bg-down/5 px-4 py-2 text-xs text-down">
                  Les lignes en rouge sont des <strong>pertes réelles</strong> : même dividendes
                  compris, le gain n&apos;a pas compensé l&apos;impôt et la hausse des prix.
                </p>
              )}
            </section>

            {/* ── Méthode : tout est sourcé, rien n'est inventé ── */}
            <section className="rounded-xl border border-border bg-surface p-4">
              <h3 className="text-xs font-semibold text-ivory">Méthode et sources</h3>
              <ul className="mt-2 space-y-1 text-xs text-muted">
                <li>
                  <strong className="text-ivory">Détention</strong> : de début {ANNEE_DEBUT} à fin{' '}
                  {ANNEE_FIN}. On encaisse sur cette période les dividendes des exercices 2021 à 2024
                  (chacun est détaché l&apos;année suivante).
                </li>
                <li>
                  <strong className="text-ivory">Réinvestissement</strong> : chaque dividende net
                  rachète des actions au cours du jour, et ces actions rapportent à leur tour. Ce
                  n&apos;est pas une simple addition — c&apos;est la capitalisation.
                </li>
                <li>
                  <strong className="text-ivory">Impôt</strong> : retenue à la source (IRVM) sur les
                  dividendes d&apos;actions cotées, par pays —{' '}
                  <Link href="/fiscalite" className="text-accent underline">barème détaillé</Link>.
                </li>
                <li>
                  <strong className="text-ivory">Inflation</strong> : Banque mondiale, indicateur{' '}
                  <a
                    href="https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG"
                    target="_blank" rel="noopener noreferrer"
                    className="text-accent underline"
                  >FP.CPI.TOTL.ZG</a>. Formule de Fisher, inflation chaînée année par année.
                </li>
                <li>
                  <strong className="text-ivory">Dividendes</strong> : fiches sociétés Sikafinance
                  (une valeur par exercice). Cours : clôtures réelles BRVM.
                </li>
                <li className="text-faint">
                  <strong>Convention assumée</strong> : les dates de détachement n&apos;étant pas
                  publiées avant 2026, le réinvestissement est fait à la clôture la plus proche du
                  30 juin de l&apos;année de détachement — les détachements réellement datés tombent
                  entre fin mai et fin juin.
                </li>
                <li className="text-faint">
                  <strong>Pourquoi pas 10 ans ?</strong> Les dividendes 2017-2020 n&apos;existent
                  chez aucune de nos sources. Le réinvestissement est une chaîne : un trou de quatre
                  ans la brise. Étendre la fenêtre reviendrait à prétendre que ces sociétés
                  n&apos;ont rien distribué — c&apos;est faux, et cela sous-estimerait lourdement le
                  rendement.
                </li>
              </ul>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
