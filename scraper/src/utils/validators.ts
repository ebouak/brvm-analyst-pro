/**
 * Contrôle qualité des données (cf. §6.3).
 *  - pas de doublon par (date, code)  -> dédup
 *  - volume >= 0, cours >= 0
 *  - alerte si |variation| > seuil anormal
 * Renvoie la liste des problèmes + des collections nettoyées/dédupliquées.
 */
import type {
  ActionRow,
  ObligationRow,
  IndiceRow,
  QualityIssue,
  MarketSnapshot,
} from '../types.js';
import { getConfig } from '../config.js';

export interface QualityResult {
  issues: QualityIssue[];
  cleaned: MarketSnapshot;
  hasErrors: boolean;
}

export function validateSnapshot(snapshot: MarketSnapshot): QualityResult {
  const cfg = getConfig();
  const issues: QualityIssue[] = [];

  const actions = dedupeByCode(snapshot.actions, 'action', issues);
  const obligations = dedupeByCode(snapshot.obligations, 'obligation', issues);
  const indices = dedupeByCode(indicesAsCodeable(snapshot.indices), 'indice', issues)
    .map(stripCodeable);

  // Règles numériques sur les actions.
  for (const a of actions) {
    checkNonNegative(a.volume, 'action', a.code, 'volume', issues);
    checkNonNegative(a.cours_jour, 'action', a.code, 'cours_jour', issues);
    checkNonNegative(a.cours_precedent, 'action', a.code, 'cours_precedent', issues);
    checkNonNegative(a.valeur_echangee, 'action', a.code, 'valeur_echangee', issues);
    checkVariation(a.variation_pct, 'action', a.code, cfg.QUALITY_MAX_ABS_VARIATION_PCT, issues);
  }
  for (const o of obligations) {
    checkNonNegative(o.volume, 'obligation', o.code, 'volume', issues);
    checkNonNegative(o.cours_jour, 'obligation', o.code, 'cours_jour', issues);
    checkNonNegative(o.valeur_echangee, 'obligation', o.code, 'valeur_echangee', issues);
  }
  for (const i of indices) {
    checkVariation(i.variation_pct, 'indice', i.code, cfg.QUALITY_MAX_ABS_VARIATION_PCT, issues);
  }

  const hasErrors = issues.some((x) => x.level === 'error');
  return {
    issues,
    hasErrors,
    cleaned: { ...snapshot, actions, obligations, indices },
  };
}

// --- helpers ----------------------------------------------------------------

interface Codeable {
  code: string;
}

function dedupeByCode<T extends Codeable>(
  rows: T[],
  scope: QualityIssue['scope'],
  issues: QualityIssue[],
): T[] {
  const seen = new Map<string, T>();
  for (const r of rows) {
    const key = r.code.trim().toUpperCase();
    if (seen.has(key)) {
      issues.push({
        level: 'warn',
        scope,
        code: r.code,
        field: 'code',
        message: `Doublon (date, code) détecté pour ${r.code} — première occurrence conservée`,
      });
      continue;
    }
    seen.set(key, r);
  }
  return [...seen.values()];
}

function checkNonNegative(
  value: number | null,
  scope: QualityIssue['scope'],
  code: string,
  field: string,
  issues: QualityIssue[],
): void {
  if (value != null && value < 0) {
    issues.push({
      level: 'error',
      scope,
      code,
      field,
      message: `${field} négatif (${value}) pour ${code}`,
    });
  }
}

function checkVariation(
  value: number | null,
  scope: QualityIssue['scope'],
  code: string,
  threshold: number,
  issues: QualityIssue[],
): void {
  if (value != null && Math.abs(value) > threshold) {
    issues.push({
      level: 'warn',
      scope,
      code,
      field: 'variation_pct',
      message: `Variation anormale ${value}% (> ${threshold}%) pour ${code} — à vérifier`,
    });
  }
}

// Les indices ont déjà un `code`, mais TS veut un type homogène pour dedupe.
function indicesAsCodeable(rows: IndiceRow[]): (IndiceRow & Codeable)[] {
  return rows as (IndiceRow & Codeable)[];
}
function stripCodeable(r: IndiceRow & Codeable): IndiceRow {
  return r;
}

export type { ActionRow, ObligationRow };
