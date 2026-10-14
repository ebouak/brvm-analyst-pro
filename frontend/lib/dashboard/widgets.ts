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

/** Profil déduit des positions (spec §2) : rien n'est stocké. */
export type Profil = 'actif' | 'debutant';

/** Au moins une position détenue → investisseur actif. */
export function deduireProfil(nbPositions: number): Profil {
  return nbPositions > 0 ? 'actif' : 'debutant';
}

/** Débutant : l'ordre historique, la séance d'abord. */
export const ORDRE_DEBUTANT: WidgetKey[] = WIDGETS.map((w) => w.key);

/** Actif : son portefeuille d'abord, puis la séance dans l'ordre historique. */
export const ORDRE_ACTIF: WidgetKey[] = ['portefeuille', ...ORDRE_DEBUTANT.filter((k) => k !== 'portefeuille')];

/** Compatibilité : l'ordre par défaut historique est celui du débutant. */
/** @deprecated Utiliser ORDRE_DEBUTANT ou ordreParDefaut(profil). Conservé pour compatibilité. */
export const DEFAULT_ORDER: WidgetKey[] = ORDRE_DEBUTANT;

export function ordreParDefaut(profil: Profil): WidgetKey[] {
  return profil === 'actif' ? ORDRE_ACTIF : ORDRE_DEBUTANT;
}
const VALID = new Set<string>(DEFAULT_ORDER);

export interface DashboardLayout { order?: string[]; hidden?: string[] }

/**
 * Résout l'ordre + la visibilité des widgets.
 * - Layout sauvegardé : il l'emporte TOUJOURS sur le profil (spec §2).
 * - Sinon : l'ordre par défaut du profil.
 * Tolérant : ignore les clés inconnues, ajoute en fin les widgets nouveaux
 * (apparus après la sauvegarde) tant qu'ils ne sont pas masqués.
 * Retourne la liste ORDONNÉE des widgets VISIBLES.
 */
export function resolveLayout(saved: DashboardLayout | null | undefined, profil: Profil = 'debutant'): WidgetKey[] {
  const defaut = ordreParDefaut(profil);
  const hidden = new Set((saved?.hidden ?? []).filter((k) => VALID.has(k)));
  const savedOrder = (saved?.order ?? []).filter((k) => VALID.has(k));
  const seen = new Set(savedOrder);
  // Widgets connus absents du layout sauvegardé → ajoutés à la fin (ordre par défaut).
  const merged = [...savedOrder, ...defaut.filter((k) => !seen.has(k))];
  return merged.filter((k) => !hidden.has(k)) as WidgetKey[];
}
