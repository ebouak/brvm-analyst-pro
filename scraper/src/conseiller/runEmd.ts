import { chargerHistorique } from './historique.js';
import { indiceEquipondere } from './indice.js';
import { construirePaniers, ecartsParDate } from './banc.js';
import { ecartType, effetMinimalDetectable } from './stats.js';

/**
 * EMD (spec §2.4) : écart-type des écarts par date sur la PREMIÈRE MOITIÉ du
 * calendrier. Ne renvoie que l'écart-type, les effectifs et l'EMD. La moyenne
 * n'est jamais calculée ici, pour ne pas lire le résultat avant le PREREG.
 */
export async function runEmd(): Promise<{ ecartTypePts: number; nMoitie: number; nTotalEstime: number; emdAnnualisePct: number }> {
  const { donnees: d } = await chargerHistorique();
  const ind = indiceEquipondere(d);
  const milieu = d.calendrier[Math.floor(d.calendrier.length / 2)]!;
  const { paniers } = construirePaniers(d, ind, { debut: d.calendrier[0]!, fin: milieu });
  const ecarts = ecartsParDate(paniers).map((e) => e.ecart);
  if (ecarts.length < 10) throw new Error(`EMD impossible : ${ecarts.length} dates avec Acheter ET Vendre sur la première moitié`);
  const sdPts = ecartType(ecarts) * 100;
  const nTotalEstime = ecarts.length * 2;
  return { ecartTypePts: sdPts, nMoitie: ecarts.length, nTotalEstime, emdAnnualisePct: effetMinimalDetectable(sdPts, nTotalEstime).annualise };
}
