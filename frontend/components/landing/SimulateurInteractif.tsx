'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { simulateInvestment, type PricePoint, type DividendPoint } from '@/lib/simulate';
import { fmtNumber, fmtDateFR } from '@/lib/format';

/**
 * Simulateur de la landing — interactif, sur des CLÔTURES RÉELLES.
 *
 * POURQUOI CÔTÉ CLIENT. `simulateInvestment` est une fonction PURE et testée :
 * elle peut recalculer dans le navigateur exactement ce que le serveur
 * calculait. Chaque déplacement de curseur produit donc un résultat vrai, pas
 * une interpolation — aucun chiffre n'est inventé entre deux positions.
 *
 * LA SÉRIE EST ÉCHANTILLONNÉE AU MOIS, et c'est un choix assumé. Envoyer cinq
 * ans de clôtures quotidiennes (~1250 points) alourdirait la landing pour un
 * curseur qui n'a pas besoin de cette finesse. Chaque point reste une VRAIE
 * clôture — jamais une moyenne — et la dernière séance connue est ajoutée
 * telle quelle en fin de série, pour que la valeur d'arrivée soit le cours du
 * jour et non celui du début du mois. La date de départ réellement utilisée
 * est AFFICHÉE : le lecteur voit sur quoi porte le calcul.
 *
 * CE QUE ÇA NE FAIT PAS : aucune projection. Le curseur remonte dans le passé,
 * il ne prédit rien. Le disclaimer n'est pas une formalité, c'est la nature
 * même du calcul.
 */

interface Props {
  code: string;
  nom: string | null;
  /** Clôtures réelles, échantillonnées au mois + dernière séance. */
  serie: PricePoint[];
  dividendes: DividendPoint[];
}

const MONTANTS = [250_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000];

export function SimulateurInteractif({ code, nom, serie, dividendes }: Props) {
  // Position de départ : par défaut le point le plus ancien (la plus longue
  // période disponible), qui est aussi la plus parlante.
  const [idxDepart, setIdxDepart] = useState(0);
  const [idxMontant, setIdxMontant] = useState(MONTANTS.indexOf(1_000_000));

  const montant = MONTANTS[idxMontant] ?? 1_000_000;
  const depart = serie[idxDepart];

  const res = useMemo(
    () => (depart ? simulateInvestment(montant, depart.date, serie, dividendes) : null),
    [montant, depart, serie, dividendes],
  );

  if (serie.length < 2) {
    return (
      <p className="rounded-xl border border-border/70 bg-sunken/30 p-3.5 text-[13px] text-faint">
        Le calcul s&apos;affichera dès que l&apos;historique sera disponible.
      </p>
    );
  }

  const positif = (res?.gain ?? 0) >= 0;

  return (
    <div>
      <p className="text-xs leading-relaxed text-muted">
        {fmtNumber(montant)} FCFA dans {nom ?? code}
        {res ? <> à partir du {fmtDateFR(res.startDate)}, aujourd&apos;hui :</> : ' :'}
      </p>

      {res ? (
        <>
          <p className="tabular mt-1.5 font-display text-4xl text-ivory">
            {fmtNumber(Math.round(res.finalValue))} <span className="text-base text-muted">FCFA</span>
          </p>
          <p className={`tabular mt-1 text-sm font-bold ${positif ? 'text-up' : 'text-down'}`}>
            {positif ? '+' : ''}
            {fmtNumber(res.totalReturnPct, 1)} %
            {/* RENDEMENT ANNUALISÉ : affiché SEULEMENT au-delà d'un an.
                `simulateInvestment` le calcule dès 30 jours, ce qui est
                mathématiquement correct mais trompeur à l'écran : un gain de
                quatre mois extrapolé donne « 147 % par an », et ça se lit
                comme une promesse. Sous un an, on montre le rendement de la
                période, point. */}
            {res.annualizedReturnPct != null && res.years >= 1 && (
              <span className="font-normal text-muted">
                {' '}· {fmtNumber(res.annualizedReturnPct, 1)} % par an
              </span>
            )}
            {res.years < 1 && <span className="font-normal text-muted"> sur la période</span>}
          </p>

          {/* La DÉCOMPOSITION est le cœur pédagogique : elle montre que le
              rendement ne vient pas que du cours. Sans elle, les dividendes
              restent une abstraction. */}
          <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border/60 pt-3">
            {[
              { l: 'Actions achetées', v: fmtNumber(res.shares) },
              { l: 'Dividendes perçus', v: `${fmtNumber(Math.round(res.totalDividends))} F` },
              { l: 'Plus-value', v: `${fmtNumber(Math.round(res.gain))} F` },
            ].map((x) => (
              <div key={x.l}>
                <dt className="text-[11px] leading-snug text-faint">{x.l}</dt>
                <dd className="tabular mt-0.5 text-[13px] font-medium text-ivory">{x.v}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <p className="mt-2 text-[13px] text-faint">
          Ce montant ne suffit pas à acheter une action à cette date. Augmentez-le.
        </p>
      )}

      {/* ── Les deux curseurs ──────────────────────────────────────────── */}
      <div className="mt-5 space-y-4">
        <label className="block">
          <span className="flex items-baseline justify-between text-[11px] text-muted">
            <span>Montant investi</span>
            <span className="tabular font-medium text-ivory">{fmtNumber(montant)} FCFA</span>
          </span>
          <input
            type="range"
            min={0}
            max={MONTANTS.length - 1}
            step={1}
            value={idxMontant}
            onChange={(e) => setIdxMontant(Number(e.target.value))}
            className="mt-1.5 w-full accent-accent"
            aria-label="Montant investi"
          />
        </label>

        <label className="block">
          <span className="flex items-baseline justify-between text-[11px] text-muted">
            <span>Date de départ</span>
            <span className="tabular font-medium text-ivory">
              {res ? `${fmtNumber(res.years, 1)} ans` : depart ? fmtDateFR(depart.date) : '—'}
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={serie.length - 2}
            step={1}
            /* Inversé : vers la droite = plus récent = période plus courte.
               C'est le sens de lecture d'une frise temporelle. */
            value={idxDepart}
            onChange={(e) => setIdxDepart(Number(e.target.value))}
            className="mt-1.5 w-full accent-accent"
            aria-label="Date de départ de l'investissement"
          />
        </label>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-faint">
        Calcul réel sur les cours de clôture, dividendes inclus. Le curseur remonte dans le passé :
        il ne prédit rien. Les performances passées ne préjugent pas des performances futures.
      </p>

      <Link
        href="/simulateur"
        className="mt-4 inline-block text-sm font-medium text-ivory/80 transition-colors hover:text-gold-2"
      >
        Tester une autre action <span aria-hidden>→</span>
      </Link>
    </div>
  );
}
