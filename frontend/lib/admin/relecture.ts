/**
 * Relecture des agrégats bancaires — PUR. Traduit la décision d'un
 * administrateur en changements d'état des observations (indicateur_source.
 * controle). La route applique ensuite la décision IMMÉDIATEMENT en rejouant
 * la sélection pour la banque (lib/admin/rejouerSelection.ts, avenant du
 * 2026-11-15) : rien n'attend le cron.
 *
 * Libellés et natures viennent de la copie du catalogue scraper
 * (lib/agregats/pure/agregats/indicateurs.ts) : aucune liste dupliquée à la main.
 */
import { AGREGATS } from '@/lib/agregats/pure/agregats/indicateurs';

export const LIBELLES_AGREGATS: Record<string, string> = Object.fromEntries(AGREGATS.map((a) => [a.indicateur, a.libelle]));

/** Indicateurs exprimés en pourcentage (les autres sont des montants). */
export const RATIOS: ReadonlySet<string> = new Set(AGREGATS.filter((a) => a.nature === 'ratio').map((a) => a.indicateur));

export type UniteValeur = 'fcfa' | 'usd' | 'pct';

export type ActionRelecture =
  | { action: 'valider'; observation: string }
  | { action: 'corriger'; observation: string; texte: string }
  | { action: 'rejeter' };

export interface PlanAction {
  valides: string[];
  rejetees: string[];
  correction: { observation: string; valeur: number; texte: string; decimales: number } | null;
  statut: 'validee' | 'corrigee' | 'rejetee';
  valeurCorrigee: number | null;
}

/**
 * Unité d'une valeur corrigée : % pour un ratio ; pour un montant, la devise
 * PUBLIÉE par le document (USD pour ETIT), jamais convertie.
 */
export function uniteCorrection(indicateur: string, deviseSource: string | null): UniteValeur {
  if (RATIOS.has(indicateur)) return 'pct';
  return deviseSource != null && /^(usd|us\s*\$|\$|dollars?)/i.test(deviseSource.trim()) ? 'usd' : 'fcfa';
}

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const SUFFIXE: Record<UniteValeur, string> = { fcfa: 'FCFA', usd: 'USD', pct: '%' };

/** « 152 345 000 000 FCFA », « 1 234 500 000 USD », « 14,39 % » ; null → « non exploitable ». */
export function libelleValeur(v: number | null, unite: string | null): string {
  if (v == null) return 'non exploitable';
  const u: UniteValeur = unite === 'usd' || unite === 'pct' ? unite : 'fcfa';
  return `${nf.format(v)} ${SUFFIXE[u]}`;
}

/** Montant ou pourcentage saisi : « 152 345 210 000 », « 14,39 ». */
function lireSaisie(texte: string): { valeur: number; decimales: number } | null {
  const t = texte.trim().replace(/[\s  ]/g, '').replace(/[−–]/g, '-').replace(/%$/, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return { valeur: Number(t), decimales: t.includes('.') ? t.split('.')[1]!.length : 0 };
}

export function planAction(item: { observations: string[] }, a: ActionRelecture): PlanAction {
  if (a.action === 'rejeter') return { valides: [], rejetees: [...item.observations], correction: null, statut: 'rejetee', valeurCorrigee: null };
  if (!item.observations.includes(a.observation)) throw new Error('Cette observation n’appartient pas à l’élément de relecture.');
  const autres = item.observations.filter((id) => id !== a.observation);
  if (a.action === 'valider') return { valides: [a.observation], rejetees: autres, correction: null, statut: 'validee', valeurCorrigee: null };
  const n = lireSaisie(a.texte);
  if (!n) throw new Error('Valeur corrigée illisible : saisir un nombre (montant dans la devise du document, % pour un ratio).');
  return { valides: [a.observation], rejetees: autres, correction: { observation: a.observation, valeur: n.valeur, texte: a.texte.trim(), decimales: n.decimales }, statut: 'corrigee', valeurCorrigee: n.valeur };
}
