/**
 * Cinquième lecture de « Ce que dit la séance » : les événements de marché de
 * la société, et ce que le cours a fait après.
 *
 * C'est le point du module où la causalité est la plus tentante : une
 * publication de résultats suivie d'une hausse ne prouve pas que la
 * publication a causé la hausse. `phraseEvenement` décrit donc une
 * SUCCESSION dans le temps, jamais une explication — d'où la formulation
 * imposée « dans les N séances qui ont suivi », qui ne peut se lire comme un
 * lien de cause. Les trois interdits énoncés en tête de `commentaire.ts`
 * (aucun chiffre inventé, aucun lien de cause, aucune recommandation)
 * s'appliquent ici sans exception.
 *
 * Les mesures (`surperformancePct`, `volumeRatio`) sont calculées ailleurs,
 * via `lib/eventStudy.ts` — ce module ne fait que sélectionner les
 * événements à commenter et mettre leur mesure en phrase.
 */

import { pc, dec, jour } from './commentaire';

export interface EvenementMarche {
  event_date: string;
  event_type: string | null;
  title: string;
}

export interface MesureEvenement {
  evenement: EvenementMarche;
  /** Rendement du titre moins celui de l'indice, en %. `null` si non mesurable. */
  surperformancePct: number | null;
  /** Volume moyen après / avant. `null` si non mesurable. */
  volumeRatio: number | null;
  /** `false` tant que la fenêtre de 5 séances n'est pas écoulée. */
  fenetreComplete: boolean;
}

/** Doit rester en phase avec la formulation imposée dans `phraseEvenement`. */
const FENETRE_SEANCES = 5;

/**
 * En deçà de cet écart, le titre n'a pas décroché de l'indice. Annoncer
 * « 0,00 % de mieux » ou « 0,01 % de moins bien » habille du bruit en
 * constat : le lecteur y lit une direction là où il n'y en a aucune.
 * Constaté sur PALC (0,00 %) et ETIT (0,01 %) au 2026-09-24.
 */
const ECART_NEGLIGEABLE_PCT = 0.1;

/**
 * Priorité d'affichage par type : résultats et dividendes d'abord, le bruit
 * administratif des assemblées en dernier — jamais supprimé, seulement relégué.
 */
const PRIORITE_TYPE: Record<string, number> = {
  resultats: 1,
  dividende: 1,
  autre: 2,
  assemblee: 3,
};
/** Type inconnu (valeur hors liste ci-dessus) ou `null` : même rang que « autre ». */
const PRIORITE_DEFAUT = 2;

function priorite(type: string | null): number {
  if (type == null) return PRIORITE_DEFAUT;
  return PRIORITE_TYPE[type] ?? PRIORITE_DEFAUT;
}

/**
 * Sélectionne les événements à commenter : jamais un événement daté dans le
 * futur, les plus pertinents d'abord (priorité de type), les plus récents à
 * priorité égale.
 */
export function selectionnerEvenements(
  evts: EvenementMarche[],
  aujourdhui: string,
  max = 3,
): EvenementMarche[] {
  const tries = evts
    .filter((e) => e.event_date <= aujourdhui)
    .sort((a, b) => {
      const ecartPriorite = priorite(a.event_type) - priorite(b.event_type);
      if (ecartPriorite !== 0) return ecartPriorite;
      return a.event_date < b.event_date ? 1 : a.event_date > b.event_date ? -1 : 0;
    });

  // Une seule entrée par séance. Deux documents déposés le même jour reçoivent
  // forcément la MÊME mesure — la fenêtre part de la même date — et les
  // afficher tous les deux donne à lire deux constats là où il n'y a qu'une
  // observation. Constaté sur ETIT (deux dépôts le 29 juillet 2026) et SNTS
  // (deux le 17 septembre 2026) : la mesure était répétée à l'identique.
  // Le tri ayant déjà classé par priorité, le premier vu est le plus pertinent.
  const vues = new Set<string>();
  const retenus: EvenementMarche[] = [];
  for (const e of tries) {
    if (vues.has(e.event_date)) continue;
    vues.add(e.event_date);
    retenus.push(e);
    if (retenus.length === max) break;
  }
  return retenus;
}

/**
 * Le fait, puis sa portée. Trois issues, une seule règle — jamais de chiffre
 * partiel :
 *  - fenêtre pas encore écoulée   → on le dit, sans aucun chiffre ;
 *  - fenêtre écoulée, mesure nulle → pas de portée : on liste l'événement
 *    sans lui inventer une mesure ;
 *  - fenêtre écoulée, mesure présente → la formulation imposée.
 */
export function phraseEvenement(m: MesureEvenement): { fait: string; portee?: string } {
  const { evenement, fenetreComplete, surperformancePct, volumeRatio } = m;
  const fait = `${jour(evenement.event_date)} — ${evenement.title}.`;

  if (!fenetreComplete) {
    return { fait, portee: `La fenêtre de ${FENETRE_SEANCES} séances n'est pas encore complète : aucune mesure n'est publiée.` };
  }
  if (surperformancePct == null) {
    return { fait };
  }

  const volume = volumeRatio != null ? `, sur un volume ${dec(volumeRatio, 1)} fois l'ordinaire` : '';

  // Un écart d'un centième de point n'est pas une direction : le dire comme
  // telle ferait lire un mouvement là où le titre a suivi son indice.
  if (Math.abs(surperformancePct) < ECART_NEGLIGEABLE_PCT) {
    return {
      fait,
      portee: `Dans les ${FENETRE_SEANCES} séances qui ont suivi, le titre ne s'est pas écarté du BRVM Composite${volume}.`,
    };
  }

  const sens = surperformancePct >= 0 ? 'de mieux' : 'de moins bien';
  return {
    fait,
    portee: `Dans les ${FENETRE_SEANCES} séances qui ont suivi, le titre a fait ${pc(Math.abs(surperformancePct))} ${sens} que le BRVM Composite${volume}.`,
  };
}
