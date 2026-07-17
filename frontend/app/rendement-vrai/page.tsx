import type { Metadata } from 'next';
import Link from 'next/link';
import {
  buildUnifiedReturn, listCodesUnified, HORIZONS, type Mode, type Horizon,
} from '@/lib/macro/unifiedReturn';
import { RendementExplorer } from '@/components/rendement/RendementExplorer';
import { SectionHeader } from '@/components/ui/premium';
import SignupCta from '@/components/public/SignupCta';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Rendement réel & vrai BRVM : cours + dividendes − inflation',
  description:
    "Ce que votre action BRVM vous a réellement rapporté : cours, puis cours + dividendes nets réinvestis, corrigés de l'inflation de votre pays UEMOA. Deux vues, un seul écran interactif.",
};

const DEFAUT_CODE = 'SNTS';
const DEFAUT_ANNEES: Horizon = 5;

function parseMode(v: string | undefined): Mode {
  return v === 'reel' ? 'reel' : 'vrai';
}
function parseAnnees(v: string | undefined): Horizon {
  const n = Number.parseInt(v ?? '', 10);
  return HORIZONS.includes(n as Horizon) ? (n as Horizon) : DEFAUT_ANNEES;
}

export default async function Page({
  searchParams,
}: {
  searchParams: { code?: string; mode?: string; annees?: string };
}) {
  const code = (searchParams.code ?? DEFAUT_CODE).toUpperCase();
  const mode = parseMode(searchParams.mode);
  const annees = parseAnnees(searchParams.annees);

  const [codes, report] = await Promise.all([
    listCodesUnified(),
    buildUnifiedReturn(code, mode, annees),
  ]);

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border/60 bg-surface/60 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="font-display tracking-tight text-white hover:text-accent">
            WESTBOURSE
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/login" className="text-muted hover:text-white">Connexion</Link>
            <Link href="/signup" className="rounded-lg bg-accent px-3.5 py-1.5 font-semibold text-bg transition-colors hover:bg-gold-2 active:scale-95">
              Créer un compte
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
        <SectionHeader
          kicker="Pouvoir d'achat"
          title="Le rendement vrai"
          subtitle="Le cours ne dit qu'une partie de l'histoire. Voici ce que votre action vous a réellement rapporté — d'abord le cours seul, puis dividendes nets réinvestis compris, toujours corrigé de l'inflation de votre pays."
        />

        <form method="get" className="space-y-4 rounded-xl border border-border bg-surface p-4">
          {/* Bascule de mode : le geste central de l'écran unifié. */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-muted">Vue</span>
            <div className="inline-flex rounded-full border border-border bg-bg p-1">
              <button
                type="submit"
                name="mode"
                value="reel"
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  mode === 'reel' ? 'bg-accent text-[#03222b]' : 'text-muted hover:text-white'
                }`}
              >
                Cours seul · réel
              </button>
              <button
                type="submit"
                name="mode"
                value="vrai"
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  mode === 'vrai' ? 'bg-accent text-[#03222b]' : 'text-muted hover:text-white'
                }`}
              >
                + Dividendes · vrai
              </button>
            </div>
            <span className="text-[11px] text-faint">
              {mode === 'vrai'
                ? 'Cours + dividendes nets réinvestis, corrigés de l’inflation.'
                : 'Cours seul corrigé de l’inflation — horizon au choix.'}
            </span>
          </div>

          <div className="flex flex-wrap items-end gap-3 border-t border-border/50 pt-4">
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

            <label className="block">
              <span className="text-xs text-muted">
                Horizon {mode === 'vrai' && <span className="text-faint">(mode réel)</span>}
              </span>
              <select
                name="annees"
                defaultValue={String(annees)}
                disabled={mode === 'vrai'}
                className="mt-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-40"
              >
                {HORIZONS.map((h) => (
                  <option key={h} value={h}>{h} ans</option>
                ))}
              </select>
            </label>

            {/* Applique code/horizon en conservant le mode courant. */}
            <button
              type="submit"
              name="mode"
              value={mode}
              className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-[#03222b] transition active:scale-95"
            >
              Calculer
            </button>

            <span className="ml-auto text-xs text-faint">{codes.length} titres</span>
          </div>
        </form>

        {!report ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center">
            <p className="text-sm text-muted">
              Données incomplètes pour <strong className="text-white">{code}</strong>
              {mode === 'vrai' ? ' en mode dividendes réinvestis' : ` sur ${annees} ans`}.
            </p>
            <p className="mt-1 text-xs text-faint">
              Un exercice ou un cours manquant n&apos;est pas un zéro : plutôt que de sous-estimer le
              rendement, nous préférons ne rien afficher.
            </p>
            {mode === 'vrai' && (
              <Link
                href={`/rendement-vrai?mode=reel&code=${code}`}
                className="mt-3 inline-block rounded-full border border-accent/40 px-4 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/10"
              >
                Essayer la vue « cours seul · réel » →
              </Link>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-muted">
              <strong className="text-ivory">{report.code}</strong>
              {report.nom ? ` — ${report.nom}` : ''}
              <span className="text-faint"> · {report.periodeLabel}</span>
            </p>

            <RendementExplorer report={report} />

            {/* ── Méthode et sources ── */}
            <section className="rounded-xl border border-border bg-surface p-4">
              <h3 className="text-xs font-semibold text-ivory">Méthode et sources</h3>
              <ul className="mt-2 space-y-1 text-xs text-muted">
                {report.mode === 'vrai' ? (
                  <>
                    <li>
                      <strong className="text-ivory">Réinvestissement</strong> : chaque dividende net
                      rachète des actions au cours du jour, et ces actions rapportent à leur tour. Ce
                      n&apos;est pas une addition — c&apos;est la capitalisation.
                    </li>
                    <li>
                      <strong className="text-ivory">Impôt (déjà déduit)</strong> : les dividendes
                      publiés par les émetteurs BRVM sont <strong>nets d&apos;IRVM</strong>, prélevé à
                      la source par l&apos;émetteur selon son pays de cotation — pas le vôtre. On les
                      réinvestit tels quels, sans les re-taxer. Détail :{' '}
                      <Link href="/fiscalite" className="text-accent underline">barème IRVM par pays</Link>.
                    </li>
                    <li className="text-faint">
                      <strong>Convention assumée</strong> : les dates de détachement n&apos;étant pas
                      publiées avant 2026, le réinvestissement est fait à la clôture la plus proche du
                      30 juin de l&apos;année de détachement.
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      <strong className="text-ivory">Cours seul</strong> : clôtures réelles BRVM sur
                      l&apos;horizon choisi. Cette vue <strong>ignore les dividendes</strong> — pour
                      les inclure, passez à la vue « + Dividendes · vrai ».
                    </li>
                    <li>
                      <strong className="text-ivory">Formule</strong> : Fisher —
                      (1 + réel) = (1 + nominal) / (1 + inflation). Pas la soustraction, qui surestime
                      le gain dès que l&apos;inflation est élevée.
                    </li>
                  </>
                )}
                <li>
                  <strong className="text-ivory">Inflation</strong> : Banque mondiale, indicateur{' '}
                  <a
                    href="https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG"
                    target="_blank" rel="noopener noreferrer"
                    className="text-accent underline"
                  >FP.CPI.TOTL.ZG</a>, chaînée année par année. Recoupée avec la BCEAO.
                </li>
                <li className="text-faint">
                  Un pays dont la série d&apos;inflation est incomplète est écarté du tableau plutôt
                  que complété par estimation.
                </li>
              </ul>
            </section>
          </>
        )}

        <SignupCta
          titre="Suivez le rendement vrai de tout votre portefeuille"
          sousTitre="Cette page est publique. Le compte gratuit débloque le suivi de portefeuille, les alertes et les signaux."
        />
      </main>
    </div>
  );
}
