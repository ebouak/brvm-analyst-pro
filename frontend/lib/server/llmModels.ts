/**
 * Noms de modèles des fournisseurs de repli — référence unique.
 *
 * POURQUOI CE FICHIER EXISTE. Le 2026-09-26, un rapport de production affichait
 * « tous les fournisseurs ont échoué ». Mesuré fournisseur par fournisseur :
 * DeepSeek était à court de crédit, et les DEUX replis étaient appelés avec des
 * noms de modèles qui n'existent plus. Le produit tournait donc depuis un
 * moment sur DeepSeek seul, sans filet, sans que rien ne le signale — les
 * replis échouaient en silence puisqu'un échec de repli ne se voit que le jour
 * où le premier tombe aussi.
 *
 * Constaté en interrogeant les API, pas en supposant :
 *   mistral-large-latest   403  « not available in your subscription tier »
 *   pixtral-large-latest   400  « Invalid model »
 *   grok-2-latest          404
 *   grok-2-vision-latest   404
 *
 * ⚠️ CES NOMS SE PÉRIMENT. Les fournisseurs retirent des modèles sans préavis,
 * et un nom retiré ne casse RIEN de visible tant que le fournisseur prioritaire
 * répond. C'est la panne la plus discrète de cette architecture. Les vérifier
 * par un appel réel — `GET /v1/models` chez Mistral et xAI les liste — et non
 * par la documentation.
 *
 * ⚠️ MISTRAL EST SUR UN PALIER GRATUIT : même espacés de deux secondes, les
 * appels reviennent en 429. Le modèle est bon, le débit ne l'est pas. Compter
 * sur lui comme premier repli est une illusion ; xAI répond, lui.
 */

/** Un seul modèle par fournisseur : chez Mistral comme chez xAI, les modèles
 *  retenus traitent le texte ET l'image, il n'y a plus de variante « vision ». */
export const MODELE_LLM = {
  /** Prioritaire. Le seul à ne jamais avoir changé de nom. */
  deepseek: 'deepseek-chat',
  /** `mistral-small-latest` porte la capacité vision d'après /v1/models. */
  mistral: 'mistral-small-latest',
  /** grok-4.x est nativement multimodal. */
  xai: 'grok-4.6',
} as const;

export const URL_LLM = {
  deepseek: 'https://api.deepseek.com/chat/completions',
  mistral: 'https://api.mistral.ai/v1/chat/completions',
  xai: 'https://api.x.ai/v1/chat/completions',
} as const;
