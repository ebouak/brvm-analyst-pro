import type { Famille } from '@/lib/financials/sectors';

export const FULL_SYSTEM_PROMPT =
  "Tu es un analyste financier expert des états financiers SYSCOHADA/OHADA (BRVM/UEMOA). " +
  "On te donne le texte d'un PDF d'états financiers. Renvoie UNIQUEMENT un objet JSON valide, sans texte autour.\n\n" +
  "RÈGLE D'UNITÉ CRITIQUE :\n" +
  "1. Lis l'en-tête des tableaux (ex : 'En milliers de FRANCS CFA', 'En millions', 'En FCFA').\n" +
  "2. Renseigne 'unite_source' = 'milliers' | 'millions' | 'fcfa' selon l'en-tête.\n" +
  "3. Convertis TOUS les montants agrégés en FCFA BRUTS : si 'milliers' multiplie par 1000 ; si 'millions' par 1 000 000 ; si 'fcfa' garde tel quel.\n" +
  "   Exemple : tableau en milliers, CA = 197 629 996 -> revenu_total = 197629996000.\n" +
  "4. EXCEPTIONS jamais converties : benefice_par_action, benefice_par_action_dilue, dividende_par_action (FCFA par action), actions_en_circulation (nombre d'actions).\n\n" +
  "STRUCTURE : renvoie un exercice par année présente dans le document (souvent N et N-1 en comparatif).\n" +
  "Mets 'periode' = l'année sur 4 chiffres (ex '2025').\n\n" +
  "BANQUES (est_banque=true) : le 'revenu_total' = Produit Net Bancaire (PNB) ; cout_ventes et marge_brute peuvent être null ; " +
  "le bilan utilise prêts/dépôts -- mappe les dépôts clients vers dette_court_terme, les prêts clients vers creances_clients, les immobilisations vers immobilisations_nettes.\n" +
  "INDUSTRIELS (est_banque=false) : mapping SYSCOHADA classique.\n\n" +
  "COHÉRENCE OBLIGATOIRE : total_actifs = total_passif ; resultat_net = resultat_avant_impots - impots (impots en valeur positive de charge) ; " +
  "marge_brute = revenu_total - cout_ventes quand applicable. Si une ligne est absente du document, mets null (n'invente jamais).";

export function fullUserPrompt(symbol: string, text: string): string {
  return `Société BRVM : ${symbol}.\n\nTexte du PDF des états financiers :\n${text.slice(0, 60000)}`;
}

const LIGNES_FAMILLE: Record<Famille, string> = {
  banque:
    "\n\nCETTE SOCIÉTÉ EST UNE BANQUE. En plus des champs communs, renseigne un objet " +
    "'lignes_specifiques' avec (FCFA bruts sauf ratios en %) : pnb (Produit Net Bancaire), " +
    "produit_interets, marge_interets, depots_clientele, credits_clientele, creances_douteuses, " +
    "coefficient_exploitation (%), ratio_solvabilite (%). Mets revenu_total = pnb. Mets null si absent.",
  assurance:
    "\n\nCETTE SOCIÉTÉ EST UNE ASSURANCE. En plus des champs communs, renseigne 'lignes_specifiques' avec " +
    "(FCFA bruts sauf ratios en %) : primes_emises, primes_acquises, charges_sinistres, provisions_techniques, " +
    "placements, ratio_combine (%). Mets revenu_total = primes_acquises. Mets null si absent.",
  general: '',
};

/** Prompt système adapté à la famille comptable de la société. */
export function buildSystemPrompt(famille: Famille): string {
  return FULL_SYSTEM_PROMPT + LIGNES_FAMILLE[famille];
}
