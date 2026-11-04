/**
 * Parties PURES des outils de l'assistant WhatsApp (lib/agent/outilsChatbot.ts).
 */

export interface LeconIndex {
  cours: string;
  slug: string;
  titre: string;
}

const MOTS_VIDES = new Set([
  'les', 'des', 'une', 'que', 'qui', 'quoi', 'est', 'comment', 'pour', 'sur', 'dans', 'avec', 'par', 'mon', 'mes',
  'son', 'ses', 'aux', 'faire', 'fait', 'cest', 'quest', 'brvm', 'bourse', 'action', 'actions', 'expliquer',
  'explique', 'expliquez', 'moi', 'svp', 'veut', 'dire', 'signifie', 'lecon', 'niveau',
]);

const normaliser = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Racine grossière : « dividendes » et « dividende » se rejoignent. */
const racine = (t: string) => (t.length > 4 && t.endsWith('s') ? t.slice(0, -1) : t);

function termes(s: string): string[] {
  return [...new Set(normaliser(s).split(' '))]
    .filter((t) => (t.length >= 3 || t === 'pe') && !MOTS_VIDES.has(t))
    .map(racine);
}

/** Leçons dont le titre partage le plus de termes avec le sujet (3 au plus, score > 0). */
export function classerNotions(sujet: string, lecons: LeconIndex[]): LeconIndex[] {
  const q = termes(sujet);
  if (q.length === 0) return [];
  return lecons
    .map((l) => {
      const t = new Set(termes(l.titre));
      const score = q.filter((m) => t.has(m)).length;
      return { l, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.l.titre.localeCompare(b.l.titre))
    .slice(0, 3)
    .map((x) => x.l);
}

/** Sur WhatsApp, ni signal ni confiance : ce serait une recommandation (spec §3). */
export function sansSignal(r: unknown): unknown {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return r;
  const { signal: _s, confiance: _c, ...reste } = r as Record<string, unknown>;
  return reste;
}

/** « SNTS, ORAC ; SGBC » ou « Sonatel et Orange CI » → 2 à 3 saisies distinctes, sinon null. */
export function lireListeValeurs(saisie: string): string[] | null {
  const liste = [...new Set(saisie.split(/[,;/]+|\s+et\s+/i).map((s) => s.trim()).filter(Boolean))].slice(0, 3);
  return liste.length >= 2 ? liste : null;
}
