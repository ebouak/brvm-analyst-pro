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

/** Le bandeau ne montre que les alertes déclenchées récemment : une alerte de
 *  juillet restée « déclenchée » n'a plus rien d'une actualité. Elle reste
 *  visible dans « Mes alertes ». */
export const ALERTES_RECENTES_JOURS = 7;

/** Borne basse (ISO) des déclenchements montrés dans le bandeau. */
export function depuisAlertesRecentes(maintenant: Date, jours = ALERTES_RECENTES_JOURS): string {
  return new Date(maintenant.getTime() - jours * 86_400_000).toISOString();
}

// Types « intelligents » (migration 0039) : seuil facultatif, le motif s'en passe.
const SANS_SEUIL: Record<string, string> = {
  signal_achat: 'Signal d’achat du moteur',
  signal_vente: 'Signal de vente du moteur',
  rsi_survente: 'RSI en zone de survente',
  rsi_surachat: 'RSI en zone de surachat',
  dividende_proche: 'Dividende proche',
};

function motifDe(type: string, seuil: number | null): string {
  if (SANS_SEUIL[type]) return SANS_SEUIL[type];
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
