import brvmSectors from './brvmSectors.json';

/**
 * Nombre de sociétés admises à la cote de la BRVM, DÉRIVÉ du référentiel
 * sectoriel curé plutôt que saisi à la main.
 *
 * « Les 47 sociétés » était écrit en dur à sept endroits. L'admission de BBGC
 * (Bridge Bank Group CI, 48e valeur) le 24/09/2026 les a tous rendus faux le
 * même matin — et l'un d'eux n'était pas qu'un libellé : le dashboard plafonnait
 * ses sparklines à 10 × 47 lignes et aurait tronqué la 48e valeur DANS LE
 * SILENCE, exactement le mode de panne que la pagination PostgREST nous a déjà
 * appris à redouter.
 *
 * Ajouter la prochaine valeur à `brvmSectors.json` suffit désormais à remettre
 * ces sept endroits d'accord avec le marché.
 *
 * ⚠️ ÉCART CONNU, ANTÉRIEUR À BBGC : `brvmSectors.json` ne contient pas SVOC, que
 * `FAMILLE_PAR_CODE` connaît (49 codes contre 48 ici). Ce compte peut donc
 * sous-estimer d'une unité. SVOC n'est pas ajouté ici parce que son secteur n'est
 * établi nulle part dans le dépôt, et qu'un secteur inventé serait affiché comme
 * un fait — le trou est déclaré plutôt que comblé au jugé. À trancher : SVOC
 * est-elle encore cotée, et dans quel secteur ?
 */
export const NB_SOCIETES_COTEES = Object.keys(brvmSectors).length;
