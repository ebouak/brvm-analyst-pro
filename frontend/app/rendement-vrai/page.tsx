import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import {
  buildUnifiedReturn, listCodesUnified, HORIZONS, type Mode, type Horizon,
} from '@/lib/macro/unifiedReturn';
import { RendementExplorer } from '@/components/rendement/RendementExplorer';
import SignupCta from '@/components/public/SignupCta';
import { EnTeteCote } from '@/components/marche/EnTeteCote';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Rendement réel & vrai BRVM : cours + dividendes − inflation',
  description:
    "Ce que votre action BRVM vous a réellement rapporté : cours, puis cours + dividendes réinvestis, corrigés de l'inflation de votre pays UEMOA. Deux vues, un seul écran interactif.",
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

const CHAMP =
  'mt-1 min-h-[44px] rounded-lg border border-border bg-bg px-3 text-sm text-ivory transition-colors hover:border-border-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40';

export default async function Page(
  props: {
    searchParams: Promise<{ code?: string; mode?: string; annees?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const code = (searchParams.code ?? DEFAUT_CODE).toUpperCase();
  const mode = parseMode(searchParams.mode);
  const annees = parseAnnees(searchParams.annees);

  const [codes, report] = await Promise.all([
    listCodesUnified(),
    buildUnifiedReturn(code, mode, annees),
  ]);

  const bascule = (valeur: Mode, libelle: string) => (
    <button
      type="submit"
      name="mode"
      value={valeur}
      aria-pressed={mode === valeur}
      className={`min-h-[44px] px-4 text-sm transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent md:min-h-[36px] ${
        mode === valeur ? 'bg-accent/15 font-medium text-accent-ink' : 'text-muted hover:text-ivory'
      }`}
    >
      {libelle}
    </button>
  );

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border/60 bg-surface">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 md:px-6">
          <Link href="/" className="rounded font-display tracking-tight text-ivory hover:text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            WESTBOURSE
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/login" className="rounded text-muted hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Connexion</Link>
            <Link href="/signup" className="rounded-lg bg-accent px-3.5 py-1.5 font-semibold text-bg transition-colors hover:bg-gold-2 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg">
              Créer un compte
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 md:px-6">
        <EnTeteCote
          titre="Le rendement vrai"
          description="Le cours ne dit qu’une partie de l’histoire. Voici ce qu’une action a réellement rapporté : le cours seul, puis dividendes réinvestis compris, toujours corrigé de l’inflation de votre pays."
          compte={{ n: codes.length, libelle: 'titres disponibles' }}
          source={null}
        />

        <form method="get" className="mt-8 border-t border-border-strong pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-muted">Vue</span>
            <div className="inline-flex overflow-hidden rounded-lg border border-border bg-surface">
              {bascule('reel', 'Cours seul')}
              {bascule('vrai', 'Dividendes compris')}
            </div>
            <span className="text-xs text-faint">
              {mode === 'vrai'
                ? 'Cours et dividendes réinvestis, corrigés de l’inflation.'
                : 'Cours seul corrigé de l’inflation, sur l’horizon choisi.'}
            </span>
          </div>

          <div className="mt-5 flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="text-xs text-muted">Action</span>
              <select name="code" defaultValue={code} className={`${CHAMP} block`}>
                {codes.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}{c.designation ? `, ${c.designation}` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs text-muted">
                Horizon{mode === 'vrai' && <span className="text-faint"> (vue cours seul)</span>}
              </span>
              <select name="annees" defaultValue={String(annees)} disabled={mode === 'vrai'} className={`${CHAMP} block`}>
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
              className="min-h-[44px] rounded-lg bg-accent px-5 text-sm font-semibold text-bg transition active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              Calculer
            </button>
          </div>
        </form>

        <div className="mt-8">
          {!report ? (
            <div className="rounded-card border border-dashed border-border px-5 py-6">
              <p className="text-sm text-ivory">
                Données incomplètes pour <span className="font-mono font-medium">{code}</span>
                {mode === 'vrai' ? ' avec dividendes réinvestis' : ` sur ${annees} ans`}.
              </p>
              <p className="mt-1 text-sm text-muted">
                Un exercice ou un cours manquant n’est pas un zéro : plutôt que de sous-estimer le rendement, rien
                n’est affiché.
              </p>
              {mode === 'vrai' && (
                <Link
                  href={`/rendement-vrai?mode=reel&code=${code}`}
                  className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 rounded text-sm text-accent-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Essayer la vue cours seul
                  <ArrowRight size={14} aria-hidden />
                </Link>
              )}
            </div>
          ) : (
            <>
              <h2 className="text-lg font-medium text-ivory">
                <span className="font-mono">{report.code}</span>
                {report.nom ? <span className="text-ivory/90">, {report.nom}</span> : null}
              </h2>
              <p className="mt-0.5 text-sm text-muted">{report.periodeLabel}</p>

              <div className="mt-5">
                <RendementExplorer report={report} />
              </div>

              <section aria-labelledby="methode-titre" className="mt-10 border-t border-border pt-6">
                <h2 id="methode-titre" className="text-lg font-medium text-ivory">Méthode et sources</h2>
                <ul className="mt-3 max-w-[72ch] space-y-2 text-sm leading-relaxed text-muted">
                  {report.mode === 'vrai' ? (
                    <>
                      <li>
                        <span className="text-ivory">Réinvestissement.</span> Chaque dividende rachète des actions au
                        cours du jour, et ces actions rapportent à leur tour : c’est une capitalisation, pas une
                        addition.
                      </li>
                      <li>
                        <span className="text-ivory">Impôt.</span> Les dividendes sont réinvestis au montant par action
                        tel que publié, sans retenue supposée. Pour les exercices utilisés ici, la base de ce montant
                        (net ou brut d’IRVM) n’est confirmée que pour une minorité de sociétés ; aucun impôt n’est
                        ajouté ni retiré à la place de la source. Barème :{' '}
                        <Link href="/fiscalite" className="text-accent-ink underline underline-offset-2">IRVM par pays</Link>.
                      </li>
                      <li className="text-faint">
                        Convention : les dates de détachement n’étant pas publiées avant 2026, le réinvestissement se fait
                        à la clôture la plus proche du 30 juin de l’année de détachement.
                      </li>
                    </>
                  ) : (
                    <>
                      <li>
                        <span className="text-ivory">Cours seul.</span> Clôtures réelles de la BRVM sur l’horizon
                        choisi. Cette vue ignore les dividendes ; la vue « Dividendes compris » les inclut.
                      </li>
                      <li>
                        <span className="text-ivory">Formule de Fisher.</span> (1 + réel) = (1 + nominal) / (1 +
                        inflation), et non la soustraction, qui surestime le gain dès que l’inflation est élevée.
                      </li>
                    </>
                  )}
                  <li>
                    <span className="text-ivory">Inflation.</span> Banque mondiale, indicateur{' '}
                    <a
                      href="https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-ink underline underline-offset-2"
                    >
                      FP.CPI.TOTL.ZG
                    </a>
                    , chaînée année par année et recoupée avec la BCEAO.
                  </li>
                  <li className="text-faint">
                    Un pays dont la série d’inflation est incomplète est écarté du tableau plutôt que complété par
                    estimation.
                  </li>
                </ul>
              </section>
            </>
          )}
        </div>

        <div className="mt-12">
          <SignupCta
            titre="Suivez le rendement vrai de tout votre portefeuille"
            sousTitre="Cette page est publique. Le compte gratuit débloque le suivi de portefeuille, les alertes et les signaux."
          />
        </div>
      </main>
    </div>
  );
}
