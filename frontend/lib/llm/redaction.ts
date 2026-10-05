/**
 * Partie PURE de la rédaction par LLM : rien ici n'appelle le réseau ni ne lit
 * de clé, pour pouvoir être testé seul. La cascade elle-même vit dans
 * `lib/server/redacteur.ts`.
 */

export interface MessageLlm {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Consigne de format des nombres. Ajoutée au message système de toute
 * rédaction en prose : mesuré le 2026-10-05, Gemini écrit « 7.3 % » quand on ne
 * le lui demande pas, et un point décimal dans un texte français se lit comme
 * un séparateur de milliers — « 1.250 » devient mille deux cent cinquante.
 */
export const CONSIGNE_FORMAT_FR =
  'Écris tous les nombres au format français : virgule décimale (12,5 %), ' +
  'espace entre les milliers (12 500 FCFA). Jamais de point décimal.';

/**
 * Charte de rédaction WESTBOURSE — ton d'analyste sobre (choix produit du
 * 2026-10-05). Ajoutée à TOUT texte rédigé par un modèle, pour que le
 * diagnostic, la synthèse de séance, le dossier valeur et l'analyse hebdo
 * parlent d'une seule voix. Copie dans scraper/src/llm/redacteur.ts.
 */
export const CHARTE_REDACTION = [
  "STYLE — ton d'analyste financier sobre, en vouvoiement :",
  '- Phrases courtes (25 mots au plus), une idée par phrase, voix active.',
  '- Vocabulaire financier exact ; tout terme technique est expliqué en quelques mots à sa première occurrence.',
  "- Chaque affirmation s'appuie sur un chiffre ou un fait fourni : écrivez ce qui est constaté, jamais ce qui est supposé.",
  "- Aucun adjectif d'emphase ni superlatif non chiffré (exceptionnel, impressionnant, remarquable, spectaculaire, excellent) ; aucun point d'exclamation, aucun emoji.",
  '- Aucune formule creuse (« il convient de noter », « force est de constater », « dans un contexte de », « en effet », « globalement »).',
  '- Une réserve se dit une fois, clairement, au bon endroit ; elle ne se répète pas à chaque phrase.',
].join('\n');

/** Ajoute un bloc au message système, ou en crée un s'il n'y en a pas. */
function ajouterAuSysteme(messages: MessageLlm[], bloc: string): MessageLlm[] {
  const i = messages.findIndex((m) => m.role === 'system');
  if (i === -1) return [{ role: 'system', content: bloc }, ...messages];
  return messages.map((m, j) => (j === i ? { ...m, content: `${m.content}\n\n${bloc}` } : m));
}

/** Ajoute la consigne de format des nombres au message système. */
export function avecFormatFr(messages: MessageLlm[]): MessageLlm[] {
  return ajouterAuSysteme(messages, CONSIGNE_FORMAT_FR);
}

/** Ajoute la charte de rédaction au message système. */
export function avecCharte(messages: MessageLlm[]): MessageLlm[] {
  return ajouterAuSysteme(messages, CHARTE_REDACTION);
}

/**
 * Lecteur de flux SSE au format OpenAI (`data: {...}` / `data: [DONE]`).
 *
 * Il TAMPONNE la ligne incomplète : un morceau réseau coupe souvent une ligne
 * `data:` en deux, et l'ancien lecteur du diagnostic, qui découpait chaque
 * morceau isolément, jetait en silence le JSON tronqué — donc des mots du
 * rapport.
 */
export class LecteurSse {
  private reste = '';
  fini = false;

  /** Renvoie les fragments de texte contenus dans ce morceau. */
  lire(morceau: string): string[] {
    if (this.fini) return [];
    const lignes = (this.reste + morceau).split('\n');
    this.reste = lignes.pop() ?? '';
    const sortie: string[] = [];
    for (const ligne of lignes) {
      const t = this.traiter(ligne);
      if (t === null) break;
      if (t) sortie.push(t);
    }
    return sortie;
  }

  /** À appeler en fin de flux : une dernière ligne sans saut final. */
  terminer(): string[] {
    if (this.fini || !this.reste) return [];
    const t = this.traiter(this.reste);
    this.reste = '';
    return t ? [t] : [];
  }

  /** null = fin de flux ; '' = rien à émettre. */
  private traiter(ligne: string): string | null {
    const l = ligne.trim();
    if (!l.startsWith('data:')) return '';
    const brut = l.slice(5).trim();
    if (brut === '[DONE]') {
      this.fini = true;
      return null;
    }
    try {
      const j = JSON.parse(brut) as { choices?: Array<{ delta?: { content?: string | null } }> };
      return j.choices?.[0]?.delta?.content ?? '';
    } catch {
      return '';
    }
  }
}
