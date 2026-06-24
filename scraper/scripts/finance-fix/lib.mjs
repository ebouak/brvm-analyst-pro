// scraper/scripts/finance-fix/lib.mjs
// Helper réutilisable : garde-fous + upsert service_role + vérification.
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, '../../.env.local') });

export function svc() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

const rel = (a, b) => Math.abs(a - b) / Math.max(Math.abs(b), 1);

/** Garde-fous par exercice. Retourne string[] (vide = OK). */
export function guardrails({ inc, bal, cf, ebePublie }) {
  const r = [];
  if (bal?.total_actifs != null && bal?.total_passif != null && rel(bal.total_actifs, bal.total_passif) > 0.01)
    r.push('bilan: actif != passif');
  if (bal?.total_passif != null && bal?.total_capitaux_propres != null && bal?.passif_courant != null && bal?.passif_non_courant != null) {
    const somme = bal.total_capitaux_propres + bal.passif_non_courant + bal.passif_courant;
    if (rel(somme, bal.total_passif) > 0.02) r.push('passif: sous-totaux ne réconcilient pas (découverts ?)');
  }
  if (ebePublie != null && inc?.resultat_exploitation != null && cf?.depreciation_amortissement != null) {
    if (rel(inc.resultat_exploitation + cf.depreciation_amortissement, ebePublie) > 0.02) r.push('EBITDA reconstruit != EBE publié');
  }
  if (inc?.benefice_par_action != null && inc?.resultat_net != null && inc?.actions_en_circulation) {
    const att = inc.resultat_net / inc.actions_en_circulation;
    if (Math.abs(att) > 1 && rel(inc.benefice_par_action, att) > 0.05) r.push('BPA incohérent');
  }
  if (inc?.resultat_net != null && inc?.resultat_avant_impots != null && inc?.impots != null) {
    if (rel(inc.resultat_net, inc.resultat_avant_impots + inc.impots) > 0.10
      && rel(inc.resultat_net, inc.resultat_avant_impots - inc.impots) > 0.10) r.push('RN incohérent (RAI±impôts)');
  }
  return r;
}

const OC = { onConflict: 'code,periode,type_periode' };
const stamp = (code, rows) => rows.map((x) => ({ code, type_periode: 'annuel', ...x }));

/** Upsert les 3 tables puis relit et applique les garde-fous. */
export async function upsertAndVerify(code, { income = [], balance = [], cash = [], ebe = {} }) {
  const sb = svc();
  const errs = [];
  for (const [tbl, rows] of [['income_statements', income], ['balance_sheets', balance], ['cash_flow_statements', cash]]) {
    if (!rows.length) continue;
    const { error } = await sb.from(tbl).upsert(stamp(code, rows), OC);
    if (error) errs.push(`${tbl}: ${error.message}`);
  }
  const byYear = (arr) => new Map((arr || []).map((r) => [r.periode, r]));
  const [{ data: inc }, { data: bal }, { data: cf }] = await Promise.all([
    sb.from('income_statements').select('*').eq('code', code),
    sb.from('balance_sheets').select('*').eq('code', code),
    sb.from('cash_flow_statements').select('*').eq('code', code),
  ]);
  const I = byYear(inc), B = byYear(bal), C = byYear(cf);
  const issues = [];
  for (const periode of [...new Set([...I.keys(), ...B.keys()])].sort()) {
    const g = guardrails({ inc: I.get(periode), bal: B.get(periode), cf: C.get(periode), ebePublie: ebe[periode] });
    if (g.length) issues.push(`${periode}: ${g.join(' | ')}`);
  }
  return { written: { income: income.length, balance: balance.length, cash: cash.length }, dbErrors: errs, issues };
}
