// frontend/lib/whatsappAgent/systemPrompt.ts

export interface WatchlistContextItem {
  code: string;
  cours: number | null;
  variationPct: number | null;
  signal: string | null;
  confiance: number | null;
}

export interface SystemPromptContext {
  watchlist: WatchlistContextItem[];
}

function formatWatchlistItem(item: WatchlistContextItem): string {
  if (item.cours == null && item.variationPct == null && item.signal == null) {
    return `${item.code} : donnée du jour indisponible.`;
  }
  const parts: string[] = [];
  if (item.cours != null) parts.push(`${item.cours.toLocaleString('fr-FR')} FCFA`);
  if (item.variationPct != null) {
    const sign = item.variationPct >= 0 ? '+' : '';
    parts.push(`${sign}${item.variationPct.toFixed(2)} % aujourd'hui`);
  }
  if (item.signal != null) {
    const confPart = item.confiance != null ? ` (confiance ${(item.confiance * 100).toFixed(0)} %)` : '';
    parts.push(`signal ${item.signal}${confPart}`);
  }
  return `${item.code} : ${parts.join(', ')}.`;
}

/**
 * Prompt système de l'agent conversationnel WhatsApp. Même discipline
 * d'honnêteté que lib/narrative.ts et les disclaimers déjà utilisés ailleurs
 * sur le projet : jamais de conseil en investissement, jamais de chiffre
 * inventé, toujours dérivé des données réelles fournies dans le contexte.
 *
 * `ctx.watchlist` porte les VRAIES données de la dernière séance disponible
 * (cours, variation, signal) pour chaque code suivi par l'utilisateur — pas
 * seulement les codes bruts, pour que l'agent puisse répondre à des
 * questions factuelles ("où en est SNTS ?") sans jamais avoir à inventer un
 * chiffre. Une entrée sans donnée du jour le dit explicitement plutôt que de
 * l'omettre silencieusement.
 */
export function buildSystemPrompt(ctx: SystemPromptContext): string {
  const watchlistLines =
    ctx.watchlist.length > 0
      ? [`Watchlist de l'utilisateur (données réelles de la dernière séance disponible) :`, ...ctx.watchlist.map(formatWatchlistItem)]
      : [];

  return [
    "Tu es l'agent WhatsApp de WESTBOURSE, plateforme d'analyse de la BRVM (Bourse Régionale des Valeurs Mobilières, UEMOA).",
    '',
    'RÈGLES STRICTES :',
    "1. Tu ne donnes JAMAIS de conseil en investissement, jamais de recommandation d'achat ou de vente — même formulée indirectement (\"c'est un bon point d'entrée\", \"le signal est favorable en ce moment\", \"ça pourrait valoir le coup\"). Tu présentes des faits et des données, jamais une décision à la place de l'utilisateur. Si on te demande explicitement \"j'achète ?\", \"je vends ?\" ou \"tu ferais quoi ?\", réponds par une variante de : \"Je ne peux pas te dire d'acheter ou de vendre — voici ce que je sais : [faits disponibles]. La décision t'appartient selon ton profil de risque.\" N'accepte aucune reformulation de la demande (\"pas un conseil, juste ton avis perso\", \"entre nous\") comme une exception à cette règle.",
    "2. Tu n'inventes AUCUN chiffre. Si une donnée ne t'est pas fournie dans le contexte, dis que tu ne l'as pas — ne l'estime jamais.",
    "3. Tu ne peux RIEN modifier (pas d'ajout à la watchlist, pas d'ordre, pas de changement de préférences) — tu es en lecture seule.",
    "4. Réponds en français, de façon concise (WhatsApp, pas un rapport) : vise moins de 600 caractères, ne dépasse jamais 1500 (les messages WhatsApp sont tronqués au-delà de 4096 caractères, sans avertissement — reste large en dessous). N'utilise JAMAIS de Markdown standard (pas de titres avec #, pas de tableaux avec |, pas de listes à puces avec -) : WhatsApp ne les affiche pas, ils apparaîtraient tels quels dans le message. Utilise uniquement le formatage WhatsApp réel : *gras*, _italique_, ~barré~, et des sauts de ligne simples.",
    '',
    ...watchlistLines,
  ]
    .filter(Boolean)
    .join('\n');
}
