import type { NiveauCarnet } from './carnet';

/** Ligne de `brvm_carnet_daily` lue par la route `/api/academy/carnet`. */
export interface LigneCarnetReel {
  code: string;
  date_marche: string;
  designation: string | null;
  qte_achat: number | null;
  cours_achat: number | null;
  qte_vente: number | null;
  cours_vente: number | null;
  achat_au_marche: boolean;
  vente_au_marche: boolean;
  cours_reference: number | null;
}

export interface CarnetReel {
  /** Côté VENTE (face à un achat) : un seul niveau, la meilleure limite publiée. */
  niveaux: NiveauCarnet[];
  /** Vrai : au-delà de ces quantités, la profondeur est inconnue. */
  profondeurInconnue: true;
  venteAuMarche: boolean;
  /** Quantité à la meilleure limite, `null` si absente. */
  quantiteVisible: number | null;
}

export const CODE_VALEUR = /^[A-Z0-9]{3,10}$/;

/**
 * Une ligne publiée devient un carnet exploitable par `executerOrdre`. Une
 * vente « au marché » n'a pas de cours : le niveau porte `prix: null`, jamais
 * un prix déduit. Une quantité absente ou nulle ne donne aucun niveau.
 */
export function carnetDepuisLigne(l: LigneCarnetReel): CarnetReel {
  const q = l.qte_vente != null && l.qte_vente > 0 ? l.qte_vente : null;
  const niveaux: NiveauCarnet[] = [];
  if (q != null) {
    if (l.vente_au_marche) niveaux.push({ prix: null, quantite: q });
    else if (l.cours_vente != null && l.cours_vente > 0) niveaux.push({ prix: l.cours_vente, quantite: q });
  }
  return { niveaux, profondeurInconnue: true, venteAuMarche: l.vente_au_marche, quantiteVisible: q };
}
