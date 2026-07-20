/**
 * Score de liquidité v2 — fonctions PURES (aucune I/O), testées.
 * 4 composantes à 25 % : présence, activité (valeur), impact prix (Amihud),
 * spread implicite (Roll). Spec : docs/superpowers/specs/2026-07-19-liquidite-v2-design.md
 * Le carnet d'ordres n'étant pas publié par la BRVM, la profondeur est ESTIMÉE
 * (Amihud) et le coût d'exécution ESTIMÉ (Roll) — jamais inventés.
 */

export interface LiquiditySessionRow30 {
  date_marche: string;
  cours_jour: number | null;
  variation_pct: number | null;
  volume: number | null;
  valeur_echangee: number | null;
}

export type LiquidityClass = 'A' | 'B' | 'C' | 'D';

export interface LiquidityV2Result {
  score: number | null;          // null si < MIN_SEANCES séances de marché
  classe: LiquidityClass | null;
  presence_pct: number;          // 0-100
  activite: number;              // 0-1 (échelle log valeur moyenne)
  amihud: number | null;         // %/M FCFA — null si aucune séance traitée
  spread_roll_pct: number | null;// % du cours — null si cov >= 0 (non estimable)
  valeur_moyenne_30j: number;    // FCFA / séance de marché
  seances_traitees: number;
  seances_marche: number;
}

export const ENGINE_VERSION = 'liq-v3.0.0';
const MIN_SEANCES = 10;

/**
 * ÉCHELLES ABSOLUES (v3, 2026-07-20). Les bornes v2 étaient calées sur la
 * distribution BRVM elle-même : elles étalaient mécaniquement les titres entre
 * eux et classaient la moitié du marché « très liquide » malgré un spread
 * médian de 1,6 %. Or la BRVM a un vrai problème de liquidité — ce n'est pas
 * la fréquence (les titres traitent 95-100 % des séances) mais la PROFONDEUR
 * et le COÛT. Les bornes ci-dessous mesurent donc la négociabilité réelle,
 * pas le rang relatif : « classe A » doit vouloir dire « on peut y entrer et
 * en sortir », pas « moins pire que les autres ».
 */
const LOG_FLOOR = 1_000_000;    // activité : 1 M FCFA/séance → 0
const LOG_CEIL = 500_000_000;   // 500 M FCFA/séance → 1
// Amihud (%/M FCFA) : combien le cours bouge par million échangé.
// 0,001 = on absorbe un million sans faire bouger le cours ; 5 = illiquide.
const AMIHUD_GOOD = 0.001;
const AMIHUD_BAD = 5;
// Spread de Roll en % du cours : 0,1 % = coût d'aller-retour négligeable,
// 4 % = prohibitif. (Médiane BRVM constatée : 1,6 %.)
const SPREAD_GOOD = 0.1;
const SPREAD_BAD = 4;

/**
 * Poids des composantes. La présence pèse peu : sur la BRVM 2026 tous les
 * titres traitent 95-100 % des séances, elle ne discrimine donc plus rien.
 * Ce qui fait la liquidité ici, c'est la taille échangeable (activité),
 * l'impact prix (Amihud) et le coût d'exécution (Roll).
 */
const POIDS_PRESENCE = 0.10;
const POIDS_ACTIVITE = 0.30;
const POIDS_AMIHUD = 0.30;
const POIDS_ROLL = 0.30;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function classifyLiquidity(score: number): LiquidityClass {
  if (score >= 75) return 'A';
  if (score >= 50) return 'B';
  if (score >= 25) return 'C';
  return 'D';
}

/** Estimateur de Roll : 2·√(−cov(Δp_t, Δp_{t−1})) en % du cours moyen. Null si cov ≥ 0. */
export function rollSpreadPct(closes: number[]): number | null {
  const p = closes.filter((c) => c > 0);
  if (p.length < 3) return null;
  const d: number[] = [];
  for (let i = 1; i < p.length; i++) d.push(p[i]! - p[i - 1]!);
  const x = d.slice(1);
  const y = d.slice(0, -1);
  const mx = x.reduce((a, b) => a + b, 0) / x.length;
  const my = y.reduce((a, b) => a + b, 0) / y.length;
  let cov = 0;
  for (let i = 0; i < x.length; i++) cov += (x[i]! - mx) * (y[i]! - my);
  cov /= x.length;
  if (cov >= 0) return null; // tendance pure : spread non estimable
  const spread = 2 * Math.sqrt(-cov);
  const meanPrice = p.reduce((a, b) => a + b, 0) / p.length;
  return (spread / meanPrice) * 100;
}

export function computeLiquidityV2(
  rows: LiquiditySessionRow30[],
  seancesMarche: number,
): LiquidityV2Result {
  const traitees = rows.filter((r) => (r.volume ?? 0) > 0);
  const seancesTraitees = traitees.length;

  let valeurTotale = 0;
  for (const r of traitees) {
    valeurTotale += r.valeur_echangee ?? ((r.cours_jour ?? 0) * (r.volume ?? 0));
  }
  const valeurMoyenne = seancesMarche > 0 ? valeurTotale / seancesMarche : 0;

  // Composante 1 : présence.
  const presencePct = seancesMarche > 0 ? Math.min(100, (seancesTraitees / seancesMarche) * 100) : 0;

  // Composante 2 : activité (log).
  const activite =
    valeurMoyenne <= LOG_FLOOR
      ? 0
      : clamp01(Math.log10(valeurMoyenne / LOG_FLOOR) / Math.log10(LOG_CEIL / LOG_FLOOR));

  // Composante 3 : impact prix (Amihud) = moyenne |variation %| / valeur (M FCFA).
  // Même fallback cours×volume que pour valeurTotale (brvmPublic.ts peut écrire valeur_echangee: null).
  let amihud: number | null = null;
  const impacts: number[] = [];
  for (const r of traitees) {
    if (r.variation_pct == null) continue;
    const ve = r.valeur_echangee ?? ((r.cours_jour ?? 0) * (r.volume ?? 0));
    if (ve > 0) impacts.push(Math.abs(r.variation_pct) / (ve / 1_000_000));
  }
  if (impacts.length > 0) amihud = impacts.reduce((a, b) => a + b, 0) / impacts.length;
  const compAmihud =
    amihud == null
      ? 0 // jamais traité (ou sans valeur) : au pire
      : clamp01(Math.log10(AMIHUD_BAD / Math.max(amihud, AMIHUD_GOOD)) / Math.log10(AMIHUD_BAD / AMIHUD_GOOD));

  // Composante 4 : spread implicite (Roll) sur les clôtures chronologiques.
  const closes = [...rows]
    .sort((a, b) => a.date_marche.localeCompare(b.date_marche))
    .map((r) => r.cours_jour)
    .filter((c): c is number => c != null && c > 0);
  const spreadPct = rollSpreadPct(closes);

  const base: Omit<LiquidityV2Result, 'score' | 'classe'> = {
    presence_pct: Math.round(presencePct * 100) / 100,
    activite: Math.round(activite * 10_000) / 10_000,
    amihud: amihud != null ? Math.round(amihud * 1_000_000) / 1_000_000 : null,
    spread_roll_pct: spreadPct != null ? Math.round(spreadPct * 10_000) / 10_000 : null,
    valeur_moyenne_30j: Math.round(valeurMoyenne * 100) / 100,
    seances_traitees: seancesTraitees,
    seances_marche: seancesMarche,
  };

  // Honnêteté : historique insuffisant → pas de score.
  if (seancesMarche < MIN_SEANCES) return { ...base, score: null, classe: null };

  // Quand le spread n'est pas estimable (cov ≥ 0, cas de 18 titres sur 47 au
  // premier calcul réel), son poids est REDISTRIBUÉ sur les autres composantes
  // plutôt que remplacé par une valeur neutre : un titre ne doit pas gagner des
  // points grâce à une donnée manquante.
  const parts: { valeur: number; poids: number }[] = [
    { valeur: presencePct / 100, poids: POIDS_PRESENCE },
    { valeur: activite, poids: POIDS_ACTIVITE },
    { valeur: compAmihud, poids: POIDS_AMIHUD },
  ];
  if (spreadPct != null) {
    const compRoll = clamp01(
      Math.log10(SPREAD_BAD / Math.max(spreadPct, SPREAD_GOOD)) / Math.log10(SPREAD_BAD / SPREAD_GOOD),
    );
    parts.push({ valeur: compRoll, poids: POIDS_ROLL });
  }
  const poidsTotal = parts.reduce((s, p) => s + p.poids, 0);
  const score = Math.round((100 * parts.reduce((s, p) => s + p.valeur * p.poids, 0)) / poidsTotal);
  return { ...base, score, classe: classifyLiquidity(score) };
}
