import { fmtNumber } from '@/lib/format';

export interface AlerteDeclenchee {
  code: string;
  type: string;
  seuil: number | null;
  declenchee_le: string | null;
}

export interface DetailAlerte {
  code: string;
  variationPct: number | null;
  motif: string;
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

/** Détail des alertes déclenchées : les plus récentes d'abord, au plus `max`. Aucune valeur absente n'est affichée comme 0. */
export function detaillerAlertes(
  alertes: AlerteDeclenchee[],
  variations: ReadonlyMap<string, number | null>,
  max = 3,
): DetailAlerte[] {
  return [...alertes]
    .sort((a, b) => (b.declenchee_le ?? '').localeCompare(a.declenchee_le ?? ''))
    .slice(0, Math.max(0, max))
    .map((a) => {
      const code = a.code.trim().toUpperCase();
      const v = variations.get(code);
      return {
        code,
        variationPct: v != null && Number.isFinite(v) ? v : null,
        motif: motifDe(a.type, a.seuil),
      };
    });
}
