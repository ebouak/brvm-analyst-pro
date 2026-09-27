'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRealtimeActions } from '@/lib/realtime/useRealtimeActions';
import type { RealtimeActionRow } from '@/lib/realtime/mergeActions';

/**
 * Les trois compteurs de séance — hausses, stables, baisses — en direct.
 *
 * LE SERVEUR REND LES CHIFFRES, LE CLIENT LES CORRIGE. Ce composant reçoit les
 * comptes déjà calculés côté serveur et les affiche tels quels au premier
 * rendu : ils sont donc dans le HTML servi, et la première peinture ne coûte
 * rien de plus. L'abonnement Realtime ne prend la main qu'après hydratation,
 * pour refléter les cotations qui bougent pendant la séance. C'est l'ordre
 * inverse qui aurait abîmé le LCP, mesuré et optimisé sur cette landing.
 *
 * ⚠️ SEULS CES TROIS COMPTEURS SONT EN DIRECT, et c'est délibéré.
 * `useRealtimeActions` porte de façon fiable `cours_jour` et `variation_pct`.
 * Sa resynchronisation au retour d'onglet (`visibilitychange`) ne resélectionne
 * PAS `valeur_echangee` ni `nb_transactions` : étendre le direct aux capitaux
 * donnerait un chiffre juste en séance et périmé après un simple changement
 * d'onglet, sans que rien ne le signale. Les capitaux restent rendus au
 * serveur, avec la fraîcheur affichée à côté.
 */

export interface CompteursLiveProps {
  /** Une ligne par valeur cotée du jour (code, cours, variation). */
  seed: RealtimeActionRow[];
  dateMarche: string | null;
  /** Comptes calculés au serveur : affichés tant que rien n'a bougé. */
  hausses: number;
  inchangees: number;
  baisses: number;
  nbActions: number;
}

/** Une variation absente n'est ni une hausse, ni une baisse, ni une stable :
 *  la ranger quelque part serait affirmer un chiffre qu'on n'a pas. */
function compter(rows: readonly RealtimeActionRow[]) {
  let hausses = 0;
  let baisses = 0;
  let stables = 0;
  for (const r of rows) {
    const v = r.variation_pct;
    if (v == null || !Number.isFinite(v)) continue;
    if (v > 0) hausses++;
    else if (v < 0) baisses++;
    else stables++;
  }
  return { hausses, baisses, stables, total: hausses + baisses + stables };
}

export function CompteursLive({ seed, dateMarche, hausses, inchangees, baisses, nbActions }: CompteursLiveProps) {
  // Référence stable : sans `useMemo`, `useRealtimeActions` reboucle à l'infini
  // (son effet dépend du tableau reçu). Même piège que `DashboardTicker`, où la
  // boucle bloquait toute navigation par <Link>.
  const graine = useMemo(() => seed, [seed]);
  const { rows } = useRealtimeActions(graine, dateMarche);

  // Tant que le direct n'a rien de mieux, on garde les chiffres du serveur.
  // Un compteur qui tomberait à zéro le temps d'une hydratation serait pire
  // qu'un compteur figé.
  const live = compter(rows);
  const vivant = live.total > 0;
  const h = vivant ? live.hausses : hausses;
  const s = vivant ? live.stables : inchangees;
  const b = vivant ? live.baisses : baisses;
  const total = vivant ? live.total : nbActions;

  const p = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const tuiles = [
    { cle: 'r2a', sens: 'hausse', ton: 'up', ico: '↑', valeur: h, mot: 'hausses', aria: 'en hausse' },
    { cle: 'r2b', sens: 'stable', ton: '', ico: '−', valeur: s, mot: 'stables', aria: 'stables' },
    { cle: 'r2c', sens: 'baisse', ton: 'down', ico: '↓', valeur: b, mot: 'baisses', aria: 'en baisse' },
  ] as const;

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
            {/* aria-live poli : une cotation qui change ne doit pas interrompre
                un lecteur d'écran en pleine lecture. */}
            <b className={`num ${t.ton}`} aria-live="polite">{t.valeur}</b>
            <span>
              {t.mot}
              <small className="num">{p(t.valeur)} %</small>
            </span>
          </div>
          <i className={`bar ${t.ton}`} style={{ width: `${p(t.valeur)}%` }} aria-hidden="true" />
        </Link>
      ))}
    </>
  );
}
