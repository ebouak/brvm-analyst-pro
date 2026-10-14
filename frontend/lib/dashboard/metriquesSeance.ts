/**
 * Métriques nommées de « Comprendre la séance » (spec §4.4), extraites des
 * lignes de la séance affichée. PUR et testé.
 *
 * - Une variation inconnue n'est PAS « stable » : seules les variations
 *   connues entrent dans la largeur du marché (spec §11).
 * - Le secteur meneur vient des INDICES SECTORIELS publiés par la BRVM, pas
 *   d'une moyenne recalculée par nous.
 * - Tout indice d'une autre séance est ignoré : on ne mélange pas deux séances.
 */
import type { ActionDaily, IndiceDaily } from '@/lib/types';
import type { MetriquesSeance } from './comprendre';

/** Indices sectoriels BRVM (libellé « BRVM - <secteur> »). */
export const INDICES_SECTORIELS: readonly string[] = [
  'BRVMTELE', 'BRVMCBASE', 'BRVMCDISC', 'BRVMENER', 'BRVMINDU', 'BRVMFINS', 'BRVMSPUB',
];

/** Fermeture officielle 15 h 00 GMT (Abidjan, UTC+0), plus 30 min d'officialisation des cours. */
export const CLOTURE_MINUTES_UTC = 15 * 60 + 30;

const fini = (x: number | null | undefined): x is number => typeof x === 'number' && Number.isFinite(x);

function nomSecteur(i: IndiceDaily): string {
  const nom = (i.libelle ?? '').replace(/^BRVM\s*-\s*/i, '').trim();
  return nom || i.code;
}

export function metriquesDepuisSeance(e: {
  dateMarche: string;
  actions: ActionDaily[];
  indices: IndiceDaily[];
  valeurTransactions: number | null;
  valeurTransactionsVeille: number | null;
}): MetriquesSeance {
  const variations = e.actions.map((x) => x.variation_pct).filter(fini);
  const connue = variations.length > 0;
  const memeSeance = e.indices.filter((x) => x.date_marche === e.dateMarche);

  const brvmc = memeSeance.find((x) => x.code === 'BRVMC');
  const composite = brvmc && fini(brvmc.valeur) && fini(brvmc.variation_pct)
    ? { valeur: brvmc.valeur, variationPct: brvmc.variation_pct }
    : null;

  const meneur = memeSeance
    .filter((x) => INDICES_SECTORIELS.includes(x.code) && fini(x.variation_pct))
    .sort((x, y) => (y.variation_pct as number) - (x.variation_pct as number))[0];
  const secteurMeneur = meneur ? { nom: nomSecteur(meneur), variationPct: meneur.variation_pct as number } : null;

  const vedette = e.actions
    .filter((x) => fini(x.valeur_echangee) && (x.valeur_echangee as number) > 0)
    .sort((x, y) => (y.valeur_echangee as number) - (x.valeur_echangee as number))[0];
  const plusEchangee = vedette
    ? { code: vedette.code, nom: vedette.designation?.trim() || vedette.code, valeur: vedette.valeur_echangee as number }
    : null;

  return {
    dateMarche: e.dateMarche,
    hausses: connue ? variations.filter((v) => v > 0).length : null,
    baisses: connue ? variations.filter((v) => v < 0).length : null,
    stables: connue ? variations.filter((v) => v === 0).length : null,
    composite,
    secteurMeneur,
    valeurEchangee: e.valeurTransactions,
    valeurEchangeeVeille: e.valeurTransactionsVeille,
    plusEchangee,
  };
}

/** La séance `dateMarche` est-elle close à l'instant `maintenant` ? */
export function estSeanceClose(dateMarche: string, maintenant: Date): boolean {
  const jour = maintenant.toISOString().slice(0, 10);
  if (dateMarche < jour) return true;
  if (dateMarche > jour) return false;
  return maintenant.getUTCHours() * 60 + maintenant.getUTCMinutes() >= CLOTURE_MINUTES_UTC;
}
