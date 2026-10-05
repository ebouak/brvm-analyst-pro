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

/** Ajoute la consigne au message système, ou en crée un s'il n'y en a pas. */
export function avecFormatFr(messages: MessageLlm[]): MessageLlm[] {
  const i = messages.findIndex((m) => m.role === 'system');
  if (i === -1) return [{ role: 'system', content: CONSIGNE_FORMAT_FR }, ...messages];
  return messages.map((m, j) =>
    j === i ? { ...m, content: `${m.content}\n\n${CONSIGNE_FORMAT_FR}` } : m,
  );
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
