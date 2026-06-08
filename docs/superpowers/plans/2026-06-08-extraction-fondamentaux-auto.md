# Extraction automatique des fondamentaux (toutes actions) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extraire automatiquement, depuis les PDF d'états financiers déjà référencés en base (`publications.source_url`), les données financières détaillées (compte de résultat + bilan + flux, comme PALC) pour les ~42 actions qui ont des publications, avec auto-écriture protégée par des garde-fous stricts ; puis lier Publications ↔ Données financières dans l'UI et afficher un résumé des chiffres clés dans la section Publications.

**Architecture:** Réutilisation du pipeline LLM existant du frontend (`pdfClient` pdfjs-dist, cascade DeepSeek/Mistral via `resolveApiKey`, garde-fous `validate.ts`). Nouveau **mode batch serveur** : une route admin Next.js parcourt les publications `etats_financiers`, télécharge chaque PDF côté serveur, extrait le texte, appelle le LLM avec un prompt **détaillé** (toutes les lignes SYSCOHADA, industriels + banques), applique des garde-fous renforcés (magnitude, conversion milliers→FCFA, cohérence bilan actif=passif, cohérence résultat, BPA), puis upsert dans `income_statements`, `balance_sheets`, `cash_flow_statements`, `fundamentals` avec `source='llm-extracted'` — sans jamais écraser une donnée `source='pdf-verified'` (PALC).

**Tech Stack:** Next.js 14 App Router (route handlers serveur), TypeScript strict, `@supabase/supabase-js` (service_role serveur), `pdfjs-dist` (déjà dépendance frontend), `zod`, DeepSeek/Mistral via fetch. Tests : vitest (à ajouter au frontend pour les fonctions pures).

**Décisions validées (brainstorming) :**
- Posture : **auto-écriture avec garde-fous** (pas de file de validation) → garde-fous = filet de sécurité, doivent être stricts.
- Profondeur : **détail complet comme PALC** (états complets, pas seulement le résumé).
- Affichage : (1) lier Publications ↔ Données financières (navigation croisée) ET (2) résumé des chiffres clés dans la section Publications.

**Faisabilité vérifiée en réel :** PDF accessibles serveur (HTTP 200, application/pdf, sans login) ; 42/48 actions ont des `etats_financiers` depuis 2024 ; clés DeepSeek+Mistral valides ; écriture DB OK.

---

## Schémas de référence (autoritatifs)

Colonnes réelles (cf. `supabase/migrations/0023_palc_complet.sql` + `frontend/lib/financials/types.ts`).

**income_statements** (clé naturelle `code, periode, type_periode`) : `code, periode, type_periode, revenu_total, cout_ventes, marge_brute, frais_generaux_admin, depenses_rd, autres_depenses, resultat_exploitation, charges_financieres_nettes, resultat_avant_impots, impots, resultat_net, benefice_par_action, benefice_par_action_dilue, dividende_par_action, actions_en_circulation`.

**balance_sheets** (clé `code, periode, type_periode`) : `total_actifs, total_actif_circulant, tresorerie_equivalents, investissements_court_terme, creances_clients, stocks, autres_actifs_courants, total_actif_non_courant, immobilisations_nettes, goodwill, actifs_incorporels, investissements_long_terme, total_passif, passif_courant, fournisseurs, dette_court_terme, autres_passifs_courants, passif_non_courant, dette_long_terme, total_capitaux_propres, capital_social, reserves_benefices_non_repartis`.

**cash_flow_statements** (clé `code, periode, type_periode`) : `flux_exploitation, resultat_net, depreciation_amortissement, variation_bfr, flux_investissement, investissements_ppe, acquisitions, flux_financement, dividendes_verses, remboursement_dette, emissions_actions, variation_tresorerie, tresorerie_debut_periode, tresorerie_fin_periode, depenses_capital, flux_tresorerie_disponible`.

**fundamentals** (clé `code, year`) : `code, year, revenue, net_income, equity, cash, debt, bfr, source, source_file`.

**Unité de stockage : FCFA bruts** (PALC : valeurs ×1000 car source en milliers). Le LLM renverra des valeurs en **FCFA bruts déjà convertis** ; les garde-fous re-vérifient la magnitude.

---

## File Structure

| Fichier | Responsabilité |
|---|---|
| `frontend/lib/import/fullStatement.ts` (créer) | Types `FullStatementExtraction` (toutes les lignes) + zod schema |
| `frontend/lib/import/fullPrompt.ts` (créer) | Prompt LLM détaillé (industriels + banques), règles d'unité |
| `frontend/lib/import/fullGuardrails.ts` (créer) | Garde-fous : magnitude, cohérence bilan/résultat/BPA → `{ ok, reasons }` |
| `frontend/lib/import/fullPersist.ts` (créer) | Mapping extraction → lignes des 4 tables + upsert (skip si `pdf-verified`) |
| `frontend/lib/import/selectPublications.ts` (créer) | Choisir les bons `etats_financiers` par code (exercice le plus récent + 2023) |
| `frontend/app/api/import-batch/route.ts` (créer) | Route admin : orchestre fetch PDF → extract → guardrails → persist, par code ou toutes |
| `frontend/lib/import/serverPdf.ts` (créer) | Extraction texte PDF côté serveur (pdfjs-dist legacy build) |
| `frontend/app/admin/import-fondamentaux/page.tsx` (modifier) | Ajouter bouton « Import auto depuis publications » |
| `frontend/components/import/BatchImportPanel.tsx` (créer) | UI client : lance le batch, affiche progression par action |
| `frontend/lib/financials/queries.ts` (modifier) | `loadCompanyFinancials` : exposer `publications` + lier aux états |
| `frontend/app/actions/[code]/financials/page.tsx` (modifier) | Section Publications : résumé chiffres clés + lien croisé |
| `frontend/tests/import/fullGuardrails.test.ts` (créer) | Tests vitest des garde-fous |
| `frontend/tests/import/fullPersist.test.ts` (créer) | Tests vitest du mapping |
| `frontend/tests/import/selectPublications.test.ts` (créer) | Tests vitest de la sélection |
| `frontend/package.json` (modifier) | Ajouter script `test` (vitest) + devDep vitest |
| `frontend/vitest.config.ts` (créer) | Config vitest |

---

## Task 1: Config vitest dans le frontend

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/vitest.config.ts`

- [ ] **Step 1: Ajouter vitest en devDependency et le script test**

Dans `frontend/package.json`, ajouter au bloc `"scripts"` la ligne `"test": "vitest run"`, et dans `"devDependencies"` : `"vitest": "^2.1.8"`.

- [ ] **Step 2: Créer la config vitest**

```ts
// frontend/vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
});
```

- [ ] **Step 3: Installer**

Run: `cd frontend && npm install`
Expected: vitest installé, pas d'erreur.

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/vitest.config.ts frontend/package-lock.json
git commit -m "chore(import): config vitest frontend pour tests fondamentaux"
```

---

## Task 2: Types de l'extraction détaillée

**Files:**
- Create: `frontend/lib/import/fullStatement.ts`

- [ ] **Step 1: Écrire les types + schema zod**

Le LLM renvoie pour CHAQUE exercice présent (N et N-1) un objet par état. Les montants sont en **FCFA bruts** (déjà convertis depuis les milliers). `eps`, `dividend_per_share`, `shares` ne sont pas en FCFA agrégés.

```ts
// frontend/lib/import/fullStatement.ts
import { z } from 'zod';

const num = z.number().nullable();

export const yearStatementSchema = z.object({
  periode: z.string(),               // ex "2025"
  // Compte de résultat
  revenu_total: num, cout_ventes: num, marge_brute: num,
  frais_generaux_admin: num, depenses_rd: num, autres_depenses: num,
  resultat_exploitation: num, charges_financieres_nettes: num,
  resultat_avant_impots: num, impots: num, resultat_net: num,
  benefice_par_action: num, benefice_par_action_dilue: num,
  dividende_par_action: num, actions_en_circulation: num,
  // Bilan
  total_actifs: num, total_actif_circulant: num, tresorerie_equivalents: num,
  investissements_court_terme: num, creances_clients: num, stocks: num,
  autres_actifs_courants: num, total_actif_non_courant: num,
  immobilisations_nettes: num, goodwill: num, actifs_incorporels: num,
  investissements_long_terme: num, total_passif: num, passif_courant: num,
  fournisseurs: num, dette_court_terme: num, autres_passifs_courants: num,
  passif_non_courant: num, dette_long_terme: num, total_capitaux_propres: num,
  capital_social: num, reserves_benefices_non_repartis: num,
  // Flux de trésorerie
  flux_exploitation: num, depreciation_amortissement: num, variation_bfr: num,
  flux_investissement: num, investissements_ppe: num, acquisitions: num,
  flux_financement: num, dividendes_verses: num, remboursement_dette: num,
  emissions_actions: num, variation_tresorerie: num,
  tresorerie_debut_periode: num, tresorerie_fin_periode: num,
  depenses_capital: num, flux_tresorerie_disponible: num,
});

export type YearStatement = z.infer<typeof yearStatementSchema>;

export const fullExtractionSchema = z.object({
  est_banque: z.boolean(),           // SYSCOHADA banque vs industriel
  unite_source: z.enum(['milliers', 'millions', 'fcfa']),
  exercices: z.array(yearStatementSchema).min(1),
});

export type FullExtraction = z.infer<typeof fullExtractionSchema>;
```

- [ ] **Step 2: Vérifier la compilation**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/import/fullStatement.ts
git commit -m "feat(import): types extraction détaillée états financiers (zod)"
```

---

## Task 3: Prompt LLM détaillé (industriels + banques)

**Files:**
- Create: `frontend/lib/import/fullPrompt.ts`

- [ ] **Step 1: Écrire le prompt**

```ts
// frontend/lib/import/fullPrompt.ts
export const FULL_SYSTEM_PROMPT =
  "Tu es un analyste financier expert des états financiers SYSCOHADA/OHADA (BRVM/UEMOA). " +
  "On te donne le texte d'un PDF d'états financiers. Renvoie UNIQUEMENT un objet JSON valide, sans texte autour.\n\n" +
  "RÈGLE D'UNITÉ CRITIQUE :\n" +
  "1. Lis l'en-tête des tableaux (ex : 'En milliers de FRANCS CFA', 'En millions', 'En FCFA').\n" +
  "2. Renseigne 'unite_source' = 'milliers' | 'millions' | 'fcfa' selon l'en-tête.\n" +
  "3. Convertis TOUS les montants agrégés en FCFA BRUTS : si 'milliers' multiplie par 1000 ; si 'millions' par 1 000 000 ; si 'fcfa' garde tel quel.\n" +
  "   Exemple : tableau en milliers, CA = 197 629 996 → revenu_total = 197629996000.\n" +
  "4. EXCEPTIONS jamais converties : benefice_par_action, benefice_par_action_dilue, dividende_par_action (FCFA par action), actions_en_circulation (nombre d'actions).\n\n" +
  "STRUCTURE : renvoie un exercice par année présente dans le document (souvent N et N-1 en comparatif).\n" +
  "Mets 'periode' = l'année sur 4 chiffres (ex '2025').\n\n" +
  "BANQUES (est_banque=true) : le 'revenu_total' = Produit Net Bancaire (PNB) ; cout_ventes et marge_brute peuvent être null ; " +
  "le bilan utilise prêts/dépôts — mappe les dépôts clients vers dette_court_terme, les prêts clients vers creances_clients, les immobilisations vers immobilisations_nettes.\n" +
  "INDUSTRIELS (est_banque=false) : mapping SYSCOHADA classique.\n\n" +
  "COHÉRENCE OBLIGATOIRE : total_actifs = total_passif ; resultat_net = resultat_avant_impots - impots (impots en valeur positive de charge) ; " +
  "marge_brute = revenu_total - cout_ventes quand applicable. Si une ligne est absente du document, mets null (n'invente jamais).";

export function fullUserPrompt(symbol: string, text: string): string {
  return `Société BRVM : ${symbol}.\n\nTexte du PDF des états financiers :\n${text.slice(0, 60000)}`;
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/import/fullPrompt.ts
git commit -m "feat(import): prompt LLM détaillé SYSCOHADA (industriels + banques)"
```

---

## Task 4: Garde-fous renforcés (fonction pure + tests)

**Files:**
- Create: `frontend/lib/import/fullGuardrails.ts`
- Test: `frontend/tests/import/fullGuardrails.test.ts`

- [ ] **Step 1: Écrire le test d'abord**

```ts
// frontend/tests/import/fullGuardrails.test.ts
import { describe, it, expect } from 'vitest';
import { checkStatement } from '@/lib/import/fullGuardrails';
import type { YearStatement } from '@/lib/import/fullStatement';

const base: YearStatement = {
  periode: '2025', revenu_total: 197629996000, cout_ventes: 110612438000,
  marge_brute: 87017558000, frais_generaux_admin: 30126881000, depenses_rd: 29620649000,
  autres_depenses: null, resultat_exploitation: 44484941000, charges_financieres_nettes: -2213587000,
  resultat_avant_impots: 20220189000, impots: -4711534000, resultat_net: 15508655000,
  benefice_par_action: 760, benefice_par_action_dilue: 760, dividende_par_action: 502,
  actions_en_circulation: 20406297, total_actifs: 199116293000, total_actif_circulant: 86256798000,
  tresorerie_equivalents: 9488637000, investissements_court_terme: 0, creances_clients: 78270148000,
  stocks: 7986650000, autres_actifs_courants: 0, total_actif_non_courant: 103370859000,
  immobilisations_nettes: 99076870000, goodwill: 0, actifs_incorporels: 184157000,
  investissements_long_terme: 3085720000, total_passif: 199116293000, passif_courant: 55680750000,
  fournisseurs: 41633570000, dette_court_terme: 14047180000, autres_passifs_courants: 0,
  passif_non_courant: 796559000, dette_long_terme: 796559000, total_capitaux_propres: 142638984000,
  capital_social: 20406297000, reserves_benefices_non_repartis: 106724033000,
  flux_exploitation: 38740600000, depreciation_amortissement: 19109395000, variation_bfr: 8174151000,
  flux_investissement: -19687331000, investissements_ppe: -19502640000, acquisitions: -164345000,
  flux_financement: -10952426000, dividendes_verses: -7930821000, remboursement_dette: -3021604000,
  emissions_actions: 0, variation_tresorerie: 8100843000, tresorerie_debut_periode: -12659387000,
  tresorerie_fin_periode: -4558544000, depenses_capital: -19502640000, flux_tresorerie_disponible: 19237960000,
};

describe('checkStatement', () => {
  it('accepte un exercice cohérent (PALC 2025)', () => {
    const r = checkStatement(base, false);
    expect(r.ok).toBe(true);
    expect(r.reasons).toEqual([]);
  });

  it('rejette une magnitude suspecte (CA < 1 Md)', () => {
    const r = checkStatement({ ...base, revenu_total: 197 }, false);
    expect(r.ok).toBe(false);
    expect(r.reasons.join()).toMatch(/magnitude/);
  });

  it('rejette un bilan non équilibré (actif != passif > 1%)', () => {
    const r = checkStatement({ ...base, total_passif: 150000000000 }, false);
    expect(r.ok).toBe(false);
    expect(r.reasons.join()).toMatch(/bilan/);
  });

  it('rejette un résultat net incohérent', () => {
    const r = checkStatement({ ...base, resultat_net: 999 }, false);
    expect(r.ok).toBe(false);
    expect(r.reasons.join()).toMatch(/résultat/);
  });

  it("rejette un BPA incohérent avec résultat/actions", () => {
    const r = checkStatement({ ...base, benefice_par_action: 99 }, false);
    expect(r.ok).toBe(false);
    expect(r.reasons.join()).toMatch(/BPA/);
  });

  it('banque : ne vérifie pas marge_brute', () => {
    const bank = { ...base, cout_ventes: null, marge_brute: null };
    const r = checkStatement(bank, true);
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `cd frontend && npx vitest run tests/import/fullGuardrails.test.ts`
Expected: FAIL (`checkStatement` n'existe pas).

- [ ] **Step 3: Implémenter les garde-fous**

```ts
// frontend/lib/import/fullGuardrails.ts
import type { YearStatement } from './fullStatement';

export interface GuardResult { ok: boolean; reasons: string[]; }

const MIN_PLAUSIBLE_FCFA = 1_000_000_000; // 1 Md FCFA
const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(b), 1);

/** Vérifie un exercice extrait. `estBanque` relâche les contrôles spécifiques industriels. */
export function checkStatement(s: YearStatement, estBanque: boolean): GuardResult {
  const reasons: string[] = [];

  // 1. Magnitude : CA et total actifs doivent dépasser ~1 Md FCFA (sinon erreur d'unité)
  if (s.revenu_total != null && Math.abs(s.revenu_total) < MIN_PLAUSIBLE_FCFA) reasons.push('magnitude revenu_total < 1 Md FCFA');
  if (s.total_actifs != null && Math.abs(s.total_actifs) < MIN_PLAUSIBLE_FCFA) reasons.push('magnitude total_actifs < 1 Md FCFA');

  // 2. Équilibre du bilan : total_actifs == total_passif (tolérance 1%)
  if (s.total_actifs != null && s.total_passif != null && rel(s.total_actifs, s.total_passif) > 0.01) {
    reasons.push('bilan déséquilibré (actif != passif)');
  }

  // 3. Cohérence résultat : resultat_net ≈ resultat_avant_impots + impots (impots signé négatif = charge)
  if (s.resultat_net != null && s.resultat_avant_impots != null && s.impots != null) {
    const attendu = s.resultat_avant_impots + s.impots;
    if (rel(s.resultat_net, attendu) > 0.02) reasons.push('résultat net incohérent (RAI + impôts)');
  }

  // 4. Cohérence BPA : benefice_par_action ≈ resultat_net / actions_en_circulation (tolérance 5%)
  if (s.benefice_par_action != null && s.resultat_net != null && s.actions_en_circulation) {
    const attendu = s.resultat_net / s.actions_en_circulation;
    if (Math.abs(attendu) > 1 && rel(s.benefice_par_action, attendu) > 0.05) reasons.push('BPA incohérent avec résultat/actions');
  }

  // 5. Industriels seulement : marge_brute ≈ revenu_total - cout_ventes
  if (!estBanque && s.marge_brute != null && s.revenu_total != null && s.cout_ventes != null) {
    const attendu = s.revenu_total - s.cout_ventes;
    if (rel(s.marge_brute, attendu) > 0.02) reasons.push('marge brute incohérente');
  }

  return { ok: reasons.length === 0, reasons };
}
```

- [ ] **Step 4: Lancer les tests pour les voir passer**

Run: `cd frontend && npx vitest run tests/import/fullGuardrails.test.ts`
Expected: PASS (6/6).

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/import/fullGuardrails.ts frontend/tests/import/fullGuardrails.test.ts
git commit -m "feat(import): garde-fous renforcés (magnitude, bilan, résultat, BPA) + tests"
```

---

## Task 5: Sélection des publications par action (fonction pure + tests)

**Files:**
- Create: `frontend/lib/import/selectPublications.ts`
- Test: `frontend/tests/import/selectPublications.test.ts`

- [ ] **Step 1: Écrire le test d'abord**

```ts
// frontend/tests/import/selectPublications.test.ts
import { describe, it, expect } from 'vitest';
import { selectFinancialPublications, type PubRow } from '@/lib/import/selectPublications';

const rows: PubRow[] = [
  { id: '1', code: 'SLBC', libelle: 'Etats financiers - Exercice 2025 - SOLIBRA CI', date_publication: '2026-05-19', type_publication: 'etats_financiers', source_url: 'u2025' },
  { id: '2', code: 'SLBC', libelle: 'Etats financiers - Exercice 2023 - SOLIBRA CI', date_publication: '2024-05-10', type_publication: 'etats_financiers', source_url: 'u2023' },
  { id: '3', code: 'SLBC', libelle: 'Avis de convocation AGO', date_publication: '2026-04-01', type_publication: 'ag', source_url: 'uago' },
  { id: '4', code: 'SLBC', libelle: 'Etats financiers - Exercice 2024 - SOLIBRA CI', date_publication: '2025-05-12', type_publication: 'etats_financiers', source_url: 'u2024' },
];

describe('selectFinancialPublications', () => {
  it("garde l'exercice le plus récent + l'exercice 2023, ignore les non-états", () => {
    const sel = selectFinancialPublications(rows);
    const exercices = sel.map((p) => p.exercice).sort();
    expect(exercices).toEqual([2023, 2025]);
    expect(sel.find((p) => p.exercice === 2025)!.source_url).toBe('u2025');
  });

  it('renvoie vide si aucun état financier', () => {
    expect(selectFinancialPublications([rows[2]])).toEqual([]);
  });
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `cd frontend && npx vitest run tests/import/selectPublications.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter la sélection**

```ts
// frontend/lib/import/selectPublications.ts
export interface PubRow {
  id: string; code: string; libelle: string | null; date_publication: string;
  type_publication: string | null; source_url: string | null;
}
export interface SelectedPub extends PubRow { exercice: number; }

/** Extrait l'année d'exercice depuis le libellé (ex "Exercice 2025"). */
function parseExercice(libelle: string | null): number | null {
  if (!libelle) return null;
  const m = libelle.match(/[Ee]xercice\s+(20\d{2})/);
  return m ? Number(m[1]) : null;
}

/**
 * Choisit, parmi les publications d'une action, les états financiers à extraire :
 * l'exercice le plus récent (donne N et N-1 en comparatif) + l'exercice 2023 (donne 2023/2022).
 * Garde une seule publication par exercice (la plus récemment publiée si doublon).
 */
export function selectFinancialPublications(rows: PubRow[]): SelectedPub[] {
  const ef = rows
    .filter((r) => r.type_publication === 'etats_financiers' && r.source_url)
    .map((r) => ({ ...r, exercice: parseExercice(r.libelle) }))
    .filter((r): r is SelectedPub => r.exercice != null);

  // dédoublonnage par exercice : garder la date_publication la plus récente
  const parExercice = new Map<number, SelectedPub>();
  for (const r of ef) {
    const prev = parExercice.get(r.exercice);
    if (!prev || r.date_publication > prev.date_publication) parExercice.set(r.exercice, r);
  }

  const exercices = [...parExercice.keys()].sort((a, b) => b - a);
  const recent = exercices[0];
  const cibles = new Set<number>();
  if (recent != null) cibles.add(recent);
  if (parExercice.has(2023)) cibles.add(2023);

  return [...cibles].map((y) => parExercice.get(y)!).filter(Boolean);
}
```

- [ ] **Step 4: Lancer les tests pour les voir passer**

Run: `cd frontend && npx vitest run tests/import/selectPublications.test.ts`
Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/import/selectPublications.ts frontend/tests/import/selectPublications.test.ts
git commit -m "feat(import): sélection des publications états financiers par action + tests"
```

---

## Task 6: Mapping extraction → lignes DB + persistance (fonction pure + tests)

**Files:**
- Create: `frontend/lib/import/fullPersist.ts`
- Test: `frontend/tests/import/fullPersist.test.ts`

- [ ] **Step 1: Écrire le test d'abord**

```ts
// frontend/tests/import/fullPersist.test.ts
import { describe, it, expect } from 'vitest';
import { toRows } from '@/lib/import/fullPersist';
import type { YearStatement } from '@/lib/import/fullStatement';

const y: Partial<YearStatement> = {
  periode: '2025', revenu_total: 197629996000, resultat_net: 15508655000,
  total_capitaux_propres: 142638984000, tresorerie_equivalents: 9488637000,
  dette_long_terme: 796559000, total_actif_circulant: 86256798000, passif_courant: 55680750000,
  benefice_par_action: 760, dividende_par_action: 502, actions_en_circulation: 20406297,
  total_actifs: 199116293000, total_passif: 199116293000,
};

describe('toRows', () => {
  it('produit les 4 lignes (income, balance, cashflow, fundamentals) avec source', () => {
    const r = toRows('SLBC', y as YearStatement, 'fichier.pdf');
    expect(r.income.code).toBe('SLBC');
    expect(r.income.periode).toBe('2025');
    expect(r.income.type_periode).toBe('annuel');
    expect(r.income.revenu_total).toBe(197629996000);
    expect(r.balance.total_actifs).toBe(199116293000);
    expect(r.cashflow.code).toBe('SLBC');
    expect(r.fundamentals.year).toBe(2025);
    expect(r.fundamentals.revenue).toBe(197629996000);
    expect(r.fundamentals.bfr).toBe(86256798000 - 55680750000); // BFR = actif circ - passif courant
    expect(r.fundamentals.source).toBe('llm-extracted');
    expect(r.fundamentals.source_file).toBe('fichier.pdf');
  });
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `cd frontend && npx vitest run tests/import/fullPersist.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter le mapping**

```ts
// frontend/lib/import/fullPersist.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { YearStatement } from './fullStatement';

const n = (v: number | null | undefined) => (v == null ? null : v);

export interface MappedRows {
  income: Record<string, unknown>;
  balance: Record<string, unknown>;
  cashflow: Record<string, unknown>;
  fundamentals: Record<string, unknown>;
}

/** Transforme un exercice extrait en lignes prêtes à upsert dans les 4 tables. */
export function toRows(code: string, s: YearStatement, sourceFile: string): MappedRows {
  const year = Number(s.periode);
  const bfr =
    s.total_actif_circulant != null && s.passif_courant != null
      ? s.total_actif_circulant - s.passif_courant
      : null;

  return {
    income: {
      code, periode: s.periode, type_periode: 'annuel',
      revenu_total: n(s.revenu_total), cout_ventes: n(s.cout_ventes), marge_brute: n(s.marge_brute),
      frais_generaux_admin: n(s.frais_generaux_admin), depenses_rd: n(s.depenses_rd), autres_depenses: n(s.autres_depenses),
      resultat_exploitation: n(s.resultat_exploitation), charges_financieres_nettes: n(s.charges_financieres_nettes),
      resultat_avant_impots: n(s.resultat_avant_impots), impots: n(s.impots), resultat_net: n(s.resultat_net),
      benefice_par_action: n(s.benefice_par_action), benefice_par_action_dilue: n(s.benefice_par_action_dilue),
      dividende_par_action: n(s.dividende_par_action), actions_en_circulation: n(s.actions_en_circulation),
    },
    balance: {
      code, periode: s.periode, type_periode: 'annuel',
      total_actifs: n(s.total_actifs), total_actif_circulant: n(s.total_actif_circulant),
      tresorerie_equivalents: n(s.tresorerie_equivalents), investissements_court_terme: n(s.investissements_court_terme),
      creances_clients: n(s.creances_clients), stocks: n(s.stocks), autres_actifs_courants: n(s.autres_actifs_courants),
      total_actif_non_courant: n(s.total_actif_non_courant), immobilisations_nettes: n(s.immobilisations_nettes),
      goodwill: n(s.goodwill), actifs_incorporels: n(s.actifs_incorporels), investissements_long_terme: n(s.investissements_long_terme),
      total_passif: n(s.total_passif), passif_courant: n(s.passif_courant), fournisseurs: n(s.fournisseurs),
      dette_court_terme: n(s.dette_court_terme), autres_passifs_courants: n(s.autres_passifs_courants),
      passif_non_courant: n(s.passif_non_courant), dette_long_terme: n(s.dette_long_terme),
      total_capitaux_propres: n(s.total_capitaux_propres), capital_social: n(s.capital_social),
      reserves_benefices_non_repartis: n(s.reserves_benefices_non_repartis),
    },
    cashflow: {
      code, periode: s.periode, type_periode: 'annuel',
      flux_exploitation: n(s.flux_exploitation), resultat_net: n(s.resultat_net),
      depreciation_amortissement: n(s.depreciation_amortissement), variation_bfr: n(s.variation_bfr),
      flux_investissement: n(s.flux_investissement), investissements_ppe: n(s.investissements_ppe),
      acquisitions: n(s.acquisitions), flux_financement: n(s.flux_financement),
      dividendes_verses: n(s.dividendes_verses), remboursement_dette: n(s.remboursement_dette),
      emissions_actions: n(s.emissions_actions), variation_tresorerie: n(s.variation_tresorerie),
      tresorerie_debut_periode: n(s.tresorerie_debut_periode), tresorerie_fin_periode: n(s.tresorerie_fin_periode),
      depenses_capital: n(s.depenses_capital), flux_tresorerie_disponible: n(s.flux_tresorerie_disponible),
    },
    fundamentals: {
      code, year, revenue: n(s.revenu_total), net_income: n(s.resultat_net),
      equity: n(s.total_capitaux_propres), cash: n(s.tresorerie_equivalents), debt: n(s.dette_long_terme),
      bfr, source: 'llm-extracted', source_file: sourceFile,
    },
  };
}

/**
 * Upsert les 4 lignes, en SAUTANT toute année déjà marquée 'pdf-verified' dans fundamentals
 * (protection des données vérifiées à la main comme PALC).
 */
export async function persistRows(admin: SupabaseClient, code: string, rows: MappedRows): Promise<'written' | 'skipped-verified'> {
  const year = rows.fundamentals.year as number;
  const { data: existing } = await admin
    .from('fundamentals').select('source').eq('code', code).eq('year', year).maybeSingle();
  if (existing?.source === 'pdf-verified') return 'skipped-verified';

  await admin.from('income_statements').upsert(rows.income, { onConflict: 'code,periode,type_periode' });
  await admin.from('balance_sheets').upsert(rows.balance, { onConflict: 'code,periode,type_periode' });
  await admin.from('cash_flow_statements').upsert(rows.cashflow, { onConflict: 'code,periode,type_periode' });
  await admin.from('fundamentals').upsert(rows.fundamentals, { onConflict: 'code,year' });
  return 'written';
}
```

- [ ] **Step 4: Lancer les tests pour les voir passer**

Run: `cd frontend && npx vitest run tests/import/fullPersist.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/import/fullPersist.ts frontend/tests/import/fullPersist.test.ts
git commit -m "feat(import): mapping extraction→4 tables + persistance protégée (skip pdf-verified)"
```

---

## Task 7: Extraction de texte PDF côté serveur

**Files:**
- Create: `frontend/lib/import/serverPdf.ts`

- [ ] **Step 1: Implémenter l'extraction texte serveur (pdfjs-dist legacy)**

```ts
// frontend/lib/import/serverPdf.ts
import 'server-only';

/** Télécharge un PDF et en extrait le texte brut (toutes pages) via pdfjs-dist legacy. */
export async function fetchPdfText(url: string): Promise<string> {
  const resp = await fetch(url, { signal: AbortSignal.timeout(30000), redirect: 'follow' });
  if (!resp.ok) throw new Error(`PDF HTTP ${resp.status}`);
  const buf = new Uint8Array(await resp.arrayBuffer());

  // Import dynamique du build legacy (compatible Node, pas de worker DOM)
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // @ts-expect-error workerSrc non typé sur le build legacy
  pdfjs.GlobalWorkerOptions.workerSrc = undefined;

  const doc = await pdfjs.getDocument({ data: buf, useSystemFonts: true }).promise;
  let out = '';
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    out += content.items.map((it: { str?: string }) => it.str ?? '').join(' ') + '\n';
  }
  return out;
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/import/serverPdf.ts
git commit -m "feat(import): extraction texte PDF côté serveur (pdfjs-dist legacy)"
```

---

## Task 8: Route batch d'import depuis les publications

**Files:**
- Create: `frontend/app/api/import-batch/route.ts`

- [ ] **Step 1: Implémenter la route (auth admin + orchestration + SSE de progression)**

Réutilise le pattern d'auth de `frontend/app/api/diagnostic/[code]/route.ts` (super admin `ebouak@gmail.com`). Appel LLM via DeepSeek puis Mistral (cascade), `response_format json_object`. Stream les lignes de progression en `text/plain`.

```ts
// frontend/app/api/import-batch/route.ts
import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createSbAdmin } from '@supabase/supabase-js';
import { resolveApiKey } from '@/lib/server/apiKeys';
import { fetchPdfText } from '@/lib/import/serverPdf';
import { selectFinancialPublications, type PubRow } from '@/lib/import/selectPublications';
import { FULL_SYSTEM_PROMPT, fullUserPrompt } from '@/lib/import/fullPrompt';
import { fullExtractionSchema } from '@/lib/import/fullStatement';
import { checkStatement } from '@/lib/import/fullGuardrails';
import { toRows, persistRows } from '@/lib/import/fullPersist';

export const maxDuration = 300;

async function callLlm(text: string, symbol: string): Promise<string | null> {
  const providers = [
    { key: await resolveApiKey('deepseek'), url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat' },
    { key: await resolveApiKey('mistral'), url: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-large-latest' },
  ].filter((p) => p.key);
  for (const p of providers) {
    try {
      const r = await fetch(p.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.key}` },
        body: JSON.stringify({
          model: p.model, temperature: 0.1, response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: FULL_SYSTEM_PROMPT }, { role: 'user', content: fullUserPrompt(symbol, text) }],
        }),
        signal: AbortSignal.timeout(120000),
      });
      if (!r.ok) continue;
      const j = await r.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = j.choices?.[0]?.message?.content;
      if (content) return content;
    } catch { /* provider suivant */ }
  }
  return null;
}

export async function POST(req: Request) {
  const supa = createServerClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user || user.email !== 'ebouak@gmail.com') {
    return NextResponse.json({ error: 'Réservé à l’administrateur' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as { code?: string };
  const onlyCode = body.code?.toUpperCase();

  const admin = createSbAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Liste des actions à traiter
  let q = admin.from('brvm_instruments').select('code').eq('type', 'action');
  if (onlyCode) q = q.eq('code', onlyCode);
  const { data: instruments } = await q;
  const codes = (instruments ?? []).map((i) => i.code as string);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const log = (m: string) => controller.enqueue(encoder.encode(m + '\n'));
      for (const code of codes) {
        const { data: pubs } = await admin
          .from('publications')
          .select('id, code, libelle, date_publication, type_publication, source_url')
          .eq('code', code);
        const selected = selectFinancialPublications((pubs ?? []) as PubRow[]);
        if (selected.length === 0) { log(`${code} : aucun état financier — ignoré`); continue; }

        for (const pub of selected) {
          try {
            const text = await fetchPdfText(pub.source_url!);
            const raw = await callLlm(text, code);
            if (!raw) { log(`${code} ex.${pub.exercice} : LLM indisponible`); continue; }
            const parsed = fullExtractionSchema.safeParse(JSON.parse(raw));
            if (!parsed.success) { log(`${code} ex.${pub.exercice} : JSON invalide`); continue; }

            for (const ex of parsed.data.exercices) {
              const guard = checkStatement(ex, parsed.data.est_banque);
              if (!guard.ok) { log(`${code} ${ex.periode} : REJET [${guard.reasons.join('; ')}]`); continue; }
              const res = await persistRows(admin, code, toRows(code, ex, pub.libelle ?? pub.source_url!));
              log(`${code} ${ex.periode} : ${res === 'written' ? 'écrit ✓' : 'protégé (pdf-verified)'}`);
            }
          } catch (e) {
            log(`${code} ex.${pub.exercice} : ERREUR ${e instanceof Error ? e.message : 'inconnue'}`);
          }
        }
      }
      log('--- Terminé ---');
      controller.close();
    },
  });

  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add "frontend/app/api/import-batch/route.ts"
git commit -m "feat(import): route batch extraction fondamentaux depuis publications (auth admin)"
```

---

## Task 9: UI admin — panneau d'import batch

**Files:**
- Create: `frontend/components/import/BatchImportPanel.tsx`
- Modify: `frontend/app/admin/import-fondamentaux/page.tsx`

- [ ] **Step 1: Créer le composant client de batch**

```tsx
// frontend/components/import/BatchImportPanel.tsx
'use client';
import { useState } from 'react';

export default function BatchImportPanel() {
  const [code, setCode] = useState('');
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState('');

  async function run() {
    setRunning(true); setLog('');
    try {
      const res = await fetch('/api/import-batch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(code.trim() ? { code: code.trim() } : {}),
      });
      if (!res.ok || !res.body) { setLog(`Erreur ${res.status}`); return; }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        setLog(buf);
      }
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-white">Import auto depuis les publications</p>
        <p className="text-xs text-muted mt-0.5">Extrait les états financiers (exercice récent + 2023) pour une action, ou toutes si vide.</p>
      </div>
      <div className="flex gap-2">
        <input
          value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="CODE (vide = toutes)"
          className="w-40 bg-bg border border-border rounded px-2 py-1.5 text-sm uppercase"
        />
        <button
          type="button" onClick={() => void run()} disabled={running}
          className="px-3 py-1.5 rounded-lg bg-up text-bg text-sm font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-40"
        >
          {running ? '⏳ Extraction…' : 'Lancer'}
        </button>
      </div>
      {log && (
        <pre className="text-xs text-muted bg-bg border border-border rounded p-3 max-h-80 overflow-auto whitespace-pre-wrap">{log}</pre>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Monter le panneau dans la page admin**

Dans `frontend/app/admin/import-fondamentaux/page.tsx`, ajouter l'import `import BatchImportPanel from '@/components/import/BatchImportPanel';` puis insérer `<BatchImportPanel />` en haut de la zone de contenu (avant la zone de dépôt de fichiers existante).

- [ ] **Step 3: Vérifier la compilation**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/import/BatchImportPanel.tsx "frontend/app/admin/import-fondamentaux/page.tsx"
git commit -m "feat(import): panneau admin d'import batch depuis publications"
```

---

## Task 10: Affichage — lier Publications ↔ Données financières + résumé chiffres clés

**Files:**
- Modify: `frontend/lib/financials/queries.ts`
- Modify: `frontend/app/actions/[code]/financials/page.tsx`

- [ ] **Step 1: S'assurer que `loadCompanyFinancials` renvoie les publications**

Vérifier dans `frontend/lib/financials/queries.ts` que `publications` (type `Publication[]`, cf. `types.ts`) est bien chargé et trié par `date_publication` desc, filtré sur `type_publication='etats_financiers'` pour la section. Si absent, ajouter la requête :

```ts
const { data: publications } = await supabase
  .from('publications')
  .select('id, libelle, date_publication, type_publication, source_url')
  .eq('code', code)
  .eq('type_publication', 'etats_financiers')
  .order('date_publication', { ascending: false })
  .limit(8);
```
et l'inclure dans l'objet retourné (`publications: publications ?? []`).

- [ ] **Step 2: Ajouter la section Publications avec résumé + lien croisé**

Dans `frontend/app/actions/[code]/financials/page.tsx`, après la section des états, ajouter un bloc qui, pour chaque publication d'états financiers, affiche le libellé, la date, un lien vers le PDF (`source_url`), et — si une `IncomeStatement` existe pour l'exercice correspondant — un résumé inline (CA, résultat net, BPA, dividende) tiré de `data.incomeStatements`. Lien croisé : un lien d'ancre `#etats` depuis chaque publication vers le tableau des états plus haut (ajouter `id="etats"` sur le conteneur des états).

```tsx
{/* Publications d'états financiers + résumé chiffres clés */}
{data.publications.length > 0 && (
  <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
    <h2 className="text-sm font-semibold text-white">Publications — états financiers</h2>
    <ul className="space-y-2">
      {data.publications.map((p) => {
        const an = (p.libelle ?? '').match(/[Ee]xercice\s+(20\d{2})/)?.[1] ?? null;
        const inc = an ? data.incomeStatements.find((s) => s.periode === an) : undefined;
        return (
          <li key={p.id} className="flex flex-col gap-1 border-b border-border/40 pb-2 last:border-0">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted">{p.libelle}</span>
              <div className="flex items-center gap-2 shrink-0">
                {inc && <a href="#etats" className="text-xs text-up hover:underline">Voir les états →</a>}
                {p.source_url && <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-info hover:underline">PDF</a>}
              </div>
            </div>
            {inc && (
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-faint tabular">
                <span>CA&nbsp;: {inc.revenu_total != null ? (inc.revenu_total / 1e9).toFixed(1) + ' Md' : 'N/D'}</span>
                <span>RN&nbsp;: {inc.resultat_net != null ? (inc.resultat_net / 1e9).toFixed(1) + ' Md' : 'N/D'}</span>
                <span>BPA&nbsp;: {inc.benefice_par_action ?? 'N/D'}</span>
                <span>Div&nbsp;: {inc.dividende_par_action ?? 'N/D'}</span>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  </div>
)}
```

Et ajouter `id="etats"` sur le conteneur du tableau des états financiers existant (la section `FinancialTabs` ou son wrapper).

- [ ] **Step 3: Vérifier la compilation**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/financials/queries.ts "frontend/app/actions/[code]/financials/page.tsx"
git commit -m "feat(financials): section publications + résumé chiffres clés + lien croisé états"
```

---

## Task 11: Validation bout-en-bout sur un échantillon (1 industriel + 1 banque)

**Files:** aucun (exécution + vérification)

- [ ] **Step 1: Lancer le batch sur un industriel (SLBC) et une banque (NSBC)**

Depuis l'app déployée (ou `npm run dev`), connecté en `ebouak@gmail.com`, page `/admin/import-fondamentaux`, panneau « Import auto », saisir `SLBC` → Lancer. Puis `NSBC` → Lancer. Lire le log : chaque exercice doit afficher « écrit ✓ » ou un REJET motivé.

- [ ] **Step 2: Vérifier en base la cohérence des données écrites**

Vérifier (SQL editor Supabase ou script `pg`) pour SLBC et NSBC : `total_actifs == total_passif` ; `revenu_total` en milliards ; `fundamentals.source = 'llm-extracted'`. PALC doit rester `source='pdf-verified'` et inchangé.

Run (exemple) :
```sql
select code, year, source, revenue/1e9 ca_md, net_income/1e9 rn_md from fundamentals where code in ('SLBC','NSBC','PALC') order by code, year;
```
Expected : SLBC/NSBC en `llm-extracted` avec CA en milliards ; PALC en `pdf-verified`.

- [ ] **Step 3: Vérifier l'affichage**

Ouvrir `/actions/SLBC/financials` et `/actions/NSBC/financials` : tableaux d'états remplis, section Publications avec résumé chiffres clés et liens PDF + « Voir les états ».

- [ ] **Step 4: Si un REJET injustifié apparaît**

Diagnostiquer via la raison loggée (magnitude / bilan / résultat / BPA). Ajuster le prompt (`fullPrompt.ts`) ou la tolérance du garde-fou concerné (`fullGuardrails.ts`), recommitter, relancer. Ne JAMAIS désactiver un garde-fou pour « forcer » l'écriture.

---

## Task 12: Lancer le batch complet (toutes actions) + revue

**Files:** aucun (exécution)

- [ ] **Step 1: Lancer le batch global**

Page admin, panneau « Import auto », champ vide → Lancer. Laisser tourner (≈ 42 actions × 1-2 PDF ; plusieurs minutes). Conserver le log.

- [ ] **Step 2: Recenser les résultats**

Compter les « écrit ✓ », les REJET (avec motifs), les « aucun état financier ». Vérifier la couverture :
```sql
select count(distinct code) from fundamentals where source='llm-extracted';
```
Expected : proche de 42.

- [ ] **Step 3: Traiter les REJET récurrents**

Pour les motifs fréquents (souvent banques ou unités), affiner `fullPrompt.ts` / `fullGuardrails.ts`, recommitter, relancer uniquement les codes concernés (champ code du panneau).

- [ ] **Step 4: Commit final éventuel des ajustements**

```bash
git add frontend/lib/import/fullPrompt.ts frontend/lib/import/fullGuardrails.ts
git commit -m "fix(import): ajustements prompt/garde-fous après batch complet"
```

---

## Self-Review (rempli)

**Spec coverage :**
- « Extraire auto depuis états 2025 (→2024) et 2023 comme PALC » → Tasks 5 (sélection), 7 (PDF), 3 (prompt détaillé), 8 (orchestration), 6 (mapping détaillé 4 tables). ✓
- « détail complet comme PALC » → Task 2 (types complets) + 6 (mapping des 4 tables avec toutes les colonnes de 0023). ✓
- « auto-écrire avec garde-fous » → Task 4 (garde-fous stricts) + Task 8 (rejet si garde-fou échoue, jamais d'écriture forcée) + Task 6 (skip pdf-verified). ✓
- « lier Publications ↔ Données financières » → Task 10 (lien croisé `#etats` + lien PDF). ✓
- « résumé chiffres clés dans section Publications » → Task 10 (CA/RN/BPA/Div inline). ✓

**Placeholder scan :** aucun TBD ; tout le code est fourni ; commandes et résultats attendus présents.

**Type consistency :** `YearStatement`/`FullExtraction` (Task 2) réutilisés tels quels en Tasks 4, 6, 8. `PubRow`/`SelectedPub` (Task 5) réutilisés en Task 8. `toRows`/`persistRows` (Task 6) appelés en Task 8. `checkStatement(s, estBanque)` signature identique partout. Noms de colonnes alignés sur 0023 + types.ts.

**Risques connus à surveiller à l'exécution :**
- pdfjs-dist legacy en environnement serverless Vercel (Task 7) : si échec d'import worker, fallback `pdf-parse`. À vérifier en Task 11 Step 1.
- Banques : mapping bilan approximatif ; Task 11 (NSBC) sert de test réel avant le batch global.
- Durée route batch global > maxDuration Vercel (300s) : si dépassement, lancer par lots de codes (le champ code permet le découpage).
