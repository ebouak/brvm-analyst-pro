import 'server-only';
import { createHash } from 'node:crypto';
import { unstable_cache } from 'next/cache';
import { rediger } from '@/lib/server/redacteur';
import type { Commentaire } from './commentaire';
import { matiere, messagesSynthese, syntheseAcceptable } from './syntheseRedigee';

/**
 * Synthèse rédigée, mise en cache sur l'EMPREINTE des constats : tant que la
 * séance ne change pas, aucun nouvel appel — quel que soit le nombre de
 * lecteurs, de valeurs affichées ou de robots d'indexation. Une variation
 * intraday change les constats, donc l'empreinte, donc le texte.
 *
 * Un échec est mis en cache AUSSI (valeur null) : pendant une panne des
 * fournisseurs, chaque affichage retomberait sinon sur un nouvel appel voué à
 * échouer, et la page attendrait le délai d'expiration à chaque fois.
 */
export async function syntheseRedigee(c: Commentaire): Promise<string | null> {
  if (c.constats.length === 0) return null;
  const empreinte = createHash('sha256').update(matiere(c)).digest('hex').slice(0, 32);
  const lire = unstable_cache(
    async (): Promise<string | null> => {
      const r = await rediger(messagesSynthese(c), {
        maxTokens: 400,
        temperature: 0.3,
        timeoutMs: 12_000,
        // Pas de Grok : 65 s mesurées, inacceptable dans une page lue.
        fournisseurs: ['deepseek', 'gemini'],
        accepter: (t) => syntheseAcceptable(t, c),
      });
      return r?.texte ?? null;
    },
    ['synthese-seance-v1', empreinte],
    { revalidate: 86_400 },
  );
  try {
    return await lire();
  } catch {
    return null;
  }
}
