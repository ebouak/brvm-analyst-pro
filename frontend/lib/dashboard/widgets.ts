/** Registre des widgets du dashboard + résolution du layout utilisateur (pur). */

export type WidgetKey = 'secteurs' | 'indices' | 'etat' | 'seance' | 'signaux' | 'actus' | 'portefeuille';

export interface WidgetMeta { key: WidgetKey; label: string; desc: string }

/**
 * Ordre par défaut — priorise la réponse à « le marché est-il favorable
 * aujourd'hui ? » (sentiment) avant les mouvements du jour, puis les signaux
 * actionnables. Ne change l'ordre QUE pour les utilisateurs sans layout
 * personnalisé sauvegardé (voir resolveLayout ci-dessous).
 */
export const WIDGETS: WidgetMeta[] = [
  { key: 'etat', label: 'État du marché', desc: 'Breadth, volume, sentiment' },
  { key: 'seance', label: 'Séance du jour', desc: 'Top hausses/baisses, graphiques, brief' },
  { key: 'signaux', label: "Signaux d'opportunité", desc: 'Signaux actionnables récents' },
  { key: 'secteurs', label: 'Vos secteurs', desc: 'Perf du jour de vos secteurs favoris' },
  { key: 'portefeuille', label: 'Mon portefeuille', desc: 'Composition + P&L latent' },
  { key: 'indices', label: 'Indices BRVM', desc: 'Composite, BRVM-30, sectoriels' },
  { key: 'actus', label: 'Actualités', desc: 'Fil d’actualités BRVM' },
];

export const DEFAULT_ORDER: WidgetKey[] = WIDGETS.map((w) => w.key);
const VALID = new Set<string>(DEFAULT_ORDER);

export interface DashboardLayout { order?: string[]; hidden?: string[] }

/**
 * Résout l'ordre + la visibilité des widgets à partir du layout sauvegardé.
 * Tolérant : ignore les clés inconnues, ajoute en fin les widgets nouveaux
 * (apparus après la sauvegarde) tant qu'ils ne sont pas masqués.
 * Retourne la liste ORDONNÉE des widgets VISIBLES.
 */
export function resolveLayout(saved: DashboardLayout | null | undefined): WidgetKey[] {
  const hidden = new Set((saved?.hidden ?? []).filter((k) => VALID.has(k)));
  const savedOrder = (saved?.order ?? []).filter((k) => VALID.has(k));
  const seen = new Set(savedOrder);
  // Widgets connus absents du layout sauvegardé → ajoutés à la fin (ordre par défaut).
  const merged = [...savedOrder, ...DEFAULT_ORDER.filter((k) => !seen.has(k))];
  return merged.filter((k) => !hidden.has(k)) as WidgetKey[];
}
