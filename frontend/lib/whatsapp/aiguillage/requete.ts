import { INTENTIONS } from './intentions';

/** Identité d'une société : ce que Jev voit pour reconnaître de qui parle le message. */
export interface SocieteIdentite {
  code: string;
  nom: string;
  secteur: string | null;
  pays: string | null;
}

export const QUESTION_INTENTION = 'intention';

export function construireRequeteAiguillage(message: string, societes: SocieteIdentite[]) {
  const fiches: Record<string, string> = {};
  const questions: Record<string, unknown> = {
    [QUESTION_INTENTION]: {
      type: 'choice',
      instructions: 'Que demande l’auteur de `message`, adressé au service d’information boursière WESTBOURSE (BRVM) ?',
      criteria: { ...INTENTIONS },
    },
  };
  for (const s of societes) {
    fiches[s.code] = [`${s.code} — ${s.nom}.`, s.secteur ? `Secteur : ${s.secteur}.` : '', s.pays ? `Pays : ${s.pays}.` : ''].filter(Boolean).join(' ');
    questions[s.code] = {
      type: 'noul',
      instructions: `\`message\` parle-t-il de la société \`societes.${s.code}\` (par son nom, son code ou une description sans ambiguïté) ?`,
      criteria: { true: 'Le message désigne cette société', false: 'Le message ne désigne pas cette société' },
    };
  }
  return { state: { message, societes: fiches }, questions };
}
