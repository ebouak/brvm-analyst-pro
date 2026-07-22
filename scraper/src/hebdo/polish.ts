/**
 * Reformulation LLM des sections du squelette : rend le texte fluide SANS
 * ajouter le moindre fait. Toute sortie contenant un chiffre absent de la
 * whitelist est REJETÉE → on retombe sur le squelette brut (jamais d'invention).
 */
import { logger } from '../logger.js';

export interface SkeletonSection { titre: string; texte: string }

const ORDER: { provider: string; url: string; model: string }[] = [
  { provider: 'deepseek', url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat' },
  { provider: 'mistral', url: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-large-latest' },
];

/**
 * Même règle que frontend/lib/hebdo/narrative.ts. Dupliquée volontairement :
 * frontend et scraper sont deux paquets séparés (pas de module partagé).
 */
function assertNoForeignNumber(texte: string, chiffres: number[]): boolean {
  const trouves = (texte.match(/\d+(?:[.,]\d+)?/g) ?? []).map((s) => parseFloat(s.replace(',', '.')));
  return trouves.every((n) =>
    chiffres.some((c) => Math.abs(c - n) <= Math.max(0.5, Math.abs(c) * 0.01)),
  );
}

/**
 * @param resolveKey fonction fournie par l'appelant pour obtenir une clé
 *   (permet de tester sans réseau et de réutiliser le stockage api_keys).
 */
export async function polishNarrative(
  sections: SkeletonSection[],
  chiffres: number[],
  resolveKey: (provider: string) => Promise<string | null>,
): Promise<SkeletonSection[]> {
  const brut = sections.map((s) => `## ${s.titre}\n${s.texte}`).join('\n\n');
  const prompt =
    `Reformule ce commentaire boursier en français pour le rendre fluide et professionnel.\n` +
    `RÈGLES ABSOLUES : n'ajoute AUCUN chiffre, AUCUN fait, AUCUNE prévision. ` +
    `N'utilise que ces valeurs numériques : ${chiffres.join(', ')}. ` +
    `Conserve exactement les mêmes titres de section (lignes commençant par ##).\n\n${brut}`;

  for (const p of ORDER) {
    const key = await resolveKey(p.provider);
    if (!key) continue;
    try {
      const res = await fetch(p.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: p.model, messages: [{ role: 'user', content: prompt }], temperature: 0.3 }),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const out = json.choices?.[0]?.message?.content ?? '';
      if (!out) continue;

      if (!assertNoForeignNumber(out, chiffres)) {
        logger.warn({ provider: p.provider }, 'hebdo : reformulation rejetée (chiffre étranger) — squelette conservé');
        continue;
      }
      const blocs = out.split(/^##\s+/m).map((b) => b.trim()).filter(Boolean);
      if (blocs.length !== sections.length) continue;
      return blocs.map((b, i) => {
        const nl = b.indexOf('\n');
        return { titre: sections[i]!.titre, texte: (nl >= 0 ? b.slice(nl + 1) : b).trim() };
      });
    } catch (e) {
      logger.warn({ provider: p.provider, err: String(e) }, 'hebdo : provider LLM indisponible');
    }
  }
  return sections; // fallback honnête
}
