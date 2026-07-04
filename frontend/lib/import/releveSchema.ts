/**
 * Import de relevé de compte-titres SGI → positions de portefeuille.
 * Schéma d'extraction LLM + garde-fous de plausibilité. Aucune écriture
 * automatique : chaque ligne est revue/éditable par l'utilisateur avant import.
 */

export interface RelevePositionExtraite {
  /** Ticker BRVM si identifiable (ex. SNTS, PALC) — sinon null. */
  code: string | null;
  /** Libellé brut tel qu'il figure sur le relevé (ex. « SONATEL SN »). */
  libelle: string;
  /** Quantité de titres détenus. */
  quantite: number | null;
  /** Prix de revient unitaire (PRU) en FCFA si présent, sinon cours de valorisation, sinon null. */
  prix_unitaire: number | null;
}

export interface ReleveExtraction {
  positions: RelevePositionExtraite[];
  /** Espèces disponibles sur le compte si mentionnées (FCFA). */
  liquidites: number | null;
  /** Date du relevé (YYYY-MM-DD) si présente. */
  date_releve: string | null;
  /** Nom de la SGI émettrice si présent. */
  sgi: string | null;
}

export interface ReleveGuard {
  ok: boolean;
  reasons: string[];
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[\s ]/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Normalise la sortie LLM (types laxistes) vers ReleveExtraction. */
export function parseReleve(raw: unknown): ReleveExtraction {
  const r = (raw ?? {}) as Record<string, unknown>;
  const list = Array.isArray(r.positions) ? r.positions : [];
  const positions: RelevePositionExtraite[] = list
    .map((p) => {
      const o = (p ?? {}) as Record<string, unknown>;
      const code = typeof o.code === 'string' && o.code.trim() !== '' ? o.code.trim().toUpperCase() : null;
      const libelle = typeof o.libelle === 'string' ? o.libelle.trim() : '';
      return {
        code: code && /^[A-Z0-9]{2,8}$/.test(code) ? code : null,
        libelle,
        quantite: num(o.quantite),
        prix_unitaire: num(o.prix_unitaire),
      };
    })
    .filter((p) => p.libelle !== '' || p.code !== null);

  const dateRaw = typeof r.date_releve === 'string' ? r.date_releve.trim() : null;
  return {
    positions,
    liquidites: num(r.liquidites),
    date_releve: dateRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : null,
    sgi: typeof r.sgi === 'string' && r.sgi.trim() !== '' ? r.sgi.trim() : null,
  };
}

/** Garde-fous : un relevé plausible, pas des chiffres aberrants. */
export function checkReleve(ext: ReleveExtraction): ReleveGuard {
  const reasons: string[] = [];
  if (ext.positions.length === 0) reasons.push('Aucune position détectée dans le document.');
  if (ext.positions.length > 60) reasons.push(`${ext.positions.length} positions — au-delà du plausible pour un relevé individuel.`);
  for (const p of ext.positions) {
    const label = p.code ?? p.libelle.slice(0, 20);
    if (p.quantite != null && (p.quantite <= 0 || p.quantite > 10_000_000 || !Number.isInteger(p.quantite))) {
      reasons.push(`Quantité invraisemblable pour ${label} (${p.quantite}).`);
    }
    // Cours BRVM : de quelques centaines à ~150 000 FCFA. Bornes larges.
    if (p.prix_unitaire != null && (p.prix_unitaire < 10 || p.prix_unitaire > 500_000)) {
      reasons.push(`Prix unitaire hors bornes pour ${label} (${p.prix_unitaire} FCFA).`);
    }
  }
  if (ext.liquidites != null && (ext.liquidites < 0 || ext.liquidites > 10_000_000_000)) {
    reasons.push('Liquidités hors bornes.');
  }
  return { ok: reasons.length === 0, reasons };
}

/** Ligne prête à insérer, après revue utilisateur. */
export interface ReleveRowToImport {
  code: string;
  quantite: number;
  prix_entree: number;
  date_entree: string | null;
}

/** Validation stricte des lignes finales (après édition utilisateur). */
export function validateRowsToImport(rows: unknown): { ok: true; rows: ReleveRowToImport[] } | { ok: false; error: string } {
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: 'Aucune ligne à importer' };
  if (rows.length > 60) return { ok: false, error: 'Trop de lignes (max 60)' };
  const out: ReleveRowToImport[] = [];
  for (const r of rows) {
    const o = (r ?? {}) as Record<string, unknown>;
    const code = typeof o.code === 'string' ? o.code.trim().toUpperCase() : '';
    const quantite = num(o.quantite);
    const prix = num(o.prix_entree);
    const date = typeof o.date_entree === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.date_entree) ? o.date_entree : null;
    if (!/^[A-Z0-9]{2,8}$/.test(code)) return { ok: false, error: `Code invalide : « ${code || '?'} »` };
    if (quantite == null || quantite <= 0 || !Number.isInteger(quantite) || quantite > 10_000_000) {
      return { ok: false, error: `Quantité invalide pour ${code}` };
    }
    if (prix == null || prix < 0 || prix > 500_000) return { ok: false, error: `PRU invalide pour ${code}` };
    out.push({ code, quantite, prix_entree: prix, date_entree: date });
  }
  return { ok: true, rows: out };
}
