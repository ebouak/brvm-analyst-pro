# Calculateur fiscal UEMOA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revenu net d'impôt (IRVM dividendes / IRC coupons) par pays émetteur UEMOA : lib pure + page publique `/fiscalite` + toggle brut/net sur `/dividendes` + YTM net sur `/obligations`.

**Architecture:** Barème en constantes TypeScript versionnées (`lib/tax/rates.ts`, chaque taux porte sa source officielle et sa date de vérification — un taux non vérifié reste `null` et l'UI affiche « non confirmé »). Fonctions pures paramétrées par le barème (`lib/tax/compute.ts`) → testables avec un barème fixture, indépendamment de la recherche des taux réels.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, TailwindCSS (tokens du repo), tests `node:assert` exécutés via `npx tsx` (pattern `lib/budgetSimulator.test.mjs`).

**Spec:** `docs/superpowers/specs/2026-07-10-calculateur-fiscal-uemoa-design.md`

---

## Fichiers

| Fichier | Rôle |
|---|---|
| Create `frontend/lib/tax/rates.ts` | Types + barème 8 pays × 3 types (données, sources) |
| Create `frontend/lib/tax/compute.ts` | Fonctions pures net/impôt/rendement |
| Create `frontend/lib/tax/compute.test.mjs` | Tests (barème fixture injecté) |
| Create `frontend/app/fiscalite/page.tsx` | Page publique SEO (server) |
| Create `frontend/components/tax/TaxCalculator.tsx` | Calculateur interactif (client) |
| Modify `frontend/lib/budgetSimulator.ts:15` | `IRVM` dérivé du barème (DRY) |
| Modify `frontend/components/ConditionalShell.tsx` (BARE_PREFIXES) | `/fiscalite` plein écran public |
| Modify `frontend/components/Footer.tsx:9-16` | Lien « Fiscalité UEMOA » |
| Modify `frontend/lib/nav.ts` (PALETTE_EXTRA) | Entrée palette ⌘K |
| Modify `frontend/components/DividendsTable.tsx` | Toggle Brut / Net |
| Modify `frontend/app/obligations/page.tsx` | Colonne « YTM net » |
| Modify `frontend/app/actions/[code]/page.tsx` (~l.270) | Ligne « Dividende net » |

---

### Task 1 : Types + squelette du barème (taux `null`, aucune invention)

**Files:** Create `frontend/lib/tax/rates.ts`

- [ ] **Step 1 : Écrire le fichier**

```ts
/**
 * Barème fiscal UEMOA — IRVM (dividendes) et IRC (intérêts obligataires) par
 * pays de l'émetteur. RÈGLE D'HONNÊTETÉ : chaque taux doit être adossé à une
 * source officielle (CGI national, loi de finances, note BRVM/SGI/AMF-UMOA).
 * Un taux non vérifié reste `null` → l'UI affiche « non confirmé », jamais un
 * chiffre douteux. Mise à jour = commit (historique git = audit trail).
 */

export type PaysUemoa = 'BJ' | 'BF' | 'CI' | 'GW' | 'ML' | 'NE' | 'SN' | 'TG';
export type TypeRevenu = 'dividende_cote' | 'obligation_etat' | 'obligation_privee';

export interface TauxFiscal {
  /** Taux de retenue à la source, ex. 0.10. `null` = non confirmé. */
  taux: number | null;
  /** Référence du texte officiel, ex. "CGI CI, art. 180 (LF 2025)". */
  source: string;
  sourceUrl: string | null;
  /** Date de vérification YYYY-MM-DD. */
  verifieLe: string;
  /** Particularités (exonération selon maturité, etc.). */
  note?: string;
}

export const PAYS_LABELS: Record<PaysUemoa, string> = {
  BJ: 'Bénin', BF: 'Burkina Faso', CI: "Côte d'Ivoire", GW: 'Guinée-Bissau',
  ML: 'Mali', NE: 'Niger', SN: 'Sénégal', TG: 'Togo',
};

const NON_VERIFIE: TauxFiscal = {
  taux: null, source: 'Non vérifié', sourceUrl: null, verifieLe: '2026-07-10',
};

/** Barème complet. Rempli (avec sources) par la Task 3. */
export const BAREME: Record<PaysUemoa, Record<TypeRevenu, TauxFiscal>> = {
  BJ: { dividende_cote: NON_VERIFIE, obligation_etat: NON_VERIFIE, obligation_privee: NON_VERIFIE },
  BF: { dividende_cote: NON_VERIFIE, obligation_etat: NON_VERIFIE, obligation_privee: NON_VERIFIE },
  CI: { dividende_cote: NON_VERIFIE, obligation_etat: NON_VERIFIE, obligation_privee: NON_VERIFIE },
  GW: { dividende_cote: NON_VERIFIE, obligation_etat: NON_VERIFIE, obligation_privee: NON_VERIFIE },
  ML: { dividende_cote: NON_VERIFIE, obligation_etat: NON_VERIFIE, obligation_privee: NON_VERIFIE },
  NE: { dividende_cote: NON_VERIFIE, obligation_etat: NON_VERIFIE, obligation_privee: NON_VERIFIE },
  SN: { dividende_cote: NON_VERIFIE, obligation_etat: NON_VERIFIE, obligation_privee: NON_VERIFIE },
  TG: { dividende_cote: NON_VERIFIE, obligation_etat: NON_VERIFIE, obligation_privee: NON_VERIFIE },
};

/** Normalise un code pays du référentiel (ex. "CI", "ci", "Côte d'Ivoire") → PaysUemoa | null. */
export function toPaysUemoa(raw: string | null | undefined): PaysUemoa | null {
  if (!raw) return null;
  const up = raw.trim().toUpperCase();
  if (up in PAYS_LABELS) return up as PaysUemoa;
  const byLabel = (Object.entries(PAYS_LABELS) as [PaysUemoa, string][])
    .find(([, label]) => label.toUpperCase() === up);
  return byLabel ? byLabel[0] : null;
}
```

- [ ] **Step 2 : Typecheck**

Run: `cd frontend && npx tsc --noEmit` — Expected: 0 erreur.

- [ ] **Step 3 : Commit**

```bash
git add frontend/lib/tax/rates.ts
git commit -m "feat(tax): types + squelette bareme UEMOA (taux null tant que non sources)"
```

---

### Task 2 : Fonctions pures `compute.ts` (TDD, barème fixture)

**Files:** Create `frontend/lib/tax/compute.test.mjs`, Create `frontend/lib/tax/compute.ts`

- [ ] **Step 1 : Écrire le test AVANT (fixture injectée — indépendant des vrais taux)**

```js
// Tests fiscalité. Exécuter : cd frontend && npx tsx lib/tax/compute.test.mjs
import assert from 'node:assert';
import { dividendeNet, couponNet, rendementNet } from './compute.ts';

const T = (taux) => ({ taux, source: 'fixture', sourceUrl: null, verifieLe: '2026-01-01' });
const FIXTURE = {
  CI: { dividende_cote: T(0.10), obligation_etat: T(0), obligation_privee: T(0.06) },
  SN: { dividende_cote: T(null), obligation_etat: T(null), obligation_privee: T(null) },
};

// Dividende : 100 000 brut à 10 % → 90 000 net, 10 000 d'impôt.
let r = dividendeNet(100_000, 'CI', FIXTURE);
assert.equal(r.indisponible, undefined);
assert.equal(r.net, 90_000);
assert.equal(r.impot, 10_000);
assert.equal(r.taux, 0.10);

// Taux 0 (exonéré) est un taux VALIDE, pas « indisponible ».
r = couponNet(50_000, 'CI', 'obligation_etat', FIXTURE);
assert.equal(r.net, 50_000);
assert.equal(r.impot, 0);

// Taux null → indisponible (jamais de calcul silencieux).
r = dividendeNet(100_000, 'SN', FIXTURE);
assert.equal(r.indisponible, true);

// Pays hors barème → indisponible.
r = dividendeNet(100_000, 'XX', FIXTURE);
assert.equal(r.indisponible, true);

// Arrondi FCFA entier (pas de centimes).
r = dividendeNet(33_333, 'CI', FIXTURE);
assert.equal(r.net, 30_000);
assert.equal(r.impot, 3_333);
assert.equal(r.net + r.impot, 33_333); // conservation du brut

// Rendement net : 8 % brut à 10 % d'IRVM → 7.2 %.
const y = rendementNet(8, 'CI', 'dividende_cote', FIXTURE);
assert.equal(y.indisponible, undefined);
assert.ok(Math.abs(y.valeur - 7.2) < 1e-9);

console.log('✓ compute.test.mjs : tous les tests passent');
```

- [ ] **Step 2 : Vérifier l'échec** — Run: `cd frontend && npx tsx lib/tax/compute.test.mjs` — Expected: FAIL (module `./compute.ts` introuvable).

- [ ] **Step 3 : Implémenter `compute.ts`**

```ts
/** Calculs fiscaux purs. Le barème est injectable (tests) ; défaut = BAREME réel. */
// NB : import SANS extension (.ts casserait le build Next — allowImportingTsExtensions off).
import { BAREME, type PaysUemoa, type TypeRevenu, type TauxFiscal } from './rates';

type Bareme = Partial<Record<string, Partial<Record<TypeRevenu, TauxFiscal>>>>;

export type ResultatNet =
  | { net: number; impot: number; taux: number; source: string; indisponible?: undefined }
  | { indisponible: true; raison: 'taux_non_confirme' | 'pays_inconnu' };

function lookup(pays: string, type: TypeRevenu, bareme: Bareme): TauxFiscal | 'pays_inconnu' {
  const p = bareme[pays as PaysUemoa];
  if (!p || !p[type]) return 'pays_inconnu';
  return p[type]!;
}

function applique(brut: number, pays: string, type: TypeRevenu, bareme: Bareme): ResultatNet {
  const t = lookup(pays, type, bareme);
  if (t === 'pays_inconnu') return { indisponible: true, raison: 'pays_inconnu' };
  if (t.taux == null) return { indisponible: true, raison: 'taux_non_confirme' };
  const impot = Math.round(brut * t.taux);
  return { net: brut - impot, impot, taux: t.taux, source: t.source };
}

export function dividendeNet(brut: number, pays: string, bareme: Bareme = BAREME): ResultatNet {
  return applique(brut, pays, 'dividende_cote', bareme);
}

export function couponNet(
  brut: number, pays: string, type: 'obligation_etat' | 'obligation_privee',
  bareme: Bareme = BAREME,
): ResultatNet {
  return applique(brut, pays, type, bareme);
}

export type RendementNet =
  | { valeur: number; taux: number; indisponible?: undefined }
  | { indisponible: true };

/** Rendement (en %) après retenue à la source. */
export function rendementNet(
  rendementBrutPct: number, pays: string, type: TypeRevenu, bareme: Bareme = BAREME,
): RendementNet {
  const t = lookup(pays, type, bareme);
  if (t === 'pays_inconnu' || t.taux == null) return { indisponible: true };
  return { valeur: rendementBrutPct * (1 - t.taux), taux: t.taux };
}
```

- [ ] **Step 4 : Vérifier le succès** — Run: `cd frontend && npx tsx lib/tax/compute.test.mjs` — Expected: `✓ compute.test.mjs : tous les tests passent`. Puis `npx tsc --noEmit` vert.

- [ ] **Step 5 : Commit**

```bash
git add frontend/lib/tax/compute.ts frontend/lib/tax/compute.test.mjs
git commit -m "feat(tax): fonctions pures dividendeNet/couponNet/rendementNet (TDD, bareme injectable)"
```

---

### Task 3 : Recherche et remplissage du barème (SOURCES OBLIGATOIRES)

**Files:** Modify `frontend/lib/tax/rates.ts` (le bloc `BAREME`)

- [ ] **Step 1 : Rechercher les taux, pays par pays (outil WebSearch/WebFetch)**

Requêtes types (répéter pour chaque pays) :
- `IRVM taux dividendes sociétés cotées BRVM Côte d'Ivoire code général des impôts`
- `fiscalité obligations régionales UEMOA retenue à la source intérêts <pays>`
- `note fiscalité BRVM SGI dividendes obligations <pays> 2025 2026`

**Sources acceptées** (ordre de préférence) : CGI/loi de finances du pays,
site DGI nationale, publications AMF-UMOA/BRVM, notes fiscales de SGI ou de
cabinets (PwC/EY/Deloitte tax guides). **Refusées** : forums, blogs sans
référence, souvenirs du modèle.

**Règles de remplissage** :
- Taux trouvé et daté → `taux` + `source` (texte de loi précis) + `sourceUrl` + `verifieLe` (aujourd'hui).
- Divergence entre sources → prendre le texte officiel le plus récent ; sinon laisser `null` avec `note` expliquant la divergence.
- Introuvable → laisser `NON_VERIFIE` (l'UI gère).
- Cas fréquents à documenter en `note` : exonérations des obligations d'État
  selon maturité, taux réduits pour sociétés cotées BRVM.

- [ ] **Step 2 : Typecheck + re-run des tests** — `npx tsc --noEmit` et `npx tsx lib/tax/compute.test.mjs` (les tests utilisent la fixture : ils restent verts quel que soit le barème réel).

- [ ] **Step 3 : Commit avec les sources dans le message**

```bash
git add frontend/lib/tax/rates.ts
git commit -m "feat(tax): bareme UEMOA renseigne avec sources officielles

<liste pays -> taux -> source, et pays laisses non confirmes avec raison>"
```

---

### Task 4 : DRY — `budgetSimulator.IRVM` dérive du barème

**Files:** Modify `frontend/lib/budgetSimulator.ts:14-15`

- [ ] **Step 1 : Remplacer**

```ts
/** Taux d'imposition des dividendes d'actions cotées (IRVM) — à confirmer. */
export const IRVM = 0.1;
```

par :

```ts
import { BAREME } from './tax/rates';

/**
 * Taux IRVM utilisé par le simulateur (approximation mono-taux : les émetteurs
 * BRVM sont majoritairement ivoiriens). Dérivé du barème sourcé ; repli 0.10
 * si le taux CI n'est pas encore confirmé.
 */
export const IRVM = BAREME.CI.dividende_cote.taux ?? 0.1;
```

- [ ] **Step 2 : Tests existants** — Run: `npx tsx lib/budgetSimulator.test.mjs` — Expected: verts (si le taux CI sourcé ≠ 0.10, adapter les assertions concernées du test en conséquence — les valeurs attendues du test doivent suivre le taux réel sourcé).

- [ ] **Step 3 : Commit** — `git commit -m "refactor(tax): IRVM du simulateur derive du bareme source (DRY)"`

---

### Task 5 : Page publique `/fiscalite` + câblages (footer, shell, palette)

**Files:** Create `frontend/components/tax/TaxCalculator.tsx`, Create `frontend/app/fiscalite/page.tsx`, Modify `frontend/components/ConditionalShell.tsx`, `frontend/components/Footer.tsx`, `frontend/lib/nav.ts`

- [ ] **Step 1 : Composant client `TaxCalculator.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { BAREME, PAYS_LABELS, type PaysUemoa, type TypeRevenu } from '@/lib/tax/rates';
import { dividendeNet, couponNet } from '@/lib/tax/compute';

const TYPES: { key: TypeRevenu; label: string }[] = [
  { key: 'dividende_cote', label: 'Dividende (société cotée)' },
  { key: 'obligation_etat', label: "Coupon — obligation d'État" },
  { key: 'obligation_privee', label: 'Coupon — obligation privée' },
];

const fcfa = (v: number) => v.toLocaleString('fr-FR') + ' FCFA';

export default function TaxCalculator() {
  const [brut, setBrut] = useState('100000');
  const [pays, setPays] = useState<PaysUemoa>('CI');
  const [type, setType] = useState<TypeRevenu>('dividende_cote');

  const montant = Number(brut.replace(/[^\d]/g, '')) || 0;
  const res =
    type === 'dividende_cote'
      ? dividendeNet(montant, pays)
      : couponNet(montant, pays, type);
  const regle = BAREME[pays][type];

  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs text-muted">Montant brut (FCFA)</span>
          <input
            inputMode="numeric"
            value={brut}
            onChange={(e) => setBrut(e.target.value)}
            aria-label="Montant brut en FCFA"
            className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 tabular text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted">Pays de l'émetteur</span>
          <select
            value={pays}
            onChange={(e) => setPays(e.target.value as PaysUemoa)}
            aria-label="Pays de l'émetteur"
            className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white"
          >
            {(Object.keys(PAYS_LABELS) as PaysUemoa[]).map((p) => (
              <option key={p} value={p}>{PAYS_LABELS[p]}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-muted">Type de revenu</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as TypeRevenu)}
            aria-label="Type de revenu"
            className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white"
          >
            {TYPES.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </label>
      </div>

      {res.indisponible ? (
        <p className="rounded-lg border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
          Taux non confirmé pour ce pays/type — consultez votre SGI.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3 text-center">
          <div className="rounded-lg border border-border bg-bg/40 p-3">
            <p className="text-xs text-muted">Retenue ({(res.taux * 100).toFixed(res.taux * 100 % 1 ? 1 : 0)} %)</p>
            <p className="tabular mt-1 text-lg text-down">−{fcfa(res.impot)}</p>
          </div>
          <div className="rounded-lg border border-up/30 bg-up/5 p-3 sm:col-span-2">
            <p className="text-xs text-muted">Net perçu</p>
            <p className="tabular mt-1 text-2xl font-semibold text-up">{fcfa(res.net)}</p>
          </div>
        </div>
      )}
      <p className="text-[11px] text-faint">Base : {regle.source}{regle.note ? ` — ${regle.note}` : ''} (vérifié le {regle.verifieLe}).</p>
    </div>
  );
}
```

- [ ] **Step 2 : Page serveur `app/fiscalite/page.tsx`**

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { BAREME, PAYS_LABELS, type PaysUemoa, type TypeRevenu } from '@/lib/tax/rates';
import TaxCalculator from '@/components/tax/TaxCalculator';
import { SectionHeader } from '@/components/ui/premium';

export const metadata: Metadata = {
  title: 'Fiscalité des dividendes et obligations BRVM (IRVM/IRC) — WESTBOURSE',
  description:
    "Calculez votre dividende net d'IRVM et vos coupons obligataires nets par pays UEMOA (Côte d'Ivoire, Sénégal, Bénin…). Barème sourcé, comparatif des 8 pays.",
};

const COLS: { key: TypeRevenu; label: string }[] = [
  { key: 'dividende_cote', label: 'Dividendes (cotés)' },
  { key: 'obligation_etat', label: "Oblig. d'État" },
  { key: 'obligation_privee', label: 'Oblig. privées' },
];

function fmtTaux(t: number | null): string {
  return t == null ? 'non confirmé' : `${(t * 100).toFixed(t * 100 % 1 ? 1 : 0)} %`;
}

const FAQ: { q: string; a: string }[] = [
  { q: "Qui prélève l'impôt sur mes dividendes BRVM ?", a: "L'IRVM est retenu à la source par l'émetteur (via sa banque centralisatrice) avant versement à votre SGI : vous recevez directement le montant net. Aucune démarche déclarative n'est en général nécessaire pour un résident UEMOA." },
  { q: 'Le taux dépend-il de mon pays de résidence ou de celui de la société ?', a: "Du pays de l'émetteur, où la retenue est opérée. Votre résidence fiscale peut ensuite jouer (conventions de non double imposition) — consultez un fiscaliste pour votre situation." },
  { q: 'Les plus-values de cession sont-elles imposées ?', a: 'Le régime des plus-values varie selon les pays et le statut (particulier/entreprise) et ne fait pas partie de ce comparatif. Renseignez-vous auprès de votre SGI.' },
  { q: 'Ces taux sont-ils garantis ?', a: 'Chaque taux affiché cite sa source officielle et sa date de vérification. Les lois de finances évoluent : cette page est une information générale, pas un conseil fiscal.' },
];

export default function FiscalitePage() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-4xl px-4 py-10 space-y-8">
        <SectionHeader
          kicker="UEMOA · IRVM & IRC"
          title="Fiscalité des dividendes et obligations BRVM"
          subtitle="Ce que vous touchez vraiment, net de retenue à la source, selon le pays de l'émetteur."
        />

        <TaxCalculator />

        <section className="space-y-3">
          <h2 className="font-display text-lg text-ivory">Comparatif des 8 pays UEMOA</h2>
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-3">Pays</th>
                  {COLS.map((c) => <th key={c.key} className="px-4 py-3 text-right">{c.label}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {(Object.keys(PAYS_LABELS) as PaysUemoa[]).map((p) => (
                  <tr key={p}>
                    <td className="px-4 py-2.5 font-medium text-ivory">{PAYS_LABELS[p]}</td>
                    {COLS.map((c) => {
                      const t = BAREME[p][c.key];
                      return (
                        <td key={c.key} className="tabular px-4 py-2.5 text-right" title={`${t.source}${t.note ? ` — ${t.note}` : ''}`}>
                          <span className={t.taux == null ? 'text-faint' : 'text-white'}>{fmtTaux(t.taux)}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-faint">Survolez un taux pour voir sa source. Les mentions « non confirmé » signalent l'absence de source officielle vérifiée — jamais un taux estimé.</p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg text-ivory">Questions fréquentes</h2>
          {FAQ.map((f) => (
            <details key={f.q} className="rounded-xl border border-border bg-surface px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-ivory">{f.q}</summary>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </section>

        <p className="rounded-xl border border-border bg-surface/60 px-4 py-3 text-xs text-muted">
          Information générale fondée sur les textes cités, à la date de vérification indiquée.
          Ne constitue pas un conseil fiscal. Consultez votre SGI ou un fiscaliste.
          Suivez vos revenus réels dans <Link href="/dividendes" className="text-accent underline underline-offset-2">l'espace Dividendes</Link>.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3 : Câblages**

Dans `ConditionalShell.tsx`, ajouter `'/fiscalite'` à `BARE_PREFIXES` (la page a
son propre layout public + footer via `showsFooter`).
Dans `Footer.tsx`, ajouter à la liste des liens (après Méthodologie) :
`{ href: '/fiscalite', label: 'Fiscalité UEMOA' },`
Dans `lib/nav.ts`, ajouter à `PALETTE_EXTRA` :
`{ href: '/fiscalite', label: 'Fiscalité des dividendes (IRVM)' },`

- [ ] **Step 4 : Vérifier** — `npx tsc --noEmit` vert ; `npm run dev` → http://localhost:3000/fiscalite affiche calculateur + tableau + FAQ + footer, sans sidebar.

- [ ] **Step 5 : Commit** — `git commit -m "feat(tax): page publique /fiscalite (calculateur, comparatif 8 pays, FAQ, SEO)"`

---

### Task 6 : Toggle Brut / Net sur `/dividendes`

**Files:** Modify `frontend/components/DividendsTable.tsx`

Le composant est client (tri par état) et ses lignes portent déjà `pays` et
`rendement_pct`.

- [ ] **Step 1 : Ajouter l'état + le bouton + le rendu net**

En haut du composant (à côté des états de tri existants) :

```tsx
import { rendementNet } from '@/lib/tax/compute';
import { toPaysUemoa } from '@/lib/tax/rates';

const [net, setNet] = useState(false);
```

Dans la barre d'outils au-dessus du tableau (à côté de l'export CSV existant) :

```tsx
<button
  type="button"
  onClick={() => setNet((v) => !v)}
  aria-pressed={net}
  className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
    net ? 'border-accent/40 bg-accent/10 text-accent' : 'border-border text-muted hover:text-white'
  }`}
>
  {net ? 'Net d’IRVM ✓' : 'Afficher net d’IRVM'}
</button>
```

Dans la cellule Rendement (celle qui affiche `row.rendement_pct.toFixed(2)`),
remplacer le rendu par :

```tsx
{(() => {
  if (row.rendement_pct == null) return '—';
  if (!net) return `${row.rendement_pct.toFixed(2)}%`;
  const p = toPaysUemoa(row.pays);
  const r = p ? rendementNet(row.rendement_pct, p, 'dividende_cote') : { indisponible: true as const };
  return r.indisponible ? `${row.rendement_pct.toFixed(2)}%*` : `${r.valeur.toFixed(2)}%`;
})()}
```

Sous le tableau, quand `net` est actif, afficher la légende :

```tsx
{net && (
  <p className="px-3 pb-2 text-[11px] text-faint">
    * taux non confirmé pour ce pays → rendement brut affiché.
    Net = brut × (1 − IRVM du pays de l'émetteur). <a href="/fiscalite" className="underline">Détails & sources</a>.
  </p>
)}
```

- [ ] **Step 2 : Onglet vers /fiscalite (spec §3.4)**

Dans `frontend/lib/viewTabsPresets.ts`, ajouter :

```ts
/** Espace Revenus : dividendes ↔ fiscalité. */
export const REVENUS_TABS: ViewTab[] = [
  { href: '/dividendes', label: 'Dividendes' },
  { href: '/fiscalite', label: 'Fiscalité (IRVM)' },
];
```

Dans `frontend/app/dividendes/page.tsx`, insérer sous le `SectionHeader` de la
page (imports : `ViewTabs` + `REVENUS_TABS`) :

```tsx
<ViewTabs tabs={REVENUS_TABS} current="/dividendes" />
```

- [ ] **Step 3 : Vérifier** — tsc vert ; sur `/dividendes`, le toggle bascule les valeurs et le tri par rendement reste sur le brut (comportement assumé V1 : le tri ne change pas avec le toggle).

- [ ] **Step 3 : Commit** — `git commit -m "feat(tax): toggle rendement brut/net d'IRVM sur /dividendes"`

---

### Task 7 : YTM net sur `/obligations`

**Files:** Modify `frontend/app/obligations/page.tsx`

- [ ] **Step 1 :** Dans la construction des lignes (là où `ytm` est calculé,
lignes ~24-49), ajouter le net. Le type d'émetteur : heuristique documentée —
code/désignation commençant par `TPCI`, `TPBJ`, `TPBF`, `TPSN`, `EOM`, `EOB`
ou contenant « ETAT »/« TRESOR » → `obligation_etat`, sinon `obligation_privee`.
Le pays vient de `brvm_instruments.pays` (déjà joint sur la page ; si absent
pour une ligne, YTM net = « — »).

```ts
import { rendementNet } from '@/lib/tax/compute';
import { toPaysUemoa } from '@/lib/tax/rates';

const isEtat = /^(TP|EO)[A-Z]{1,3}|ETAT|TRESOR/i.test(`${o.code} ${o.designation ?? ''}`);
const pays = toPaysUemoa(o.pays);
const ytmNetRes = ytm != null && pays
  ? rendementNet(ytm, pays, isEtat ? 'obligation_etat' : 'obligation_privee')
  : { indisponible: true as const };
const ytmNet = ytmNetRes.indisponible ? null : ytmNetRes.valeur;
```

- [ ] **Step 2 :** Ajouter la colonne « YTM net » dans l'en-tête et la ligne du
tableau, juste après la colonne YTM existante, rendu `ytmNet != null ?
ytmNet.toFixed(2) + '%' : '—'` en classe `tabular`, avec en pied de tableau la
note : « YTM net = après retenue sur coupons (IRVM/IRC du pays émetteur) —
approximation : la retenue s'applique aux coupons, pas au remboursement du
principal. <a href="/fiscalite">Sources</a>. »

- [ ] **Step 3 : Vérifier + commit** — tsc vert, page OK →
`git commit -m "feat(tax): colonne YTM net d'impot sur /obligations"`

---

### Task 8 : Dividende net sur la fiche action

**Files:** Modify `frontend/app/actions/[code]/page.tsx` (zone « Rendement dividende », ~l.270)

- [ ] **Step 1 :** Lire les lignes 255-300 du fichier pour localiser le bloc
métrique « Rendement dividende » exact, puis ajouter juste à côté (même style
de bloc métrique que ses voisins) :

```tsx
import { rendementNet } from '@/lib/tax/compute';
import { toPaysUemoa } from '@/lib/tax/rates';

// après le calcul du rendement brut existant :
const paysFiscal = toPaysUemoa(instrument?.pays);
const rendNet = rendementBrut != null && paysFiscal
  ? rendementNet(rendementBrut, paysFiscal, 'dividende_cote')
  : { indisponible: true as const };
```

Affichage : « Rendement net (pays) : X,XX % » si disponible, sinon rien
(pas de bloc vide). Adapter le nom de la variable brute à celui réellement
présent dans le fichier (le bloc l.270 la définit).

- [ ] **Step 2 : Vérifier + commit** — tsc vert →
`git commit -m "feat(tax): rendement dividende net sur la fiche action"`

---

### Task 9 : Vérification finale

- [ ] `cd frontend && npx tsc --noEmit` → 0 erreur.
- [ ] `npx tsx lib/tax/compute.test.mjs` et `npx tsx lib/budgetSimulator.test.mjs` → verts.
- [ ] `NODE_OPTIONS=--max-old-space-size=4096 npm run build` → `✓ Compiled successfully` (heap 4 Go requis en local).
- [ ] Contrôle visuel : `/fiscalite` (public, footer), `/dividendes` (toggle), `/obligations` (YTM net), fiche action.
- [ ] Push : `git push origin main` (le déploiement Vercel suit).
