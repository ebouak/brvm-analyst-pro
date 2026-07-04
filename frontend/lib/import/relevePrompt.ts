/**
 * Prompts d'extraction d'un relevé de compte-titres SGI (BRVM).
 * Le LLM ne voit que le document déposé par l'utilisateur ; il doit extraire
 * les positions sans jamais inventer de valeur absente.
 */

export const RELEVE_SYSTEM_PROMPT = `Tu extrais les positions d'un relevé de compte-titres (portefeuille d'actions BRVM) émis par une SGI de l'UEMOA.

Réponds UNIQUEMENT en JSON strict, schéma :
{
  "positions": [
    {
      "code": "ticker BRVM en majuscules (ex. SNTS, PALC, SGBC) si identifiable, sinon null",
      "libelle": "libellé de la valeur tel qu'écrit sur le relevé",
      "quantite": nombre entier de titres, sinon null,
      "prix_unitaire": prix de revient unitaire (PRU) en FCFA si présent, sinon cours de valorisation unitaire, sinon null
    }
  ],
  "liquidites": espèces disponibles en FCFA si mentionnées, sinon null,
  "date_releve": "YYYY-MM-DD" si présente, sinon null,
  "sgi": "nom de la SGI émettrice" si présent, sinon null
}

Règles impératives :
- N'INVENTE JAMAIS une valeur : champ absent ou illisible → null.
- Ignore les lignes de totaux, sous-totaux, frais et obligations (n'extrais que les ACTIONS cotées).
- "quantite" = nombre de titres détenus (pas la valeur en FCFA).
- Préfère le PRU (prix/coût de revient, prix d'achat moyen) au cours du jour pour "prix_unitaire" quand les deux figurent.
- Les montants FCFA utilisent souvent l'espace comme séparateur de milliers et la virgule décimale — convertis en nombre.
- Tickers BRVM usuels : 4 lettres + éventuel suffixe pays (ex. SNTS, SGBC, PALC, BICC, ETIT, BOAB, ORAC, TTLC, SLBC...). Si le libellé ne permet pas d'identifier le ticker avec certitude, mets null (l'utilisateur choisira).`;

export function releveUserPrompt(text?: string): string {
  const base = 'Extrais les positions de ce relevé de compte-titres selon le schéma JSON.';
  return text ? `${base}\n\n--- DOCUMENT ---\n${text}` : base;
}
