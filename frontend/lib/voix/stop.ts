/**
 * Détection d'une demande d'arrêt dans la transcription d'un appel — PUR.
 *
 * Seules les paroles de la PERSONNE comptent : l'assistant prononce lui-même
 * « dites STOP » dans son annonce, et ses phrases ne doivent pas déclencher
 * une opposition. Faux positif préféré à faux négatif : une opposition à tort
 * ne nuit à personne, un robot qui rappelle quelqu'un qui a dit stop, si.
 */
export interface Replique {
  user: string;
  text: string;
}

const MOTIFS: RegExp[] = [
  /\bstop\b/,
  /\bne (?:m'|me |nous |m )?(?:appel|rappel)\w* plus\b/,
  /\bne plus (?:m'|me |nous )?(?:appel|rappel)\w*/,
  /\bplus d'?\s?appels?\b/,
  /\b(?:arretez|arrete|cessez) (?:de )?(?:m'|me )?(?:appel|rappel)\w*/,
  /\bpas (?:la peine|besoin) de (?:me )?rappeler\b/,
  /\bretirez[- ]moi\b/,
  /\bdesinscri\w*/,
];

function normaliser(t: string): string {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function phraseDemandeStop(texte: string): boolean {
  const t = normaliser(texte);
  return MOTIFS.some((m) => m.test(t));
}

/** Rôles que Bland donne à l'assistant (tout le reste est la personne). */
const ROLES_ASSISTANT = new Set(['assistant', 'agent', 'agent-action', 'robot']);

/**
 * Vrai si la personne a demandé à ne plus être appelée. Sans répliques
 * structurées, retombe sur la transcription concaténée (qui contient aussi les
 * phrases de l'assistant : on retire alors les lignes préfixées par son rôle).
 */
export function demandeStop(repliques: Replique[] | null | undefined, concatenee?: string | null): boolean {
  if (repliques && repliques.length > 0) {
    return repliques.some((r) => !ROLES_ASSISTANT.has(String(r.user).toLowerCase()) && phraseDemandeStop(r.text ?? ''));
  }
  if (!concatenee) return false;
  return concatenee
    .split(/\n+/)
    .filter((l) => !/^\s*(assistant|agent)\s*:/i.test(l))
    .some((l) => phraseDemandeStop(l.replace(/^\s*(user|utilisateur)\s*:/i, '')));
}
