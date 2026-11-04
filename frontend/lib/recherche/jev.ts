import type { FicheSociete } from './types';

/**
 * Appel de Jev (TypeSafe) en mode « rank » : une question oui/non par
 * société, plus une question globale. Contrat relevé dans le source MIT de
 * FrancoisChastel/jev-code (src/tools/rank.ts, src/core/client.ts).
 * Serveur uniquement : la clé est lue dans l'environnement à l'appel.
 */
export const CLE_GLOBALE = '__any_relevant';
const BASE_URL = 'https://api.typesafe.ai';

interface QuestionNoul {
  type: 'noul';
  instructions: string;
  criteria?: { true: string; false: string };
}

export interface RequeteJev {
  model: string;
  state: { query: string; candidates: Record<string, string> };
  questions: Record<string, QuestionNoul>;
}

export function construireRequeteJev(q: string, fiches: FicheSociete[], modele: string): RequeteJev {
  const questions: Record<string, QuestionNoul> = {};
  for (const f of fiches) {
    questions[f.code] = {
      type: 'noul',
      instructions: `La société décrite par \`candidates.${f.code}\` correspond-elle à ce que cherche \`query\` ? Juge cette société seule, uniquement d'après les faits écrits.`,
      criteria: {
        true: 'Les faits écrits de la société répondent à la recherche',
        false: 'La société ne répond pas à la recherche, ou ne partage que des mots en surface',
      },
    };
  }
  questions[CLE_GLOBALE] = {
    type: 'noul',
    instructions: 'Au moins une société de `candidates` correspond-elle à ce que cherche `query`, d’après les faits écrits ?',
  };
  return {
    model: modele,
    state: { query: q, candidates: Object.fromEntries(fiches.map((f) => [f.code, f.texte])) },
    questions,
  };
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** Renvoie le corps brut (à valider). Les erreurs ne portent qu'un code, jamais la requête. */
export async function classerParJev(
  q: string,
  fiches: FicheSociete[],
  signal: AbortSignal,
  fetchImpl: FetchLike = (url, init) => fetch(url, init),
): Promise<unknown> {
  const cle = process.env.TYPESAFE_API_KEY;
  if (!cle) throw new Error('jev_cle_absente');
  const requete = construireRequeteJev(q, fiches, process.env.TYPESAFE_DEFAULT_MODEL ?? 'jev-latest');
  const reponse = await fetchImpl(`${BASE_URL}/v1/systemone`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cle}`,
      'Content-Type': 'application/json',
      'User-Agent': 'westbourse-recherche-societes',
    },
    body: JSON.stringify(requete),
    signal,
  });
  if (!reponse.ok) throw new Error(`jev_http_${reponse.status}`);
  return reponse.json();
}
