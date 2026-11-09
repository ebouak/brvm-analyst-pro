# Conseiller v2 — Implementation Plan (étapes 0 à 4 de la spec)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire, dans le scraper, le banc de preuve et le moteur v2 du
Conseiller décrits par `docs/superpowers/specs/2026-11-09-conseiller-v2-design.md`,
jusqu'à la lecture unique du banc. Le plan s'arrête à la **porte humaine**.

**Architecture:** Tout vit dans `scraper/src/conseiller/` en fonctions pures
(statistiques, indice, dividendes, facteurs, décision, `evaluerSeance`, banc) et
en runners de lecture seule. Le banc et, plus tard, le job quotidien appellent la
même `evaluerSeance`. Aucune écriture en base dans ce plan. Les rapports sont des
fichiers Markdown dans `docs/conseiller/`.

**Tech Stack:** Node ≥ 22, TypeScript strict ESM (imports en `.js`), vitest,
`@supabase/supabase-js` (lecture paginée, 1 000 lignes par page).

**Hors de ce plan (après la porte humaine, et seulement si le banc prouve) :**
migration `advisor_history`, job quotidien (et son test de rejeu octet par
octet), frontend, track record. La robustesse « validation glissante » (spec
§2.2, analyse secondaire) est aussi reportée : elle n'entre pas dans le test
confirmatoire et sera ajoutée seulement si le banc prouve.

---

## Règles pour l'exécutant

- **Ne lis JAMAIS le résultat du test confirmatoire** avant la tâche 13. Ne
  lance pas `conseiller:banc` avant que PREREG.md soit commité. Le banc refuse
  d'ailleurs de démarrer sinon.
- Aucun chiffre inventé : une donnée absente donne `null`, jamais 0.
- Tests : `cd scraper && npx vitest run tests/<fichier>.test.ts`. Typecheck :
  `cd scraper && npm run typecheck`.
- Commits fréquents, terminés par
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Ne jamais afficher de clé. Les runners lisent `scraper/.env.local` via la
  config existante (`getSupabase()`).

## Carte des fichiers

| Fichier | Rôle |
|---|---|
| `scraper/src/conseiller/types.ts` | types partagés (Donnees, Serie, Comptes, Dividende, Famille, Decision) |
| `scraper/src/conseiller/stats.ts` | PRNG, rang transversal, bootstrap stationnaire, test de signe, EMD |
| `scraper/src/conseiller/indice.ts` | indice équipondéré (valeurs échangées, entrée après 20 séances) |
| `scraper/src/conseiller/dividendes.ts` | ex-date reconstituée, rendement total |
| `scraper/src/conseiller/liquiditeGlissante.ts` | classe de liquidité à une date, données antérieures seules |
| `scraper/src/conseiller/facteurs.ts` | 5 familles de facteurs, rang → [−1, +1] |
| `scraper/src/conseiller/decision.ts` | règle K-sur-5, garde-fou liquidité |
| `scraper/src/conseiller/evaluerSeance.ts` | fonction unique banc/production |
| `scraper/src/conseiller/banc.ts` | protocole de preuve (§2 de la spec) |
| `scraper/src/conseiller/audit.ts` | audit pur des données (étape 0) |
| `scraper/src/conseiller/historique.ts` | chargement paginé Supabase → `Donnees` |
| `scraper/src/conseiller/runAudit.ts`, `runEmd.ts`, `runBanc.ts`, `runV1.ts` | runners lecture seule |
| `scraper/src/conseiller/PREREG.md` | pré-enregistrement (tâche 12) |
| `scraper/src/signaux/evaluation.ts` | ajout de l'IC par dates (§2.8) |
| `scraper/src/index.ts` | 4 commandes CLI |
| `scraper/tests/conseiller*.test.ts` | tests purs |
| `docs/conseiller/*.md` | rapports produits |

---

### Task 0: Préparer le worktree

**Files:** aucun fichier suivi.

- [ ] **Step 1: Relier les dépendances du scraper**

Le worktree n'a pas de `node_modules`. Crée une jonction vers celles du dépôt
principal (PowerShell) :

```powershell
New-Item -ItemType Junction -Path "C:\Users\adego\wt\brvm-conseiller\scraper\node_modules" -Target "C:\Users\adego\OneDrive\Documents\brvm-analyst-pro\scraper\node_modules"
Copy-Item "C:\Users\adego\OneDrive\Documents\brvm-analyst-pro\scraper\.env.local" "C:\Users\adego\wt\brvm-conseiller\scraper\.env.local"
```

- [ ] **Step 2: Vérifier la base de départ**

Run: `cd scraper && npm run typecheck && npx vitest run tests/evaluationSignaux.test.ts`
Expected: typecheck sans erreur, tests PASS.

---

### Task 1: Types partagés

**Files:**
- Create: `scraper/src/conseiller/types.ts`

- [ ] **Step 1: Écrire les types**

```ts
/** Types du Conseiller v2. Voir docs/superpowers/specs/2026-11-09-conseiller-v2-design.md. */

export type FamilleComptable = 'banque' | 'general';
export type FamilleFacteur = 'valorisation' | 'qualite' | 'rendement' | 'tendance' | 'risque';
export const FAMILLES_FACTEURS: FamilleFacteur[] = ['valorisation', 'qualite', 'rendement', 'tendance', 'risque'];

/** Série d'une valeur, triée par date croissante. `volumes[i] > 0` = séance échangée. */
export interface Serie {
  dates: string[];
  cours: number[];
  volumes: number[];
  valeurs: number[];
  variations: (number | null)[];
  pos: Map<string, number>;
}

export interface ComptesAnnuels {
  code: string;
  exercice: number;
  resultatNet: number | null;
  capitauxPropres: number | null;
  actions: number | null;
  /** Première date (ISO) où ces comptes sont connus du public. */
  disponibleLe: string;
}

export interface Dividende {
  code: string;
  exercice: number;
  montant: number;
  /** Première date où le montant est connu (31 juillet N+1). */
  disponibleLe: string;
  /** Date de détachement, réelle ou reconstituée ; null si inconnue. */
  exDate: string | null;
}

export interface Donnees {
  /** Toutes les dates de séance du marché, triées. */
  calendrier: string[];
  series: Map<string, Serie>;
  comptes: ComptesAnnuels[];
  dividendes: Dividende[];
  familles: Map<string, FamilleComptable>;
}

export type Action = 'acheter' | 'conserver' | 'vendre';

export interface Decision {
  code: string;
  date: string;
  action: Action;
  scores: Record<FamilleFacteur, number | null>;
  /** Familles concordantes avec l'action (0 si conserver). */
  concordantes: number;
  disponibles: number;
  raison: 'concordance' | 'liquidite' | 'abstention' | 'pas_de_concordance';
}
```

- [ ] **Step 2: Typecheck**

Run: `cd scraper && npm run typecheck`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add scraper/src/conseiller/types.ts
git commit -m "feat(conseiller): types du moteur v2"
```

---

### Task 2: Statistiques pures

**Files:**
- Create: `scraper/src/conseiller/stats.ts`
- Test: `scraper/tests/conseillerStats.test.ts`

- [ ] **Step 1: Écrire les tests**

```ts
import { describe, it, expect } from 'vitest';
import { prng, rangTransversal, bootstrapStationnaire, quantile, testSigne, effetMinimalDetectable, ecartType } from '../src/conseiller/stats.js';

describe('prng', () => {
  it('est reproductible', () => {
    const a = prng(1), b = prng(1);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('rangTransversal', () => {
  it('met le plus haut à +1 et le plus bas à −1 (sens +1)', () => {
    const r = rangTransversal(new Map([['A', 1], ['B', 2], ['C', 3], ['D', 4], ['E', 5]]), 1);
    expect(r.get('E')).toBeCloseTo(1);
    expect(r.get('A')).toBeCloseTo(-1);
    expect(r.get('C')).toBeCloseTo(0);
  });
  it('inverse avec le sens −1', () => {
    const r = rangTransversal(new Map([['A', 1], ['B', 2], ['C', 3], ['D', 4], ['E', 5]]), -1);
    expect(r.get('A')).toBeCloseTo(1);
  });
  it('rend tout null sous 5 valeurs non nulles', () => {
    const r = rangTransversal(new Map<string, number | null>([['A', 1], ['B', null], ['C', 3], ['D', 4]]), 1);
    expect([...r.values()].every((v) => v === null)).toBe(true);
  });
  it('donne le même rang aux ex æquo', () => {
    const r = rangTransversal(new Map([['A', 1], ['B', 2], ['C', 2], ['D', 4], ['E', 5]]), 1);
    expect(r.get('B')).toBeCloseTo(r.get('C')!);
  });
});

describe('bootstrapStationnaire', () => {
  it('est centré sur la moyenne et reproductible', () => {
    const xs = Array.from({ length: 60 }, (_, i) => (i % 2 === 0 ? 1 : 3));
    const m1 = bootstrapStationnaire(xs, { blocMoyen: 3, tirages: 2000, graine: 7 });
    const m2 = bootstrapStationnaire(xs, { blocMoyen: 3, tirages: 2000, graine: 7 });
    expect(m1).toEqual(m2);
    expect(quantile(m1, 0.5)).toBeCloseTo(2, 0);
  });
});

describe('testSigne', () => {
  it('compte les positifs et donne une p-valeur unilatérale', () => {
    const r = testSigne([1, 2, 3, -1, 4, 5, 6, 7, 8, 9]);
    expect(r.positifs).toBe(9);
    expect(r.n).toBe(10);
    expect(r.p).toBeCloseTo(11 / 1024, 4);
  });
});

describe('effetMinimalDetectable', () => {
  it('suit (z0,95 + z0,80) × σ / √n, puis × 252/20 pour l annualiser', () => {
    const r = effetMinimalDetectable(7, 60);
    expect(r.parPeriode).toBeCloseTo((1.6449 + 0.8416) * 7 / Math.sqrt(60), 2);
    expect(r.annualise).toBeCloseTo(r.parPeriode * 12.6, 2);
  });
});

describe('ecartType', () => {
  it('calcule l écart-type d échantillon', () => {
    expect(ecartType([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 2);
  });
});
```

- [ ] **Step 2: Lancer les tests (échec attendu)**

Run: `cd scraper && npx vitest run tests/conseillerStats.test.ts`
Expected: FAIL, module introuvable.

- [ ] **Step 3: Implémenter**

```ts
/** Statistiques pures du banc v2 (spec §2). Aucune I/O. */

/** mulberry32 : générateur reproductible. */
export function prng(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const MIN_VALEURS_RANG = 5;

/**
 * Rang transversal → [−1, +1]. `sens = 1` : plus haut = +1. Ex æquo : rang moyen.
 * Moins de 5 valeurs non nulles : tout est null (un rang sur 4 valeurs ne veut rien dire).
 */
export function rangTransversal(valeurs: Map<string, number | null>, sens: 1 | -1): Map<string, number | null> {
  const presentes = [...valeurs].filter((e): e is [string, number] => e[1] != null && Number.isFinite(e[1]));
  const out = new Map<string, number | null>();
  for (const k of valeurs.keys()) out.set(k, null);
  if (presentes.length < MIN_VALEURS_RANG) return out;
  presentes.sort((a, b) => a[1] - b[1]);
  const n = presentes.length;
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && presentes[j + 1]![1] === presentes[i]![1]) j++;
    const rangMoyen = (i + j) / 2;
    const score = (2 * rangMoyen) / (n - 1) - 1;
    for (let k = i; k <= j; k++) out.set(presentes[k]![0], sens * score);
    i = j + 1;
  }
  return out;
}

export const moyenne = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

export function ecartType(xs: number[]): number {
  const m = moyenne(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

/** Quantile d'un tableau TRIÉ. */
export function quantile(trie: number[], q: number): number {
  const i = Math.min(trie.length - 1, Math.max(0, Math.floor(q * trie.length)));
  return trie[i]!;
}

/**
 * Bootstrap stationnaire (Politis-Romano) de la moyenne. Renvoie les moyennes
 * TRIÉES. Blocs de longueur géométrique de moyenne `blocMoyen`, enroulés.
 */
export function bootstrapStationnaire(
  xs: number[],
  opts: { blocMoyen: number; tirages: number; graine: number },
): number[] {
  const n = xs.length;
  const alea = prng(opts.graine);
  const p = 1 / opts.blocMoyen;
  const moyennes: number[] = [];
  for (let t = 0; t < opts.tirages; t++) {
    let s = 0;
    let i = Math.floor(alea() * n);
    for (let k = 0; k < n; k++) {
      s += xs[i]!;
      i = alea() < p ? Math.floor(alea() * n) : (i + 1) % n;
    }
    moyennes.push(s / n);
  }
  return moyennes.sort((a, b) => a - b);
}

/** Bootstrap i.i.d. (cas regroupés) : sert seulement à mesurer la sur-confiance. */
export function bootstrapIid(xs: number[], tirages: number, graine: number): number[] {
  return bootstrapStationnaire(xs, { blocMoyen: 1, tirages, graine });
}

/** Test de signe unilatéral : P(X ≥ positifs) sous p = 0,5. Les zéros sont écartés. */
export function testSigne(xs: number[]): { positifs: number; n: number; p: number } {
  const nonNuls = xs.filter((x) => x !== 0);
  const n = nonNuls.length;
  const positifs = nonNuls.filter((x) => x > 0).length;
  let p = 0;
  let c = 1; // C(n, 0)
  for (let k = 0; k <= n; k++) {
    if (k >= positifs) p += c;
    c = (c * (n - k)) / (k + 1);
  }
  return { positifs, n, p: p / 2 ** n };
}

const Z_95_UNILATERAL = 1.6449;
const Z_PUISSANCE_80 = 0.8416;
export const PERIODES_PAR_AN = 252 / 20;

/** Effet minimal détectable (unilatéral 5 %, puissance 80 %), par période de 20 séances et annualisé. */
export function effetMinimalDetectable(ecartTypeParDate: number, nDates: number): { parPeriode: number; annualise: number } {
  const parPeriode = ((Z_95_UNILATERAL + Z_PUISSANCE_80) * ecartTypeParDate) / Math.sqrt(nDates);
  return { parPeriode, annualise: parPeriode * PERIODES_PAR_AN };
}
```

- [ ] **Step 4: Lancer les tests**

Run: `cd scraper && npx vitest run tests/conseillerStats.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add scraper/src/conseiller/stats.ts scraper/tests/conseillerStats.test.ts
git commit -m "feat(conseiller): statistiques pures (rang, bootstrap stationnaire, signe, EMD)"
```

---

### Task 3: Fabrique de données de test

**Files:**
- Create: `scraper/tests/conseillerFabrique.ts`

- [ ] **Step 1: Écrire la fabrique** (utilisée par les tâches 4 à 10)

```ts
import type { Donnees, Serie, FamilleComptable, ComptesAnnuels, Dividende } from '../src/conseiller/types.js';

/** Calendrier de n séances ouvrées consécutives à partir du 2020-01-01 (dates ISO). */
export function calendrier(n: number): string[] {
  const out: string[] = [];
  const d = new Date(Date.UTC(2020, 0, 1));
  while (out.length < n) {
    const j = d.getUTCDay();
    if (j !== 0 && j !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** Série à partir de cours ; volume 1000 sauf aux indices listés dans `figees`. */
export function serie(dates: string[], cours: number[], figees: number[] = []): Serie {
  const volumes = cours.map((_, i) => (figees.includes(i) ? 0 : 1000));
  return {
    dates: [...dates],
    cours: [...cours],
    volumes,
    valeurs: cours.map((c, i) => c * volumes[i]!),
    variations: cours.map((c, i) => (i === 0 ? null : (c / cours[i - 1]! - 1) * 100)),
    pos: new Map(dates.map((d, i) => [d, i])),
  };
}

/** Univers de valeurs ; la valeur k a une tendance de `pentes[k]` % par séance. */
export function univers(nbSeances: number, pentes: number[], famille: FamilleComptable = 'general'): Donnees {
  const cal = calendrier(nbSeances);
  const series = new Map<string, Serie>();
  const familles = new Map<string, FamilleComptable>();
  pentes.forEach((p, k) => {
    const code = `V${String(k).padStart(2, '0')}`;
    const cours = cal.map((_, i) => 1000 * (1 + p / 100) ** i);
    series.set(code, serie(cal, cours));
    familles.set(code, famille);
  });
  return { calendrier: cal, series, comptes: [] as ComptesAnnuels[], dividendes: [] as Dividende[], familles };
}
```

- [ ] **Step 2: Commit**

```bash
git add scraper/tests/conseillerFabrique.ts
git commit -m "test(conseiller): fabrique de données synthétiques"
```

---

### Task 4: Indice équipondéré

**Files:**
- Create: `scraper/src/conseiller/indice.ts`
- Test: `scraper/tests/conseillerIndice.test.ts`

- [ ] **Step 1: Écrire les tests**

```ts
import { describe, it, expect } from 'vitest';
import { indiceEquipondere, perfIndice } from '../src/conseiller/indice.js';
import { calendrier, serie } from './conseillerFabrique.js';

describe('indiceEquipondere', () => {
  const cal = calendrier(30);
  const donnees = (series: [string, ReturnType<typeof serie>][]) => ({ calendrier: cal, series: new Map(series), comptes: [], dividendes: [], familles: new Map() });
  it('moyenne les rendements du jour des valeurs échangées, cotées depuis ≥ 20 séances', () => {
    const a = serie(cal, cal.map((_, i) => 100 * 1.01 ** i));
    const b = serie(cal, cal.map(() => 100));
    const ind = indiceEquipondere(donnees([['A', a], ['B', b]]));
    expect(ind.rendements.get(cal[25]!)).toBeCloseTo(0.005, 6);
    expect(ind.rendements.get(cal[5]!)).toBeUndefined();
  });
  it('exclut une valeur non échangée ce jour-là', () => {
    const a = serie(cal, cal.map((_, i) => 100 * 1.01 ** i));
    const b = serie(cal, cal.map(() => 100), [25]);
    const ind = indiceEquipondere(donnees([['A', a], ['B', b]]));
    expect(ind.rendements.get(cal[25]!)).toBeCloseTo(0.01, 6);
  });
  it('perfIndice compose les rendements entre deux dates', () => {
    const a = serie(cal, cal.map((_, i) => 100 * 1.01 ** i));
    const ind = indiceEquipondere(donnees([['A', a]]));
    expect(perfIndice(ind, cal, cal[22]!, cal[25]!)).toBeCloseTo(1.01 ** 3 - 1, 6);
  });
});
```

- [ ] **Step 2: Lancer (échec attendu)**

Run: `cd scraper && npx vitest run tests/conseillerIndice.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

```ts
import type { Donnees } from './types.js';

export const ENTREE_APRES_SEANCES = 20;

export interface Indice {
  /** Rendement simple du jour (0,005 = +0,5 %), aux dates où au moins une valeur entre. */
  rendements: Map<string, number>;
  /** Niveau cumulé (base 1), défini aux mêmes dates. */
  niveaux: Map<string, number>;
}

/**
 * Indice équipondéré reconstruit depuis les cours (spec §4). Une valeur entre
 * dans la moyenne du jour si elle a été échangée ce jour-là et si elle cote
 * depuis au moins 20 séances.
 */
export function indiceEquipondere(d: Donnees): Indice {
  const sommes = new Map<string, { s: number; n: number }>();
  for (const serie of d.series.values()) {
    for (let i = Math.max(1, ENTREE_APRES_SEANCES); i < serie.dates.length; i++) {
      if ((serie.volumes[i] ?? 0) <= 0) continue;
      const r = serie.cours[i]! / serie.cours[i - 1]! - 1;
      const date = serie.dates[i]!;
      const acc = sommes.get(date) ?? { s: 0, n: 0 };
      acc.s += r;
      acc.n += 1;
      sommes.set(date, acc);
    }
  }
  const rendements = new Map<string, number>();
  const niveaux = new Map<string, number>();
  let niveau = 1;
  for (const date of d.calendrier) {
    const acc = sommes.get(date);
    if (!acc) continue;
    const r = acc.s / acc.n;
    rendements.set(date, r);
    niveau *= 1 + r;
    niveaux.set(date, niveau);
  }
  return { rendements, niveaux };
}

/** Performance composée de l'indice sur ]debut ; fin]. */
export function perfIndice(ind: Indice, calendrier: string[], debut: string, fin: string): number {
  let p = 1;
  for (const date of calendrier) {
    if (date <= debut || date > fin) continue;
    p *= 1 + (ind.rendements.get(date) ?? 0);
  }
  return p - 1;
}
```

- [ ] **Step 4: Lancer les tests**

Run: `cd scraper && npx vitest run tests/conseillerIndice.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add scraper/src/conseiller/indice.ts scraper/tests/conseillerIndice.test.ts
git commit -m "feat(conseiller): indice équipondéré reconstruit depuis les cours"
```

---

### Task 5: Dividendes — ex-date reconstituée et rendement total

**Files:**
- Create: `scraper/src/conseiller/dividendes.ts`
- Test: `scraper/tests/conseillerDividendes.test.ts`

- [ ] **Step 1: Écrire les tests**

```ts
import { describe, it, expect } from 'vitest';
import { reconstituerExDate, rendementTotal } from '../src/conseiller/dividendes.js';
import { calendrier, serie } from './conseillerFabrique.js';
import type { Dividende } from '../src/conseiller/types.js';

const cal = calendrier(120);

describe('reconstituerExDate', () => {
  it('trouve la première baisse proche du montant (±20 %) dans les 60 séances', () => {
    const s = serie(cal, cal.map((_, i) => (i < 40 ? 1000 : 920)));
    expect(reconstituerExDate(s, 80, cal[10]!)).toBe(cal[40]);
  });
  it('renvoie null si aucune baisse ne correspond', () => {
    const s = serie(cal, cal.map(() => 1000));
    expect(reconstituerExDate(s, 80, cal[10]!)).toBeNull();
  });
});

describe('rendementTotal', () => {
  it('ajoute le dividende détaché dans la fenêtre', () => {
    const s = serie(cal, cal.map((_, i) => (i < 40 ? 1000 : 920)));
    const div: Dividende[] = [{ code: 'A', exercice: 2019, montant: 80, disponibleLe: cal[10]!, exDate: cal[40]! }];
    expect(rendementTotal(s, 'A', div, 30, 50)).toBeCloseTo(0, 6);
  });
  it('exclut (null) une fenêtre qui chevauche mai-août si un dividende sans ex-date est connu', () => {
    const s = serie(cal, cal.map(() => 1000));
    const div: Dividende[] = [{ code: 'A', exercice: 2019, montant: 80, disponibleLe: '2020-01-02', exDate: null }];
    const iMai = cal.findIndex((d) => d >= '2020-05-01');
    expect(rendementTotal(s, 'A', div, iMai - 5, iMai + 15)).toBeNull();
  });
  it('rend le rendement en cours seuls hors de ces cas', () => {
    const s = serie(cal, cal.map((_, i) => 1000 + i));
    expect(rendementTotal(s, 'A', [], 0, 10)).toBeCloseTo(10 / 1000, 6);
  });
});
```

- [ ] **Step 2: Lancer (échec attendu)**

Run: `cd scraper && npx vitest run tests/conseillerDividendes.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

```ts
import type { Dividende, Serie } from './types.js';

export const FENETRE_RECONSTITUTION = 60;
export const TOLERANCE_MONTANT = 0.2;

/**
 * Ex-date reconstituée (spec §3.5a) : première séance, dans les 60 séances qui
 * suivent `apres`, où la baisse de cours vaut le montant à ±20 %.
 */
export function reconstituerExDate(s: Serie, montant: number, apres: string): string | null {
  const debut = s.dates.findIndex((d) => d >= apres);
  if (debut < 0 || montant <= 0) return null;
  const fin = Math.min(s.dates.length - 1, debut + FENETRE_RECONSTITUTION);
  for (let i = Math.max(1, debut); i <= fin; i++) {
    const baisse = s.cours[i - 1]! - s.cours[i]!;
    if (baisse > 0 && Math.abs(baisse - montant) <= TOLERANCE_MONTANT * montant) return s.dates[i]!;
  }
  return null;
}

const chevaucheMaiAout = (debut: string, fin: string) => {
  for (let an = Number(debut.slice(0, 4)); an <= Number(fin.slice(0, 4)); an++) {
    if (debut <= `${an}-08-31` && fin >= `${an}-05-01`) return true;
  }
  return false;
};

/**
 * Rendement total entre les positions `a` et `b` (cours + dividendes détachés
 * dans ]a ; b]). `null` (observation EXCLUE, spec §3.5b) si un dividende de la
 * valeur, connu avant la fin de la fenêtre, n'a pas d'ex-date et que la fenêtre
 * chevauche mai-août.
 */
export function rendementTotal(s: Serie, code: string, dividendes: Dividende[], a: number, b: number): number | null {
  const debut = s.dates[a]!;
  const fin = s.dates[b]!;
  let detache = 0;
  for (const dv of dividendes) {
    if (dv.code !== code) continue;
    if (dv.exDate == null) {
      if (dv.disponibleLe <= fin && chevaucheMaiAout(debut, fin)) return null;
      continue;
    }
    if (dv.exDate > debut && dv.exDate <= fin) detache += dv.montant;
  }
  return (s.cours[b]! + detache) / s.cours[a]! - 1;
}
```

- [ ] **Step 4: Lancer les tests**

Run: `cd scraper && npx vitest run tests/conseillerDividendes.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add scraper/src/conseiller/dividendes.ts scraper/tests/conseillerDividendes.test.ts
git commit -m "feat(conseiller): ex-date reconstituée et rendement total"
```

---

### Task 6: Liquidité en fenêtre glissante

**Files:**
- Create: `scraper/src/conseiller/liquiditeGlissante.ts`
- Test: `scraper/tests/conseillerLiquidite.test.ts`

- [ ] **Step 1: Écrire les tests**

```ts
import { describe, it, expect } from 'vitest';
import { classeA } from '../src/conseiller/liquiditeGlissante.js';
import { calendrier, serie } from './conseillerFabrique.js';

const cal = calendrier(60);

describe('classeA', () => {
  it('rend une classe avec 30 séances de calendrier jusqu à la date', () => {
    const s = serie(cal, cal.map((_, i) => 1000 + (i % 3)));
    expect(classeA(s, cal, cal[45]!)).not.toBeNull();
  });
  it('classe D une valeur presque jamais échangée', () => {
    const figees = cal.map((_, i) => i).filter((i) => i % 10 !== 0);
    const s = serie(cal, cal.map(() => 1000), figees);
    expect(classeA(s, cal, cal[59]!)).toBe('D');
  });
  it('renvoie null avant 30 séances de calendrier', () => {
    const s = serie(cal, cal.map(() => 1000));
    expect(classeA(s, cal, cal[10]!)).toBeNull();
  });
});
```

- [ ] **Step 2: Lancer (échec attendu)**

Run: `cd scraper && npx vitest run tests/conseillerLiquidite.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

```ts
import { computeLiquidityV2, type LiquidityClass, type LiquiditySessionRow30 } from '../liquidity/compute.js';
import type { Serie } from './types.js';

export const FENETRE_LIQUIDITE = 30;

/**
 * Classe de liquidité d'une valeur à `date`, calculée par le moteur officiel
 * (`liquidity/compute.ts`) sur les 30 séances du calendrier qui finissent à
 * `date`. Aucune donnée postérieure n'est lue (spec §4, cours figés).
 */
export function classeA(s: Serie, calendrier: string[], date: string): LiquidityClass | null {
  const fin = calendrier.indexOf(date);
  if (fin < FENETRE_LIQUIDITE - 1) return null;
  const fenetre = calendrier.slice(fin - FENETRE_LIQUIDITE + 1, fin + 1);
  const rows: LiquiditySessionRow30[] = [];
  for (const d of fenetre) {
    const i = s.pos.get(d);
    if (i == null) continue;
    rows.push({
      date_marche: d,
      cours_jour: s.cours[i]!,
      variation_pct: s.variations[i] ?? null,
      volume: s.volumes[i]!,
      valeur_echangee: s.valeurs[i]!,
    });
  }
  return computeLiquidityV2(rows, fenetre.length).classe;
}
```

- [ ] **Step 4: Lancer les tests**

Run: `cd scraper && npx vitest run tests/conseillerLiquidite.test.ts`
Expected: PASS (3 tests). Si « classe D » échoue, lis `classifyLiquidity` et
`MIN_SEANCES` dans `scraper/src/liquidity/compute.ts` et ajuste la FIXTURE
(moins de séances échangées, valeur échangée plus faible). Ne modifie jamais le
moteur de liquidité.

- [ ] **Step 5: Commit**

```bash
git add scraper/src/conseiller/liquiditeGlissante.ts scraper/tests/conseillerLiquidite.test.ts
git commit -m "feat(conseiller): classe de liquidité glissante sans regard vers l'avant"
```

---

### Task 7: Facteurs (5 familles)

**Files:**
- Create: `scraper/src/conseiller/facteurs.ts`
- Test: `scraper/tests/conseillerFacteurs.test.ts`

- [ ] **Step 1: Écrire les tests**

```ts
import { describe, it, expect } from 'vitest';
import { scoresFamilles, MIN_COUVERTURE } from '../src/conseiller/facteurs.js';
import { indiceEquipondere } from '../src/conseiller/indice.js';
import { univers } from './conseillerFabrique.js';
import type { ComptesAnnuels } from '../src/conseiller/types.js';

describe('tendance', () => {
  it('classe en tête la valeur la plus haussière face à l indice', () => {
    const pentes = Array.from({ length: 20 }, (_, k) => (k - 10) / 20);
    const d = univers(200, pentes);
    const s = scoresFamilles(d, indiceEquipondere(d), d.calendrier[190]!);
    expect(s.get('V19')!.tendance).toBeCloseTo(1, 5);
    expect(s.get('V00')!.tendance).toBeCloseTo(-1, 5);
  });
  it('vaut null (tendance et risque) si moins de 60 % des séances sont échangées', () => {
    const d = univers(200, Array.from({ length: 20 }, (_, k) => k / 20));
    const v = d.series.get('V05')!;
    for (let i = 0; i < v.volumes.length; i++) if (i % 2 === 0) v.volumes[i] = 0;
    const s = scoresFamilles(d, indiceEquipondere(d), d.calendrier[190]!);
    expect(s.get('V05')!.tendance).toBeNull();
    expect(s.get('V05')!.risque).toBeNull();
  });
});

describe('valorisation', () => {
  const comptesPour = (codes: string[], dispo: string, cp: (k: number) => number): ComptesAnnuels[] =>
    codes.map((code, k) => ({ code, exercice: 2019, resultatNet: 1000 * (k + 1), capitauxPropres: cp(k), actions: 100, disponibleLe: dispo }));
  it('donne le meilleur score à la valeur la moins chère de sa famille comptable', () => {
    const d = univers(200, Array.from({ length: 20 }, () => 0));
    const comptes = comptesPour([...d.series.keys()], d.calendrier[10]!, (k) => 10000 * (k + 1));
    const s = scoresFamilles({ ...d, comptes }, indiceEquipondere(d), d.calendrier[190]!);
    expect(s.get('V19')!.valorisation).toBeCloseTo(1, 5);
    expect(s.get('V00')!.valorisation).toBeCloseTo(-1, 5);
  });
  it('ignore des comptes pas encore disponibles à la date', () => {
    const d = univers(200, Array.from({ length: 20 }, () => 0));
    const comptes = comptesPour([...d.series.keys()], '2099-01-01', () => 10000);
    const s = scoresFamilles({ ...d, comptes }, indiceEquipondere(d), d.calendrier[190]!);
    expect(s.get('V00')!.valorisation).toBeNull();
  });
  it(`est null partout sous ${MIN_COUVERTURE} valeurs couvertes`, () => {
    const d = univers(200, Array.from({ length: 20 }, () => 0));
    const comptes = comptesPour([...d.series.keys()].slice(0, 10), d.calendrier[10]!, () => 10000);
    const s = scoresFamilles({ ...d, comptes }, indiceEquipondere(d), d.calendrier[190]!);
    expect(s.get('V00')!.valorisation).toBeNull();
  });
});
```

- [ ] **Step 2: Lancer (échec attendu)**

Run: `cd scraper && npx vitest run tests/conseillerFacteurs.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

```ts
import { rangTransversal, moyenne, ecartType } from './stats.js';
import { perfIndice, type Indice } from './indice.js';
import type { ComptesAnnuels, Donnees, FamilleFacteur, Serie } from './types.js';

/** Paramètres FIGÉS (spec §2.2). Toute modification invalide le PREREG. */
export const PARAMS = {
  tendanceCourte: 60,
  tendanceLongue: 120,
  volatilite: 60,
  baisseMax: 120,
  partEchangeeMin: 0.6,
  minParFamilleComptable: 5,
} as const;
export const MIN_COUVERTURE = 15;

export type ScoresFamilles = Record<FamilleFacteur, number | null>;

function fenetreEchangee(s: Serie, p: number, longueur: number): boolean {
  if (p - longueur < 0) return false;
  let echangees = 0;
  for (let i = p - longueur + 1; i <= p; i++) if ((s.volumes[i] ?? 0) > 0) echangees++;
  return echangees / longueur >= PARAMS.partEchangeeMin;
}

/** Derniers comptes disponibles à `date`, et ceux de l'exercice précédent. */
function comptesA(comptes: ComptesAnnuels[], code: string, date: string): { n: ComptesAnnuels | null; nm1: ComptesAnnuels | null } {
  const dispo = comptes.filter((c) => c.code === code && c.disponibleLe <= date).sort((a, b) => b.exercice - a.exercice);
  const n = dispo[0] ?? null;
  const nm1 = n ? dispo.find((c) => c.exercice === n.exercice - 1) ?? null : null;
  return { n, nm1 };
}

/** Ratio rapporté à la médiane de sa famille comptable (≥ 5 valeurs, sinon null). */
function rapportMediane(brut: Map<string, number | null>, familles: Donnees['familles']): Map<string, number | null> {
  const parFamille = new Map<string, number[]>();
  for (const [code, v] of brut) {
    if (v == null) continue;
    const f = familles.get(code) ?? 'general';
    (parFamille.get(f) ?? parFamille.set(f, []).get(f)!).push(v);
  }
  const medianes = new Map<string, number | null>();
  for (const [f, vs] of parFamille) {
    if (vs.length < PARAMS.minParFamilleComptable) { medianes.set(f, null); continue; }
    const t = [...vs].sort((a, b) => a - b);
    const m = t.length % 2 ? t[(t.length - 1) / 2]! : (t[t.length / 2 - 1]! + t[t.length / 2]!) / 2;
    medianes.set(f, m > 0 ? m : null);
  }
  const out = new Map<string, number | null>();
  for (const [code, v] of brut) {
    const m = medianes.get(familles.get(code) ?? 'general') ?? null;
    out.set(code, v != null && m != null ? v / m : null);
  }
  return out;
}

/** Moyenne des rangs disponibles ; null si aucun. Couverture < 15 → famille nulle partout. */
function famille(rangs: Map<string, number | null>[], codes: string[]): Map<string, number | null> {
  const out = new Map<string, number | null>();
  for (const c of codes) {
    const vs = rangs.map((r) => r.get(c)).filter((v): v is number => v != null);
    out.set(c, vs.length ? moyenne(vs) : null);
  }
  const couverts = [...out.values()].filter((v) => v != null).length;
  if (couverts < MIN_COUVERTURE) for (const c of codes) out.set(c, null);
  return out;
}

/** Scores des 5 familles pour toutes les valeurs cotées à `date`. Aucune donnée postérieure n'est lue. */
export function scoresFamilles(d: Donnees, ind: Indice, date: string): Map<string, ScoresFamilles> {
  const codes = [...d.series].filter(([, s]) => s.pos.has(date)).map(([c]) => c);
  const m = () => new Map<string, number | null>();
  const brut = { t60: m(), t120: m(), vol: m(), dd: m(), per: m(), pb: m(), croiss: m(), roe: m(), rdt: m() };
  for (const code of codes) {
    const s = d.series.get(code)!;
    const p = s.pos.get(date)!;
    const cours = s.cours[p]!;
    for (const [long, cible] of [[PARAMS.tendanceCourte, brut.t60], [PARAMS.tendanceLongue, brut.t120]] as const) {
      cible.set(code, fenetreEchangee(s, p, long)
        ? cours / s.cours[p - long]! - 1 - perfIndice(ind, d.calendrier, s.dates[p - long]!, date)
        : null);
    }
    if (fenetreEchangee(s, p, PARAMS.volatilite)) {
      const r: number[] = [];
      for (let i = p - PARAMS.volatilite + 1; i <= p; i++) if ((s.volumes[i] ?? 0) > 0) r.push(Math.log(s.cours[i]! / s.cours[i - 1]!));
      brut.vol.set(code, r.length > 2 ? ecartType(r) : null);
    } else brut.vol.set(code, null);
    if (fenetreEchangee(s, p, PARAMS.baisseMax)) {
      let pic = 0, pire = 0;
      for (let i = p - PARAMS.baisseMax; i <= p; i++) { pic = Math.max(pic, s.cours[i]!); pire = Math.min(pire, s.cours[i]! / pic - 1); }
      brut.dd.set(code, -pire);
    } else brut.dd.set(code, null);
    const { n, nm1 } = comptesA(d.comptes, code, date);
    const capi = n?.actions != null && n.actions > 0 ? cours * n.actions : null;
    brut.per.set(code, capi != null && n?.resultatNet != null && n.resultatNet > 0 ? capi / n.resultatNet : null);
    brut.pb.set(code, capi != null && n?.capitauxPropres != null && n.capitauxPropres > 0 ? capi / n.capitauxPropres : null);
    brut.croiss.set(code, n?.resultatNet != null && nm1?.resultatNet != null && nm1.resultatNet !== 0
      ? (n.resultatNet - nm1.resultatNet) / Math.abs(nm1.resultatNet) : null);
    brut.roe.set(code, n?.resultatNet != null && n.capitauxPropres != null && n.capitauxPropres > 0 ? n.resultatNet / n.capitauxPropres : null);
    const div = d.dividendes.filter((x) => x.code === code && x.disponibleLe <= date).sort((a, b) => b.exercice - a.exercice)[0];
    brut.rdt.set(code, div && cours > 0 ? div.montant / cours : null);
  }
  const familles: Record<FamilleFacteur, Map<string, number | null>> = {
    valorisation: famille([rangTransversal(rapportMediane(brut.per, d.familles), -1), rangTransversal(rapportMediane(brut.pb, d.familles), -1)], codes),
    qualite: famille([rangTransversal(brut.croiss, 1), rangTransversal(rapportMediane(brut.roe, d.familles), 1)], codes),
    rendement: famille([rangTransversal(brut.rdt, 1)], codes),
    tendance: famille([rangTransversal(brut.t60, 1), rangTransversal(brut.t120, 1)], codes),
    risque: famille([rangTransversal(brut.vol, -1), rangTransversal(brut.dd, -1)], codes),
  };
  const out = new Map<string, ScoresFamilles>();
  for (const c of codes) {
    out.set(c, {
      valorisation: familles.valorisation.get(c) ?? null,
      qualite: familles.qualite.get(c) ?? null,
      rendement: familles.rendement.get(c) ?? null,
      tendance: familles.tendance.get(c) ?? null,
      risque: familles.risque.get(c) ?? null,
    });
  }
  return out;
}
```

- [ ] **Step 4: Lancer les tests**

Run: `cd scraper && npx vitest run tests/conseillerFacteurs.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck et commit**

```bash
cd scraper && npm run typecheck && cd ..
git add scraper/src/conseiller/facteurs.ts scraper/tests/conseillerFacteurs.test.ts
git commit -m "feat(conseiller): cinq familles de facteurs, rang transversal, sans regard vers l'avant"
```

---

### Task 8: Décision et `evaluerSeance`

**Files:**
- Create: `scraper/src/conseiller/decision.ts`
- Create: `scraper/src/conseiller/evaluerSeance.ts`
- Test: `scraper/tests/conseillerDecision.test.ts`

- [ ] **Step 1: Écrire les tests**

```ts
import { describe, it, expect } from 'vitest';
import { decider } from '../src/conseiller/decision.js';
import { evaluerSeance } from '../src/conseiller/evaluerSeance.js';
import { indiceEquipondere } from '../src/conseiller/indice.js';
import { univers } from './conseillerFabrique.js';

const sc = (xs: (number | null)[]) => ({ valorisation: xs[0] ?? null, qualite: xs[1] ?? null, rendement: xs[2] ?? null, tendance: xs[3] ?? null, risque: xs[4] ?? null });

describe('decider', () => {
  it('Acheter quand 3 familles ≥ +1/3 et aucune ≤ −2/3', () => {
    expect(decider(sc([0.5, 0.4, 0.34, 0, -0.5]), 'A').action).toBe('acheter');
  });
  it('Conserver si une famille s oppose fortement', () => {
    expect(decider(sc([0.5, 0.4, 0.34, 0, -0.7]), 'A').action).toBe('conserver');
  });
  it('Vendre symétriquement', () => {
    expect(decider(sc([-0.5, -0.4, -0.34, 0, 0.5]), 'B').action).toBe('vendre');
  });
  it('Conserver (liquidité) en classe C ou D, quels que soient les scores', () => {
    const r = decider(sc([0.9, 0.9, 0.9, 0.9, 0.9]), 'D');
    expect(r.action).toBe('conserver');
    expect(r.raison).toBe('liquidite');
  });
  it('Abstention sous 2 familles disponibles', () => {
    expect(decider(sc([0.9, null, null, null, null]), 'A').raison).toBe('abstention');
  });
  it('Classe de liquidité inconnue : pas de recommandation active', () => {
    expect(decider(sc([0.9, 0.9, 0.9, 0.9, 0.9]), null).raison).toBe('liquidite');
  });
});

describe('evaluerSeance', () => {
  it('est déterministe et triée par code', () => {
    const d = univers(200, Array.from({ length: 20 }, (_, k) => (k - 10) / 20));
    const ind = indiceEquipondere(d);
    const a = evaluerSeance(d, ind, d.calendrier[190]!);
    const b = evaluerSeance(d, ind, d.calendrier[190]!);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.map((x) => x.code)).toEqual([...a.map((x) => x.code)].sort());
  });
});
```

- [ ] **Step 2: Lancer (échec attendu)**

Run: `cd scraper && npx vitest run tests/conseillerDecision.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter `decision.ts`**

```ts
import type { LiquidityClass } from '../liquidity/compute.js';
import { FAMILLES_FACTEURS, type Action, type Decision, type FamilleFacteur } from './types.js';

/** Règle FIGÉE (spec §5). */
export const REGLE = { K: 3, seuilConcorde: 1 / 3, seuilOppose: 2 / 3, minFamilles: 2 } as const;

export function decider(
  scores: Record<FamilleFacteur, number | null>,
  classe: LiquidityClass | null,
): Pick<Decision, 'action' | 'concordantes' | 'disponibles' | 'raison'> {
  const vals = FAMILLES_FACTEURS.map((f) => scores[f]).filter((v): v is number => v != null);
  const disponibles = vals.length;
  if (classe == null || classe === 'C' || classe === 'D') return { action: 'conserver', concordantes: 0, disponibles, raison: 'liquidite' };
  if (disponibles < REGLE.minFamilles) return { action: 'conserver', concordantes: 0, disponibles, raison: 'abstention' };
  const pour = vals.filter((v) => v >= REGLE.seuilConcorde).length;
  const contre = vals.filter((v) => v <= -REGLE.seuilConcorde).length;
  const opposeAchat = vals.some((v) => v <= -REGLE.seuilOppose);
  const opposeVente = vals.some((v) => v >= REGLE.seuilOppose);
  let action: Action = 'conserver';
  if (pour >= REGLE.K && !opposeAchat) action = 'acheter';
  else if (contre >= REGLE.K && !opposeVente) action = 'vendre';
  return {
    action,
    concordantes: action === 'acheter' ? pour : action === 'vendre' ? contre : 0,
    disponibles,
    raison: action === 'conserver' ? 'pas_de_concordance' : 'concordance',
  };
}
```

- [ ] **Step 4: Implémenter `evaluerSeance.ts`**

```ts
import { decider } from './decision.js';
import { scoresFamilles } from './facteurs.js';
import { classeA } from './liquiditeGlissante.js';
import type { Indice } from './indice.js';
import type { Decision, Donnees } from './types.js';

/**
 * FONCTION UNIQUE appelée par le banc ET par le futur job quotidien (spec §6).
 * Décisions de toutes les valeurs cotées à `date`, avec les seules données
 * antérieures ou égales à `date`. Triées par code (sortie déterministe).
 */
export function evaluerSeance(d: Donnees, ind: Indice, date: string): Decision[] {
  const scores = scoresFamilles(d, ind, date);
  const out: Decision[] = [];
  for (const [code, sc] of [...scores].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const classe = classeA(d.series.get(code)!, d.calendrier, date);
    out.push({ code, date, scores: sc, ...decider(sc, classe) });
  }
  return out;
}
```

- [ ] **Step 5: Lancer les tests**

Run: `cd scraper && npx vitest run tests/conseillerDecision.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add scraper/src/conseiller/decision.ts scraper/src/conseiller/evaluerSeance.ts scraper/tests/conseillerDecision.test.ts
git commit -m "feat(conseiller): règle de décision K-sur-5 et evaluerSeance unique"
```

---

### Task 9: Banc de preuve

**Files:**
- Create: `scraper/src/conseiller/banc.ts`
- Test: `scraper/tests/conseillerBanc.test.ts`

- [ ] **Step 1: Écrire les tests**

```ts
import { describe, it, expect } from 'vitest';
import { datesRebalancement, ecartsParDate, verdictBanc, PROTOCOLE } from '../src/conseiller/banc.js';
import { calendrier } from './conseillerFabrique.js';

describe('datesRebalancement', () => {
  it('prend une date toutes les 20 séances, avec 21 séances de recul à la fin', () => {
    const cal = calendrier(100);
    const ds = datesRebalancement(cal, cal[0]!, 20);
    expect(ds[0]).toBe(cal[0]);
    expect(ds[1]).toBe(cal[20]);
    expect(cal.indexOf(ds.at(-1)!) + 1 + 20 < cal.length).toBe(true);
  });
});

describe('ecartsParDate', () => {
  it('fait la moyenne Acheter − moyenne Vendre, coûts déduits, et saute une date sans les deux', () => {
    const r = ecartsParDate([
      { date: 'd1', achats: [0.05, 0.03], ventes: [0.01] },
      { date: 'd2', achats: [0.02], ventes: [] },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]!.ecart).toBeCloseTo(0.04 - 0.01 - PROTOCOLE.cout, 10);
  });
});

describe('verdictBanc', () => {
  it('« prouvé » si la borne basse unilatérale dépasse 0 avec ≥ 30 dates', () => {
    expect(verdictBanc(Array.from({ length: 60 }, (_, i) => 0.02 + (i % 3) * 0.001)).verdict).toBe('prouve');
  });
  it('« non prouvé » sur du bruit centré', () => {
    expect(verdictBanc(Array.from({ length: 60 }, (_, i) => (i % 2 ? 0.05 : -0.05))).verdict).toBe('non_prouve');
  });
  it('« insuffisant » sous 30 dates', () => {
    expect(verdictBanc([0.1, 0.1, 0.1]).verdict).toBe('insuffisant');
  });
});
```

- [ ] **Step 2: Lancer (échec attendu)**

Run: `cd scraper && npx vitest run tests/conseillerBanc.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

```ts
import { bootstrapIid, bootstrapStationnaire, moyenne, quantile, testSigne } from './stats.js';
import { evaluerSeance } from './evaluerSeance.js';
import { perfIndice, type Indice } from './indice.js';
import { rendementTotal } from './dividendes.js';
import { FAMILLES_FACTEURS, type Donnees, type FamilleFacteur } from './types.js';

/** Protocole FIGÉ (spec §2). Toute modification invalide le PREREG. */
export const PROTOCOLE = {
  horizon: 20,
  horizonSecondaire: 60,
  /** Coût aller-retour déduit de l'écart Acheter − Vendre (1,5 %). */
  cout: 0.015,
  blocMoyen: 3,
  tirages: 10000,
  graine: 20261109,
  minDates: 30,
  limiteVariation: 7.5,
} as const;

/** Une date toutes les `pas` séances, en gardant entrée (t+1) et sortie (t+1+pas) dans le calendrier. */
export function datesRebalancement(calendrier: string[], debut: string, pas: number): string[] {
  const out: string[] = [];
  const i0 = calendrier.findIndex((d) => d >= debut);
  for (let i = i0; i >= 0 && i + 1 + pas < calendrier.length; i += pas) out.push(calendrier[i]!);
  return out;
}

export interface Panier { date: string; achats: number[]; ventes: number[] }

export function ecartsParDate(paniers: Panier[]): { date: string; ecart: number }[] {
  return paniers
    .filter((p) => p.achats.length > 0 && p.ventes.length > 0)
    .map((p) => ({ date: p.date, ecart: moyenne(p.achats) - moyenne(p.ventes) - PROTOCOLE.cout }));
}

export type VerdictBanc = 'prouve' | 'non_prouve' | 'insuffisant';

export function verdictBanc(ecarts: number[]): { verdict: VerdictBanc; moyenne: number | null; borneBasse: number | null; n: number } {
  if (ecarts.length < PROTOCOLE.minDates) {
    return { verdict: 'insuffisant', moyenne: ecarts.length ? moyenne(ecarts) : null, borneBasse: null, n: ecarts.length };
  }
  const boot = bootstrapStationnaire(ecarts, { blocMoyen: PROTOCOLE.blocMoyen, tirages: PROTOCOLE.tirages, graine: PROTOCOLE.graine });
  const borneBasse = quantile(boot, 0.05);
  return { verdict: borneBasse > 0 ? 'prouve' : 'non_prouve', moyenne: moyenne(ecarts), borneBasse, n: ecarts.length };
}

export interface OptionsBanc {
  debut: string;
  fin?: string;
  horizon?: number;
  /** Robustesse : exclure les valeurs de classe C/D (au lieu de les forcer à Conserver). */
  exclureCD?: boolean;
  /** Robustesse : exclure les valeurs à la limite de variation le jour du signal. */
  exclureLimite?: boolean;
}

/** Règle appliquée à chaque date : signal à t, entrée à t+1, sortie à t+1+h, en excès de l'indice. */
export function construirePaniers(d: Donnees, ind: Indice, o: OptionsBanc): {
  paniers: Panier[]; conserves: Map<string, { total: number; conserver: number }>; exclues: number;
} {
  const h = o.horizon ?? PROTOCOLE.horizon;
  const dates = datesRebalancement(d.calendrier, o.debut, PROTOCOLE.horizon).filter((x) => !o.fin || x <= o.fin);
  const paniers: Panier[] = [];
  const conserves = new Map<string, { total: number; conserver: number }>();
  let exclues = 0;
  for (const date of dates) {
    const iCal = d.calendrier.indexOf(date);
    const entree = d.calendrier[iCal + 1];
    const sortie = d.calendrier[iCal + 1 + h];
    if (!entree || !sortie) continue;
    const marche = perfIndice(ind, d.calendrier, entree, sortie);
    const panier: Panier = { date, achats: [], ventes: [] };
    const an = date.slice(0, 4);
    const acc = conserves.get(an) ?? { total: 0, conserver: 0 };
    for (const dec of evaluerSeance(d, ind, date)) {
      if (o.exclureCD && dec.raison === 'liquidite') continue;
      const s = d.series.get(dec.code)!;
      const p = s.pos.get(date)!;
      if (o.exclureLimite && Math.abs(s.variations[p] ?? 0) >= PROTOCOLE.limiteVariation) continue;
      acc.total++;
      if (dec.action === 'conserver') { acc.conserver++; continue; }
      const a = s.pos.get(entree);
      const b = s.pos.get(sortie);
      if (a == null || b == null) { exclues++; continue; }
      const r = rendementTotal(s, dec.code, d.dividendes, a, b);
      if (r == null) { exclues++; continue; }
      (dec.action === 'acheter' ? panier.achats : panier.ventes).push(r - marche);
    }
    conserves.set(an, acc);
    paniers.push(panier);
  }
  return { paniers, conserves, exclues };
}

/** Analyse secondaire : par famille, tiers haut − tiers bas en excès du marché, par date. */
export function ecartsFamille(d: Donnees, ind: Indice, debut: string, f: FamilleFacteur): number[] {
  const out: number[] = [];
  for (const date of datesRebalancement(d.calendrier, debut, PROTOCOLE.horizon)) {
    const iCal = d.calendrier.indexOf(date);
    const entree = d.calendrier[iCal + 1]!;
    const sortie = d.calendrier[iCal + 1 + PROTOCOLE.horizon]!;
    const marche = perfIndice(ind, d.calendrier, entree, sortie);
    const haut: number[] = [];
    const bas: number[] = [];
    for (const dec of evaluerSeance(d, ind, date)) {
      const v = dec.scores[f];
      if (v == null) continue;
      const s = d.series.get(dec.code)!;
      const a = s.pos.get(entree);
      const b = s.pos.get(sortie);
      if (a == null || b == null) continue;
      const r = rendementTotal(s, dec.code, d.dividendes, a, b);
      if (r == null) continue;
      if (v >= 1 / 3) haut.push(r - marche);
      else if (v <= -1 / 3) bas.push(r - marche);
    }
    if (haut.length && bas.length) out.push(moyenne(haut) - moyenne(bas));
  }
  return out;
}

/** Sur-confiance d'un banc qui regroupe les cas : largeur de l'IC par dates / largeur de l'IC par cas. */
export function ratioLargeurs(paniers: Panier[]): number | null {
  const cas = paniers.flatMap((p) => [...p.achats, ...p.ventes.map((x) => -x)]);
  const dates = ecartsParDate(paniers).map((e) => e.ecart);
  if (cas.length < 10 || dates.length < 10) return null;
  const bc = bootstrapIid(cas, 2000, PROTOCOLE.graine);
  const bd = bootstrapStationnaire(dates, { blocMoyen: PROTOCOLE.blocMoyen, tirages: 2000, graine: PROTOCOLE.graine });
  const largeur = (b: number[]) => quantile(b, 0.975) - quantile(b, 0.025);
  return largeur(bd) / largeur(bc);
}

export { testSigne, FAMILLES_FACTEURS };
```

- [ ] **Step 4: Lancer les tests**

Run: `cd scraper && npx vitest run tests/conseillerBanc.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add scraper/src/conseiller/banc.ts scraper/tests/conseillerBanc.test.ts
git commit -m "feat(conseiller): banc de preuve (unité = date, t+1, coûts, bootstrap stationnaire)"
```

---

### Task 10: Audit pur des données (étape 0)

**Files:**
- Create: `scraper/src/conseiller/audit.ts`
- Test: `scraper/tests/conseillerAudit.test.ts`

- [ ] **Step 1: Écrire les tests**

```ts
import { describe, it, expect } from 'vitest';
import { sautsSuspects, partFigee, radiees, couvertureParAn } from '../src/conseiller/audit.js';
import { calendrier, serie } from './conseillerFabrique.js';

const cal = calendrier(40);

describe('audit', () => {
  it('repère une division par 2 et une division par 10', () => {
    const s = serie(cal, cal.map((_, i) => (i < 10 ? 1000 : i < 20 ? 500 : 50)));
    expect(sautsSuspects(new Map([['A', s]])).map((x) => x.date)).toEqual([cal[10], cal[20]]);
  });
  it('mesure la part de séances non échangées', () => {
    expect(partFigee(serie(cal, cal.map(() => 100), [0, 1, 2, 3]))).toBeCloseTo(0.1);
  });
  it('liste les codes sans cotation depuis plus de 30 jours calendaires', () => {
    const a = serie(cal, cal.map(() => 100));
    const b = serie(cal.slice(0, 5), [1, 1, 1, 1, 1]);
    expect(radiees(new Map([['A', a], ['B', b]]), cal.at(-1)!, 30)).toEqual(['B']);
  });
  it('compte les valeurs couvertes par année', () => {
    expect(couvertureParAn([{ code: 'A', annee: 2020 }, { code: 'B', annee: 2020 }, { code: 'A', annee: 2021 }])).toEqual({ 2020: 2, 2021: 1 });
  });
});
```

- [ ] **Step 2: Lancer (échec attendu)**

Run: `cd scraper && npx vitest run tests/conseillerAudit.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

```ts
import type { Serie } from './types.js';

/** Sauts d'une séance à l'autre hors de [×0,6 ; ×1,6] : fractionnement possible (÷2 compris). */
export function sautsSuspects(series: Map<string, Serie>): { code: string; date: string; ratio: number }[] {
  const out: { code: string; date: string; ratio: number }[] = [];
  for (const [code, s] of series) {
    for (let i = 1; i < s.cours.length; i++) {
      const ratio = s.cours[i]! / s.cours[i - 1]!;
      if (ratio < 0.6 || ratio > 1.6) out.push({ code, date: s.dates[i]!, ratio });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function partFigee(s: Serie): number {
  return s.volumes.filter((v) => v <= 0).length / s.volumes.length;
}

/** Codes dont la dernière cotation précède `derniere` de plus de `joursMax` jours calendaires. */
export function radiees(series: Map<string, Serie>, derniere: string, joursMax: number): string[] {
  const limite = new Date(Date.parse(derniere) - joursMax * 86400000).toISOString().slice(0, 10);
  return [...series].filter(([, s]) => (s.dates.at(-1) ?? '') < limite).map(([c]) => c).sort();
}

export function couvertureParAn(lignes: { code: string; annee: number }[]): Record<number, number> {
  const m = new Map<number, Set<string>>();
  for (const l of lignes) (m.get(l.annee) ?? m.set(l.annee, new Set()).get(l.annee)!).add(l.code);
  return Object.fromEntries([...m].sort((a, b) => a[0] - b[0]).map(([a, s]) => [a, s.size]));
}
```

- [ ] **Step 4: Lancer les tests**

Run: `cd scraper && npx vitest run tests/conseillerAudit.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scraper/src/conseiller/audit.ts scraper/tests/conseillerAudit.test.ts
git commit -m "feat(conseiller): audit pur des données (sauts, cours figés, radiées, couverture)"
```

---

### Task 11: Chargement historique, runners audit et EMD

**Files:**
- Create: `scraper/src/conseiller/historique.ts`
- Create: `scraper/src/conseiller/runAudit.ts`
- Create: `scraper/src/conseiller/runEmd.ts`
- Modify: `scraper/src/index.ts` (cases juste avant `case 'eval:signaux': {`, vers la ligne 551)
- Modify: `scraper/package.json` (scripts)

- [ ] **Step 1: Vérifier les noms de colonnes avant d'écrire la requête**

Run: `cd .. && grep -n "total_capitaux_propres\|actions_en_circulation\|famille_comptable" supabase/migrations/*.sql | head`
Expected: les trois colonnes existent (`balance_sheets.total_capitaux_propres`,
`income_statements.actions_en_circulation`, `brvm_instruments.famille_comptable`).
Si l'une manque, arrête-toi et remonte-le au contrôleur.

- [ ] **Step 2: Écrire `historique.ts`**

```ts
import { createHash } from 'node:crypto';
import { getSupabase } from '../persistence/supabase.js';
import { reconstituerExDate } from './dividendes.js';
import type { ComptesAnnuels, Dividende, Donnees, FamilleComptable, Serie } from './types.js';

const TAILLE = 1000;

async function toutLire<T>(construire: (a: number, b: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let a = 0; ; a += TAILLE) {
    const { data, error } = await construire(a, a + TAILLE - 1);
    if (error) throw new Error(`lecture : ${error.message}`);
    const lot = (data ?? []) as T[];
    out.push(...lot);
    if (lot.length < TAILLE) break;
  }
  return out;
}

/** Comptes de l'exercice N : publication réelle trouvée entre le 1er janvier et le 30 juin N+1, sinon 30 juin N+1. */
export function dispoComptes(pubs: { code: string; date_publication: string; libelle: string }[], code: string, exercice: number): string {
  const repli = `${exercice + 1}-06-30`;
  const motif = new RegExp(`(états? financiers|comptes|résultats?).*${exercice}`, 'i');
  const trouvee = pubs
    .filter((p) => p.code === code && p.date_publication > `${exercice}-12-31` && p.date_publication <= repli && motif.test(p.libelle))
    .map((p) => p.date_publication)
    .sort()[0];
  return trouvee ?? repli;
}

export interface Chargement { donnees: Donnees; empreinte: string }

/** Charge tout l'historique (paginé). Lecture seule. */
export async function chargerHistorique(): Promise<Chargement> {
  const sb = getSupabase();
  const cours = await toutLire<{ code: string; date_marche: string; cours_jour: number; volume: number | null; valeur_echangee: number | null; variation_pct: number | null }>((a, b) =>
    sb.from('brvm_actions_daily').select('code, date_marche, cours_jour, volume, valeur_echangee, variation_pct')
      .gt('cours_jour', 0).order('date_marche', { ascending: true }).order('code', { ascending: true }).range(a, b));
  const inst = await toutLire<{ code: string; famille_comptable: string | null }>((a, b) =>
    sb.from('brvm_instruments').select('code, famille_comptable').eq('type', 'action').order('code').range(a, b));
  const inc = await toutLire<{ code: string; periode: string; resultat_net: number | null; actions_en_circulation: number | null }>((a, b) =>
    sb.from('income_statements').select('code, periode, resultat_net, actions_en_circulation').eq('type_periode', 'annuel').order('code').order('periode').range(a, b));
  const bal = await toutLire<{ code: string; periode: string; total_capitaux_propres: number | null }>((a, b) =>
    sb.from('balance_sheets').select('code, periode, total_capitaux_propres').eq('type_periode', 'annuel').order('code').order('periode').range(a, b));
  const divs = await toutLire<{ code: string; exercice: number | null; montant: number; ex_date: string | null }>((a, b) =>
    sb.from('dividends').select('code, exercice, montant, ex_date').gt('montant', 0).not('exercice', 'is', null).order('code').order('exercice').range(a, b));
  const pubs = await toutLire<{ code: string; date_publication: string; libelle: string }>((a, b) =>
    sb.from('publications').select('code, date_publication, libelle').order('date_publication').order('code').range(a, b));

  const series = new Map<string, Serie>();
  const calSet = new Set<string>();
  for (const r of cours) {
    calSet.add(r.date_marche);
    let s = series.get(r.code);
    if (!s) series.set(r.code, (s = { dates: [], cours: [], volumes: [], valeurs: [], variations: [], pos: new Map() }));
    if (s.pos.has(r.date_marche)) continue;
    s.pos.set(r.date_marche, s.dates.length);
    s.dates.push(r.date_marche);
    s.cours.push(Number(r.cours_jour));
    s.volumes.push(Number(r.volume ?? 0));
    s.valeurs.push(Number(r.valeur_echangee ?? 0));
    s.variations.push(r.variation_pct == null ? null : Number(r.variation_pct));
  }
  const familles = new Map<string, FamilleComptable>();
  for (const i of inst) familles.set(i.code, i.famille_comptable === 'banque' ? 'banque' : 'general');

  const cp = new Map(bal.map((b) => [`${b.code}|${b.periode.slice(0, 4)}`, b.total_capitaux_propres]));
  const comptes: ComptesAnnuels[] = inc.map((r) => {
    const exercice = Number(r.periode.slice(0, 4));
    const capitaux = cp.get(`${r.code}|${exercice}`);
    return {
      code: r.code,
      exercice,
      resultatNet: r.resultat_net == null ? null : Number(r.resultat_net),
      capitauxPropres: capitaux == null ? null : Number(capitaux),
      actions: r.actions_en_circulation == null ? null : Number(r.actions_en_circulation),
      disponibleLe: dispoComptes(pubs, r.code, exercice),
    };
  });
  const dividendes: Dividende[] = divs.map((r) => {
    const exercice = Number(r.exercice);
    const s = series.get(r.code);
    const exDate = r.ex_date ?? (s ? reconstituerExDate(s, Number(r.montant), `${exercice + 1}-04-01`) : null);
    return { code: r.code, exercice, montant: Number(r.montant), disponibleLe: `${exercice + 1}-07-31`, exDate };
  });

  const empreinte = createHash('sha256')
    .update(JSON.stringify({ n: cours.length, d0: cours[0]?.date_marche, d1: cours.at(-1)?.date_marche, comptes, dividendes }))
    .digest('hex');
  return { donnees: { calendrier: [...calSet].sort(), series, comptes, dividendes, familles }, empreinte };
}
```

- [ ] **Step 3: Écrire `runAudit.ts`**

```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { chargerHistorique } from './historique.js';
import { couvertureParAn, partFigee, radiees, sautsSuspects } from './audit.js';

/** Étape 0 (spec §3) : écrit docs/conseiller/audit-donnees.md. Lecture seule. */
export async function runAudit(): Promise<string> {
  const { donnees: d, empreinte } = await chargerHistorique();
  const sauts = sautsSuspects(d.series);
  const derniere = d.calendrier.at(-1)!;
  const figees = [...d.series].map(([c, s]) => ({ c, f: partFigee(s), n: s.dates.length })).sort((a, b) => b.f - a.f);
  const avecDate = d.dividendes.filter((x) => x.exDate != null).length;
  const md = [
    `# Audit des données — Conseiller v2`,
    ``,
    `Exécuté le ${new Date().toISOString()} · empreinte des données \`${empreinte}\``,
    `Calendrier : ${d.calendrier[0]} → ${derniere} (${d.calendrier.length} séances), ${d.series.size} valeurs.`,
    ``,
    `## 1. Sauts de cours hors de [×0,6 ; ×1,6] (${sauts.length})`,
    ``,
    `| Valeur | Date | Rapport |`,
    `|---|---|---|`,
    ...sauts.map((s) => `| ${s.code} | ${s.date} | ${s.ratio.toFixed(3)} |`),
    ``,
    `À recouper un par un avec les opérations sur titres connues. Un fractionnement non ajusté exige une table d'ajustements AVANT le banc.`,
    ``,
    `## 2. Cours figés (part de séances sans échange)`,
    ``,
    `| Valeur | Séances | Part figée |`,
    `|---|---|---|`,
    ...figees.map((p) => `| ${p.c} | ${p.n} | ${(p.f * 100).toFixed(1)} % |`),
    ``,
    `## 3. Valeurs sans cotation depuis 30 jours (radiées ou suspendues)`,
    ``,
    radiees(d.series, derniere, 30).join(', ') || 'aucune',
    ``,
    `Sens du biais : si des sociétés radiées manquent à la base, le banc favorise la famille « risque » et pénalise « Vendre ».`,
    ``,
    `## 4. Couverture fondamentale (valeurs couvertes par exercice)`,
    ``,
    '```json',
    JSON.stringify(couvertureParAn(d.comptes.filter((c) => c.resultatNet != null).map((c) => ({ code: c.code, annee: c.exercice })))),
    '```',
    ``,
    `## 5. Dividendes`,
    ``,
    `${d.dividendes.length} dividendes exploitables, dont ${avecDate} avec une ex-date réelle ou reconstituée (${((100 * avecDate) / Math.max(1, d.dividendes.length)).toFixed(0)} %).`,
    `Les autres excluent les fenêtres mai-août de leur valeur (spec §3.5b).`,
    ``,
  ].join('\n');
  mkdirSync('../docs/conseiller', { recursive: true });
  writeFileSync('../docs/conseiller/audit-donnees.md', md);
  return md;
}
```

- [ ] **Step 4: Écrire `runEmd.ts`** (n'imprime JAMAIS une moyenne ni un signe)

```ts
import { chargerHistorique } from './historique.js';
import { indiceEquipondere } from './indice.js';
import { construirePaniers, ecartsParDate } from './banc.js';
import { ecartType, effetMinimalDetectable } from './stats.js';

/**
 * EMD (spec §2.4) : écart-type des écarts par date sur la PREMIÈRE MOITIÉ du
 * calendrier. Ne renvoie que l'écart-type, les effectifs et l'EMD. La moyenne
 * n'est jamais calculée ici, pour ne pas lire le résultat avant le PREREG.
 */
export async function runEmd(): Promise<{ ecartTypePts: number; nMoitie: number; nTotalEstime: number; emdAnnualisePct: number }> {
  const { donnees: d } = await chargerHistorique();
  const ind = indiceEquipondere(d);
  const milieu = d.calendrier[Math.floor(d.calendrier.length / 2)]!;
  const { paniers } = construirePaniers(d, ind, { debut: d.calendrier[0]!, fin: milieu });
  const ecarts = ecartsParDate(paniers).map((e) => e.ecart);
  if (ecarts.length < 10) throw new Error(`EMD impossible : ${ecarts.length} dates avec Acheter ET Vendre sur la première moitié`);
  const sdPts = ecartType(ecarts) * 100;
  const nTotalEstime = ecarts.length * 2;
  return { ecartTypePts: sdPts, nMoitie: ecarts.length, nTotalEstime, emdAnnualisePct: effetMinimalDetectable(sdPts, nTotalEstime).annualise };
}
```

- [ ] **Step 5: Brancher les commandes**

Dans `scraper/src/index.ts`, juste avant `case 'eval:signaux': {` :

```ts
    case 'conseiller:audit': {
      const { runAudit } = await import('./conseiller/runAudit.js');
      const md = await runAudit();
      logger.info({ octets: md.length }, 'conseiller:audit écrit dans docs/conseiller/audit-donnees.md');
      break;
    }
    case 'conseiller:emd': {
      const { runEmd } = await import('./conseiller/runEmd.js');
      // Seuls l'écart-type et l'EMD sortent : jamais la moyenne (spec §2.4).
      console.log(JSON.stringify(await runEmd(), null, 2));
      break;
    }
```

Dans `scraper/package.json`, section `scripts`, à côté de `"eval:signaux"` :

```json
    "conseiller:audit": "tsx src/index.ts conseiller:audit",
    "conseiller:emd": "tsx src/index.ts conseiller:emd",
    "conseiller:banc": "tsx src/index.ts conseiller:banc",
    "conseiller:v1": "tsx src/index.ts conseiller:v1",
```

- [ ] **Step 6: Typecheck**

Run: `cd scraper && npm run typecheck`
Expected: aucune erreur.

- [ ] **Step 7: Lancer l'audit en réel**

Run: `cd scraper && npm run conseiller:audit`
Expected: `docs/conseiller/audit-donnees.md` écrit. Le lire en entier.

- [ ] **Step 8: POINT D'ARRÊT — fractionnements**

Pour chaque saut de la section 1 dont le rapport vaut environ 1/n (0,5 ; 0,2 ;
0,1) ou n, **arrête l'exécution** et remonte la liste au contrôleur. Une table
d'ajustements fera alors l'objet d'une tâche ajoutée au plan. Ne la crée pas
toi-même.

- [ ] **Step 9: Lancer l'EMD**

Run: `cd scraper && npm run conseiller:emd`
Expected: JSON `{ ecartTypePts, nMoitie, nTotalEstime, emdAnnualisePct }`.
Note ces quatre nombres. **Si `emdAnnualisePct > 8`, arrête l'exécution** et
remonte-le au contrôleur (spec §2.4) : l'exploitant reformule le critère avant
toute suite.

- [ ] **Step 10: Commit**

```bash
git add scraper/src/conseiller/historique.ts scraper/src/conseiller/runAudit.ts scraper/src/conseiller/runEmd.ts scraper/src/index.ts scraper/package.json docs/conseiller/audit-donnees.md
git commit -m "feat(conseiller): chargement historique, audit des données et EMD"
```

---

### Task 12: Pré-enregistrement (PREREG.md)

**Files:**
- Create: `scraper/src/conseiller/PREREG.md`

- [ ] **Step 1: Écrire PREREG.md**

Contenu à écrire. Les quatre lignes de la section « Puissance » et la ligne
« Empreinte » reprennent les valeurs RÉELLEMENT imprimées en tâche 11 (steps 7
et 9), sans arrondi inventé.

```markdown
# PREREG — Conseiller v2

Commité AVANT toute lecture du test confirmatoire. Toute modification après la
lecture invalide celle-ci (spec §2.2). Référence :
docs/superpowers/specs/2026-11-09-conseiller-v2-design.md.

## Test confirmatoire (unique)
- Statistique par date : moyenne des « Acheter » − moyenne des « Vendre », en
  excès de l'indice équipondéré, entrée à t+1, sortie à t+1+20, rendement total,
  moins 1,5 % (coût aller-retour).
- Dates : toutes les 20 séances depuis la première séance de l'historique. Une
  date sans Acheter ET Vendre est sautée et comptée.
- Test unilatéral (Acheter > Vendre), α = 5 %. Bootstrap stationnaire, blocs
  moyens de 3 dates, 10 000 tirages, graine 20261109.
- Prouvé ⇔ borne basse (5e centile) > 0 avec au moins 30 dates.
- Un seul test : pas de correction de Holm.

## Paramètres figés (facteurs.ts PARAMS, decision.ts REGLE, banc.ts PROTOCOLE)
- Tendance 60/120 séances relative à l'indice ; risque : volatilité 60, plus
  forte baisse 120 ; 60 % de séances échangées minimum, sinon null.
- Valorisation : PER, P/B rapportés à la médiane de la famille comptable
  (banque / général, ≥ 5 valeurs) ; qualité : croissance du résultat, ROE
  rapporté à la médiane ; rendement : dividende de l'exercice connu / cours.
- Rang transversal → [−1, +1] ; une famille couvrant moins de 15 valeurs à une
  date est nulle à cette date.
- Décision : K = 3 familles ≥ +1/3 et aucune ≤ −2/3 (Acheter), symétrique
  (Vendre) ; liquidité C/D ou inconnue → Conserver ; moins de 2 familles →
  abstention.

## Calendrier de disponibilité
- Comptes de l'exercice N : date de publication trouvée dans `publications`
  (libellé états financiers / comptes / résultats + année), sinon 30 juin N+1.
- Dividende de l'exercice N : 31 juillet N+1. Ex-date réelle, sinon
  reconstituée (baisse ±20 % du montant dans les 60 séances après le 1er avril
  N+1), sinon fenêtres mai-août exclues pour la valeur.

## Puissance (tâche 11, step 9)
- Écart-type des écarts par date (première moitié) : [ecartTypePts] points
- Dates sur la première moitié : [nMoitie] ; total estimé : [nTotalEstime]
- EMD annualisé : [emdAnnualisePct] % (seuil d'arrêt : 8 %)

## Analyses secondaires (descriptives, sans valeur de preuve)
Par famille (tiers haut − tiers bas) ; Acheter − marché ; horizon 60 séances ;
robustesse sans classes C/D ; robustesse sans valeurs à la limite ±7,5 % ; test
de signe ; rapport des largeurs d'IC (dates / cas regroupés) ; taux de
Conserver par année.

## Ce qui a déjà été vu
L'exploitant et l'auteur connaissent la trajectoire du marché 2022-2026 et le
diagnostic v1 (juin-novembre 2026). La validation est NON RETOUCHÉE, pas aveugle.

## Données
Empreinte (audit) : [empreinte en tête de docs/conseiller/audit-donnees.md]
```

Les crochets `[…]` désignent les valeurs à recopier depuis la sortie réelle.
Aucun crochet ne doit rester dans le fichier commité.

- [ ] **Step 2: Vérifier qu'il ne reste aucun crochet**

Run: `grep -n "\[ecart\|\[n\|\[emd\|\[empreinte" scraper/src/conseiller/PREREG.md`
Expected: aucune ligne.

- [ ] **Step 3: Commit — c'est ce commit qui fige le protocole**

```bash
git add scraper/src/conseiller/PREREG.md
git commit -m "docs(conseiller): pré-enregistrement du banc v2 (protocole figé avant lecture)"
git log -1 --format=%H -- scraper/src/conseiller/PREREG.md
```

---

### Task 13: Runner du banc (lecture unique) et re-mesure v1

**Files:**
- Create: `scraper/src/conseiller/runBanc.ts`
- Create: `scraper/src/conseiller/runV1.ts`
- Modify: `scraper/src/index.ts`

- [ ] **Step 1: Écrire `runBanc.ts`**

```ts
import { execSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { chargerHistorique } from './historique.js';
import { indiceEquipondere } from './indice.js';
import { construirePaniers, ecartsFamille, ecartsParDate, ratioLargeurs, testSigne, verdictBanc, FAMILLES_FACTEURS, PROTOCOLE } from './banc.js';
import { bootstrapStationnaire, moyenne, quantile } from './stats.js';

const RAPPORT = '../docs/conseiller/rapport-banc-v2.md';

/**
 * Lecture unique (spec §2.2, §2.7). Refuse de tourner si PREREG.md n'est pas
 * commité sans modification locale, ou si le rapport existe déjà, sauf
 * relecture consignée (sa raison est écrite dans le rapport, qui perd alors
 * sa valeur de validation).
 */
export async function runBanc(relecture: string | null): Promise<string> {
  const modifie = execSync('git status --porcelain -- src/conseiller/PREREG.md').toString().trim();
  const sha = execSync('git log -1 --format=%H -- src/conseiller/PREREG.md').toString().trim();
  if (!sha || modifie) throw new Error('PREREG.md doit être commité et inchangé avant la lecture du banc');
  if (existsSync(RAPPORT) && !relecture) throw new Error('rapport déjà produit : lecture unique. Relecture seulement avec --relecture "<raison>"');

  const { donnees: d, empreinte } = await chargerHistorique();
  const ind = indiceEquipondere(d);
  const debut = d.calendrier[0]!;
  const pts = (x: number | null) => (x == null ? '—' : `${(x * 100).toFixed(2)} pts`);
  const ic90 = (xs: number[]) => {
    if (xs.length < 10) return '—';
    const b = bootstrapStationnaire(xs, { blocMoyen: PROTOCOLE.blocMoyen, tirages: PROTOCOLE.tirages, graine: PROTOCOLE.graine });
    return `[${(quantile(b, 0.05) * 100).toFixed(2)} ; ${(quantile(b, 0.95) * 100).toFixed(2)}]`;
  };
  const ligne = (nom: string, xs: number[]) => `| ${nom} | ${xs.length} | ${pts(xs.length ? moyenne(xs) : null)} | ${ic90(xs)} |`;

  const principal = construirePaniers(d, ind, { debut });
  const ecarts = ecartsParDate(principal.paniers).map((e) => e.ecart);
  const v = verdictBanc(ecarts);
  const signe = testSigne(ecarts);
  const ecartsDe = (o: Parameters<typeof construirePaniers>[2]) => ecartsParDate(construirePaniers(d, ind, o).paniers).map((e) => e.ecart);
  const achatMarche = principal.paniers.filter((p) => p.achats.length).map((p) => moyenne(p.achats));

  const md = [
    `# Banc du Conseiller v2 — rapport`,
    ``,
    `PREREG \`${sha}\` · données \`${empreinte}\` · exécuté le ${new Date().toISOString()}`,
    relecture ? `\n**RELECTURE CONSIGNÉE** : ${relecture}. Ce rapport ne vaut plus validation.\n` : '',
    `## Test confirmatoire`,
    ``,
    `- Verdict : **${v.verdict}**`,
    `- Dates utilisables : ${v.n} (sautées faute d'Acheter et de Vendre : ${principal.paniers.length - v.n})`,
    `- Écart moyen Acheter − Vendre, coûts déduits : ${pts(v.moyenne)} par 20 séances`,
    `- Borne basse unilatérale 95 % : ${pts(v.borneBasse)}`,
    `- Test de signe : ${signe.positifs}/${signe.n} dates positives, p = ${signe.p.toFixed(4)}`,
    `- Observations exclues (fenêtre dividende sans ex-date, cours manquant) : ${principal.exclues}`,
    ``,
    `## Analyses secondaires (descriptives)`,
    ``,
    `| Analyse | Dates | Moyenne | IC 90 % |`,
    `|---|---|---|---|`,
    ligne('Sans classes C/D', ecartsDe({ debut, exclureCD: true })),
    ligne('Sans valeurs à la limite', ecartsDe({ debut, exclureLimite: true })),
    ligne('Horizon 60 séances', ecartsDe({ debut, horizon: PROTOCOLE.horizonSecondaire })),
    ligne('Acheter − marché (avant coûts)', achatMarche),
    ...FAMILLES_FACTEURS.map((f) => ligne(`Famille ${f} (tiers haut − bas)`, ecartsFamille(d, ind, debut, f))),
    ``,
    `Rapport des largeurs d'IC (dates / cas regroupés) : ${ratioLargeurs(principal.paniers)?.toFixed(2) ?? '—'}`,
    ``,
    `## Taux de « Conserver » par année`,
    ``,
    `| Année | Décisions | Conserver |`,
    `|---|---|---|`,
    ...[...principal.conserves].map(([an, c]) => `| ${an} | ${c.total} | ${((100 * c.conserver) / Math.max(1, c.total)).toFixed(0)} % |`),
    ``,
  ].join('\n');
  writeFileSync(RAPPORT, md);
  return md;
}
```

- [ ] **Step 2: Écrire `runV1.ts`**

```ts
import { writeFileSync } from 'node:fs';
import { getSupabase } from '../persistence/supabase.js';
import { chargerHistorique } from './historique.js';
import { indiceEquipondere, perfIndice } from './indice.js';
import { ecartsParDate, verdictBanc, PROTOCOLE, type Panier } from './banc.js';
import { rendementTotal } from './dividendes.js';

/** Re-mesure de v1 (advisor_history) : même statistique par date, même coût, même bootstrap. */
export async function runV1(): Promise<string> {
  const sb = getSupabase();
  const lignes: { date_marche: string; code: string; action: string }[] = [];
  for (let a = 0; ; a += 1000) {
    const { data, error } = await sb.from('advisor_history').select('date_marche, code, action').order('date_marche').order('code').range(a, a + 999);
    if (error) throw new Error(error.message);
    const lot = (data ?? []) as typeof lignes;
    lignes.push(...lot);
    if (lot.length < 1000) break;
  }
  const { donnees: d } = await chargerHistorique();
  const ind = indiceEquipondere(d);
  const datesV1 = [...new Set(lignes.map((l) => l.date_marche))].sort();
  const retenues = datesV1.filter((_, i) => i % PROTOCOLE.horizon === 0);
  const paniers: Panier[] = [];
  for (const date of retenues) {
    const iCal = d.calendrier.indexOf(date);
    const entree = d.calendrier[iCal + 1];
    const sortie = d.calendrier[iCal + 1 + PROTOCOLE.horizon];
    if (iCal < 0 || !entree || !sortie) continue;
    const marche = perfIndice(ind, d.calendrier, entree, sortie);
    const p: Panier = { date, achats: [], ventes: [] };
    for (const l of lignes.filter((x) => x.date_marche === date && x.action !== 'conserver')) {
      const s = d.series.get(l.code);
      const a = s?.pos.get(entree);
      const b = s?.pos.get(sortie);
      if (!s || a == null || b == null) continue;
      const r = rendementTotal(s, l.code, d.dividendes, a, b);
      if (r != null) (l.action === 'acheter' ? p.achats : p.ventes).push(r - marche);
    }
    paniers.push(p);
  }
  const v = verdictBanc(ecartsParDate(paniers).map((e) => e.ecart));
  const f = (x: number | null) => (x == null ? '—' : `${(x * 100).toFixed(2)} pts`);
  const md = [
    `# Re-mesure du moteur v1`,
    ``,
    `Séances v1 : ${datesV1.length} ; dates indépendantes retenues : ${retenues.length} ; utilisables : ${v.n}.`,
    `Verdict : **${v.verdict}** (moyenne ${f(v.moyenne)}, borne basse ${f(v.borneBasse)}).`,
    `Sous 30 dates, « insuffisant » est attendu : v1 n'a que ${datesV1.length} séances d'historique.`,
    ``,
  ].join('\n');
  writeFileSync('../docs/conseiller/remesure-v1.md', md);
  return md;
}
```

- [ ] **Step 3: Brancher les commandes** (dans `scraper/src/index.ts`, après `conseiller:emd`)

```ts
    case 'conseiller:banc': {
      const { runBanc } = await import('./conseiller/runBanc.js');
      const i = process.argv.indexOf('--relecture');
      const relecture = i > 0 ? (process.argv[i + 1] ?? null) : null;
      console.log(await runBanc(relecture));
      break;
    }
    case 'conseiller:v1': {
      const { runV1 } = await import('./conseiller/runV1.js');
      console.log(await runV1());
      break;
    }
```

- [ ] **Step 4: Typecheck et suite complète**

Run: `cd scraper && npm run typecheck && npx vitest run`
Expected: typecheck sans erreur, toute la suite PASS (aucune régression).

- [ ] **Step 5: Commit AVANT la lecture**

```bash
git add scraper/src/conseiller/runBanc.ts scraper/src/conseiller/runV1.ts scraper/src/index.ts
git commit -m "feat(conseiller): runner du banc (lecture unique) et re-mesure v1"
```

- [ ] **Step 6: Lecture unique du banc**

Run: `cd scraper && npm run conseiller:banc`
Expected: `docs/conseiller/rapport-banc-v2.md` écrit. **Plus aucun paramètre ne
change après cette commande.**

- [ ] **Step 7: Re-mesure v1**

Run: `cd scraper && npm run conseiller:v1`
Expected: `docs/conseiller/remesure-v1.md` écrit.

- [ ] **Step 8: Commit des rapports**

```bash
git add docs/conseiller/rapport-banc-v2.md docs/conseiller/remesure-v1.md
git commit -m "docs(conseiller): rapport du banc v2 (lecture unique) et re-mesure v1"
```

---

### Task 14: IC par dates dans le banc des signaux existant (spec §2.8)

**Files:**
- Modify: `scraper/src/signaux/evaluation.ts` (interface `ResultatTranche` vers la ligne 56, `evaluerSignaux` vers la ligne 108, `formaterRapport` vers la ligne 183)
- Test: `scraper/tests/evaluationSignaux.test.ts`

- [ ] **Step 1: Ajouter le test** (à la fin de `scraper/tests/evaluationSignaux.test.ts`)

```ts
describe('IC par dates (spec conseiller v2 §2.8)', () => {
  it('expose ic95Dates et en tire le verdict', () => {
    const codes = Array.from({ length: 10 }, (_, i) => `C${i}`);
    const dates = Array.from({ length: 400 }, (_, i) => new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10));
    const cours = codes.flatMap((code, k) => {
      let c = 100;
      return dates.map((date, i) => { c *= 1 + Math.sin(i / 7) * 0.02 + k * 0.0001; return { code, date, cours: c }; });
    });
    const signaux = codes.flatMap((code) => dates.slice(0, 350).map((date) => ({ code, date, score: 0.7 })));
    const r = evaluerSignaux(signaux, cours, { horizons: [20] }).find((x) => x.tranche.id === 'achat')!;
    expect(r).toHaveProperty('ic95Dates');
  });
});
```

Ajoute `describe` et `evaluerSignaux` aux imports en tête du fichier s'ils n'y
sont pas.

- [ ] **Step 2: Lancer (échec attendu)**

Run: `cd scraper && npx vitest run tests/evaluationSignaux.test.ts`
Expected: FAIL, `ic95Dates` absent.

- [ ] **Step 3: Implémenter**

Dans `ResultatTranche`, après la propriété `ic95` :

```ts
  /** IC à 95 % calculé sur UNE moyenne par date (unité d'indépendance = la date). */
  ic95Dates: [number, number] | null;
```

Dans `evaluerSignaux`, juste avant `resultats.push({` :

```ts
      const parDate = new Map<string, number[]>();
      indep.forEach((o, i) => (parDate.get(o.date) ?? parDate.set(o.date, []).get(o.date)!).push(exces[i]!));
      const moyennesDates = [...parDate.values()].map(moyenne);
      const ic95Dates = intervalleBootstrap(moyennesDates, 2000, opts.graine ?? 42);
```

Dans l'objet poussé, ajoute `ic95Dates,` et remplace
`verdict: verdictDe(indep.length, ic),` par
`verdict: verdictDe(parDate.size, ic95Dates),`.

Dans `formaterRapport`, ajoute une colonne « IC 95 % (dates) » à l'en-tête du
tableau et, sur chaque ligne, la même mise en forme que celle déjà utilisée
pour `r.ic95`, appliquée à `r.ic95Dates`.

- [ ] **Step 4: Lancer les tests**

Run: `cd scraper && npx vitest run tests/evaluationSignaux.test.ts`
Expected: PASS. Si un test existant attendait un verdict « prouvé » obtenu avec
l'ancien IC, **ne le modifie pas pour qu'il passe** : remonte-le au contrôleur.
C'est un résultat (la sur-confiance corrigée), pas un bug.

- [ ] **Step 5: Commit**

```bash
git add scraper/src/signaux/evaluation.ts scraper/tests/evaluationSignaux.test.ts
git commit -m "fix(signaux): IC et verdict par dates (unité d'indépendance), spec conseiller v2 §2.8"
```

---

### Task 15: PORTE HUMAINE — fin du plan

- [ ] **Step 1: Pousser la branche et ouvrir une PR en brouillon**

```bash
git push -u origin design/conseiller-v2
gh pr create --draft --base main --title "Conseiller v2 : banc de preuve et moteur (avant porte humaine)" --body "Spec docs/superpowers/specs/2026-11-09-conseiller-v2-design.md. Rapports dans docs/conseiller/. Rien n'est en production : aucune migration, aucun job, aucun changement frontend."
```

- [ ] **Step 2: S'arrêter**

Remettre à l'exploitant, sans interprétation flatteuse :
- `docs/conseiller/audit-donnees.md`
- `docs/conseiller/rapport-banc-v2.md` (verdict, écart, borne basse, dates, taux de Conserver)
- `docs/conseiller/remesure-v1.md`

**Aucune étape suivante** (migration, job, frontend, track record) ne commence
sans décision écrite de l'exploitant. Si le verdict est `non_prouve` ou
`insuffisant`, la suite proposée est d'afficher l'abstention du Conseiller, pas
de retoucher les paramètres.
