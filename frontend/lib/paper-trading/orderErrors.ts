const ORDER_ERROR_RESPONSES: Record<string, { status: number; message: string }> = {
  INVALID_ORDER: { status: 400, message: 'Les paramètres de l’ordre sont invalides.' },
  UNKNOWN_INSTRUMENT: { status: 400, message: 'Cette valeur BRVM n’est pas négociable.' },
  NO_ACCOUNT: {
    status: 400,
    message: 'Initialisez votre compte de simulation avant de passer un ordre.',
  },
  NO_MARKET_SESSION: {
    status: 503,
    message: 'Aucune séance de marché n’est disponible pour le moment.',
  },
  NO_QUOTE: { status: 409, message: 'Aucun cours de référence exploitable pour cette valeur.' },
  NO_BOC_DATA: {
    status: 409,
    message: 'Aucun Bulletin de la Cote antérieur disponible pour cette valeur.',
  },
  NO_BOC_QUANTITY: {
    status: 409,
    message: 'La quantité opposée du Bulletin de la Cote est indisponible.',
  },
  NO_OPPOSING_QUANTITY: {
    status: 409,
    message: 'Le Bulletin de la Cote ne publie aucune quantité opposée pour cette valeur.',
  },
  INSUFFICIENT_CASH: {
    status: 409,
    message: 'Liquidités disponibles insuffisantes pour réserver cet ordre.',
  },
  INSUFFICIENT_SHARES: {
    status: 409,
    message: 'Titres disponibles insuffisants pour réserver cet ordre de vente.',
  },
  NOT_FOUND: { status: 404, message: 'Ordre introuvable.' },
  TERMINAL_ORDER: {
    status: 409,
    message: 'Cet ordre est déjà terminé et ne peut plus être annulé.',
  },
  SESSION_NOT_AFTER_SUBMISSION: {
    status: 409,
    message: 'La séance proposée précède ou correspond à la saisie de l’ordre.',
  },
  SESSION_ALREADY_EVALUATED: {
    status: 409,
    message: 'Cette séance a déjà été évaluée pour cet ordre.',
  },
  STALE_EVALUATION: {
    status: 409,
    message: 'Les données du marché ont changé. Rechargez le portefeuille avant de réessayer.',
  },
  MISSING_MARKET_DATA: {
    status: 409,
    message: 'Les données de cette séance sont incomplètes.',
  },
  MISSING_BOC_QUANTITY: {
    status: 409,
    message: 'La quantité du Bulletin de la Cote nécessaire à cette simulation est absente.',
  },
  INVALID_BOC_SNAPSHOT: {
    status: 409,
    message: 'L’instantané du Bulletin de la Cote n’est pas admissible pour cette séance.',
  },
  MODE_MISMATCH: {
    status: 409,
    message: 'Le mode d’exécution de l’ordre ne correspond plus.',
  },
};

export function paperOrderErrorResponse(
  code: string,
): { status: number; message: string } | null {
  return ORDER_ERROR_RESPONSES[code] ?? null;
}
