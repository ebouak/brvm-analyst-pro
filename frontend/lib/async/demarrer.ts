/**
 * Lance une requête TOUT DE SUITE, pour l'attendre plus loin.
 *
 * Une page serveur qui écrit `await a(); … await b();` attend `a` avant même
 * d'envoyer `b`, alors que `b` n'en dépend pas : les temps s'additionnent.
 * `const pb = demarrer(b());` envoie `b` dès qu'on a ses entrées ; le
 * `await pb` reste à l'endroit où le résultat sert, donc la logique de la page
 * ne bouge pas, seules les attentes se chevauchent.
 *
 * Deux détails, et pourquoi :
 * - un constructeur de requête Supabase est PARESSEUX (il ne part qu'au premier
 *   `.then`) : `Promise.resolve` le déclenche, sans quoi rien ne partirait avant
 *   l'`await` ;
 * - un rejet survenu AVANT l'`await` serait signalé « non géré » par Node. Le
 *   `.catch` muet ne sert qu'à marquer la promesse comme suivie : l'`await`
 *   plus loin reçoit toujours l'erreur, intacte. Rien n'est avalé.
 */
export function demarrer<T>(travail: PromiseLike<T>): Promise<T> {
  const promesse = Promise.resolve(travail);
  promesse.catch(() => {});
  return promesse;
}
