/**
 * Appel générique de Jev (TypeSafe) : `POST /v1/systemone`. Serveur uniquement :
 * la clé est lue dans l'environnement à l'appel et ne part qu'en en-tête Bearer.
 * Les erreurs ne portent qu'un code, jamais le contenu de la requête.
 */
const BASE_URL = 'https://api.typesafe.ai';

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface CorpsJev {
  state: unknown;
  questions: Record<string, unknown>;
}

export async function appelerJev(corps: CorpsJev, signal: AbortSignal, fetchImpl: FetchLike = (url, init) => fetch(url, init)): Promise<unknown> {
  const cle = process.env.TYPESAFE_API_KEY;
  if (!cle) throw new Error('jev_cle_absente');
  const reponse = await fetchImpl(`${BASE_URL}/v1/systemone`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json', 'User-Agent': 'westbourse' },
    body: JSON.stringify({ model: process.env.TYPESAFE_DEFAULT_MODEL ?? 'jev-latest', ...corps }),
    signal,
  });
  if (!reponse.ok) throw new Error(`jev_http_${reponse.status}`);
  return reponse.json();
}
