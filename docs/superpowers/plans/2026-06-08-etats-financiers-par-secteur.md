# États financiers par famille comptable — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Classer chaque société BRVM dans une famille comptable (banque / assurance / général), capturer les lignes financières spécifiques à chaque famille dans un `lignes_specifiques jsonb`, et afficher ces lignes via un dictionnaire de libellés — sans régression sur le Diagnostic IA ni les exports.

**Architecture:** Le socle commun (revenu_total, resultat_net, total_actifs, capitaux propres, trésorerie) reste en colonnes typées et **canonique** (revenu_total = CA / PNB / primes selon la famille). Les lignes propres à chaque famille vont dans `lignes_specifiques jsonb` ajouté à `income_statements` et `balance_sheets`. `brvm_instruments` gagne `famille_comptable`. Extraction LLM paramétrée par famille (ré-extraction ciblée des banques). Affichage piloté par un dictionnaire `famille → {clé: libellé}`.

**Tech Stack:** Supabase PostgreSQL (migration additive), Next.js 14 + TS strict, zod, vitest, DeepSeek/Mistral (existant), pdfjs-dist + Mistral OCR (existant).

**Référence :** spec `docs/superpowers/specs/2026-06-08-etats-financiers-par-secteur-design.md`.

**Classification validée :** SMBC = général (Société Multinationale de Bitumes — industrie), SAFC = général (confirmés par l'utilisateur le 2026-06-08). 15 banques, 33 général, 0 assurance.

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `supabase/migrations/0025_familles_comptables.sql` (créer) | `famille_comptable` + `secteur` sur instruments ; `lignes_specifiques jsonb` sur income/balance ; mapping des 48 sociétés |
| `frontend/lib/financials/sectors.ts` (créer) | Type `Famille`, liste des clés `lignes_specifiques` attendues par famille |
| `frontend/lib/financials/sectorLabels.ts` (créer) | `Record<Famille, Record<string,string>>` clé→libellé FR |
| `frontend/lib/import/fullStatement.ts` (modifier) | Ajouter `lignes_specifiques` au schéma zod par exercice |
| `frontend/lib/import/fullPrompt.ts` (modifier) | `buildPrompt(famille)` ajoute les lignes spécifiques attendues |
| `frontend/lib/import/fullPersist.ts` (modifier) | `toRows` répartit `lignes_specifiques` entre income et balance |
| `frontend/lib/import/fullGuardrails.ts` (modifier) | contrôle léger banque (crédits+trésorerie ≤ total actif) |
| `frontend/lib/financials/types.ts` (modifier) | `lignes_specifiques` sur IncomeStatement/BalanceSheet ; `famille_comptable` sur instrument |
| `frontend/components/financials/SectorSpecificBlock.tsx` (créer) | Rend `lignes_specifiques` via le dictionnaire |
| `frontend/app/actions/[code]/financials/page.tsx` (modifier) | Monter le bloc + badge famille |
| `frontend/tests/financials/sectorLabels.test.ts` (créer) | Couverture libellés |
| `frontend/tests/financials/classification.test.ts` (créer) | Mapping 48 codes valide |
| `frontend/tests/import/sectorGuardrails.test.ts` (créer) | Garde-fou banque |

---

## Task 1 : Migration `0025` — familles + colonnes + mapping

**Files:**
- Create: `supabase/migrations/0025_familles_comptables.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- 0025 : familles comptables + lignes spécifiques par secteur
-- Famille comptable : banque (réf. BCEAO), assurance (réf. CIMA), general (SYSCOHADA).
-- Le socle commun (revenu_total = CA/PNB/primes, resultat_net, total_actifs, capitaux
-- propres, trésorerie) reste canonique. Les lignes propres vont dans lignes_specifiques.

alter table public.brvm_instruments
  add column if not exists famille_comptable text not null default 'general'
    check (famille_comptable in ('banque','assurance','general'));

alter table public.income_statements add column if not exists lignes_specifiques jsonb;
alter table public.balance_sheets   add column if not exists lignes_specifiques jsonb;

-- Banques (15)
update public.brvm_instruments set famille_comptable='banque'
  where code in ('BICB','BICC','BOAB','BOABF','BOAC','BOAM','BOAN','BOAS',
                 'CBIBF','ECOC','ETIT','NSBC','ORGT','SGBC','SIBC');

-- Secteur BRVM fin (toutes actions). Banques -> Finance.
update public.brvm_instruments set secteur='Finance'
  where famille_comptable='banque';

update public.brvm_instruments set secteur = m.sect from (values
  ('ABJC','Services'),('BNBC','Distribution'),('CABC','Industrie'),
  ('CFAC','Distribution'),('CIEC','Services publics'),('FTSC','Industrie'),
  ('LNBB','Services'),('NEIC','Services'),('NTLC','Agro-industrie'),
  ('ONTBF','Télécommunications'),('ORAC','Télécommunications'),('PALC','Agro-industrie'),
  ('PRSC','Distribution'),('SAFC','Finance'),('SCRC','Agro-industrie'),
  ('SDCC','Services publics'),('SDSC','Transport'),('SEMC','Industrie'),
  ('SHEC','Distribution'),('SICC','Agro-industrie'),('SIVC','Industrie'),
  ('SMBC','Industrie'),
  ('SLBC','Agro-industrie'),('SNTS','Télécommunications'),('SOGC','Agro-industrie'),
  ('SPHC','Agro-industrie'),('STAC','Industrie'),('STBC','Industrie'),
  ('SVOC','Services'),('TTLC','Distribution'),('TTLS','Distribution'),
  ('UNLC','Distribution'),('UNXC','Industrie')
) as m(code, sect) where brvm_instruments.code = m.code;
```

- [ ] **Step 2 : Appliquer la migration en base**

L'utilisateur applique le SQL dans l'éditeur Supabase, OU (si le contrôleur a accès DB) via le pooler transaction `aws-0-eu-west-3.pooler.supabase.com:6543` (cf. mémoire `deploiement-infra`).

Vérification attendue (SQL) :
```sql
select famille_comptable, count(*) from brvm_instruments where type='action' group by 1;
```
Attendu : `banque=15, general=33`.

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/0025_familles_comptables.sql
git commit -m "feat(db): migration 0025 familles comptables + lignes_specifiques + mapping secteurs"
```

---

## Task 2 : Types des familles et des clés spécifiques

**Files:**
- Create: `frontend/lib/financials/sectors.ts`

- [ ] **Step 1 : Écrire le module**

```ts
// frontend/lib/financials/sectors.ts
export type Famille = 'banque' | 'assurance' | 'general';

/** Clés attendues dans lignes_specifiques par famille (ordre d'affichage). */
export const SECTOR_KEYS: Record<Famille, string[]> = {
  banque: [
    'pnb', 'produit_interets', 'marge_interets', 'depots_clientele',
    'credits_clientele', 'creances_douteuses', 'coefficient_exploitation', 'ratio_solvabilite',
  ],
  assurance: [
    'primes_emises', 'primes_acquises', 'charges_sinistres',
    'provisions_techniques', 'placements', 'ratio_combine',
  ],
  general: [],
};

/** Clés stockées côté bilan (le reste va côté compte de résultat). */
export const BALANCE_KEYS = new Set<string>([
  'depots_clientele', 'credits_clientele', 'creances_douteuses',
  'ratio_solvabilite', 'provisions_techniques', 'placements',
]);
```

- [ ] **Step 2 : Vérifier la compilation**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add frontend/lib/financials/sectors.ts
git commit -m "feat(financials): types familles + clés lignes_specifiques par famille"
```

---

## Task 3 : Dictionnaire de libellés + test

**Files:**
- Create: `frontend/lib/financials/sectorLabels.ts`
- Test: `frontend/tests/financials/sectorLabels.test.ts`

- [ ] **Step 1 : Écrire le test d'abord**

```ts
// frontend/tests/financials/sectorLabels.test.ts
import { describe, it, expect } from 'vitest';
import { SECTOR_LABELS } from '@/lib/financials/sectorLabels';
import { SECTOR_KEYS } from '@/lib/financials/sectors';

describe('SECTOR_LABELS', () => {
  it('chaque clé attendue par famille a un libellé non vide', () => {
    for (const fam of ['banque', 'assurance'] as const) {
      for (const key of SECTOR_KEYS[fam]) {
        expect(SECTOR_LABELS[fam][key], `${fam}.${key}`).toBeTruthy();
      }
    }
  });

  it('banque.pnb se libelle correctement', () => {
    expect(SECTOR_LABELS.banque.pnb).toBe('Produit Net Bancaire');
  });
});
```

- [ ] **Step 2 : Lancer le test (doit ÉCHOUER)**

Run: `cd frontend && npx vitest run tests/financials/sectorLabels.test.ts`
Expected: FAIL (module absent).

- [ ] **Step 3 : Écrire le dictionnaire**

```ts
// frontend/lib/financials/sectorLabels.ts
import type { Famille } from './sectors';

export const SECTOR_LABELS: Record<Famille, Record<string, string>> = {
  banque: {
    pnb: 'Produit Net Bancaire',
    produit_interets: 'Produits d’intérêts',
    marge_interets: 'Marge d’intérêts',
    depots_clientele: 'Dépôts clientèle',
    credits_clientele: 'Crédits clientèle',
    creances_douteuses: 'Créances douteuses',
    coefficient_exploitation: 'Coefficient d’exploitation (%)',
    ratio_solvabilite: 'Ratio de solvabilité (%)',
  },
  assurance: {
    primes_emises: 'Primes émises',
    primes_acquises: 'Primes acquises',
    charges_sinistres: 'Charges de sinistres',
    provisions_techniques: 'Provisions techniques',
    placements: 'Placements',
    ratio_combine: 'Ratio combiné (%)',
  },
  general: {},
};
```

- [ ] **Step 4 : Lancer les tests (PASS)**

Run: `cd frontend && npx vitest run tests/financials/sectorLabels.test.ts`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add frontend/lib/financials/sectorLabels.ts frontend/tests/financials/sectorLabels.test.ts
git commit -m "feat(financials): dictionnaire de libellés par famille + test"
```

---

## Task 4 : Test du mapping de classification

**Files:**
- Create: `frontend/tests/financials/classification.test.ts`

Ce test fige le mapping attendu côté code (source de vérité pour la revue), indépendant de la DB.

- [ ] **Step 1 : Écrire le test (+ la constante exportée qu'il vérifie)**

D'abord ajouter dans `frontend/lib/financials/sectors.ts` (à la suite) la constante de classification :

```ts
// (ajout à la fin de frontend/lib/financials/sectors.ts)
/** Mapping de référence des 48 actions BRVM -> famille comptable. */
export const FAMILLE_PAR_CODE: Record<string, Famille> = {
  BICB: 'banque', BICC: 'banque', BOAB: 'banque', BOABF: 'banque', BOAC: 'banque',
  BOAM: 'banque', BOAN: 'banque', BOAS: 'banque', CBIBF: 'banque', ECOC: 'banque',
  ETIT: 'banque', NSBC: 'banque', ORGT: 'banque', SGBC: 'banque', SIBC: 'banque',
  ABJC: 'general', BNBC: 'general', CABC: 'general', CFAC: 'general', CIEC: 'general',
  FTSC: 'general', LNBB: 'general', NEIC: 'general', NTLC: 'general', ONTBF: 'general',
  ORAC: 'general', PALC: 'general', PRSC: 'general', SAFC: 'general', SCRC: 'general',
  SDCC: 'general', SDSC: 'general', SEMC: 'general', SHEC: 'general', SICC: 'general',
  SIVC: 'general', SLBC: 'general', SMBC: 'general', SNTS: 'general', SOGC: 'general', SPHC: 'general',
  STAC: 'general', STBC: 'general', SVOC: 'general', TTLC: 'general', TTLS: 'general',
  UNLC: 'general', UNXC: 'general',
};
```

Puis le test :

```ts
// frontend/tests/financials/classification.test.ts
import { describe, it, expect } from 'vitest';
import { FAMILLE_PAR_CODE } from '@/lib/financials/sectors';

describe('FAMILLE_PAR_CODE', () => {
  it('couvre exactement 48 sociétés', () => {
    expect(Object.keys(FAMILLE_PAR_CODE)).toHaveLength(48);
  });

  it('contient 15 banques et 33 général, 0 assurance', () => {
    const vals = Object.values(FAMILLE_PAR_CODE);
    expect(vals.filter((v) => v === 'banque')).toHaveLength(15);
    expect(vals.filter((v) => v === 'general')).toHaveLength(33);
    expect(vals.filter((v) => v === 'assurance')).toHaveLength(0);
  });

  it('toutes les valeurs sont des familles valides', () => {
    for (const v of Object.values(FAMILLE_PAR_CODE)) {
      expect(['banque', 'assurance', 'general']).toContain(v);
    }
  });
});
```

- [ ] **Step 2 : Lancer les tests (PASS)**

Run: `cd frontend && npx vitest run tests/financials/classification.test.ts`
Expected: PASS (3/3). Si « couvre 48 » échoue, vérifier qu'aucun code n'est en double ou manquant face à la liste de Task 1.

- [ ] **Step 3 : Vérifier la cohérence migration ↔ code**

Les 16 banques du test doivent être identiques à la clause `in (...)` de la migration `0025` (Task 1). Comparer visuellement les deux listes.

- [ ] **Step 4 : Commit**

```bash
git add frontend/lib/financials/sectors.ts frontend/tests/financials/classification.test.ts
git commit -m "feat(financials): mapping de classification 48 sociétés + test"
```

---

## Task 5 : Schéma d'extraction — `lignes_specifiques`

**Files:**
- Modify: `frontend/lib/import/fullStatement.ts`

- [ ] **Step 1 : Ajouter le champ au schéma zod par exercice**

Dans `frontend/lib/import/fullStatement.ts`, dans `yearStatementSchema` (l'objet `z.object({...})`), ajouter avant la fermeture `})` :

```ts
  // Lignes propres à la famille (banque/assurance). Clés libres -> nombre|null.
  lignes_specifiques: z.record(z.number().nullable()).nullable().optional(),
```

- [ ] **Step 2 : Vérifier la compilation**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur. `YearStatement` gagne automatiquement `lignes_specifiques?: Record<string, number | null> | null`.

- [ ] **Step 3 : Commit**

```bash
git add frontend/lib/import/fullStatement.ts
git commit -m "feat(import): lignes_specifiques dans le schéma d'extraction"
```

---

## Task 6 : Prompt paramétré par famille

**Files:**
- Modify: `frontend/lib/import/fullPrompt.ts`

- [ ] **Step 1 : Ajouter `buildPrompt(famille)`**

Dans `frontend/lib/import/fullPrompt.ts`, ajouter en bas (sans retirer `FULL_SYSTEM_PROMPT` existant utilisé par la voie générique) :

```ts
import type { Famille } from '@/lib/financials/sectors';

const LIGNES_FAMILLE: Record<Famille, string> = {
  banque:
    "\n\nCETTE SOCIÉTÉ EST UNE BANQUE. En plus des champs communs, renseigne un objet " +
    "'lignes_specifiques' avec (FCFA bruts sauf ratios en %) : pnb (Produit Net Bancaire), " +
    "produit_interets, marge_interets, depots_clientele, credits_clientele, creances_douteuses, " +
    "coefficient_exploitation (%), ratio_solvabilite (%). Mets revenu_total = pnb. Mets null si absent.",
  assurance:
    "\n\nCETTE SOCIÉTÉ EST UNE ASSURANCE. En plus des champs communs, renseigne 'lignes_specifiques' avec " +
    "(FCFA bruts sauf ratios en %) : primes_emises, primes_acquises, charges_sinistres, provisions_techniques, " +
    "placements, ratio_combine (%). Mets revenu_total = primes_acquises. Mets null si absent.",
  general: '',
};

/** Prompt système adapté à la famille comptable de la société. */
export function buildSystemPrompt(famille: Famille): string {
  return FULL_SYSTEM_PROMPT + LIGNES_FAMILLE[famille];
}
```

- [ ] **Step 2 : Vérifier la compilation**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add frontend/lib/import/fullPrompt.ts
git commit -m "feat(import): prompt système paramétré par famille comptable"
```

---

## Task 7 : Persistance — répartir `lignes_specifiques`

**Files:**
- Modify: `frontend/lib/import/fullPersist.ts`

- [ ] **Step 1 : Répartir lignes_specifiques entre income et balance dans `toRows`**

Dans `frontend/lib/import/fullPersist.ts`, en haut ajouter l'import :

```ts
import { BALANCE_KEYS } from '@/lib/financials/sectors';
```

Puis, dans `toRows`, juste avant le `return {`, ajouter :

```ts
  // Répartit les lignes spécifiques : clés "bilan" -> balance, le reste -> income.
  const ls = s.lignes_specifiques ?? null;
  let lsIncome: Record<string, number | null> | null = null;
  let lsBalance: Record<string, number | null> | null = null;
  if (ls) {
    for (const [k, v] of Object.entries(ls)) {
      if (BALANCE_KEYS.has(k)) (lsBalance ??= {})[k] = v;
      else (lsIncome ??= {})[k] = v;
    }
  }
```

Puis ajouter `lignes_specifiques` aux deux objets retournés :
- dans l'objet `income: { ... }`, ajouter `lignes_specifiques: lsIncome,`
- dans l'objet `balance: { ... }`, ajouter `lignes_specifiques: lsBalance,`

- [ ] **Step 2 : Vérifier la compilation**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3 : Étendre le test existant `fullPersist.test.ts`**

Ajouter à `frontend/tests/import/fullPersist.test.ts` un cas :

```ts
import { BALANCE_KEYS } from '@/lib/financials/sectors';

it('répartit lignes_specifiques entre income et balance', () => {
  const withLs = { ...(y as YearStatement), lignes_specifiques: { pnb: 5e11, depots_clientele: 2e12 } };
  const r = toRows('NSBC', withLs, 'f.pdf');
  expect((r.income.lignes_specifiques as Record<string, number>).pnb).toBe(5e11);
  expect((r.balance.lignes_specifiques as Record<string, number>).depots_clientele).toBe(2e12);
  expect((r.income.lignes_specifiques as Record<string, unknown>).depots_clientele).toBeUndefined();
});
```

- [ ] **Step 4 : Lancer les tests (PASS)**

Run: `cd frontend && npx vitest run tests/import/fullPersist.test.ts`
Expected: PASS (2/2).

- [ ] **Step 5 : Commit**

```bash
git add frontend/lib/import/fullPersist.ts frontend/tests/import/fullPersist.test.ts
git commit -m "feat(import): persistance lignes_specifiques réparties income/balance + test"
```

---

## Task 8 : Garde-fou banque

**Files:**
- Modify: `frontend/lib/import/fullGuardrails.ts`
- Test: `frontend/tests/import/sectorGuardrails.test.ts`

- [ ] **Step 1 : Écrire le test d'abord**

```ts
// frontend/tests/import/sectorGuardrails.test.ts
import { describe, it, expect } from 'vitest';
import { checkBankSpecific } from '@/lib/import/fullGuardrails';

describe('checkBankSpecific', () => {
  it('accepte crédits + trésorerie <= total actif', () => {
    const r = checkBankSpecific({ credits_clientele: 8e11, tresorerie: 1e11, total_actifs: 1e12 });
    expect(r.ok).toBe(true);
  });
  it('rejette crédits + trésorerie nettement > total actif', () => {
    const r = checkBankSpecific({ credits_clientele: 2e12, tresorerie: 5e11, total_actifs: 1e12 });
    expect(r.ok).toBe(false);
    expect(r.reasons.join()).toMatch(/banque/);
  });
  it('ignore le contrôle si une valeur manque', () => {
    const r = checkBankSpecific({ credits_clientele: null, tresorerie: 1e11, total_actifs: 1e12 });
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 2 : Lancer le test (doit ÉCHOUER)**

Run: `cd frontend && npx vitest run tests/import/sectorGuardrails.test.ts`
Expected: FAIL (`checkBankSpecific` n'existe pas).

- [ ] **Step 3 : Implémenter `checkBankSpecific`**

Ajouter à la fin de `frontend/lib/import/fullGuardrails.ts` :

```ts
/**
 * Contrôle léger spécifique banque : crédits clientèle + trésorerie ne doivent pas
 * dépasser le total actif de plus de 5% (sinon erreur d'extraction).
 */
export function checkBankSpecific(x: {
  credits_clientele: number | null;
  tresorerie: number | null;
  total_actifs: number | null;
}): GuardResult {
  const reasons: string[] = [];
  if (x.credits_clientele != null && x.tresorerie != null && x.total_actifs != null) {
    if (x.credits_clientele + x.tresorerie > x.total_actifs * 1.05) {
      reasons.push('banque : crédits + trésorerie > total actif');
    }
  }
  return { ok: reasons.length === 0, reasons };
}
```

- [ ] **Step 4 : Lancer les tests (PASS)**

Run: `cd frontend && npx vitest run tests/import/sectorGuardrails.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5 : Commit**

```bash
git add frontend/lib/import/fullGuardrails.ts frontend/tests/import/sectorGuardrails.test.ts
git commit -m "feat(import): garde-fou spécifique banque (crédits+trésorerie vs actif) + test"
```

---

## Task 9 : Câbler famille dans la route batch

**Files:**
- Modify: `frontend/app/api/import-batch/route.ts`

- [ ] **Step 1 : Lire la famille et adapter le prompt + garde-fou**

Dans `frontend/app/api/import-batch/route.ts` :

a) Ajouter les imports :
```ts
import { buildSystemPrompt } from '@/lib/import/fullPrompt';
import { checkBankSpecific } from '@/lib/import/fullGuardrails';
import type { Famille } from '@/lib/financials/sectors';
```

b) Modifier `callLlm` pour accepter la famille et utiliser `buildSystemPrompt(famille)` à la place de `FULL_SYSTEM_PROMPT` :
```ts
async function callLlm(text: string, symbol: string, famille: Famille): Promise<string | null> {
```
et dans le `body`, remplacer le message system par :
```ts
          { role: 'system', content: buildSystemPrompt(famille) },
```
(garder le `userPrompt`/`fullUserPrompt` existant pour le message user).

c) Charger la famille de chaque société. Quand on récupère les `codes` (requête `brvm_instruments`), sélectionner aussi `famille_comptable` :
```ts
  let q = admin.from('brvm_instruments').select('code, famille_comptable').eq('type', 'action');
  if (onlyCode) q = q.eq('code', onlyCode);
  const { data: instruments } = await q;
  const rows = (instruments ?? []) as Array<{ code: string; famille_comptable: Famille }>;
```
puis itérer sur `rows` (au lieu de `codes`) :
```ts
      for (const { code, famille_comptable: famille } of rows) {
```

d) À l'appel LLM, passer la famille :
```ts
            const raw = await callLlm(text, code, famille);
```

e) Après le garde-fou commun `checkStatement`, ajouter le contrôle banque :
```ts
              if (famille === 'banque') {
                const bk = checkBankSpecific({
                  credits_clientele: ex.lignes_specifiques?.credits_clientele ?? null,
                  tresorerie: ex.tresorerie_equivalents ?? null,
                  total_actifs: ex.total_actifs ?? null,
                });
                if (!bk.ok) { log(`${code} ${ex.periode} : REJET [${bk.reasons.join('; ')}]`); continue; }
              }
```

- [ ] **Step 2 : Vérifier la compilation**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur. Si `ex.lignes_specifiques` est typé comme optionnel, l'accès `?.` est correct.

- [ ] **Step 3 : Commit**

```bash
git add "frontend/app/api/import-batch/route.ts"
git commit -m "feat(import): route batch — prompt + garde-fou par famille comptable"
```

---

## Task 10 : Types frontend — exposer `lignes_specifiques` et `famille_comptable`

**Files:**
- Modify: `frontend/lib/financials/types.ts`
- Modify: `frontend/lib/financials/queries.ts`

- [ ] **Step 1 : Étendre les types**

Dans `frontend/lib/financials/types.ts` :
- ajouter à `interface IncomeStatement` et `interface BalanceSheet` : `lignes_specifiques: Record<string, number | null> | null;`
- ajouter au sous-objet `instrument` de `FinancialsData` : `famille_comptable: 'banque' | 'assurance' | 'general';`

- [ ] **Step 2 : Charger les nouveaux champs dans la requête**

Dans `frontend/lib/financials/queries.ts`, fonction `loadCompanyFinancials` :
- ajouter `lignes_specifiques` aux `select(...)` de `income_statements` et `balance_sheets`.
- ajouter `famille_comptable` au `select(...)` de `brvm_instruments` et au mapping de l'objet `instrument` retourné (`famille_comptable: instrument.famille_comptable ?? 'general'`).

- [ ] **Step 3 : Vérifier la compilation**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 4 : Commit**

```bash
git add frontend/lib/financials/types.ts frontend/lib/financials/queries.ts
git commit -m "feat(financials): exposer lignes_specifiques + famille_comptable dans les requêtes"
```

---

## Task 11 : Composant d'affichage des lignes spécifiques

**Files:**
- Create: `frontend/components/financials/SectorSpecificBlock.tsx`

- [ ] **Step 1 : Écrire le composant**

```tsx
// frontend/components/financials/SectorSpecificBlock.tsx
import type { Famille } from '@/lib/financials/sectors';
import { SECTOR_KEYS } from '@/lib/financials/sectors';
import { SECTOR_LABELS } from '@/lib/financials/sectorLabels';

interface Props {
  famille: Famille;
  /** lignes_specifiques fusionnées (income + balance) du dernier exercice. */
  lignes: Record<string, number | null> | null;
}

function fmtValeur(key: string, v: number): string {
  // Les ratios (clé finissant par _exploitation, _solvabilite, _combine) sont des %.
  if (/exploitation|solvabilite|combine/.test(key)) return `${v.toFixed(1)} %`;
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)} Md`;
  return v.toLocaleString('fr-FR');
}

/** Affiche les lignes propres à la famille, dans l'ordre SECTOR_KEYS, en omettant les absentes. */
export default function SectorSpecificBlock({ famille, lignes }: Props) {
  if (famille === 'general' || !lignes) return null;
  const labels = SECTOR_LABELS[famille];
  const rows = SECTOR_KEYS[famille]
    .filter((k) => lignes[k] != null)
    .map((k) => ({ key: k, label: labels[k] ?? k, value: lignes[k] as number }));
  if (rows.length === 0) return null;

  const titre = famille === 'banque' ? 'Spécificités bancaires' : 'Spécificités assurance';
  return (
    <div className="bg-surface border border-border rounded-xl p-5 space-y-2">
      <h2 className="text-sm font-semibold text-white">{titre}</h2>
      <div className="space-y-0">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
            <span className="text-xs text-muted">{r.label}</span>
            <span className="tabular text-sm font-medium text-white">{fmtValeur(r.key, r.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier la compilation**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add frontend/components/financials/SectorSpecificBlock.tsx
git commit -m "feat(financials): composant d'affichage des lignes spécifiques par famille"
```

---

## Task 12 : Monter le bloc + badge famille dans la page

**Files:**
- Modify: `frontend/app/actions/[code]/financials/page.tsx`

- [ ] **Step 1 : Importer et monter le bloc**

Dans `frontend/app/actions/[code]/financials/page.tsx` :

a) Ajouter l'import :
```ts
import SectorSpecificBlock from '@/components/financials/SectorSpecificBlock';
```

b) Calculer les lignes spécifiques fusionnées du dernier exercice (après le calcul de `ratios`, et en réutilisant `latestIncome`/`latestBalance` déjà présents dans le fichier) :
```ts
  const lignesSpecifiques = {
    ...(latestBalance?.lignes_specifiques ?? {}),
    ...(latestIncome?.lignes_specifiques ?? {}),
  };
  const aLignesSpecifiques = Object.keys(lignesSpecifiques).length > 0;
```

c) Juste avant la section « Publications — états financiers » (Task 10 de la feature précédente) OU avant le bloc Diagnostic, insérer :
```tsx
        {data.instrument.famille_comptable !== 'general' && aLignesSpecifiques && (
          <SectorSpecificBlock
            famille={data.instrument.famille_comptable}
            lignes={lignesSpecifiques}
          />
        )}
```

d) Dans le « Page header » (le bloc `flex items-center justify-between` avec `<h1>{code}</h1>`), ajouter un badge famille après la désignation/secteur :
```tsx
            {data.instrument.famille_comptable !== 'general' && (
              <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] bg-info/10 text-info border border-info/20 font-medium">
                {data.instrument.famille_comptable === 'banque' ? 'Banque' : 'Assurance'}
              </span>
            )}
```

- [ ] **Step 2 : Vérifier la compilation**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add "frontend/app/actions/[code]/financials/page.tsx"
git commit -m "feat(financials): bloc spécificités + badge famille sur la fiche société"
```

---

## Task 13 : Ré-extraction ciblée des banques (exécution)

**Files:** aucun fichier de prod (script de backfill temporaire, supprimé après).

- [ ] **Step 1 : Pré-requis**

Migration `0025` appliquée (Task 1 Step 2). Clés DeepSeek + Mistral valides (déjà vérifié).

- [ ] **Step 2 : Lancer la ré-extraction des 16 banques via la route admin**

Connecté en `ebouak@gmail.com`, page `/admin/import-fondamentaux`, panneau « Import auto », saisir chaque code banque (ou les laisser passer dans un run global — les banques utiliseront automatiquement le prompt `banque` car la route lit `famille_comptable`). Recommandé : faire les 16 banques une par une pour lire les logs.

Lire le log : chaque exercice doit afficher « écrit ✓ » ou un REJET motivé. Les PDF scannés (BOA) passent par l'OCR automatiquement.

- [ ] **Step 3 : Vérifier en base**

```sql
select code, periode, lignes_specifiques->>'pnb' pnb, lignes_specifiques->>'depots_clientele' depots
from income_statements i
where code in ('NSBC','SGBC','BOAM') and lignes_specifiques is not null
order by code, periode;
-- + bilans toujours équilibrés :
select count(*) from balance_sheets where total_actifs is not null and total_passif is not null
  and abs(total_actifs-total_passif)/nullif(total_actifs,0) > 0.01;  -- attendu : 0
```
Attendu : `pnb` rempli pour les banques ; 0 bilan déséquilibré.

- [ ] **Step 4 : Vérifier l'affichage**

Ouvrir `/actions/NSBC/financials` : badge « Banque », bloc « Spécificités bancaires » avec PNB / Dépôts clientèle / etc. ; les sociétés `general` (ex. `/actions/PALC/financials`) inchangées (pas de bloc).

---

## Task 14 : Suite de tests complète + déploiement

**Files:** aucun.

- [ ] **Step 1 : Suite vitest complète**

Run: `cd frontend && npx vitest run`
Expected: tous les tests passent (anciens + nouveaux : sectorLabels, classification, sectorGuardrails, fullPersist étendu).

- [ ] **Step 2 : Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3 : Push (déclenche l'auto-déploiement Vercel)**

```bash
git push origin main
```

- [ ] **Step 4 : Vérifier le déploiement**

Sur `https://frontend-zeta-ten-22.vercel.app/actions/NSBC/financials` : badge Banque + bloc spécificités visibles.

---

## Self-Review

**Spec coverage :**
- Familles + `famille_comptable` + `lignes_specifiques jsonb` → Task 1 (migration). ✓
- Socle commun canonique, diagnostic/export non impactés → Tasks 1/10 (colonnes inchangées ; lignes_specifiques additif). ✓
- Classification manuelle des 48 → Task 1 (migration) + Task 4 (mapping code + test de cohérence). ✓
- Lignes spécifiques par famille → Task 2 (clés) + Task 6 (prompt). ✓
- Extraction paramétrée par famille → Tasks 5, 6, 9. ✓
- Garde-fou banque → Task 8. ✓
- Persistance répartie income/balance → Task 7. ✓
- Affichage par dictionnaire de libellés → Tasks 3, 11, 12. ✓
- Ré-extraction ciblée banques → Task 13. ✓
- Tests (libellés, classification, garde-fou, persist) → Tasks 3, 4, 7, 8, 14. ✓

**Placeholder scan :** aucun TBD ; code complet à chaque étape ; commandes + résultats attendus présents.

**Type consistency :** `Famille` (Task 2) réutilisé partout (6, 9, 10, 11). `SECTOR_KEYS`/`BALANCE_KEYS` (Task 2) → Tasks 7, 11. `SECTOR_LABELS` (Task 3) → Task 11. `FAMILLE_PAR_CODE` (Task 4) cohérent avec la migration (Task 1). `buildSystemPrompt` (Task 6) → Task 9. `checkBankSpecific` (Task 8) → Task 9. `lignes_specifiques` : schéma (Task 5) → persist (Task 7) → types (Task 10) → affichage (Task 11). Noms de colonnes alignés sur la migration 0025.

**Risque connu :** la migration 0025 doit être appliquée AVANT Task 9/10/13 (sinon `famille_comptable` / `lignes_specifiques` absents en base). Ordre respecté (Task 1 d'abord).
