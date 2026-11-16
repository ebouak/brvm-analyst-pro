import type { Metadata } from 'next';
import Link from 'next/link';
import PublicShell from '@/components/public/PublicShell';
import CourbeNervosite from '@/components/nervosite/CourbeNervosite';
import { createPublicClient } from '@/lib/supabase/public';
import { chargerSerieNervosite } from '@/lib/nervosite/lecture';
import {
  BORNES_REGIME, LIBELLE_REGIME, TON_REGIME, echantillonHebdo, fmtNervosite, phraseRang, syntheseSerie,
  type LigneNervosite,
} from '@/lib/nervosite/affichage';
import { FENETRE_INIT, FENETRE_LENTE, FENETRE_RANG, LAMBDA, SEUIL_ABERRANT, SEANCES_PAR_AN, type Regime } from '@/lib/nervosite/nervosite';
import { fmtDateFR, fmtNumber } from '@/lib/format';

export const revalidate = 3600;
export const metadata: Metadata = {
  title: 'Indice de nervosité BRVM-V · volatilité du marché BRVM',
  description:
    "BRVM-V mesure, séance après séance, l'agitation du marché boursier régional de l'UEMOA : volatilité réalisée du marché large, en pourcentage annualisé, avec son rang sur les cinq dernières années. Méthode et limites publiées.",
  alternates: { canonical: '/nervosite' },
};

const REGIMES: Regime[] = ['calme', 'normal', 'agité', 'tendu'];
const virgule = (x: number) => x.toLocaleString('fr-FR');

/**
 * Page publique de l'indice de nervosité BRVM-V. Tout chiffre vient de
 * `brvm_nervosite_daily` (calculée par le scraper) ou des constantes du module
 * de calcul : rien n'est saisi à la main. Pas de loading.tsx (règle anti-soft-404).
 */
export default async function Page() {
  let serie: LigneNervosite[] | null = null;
  try {
    serie = await chargerSerieNervosite(createPublicClient());
  } catch {
    serie = null;
  }
  const synthese = serie ? syntheseSerie(serie) : null;

  return (
    <PublicShell>
      <header className="mb-8 border-b border-border pb-4">
        <h1 className="font-display text-3xl text-ivory md:text-4xl">Nervosité du marché BRVM</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          L’indice <span className="text-ivory">BRVM-V</span> mesure l’agitation du marché boursier régional : la
          volatilité réalisée de l’ensemble des actions cotées, exprimée en pourcentage annualisé, comme le VIX
          américain. Plus il est haut, plus les cours ont bougé ces dernières séances.
        </p>
      </header>

      {serie === null ? (
        <p className="rounded-xl border border-warn/40 bg-warn/10 p-4 text-sm text-warn">
          L’indice n’a pas pu être lu pour le moment. Nous ne publions pas de valeur que nous ne pouvons pas relire.
        </p>
      ) : !synthese ? (
        <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
          {serie.length === 0
            ? 'Le premier calcul de l’indice n’a pas encore été publié.'
            : `L’historique est encore trop court pour calculer l’indice : ${FENETRE_LENTE} séances sont nécessaires.`}
        </p>
      ) : (
        <Resultats serie={serie} s={synthese} />
      )}

      <Methode minTitres={synthese?.minTitres ?? null} />

      <p className="mt-8 rounded-xl border border-border bg-surface p-4 text-xs text-muted">
        L’indice décrit des mouvements passés. Ce n’est ni une prévision ni un conseil en investissement : un marché
        agité peut se calmer dès la séance suivante, et un marché calme n’est pas un marché sans risque.
      </p>
    </PublicShell>
  );
}

function Resultats({ serie, s }: { serie: LigneNervosite[]; s: NonNullable<ReturnType<typeof syntheseSerie>> }) {
  const d = s.derniere;
  const hebdo = echantillonHebdo(serie);
  const unAn = serie.filter((l) => l.valeur !== null).slice(-SEANCES_PAR_AN);
  const totalClasse = REGIMES.reduce((n, r) => n + s.parRegime[r], 0);
  return (
    <div className="space-y-8">
      <section aria-labelledby="t-jour" className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
        <h2 id="t-jour" className="sr-only">Valeur de la dernière séance</h2>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Séance du <span className="tabular">{fmtDateFR(d.date_marche)}</span></p>
          {d.valeur === null ? (
            <p className="mt-2 text-sm text-muted">Pas de valeur publiée pour cette séance.</p>
          ) : (
            <>
              <p className="mt-1 flex flex-wrap items-baseline gap-3">
                <span className="tabular text-4xl text-ivory">{fmtNervosite(d.valeur)}</span>
                {d.regime && (
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TON_REGIME[d.regime]}`}>
                    {LIBELLE_REGIME[d.regime]}
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs text-faint">Volatilité annualisée du marché large, {d.n_titres} titres ce jour-là</p>
              {d.rang !== null && <p className="mt-2 text-sm text-muted">{phraseRang(d.rang)}</p>}
            </>
          )}
        </div>
        <Composante titre="Composante rapide" valeur={d.rapide} note={`Moyenne exponentielle, λ = ${virgule(LAMBDA)}`} />
        <Composante titre="Composante lente" valeur={d.lente} note={`Moyenne des ${FENETRE_LENTE} dernières séances`} />
      </section>

      <section aria-labelledby="t-long">
        <h2 id="t-long" className="font-display text-lg text-ivory">Depuis {s.debut.slice(0, 4)}</h2>
        <p className="mt-1 text-xs text-faint">
          Une valeur par semaine (dernière séance). Plus haut : <span className="tabular text-muted">{fmtNervosite(s.plusHaut.valeur)}</span> le{' '}
          {fmtDateFR(s.plusHaut.date)} · plus bas : <span className="tabular text-muted">{fmtNervosite(s.plusBas.valeur)}</span> le {fmtDateFR(s.plusBas.date)}.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface p-3">
          <CourbeNervosite lignes={hebdo} titre={`Indice BRVM-V par semaine, du ${fmtDateFR(hebdo[0]!.date_marche)} au ${fmtDateFR(hebdo.at(-1)!.date_marche)}`} />
        </div>
      </section>

      <section aria-labelledby="t-an">
        <h2 id="t-an" className="font-display text-lg text-ivory">Les {unAn.length} dernières séances</h2>
        <Legende />
        <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface p-3">
          <CourbeNervosite lignes={unAn} composantes reperes="trimestres" titre={`Indice BRVM-V et ses deux composantes sur ${unAn.length} séances`} />
        </div>
        <p className="mt-2 text-xs text-faint">
          La composante rapide réagit en quelques séances, la lente retient une année : quand la rapide passe au-dessus,
          le marché bouge plus que d’habitude ces derniers jours. L’indice est la moyenne des deux variances.
        </p>
      </section>

      <section aria-labelledby="t-regimes">
        <h2 id="t-regimes" className="font-display text-lg text-ivory">Les quatre régimes</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Le régime ne dépend pas d’un seuil fixe : il dépend du <span className="text-ivory">rang</span> de la valeur du
          jour parmi les valeurs des cinq dernières années ({fmtNumber(FENETRE_RANG, 0)} séances au plus, ce jour compris,
          jamais de valeur postérieure). Un marché « tendu » est donc tendu par rapport à sa propre histoire récente,
          pas par rapport à une autre bourse ni à des années où la cote était différente.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-faint">
                <th className="px-3 py-2 font-normal">Régime</th>
                <th className="px-3 py-2 font-normal">Rang</th>
                <th className="px-3 py-2 text-right font-normal">Séances depuis {s.debut.slice(0, 4)}</th>
              </tr>
            </thead>
            <tbody>
              {REGIMES.map((r) => (
                <tr key={r} className="border-t border-border/60">
                  <td className="px-3 py-2">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${TON_REGIME[r]}`}>{LIBELLE_REGIME[r]}</span>
                  </td>
                  <td className="px-3 py-2 text-muted">{BORNES_REGIME[r]}</td>
                  <td className="tabular px-3 py-2 text-right text-ivory">{fmtNumber(s.parRegime[r], 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-faint">
          {fmtNumber(totalClasse, 0)} séances classées sur {fmtNumber(s.seancesAvecValeur, 0)} dotées d’une valeur : la
          première année de valeurs sert d’historique au rang et n’est pas classée. Avant cinq ans de valeurs, le rang
          porte sur toutes celles connues à la date.
        </p>
      </section>
    </div>
  );
}

function Composante({ titre, valeur, note }: { titre: string; valeur: number | null; note: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-muted">{titre}</p>
      <p className="tabular mt-1 text-2xl text-ivory">{valeur === null ? '—' : fmtNervosite(valeur)}</p>
      <p className="text-xs text-faint">{note}</p>
    </div>
  );
}

function Legende() {
  return (
    <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Légende">
      <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-0.5 w-5 bg-accent" />Indice BRVM-V</li>
      <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-px w-5 bg-muted" />Composante rapide</li>
      <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block w-5 border-t-2 border-dashed border-warn" />Composante lente</li>
    </ul>
  );
}

function Methode({ minTitres }: { minTitres: number | null }) {
  return (
    <section className="mt-10 space-y-3 text-sm text-muted" aria-labelledby="t-methode">
      <h2 id="t-methode" className="font-display text-lg text-ivory">Méthode</h2>
      <p>
        <span className="text-ivory">Pourquoi pas un VIX ?</span> Le VIX se déduit du prix des options sur indice. La
        BRVM n’a pas de marché d’options : aucune volatilité « implicite » n’est observable. BRVM-V mesure donc la
        volatilité <span className="text-ivory">réalisée</span>, celle que les cours ont effectivement eue.
      </p>
      <p>
        <span className="text-ivory">Le marché large.</span> Chaque séance, on calcule le rendement logarithmique de
        chaque action par rapport à sa cotation précédente, puis la moyenne simple de ces rendements. Toutes les actions
        pèsent le même poids, quelle que soit leur capitalisation
        {minTitres !== null && <>; une séance n’entre dans l’indice qu’avec au moins {minTitres} titres cotés</>}.
      </p>
      <p>
        <span className="text-ivory">Deux mémoires.</span> La composante rapide est une moyenne exponentielle des
        rendements au carré (λ = {virgule(LAMBDA)}, initialisée sur {FENETRE_INIT} séances) : elle réagit en quelques
        jours. La composante lente est la moyenne des rendements au carré sur {FENETRE_LENTE} séances, soit environ une
        année. L’indice vaut 100 × √{SEANCES_PAR_AN} × √(½ variance rapide + ½ variance lente). Il n’existe qu’à partir
        de {FENETRE_LENTE} séances d’historique.
      </p>
      <p>
        <span className="text-ivory">Opérations sur titres.</span> La cotation BRVM limite la variation d’une séance.
        Au-delà de ±{virgule(SEUIL_ABERRANT * 100)} %, le mouvement vient d’un fractionnement, d’un détachement ou d’une
        erreur, pas du marché : il est compté comme nul. C’est le cas du fractionnement de Sonatel du 26 octobre 2026.
      </p>
      <h3 className="pt-2 font-display text-base text-ivory">Limites</h3>
      <ul className="list-disc space-y-1.5 pl-5">
        <li>Un marché étroit : une poignée de valeurs fait l’essentiel des échanges, et quelques séances agitées suffisent à déplacer l’indice.</li>
        <li>Moyenne simple, non pondérée : une petite capitalisation compte autant que Sonatel.</li>
        <li>Une valeur peu échangée garde souvent le même cours d’une séance à l’autre ; ses rendements nuls tirent l’indice vers le bas.</li>
        <li>Les premières années de la base comptent moins de titres que la cote actuelle : l’indice de 2008 et celui d’aujourd’hui ne portent pas sur le même marché. C’est pourquoi le rang compare la séance aux cinq dernières années seulement, et non à toute cette histoire : les premières années, plus agitées, faisaient paraître calme une séance ordinaire. Le régime d’une séance ancienne reste celui calculé avec les cinq années qui la précèdent.</li>
      </ul>
      <p>
        Les cours viennent des publications de la BRVM, relus chaque séance. Voir aussi la{' '}
        <Link href="/methodologie" className="text-accent-ink hover:underline">méthodologie</Link> et la page{' '}
        <Link href="/operations-titres" className="text-accent-ink hover:underline">opérations sur titres</Link>.
      </p>
    </section>
  );
}
