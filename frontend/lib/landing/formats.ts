import { fmtNumber } from '@/lib/format';

/**
 * Formateurs partagés par la section « La BRVM aujourd'hui ».
 *
 * ⚠️ CE MODULE NE PORTE PAS `'use client'`, ET C'EST TOUT SON INTÉRÊT.
 * Ces trois fonctions sont appelées des DEUX côtés : par la page serveur
 * (`BrvmAujourdhui`) et par le composant temps réel (`EtatSeanceLive`).
 *
 * Elles avaient d'abord été exportées depuis le composant client. La page
 * serveur les important de là, Next a remplacé le module par des références
 * client au moment du bundling, et l'appel côté serveur a jeté une exception :
 * la landing est passée en HTTP 500 en production. `tsc` ne peut pas voir ce
 * défaut — les types sont corrects, c'est la frontière serveur/client qui ne
 * l'est pas.
 *
 * Règle à retenir : du code appelé des deux côtés vit dans un module NEUTRE,
 * jamais dans le fichier marqué `'use client'`.
 */

/** Pourcentage signé à la française : « +1,72 % », « −0,47 % », « — » si nul. */
export const pct = (v: number | null, d = 2) =>
  v == null
    ? '—'
    : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })} %`;

/** Classe de ton : 'up', 'down', ou rien. */
export const tone = (v: number | null) => (v == null ? '' : v > 0 ? 'up' : v < 0 ? 'down' : '');

/** Montant abrégé : milliards en « Md », millions en « M », sinon tel quel. */
export const fmtMd = (v: number) =>
  v >= 1e9
    ? `${(v / 1e9).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} Md`
    : v >= 1e6
      ? `${(v / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M`
      : fmtNumber(v);
