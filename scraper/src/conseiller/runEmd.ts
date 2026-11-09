import { chargerHistorique } from './historique.js';
import { indiceEquipondere } from './indice.js';
import { DEBUT_HISTORIQUE, construirePaniers, ecartsAchatMarche } from './banc.js';
import { ecartType, effetMinimalDetectable } from './stats.js';

/**
 * EMD (spec §2.4) : écart-type des écarts par date sur la PREMIÈRE MOITIÉ du
 * calendrier. Ne renvoie que l'écart-type, les effectifs et l'EMD. La moyenne
 * n'est jamais calculée ici, pour ne pas lire le résultat avant le PREREG.
 */
export async function runEmd(): Promise<{ ecartTypePts: number; nMoitie: number; nTotalEstime: number; emdAnnualisePct: number }> {
  const { donnees: d } = await chargerHistorique();
  const ind = indiceEquipondere(d);
  const seances = d.calendrier.filter((x) => x >= DEBUT_HISTORIQUE);
  const milieu = seances[Math.floor(seances.length / 2)]!;
  const { paniers } = construirePaniers(d, ind, { debut: DEBUT_HISTORIQUE, fin: milieu });
  const ecarts = ecartsAchatMarche(paniers).map((e) => e.ecart);
  if (ecarts.length < 10) throw new Error(`EMD impossible : ${ecarts.length} dates avec Acheter sur la première moitié`);
  const sdPts = ecartType(ecarts) * 100;
  const nTotalEstime = ecarts.length * 2;
  return { ecartTypePts: sdPts, nMoitie: ecarts.length, nTotalEstime, emdAnnualisePct: effetMinimalDetectable(sdPts, nTotalEstime).annualise };
}
