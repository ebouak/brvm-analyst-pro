/**
 * Refroidissement des alertes vocales — PUR.
 *
 * Un type d'alerte n'appelle l'exploitant qu'une fois par fenêtre de 6 h
 * (00-06, 06-12, 12-18, 18-24 UTC). La clé sert d'`appels_vocaux.source_id`,
 * sous contrainte unique (motif, source_id) : l'insertion faite AVANT l'appel
 * est le verrou, en base — un refroidissement en mémoire ne survivrait pas à
 * deux instances Vercel.
 */
export const FENETRE_HEURES = 6;

/**
 * Types d'alerte critique admis. Liste FERMÉE : la route refuse tout autre
 * type, un secret volé ne permet pas de faire lire n'importe quoi.
 */
export const TYPES_ALERTE = ['seance_absente', 'llm_panne_totale', 'chariow_erreur', 'whatsapp_session'] as const;
export type TypeAlerte = (typeof TYPES_ALERTE)[number];

export function estTypeAlerte(t: unknown): t is TypeAlerte {
  return typeof t === 'string' && (TYPES_ALERTE as readonly string[]).includes(t);
}

/** Clé `<type>:<AAAA-MM-JJ>T<HH>` où HH est le début de la fenêtre (00, 06, 12, 18). */
export function cleFenetre(type: TypeAlerte, maintenant: Date): string {
  const jour = maintenant.toISOString().slice(0, 10);
  const debut = Math.floor(maintenant.getUTCHours() / FENETRE_HEURES) * FENETRE_HEURES;
  return `${type}:${jour}T${String(debut).padStart(2, '0')}`;
}
