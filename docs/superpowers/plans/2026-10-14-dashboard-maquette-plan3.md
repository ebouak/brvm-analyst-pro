# Tableau de bord — plan 3 : refonte visuelle selon la maquette

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** faire ressembler `/dashboard` en production à la maquette (https://claude.ai/artifact/4ctBnG2srfNZhBnYBjeRwC) : surface unique à filets, récit de séance en tête, trajectoire des indices, mouvements avec tendance 20 séances, secteurs divergents, rangée actualités / motifs / Afrique — sans rien perdre des blocs, de l'ordre par profil, des verrous premium ni des règles d'honnêteté.

**Architecture:** modules purs testés (`recit.ts`, `graphe.ts`) ; kit de surface (`components/dashboard/surface/`) ; composants de bloc serveur, sauf la trajectoire (client, bascule) et la pastille de séance (client, horloge) ; chargeurs serveur ajoutés à `chargement.ts` ; la page recompose les sections par clé de widget.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind (jetons de `tailwind.config.ts` : `ivory`, `muted`, `faint`, `up`, `down`, `warn`, `accent`, `accent-ink`, `border`, `border-strong`, `surface`, `bg`), SVG pur, vitest.

**Spec :** `docs/superpowers/specs/2026-10-14-dashboard-adaptatif-design.md` §12 (et §4, §8, §9).

**Branche :** `feat/dashboard-maquette` (depuis `origin/main` = `f3f7f35`), worktree `C:/Users/adego/wt/brvm-textes`. Commandes depuis `frontend/`.

**Règles pour chaque tâche :** jamais `npm run build` ; `timeout 600 npx tsc --noEmit` doit afficher EXIT 0 avant chaque commit ; une donnée absente → phrase omise ou « — », jamais 0 ; moins typographique « − » via `lib/format.ts` ; aucun conseil ; apostrophes réelles dans les chaînes JS (`&apos;` seulement en texte JSX) ; aucune couleur hex brute ; commits terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1 : Récit de séance (pur)

**Files:** Create `frontend/lib/dashboard/recit.ts`, `frontend/lib/dashboard/recit.test.ts`.

- [ ] **Step 1 : tests** — créer `frontend/lib/dashboard/recit.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { titreSeance, chapoSeance } from './recit';
import { fmtNumber, fmtFcfa } from '@/lib/format';

describe('titreSeance', () => {
  it('repli, hausse, équilibre ; accords', () => {
    expect(titreSeance(15, 22)).toBe('Séance en repli : 22 baisses pour 15 hausses');
    expect(titreSeance(22, 1)).toBe('Séance en hausse : 22 hausses pour 1 baisse');
    expect(titreSeance(10, 10)).toBe('Séance équilibrée : 10 hausses, 10 baisses');
  });
  it('données absentes ou aucune valeur en mouvement : null', () => {
    expect(titreSeance(null, 3)).toBeNull();
    expect(titreSeance(0, 0)).toBeNull();
  });
});

describe('chapoSeance', () => {
  it('trois phrases quand tout est connu', () => {
    const c = chapoSeance({
      composite: { valeur: 545.46, variationPct: -0.26 },
      meneur: { code: 'BRVMINDU', variationPct: 1.95 },
      valeurEchangee: 2_919_495_128,
      valeurEchangeeVeille: 2_956_520_400,
    });
    const d = (2_919_495_128 / 2_956_520_400 - 1) * 100;
    expect(c).toBe(
      `Le BRVM Composite cède ${fmtNumber(0.26, 2)} % à ${fmtNumber(545.46, 2)} points. ` +
      `Les industriels mènent les secteurs (+${fmtNumber(1.95, 2)} %). ` +
      `${fmtFcfa(2_919_495_128)} FCFA échangés, −${fmtNumber(Math.abs(d), 1)} % sur la veille.`,
    );
  });
  it('phrase omise si la donnée manque ; secteur en baisse : « résiste le mieux »', () => {
    const c = chapoSeance({ composite: null, meneur: { code: 'BRVMENER', variationPct: -0.1 }, valeurEchangee: null, valeurEchangeeVeille: null });
    expect(c).toBe(`L'énergie résiste le mieux (−${fmtNumber(0.1, 2)} %).`);
  });
  it('Composite inchangé à deux décimales : « stable »', () => {
    expect(chapoSeance({ composite: { valeur: 500, variationPct: 0.004 }, meneur: null, valeurEchangee: null, valeurEchangeeVeille: null }))
      .toBe(`Le BRVM Composite est stable à ${fmtNumber(500, 2)} points.`);
  });
  it('secteur inconnu : phrase omise, aucune invention', () => {
    expect(chapoSeance({ composite: null, meneur: { code: 'XXX', variationPct: 1 }, valeurEchangee: null, valeurEchangeeVeille: null })).toBe('');
  });
});
```

- [ ] **Step 2 :** `npx vitest run lib/dashboard/recit.test.ts` → FAIL.

- [ ] **Step 3 : implémenter** `frontend/lib/dashboard/recit.ts` :

```ts
/**
 * Récit d'ouverture du tableau de bord (spec §12) — PUR et testé. Chaque
 * phrase n'existe que si sa donnée existe ; aucun mot qui ne s'appuie sur
 * une mesure ; aucune cause affirmée.
 */
import { fmtNumber, fmtFcfa, fmtPctSigne, fmtPctAbs } from '@/lib/format';

/** [sujet de phrase, pluriel ?] : « Les industriels mènent », « L'énergie mène ». */
export const SUJETS: Record<string, [string, boolean]> = {
  BRVMCBASE: ['La consommation de base', false],
  BRVMCDISC: ['La consommation discrétionnaire', false],
  BRVMENER: ["L'énergie", false],
  BRVMFINS: ['Les services financiers', true],
  BRVMINDU: ['Les industriels', true],
  BRVMSPUB: ['Les services publics', true],
  BRVMTELE: ['Les télécommunications', true],
};

const fini = (x: number | null | undefined): x is number => typeof x === 'number' && Number.isFinite(x);
const n = (k: number, un: string, plus: string) => `${k} ${k > 1 ? plus : un}`;

export function titreSeance(hausses: number | null, baisses: number | null): string | null {
  if (!fini(hausses) || !fini(baisses) || hausses + baisses === 0) return null;
  if (baisses > hausses) return `Séance en repli : ${n(baisses, 'baisse', 'baisses')} pour ${n(hausses, 'hausse', 'hausses')}`;
  if (hausses > baisses) return `Séance en hausse : ${n(hausses, 'hausse', 'hausses')} pour ${n(baisses, 'baisse', 'baisses')}`;
  return `Séance équilibrée : ${n(hausses, 'hausse', 'hausses')}, ${n(baisses, 'baisse', 'baisses')}`;
}

export function chapoSeance(e: {
  composite: { valeur: number; variationPct: number } | null;
  meneur: { code: string; variationPct: number } | null;
  valeurEchangee: number | null;
  valeurEchangeeVeille: number | null;
}): string {
  const phrases: string[] = [];
  if (e.composite && fini(e.composite.valeur) && fini(e.composite.variationPct)) {
    const v = e.composite.variationPct;
    phrases.push(
      Number(v.toFixed(2)) === 0
        ? `Le BRVM Composite est stable à ${fmtNumber(e.composite.valeur, 2)} points.`
        : `Le BRVM Composite ${v < 0 ? 'cède' : 'gagne'} ${fmtPctAbs(v)} à ${fmtNumber(e.composite.valeur, 2)} points.`,
    );
  }
  const sujet = e.meneur ? SUJETS[e.meneur.code] : undefined;
  if (e.meneur && sujet && fini(e.meneur.variationPct)) {
    const [s, pluriel] = sujet;
    phrases.push(
      e.meneur.variationPct > 0
        ? `${s} ${pluriel ? 'mènent' : 'mène'} les secteurs (${fmtPctSigne(e.meneur.variationPct)}).`
        : `${s} ${pluriel ? 'résistent' : 'résiste'} le mieux (${fmtPctSigne(e.meneur.variationPct)}).`,
    );
  }
  if (fini(e.valeurEchangee) && e.valeurEchangee > 0) {
    let t = `${fmtFcfa(e.valeurEchangee)} FCFA échangés`;
    if (fini(e.valeurEchangeeVeille) && e.valeurEchangeeVeille > 0) {
      t += `, ${fmtPctSigne((e.valeurEchangee / e.valeurEchangeeVeille - 1) * 100, 1)} sur la veille`;
    }
    phrases.push(`${t}.`);
  }
  return phrases.join(' ');
}
```

- [ ] **Step 4 :** vitest → PASS ; tsc → EXIT 0.
- [ ] **Step 5 : commit** `feat(dashboard): récit de séance tiré des chiffres (titre, chapô)`.

---

### Task 2 : Géométrie des graphes (pur)

**Files:** Create `frontend/lib/dashboard/graphe.ts`, `frontend/lib/dashboard/graphe.test.ts`.

- [ ] **Step 1 : tests** — `frontend/lib/dashboard/graphe.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { echelle, cheminSparkline, indexMinInterieur, barresDivergentes } from './graphe';

describe('echelle', () => {
  it('marge de 15 % et 5 graduations régulières', () => {
    const e = echelle([100, 200])!;
    expect(e.bas).toBeCloseTo(85, 9);
    expect(e.haut).toBeCloseTo(215, 9);
    expect(e.graduations).toHaveLength(5);
    expect(e.graduations[0]).toBeCloseTo(85, 9);
    expect(e.graduations[4]).toBeCloseTo(215, 9);
  });
  it('série plate : marge de 1', () => {
    expect(echelle([50, 50])).toMatchObject({ bas: 49, haut: 51 });
  });
  it('valeurs non finies ignorées ; vide → null', () => {
    expect(echelle([Number.NaN])).toBeNull();
  });
});

describe('cheminSparkline', () => {
  it('points dans le cadre, premier à gauche, dernier à droite', () => {
    const p = cheminSparkline([1, 3, 2], 84, 24)!;
    expect(p.points.split(' ')).toHaveLength(3);
    expect(p.points.startsWith('3.0,')).toBe(true);
    expect(p.dernier[0]).toBeCloseTo(81, 6);
    expect(p.hausse).toBe(true);
  });
  it('moins de deux points finis : null', () => {
    expect(cheminSparkline([5], 84, 24)).toBeNull();
    expect(cheminSparkline([5, Number.NaN], 84, 24)).toBeNull();
  });
});

describe('indexMinInterieur', () => {
  it('minimum strictement intérieur, sinon null', () => {
    expect(indexMinInterieur([3, 1, 2])).toBe(1);
    expect(indexMinInterieur([1, 2, 3])).toBeNull();
    expect(indexMinInterieur([3, 2, 1])).toBeNull();
  });
});

describe('barresDivergentes', () => {
  it('largeur relative au plus grand écart, plancher 0,5 point', () => {
    const b = barresDivergentes([{ cle: 'A', v: 2 }, { cle: 'B', v: -1 }, { cle: 'C', v: 0 }]);
    expect(b).toEqual([
      { cle: 'A', v: 2, largeur: 50, sens: 'up' },
      { cle: 'B', v: -1, largeur: 25, sens: 'down' },
      { cle: 'C', v: 0, largeur: 0, sens: 'flat' },
    ]);
    expect(barresDivergentes([{ cle: 'X', v: 0.1 }])[0]!.largeur).toBeCloseTo(10, 9);
  });
});
```

- [ ] **Step 2 :** vitest → FAIL.
- [ ] **Step 3 : implémenter** `frontend/lib/dashboard/graphe.ts` :

```ts
/** Géométrie des graphes du tableau de bord (spec §12). PUR, une seule échelle par graphe. */
const fini = (x: number) => Number.isFinite(x);

export function echelle(valeurs: number[], pas = 4): { bas: number; haut: number; graduations: number[] } | null {
  const v = valeurs.filter(fini);
  if (v.length === 0) return null;
  let bas = Math.min(...v), haut = Math.max(...v);
  const marge = (haut - bas) * 0.15 || 1;
  bas -= marge; haut += marge;
  return { bas, haut, graduations: Array.from({ length: pas + 1 }, (_, k) => bas + ((haut - bas) / pas) * k) };
}

/** Polyligne d'une sparkline dans un cadre l × h (marge intérieure `m`). */
export function cheminSparkline(serie: number[], l: number, h: number, m = 3):
  { points: string; dernier: [number, number]; hausse: boolean } | null {
  if (serie.length < 2 || !serie.every(fini)) return null;
  const lo = Math.min(...serie), hi = Math.max(...serie), e = hi - lo || 1;
  const pts = serie.map((v, i): [number, number] => [(i / (serie.length - 1)) * (l - 2 * m) + m, (1 - (v - lo) / e) * (h - 2 * m) + m]);
  return {
    points: pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '),
    dernier: pts[pts.length - 1]!,
    hausse: serie[serie.length - 1]! >= serie[0]!,
  };
}

/** Indice du minimum s'il n'est ni le premier ni le dernier point (point bas à annoter). */
export function indexMinInterieur(valeurs: number[]): number | null {
  if (valeurs.length < 3) return null;
  const i = valeurs.indexOf(Math.min(...valeurs));
  return i > 0 && i < valeurs.length - 1 ? i : null;
}

/** Barres autour de zéro : `largeur` en % de la demi-jauge (0..50). */
export function barresDivergentes<K extends string>(vals: { cle: K; v: number }[]):
  { cle: K; v: number; largeur: number; sens: 'up' | 'down' | 'flat' }[] {
  const max = Math.max(0.5, ...vals.filter((x) => fini(x.v)).map((x) => Math.abs(x.v)));
  return vals.map((x) => ({
    cle: x.cle, v: x.v,
    largeur: fini(x.v) ? (Math.abs(x.v) / max) * 50 : 0,
    sens: !fini(x.v) || x.v === 0 ? 'flat' : x.v > 0 ? 'up' : 'down',
  }));
}
```

- [ ] **Step 4 :** vitest → PASS ; tsc → EXIT 0.
- [ ] **Step 5 : commit** `feat(dashboard): géométrie des graphes (échelle, sparkline, point bas, barres divergentes)`.

---

### Task 3 : Surface à filets — rangées, cellules, cadre plat

**Files:** Modify `frontend/lib/dashboard/widgets.ts`, `frontend/lib/dashboard/widgets.test.ts`, `frontend/app/dashboard/page.tsx` (rendu des rangées) ; Create `frontend/components/dashboard/surface/Grille.tsx` ; Modify `frontend/components/dashboard/blocs/Cadre.tsx`.

- [ ] **Step 1 : largeurs et classes** — dans `widgets.ts` :
  - `LARGEUR` : `signaux: 'pleine'`, `actus: 'pleine'` (ces sections portent leur propre rangée interne) ; `secteurs` reste `'tiers'`.
  - Remplacer `classeRangee` par, et ajouter `classeCellule` :

```ts
/** Rangée de la surface unique : grille 12 colonnes, filet sous la rangée (spec §12). */
export function classeRangee(_r: Rangee): string {
  return 'grid grid-cols-1 border-b border-border lg:grid-cols-12';
}

const SPAN: Record<Largeur, string> = { pleine: 'lg:col-span-12', demi: 'lg:col-span-6', tiers: 'lg:col-span-4' };

/** Cellule d'une rangée : filet vertical entre cellules (horizontal quand empilées). */
export function classeCellule(largeur: Largeur, seule: boolean): string {
  return `min-w-0 ${seule ? 'lg:col-span-12' : SPAN[largeur]} border-t border-border first:border-t-0 lg:border-t-0 lg:border-l lg:first:border-l-0`;
}
```

  - Tests : remplacer le test « un bloc seul dans sa rangée prend toute la largeur » par :

```ts
  it('rangée = grille 12 colonnes à filet ; cellule seule = pleine largeur', () => {
    expect(classeRangee({ largeur: 'demi', cles: ['agenda'] })).toBe('grid grid-cols-1 border-b border-border lg:grid-cols-12');
    expect(classeCellule('demi', true)).toContain('lg:col-span-12');
    expect(classeCellule('demi', false)).toContain('lg:col-span-6');
    expect(classeCellule('tiers', false)).toContain('lg:col-span-4');
    expect(classeCellule('tiers', false)).toContain('lg:border-l');
  });
```

  ajouter `classeCellule` à l'import du test ; adapter toute attente qui vérifiait `LARGEUR.signaux` / `LARGEUR.actus` = `'tiers'`, ou un groupement en rangées impliquant `signaux`/`actus`, à la nouvelle valeur `'pleine'`.

- [ ] **Step 2 : kit** — créer `frontend/components/dashboard/surface/Grille.tsx` :

```tsx
import type { ReactNode } from 'react';

const SPAN = { 4: 'lg:col-span-4', 6: 'lg:col-span-6', 8: 'lg:col-span-8', 12: 'lg:col-span-12' } as const;

/** Rangée interne d'une section (sans filet bas : la page le pose). */
export function GrilleInterne({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 lg:grid-cols-12">{children}</div>;
}

export function Cellule({ span, children }: { span: keyof typeof SPAN; children: ReactNode }) {
  return (
    <div className={`min-w-0 ${SPAN[span]} border-t border-border first:border-t-0 lg:border-t-0 lg:border-l lg:first:border-l-0`}>
      {children}
    </div>
  );
}

/** En-tête de bloc : titre en serif d'affichage, élément à droite (lien, pastille). */
export function TeteBloc({ id, titre, droite }: { id: string; titre: ReactNode; droite?: ReactNode }) {
  return (
    <header className="mb-3.5 flex flex-wrap items-baseline justify-between gap-3">
      <h2 id={id} className="font-display text-[19px] leading-tight text-ivory">{titre}</h2>
      {droite}
    </header>
  );
}

/** Bloc plat : padding seul ; les filets viennent de la rangée et des cellules. */
export function Bloc({ id, children, className = '' }: { id: string; children: ReactNode; className?: string }) {
  return <section aria-labelledby={id} className={`h-full min-w-0 py-5 lg:px-5 ${className}`}>{children}</section>;
}
```

- [ ] **Step 3 : cadre plat** — dans `components/dashboard/blocs/Cadre.tsx`, `CadreBloc` : la classe de `<section>` devient `h-full min-w-0 py-5 lg:px-5` (plus de `rounded-panel border border-border bg-surface p-4 sm:p-5`), le `<h2>` devient `font-display text-[19px] leading-tight text-ivory`. Rien d'autre ne change (date de référence, lien, `ancienne`, `sansDate`).

- [ ] **Step 4 : page** — dans `app/dashboard/page.tsx`, importer `classeCellule` et rendre les rangées ainsi :

```tsx
{grouperEnRangees(layout.filter((k) => sections[k] != null)).map((r) => (
  <div key={r.cles.join('-')} className={classeRangee(r)}>
    {r.cles.map((k) => (
      <div key={k} className={classeCellule(r.largeur, r.cles.length === 1)}>{sections[k]}</div>
    ))}
  </div>
))}
```

- [ ] **Step 5 :** `npx vitest run lib/dashboard/widgets.test.ts` → PASS ; tsc → EXIT 0.
- [ ] **Step 6 : commit** `feat(dashboard): surface unique à filets (rangées, cellules, cadre plat)`.

---

### Task 4 : Chargeurs supplémentaires

**Files:** Modify `frontend/lib/dashboard/chargement.ts`.

- [ ] **Step 1 :** ajouter à la fin de `chargement.ts` (mêmes conventions : `null` + journal en cas d'erreur) :

```ts
export type SerieIndice = { date: string; valeur: number }[];

/** 30 dernières séances de BRVMC et BRVM30 jusqu'à `jusquA` inclus, en ordre chronologique. */
export async function chargerTrajectoires(sb: SupabaseClient, jusquA: string, n = 30): Promise<Record<'BRVMC' | 'BRVM30', SerieIndice> | null> {
  const { data, error } = await sb
    .from('brvm_indices_daily')
    .select('code, date_marche, valeur')
    .in('code', ['BRVMC', 'BRVM30'])
    .lte('date_marche', jusquA)
    .not('valeur', 'is', null)
    .order('date_marche', { ascending: false })
    .limit(n * 2 + 10);
  if (error) return journal('trajectoires', error.message);
  const out: Record<'BRVMC' | 'BRVM30', SerieIndice> = { BRVMC: [], BRVM30: [] };
  for (const r of (data ?? []) as { code: 'BRVMC' | 'BRVM30'; date_marche: string; valeur: number }[]) {
    const s = out[r.code];
    if (s && s.length < n && Number.isFinite(Number(r.valeur))) s.push({ date: r.date_marche, valeur: Number(r.valeur) });
  }
  out.BRVMC.reverse(); out.BRVM30.reverse();
  return out;
}

/** Nombre de signaux par type pour une séance (moteur de signaux). */
export async function chargerCompteSignaux(sb: SupabaseClient, date: string): Promise<Record<string, number> | null> {
  const { data, error } = await sb.from('signals_daily').select('signal').eq('date_marche', date).limit(500);
  if (error) return journal('signaux (compte)', error.message);
  const c: Record<string, number> = {};
  for (const r of (data ?? []) as { signal: string }[]) c[r.signal] = (c[r.signal] ?? 0) + 1;
  return c;
}

export interface Actualite { titre: string; date_publication: string; source: string | null; source_url: string | null }

export async function chargerActualites(sb: SupabaseClient, aujourdhui: string, n = 5): Promise<Actualite[] | null> {
  const { data, error } = await sb
    .from('brvm_news')
    .select('titre, date_publication, source, source_url')
    .not('hidden', 'is', true)
    .lte('date_publication', aujourdhui)
    .order('date_publication', { ascending: false })
    .limit(n);
  if (error) return journal('actualités', error.message);
  return (data ?? []) as Actualite[];
}

export interface IndiceAfricain { code: string; libelle: string | null; place: string | null; date_marche: string; valeur: number | null; variation_pct: number | null }

export async function chargerAfrique(sb: SupabaseClient): Promise<IndiceAfricain[] | null> {
  const { data, error } = await sb
    .from('african_indices_daily')
    .select('code, libelle, place, date_marche, valeur, variation_pct')
    .order('date_marche', { ascending: false })
    .limit(30);
  if (error) return journal('indices africains', error.message);
  const derniers = new Map<string, IndiceAfricain>();
  for (const r of (data ?? []) as IndiceAfricain[]) if (!derniers.has(r.code)) derniers.set(r.code, r);
  return [...derniers.values()];
}

/** Nombre de motifs détectés pour une séance (le détail reste premium). */
export async function chargerCompteMotifs(sb: SupabaseClient, date: string): Promise<number | null> {
  const { count, error } = await sb.from('brvm_pattern_scores').select('*', { count: 'exact', head: true }).eq('date_marche', date);
  if (error) return journal('motifs (compte)', error.message);
  return count ?? 0;
}
```

- [ ] **Step 2 :** vérifier par `grep -rn "brvm_pattern_scores" ../supabase/migrations` que la table a bien une colonne `date_marche` ; sinon adapter le filtre à la colonne de date réelle. tsc → EXIT 0.
- [ ] **Step 3 : commit** `feat(dashboard): chargeurs de la maquette (trajectoires, signaux, actualités, Afrique, motifs)`.

---

### Task 5 : Récit d'ouverture

**Files:** Create `frontend/components/dashboard/surface/Ouverture.tsx`.

- [ ] **Step 1 : créer** :

```tsx
import { fmtNumber, fmtFcfa, fmtPctSigne, fmtDateFR } from '@/lib/format';
import BriefAssistant from '@/components/dashboard/BriefAssistant';

export interface Chiffre { libelle: string; valeur: string; variation: number | null; note?: string }

const ton = (v: number | null) => (v == null ? 'text-faint' : v > 0 ? 'text-up' : v < 0 ? 'text-down' : 'text-muted');

/** Spec §12 — la séance racontée : titre tiré des chiffres, chapô, six mesures. */
export default function Ouverture({ dateMarche, titre, chapo, chiffres }: {
  dateMarche: string; titre: string | null; chapo: string; chiffres: Chiffre[];
}) {
  const jour = new Date(`${dateMarche}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return (
    <section aria-labelledby="titre-seance" className="grid gap-8 py-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-end lg:px-5">
      <div className="min-w-0">
        <p className="overline text-faint">{jour}</p>
        <h2 id="titre-seance" className="mt-2 font-display text-[clamp(28px,3.1vw,40px)] leading-[1.08] tracking-tight text-ivory [text-wrap:balance]">
          {titre ?? `Séance du ${fmtDateFR(dateMarche)}`}
        </h2>
        {chapo && <p className="mt-2.5 max-w-[60ch] text-[15px] text-muted">{chapo}</p>}
        <div className="mt-3.5"><BriefAssistant /></div>
      </div>
      <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-border sm:grid-cols-3">
        {chiffres.map((c) => (
          <div key={c.libelle} className="min-w-0 border-b border-r border-border px-3.5 py-3">
            <dt className="overline text-faint">{c.libelle}</dt>
            <dd className="tabular mt-1.5 text-[19px] text-ivory">{c.valeur}</dd>
            <dd className={`tabular mt-0.5 text-xs ${ton(c.variation)}`}>
              {c.variation != null ? `${fmtPctSigne(c.variation)}${c.note ? ` ${c.note}` : ''}` : (c.note ?? '—')}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Formatage partagé des six mesures. */
export const fmtIndice = (v: number | null) => (v == null ? '—' : fmtNumber(v, 2));
export const fmtMd = (v: number | null) => (v == null ? '—' : `${fmtFcfa(v)} FCFA`);
```

  (Les filets internes de la grille de chiffres : `border-b border-r` sur chaque case suffit à la maquette ; un double filet sur le bord droit/bas est masqué par `overflow-hidden` + bordure extérieure — acceptable.)

- [ ] **Step 2 :** tsc → EXIT 0. `BriefAssistant` est partagé : ne pas modifier son style.
- [ ] **Step 3 : commit** `feat(dashboard): récit d'ouverture et six mesures de séance`.

---

### Task 6 : Trajectoire des indices, largeur et moteur

**Files:** Create `frontend/components/dashboard/surface/Trajectoire.tsx`, `frontend/components/dashboard/surface/LargeurMoteur.tsx`.

- [ ] **Step 1 : `Trajectoire.tsx`** (client, bascule) :

```tsx
'use client';

import { useState } from 'react';
import { useJetons } from '@/lib/theme/jetons';
import { fmtNumber, fmtPctSigne, fmtDateFR } from '@/lib/format';
import { echelle, indexMinInterieur } from '@/lib/dashboard/graphe';
import { TeteBloc } from './Grille';

type Code = 'BRVMC' | 'BRVM30';
const LIB: Record<Code, string> = { BRVMC: 'BRVM Composite', BRVM30: 'BRVM 30' };
const JETONS = ['accent', 'up', 'down', 'border', 'faint', 'muted', 'bg'] as const;
const W = 760, H = 230, G = { l: 46, r: 14, t: 12, b: 26 };
const court = (iso: string) => fmtDateFR(iso).slice(0, 5);

/** Spec §12 — trajectoire sur 30 séances, une seule échelle, point bas annoté. */
export default function Trajectoire({ series, jour }: { series: Record<Code, { date: string; valeur: number }[]>; jour: Record<Code, number | null> }) {
  const [code, setCode] = useState<Code>('BRVMC');
  const c = useJetons(JETONS);
  const s = series[code];
  const e = echelle(s.map((p) => p.valeur));
  const bascule = (
    <div role="group" aria-label="Indice affiché" className="inline-flex overflow-hidden rounded-md border border-border">
      {(['BRVMC', 'BRVM30'] as Code[]).map((k) => (
        <button key={k} type="button" aria-pressed={k === code} onClick={() => setCode(k)}
          className={`px-3 py-1.5 text-xs ${k === code ? 'bg-surface text-ivory' : 'text-muted hover:text-ivory'}`}>{LIB[k]}</button>
      ))}
    </div>
  );
  if (!e || s.length < 2) {
    return <section aria-labelledby="t-traj" className="py-5 lg:px-5"><TeteBloc id="t-traj" titre="Trajectoire des indices" droite={bascule} /><p className="text-sm text-muted">Historique insuffisant pour tracer la trajectoire.</p></section>;
  }
  const x = (i: number) => G.l + (i / (s.length - 1)) * (W - G.l - G.r);
  const y = (v: number) => G.t + (1 - (v - e.bas) / (e.haut - e.bas)) * (H - G.t - G.b);
  const pts = s.map((p, i) => `${x(i).toFixed(1)},${y(p.valeur).toFixed(1)}`);
  const debut = s[0]!.valeur, fin = s[s.length - 1]!.valeur, v30 = (fin / debut - 1) * 100;
  const iMin = indexMinInterieur(s.map((p) => p.valeur));
  const finCouleur = fin >= debut ? c.up : c.down;
  return (
    <section aria-labelledby="t-traj" className="py-5 lg:px-5">
      <TeteBloc id="t-traj" titre="Trajectoire des indices" droite={bascule} />
      <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="tabular text-[26px] leading-none text-ivory">{fmtNumber(fin, 2)}</span>
        <span className={`tabular text-sm ${v30 >= 0 ? 'text-up' : 'text-down'}`}>{fmtPctSigne(v30)}</span>
        <span className="tabular text-sm text-muted">sur {s.length} séances{jour[code] != null ? ` · jour ${fmtPctSigne(jour[code]!)}` : ''}</span>
        <span className="overline text-faint">du {court(s[0]!.date)} au {court(s[s.length - 1]!.date)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${LIB[code]} : ${fmtNumber(debut, 2)} le ${fmtDateFR(s[0]!.date)}, ${fmtNumber(fin, 2)} le ${fmtDateFR(s[s.length - 1]!.date)}`}>
        <defs>
          <linearGradient id="aire-traj" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c.accent} stopOpacity={0.22} />
            <stop offset="1" stopColor={c.accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        {e.graduations.map((v) => (
          <g key={v}>
            <line x1={G.l} x2={W - G.r} y1={y(v)} y2={y(v)} stroke={c.border} strokeWidth={1} />
            <text x={G.l - 8} y={y(v) + 3.5} textAnchor="end" fill={c.faint} fontSize={10.5}>{fmtNumber(v, 0)}</text>
          </g>
        ))}
        {[0, Math.floor((s.length - 1) / 2), s.length - 1].map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === s.length - 1 ? 'end' : 'middle'} fill={c.faint} fontSize={10.5}>{court(s[i]!.date)}</text>
        ))}
        <path d={`M${pts[0]} L${pts.join(' L')} L${x(s.length - 1)},${H - G.b} L${G.l},${H - G.b} Z`} fill="url(#aire-traj)" />
        <polyline points={pts.join(' ')} fill="none" stroke={c.accent} strokeWidth={2} strokeLinejoin="round" />
        <circle cx={x(s.length - 1)} cy={y(fin)} r={4} fill={finCouleur} stroke={c.bg} strokeWidth={2} />
        {iMin != null && (
          <g>
            <circle cx={x(iMin)} cy={y(s[iMin]!.valeur)} r={3} fill={c.down} />
            <text x={x(iMin) + (x(iMin) > W / 2 ? -8 : 8)} y={y(s[iMin]!.valeur) + 4} textAnchor={x(iMin) > W / 2 ? 'end' : 'start'} fill={c.muted} fontSize={10.5}>
              plus bas {fmtNumber(s[iMin]!.valeur, 2)} le {court(s[iMin]!.date)}
            </text>
          </g>
        )}
      </svg>
    </section>
  );
}
```

- [ ] **Step 2 : `LargeurMoteur.tsx`** (serveur) :

```tsx
import Link from 'next/link';
import { TeteBloc } from './Grille';

/** Spec §12 — largeur du marché (variations connues) et moteur de signaux. */
export default function LargeurMoteur({ hausses, baisses, stables, signaux }: {
  hausses: number | null; baisses: number | null; stables: number | null; signaux: Record<string, number> | null;
}) {
  const connue = hausses != null && baisses != null && stables != null && hausses + baisses + stables > 0;
  const total = connue ? hausses + baisses + stables : 0;
  const achats = signaux?.BUY ?? 0, ventes = signaux?.SELL ?? 0, attente = signaux?.HOLD ?? 0;
  const nbSignaux = achats + ventes + attente;
  return (
    <section aria-labelledby="t-largeur" className="py-5 lg:px-5">
      <TeteBloc id="t-largeur" titre="Largeur du marché" droite={connue ? <span className="overline text-faint">{total} valeurs</span> : undefined} />
      {connue ? (
        <>
          <div className="my-1 flex h-2.5 gap-0.5 overflow-hidden rounded" aria-hidden>
            <span className="block bg-up" style={{ flex: hausses }} />
            <span className="block bg-muted/50" style={{ flex: stables }} />
            <span className="block bg-down" style={{ flex: baisses }} />
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2">
            {([['Hausses', hausses, 'text-up'], ['Stables', stables, 'text-muted'], ['Baisses', baisses, 'text-down']] as const).map(([l, nb, t]) => (
              <div key={l} className="rounded-lg bg-surface px-3 py-2.5">
                <dt className="overline text-faint">{l}</dt>
                <dd className={`tabular mt-1.5 text-[22px] leading-none ${t}`}>{nb}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <p className="text-sm text-muted">Largeur du marché non mesurée pour cette séance.</p>
      )}
      <div className="mt-4 border-t border-border pt-4">
        <p className="overline text-faint">Moteur de signaux</p>
        {signaux === null ? (
          <p className="mt-2 text-sm text-muted">Signaux momentanément indisponibles.</p>
        ) : nbSignaux === 0 ? (
          <p className="mt-2 text-sm text-muted">Les signaux sont calculés après la clôture de la séance.</p>
        ) : (
          <>
            <p className="mt-2.5"><span className="tabular inline-flex gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs">
              {achats} achat · {ventes} vente · {attente} attente
            </span></p>
            <p className="mt-2 text-sm text-muted">
              {achats + ventes === 0
                ? `Aucune des ${nbSignaux} valeurs ne franchit le seuil d'un signal ce jour. Le moteur s'abstient quand aucune tendance n'est nette.`
                : `${achats + ventes} valeur${achats + ventes > 1 ? 's franchissent' : ' franchit'} le seuil d'un signal ce jour.`}
            </p>
          </>
        )}
        <p className="mt-2.5"><Link href="/signaux" className="text-sm text-accent-ink hover:underline">Voir tous les signaux →</Link></p>
      </div>
    </section>
  );
}
```

- [ ] **Step 3 :** tsc → EXIT 0. **Step 4 : commit** `feat(dashboard): trajectoire des indices, largeur du marché et moteur de signaux`.

---

### Task 7 : Mouvements et secteurs

**Files:** Create `frontend/components/dashboard/surface/Mouvements.tsx`, `frontend/components/dashboard/surface/Secteurs.tsx`.

- [ ] **Step 1 : `Mouvements.tsx`** :

```tsx
import Link from 'next/link';
import { fmtNumber, fmtPctSigne } from '@/lib/format';
import { cheminSparkline } from '@/lib/dashboard/graphe';
import { TeteBloc } from './Grille';

export interface LigneMouvement { code: string; nom: string; cours: number | null; variation: number | null; serie: number[] }

function Sparkline({ serie }: { serie: number[] }) {
  const p = cheminSparkline(serie, 84, 24);
  if (!p) return <span className="text-faint">—</span>;
  return (
    <svg width={84} height={24} viewBox="0 0 84 24" aria-hidden className="inline-block">
      <polyline points={p.points} fill="none" className={p.hausse ? 'stroke-up' : 'stroke-down'} strokeWidth={1.5} />
      <circle cx={p.dernier[0]} cy={p.dernier[1]} r={2.2} className={p.hausse ? 'fill-up' : 'fill-down'} />
    </svg>
  );
}

/** Spec §12 — plus fortes hausses ou baisses, tendance sur 20 séances. */
export default function Mouvements({ id, titre, lignes }: { id: string; titre: string; lignes: LigneMouvement[] }) {
  return (
    <section aria-labelledby={id} className="py-5 lg:px-5">
      <TeteBloc id={id} titre={titre} droite={<Link href="/actions" className="text-xs text-accent-ink hover:underline">Tout le marché</Link>} />
      {lignes.length === 0 ? <p className="text-sm text-muted">Aucune variation connue pour cette séance.</p> : (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[19rem] text-sm" aria-labelledby={id}>
            <thead className="text-[11px] uppercase tracking-wide text-faint">
              <tr>
                <th scope="col" className="px-1 pb-2 text-left font-medium">Valeur</th>
                <th scope="col" className="px-1 pb-2 text-right font-medium">Cours</th>
                <th scope="col" className="px-1 pb-2 text-right font-medium">Var.</th>
                <th scope="col" className="px-1 pb-2 text-right font-medium">20 séances</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l, i) => (
                <tr key={`${l.code}-${i}`} className="border-t border-border">
                  <th scope="row" className="px-1 py-1.5 text-left font-normal">
                    <Link href={`/actions/${l.code}`} className="tabular block text-[13px] text-ivory hover:text-accent-ink">{l.code}</Link>
                    <span className="block max-w-[16ch] truncate text-[11.5px] text-faint" title={l.nom}>{l.nom}</span>
                  </th>
                  <td className="tabular px-1 py-1.5 text-right text-ivory">{l.cours != null ? fmtNumber(l.cours, 0) : '—'}</td>
                  <td className={`tabular px-1 py-1.5 text-right ${l.variation == null ? 'text-faint' : l.variation > 0 ? 'text-up' : l.variation < 0 ? 'text-down' : 'text-muted'}`}>{l.variation != null ? fmtPctSigne(l.variation) : '—'}</td>
                  <td className="px-1 py-1.5 text-right"><Sparkline serie={l.serie} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2 : `Secteurs.tsx`** :

```tsx
import Link from 'next/link';
import { fmtPctSigne } from '@/lib/format';
import { barresDivergentes } from '@/lib/dashboard/graphe';
import { TeteBloc } from './Grille';

/** Spec §12 — indices sectoriels BRVM en barres divergentes autour de zéro. */
export default function Secteurs({ secteurs }: { secteurs: { code: string; nom: string; variation: number }[] }) {
  const tries = [...secteurs].sort((a, b) => b.variation - a.variation);
  const barres = barresDivergentes(tries.map((s) => ({ cle: s.code, v: s.variation })));
  return (
    <section aria-labelledby="t-secteurs" className="py-5 lg:px-5">
      <TeteBloc id="t-secteurs" titre="Indices sectoriels" droite={<Link href="/secteurs" className="text-xs text-accent-ink hover:underline">Secteurs</Link>} />
      {tries.length === 0 ? <p className="text-sm text-muted">Indices sectoriels non publiés pour cette séance.</p> : (
        <ul>
          {tries.map((s, i) => {
            const b = barres[i]!;
            return (
              <li key={s.code} className="grid grid-cols-[minmax(0,1fr)_7.5rem_4rem] items-center gap-2.5 border-t border-border py-1.5 text-[13px] first:border-t-0">
                <span className="min-w-0 truncate text-ivory" title={s.nom}>{s.nom}</span>
                <span className="relative h-2" aria-hidden>
                  <span className="absolute -inset-y-[3px] left-1/2 w-px bg-border" />
                  {b.sens !== 'flat' && (
                    <span className={`absolute inset-y-0 rounded-sm ${b.sens === 'up' ? 'left-1/2 bg-up' : 'right-1/2 bg-down'}`} style={{ width: `${b.largeur}%` }} />
                  )}
                </span>
                <span className={`tabular text-right ${s.variation > 0 ? 'text-up' : s.variation < 0 ? 'text-down' : 'text-muted'}`}>{fmtPctSigne(s.variation)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 3 :** tsc → EXIT 0. **Step 4 : commit** `feat(dashboard): mouvements avec tendance 20 séances et secteurs divergents`.

---

### Task 8 : Signaux, actualités, motifs, Afrique

**Files:** Create `SignauxRecents.tsx`, `Actualites.tsx`, `Motifs.tsx`, `Afrique.tsx` dans `frontend/components/dashboard/surface/`.

- [ ] **Step 1 : `SignauxRecents.tsx`** :

```tsx
import Link from 'next/link';
import type { SignalDaily } from '@/lib/types';
import { TeteBloc } from './Grille';

const LIB: Record<string, string> = { BUY: 'Achat', SELL: 'Vente', HOLD: 'Attente' };

/** Signaux récents (premium) au style de la surface ; un libellé et un lien vers l'explication, pas d'incitation. */
export default function SignauxRecents({ signaux }: { signaux: SignalDaily[] }) {
  const actionnables = signaux.filter((s) => s.signal !== 'HOLD').slice(0, 4);
  return (
    <section aria-labelledby="t-signaux" className="py-5 lg:px-5">
      <TeteBloc id="t-signaux" titre="Signaux d'opportunité" droite={<Link href="/signaux" className="text-xs text-accent-ink hover:underline">Tous les signaux</Link>} />
      {actionnables.length === 0 ? <p className="text-sm text-muted">Aucun signal d'achat ni de vente sur cette séance : le moteur s'abstient.</p> : (
        <ul>
          {actionnables.map((s, i) => (
            <li key={`${s.code}-${i}`} className="flex items-baseline gap-3 border-t border-border py-2 text-sm first:border-t-0">
              <Link href={`/actions/${s.code}`} className="tabular font-semibold text-ivory hover:text-accent-ink">{s.code}</Link>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${s.signal === 'BUY' ? 'border-up/40 text-up' : 'border-down/40 text-down'}`}>{LIB[s.signal] ?? s.signal}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-faint">Signaux calculés et expliqués sur chaque fiche ; ce ne sont pas des conseils en investissement.</p>
    </section>
  );
}
```

  Si l'actuel `RecentSignalsCard` affiche la confiance, reprendre la même présentation de la confiance (même échelle) après le libellé ; sinon ne rien ajouter.

- [ ] **Step 2 : `Actualites.tsx`** :

```tsx
import Link from 'next/link';
import { fmtDateFR } from '@/lib/format';
import type { Actualite } from '@/lib/dashboard/chargement';
import { TeteBloc } from './Grille';

const sure = (u: string | null) => (u && /^https?:\/\//i.test(u.trim()) ? u.trim() : null);

export default function Actualites({ items }: { items: Actualite[] | null }) {
  return (
    <section aria-labelledby="t-actus" className="py-5 lg:px-5">
      <TeteBloc id="t-actus" titre="Actualités" droite={<Link href="/actualites" className="text-xs text-accent-ink hover:underline">Toutes</Link>} />
      {items === null ? <p className="text-sm text-muted">Actualités momentanément indisponibles.</p> : items.length === 0 ? <p className="text-sm text-muted">Aucune actualité récente.</p> : (
        <ul>
          {items.map((n, i) => {
            const url = sure(n.source_url);
            return (
              <li key={`${n.date_publication}-${i}`} className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-3 border-t border-border py-2 text-[13.5px] first:border-t-0 first:pt-0">
                <time dateTime={n.date_publication} className="tabular text-[11.5px] leading-relaxed text-faint">{fmtDateFR(n.date_publication.slice(0, 10)).slice(0, 5)}</time>
                {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="break-words text-ivory hover:text-accent-ink">{n.titre}</a> : <span className="break-words text-ivory">{n.titre}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
```

  Note : `chargement.ts` est `server-only` ; n'importer que le **type** (`import type`), effacé à la compilation.

- [ ] **Step 3 : `Motifs.tsx`** :

```tsx
import Link from 'next/link';
import { PremiumLock } from '@/components/dashboard/PremiumLock';
import { fmtDateFR } from '@/lib/format';
import { TeteBloc } from './Grille';

export default function Motifs({ premium, compte, date }: { premium: boolean; compte: number | null; date: string }) {
  return (
    <section aria-labelledby="t-motifs" className="py-5 lg:px-5">
      <TeteBloc id="t-motifs" titre="Motifs en séance" droite={premium && compte != null ? <span className="overline text-faint">{compte} détecté{compte > 1 ? 's' : ''}</span> : undefined} />
      {!premium ? (
        <PremiumLock title="Motifs intraday réservés au premium" pitch="Momentum et volumes anormaux détectés en séance, mis à jour toutes les 15 min." rows={2} />
      ) : (
        <>
          <p className="text-sm text-muted">{compte == null ? 'Motifs momentanément indisponibles.' : compte === 0 ? `Aucun motif détecté le ${fmtDateFR(date)}.` : `${compte} motif${compte > 1 ? 's' : ''} détecté${compte > 1 ? 's' : ''} le ${fmtDateFR(date)}.`}</p>
          <dl className="mt-2 text-[13.5px]">
            <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 border-t border-border py-2"><dt className="text-[10.5px] font-semibold tracking-widest text-accent-ink">MOMENTUM</dt><dd className="text-ivory">Tendance marquée au fil de la séance.</dd></div>
            <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 border-t border-border py-2"><dt className="text-[10.5px] font-semibold tracking-widest text-accent-ink">VOLUME</dt><dd className="text-ivory">Pic d&apos;échanges inhabituel pour la valeur.</dd></div>
          </dl>
          <p className="mt-2 text-xs text-faint">Adaptés au marché de fixing de la BRVM. <Link href="/signaux" className="text-accent-ink hover:underline">Tous les motifs →</Link></p>
        </>
      )}
    </section>
  );
}
```

  Vérifier la signature de `PremiumLock` dans `components/dashboard/PremiumLock.tsx` et l'adapter si besoin.

- [ ] **Step 4 : `Afrique.tsx`** (garder `aria-label="Indices pan-africains"` : l'E2E s'en sert) :

```tsx
import { fmtNumber, fmtPctSigne, fmtDateFR } from '@/lib/format';
import type { IndiceAfricain } from '@/lib/dashboard/chargement';
import { TeteBloc } from './Grille';

const PLACE: Record<string, string> = { NGXASI: 'NGX All-Share · Nigeria', NSENASI: 'NSE All-Share · Kenya', GSECI: 'GSE Composite · Ghana' };
const JOUR = 86_400_000;
const ton = (v: number | null) => (v == null ? 'text-faint' : v > 0 ? 'text-up' : v < 0 ? 'text-down' : 'text-muted');

/** Spec §12 — Afrique · vue régionale ; une donnée ancienne est signalée DANS LA FORME. */
export default function Afrique({ indices, composite, dateSeance }: {
  indices: IndiceAfricain[] | null; composite: { valeur: number | null; variation: number | null }; dateSeance: string;
}) {
  const plusRecente = indices?.map((a) => a.date_marche).sort().pop() ?? null;
  const age = plusRecente ? Math.round((Date.parse(`${dateSeance}T12:00:00Z`) - Date.parse(`${plusRecente}T12:00:00Z`)) / JOUR) : null;
  const ancienne = age != null && age > 7;
  return (
    <section aria-label="Indices pan-africains" className="py-5 lg:px-5">
      <TeteBloc id="t-afr" titre="Afrique · vue régionale" droite={<span className="overline text-faint">Source AFX</span>} />
      {ancienne && plusRecente && (
        <p className="mb-2.5 inline-flex rounded-md border border-warn/45 bg-warn/[0.09] px-2 py-1 text-[11.5px] text-warn">
          Source indisponible : données du {fmtDateFR(plusRecente)}, il y a {age} jours
        </p>
      )}
      <ul className="text-[13px]">
        <li className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-3 py-2">
          <span className="min-w-0">BRVM Composite · UEMOA<small className="block text-[11px] text-faint">{fmtDateFR(dateSeance).slice(0, 5)}</small></span>
          <span className="tabular text-ivory">{composite.valeur != null ? fmtNumber(composite.valeur, 2) : '—'}</span>
          <span className={`tabular ${ton(composite.variation)}`}>{composite.variation != null ? fmtPctSigne(composite.variation) : '—'}</span>
        </li>
        {(indices ?? []).map((a) => (
          <li key={a.code} className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-3 border-t border-border py-2 ${ancienne ? 'opacity-60' : ''}`}>
            <span className="min-w-0">{PLACE[a.code] ?? a.libelle ?? a.code}<small className="block text-[11px] text-faint">au {fmtDateFR(a.date_marche).slice(0, 5)}</small></span>
            <span className="tabular text-ivory">{a.valeur != null ? fmtNumber(Number(a.valeur), 2) : '—'}</span>
            <span className={`tabular ${ton(a.variation_pct != null ? Number(a.variation_pct) : null)}`}>{a.variation_pct != null ? fmtPctSigne(Number(a.variation_pct)) : '—'}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-faint">Indices en devise locale : comparables en variation, pas en niveau.</p>
    </section>
  );
}
```

- [ ] **Step 5 :** tsc → EXIT 0. **Step 6 : commit** `feat(dashboard): signaux récents, actualités, motifs et Afrique au style de la surface`.

---

### Task 9 : Pastille d'état de séance

**Files:** Create `frontend/components/dashboard/surface/PastilleSeance.tsx`.

- [ ] **Step 1 : créer** (client, horloge ; réutilise `computeMarketPhase` exporté par `components/landing/MarketSessionBanner.tsx`) :

```tsx
'use client';

import { useEffect, useState } from 'react';
import { computeMarketPhase, type MarketPhase } from '@/components/landing/MarketSessionBanner';

/** Pastille compacte d'état de séance (spec §9 : remplace les quatre cartes). */
export default function PastilleSeance() {
  const [phase, setPhase] = useState<MarketPhase | null>(null);
  useEffect(() => {
    const maj = () => setPhase(computeMarketPhase(new Date()));
    maj();
    const t = setInterval(maj, 30_000);
    return () => clearInterval(t);
  }, []);
  // Premier rendu identique serveur/client (pas d'heure) : aucun écart d'hydratation.
  if (!phase) return <span className="inline-flex h-7 w-40 rounded-full border border-border" aria-hidden />;
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-ivory" title={phase.sessionDetail}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${phase.open ? 'animate-pulse bg-up' : 'bg-muted'}`} />
      {phase.marketLabel} · {phase.sessionLabel}
    </span>
  );
}
```

- [ ] **Step 2 :** tsc → EXIT 0. **Step 3 : commit** `feat(dashboard): pastille d'état de séance`.

---

### Task 10 : Intégration dans la page

**Files:** Modify `frontend/app/dashboard/page.tsx`.

- [ ] **Step 1 : données.**
  - `getData` : l'historique des sparklines passe de 10 à **20 séances** (`.limit(20 * (typedActions.length || NB_SOCIETES_COTEES))`), reconstruction chronologique inchangée.
  - Dans le `Promise.all` des blocs (celui qui charge portefeuille, dividendes…), ajouter, chacun seulement si sa clé est visible : `veut('seance') ? chargerTrajectoires(supa, indices[0]?.date_marche ?? lastDate) : Promise.resolve(null)`, `veut('seance') ? chargerCompteSignaux(supa, lastDate) : Promise.resolve(null)`, `veut('actus') ? chargerActualites(supa, aujourdhui) : Promise.resolve(null)`, `veut('actus') ? chargerAfrique(supa) : Promise.resolve(null)`, `veut('actus') ? chargerCompteMotifs(supa, lastDate) : Promise.resolve(null)`. Retirer les deux `getWeeklyIndex` (la trajectoire les remplace).
- [ ] **Step 2 : variables** (après `metriques`, avant `sections` ; déplacer `gainers`/`losers`/`brvmc` avant `sections` s'ils sont calculés après) :

```ts
const secteursJour = indices
  .filter((i) => i.date_marche === lastDate && INDICES_SECTORIELS.includes(i.code) && i.variation_pct != null)
  .map((i) => ({ code: i.code, nom: (i.libelle ?? i.code).replace(/^BRVM\s*-\s*/i, ''), variation: Number(i.variation_pct) }));
const meneurSecteur = [...secteursJour].sort((a, b) => b.variation - a.variation)[0] ?? null;
const versLigne = (a: ActionDaily) => ({ code: a.code, nom: a.designation?.trim() || a.code, cours: a.cours_jour, variation: a.variation_pct, serie: sparklines[a.code] ?? [] });
const prestige = indices.find((i) => i.code === 'BRVMPRES');
const b30 = indices.find((i) => i.code === 'BRVM30');
const varCap = summary?.capitalisation_actions != null && summaryPrev?.capitalisation_actions ? (summary.capitalisation_actions / summaryPrev.capitalisation_actions - 1) * 100 : null;
const varValeur = summary?.valeur_transactions != null && summaryPrev?.valeur_transactions ? (summary.valeur_transactions / summaryPrev.valeur_transactions - 1) * 100 : null;
const titresEchanges = actions.reduce((s, a) => s + (a.volume ?? 0), 0);
const chiffres: Chiffre[] = [
  { libelle: 'BRVM Composite', valeur: fmtIndice(brvmc?.valeur ?? null), variation: brvmc?.variation_pct ?? null },
  { libelle: 'BRVM 30', valeur: fmtIndice(b30?.valeur ?? null), variation: b30?.variation_pct ?? null },
  { libelle: 'BRVM Prestige', valeur: fmtIndice(prestige?.valeur ?? null), variation: prestige?.variation_pct ?? null },
  { libelle: 'Valeur échangée', valeur: fmtMd(summary?.valeur_transactions ?? null), variation: varValeur, note: 'vs veille' },
  { libelle: 'Capitalisation actions', valeur: fmtMd(summary?.capitalisation_actions ?? null), variation: varCap, note: 'vs veille' },
  { libelle: 'Titres échangés', valeur: actions.some((a) => a.volume != null) ? fmtNumber(titresEchanges, 0) : '—', variation: null, note: `${actions.length} valeurs cotées` },
];
```

  Imports : `fmtNumber` (lib/format), `INDICES_SECTORIELS` (lib/dashboard/metriquesSeance), `titreSeance`, `chapoSeance` (lib/dashboard/recit), `Ouverture`, `type Chiffre`, `fmtIndice`, `fmtMd` (components/dashboard/surface/Ouverture), `GrilleInterne`, `Cellule`, `Bloc`, `TeteBloc` (surface/Grille), `Trajectoire`, `LargeurMoteur`, `Mouvements`, `Secteurs`, `SignauxRecents`, `Actualites`, `Motifs`, `Afrique`, `PastilleSeance`, et les nouveaux chargeurs.

- [ ] **Step 3 : sections** — remplacer les entrées `etat`, `seance`, `indices`, `signaux`, `actus` (les autres inchangées) :

```tsx
etat: (
  <Ouverture
    dateMarche={lastDate}
    titre={titreSeance(metriques.hausses, metriques.baisses)}
    chapo={chapoSeance({
      composite: metriques.composite,
      meneur: meneurSecteur ? { code: meneurSecteur.code, variationPct: meneurSecteur.variation } : null,
      valeurEchangee: summary?.valeur_transactions ?? null,
      valeurEchangeeVeille: summaryPrev?.valeur_transactions ?? null,
    })}
    chiffres={chiffres}
  />
),
seance: (
  <GrilleInterne>
    <Cellule span={8}>{trajectoires
      ? <Trajectoire series={trajectoires} jour={{ BRVMC: brvmc?.variation_pct ?? null, BRVM30: b30?.variation_pct ?? null }} />
      : <Bloc id="t-traj"><TeteBloc id="t-traj" titre="Trajectoire des indices" /><p className="text-sm text-muted">Trajectoire momentanément indisponible.</p></Bloc>}</Cellule>
    <Cellule span={4}><LargeurMoteur hausses={metriques.hausses} baisses={metriques.baisses} stables={metriques.stables} signaux={compteSignaux} /></Cellule>
  </GrilleInterne>
),
indices: (
  <GrilleInterne>
    <Cellule span={4}><Mouvements id="t-hausses" titre="Plus fortes hausses" lignes={gainers.map(versLigne)} /></Cellule>
    <Cellule span={4}><Mouvements id="t-baisses" titre="Plus fortes baisses" lignes={losers.map(versLigne)} /></Cellule>
    <Cellule span={4}><Secteurs secteurs={secteursJour} /></Cellule>
  </GrilleInterne>
),
signaux: (
  <GrilleInterne>
    <Cellule span={6}>
      {vedette && gateLectureSeance.allowed ? (
        <Bloc id="t-carnet">
          <TeteBloc id="t-carnet" titre={`Ce que dit la séance · ${vedette.code}`} droite={<Link href={`/actions/${vedette.code}`} className="text-xs text-accent-ink hover:underline">Voir la fiche</Link>} />
          <CarnetCommentaire carnet={vedette.carnet} signal={vedette.signal} actualites={vedette.actualites} contexte={{ valeurEchangee: vedette.valeurEchangee }} compact />
        </Bloc>
      ) : (
        <Bloc id="t-carnet"><TeteBloc id="t-carnet" titre="Ce que dit la séance" /><p className="text-sm text-muted">Lecture de séance réservée à l&apos;offre Premium.</p></Bloc>
      )}
    </Cellule>
    <Cellule span={6}>
      {isPremium ? <SignauxRecents signaux={signals as SignalDaily[]} /> : (
        <Bloc id="t-signaux-lock">
          <TeteBloc id="t-signaux-lock" titre="Signaux d'opportunité" />
          <PremiumLock title="Signaux d'achat et de vente réservés au Premium" pitch="Les signaux notés A–F, avec leur explication, sont inclus dans l'abonnement Premium." rows={3} />
        </Bloc>
      )}
    </Cellule>
  </GrilleInterne>
),
actus: (
  <GrilleInterne>
    <Cellule span={4}><Actualites items={actualites} /></Cellule>
    <Cellule span={4}><Motifs premium={isPremium} compte={compteMotifs} date={lastDate} /></Cellule>
    <Cellule span={4}><Afrique indices={afrique} composite={{ valeur: brvmc?.valeur ?? null, variation: brvmc?.variation_pct ?? null }} dateSeance={lastDate} /></Cellule>
  </GrilleInterne>
),
```

  (Si la page affichait jusqu'ici un comportement différent pour « Ce que dit la séance » quand le verrou est fermé — bloc entièrement absent —, garder ce comportement : remplacer la branche `else` par `null` et mettre `SignauxRecents`/verrou seuls sur 12 colonnes. Choisir la variante qui ne crée pas de cadre vide.)

- [ ] **Step 4 : en-tête et sections fixes.**
  - Remplacer le `<header>` actuel (eyebrow, h1, pastille de date, BeamButtons, liens) par une barre : `<header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">` contenant à gauche `<h1 className="font-display text-2xl text-ivory">Tableau de bord</h1>` et `<p className="text-xs text-muted">Séance du {dateLabel}</p>` ; à droite `<PastilleSeance />`, `<FreshnessBadge fraicheur={fraicheurCours} />`, le lien « ⚙︎ Personnaliser / ⚙︎ Ordre personnalisé » **inchangé**, et le lien « Version v2 → » inchangé.
  - **Retirer** `<NewsTicker …/>`, `<MarketSessionBanner />`, la `<div>` isolée du `FreshnessBadge`, et tout le bloc des sections fixes de bas de page (`MacroBanner`, section « Indices pan-africains », section « Signaux intraday patterns »).
  - Ordre vertical : barre · bandeau d'alertes (inchangé) · `DashboardTicker` · `<MacroBanner />` · `<div className="border-t border-border">` contenant les rangées de widgets `</div>` · pied de page.
  - Le conteneur principal remplace `space-y-6 sm:space-y-8` par `space-y-4` (les rangées n'ont plus d'écart entre elles : les filets les séparent).
  - Retirer les imports devenus inutiles (`NewsTicker`, `MarketSessionBanner`, `MarketStateCard`, `TopMovers`, `WeeklyIndexChart`, `KeyMetrics`, `RecentSignalsCard`, `MarketIndices`, `NewsFeed`, `IntraDaySignalsWidget`, `PatternSummaryWidget`, `AfricanIndicesCard`, `getWeeklyIndex`, `BeamButton`, `generateBrief`/`computeTopSectorPerfs` et la variable `brief` si plus utilisés, `prevBreadth`/`sentimentScore`/`breakdown`/`marketStats` si plus utilisés). **Ne supprimer aucun fichier de composant** ; lister dans le rapport ceux qui ne sont plus importés nulle part (`grep -rn`).
- [ ] **Step 5 :** tsc → EXIT 0 ; `timeout 600 npx vitest run` → tout vert.
- [ ] **Step 6 : commit** `feat(dashboard): page recomposée selon la maquette (barre, surface à filets, rangées)`.

---

### Task 11 : Libellés de personnalisation

**Files:** Modify `frontend/lib/dashboard/widgets.ts` (entrées `WIDGETS` uniquement).

- [ ] **Step 1 :** `label` / `desc` : `etat` → « Récit de séance » / « La séance racontée : titre, chapô, six mesures » ; `seance` → « Séance du jour » / « Trajectoire des indices, largeur du marché, moteur de signaux » ; `indices` → « Mouvements et secteurs » / « Plus fortes hausses et baisses, indices sectoriels » ; `signaux` → « Lecture et signaux » / « Ce que dit la séance, signaux d'opportunité » ; `actus` → « Actualités et régions » / « Actualités, motifs en séance, Afrique ».
- [ ] **Step 2 :** vitest widgets → PASS (adapter tout test qui vérifie un libellé à la nouvelle valeur exacte) ; tsc → EXIT 0. **Commit** `chore(dashboard): libellés de personnalisation alignés sur la maquette`.

---

### Task 12 : Vérification et PR

- [ ] `timeout 600 npx vitest run` ; `timeout 600 npx tsc --noEmit` → EXIT 0.
- [ ] Pousser `feat/dashboard-maquette`, PR vers `main` (corps en fichier, ligne 🤖 finale). **Ne pas fusionner** sans « fusionner ».
- [ ] Après fusion et déploiement : vérification réelle sur la production connectée (Edge en CDP), deux profils, ordinateur et mobile, captures comparées à la maquette.
