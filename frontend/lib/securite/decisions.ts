/**
 * Décisions d'administration — PUR.
 *
 * Une suspension du Premium vaut tant que la DERNIÈRE décision de type
 * suspension/levée est une suspension non échue. Une levée l'annule ; une
 * suspension sans date court jusqu'à une levée.
 */
export interface Decision {
  user_id: string;
  type: 'legitime' | 'deconnexion' | 'avertissement' | 'suspension' | 'levee';
  jusqu_au: string | null;
  created_at: string;
}

/** Suspension du Premium en cours, d'après la dernière décision suspension/levée. */
export function suspensionActive(decisions: Pick<Decision, 'type' | 'jusqu_au' | 'created_at'>[], maintenant: Date): Decision['jusqu_au'] | 'indefinie' | null {
  const d = decisions
    .filter((x) => x.type === 'suspension' || x.type === 'levee')
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
  if (!d || d.type !== 'suspension') return null;
  if (!d.jusqu_au) return 'indefinie';
  return Date.parse(d.jusqu_au) > maintenant.getTime() ? d.jusqu_au : null;
}
