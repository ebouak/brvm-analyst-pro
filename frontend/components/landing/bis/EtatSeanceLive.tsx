'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRealtimeActions } from '@/lib/realtime/useRealtimeActions';
import type { RealtimeActionRow } from '@/lib/realtime/mergeActions';
import { fmtNumber } from '@/lib/format';
import { pct, tone, fmtMd } from '@/lib/landing/formats';

/**
 * L'état de la séance en direct : les trois compteurs ET les capitaux.
 *
 * LE SERVEUR REND LES CHIFFRES, LE CLIENT LES CORRIGE. Ce composant reçoit les
 * valeurs déjà calculées côté serveur et les affiche telles quelles au premier
 * rendu : elles sont donc dans le HTML servi — vérifié sur la production — et
 * la première peinture ne coûte rien de plus. L'abonnement Realtime ne prend la
 * main qu'après hydratation. C'est l'ordre inverse qui aurait abîmé le LCP,
 * mesuré et optimisé sur cette landing.
 *
 * UN SEUL ABONNEMENT POUR LES DEUX BLOCS. Compteurs et capitaux sont rendus par
 * ce même composant, bien qu'ils occupent deux cartes distinctes de la grille.
 * Les séparer aurait ouvert deux canaux Supabase sur le même sujet
 * (`cours-live-<date>`) — du gaspillage, et deux états pouvant diverger d'une
 * fraction de seconde sur la même séance.
 */

export interface EtatSeanceLiveProps {
  /** Une ligne par valeur cotée du jour. */
  seed: RealtimeActionRow[];
  dateMarche: string | null;
  /** Comptes calculés au serveur : affichés tant que rien n'a bougé. */
  hausses: number;
  inchangees: number;
  baisses: number;
  nbActions: number;
  /** Capitaux calculés au serveur. */
  valeurEchangee: number | null;
  titresEchanges: number | null;
  transactions: number | null;
  /** Totaux de la séance PRÉCÉDENTE, pour recalculer les écarts exactement. */
  veilleValeur: number | null;
  veilleTitres: number | null;
  veilleTransactions: number | null;
}

/** Une variation absente n'est ni une hausse, ni une baisse, ni une stable :
 *  la ranger quelque part serait affirmer un chiffre qu'on n'a pas. */
function compter(rows: readonly RealtimeActionRow[]) {
  let hausses = 0, baisses = 0, stables = 0;
  for (const r of rows) {
    const v = r.variation_pct;
    if (v == null || !Number.isFinite(v)) continue;
    if (v > 0) hausses++;
    else if (v < 0) baisses++;
    else stables++;
  }
  return { hausses, baisses, stables, total: hausses + baisses + stables };
}

/** Somme d'une colonne, `null` si AUCUNE ligne ne la renseigne — un total de
 *  zéro affiché sur des données absentes serait un chiffre inventé. */
function somme(rows: readonly RealtimeActionRow[], lire: (r: RealtimeActionRow) => number | null | undefined) {
  let vu = false, total = 0;
  for (const r of rows) {
    const v = lire(r);
    if (v == null || !Number.isFinite(v)) continue;
    vu = true;
    total += v;
  }
  return vu ? total : null;
}

/** Écart relatif à la veille. Même formule que le serveur (`bisData`). */
const vs = (a: number | null, b: number | null) => (a != null && b != null && b > 0 ? ((a - b) / b) * 100 : null);

export function EtatSeanceLive(p: EtatSeanceLiveProps) {
  // Référence stable : sans `useMemo`, l'effet de `useRealtimeActions` reboucle
  // à l'infini. Même piège que `DashboardTicker`, où la boucle bloquait toute
  // navigation par <Link>.
  const graine = useMemo(() => p.seed, [p.seed]);
  const { rows } = useRealtimeActions(graine, p.dateMarche);

  // Tant que le direct n'a rien de mieux, on garde les chiffres du serveur : un
  // compteur tombé à zéro le temps d'une hydratation serait pire qu'un compteur
  // figé.
  const live = compter(rows);
  const vivant = live.total > 0;

  const h = vivant ? live.hausses : p.hausses;
  const s = vivant ? live.stables : p.inchangees;
  const b = vivant ? live.baisses : p.baisses;
  const total = vivant ? live.total : p.nbActions;

  const valeur = vivant ? somme(rows, (r) => r.valeur_echangee) : p.valeurEchangee;
  const titres = vivant ? somme(rows, (r) => r.volume) : p.titresEchanges;
  const tx = vivant ? somme(rows, (r) => r.nb_transactions) : p.transactions;

  const pourcent = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const tuiles = [
    { cle: 'r2a', sens: 'hausse', ton: 'up', ico: '↑', valeur: h, mot: 'hausses', aria: 'en hausse' },
    { cle: 'r2b', sens: 'stable', ton: '', ico: '−', valeur: s, mot: 'stables', aria: 'stables' },
    { cle: 'r2c', sens: 'baisse', ton: 'down', ico: '↓', valeur: b, mot: 'baisses', aria: 'en baisse' },
  ] as const;

  const cles = [
    { libelle: 'Valeur échangée', texte: valeur != null ? `${fmtMd(valeur)} FCFA` : '—', ecart: vs(valeur, p.veilleValeur) },
    { libelle: 'Titres échangés', texte: titres != null ? fmtNumber(titres) : '—', ecart: vs(titres, p.veilleTitres) },
    { libelle: 'Transactions', texte: tx != null ? fmtNumber(tx) : '—', ecart: vs(tx, p.veilleTransactions) },
  ];

  return (
    <>
      {tuiles.map((t) => (
        <Link
          key={t.cle}
          href={`/societes?sens=${t.sens}`}
          className={`card tile ${t.cle}`}
          aria-label={`Voir les valeurs ${t.aria} de la séance`}
        >
          <span className={`ico ${t.ton}`}>{t.ico}</span>
          <div>
            {/* `aria-live` poli : une cotation qui change ne doit pas
                interrompre un lecteur d'écran en pleine lecture. */}
            <b className={`num ${t.ton}`} aria-live="polite">{t.valeur}</b>
            <span>
              {t.mot}
              <small className="num">{pourcent(t.valeur)} %</small>
            </span>
          </div>
          <i className={`bar ${t.ton}`} style={{ width: `${pourcent(t.valeur)}%` }} aria-hidden="true" />
        </Link>
      ))}

      <div className="card keys r2d">
        <ul className="keys-l num">
          {cles.map((c) => (
            <li key={c.libelle}>
              <b aria-live="polite">{c.texte}</b>
              <span>{c.libelle}</span>
              {c.ecart != null && (
                <small>
                  <i className={`chip ${tone(c.ecart)}`}>{pct(c.ecart, 1)}</i> vs veille
                </small>
              )}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
