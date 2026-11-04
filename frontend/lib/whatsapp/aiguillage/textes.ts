/** Textes FIXES : aucun chiffre, aucune donnée de marché, rien de généré. */

export function texteClarification(intention: 'cours' | 'dividendes', codes: string[]): string {
  const mot = intention === 'cours' ? 'COURS' : 'DIV';
  if (codes.length === 0) return `Pour quelle société ? Précisez son code, par exemple *${mot} SNTS*.`;
  return ['Pour quelle société ? Répondez par exemple :', ...codes.map((c) => `• *${mot} ${c}*`)].join('\n');
}

export const TEXTE_REFUS_CONSEIL = [
  'Nous ne donnons pas de conseil d’achat ou de vente : la décision dépend de votre situation. Pour vous faire votre propre avis :',
  '• *COURS SNTS* — le cours d’une valeur',
  '• *DIV SNTS* — ses dividendes',
  '• *PALMARES* — les mouvements de la séance',
  '👉 Fiches et analyses : https://www.westbourse.com/societes',
].join('\n');

export const TEXTE_SALUTATION = '👋 WESTBOURSE à votre service : cours, dividendes et palmarès de la BRVM. Tapez *AIDE* pour les exemples.';
