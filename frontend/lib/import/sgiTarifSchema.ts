import { z } from 'zod';

/**
 * Schéma + garde-fous de l'extraction LLM d'un barème tarifaire SGI (depuis un
 * PDF de décision officielle / grille CREPMF). Miroir de fullGuardrails pour
 * les fondamentaux : le LLM peut halluciner → on borne la plausibilité et on
 * ne persiste jamais un barème hors bornes sans revue humaine. Champs absents
 * = null (jamais 0 silencieux).
 */

const freq = z.enum(['annuel', 'trimestriel', 'semestriel']).nullable();
const freqTenue = z.enum(['annuel', 'trimestriel']).nullable();
const num = z.number().nullable();

export const sgiTarifSchema = z.object({
  courtage_pct_min: num,
  courtage_pct_max: num,
  minimum_perception: num,
  droits_garde_pct_min: num,
  droits_garde_pct_max: num,
  droits_garde_frequence: freq,
  droits_garde_minimum: num,
  tenue_compte_montant: num,
  tenue_compte_frequence: freqTenue,
  frais_virement: num,
  depot_minimum: num,
  gestion_sous_mandat_pct_min: num,
  gestion_sous_mandat_pct_max: num,
});

export type SgiTarifExtraction = z.infer<typeof sgiTarifSchema>;

export interface GuardResult {
  ok: boolean;
  reasons: string[];
}

// Bornes de plausibilité (barèmes réels BRVM/UEMOA).
const PCT_COURTAGE_MAX = 3; // %
const PCT_GARDE_MAX = 2; // % par période
const PCT_MANDAT_MAX = 5; // % par période
const MONTANT_MAX = 100_000_000; // FCFA (dépôt/tenue/virement/perception)

function pctInRange(v: number | null, max: number, label: string, reasons: string[]) {
  if (v == null) return;
  if (v < 0 || v > max) reasons.push(`${label} hors plage (${v}% ∉ [0..${max}%])`);
}

function montantInRange(v: number | null, label: string, reasons: string[]) {
  if (v == null) return;
  if (v < 0 || v > MONTANT_MAX) reasons.push(`${label} hors plage (${v} FCFA)`);
}

/**
 * Vérifie la plausibilité d'un barème extrait. `ok=false` → à valider
 * manuellement (jamais d'écriture auto). Un barème entièrement vide est
 * rejeté (aucune donnée exploitable extraite).
 */
export function checkSgiTarif(d: SgiTarifExtraction): GuardResult {
  const reasons: string[] = [];

  pctInRange(d.courtage_pct_min, PCT_COURTAGE_MAX, 'Courtage min', reasons);
  pctInRange(d.courtage_pct_max, PCT_COURTAGE_MAX, 'Courtage max', reasons);
  pctInRange(d.droits_garde_pct_min, PCT_GARDE_MAX, 'Garde min', reasons);
  pctInRange(d.droits_garde_pct_max, PCT_GARDE_MAX, 'Garde max', reasons);
  pctInRange(d.gestion_sous_mandat_pct_min, PCT_MANDAT_MAX, 'Gestion mandat min', reasons);
  pctInRange(d.gestion_sous_mandat_pct_max, PCT_MANDAT_MAX, 'Gestion mandat max', reasons);

  montantInRange(d.minimum_perception, 'Minimum de perception', reasons);
  montantInRange(d.droits_garde_minimum, 'Plancher de garde', reasons);
  montantInRange(d.tenue_compte_montant, 'Tenue de compte', reasons);
  montantInRange(d.frais_virement, 'Frais de virement', reasons);
  montantInRange(d.depot_minimum, 'Dépôt minimum', reasons);

  // Cohérence min ≤ max sur les fourchettes.
  if (d.courtage_pct_min != null && d.courtage_pct_max != null && d.courtage_pct_min > d.courtage_pct_max) {
    reasons.push('Courtage : min > max');
  }
  if (d.droits_garde_pct_min != null && d.droits_garde_pct_max != null && d.droits_garde_pct_min > d.droits_garde_pct_max) {
    reasons.push('Droits de garde : min > max');
  }

  // Au moins un champ exploitable (sinon extraction vide).
  const hasAny = Object.values(d).some((v) => v != null);
  if (!hasAny) reasons.push('Aucune donnée tarifaire extraite');

  return { ok: reasons.length === 0, reasons };
}

/** Ligne prête pour l'upsert sgi_frais (confiance homologue_crepmf). */
export function sgiTarifToRow(sgiNom: string, d: SgiTarifExtraction, sourceLabel: string, verifieLe: string) {
  return {
    sgi_nom: sgiNom,
    courtage_pct_min: d.courtage_pct_min,
    courtage_pct_max: d.courtage_pct_max,
    minimum_perception: d.minimum_perception,
    droits_garde_pct_min: d.droits_garde_pct_min,
    droits_garde_pct_max: d.droits_garde_pct_max,
    droits_garde_frequence: d.droits_garde_frequence,
    droits_garde_minimum: d.droits_garde_minimum,
    tenue_compte_montant: d.tenue_compte_montant,
    tenue_compte_frequence: d.tenue_compte_frequence,
    frais_virement: d.frais_virement,
    depot_minimum: d.depot_minimum,
    gestion_sous_mandat_pct_min: d.gestion_sous_mandat_pct_min,
    gestion_sous_mandat_pct_max: d.gestion_sous_mandat_pct_max,
    confiance: 'homologue_crepmf' as const,
    source_label: sourceLabel,
    verifie_le: verifieLe,
    updated_at: new Date().toISOString(),
  };
}
