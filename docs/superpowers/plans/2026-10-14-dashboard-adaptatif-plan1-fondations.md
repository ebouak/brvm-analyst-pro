# Tableau de bord adaptatif — Plan 1 : fondations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger le brief, ordonner les blocs du tableau de bord selon le profil (actif / débutant), et livrer les quatre modules de calcul purs et testés dont le Plan 2 (interface) aura besoin.

**Architecture:** Tout le calcul vit dans des fonctions pures de `frontend/lib/` (testées avec vitest) ; la page serveur `app/dashboard/page.tsx` ne fait que charger les données et appeler ces fonctions. Le profil est déduit des positions à chaque rendu, sans nouvelle colonne. Le Plan 1 n'ajoute AUCUN nouveau bloc visible : il change l'ordre des blocs existants et prépare les modules (`comprendre`, `liquidite`, `agenda`, `performanceJour`) que le Plan 2 affichera.

**Tech Stack:** Next.js 14 (App Router, composants serveur), TypeScript strict, Supabase JS (lecture sous RLS), vitest (`frontend/vitest.config.ts`, inclut `lib/**/*.test.ts`, alias `@` → `frontend/`).

**Spécification :** `docs/superpowers/specs/2026-10-14-dashboard-adaptatif-design.md`.

**Règles du dépôt à respecter :**
- Toutes les commandes se lancent dans `C:/Users/adego/wt/brvm-textes/frontend` (worktree hors OneDrive), branche `feat/dashboard-adaptatif`.
- **Ne jamais lancer `npm run build`** en local. Vérifier avec `npx vitest run …` et `npx tsc --noEmit` (ce dernier peut prendre plusieurs minutes : le lancer en arrière-plan).
- `fmtNumber` (`lib/format.ts`) formate en `fr-FR` avec des espaces insécables : dans les tests, construire les chaînes attendues avec `fmtNumber` / `fmtFcfa`, jamais à la main.

---

## Carte des fichiers

| Fichier | Rôle | Tâche |
|---|---|---|
| `frontend/lib/brief.ts` (modifié) | Formulation des variations, valeur échangée depuis le résumé de séance | 1 |
| `frontend/lib/brief.test.ts` (créé) | Tests du brief | 1 |
| `frontend/app/dashboard/page.tsx` (modifié) | Résumé de séance daté, appel du brief, profil, ordre des blocs | 2, 4 |
| `frontend/lib/dashboard/widgets.ts` (modifié) | Profil, deux ordres par défaut, `resolveLayout(saved, profil)` | 3 |
| `frontend/lib/dashboard/widgets.test.ts` (modifié) | Tests de l'ordre | 3 |
| `frontend/lib/dashboard/profil.ts` (créé) | Lecture serveur du nombre de positions → profil | 4 |
| `frontend/app/dashboard/personnaliser/page.tsx` (modifié) | Même ordre que le tableau de bord | 4 |
| `frontend/components/dashboard/DashboardCustomizer.tsx` (modifié) | Reçoit le profil | 4 |
| `frontend/lib/dashboard/comprendre.ts` + `.test.ts` (créés) | « Comprendre la séance » déterministe | 5 |
| `frontend/lib/dashboard/liquidite.ts` + `.test.ts` (créés) | Durée théorique d'écoulement | 6 |
| `frontend/lib/dashboard/agenda.ts` + `.test.ts` (créés) | Agenda 30 jours à statuts | 7 |
| `frontend/lib/dashboard/performanceJour.ts` + `.test.ts` (créés) | Performance du jour face à l'indice, même séance | 8 |

---

### Task 1 : Brief — variations sans double signe, valeur échangée de la bonne source

Contexte : `lib/brief.ts` écrit « recule de -0.26% » (le verbe porte déjà le sens, et le format n'est pas français) et « volume total de 0 FCFA (-100% vs séance précédente) » pendant la séance. Cause prouvée : la collecte en séance (brvm.org) n'écrit volontairement pas `valeur_echangee` (`scraper/src/persistence/repository.ts`, `lignesActions`), donc la somme des actions vaut 0 jusqu'à la clôture. Les « repères clés » lisent déjà `brvm_market_summary.valeur_transactions` : le brief doit lire la même source et se taire si elle manque.

**Files:**
- Modify: `frontend/lib/brief.ts`
- Create: `frontend/lib/brief.test.ts`

- [ ] **Step 1 : écrire les tests qui échouent**

Créer `frontend/lib/brief.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { generateBrief, type BriefInput } from './brief';
import { fmtNumber, fmtFcfa } from './format';
import type { ActionDaily, IndiceDaily } from './types';

const actions = [
  { code: 'A', variation_pct: 1, valeur_echangee: null },
  { code: 'B', variation_pct: -1, valeur_echangee: null },
  { code: 'C', variation_pct: -2, valeur_echangee: null },
] as unknown as ActionDaily[];
const brvm30 = (v: number, valeur = 263.47) => ({ code: 'BRVM30', valeur, variation_pct: v }) as unknown as IndiceDaily;

function entree(p: Partial<BriefInput>): BriefInput {
  return {
    date: '2026-10-12',
    indices: { brvm30: brvm30(-0.26), brvmc: null },
    actions,
    signals: [],
    valeurTransactions: 2_919_495_128,
    valeurTransactionsPrev: 2_956_520_400,
    topSectorPerfs: [],
    ...p,
  };
}

describe('generateBrief — variations', () => {
  it('« recule de 0,26 % » : le verbe porte le sens, la valeur est en absolu et au format français', () => {
    const s = generateBrief(entree({})).summary;
    expect(s).toContain(`recule de ${fmtNumber(0.26, 2)} %`);
    expect(s).not.toMatch(/-0\.26|−0,26/);
  });

  it('variation faible : « est stable (+0,15 %) », jamais « stagne à +0.15% à »', () => {
    const s = generateBrief(entree({ indices: { brvm30: brvm30(0.15), brvmc: null } })).summary;
    expect(s).toContain(`est stable (+${fmtNumber(0.15, 2)} %)`);
  });

  it('secteur en recul : « recule de 0,85 % », sans signe moins', () => {
    const r = generateBrief(entree({ topSectorPerfs: [{ secteur: 'Services publics', varPct: -0.85, count: 3 }] }));
    expect(r.sectors).toContain(`recule de ${fmtNumber(0.85, 2)} %`);
    expect(r.sectors).not.toContain('-0.85');
  });
});

describe('generateBrief — valeur échangée', () => {
  it('lit la valeur des transactions de la séance, avec l écart à la veille', () => {
    const s = generateBrief(entree({})).summary;
    const delta = (2_919_495_128 / 2_956_520_400 - 1) * 100;
    expect(s).toContain(`${fmtFcfa(2_919_495_128)} FCFA`);
    expect(s).toContain(`−${fmtNumber(Math.abs(delta), 1)} % sur la séance précédente`);
  });

  it('sans résumé de séance (séance en cours) : aucun « 0 FCFA », aucun « -100% »', () => {
    const s = generateBrief(entree({ valeurTransactions: null, valeurTransactionsPrev: null })).summary;
    expect(s).not.toContain('FCFA');
    expect(s).not.toContain('100');
  });

  it('sans valeur de la veille : la valeur du jour sans comparaison', () => {
    const s = generateBrief(entree({ valeurTransactionsPrev: null })).summary;
    expect(s).toContain(`${fmtFcfa(2_919_495_128)} FCFA`);
    expect(s).not.toContain('séance précédente');
  });
});
```

- [ ] **Step 2 : lancer les tests, constater l'échec**

Run : `npx vitest run lib/brief.test.ts`
Expected : FAIL (propriétés `valeurTransactions` inconnues, chaînes non trouvées).

- [ ] **Step 3 : implémenter**

Dans `frontend/lib/brief.ts` :

1. Remplacer, dans `BriefInput`, la ligne
   `  volumePrev: number | null; // valeur échangée séance précédente (FCFA)`
   par :
```ts
  /** Valeur des transactions de la séance (brvm_market_summary), null si inconnue. */
  valeurTransactions: number | null;
  /** Même mesure pour la séance précédente, null si inconnue. */
  valeurTransactionsPrev: number | null;
```

2. Remplacer les fonctions `motVariation` et `fmtVar` (section « Internal helpers ») par :
```ts
/** Variation signée au format français : « +1,95 % », « −0,26 % ». */
function pctSigne(v: number, d = 2): string {
  const s = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${s}${fmtNumber(Math.abs(v), d)} %`;
}

/** Valeur absolue, pour les phrases dont le verbe porte déjà le sens. */
function pctAbs(v: number, d = 2): string {
  return `${fmtNumber(Math.abs(v), d)} %`;
}

/** « L'indice BRVM 30 recule de 0,26 % à 263,47 points » — jamais « recule de -0.26% ». */
function phraseIndice(sujet: string, v: number, valeur: number): string {
  if (Math.abs(v) < 0.2) return `${sujet} est stable (${pctSigne(v)}) à ${fmtNumber(valeur, 2)} points`;
  const verbe = v > 1 ? 'progresse nettement de' : v > 0 ? 'progresse de' : v < -1 ? 'recule nettement de' : 'recule de';
  return `${sujet} ${verbe} ${pctAbs(v)} à ${fmtNumber(valeur, 2)} points`;
}
```

3. Dans `buildSummary`, remplacer la ligne `const { indices, actions, volumePrev } = input;` par `const { indices, actions } = input;`, supprimer `let volumeTotal = 0;` et la ligne `volumeTotal += a.valeur_echangee ?? 0;`, puis remplacer tout le bloc qui va de `// Indice BRVM30` jusqu'à la fin du `if (parts.length > 0) { … } else { … }` (avant `// Breadth`) par :
```ts
  // Valeur échangée : MÊME source que les repères clés (brvm_market_summary).
  // Pendant la séance, les lignes d'actions n'ont pas encore de valeur
  // échangée (la collecte brvm.org ne la porte pas) : les additionner
  // affichait « 0 FCFA (-100 %) ». Sans résumé de séance, on se tait.
  const { valeurTransactions, valeurTransactionsPrev } = input;
  let volumePart: string | null = null;
  if (valeurTransactions != null && valeurTransactions > 0) {
    volumePart = `dans un volume total de ${fmtFcfa(valeurTransactions)} FCFA`;
    if (valeurTransactionsPrev != null && valeurTransactionsPrev > 0) {
      const delta = ((valeurTransactions - valeurTransactionsPrev) / valeurTransactionsPrev) * 100;
      volumePart += ` (${pctSigne(delta, 1)} sur la séance précédente)`;
    }
  }

  if (brvm30?.valeur != null && brvm30.variation_pct != null) {
    const p = phraseIndice("L'indice BRVM 30", brvm30.variation_pct, brvm30.valeur);
    parts.push(volumePart ? `${p}, ${volumePart}.` : `${p}.`);
  } else if (volumePart) {
    parts.push(`Séance conclue ${volumePart}.`);
  }
```

4. Dans `buildSectors` : ligne `Le secteur ${best.secteur} tire la cotation avec une performance de ${fmtVar(best.varPct)}` → remplacer `fmtVar(best.varPct)` par `pctSigne(best.varPct)` ; `mené par ${best.leader} (${fmtVar(best.leaderVar)})` → `pctSigne(best.leaderVar)` ; `le secteur ${worst.secteur} recule de ${fmtVar(worst.varPct)}` → `pctAbs(worst.varPct)` ; `sous l'effet de ${worst.leader} (${fmtVar(worst.leaderVar)})` → `pctSigne(worst.leaderVar)`.

5. Dans `buildSignals` : `une hausse de ${fmtVar(a.variation_pct ?? 0)} ce jour` → `une hausse de ${pctAbs(a.variation_pct ?? 0)} ce jour`.

6. Vérifier qu'il ne reste aucun `fmtVar` ni `motVariation` : `grep -n "fmtVar\|motVariation" lib/brief.ts` → aucune sortie.

- [ ] **Step 4 : relancer les tests**

Run : `npx vitest run lib/brief.test.ts`
Expected : PASS (6 tests).

- [ ] **Step 5 : commit**

```bash
git add lib/brief.ts lib/brief.test.ts
git commit -m "fix(brief): variations sans double signe et valeur échangée lue au résumé de séance

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2 : Page — résumé de séance daté et passé au brief

Contexte : la page lit les DEUX derniers résumés (`brvm_market_summary`, `limit(2)`), sans vérifier qu'ils portent sur `lastDate` et `prevDate` ; et le brief reçoit encore `volumePrev`. On lit les résumés de CES séances-là.

**Files:**
- Modify: `frontend/app/dashboard/page.tsx` (fonction `getData`)

- [ ] **Step 1 : charger les résumés de `lastDate` et `prevDate` avant le brief**

Dans `getData`, remplacer le `Promise.all` qui charge `actions, indices, signals, prevActions` par :
```ts
  const [{ data: actions }, { data: indices }, { data: signals }, { data: prevActions }, { data: summaryRows }] =
    await Promise.all([
      supabase.from('brvm_actions_daily').select('*').eq('date_marche', lastDate),
      supabase.from('brvm_indices_daily').select('*').eq('date_marche', lastIdxDate),
      supabase
        .from('signals_daily')
        .select('code, signal, confiance, explication, score_total, date_marche')
        .eq('date_marche', lastDate)
        .neq('signal', 'HOLD')
        .order('confiance', { ascending: false })
        .limit(6),
      prevDate
        ? supabase
            .from('brvm_actions_daily')
            .select('valeur_echangee, variation_pct')
            .eq('date_marche', prevDate)
        : Promise.resolve({ data: [] }),
      // Résumés de CES deux séances (et non « les deux derniers ») : un résumé
      // d'une autre séance comparé aux cours du jour serait incohérent.
      supabase
        .from('brvm_market_summary')
        .select('date_marche, valeur_transactions, capitalisation_actions, capitalisation_obligations')
        .in('date_marche', prevDate ? [lastDate, prevDate] : [lastDate]),
    ]);
  const resumes = (summaryRows ?? []) as MarketSummaryRow[];
  const summary = resumes.find((r) => r.date_marche === lastDate) ?? null;
  const summaryPrev = prevDate ? resumes.find((r) => r.date_marche === prevDate) ?? null : null;
```

- [ ] **Step 2 : passer la valeur des transactions au brief**

Dans l'appel `generateBrief({ … })`, remplacer `volumePrev: prevValeur,` par :
```ts
    valeurTransactions: summary?.valeur_transactions ?? null,
    valeurTransactionsPrev: summaryPrev?.valeur_transactions ?? null,
```

- [ ] **Step 3 : supprimer l'ancienne lecture des résumés**

Supprimer le bloc qui commence par `// Totaux de séance réels (valeur des transactions, capitalisations) — 2 dernières pour le delta` et se termine par `const summaryPrev = (summaryRows?.[1] ?? null) as MarketSummaryRow | null;`. Les variables `summary` et `summaryPrev` sont désormais définies à l'étape 1 et restent renvoyées par `getData` (le `return` n'est pas modifié). `prevValeur` reste calculé et renvoyé : il sert encore à `MarketStateCard`.

- [ ] **Step 4 : vérifier les types**

Run (en arrière-plan, plusieurs minutes) : `npx tsc --noEmit`
Expected : code 0, aucune sortie. `MarketSummaryRow` est une interface : déclarée plus bas dans le fichier, elle reste utilisable dans `getData`.

- [ ] **Step 5 : commit**

```bash
git add app/dashboard/page.tsx
git commit -m "fix(dashboard): résumé de séance lu pour la séance affichée et transmis au brief

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3 : Ordre des blocs selon le profil (fonction pure)

**Files:**
- Modify: `frontend/lib/dashboard/widgets.ts`
- Modify: `frontend/lib/dashboard/widgets.test.ts`

- [ ] **Step 1 : écrire les tests qui échouent**

Remplacer la ligne 2 de `frontend/lib/dashboard/widgets.test.ts` par
`import { resolveLayout, DEFAULT_ORDER, ORDRE_ACTIF, ORDRE_DEBUTANT, deduireProfil, ordreParDefaut } from './widgets';`
puis ajouter à la fin du fichier :
```ts
describe('profil', () => {
  it('au moins une position → actif ; aucune → débutant', () => {
    expect(deduireProfil(1)).toBe('actif');
    expect(deduireProfil(12)).toBe('actif');
    expect(deduireProfil(0)).toBe('debutant');
  });

  it('sans layout sauvegardé, l ordre dépend du profil', () => {
    expect(resolveLayout(null, 'actif')).toEqual(ORDRE_ACTIF);
    expect(resolveLayout(null, 'debutant')).toEqual(ORDRE_DEBUTANT);
    expect(resolveLayout(null, 'actif')[0]).toBe('portefeuille');
    expect(resolveLayout(null, 'debutant')[0]).toBe('etat');
  });

  it('un layout sauvegardé l emporte toujours sur le profil', () => {
    const r = resolveLayout({ order: ['actus', 'portefeuille'] }, 'debutant');
    expect(r[0]).toBe('actus');
    expect(r[1]).toBe('portefeuille');
  });

  it('les deux ordres contiennent exactement les mêmes blocs', () => {
    expect([...ORDRE_ACTIF].sort()).toEqual([...ORDRE_DEBUTANT].sort());
    expect(ordreParDefaut('actif')).toEqual(ORDRE_ACTIF);
  });

  it('sans profil précisé : ordre débutant (comportement historique)', () => {
    expect(resolveLayout(null)).toEqual(DEFAULT_ORDER);
    expect(DEFAULT_ORDER).toEqual(ORDRE_DEBUTANT);
  });
});
```

- [ ] **Step 2 : lancer, constater l'échec**

Run : `npx vitest run lib/dashboard/widgets.test.ts`
Expected : FAIL (`ORDRE_ACTIF`, `deduireProfil`, `ordreParDefaut` non exportés).

- [ ] **Step 3 : implémenter**

Dans `frontend/lib/dashboard/widgets.ts`, remplacer la ligne
`export const DEFAULT_ORDER: WidgetKey[] = WIDGETS.map((w) => w.key);`
par :
```ts
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
export const DEFAULT_ORDER: WidgetKey[] = ORDRE_DEBUTANT;

export function ordreParDefaut(profil: Profil): WidgetKey[] {
  return profil === 'actif' ? ORDRE_ACTIF : ORDRE_DEBUTANT;
}
```

Puis remplacer la fonction `resolveLayout` par :
```ts
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
  const merged = [...savedOrder, ...defaut.filter((k) => !seen.has(k))];
  return merged.filter((k) => !hidden.has(k)) as WidgetKey[];
}
```
La ligne `const VALID = new Set<string>(DEFAULT_ORDER);` reste valable (même ensemble de clés) ; elle doit rester APRÈS la déclaration de `DEFAULT_ORDER`.

- [ ] **Step 4 : relancer**

Run : `npx vitest run lib/dashboard/widgets.test.ts`
Expected : PASS (4 tests existants + 5 nouveaux).

- [ ] **Step 5 : commit**

```bash
git add lib/dashboard/widgets.ts lib/dashboard/widgets.test.ts
git commit -m "feat(dashboard): ordre des blocs selon le profil, layout sauvegardé prioritaire

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4 : Brancher le profil (tableau de bord + personnalisation)

**Files:**
- Create: `frontend/lib/dashboard/profil.ts`
- Modify: `frontend/app/dashboard/page.tsx`
- Modify: `frontend/app/dashboard/personnaliser/page.tsx`
- Modify: `frontend/components/dashboard/DashboardCustomizer.tsx`

- [ ] **Step 1 : créer la lecture du profil**

Créer `frontend/lib/dashboard/profil.ts` :
```ts
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { deduireProfil, type Profil } from './widgets';

/**
 * Profil de l'utilisateur, déduit de ses positions (spec §2) : au moins une
 * ligne de `portfolios_positions` avec `quantite > 0`, hors ligne de
 * liquidités. Lecture sous RLS avec la session de l'utilisateur.
 * En cas d'erreur de lecture : 'debutant' — l'ordre par défaut historique,
 * qui ne cache rien (le portefeuille reste présent, plus bas).
 */
export async function chargerProfil(sb: SupabaseClient, userId: string | null): Promise<Profil> {
  if (!userId) return 'debutant';
  const { count, error } = await sb
    .from('portfolios_positions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gt('quantite', 0)
    .neq('code', LIQUIDITES_CODE); // CORRIGÉ en exécution (ec1d23a) : is_liquidites n'existe pas dans cette table
  if (error) return 'debutant';
  return deduireProfil(count ?? 0);
}
```

- [ ] **Step 2 : tableau de bord**

Dans `frontend/app/dashboard/page.tsx` :
- ajouter l'import `import { chargerProfil } from '@/lib/dashboard/profil';` et compléter l'import de widgets en `import { resolveLayout, type WidgetKey, type DashboardLayout, type Profil } from '@/lib/dashboard/widgets';` ;
- juste après `let triggeredAlerts = 0;` ajouter `let profil: Profil = 'debutant';` ;
- dans le bloc `if (user) { … }`, après le calcul de `triggeredAlerts`, ajouter `profil = await chargerProfil(supa, user.id);` ;
- remplacer `const layout = resolveLayout(dashboardLayout);` par `const layout = resolveLayout(dashboardLayout, profil);`.

- [ ] **Step 3 : personnalisation — même ordre que le tableau de bord**

Dans `frontend/app/dashboard/personnaliser/page.tsx` :
- ajouter `import { chargerProfil } from '@/lib/dashboard/profil';` ;
- après la ligne qui calcule `layout`, ajouter `const profil = await chargerProfil(sb, user.id);` ;
- remplacer `<DashboardCustomizer initial={layout} />` par `<DashboardCustomizer initial={layout} profil={profil} />`.

Dans `frontend/components/dashboard/DashboardCustomizer.tsx` :
- import : `import { WIDGETS, ordreParDefaut, resolveLayout, type WidgetKey, type DashboardLayout, type Profil } from '@/lib/dashboard/widgets';` (retirer `DEFAULT_ORDER`) ;
- signature : `export default function DashboardCustomizer({ initial, profil }: { initial: DashboardLayout | null; profil: Profil }) {` ;
- `const initialVisible = resolveLayout(initial, profil);` ;
- `const initialHidden = ordreParDefaut(profil).filter((k) => !initialVisible.includes(k));` ;
- remplacer toute autre occurrence de `DEFAULT_ORDER` dans ce fichier par `ordreParDefaut(profil)` (contrôle : `grep -n DEFAULT_ORDER components/dashboard/DashboardCustomizer.tsx` ne renvoie rien).

- [ ] **Step 4 : vérifier les types**

Run (arrière-plan) : `npx tsc --noEmit`
Expected : code 0.

- [ ] **Step 5 : commit**

```bash
git add lib/dashboard/profil.ts app/dashboard/page.tsx app/dashboard/personnaliser/page.tsx components/dashboard/DashboardCustomizer.tsx
git commit -m "feat(dashboard): profil déduit des positions, appliqué au tableau de bord et à la personnalisation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5 : `comprendre` — la séance en mots simples (pur)

**Files:**
- Create: `frontend/lib/dashboard/comprendre.ts`
- Create: `frontend/lib/dashboard/comprendre.test.ts`

- [ ] **Step 1 : écrire les tests qui échouent** (séance réelle du 12/10/2026)

```ts
import { describe, it, expect } from 'vitest';
import { comprendreSeance, type MetriquesSeance } from './comprendre';
import { fmtNumber, fmtFcfa } from '@/lib/format';

const seance: MetriquesSeance = {
  dateMarche: '2026-10-12',
  hausses: 15, baisses: 22, stables: 11,
  composite: { valeur: 545.46, variationPct: -0.26 },
  secteurMeneur: { nom: 'Industriels', variationPct: 1.95 },
  valeurEchangee: 2_919_495_128, valeurEchangeeVeille: 2_956_520_400,
  plusEchangee: { code: 'STBC', nom: 'SITAB CI', valeur: 894_433_710 },
};

describe('comprendreSeance', () => {
  it('cinq constats, chacun avec son explication', () => {
    const c = comprendreSeance(seance);
    expect(c.map((x) => x.id)).toEqual(['largeur', 'composite', 'secteur', 'activite', 'vedette']);
    for (const x of c) expect(x.sens.length).toBeGreaterThan(20);
  });

  it('largeur : nombres exacts et accords', () => {
    expect(comprendreSeance(seance)[0]!.texte).toBe('22 valeurs ont baissé, 15 ont monté et 11 sont restées stables.');
  });

  it('composite : le verbe porte le sens, la variation est en absolu', () => {
    const t = comprendreSeance(seance).find((x) => x.id === 'composite')!.texte;
    expect(t).toBe(`Le BRVM Composite a reculé de ${fmtNumber(0.26, 2)} % à ${fmtNumber(545.46, 2)} points.`);
  });

  it('activité : valeur et écart à la veille, arrondis comme les panneaux', () => {
    const t = comprendreSeance(seance).find((x) => x.id === 'activite')!.texte;
    const d = Math.abs((2_919_495_128 / 2_956_520_400 - 1) * 100);
    expect(t).toBe(`${fmtFcfa(2_919_495_128)} FCFA ont été échangés, en baisse de ${fmtNumber(d, 1)} % sur la séance précédente.`);
  });

  it('une métrique manquante supprime la phrase, jamais un zéro', () => {
    const c = comprendreSeance({ ...seance, composite: null, valeurEchangee: null });
    expect(c.map((x) => x.id)).toEqual(['largeur', 'secteur', 'vedette']);
    expect(c.map((x) => x.texte).join(' ')).not.toMatch(/\b0 FCFA|\b0 %/);
  });

  it('secteur tous en baisse : « a le mieux résisté »', () => {
    const t = comprendreSeance({ ...seance, secteurMeneur: { nom: 'Énergie', variationPct: -0.1 } })
      .find((x) => x.id === 'secteur')!.texte;
    expect(t).toBe(`Le secteur Énergie a le mieux résisté (−${fmtNumber(0.1, 2)} %).`);
  });

  it('aucun conseil ni prédiction', () => {
    const tout = comprendreSeance(seance).map((x) => `${x.texte} ${x.sens}`).join(' ');
    expect(tout).not.toMatch(/achet|vend[rez]|conseil|devrai|va (monter|baisser)|opportunit/i);
  });
});
```

- [ ] **Step 2 : lancer, constater l'échec**

Run : `npx vitest run lib/dashboard/comprendre.test.ts`
Expected : FAIL (module introuvable).

- [ ] **Step 3 : implémenter** — créer `frontend/lib/dashboard/comprendre.ts` :

```ts
/**
 * « Comprendre la séance » — module PUR et testé (spec §4.4).
 *
 * Constats DÉTERMINISTES, sans modèle de langage : chaque phrase est bâtie sur
 * une métrique nommée de l'entrée, et n'existe que si cette métrique existe.
 * Une donnée manquante supprime la phrase ; elle ne devient jamais 0.
 * Formulations neutres, au passé, sans cause affirmée, sans conseil.
 */
import { fmtNumber, fmtFcfa } from '@/lib/format';

export interface MetriquesSeance {
  dateMarche: string;
  hausses: number | null;
  baisses: number | null;
  stables: number | null;
  composite: { valeur: number; variationPct: number } | null;
  secteurMeneur: { nom: string; variationPct: number } | null;
  valeurEchangee: number | null;
  valeurEchangeeVeille: number | null;
  plusEchangee: { code: string; nom: string; valeur: number } | null;
}

export interface Constat {
  id: 'largeur' | 'composite' | 'secteur' | 'activite' | 'vedette';
  texte: string;
  sens: string;
}

const pctAbs = (v: number, d = 2) => `${fmtNumber(Math.abs(v), d)} %`;
const pctSigne = (v: number, d = 2) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${pctAbs(v, d)}`;

export function comprendreSeance(m: MetriquesSeance): Constat[] {
  const out: Constat[] = [];

  if (m.hausses != null && m.baisses != null && m.stables != null) {
    const qui =
      m.baisses > m.hausses ? 'ici, la baisse a été plus répandue que la hausse'
      : m.hausses > m.baisses ? 'ici, la hausse a été plus répandue que la baisse'
      : 'ici, hausses et baisses se sont équilibrées';
    out.push({
      id: 'largeur',
      texte:
        `${m.baisses} valeur${m.baisses > 1 ? 's ont' : ' a'} baissé, ` +
        `${m.hausses} ${m.hausses > 1 ? 'ont' : 'a'} monté et ` +
        `${m.stables} ${m.stables > 1 ? 'sont restées stables' : 'est restée stable'}.`,
      sens: `La largeur du marché dit si un mouvement est général ou limité à quelques titres : ${qui}.`,
    });
  }

  if (m.composite) {
    const { valeur, variationPct: v } = m.composite;
    out.push({
      id: 'composite',
      texte:
        Math.abs(v) < 0.2
          ? `Le BRVM Composite est resté quasi stable (${pctSigne(v)}) à ${fmtNumber(valeur, 2)} points.`
          : `Le BRVM Composite a ${v > 0 ? 'progressé' : 'reculé'} de ${pctAbs(v)} à ${fmtNumber(valeur, 2)} points.`,
      sens: "L'indice résume l'ensemble des actions cotées, pondérées par leur taille : une faible variation peut cacher de forts écarts entre valeurs.",
    });
  }

  if (m.secteurMeneur) {
    const { nom, variationPct: v } = m.secteurMeneur;
    out.push({
      id: 'secteur',
      texte: v > 0 ? `Le secteur ${nom} a le plus progressé (${pctSigne(v)}).` : `Le secteur ${nom} a le mieux résisté (${pctSigne(v)}).`,
      sens: 'Les indices sectoriels montrent dans quelle partie de la cote se concentrent les mouvements.',
    });
  }

  if (m.valeurEchangee != null && m.valeurEchangee > 0) {
    let texte = `${fmtFcfa(m.valeurEchangee)} FCFA ont été échangés`;
    if (m.valeurEchangeeVeille != null && m.valeurEchangeeVeille > 0) {
      const d = (m.valeurEchangee / m.valeurEchangeeVeille - 1) * 100;
      texte += Math.abs(d) < 0.05
        ? ', autant que la séance précédente'
        : `, en ${d > 0 ? 'hausse' : 'baisse'} de ${pctAbs(d, 1)} sur la séance précédente`;
    }
    out.push({
      id: 'activite',
      texte: `${texte}.`,
      sens: "La valeur échangée mesure l'activité de la séance, indépendamment du sens des cours.",
    });
  }

  if (m.plusEchangee) {
    out.push({
      id: 'vedette',
      texte: `La valeur la plus échangée a été ${m.plusEchangee.nom} (${m.plusEchangee.code}), avec ${fmtFcfa(m.plusEchangee.valeur)} FCFA.`,
      sens: "Une forte activité sur un titre ne dit pas s'il est cher ou bon marché.",
    });
  }

  return out;
}
```

- [ ] **Step 4 : relancer**

Run : `npx vitest run lib/dashboard/comprendre.test.ts`
Expected : PASS (7 tests).

- [ ] **Step 5 : commit**

```bash
git add lib/dashboard/comprendre.ts lib/dashboard/comprendre.test.ts
git commit -m "feat(dashboard): comprendre la séance — constats déterministes testés

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6 : `liquidite` — durée théorique indicative (pur)

**Files:**
- Create: `frontend/lib/dashboard/liquidite.ts`
- Create: `frontend/lib/dashboard/liquidite.test.ts`

- [ ] **Step 1 : tests qui échouent**

```ts
import { describe, it, expect } from 'vitest';
import { dureeTheorique, PARTICIPATION_VOLUME, SEUIL_ALERTE_SEANCES } from './liquidite';

describe('dureeTheorique', () => {
  it('participation de 20 % par défaut, documentée', () => {
    expect(PARTICIPATION_VOLUME).toBe(0.2);
    expect(SEUIL_ALERTE_SEANCES).toBe(20);
  });

  it('petite position sur une valeur liquide : 1 séance au minimum', () => {
    // 4 498 000 / (325 000 000 × 0,2) = 0,07
    expect(dureeTheorique(4_498_000, 325_000_000)).toEqual({ seances: 1, alerte: false });
  });

  it('arrondi à la séance supérieure, alerte au-delà de 20 séances', () => {
    // 50 M / (8 M × 0,2) = 31,25 → 32
    expect(dureeTheorique(50_000_000, 8_000_000)).toEqual({ seances: 32, alerte: true });
  });

  it('valeur moyenne absente ou nulle : non mesurée, jamais 0', () => {
    expect(dureeTheorique(1_000_000, null)).toEqual({ seances: null, alerte: false });
    expect(dureeTheorique(1_000_000, 0)).toEqual({ seances: null, alerte: false });
  });

  it('position nulle ou absente : non mesurée', () => {
    expect(dureeTheorique(0, 8_000_000)).toEqual({ seances: null, alerte: false });
    expect(dureeTheorique(null, 8_000_000)).toEqual({ seances: null, alerte: false });
  });
});
```

- [ ] **Step 2 : lancer, constater l'échec** — `npx vitest run lib/dashboard/liquidite.test.ts` → FAIL (module introuvable).

- [ ] **Step 3 : implémenter** — créer `frontend/lib/dashboard/liquidite.ts` :

```ts
/**
 * Durée THÉORIQUE INDICATIVE pour écouler une position (spec §4.3).
 *
 * Supposer qu'on absorbe 100 % des échanges quotidiens serait irréaliste sur
 * un marché étroit : on suppose que les ventes représentent une part
 * PARTICIPATION_VOLUME des échanges moyens. Ce n'est PAS une garantie
 * d'exécution, et l'interface doit le dire.
 */
export const PARTICIPATION_VOLUME = 0.2;
export const SEUIL_ALERTE_SEANCES = 20;

export interface DureeEcoulement {
  /** Séances nécessaires, arrondies au-dessus ; null si non mesurable. */
  seances: number | null;
  /** Vrai au-delà de SEUIL_ALERTE_SEANCES. */
  alerte: boolean;
}

export function dureeTheorique(
  valeurPosition: number | null,
  valeurMoyenne30j: number | null,
  participation: number = PARTICIPATION_VOLUME,
): DureeEcoulement {
  if (valeurPosition == null || valeurPosition <= 0 || valeurMoyenne30j == null || valeurMoyenne30j <= 0) {
    return { seances: null, alerte: false };
  }
  const seances = Math.max(1, Math.ceil(valeurPosition / (valeurMoyenne30j * participation)));
  return { seances, alerte: seances > SEUIL_ALERTE_SEANCES };
}
```

- [ ] **Step 4 : relancer** — `npx vitest run lib/dashboard/liquidite.test.ts` → PASS (5 tests).

- [ ] **Step 5 : commit**

```bash
git add lib/dashboard/liquidite.ts lib/dashboard/liquidite.test.ts
git commit -m "feat(dashboard): durée théorique d'écoulement avec taux de participation de 20 %

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7 : `agenda` — 30 jours, statuts officiel / annoncé / fermeture (pur)

**Files:**
- Create: `frontend/lib/dashboard/agenda.ts`
- Create: `frontend/lib/dashboard/agenda.test.ts`

- [ ] **Step 1 : tests qui échouent**

```ts
import { describe, it, expect } from 'vitest';
import { construireAgenda, type DividendeSource } from './agenda';

const div = (p: Partial<DividendeSource> & { code: string }): DividendeSource => ({
  montant: 100, ex_date: null, payment_date: null, base_fiscale: null, source: 'richbourse', ...p,
});

const base = {
  aujourdhui: '2026-10-14',
  dividendes: [
    div({ code: 'PRSC', montant: 183.92, ex_date: '2026-10-22', payment_date: '2026-10-23' }),
    div({ code: 'SDSC', montant: 92, ex_date: '2026-10-26', payment_date: '2026-10-27', base_fiscale: 'net' }),
    div({ code: 'SNTS', montant: 1740, payment_date: '2026-05-26', source: 'brvm-boc' }), // passé : exclu
    div({ code: 'XXXX', montant: 50, payment_date: '2026-12-31' }), // hors 30 jours : exclu
  ],
  assemblees: [{ code: 'ETIT', event_date: '2026-10-30', title: 'Assemblée générale ordinaire - ETI TG', source: 'bdfin' }],
  fermetures: [{ date: '2026-11-03', holiday_name: 'Jour férié' }],
  positions: [{ code: 'SDSC', quantite: 100 }],
};

describe('construireAgenda', () => {
  it('fenêtre de 30 jours, passé et lointain exclus', () => {
    const codes = construireAgenda(base).map((i) => i.code);
    expect(codes).not.toContain('SNTS');
    expect(codes).not.toContain('XXXX');
  });

  it('mes valeurs d abord, puis l ordre chronologique', () => {
    const a = construireAgenda(base);
    expect(a[0]!.code).toBe('SDSC');
    expect(a[1]!.code).toBe('SDSC');
    expect(a.slice(2).map((i) => i.date)).toEqual(['2026-10-22', '2026-10-23', '2026-10-30', '2026-11-03']);
  });

  it('dividende par action et total indicatif distincts ; base fiscale reprise telle quelle', () => {
    const sdsc = construireAgenda(base).find((i) => i.code === 'SDSC' && i.type === 'paiement')!;
    expect(sdsc.parAction).toBe(92);
    expect(sdsc.totalIndicatif).toBe(9200);
    expect(sdsc.baseFiscale).toBe('net');
    const prsc = construireAgenda(base).find((i) => i.code === 'PRSC' && i.type === 'paiement')!;
    expect(prsc.totalIndicatif).toBeNull(); // pas détenue
    expect(prsc.baseFiscale).toBe('inconnue');
  });

  it('statuts : détachement toujours annoncé ; paiement officiel seulement au Bulletin ; AG BDFIN officielle', () => {
    const a = construireAgenda({
      ...base,
      dividendes: [div({ code: 'SGBC', montant: 2298.75, ex_date: '2026-10-20', payment_date: '2026-10-25', source: 'brvm-boc' })],
    });
    expect(a.find((i) => i.type === 'detachement')!.statut).toBe('annonce');
    expect(a.find((i) => i.type === 'paiement')!.statut).toBe('officiel');
    expect(a.find((i) => i.type === 'assemblee')!.statut).toBe('officiel');
    expect(a.find((i) => i.type === 'fermeture')!.statut).toBe('fermeture');
  });

  it('dividende sans montant positif : ignoré (jamais 0)', () => {
    const a = construireAgenda({ ...base, dividendes: [div({ code: 'ZZZ', montant: 0, payment_date: '2026-10-20' })] });
    expect(a.map((i) => i.code)).not.toContain('ZZZ');
  });
});
```

- [ ] **Step 2 : lancer, constater l'échec** — `npx vitest run lib/dashboard/agenda.test.ts` → FAIL.

- [ ] **Step 3 : implémenter** — créer `frontend/lib/dashboard/agenda.ts` :

```ts
/**
 * Agenda des 30 prochains jours — module PUR et testé (spec §4.1).
 *
 * Statuts, dans la forme : `officiel` (paiement lu au Bulletin officiel
 * `brvm-boc`, ou AG publiée sur BDFIN), `annonce` (source tierce ; toutes les
 * dates de détachement, qu'aucune source officielle ne publie), `fermeture`
 * (jour non ouvré du calendrier de marché). Aucune date estimée par nous.
 * Dividende PAR ACTION et TOTAL INDICATIF (quantité détenue aujourd'hui) sont
 * distincts ; la quantité éligible réelle est celle du jour de détachement.
 */
export const HORIZON_JOURS = 30;

export type TypeAgenda = 'detachement' | 'paiement' | 'assemblee' | 'fermeture';
export type StatutAgenda = 'officiel' | 'annonce' | 'fermeture';

export interface DividendeSource {
  code: string;
  montant: number | null;
  ex_date: string | null;
  payment_date: string | null;
  base_fiscale: string | null;
  source: string | null;
}
export interface AssembleeSource { code: string | null; event_date: string; title: string; source: string | null }
export interface FermetureSource { date: string; holiday_name: string | null }
export interface PositionAgenda { code: string; quantite: number }

export interface ItemAgenda {
  date: string;
  type: TypeAgenda;
  statut: StatutAgenda;
  code: string | null;
  titre: string;
  parAction: number | null;
  totalIndicatif: number | null;
  baseFiscale: 'net' | 'brut' | 'inconnue';
  mienne: boolean;
  source: string | null;
}

function plusJours(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function construireAgenda(e: {
  aujourdhui: string;
  dividendes: DividendeSource[];
  assemblees: AssembleeSource[];
  fermetures: FermetureSource[];
  positions: PositionAgenda[];
}): ItemAgenda[] {
  const fin = plusJours(e.aujourdhui, HORIZON_JOURS);
  const dansFenetre = (d: string | null): d is string => d != null && d >= e.aujourdhui && d <= fin;
  const qte = new Map(e.positions.filter((p) => p.quantite > 0).map((p) => [p.code, p.quantite]));
  const items: ItemAgenda[] = [];

  for (const dv of e.dividendes) {
    if (dv.montant == null || dv.montant <= 0) continue;
    const baseFiscale: ItemAgenda['baseFiscale'] = dv.base_fiscale === 'net' ? 'net' : dv.base_fiscale === 'brut' ? 'brut' : 'inconnue';
    const q = qte.get(dv.code) ?? null;
    const commun = {
      code: dv.code,
      parAction: dv.montant,
      totalIndicatif: q != null ? q * dv.montant : null,
      baseFiscale,
      mienne: q != null,
      source: dv.source,
    };
    if (dansFenetre(dv.ex_date)) {
      items.push({ ...commun, date: dv.ex_date, type: 'detachement', statut: 'annonce', titre: `Détachement du dividende ${dv.code}` });
    }
    if (dansFenetre(dv.payment_date)) {
      items.push({
        ...commun, date: dv.payment_date, type: 'paiement',
        statut: dv.source === 'brvm-boc' ? 'officiel' : 'annonce',
        titre: `Paiement du dividende ${dv.code}`,
      });
    }
  }

  for (const a of e.assemblees) {
    if (!dansFenetre(a.event_date)) continue;
    items.push({
      date: a.event_date, type: 'assemblee', statut: a.source === 'bdfin' ? 'officiel' : 'annonce',
      code: a.code, titre: a.title, parAction: null, totalIndicatif: null, baseFiscale: 'inconnue',
      mienne: a.code != null && qte.has(a.code), source: a.source,
    });
  }

  for (const f of e.fermetures) {
    if (!dansFenetre(f.date)) continue;
    items.push({
      date: f.date, type: 'fermeture', statut: 'fermeture', code: null,
      titre: f.holiday_name ? `Bourse fermée : ${f.holiday_name}` : 'Bourse fermée',
      parAction: null, totalIndicatif: null, baseFiscale: 'inconnue', mienne: false, source: 'market_calendar',
    });
  }

  return items.sort(
    (x, y) => Number(y.mienne) - Number(x.mienne) || x.date.localeCompare(y.date) || (x.code ?? '').localeCompare(y.code ?? ''),
  );
}
```

- [ ] **Step 4 : relancer** — `npx vitest run lib/dashboard/agenda.test.ts` → PASS (5 tests).

- [ ] **Step 5 : commit**

```bash
git add lib/dashboard/agenda.ts lib/dashboard/agenda.test.ts
git commit -m "feat(dashboard): agenda 30 jours à statuts officiel / annoncé / fermeture

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8 : `performanceJour` — portefeuille face à l'indice, même séance (pur)

**Files:**
- Create: `frontend/lib/dashboard/performanceJour.ts`
- Create: `frontend/lib/dashboard/performanceJour.test.ts`

- [ ] **Step 1 : tests qui échouent**

```ts
import { describe, it, expect } from 'vitest';
import { performanceJour } from './performanceJour';

const lignes = [
  { code: 'SNTS', quantite: 100, cours: 45000, variationPct: 0.04, dateMarche: '2026-10-12' },
  { code: 'TTLC', quantite: 300, cours: 3000, variationPct: 4.53, dateMarche: '2026-10-12' },
];

describe('performanceJour', () => {
  it('variation pondérée par la valeur de la veille, comparée à l indice de la même séance', () => {
    const r = performanceJour(lignes, { variationPct: -0.26, dateMarche: '2026-10-12' });
    const veille = 100 * (45000 / 1.0004) + 300 * (3000 / 1.0453); // jour = 5 400 000
    expect(r.portefeuillePct).toBeCloseTo((5_400_000 / veille - 1) * 100, 6);
    expect(r.variationFcfa).toBeCloseTo(5_400_000 - veille, 4);
    expect(r.indicePct).toBe(-0.26);
    expect(r.comparable).toBe(true);
    expect(r.dateMarche).toBe('2026-10-12');
  });

  it('indice d une autre séance : non comparable, l indice n est pas affiché', () => {
    const r = performanceJour(lignes, { variationPct: -0.26, dateMarche: '2026-10-09' });
    expect(r.comparable).toBe(false);
    expect(r.indicePct).toBeNull();
    expect(r.portefeuillePct).not.toBeNull();
  });

  it('un cours absent : rien n est calculé, la raison est donnée', () => {
    const r = performanceJour([...lignes, { code: 'BOAN', quantite: 10, cours: null, variationPct: null, dateMarche: null }], null);
    expect(r.portefeuillePct).toBeNull();
    expect(r.raison).toContain('BOAN');
  });

  it('positions de séances différentes : non comparable', () => {
    const r = performanceJour([lignes[0]!, { ...lignes[1]!, dateMarche: '2026-10-09' }], { variationPct: 0, dateMarche: '2026-10-12' });
    expect(r.portefeuillePct).toBeNull();
    expect(r.comparable).toBe(false);
  });

  it('aucune position : rien à calculer', () => {
    const r = performanceJour([], { variationPct: -0.26, dateMarche: '2026-10-12' });
    expect(r.portefeuillePct).toBeNull();
    expect(r.comparable).toBe(false);
  });
});
```

- [ ] **Step 2 : lancer, constater l'échec** — `npx vitest run lib/dashboard/performanceJour.test.ts` → FAIL.

- [ ] **Step 3 : implémenter** — créer `frontend/lib/dashboard/performanceJour.ts` :

```ts
/**
 * Performance du jour du portefeuille face au BRVM Composite — PUR (spec §4.5).
 *
 * Règle de cohérence temporelle : toutes les positions et l'indice doivent
 * porter sur la MÊME séance. Sinon, pas de comparaison (« non comparable »)
 * plutôt qu'un mélange de deux séances. Variation pondérée par la valeur de
 * la VEILLE (cours / (1 + variation)), comme un indice.
 */
export interface LignePerf {
  code: string;
  quantite: number;
  cours: number | null;
  variationPct: number | null;
  dateMarche: string | null;
}

export interface ResultatPerfJour {
  portefeuillePct: number | null;
  variationFcfa: number | null;
  indicePct: number | null;
  dateMarche: string | null;
  comparable: boolean;
  raison: string | null;
}

export function performanceJour(
  lignes: LignePerf[],
  indice: { variationPct: number | null; dateMarche: string | null } | null,
): ResultatPerfJour {
  const vide = (raison: string): ResultatPerfJour => ({
    portefeuillePct: null, variationFcfa: null, indicePct: null, dateMarche: null, comparable: false, raison,
  });

  const actives = lignes.filter((l) => l.quantite > 0);
  if (actives.length === 0) return vide('aucune position');

  const manquante = actives.find((l) => l.cours == null || l.variationPct == null || l.dateMarche == null);
  if (manquante) return vide(`cours du jour absent pour ${manquante.code}`);

  const dates = new Set(actives.map((l) => l.dateMarche));
  if (dates.size > 1) return vide('positions cotées à des séances différentes');

  const date = actives[0]!.dateMarche!;
  let veille = 0;
  let jour = 0;
  for (const l of actives) {
    const c = l.cours!;
    veille += l.quantite * (c / (1 + l.variationPct! / 100));
    jour += l.quantite * c;
  }
  const portefeuillePct = veille > 0 ? (jour / veille - 1) * 100 : null;
  const comparable = indice != null && indice.dateMarche === date && indice.variationPct != null;

  return {
    portefeuillePct,
    variationFcfa: jour - veille,
    indicePct: comparable ? indice!.variationPct : null,
    dateMarche: date,
    comparable,
    raison: comparable ? null : "l'indice ne porte pas sur la même séance",
  };
}
```

- [ ] **Step 4 : relancer** — `npx vitest run lib/dashboard/performanceJour.test.ts` → PASS (5 tests).

- [ ] **Step 5 : commit**

```bash
git add lib/dashboard/performanceJour.ts lib/dashboard/performanceJour.test.ts
git commit -m "feat(dashboard): performance du jour face au BRVM Composite, même séance obligatoire

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9 : Vérification d'ensemble et PR

- [ ] **Step 1 : toute la suite vitest du frontend**

Run : `npx vitest run`
Expected : tous les tests passent, dont les 6 fichiers nouveaux ou modifiés de ce plan.

- [ ] **Step 2 : types**

Run (arrière-plan) : `npx tsc --noEmit`
Expected : code 0, aucune sortie.

- [ ] **Step 3 : pousser et ouvrir la PR**

```bash
git push -u origin feat/dashboard-adaptatif
gh pr create --base main --head feat/dashboard-adaptatif --title "feat(dashboard): fondations du tableau de bord adaptatif (plan 1)" --body-file pr-plan1.md
```
`pr-plan1.md` (hors dépôt, dans le scratchpad) décrit : le brief corrigé (cause du « 0 FCFA » prouvée), l'ordre par profil, les quatre modules purs, ce qui n'est PAS fait (aucun nouveau bloc visible : Plan 2), les tests ; il se termine par `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

- [ ] **Step 4 : ne pas fusionner** sans le mot « fusionner » de l'utilisateur.

---

## Ce que le Plan 2 fera (hors de ce plan)

Clés `agenda`, `publications`, `liquidite`, `comprendre` dans `WIDGETS` avec leurs composants ; chargement des données (dividendes, `market_events`, `market_calendar`, `publications`, `liquidity_daily`, positions via `derivePortfolio`) ; bloc portefeuille enrichi (bandeau, courbe, positions, répartition) ; hiérarchie visuelle à trois niveaux ; états vides orientés action ; tests E2E pour les deux profils.
