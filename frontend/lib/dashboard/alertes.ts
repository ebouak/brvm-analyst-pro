import { fmtNumber } from '@/lib/format';

export interface AlerteDeclenchee {
  code: string;
  type: string;
  seuil: number | null;
  declenchee_le: string | null;
}

export interface DetailAlerte {
  code: string;
  motif: string;
  /** Jour du déclenchement (AAAA-MM-JJ). La variation DU JOUR n'est pas montrée :
   *  l'alerte a pu se déclencher un autre jour, et la juxtaposer au motif
   *  (« Variation au-delà de 5 % ») ferait croire à un mouvement d'aujourd'hui. */
  le: string | null;
}

function motifDe(type: string, seuil: number | null): string {
  if (seuil == null || !Number.isFinite(seuil)) return 'Seuil franchi';
  switch (type) {
    case 'prix_au_dessus':
      return `Cours au-dessus de ${fmtNumber(seuil, 0)} FCFA`;
    case 'prix_en_dessous':
      return `Cours en dessous de ${fmtNumber(seuil, 0)} FCFA`;
    case 'variation':
      return `Variation au-delà de ${fmtNumber(Math.abs(seuil), 2)} %`;
    default:
      return 'Seuil franchi';
  }
}

/** Détail des alertes déclenchées : les plus récentes d'abord, au plus `max`. */
export function detaillerAlertes(alertes: AlerteDeclenchee[], max = 3): DetailAlerte[] {
  return [...alertes]
    .sort((a, b) => (b.declenchee_le ?? '').localeCompare(a.declenchee_le ?? ''))
    .slice(0, Math.max(0, max))
    .map((a) => {
      const jour = a.declenchee_le?.slice(0, 10) ?? null;
      return {
        code: a.code.trim().toUpperCase(),
        motif: motifDe(a.type, a.seuil),
        le: jour && /^\d{4}-\d{2}-\d{2}$/.test(jour) ? jour : null,
      };
    });
}
