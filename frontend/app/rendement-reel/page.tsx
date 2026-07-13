import type { Metadata } from 'next';
import Link from 'next/link';
import { buildRealReturn, listCodes } from '@/lib/macro/inflation';
import { SectionHeader } from '@/components/ui/premium';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Rendement réel BRVM : votre gain après inflation — WESTBOURSE',
  description:
    "Votre action BRVM vous a-t-elle vraiment enrichi ? Rendement réel corrigé de l'inflation, pays par pays (UEMOA). Cours réels depuis 1998, inflation Banque mondiale.",
};

const HORIZONS = [3, 5, 10] as const;
const DEFAUT_CODE = 'SNTS';
const DEFAUT_ANNEES = 5;

const nf = new Intl.NumberFormat('fr-FR');
const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)} %`;

export default async function Page({
  searchParams,
}: {
  searchParams: { code?: string; annees?: string };
}) {
  const code = (searchParams.code ?? DEFAUT_CODE).toUpperCase();
  const anneesRaw = Number.parseInt(searchParams.annees ?? '', 10);
  const annees = HORIZONS.includes(anneesRaw as (typeof HORIZONS)[number])
    ? anneesRaw
    : DEFAUT_ANNEES;

  const [codes, report] = await Promise.all([listCodes(), buildRealReturn(code, annees)]);

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border/60 bg-surface/60 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="font-display tracking-tight text-white hover:text-accent">
            WESTBOURSE
          </Link>
          <Link href="/" className="text-sm text-muted hover:text-white">
            ← Accueil
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
        <SectionHeader
          kicker="Pouvoir d'achat"
          title="Votre gain est-il réel ?"
          subtitle="Un cours qui monte de 3 % dans un pays où les prix montent de 9 % vous a appauvri. Voici ce que votre action vous a vraiment rapporté."
        />

        {/* Sélecteurs — en GET : l'URL reste partageable et indexable. */}
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
                  {c.code}
                  {c.designation ? ` — ${c.designation}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-muted">Horizon</span>
            <select
              name="annees"
              defaultValue={String(annees)}
              className="mt-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              {HORIZONS.map((h) => (
                <option key={h} value={h}>
                  {h} ans
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
        </form>

        {!report ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center">
            <p className="text-sm text-muted">
              Historique insuffisant pour <strong className="text-white">{code}</strong> sur {annees} ans.
            </p>
            <p className="mt-1 text-xs text-faint">
              Nous n’extrapolons pas : sans cours de départ réel, aucun rendement n’est calculable.
            </p>
          </div>
        ) : (
          <>
            {/* Le nominal — ce que tout le monde regarde. */}
            <section className="rounded-xl border border-border bg-surface p-5">
              <h2 className="text-sm font-semibold text-ivory">
                {report.code}
                {report.nom ? ` — ${report.nom}` : ''} · {report.anneeDebut}–{report.anneeFin}
              </h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted">Cours</p>
                  <p className="tabular mt-0.5 text-sm text-ivory">
                    {nf.format(report.coursDebut)} → {nf.format(report.coursFin)} FCFA
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted">Rendement nominal</p>
                  <p
                    className={`tabular mt-0.5 text-xl font-semibold ${report.nominalPct >= 0 ? 'text-up' : 'text-down'}`}
                  >
                    {pct(report.nominalPct)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted">Soit par an</p>
                  <p className="tabular mt-0.5 text-sm text-ivory">{pct(report.nominalAnnualisePct)}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-faint">
                C’est le chiffre que tout le monde affiche. Il ne dit rien de votre pouvoir d’achat.
              </p>
            </section>

            {/* Le cœur : le MÊME titre n'enrichit pas également selon le pays. */}
            <section className="space-y-3">
              <div>
                <h2 className="font-display text-xl text-white">
                  Le même gain, huit pouvoirs d’achat différents
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Vous détenez la même action, au même cours. Mais l’inflation de{' '}
                  <strong className="text-white">votre pays</strong> décide de ce qu’il vous en reste.
                </p>
              </div>

              {report.pays.length === 0 ? (
                <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
                  Données d’inflation indisponibles sur cette période.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border bg-surface">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-left text-xs text-muted">
                        <th className="px-4 py-3 font-medium">Pays</th>
                        <th className="px-4 py-3 text-right font-medium">Inflation cumulée</th>
                        <th className="px-4 py-3 text-right font-medium">Rendement RÉEL</th>
                        <th className="px-4 py-3 text-right font-medium">Par an</th>
                        <th className="px-4 py-3 text-right font-medium">1 000 000 FCFA deviennent</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {report.pays.map((p) => (
                        <tr key={p.code} className={p.destroysValue ? 'bg-down/5' : undefined}>
                          <td className="px-4 py-3 font-medium text-ivory">{p.nom}</td>
                          <td className="tabular px-4 py-3 text-right text-muted">
                            +{p.cumulPct.toFixed(2)} %
                          </td>
                          <td
                            className={`tabular px-4 py-3 text-right font-semibold ${p.destroysValue ? 'text-down' : 'text-up'}`}
                          >
                            {pct(p.realPct)}
                          </td>
                          <td className="tabular px-4 py-3 text-right text-muted">
                            {pct(p.realAnnualisePct)}
                          </td>
                          <td
                            className={`tabular px-4 py-3 text-right ${p.destroysValue ? 'text-down' : 'text-ivory'}`}
                          >
                            {nf.format(p.pouvoirAchat)} FCFA
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {report.pays.some((p) => p.destroysValue) && (
                <p className="rounded-lg border border-down/30 bg-down/5 px-4 py-3 text-xs text-down">
                  Les lignes en rouge sont des <strong>pertes réelles</strong> : le gain nominal
                  n’a pas suffi à compenser la hausse des prix. L’investisseur s’est appauvri en
                  détenant ce titre.
                </p>
              )}
            </section>

            {/* Sourcer, toujours. */}
            <section className="rounded-xl border border-border bg-surface p-4">
              <h3 className="text-xs font-semibold text-ivory">Méthode et sources</h3>
              <ul className="mt-2 space-y-1 text-xs text-muted">
                <li>
                  <strong className="text-ivory">Cours</strong> : clôtures réelles BRVM
                  ({report.anneeDebut}–{report.anneeFin}), base WESTBOURSE.
                </li>
                <li>
                  <strong className="text-ivory">Inflation</strong> : Banque mondiale, indicateur{' '}
                  <a
                    href="https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline"
                  >
                    FP.CPI.TOTL.ZG
                  </a>{' '}
                  (prix à la consommation, % annuel). Chiffre recoupé avec la BCEAO.
                </li>
                <li>
                  <strong className="text-ivory">Formule</strong> : Fisher —
                  (1 + réel) = (1 + nominal) / (1 + inflation). Pas la soustraction, qui surestime
                  le gain dès que l’inflation est élevée.
                </li>
                <li>
                  <strong className="text-ivory">Inflation cumulée</strong> : chaînage année par
                  année (produit des facteurs), et non moyenne arithmétique.
                </li>
                <li className="text-faint">
                  Hors dividendes et hors fiscalité. Pour l’impôt sur les dividendes, voir le{' '}
                  <Link href="/fiscalite" className="text-accent underline">
                    calculateur fiscal IRVM
                  </Link>
                  . Un pays dont la série d’inflation est incomplète est écarté du tableau plutôt
                  que complété par estimation.
                </li>
              </ul>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
