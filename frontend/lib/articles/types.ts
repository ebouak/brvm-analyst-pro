/** Articles de presse générés depuis la donnée BRVM (spec 2026-10-28-articles-presse). */
export interface Article {
  id: string;
  slug: string;
  type: string;
  code: string | null;
  titre: string;
  chapo: string;
  corps_md: string;
  chiffres: {
    image?: { chiffre: string; legende: string };
    serie?: [string, number][];
    [k: string]: unknown;
  };
  sources: { label: string; url: string }[];
  date_fait: string;
  publie_le: string | null;
}

export const LIBELLE_TYPE: Record<string, string> = {
  dividende_annonce: 'Dividende',
  detachement_rappel: 'Détachement',
  paiement_rappel: 'Paiement',
  operation_titres: 'Opération sur titres',
  seance_hors_norme: 'Séance',
};

export const COLONNES_ARTICLE = 'id,slug,type,code,titre,chapo,corps_md,chiffres,sources,date_fait,publie_le';
