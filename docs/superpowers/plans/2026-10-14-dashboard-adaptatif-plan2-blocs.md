# Tableau de bord adaptatif — plan 2 : blocs visibles et mise en page

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** afficher sur `/dashboard` les quatre nouveaux blocs (agenda, publications, liquidité, comprendre) et le portefeuille enrichi, dans l'ordre du profil et sur trois niveaux de largeur, avec le portefeuille en premier pour l'investisseur actif.

**Architecture:**
- **Mapping pur, testé (vitest) :** de nouveaux modules de `frontend/lib/dashboard/` transforment les lignes Supabase en données d'affichage.
- **Chargeurs serveur :** ils sont `server-only`, paginés, et journalisent leurs erreurs. Ils lisent sous RLS avec la session.
- **Composants de bloc :** ce sont des Server Components, à l'exception de la courbe Recharts, qui tourne côté client.
- **Page :** elle charge seulement les blocs visibles, en parallèle, et les rend par rangées selon leur largeur.
- **Sections fixes :** macro, indices africains et motifs intraday descendent sous les widgets.

**Tech Stack:** Next.js 14 App Router (Server Components), TypeScript strict, Supabase (`@supabase/ssr`), Tailwind (jetons de `tailwind.config.ts`), Recharts, vitest, Playwright.

**Spec :** `docs/superpowers/specs/2026-10-14-dashboard-adaptatif-design.md` (§3, §4, §8, §11). Plan 1 (déjà livré sur la branche `feat/dashboard-adaptatif`, PR #81) : `comprendre.ts`, `liquidite.ts`, `agenda.ts`, `performanceJour.ts`, `profil.ts`, `widgets.ts`.

**Branche :** `feat/dashboard-adaptatif-p2`, créée depuis `feat/dashboard-adaptatif`, worktree `C:/Users/adego/wt/brvm-textes`. La PR sera empilée sur #81.

**Règles du projet pour chaque tâche :**
- **Jamais de `npm run build` en local.** Après chaque modification : `npx vitest run <fichiers>` et `timeout 600 npx tsc --noEmit` depuis `frontend/`.
- **Données :**
  - une donnée absente n'est jamais affichée comme 0 ;
  - chaque bloc affiche sa date de référence ;
  - aucun conseil ;
  - les montants passent par `fmtFcfa` / `fmtNumber` (fr-FR) et le signe moins est « − » (U+2212).
- **Liens externes :** seulement `http(s)`, ouverts avec `target="_blank" rel="noopener noreferrer"`.
- **Écarts assumés par rapport à la spec §4.0, et pourquoi :**
  - **`seance` et `indices` restent en pleine largeur :** leur contenu est déjà une grille de quatre colonnes, illisible au tiers.
  - **`liquidite` passe en demi-largeur :** pour l'actif, c'est un tableau de cinq colonnes, trop étroit au tiers.
  - **Les filtres de l'agenda et des publications (onglets) ne sont pas faits :** listes courtes, YAGNI.

---

## Carte des fichiers

| Fichier | Rôle | Tâche |
|---|---|---|
| `frontend/lib/format.ts` (+ `format.signe.test.ts`) | `fmtPctAbs`, `fmtPctSigne`, `fmtFcfaSigne` — source unique des signes | 1 |
| `frontend/lib/brief.ts`, `frontend/lib/dashboard/comprendre.ts` | utilisent les aides de `format.ts` (copies supprimées) | 1 |
| `frontend/lib/dashboard/widgets.ts` (+ test) | 4 nouvelles clés, ordres §3, masqués par défaut, largeurs, rangées | 2 |
| `frontend/lib/dashboard/metriquesSeance.ts` (+ test) | métriques de `comprendre` depuis la séance, séance close ? | 3 |
| `frontend/lib/dashboard/publications.ts` (+ test) | tri, libellés de type, liens sûrs | 4 |
| `frontend/lib/dashboard/liquiditeBloc.ts` (+ test) | lignes par position, extrêmes, texte de fourchette | 5 |
| `frontend/lib/dashboard/portefeuilleBloc.ts` (+ test) | lignes de performance, contributions, positions sans cours | 6 |
| `frontend/lib/dashboard/pagination.ts` (+ test) | lecture de toutes les pages PostgREST (plafond 1000) | 7 |
| `frontend/lib/dashboard/chargement.ts` | chargeurs serveur (portefeuille, dividendes, fermetures, publications, liquidité) | 7 |
| `frontend/components/dashboard/blocs/Cadre.tsx` | cadre de bloc, date de référence, état vide, pastille de statut | 8 |
| `frontend/components/dashboard/blocs/BlocComprendre.tsx` | bloc « Comprendre la séance » | 9 |
| `frontend/components/dashboard/blocs/BlocAgenda.tsx` | bloc agenda | 10 |
| `frontend/components/dashboard/blocs/BlocPublications.tsx` | bloc publications | 10 |
| `frontend/components/dashboard/blocs/BlocLiquidite.tsx` | bloc liquidité (actif / débutant) | 11 |
| `frontend/components/dashboard/blocs/CourbeValeur.tsx` | courbe de valeur (client, Recharts) | 12 |
| `frontend/components/dashboard/blocs/BlocPortefeuille.tsx` | portefeuille enrichi ou invitation | 12 |
| `frontend/app/dashboard/page.tsx` | chargement, sections, rangées, sections fixes déplacées | 13 |
| `frontend/components/dashboard/DashboardCustomizer.tsx` | réinitialisation avec les masqués par défaut | 13 |
| `frontend/e2e/dashboard-blocs.spec.ts` | rendu sans NaN, sans débordement mobile | 14 |

Toutes les commandes s'exécutent depuis `frontend/` (`cd /c/Users/adego/wt/brvm-textes/frontend`).

---

### Task 1 : Signes — une source unique dans `lib/format.ts`

**Files:**
- Modify: `frontend/lib/format.ts`
- Create: `frontend/lib/format.signe.test.ts`
- Modify: `frontend/lib/brief.ts` (supprimer `pctSigne` / `pctAbs` locaux, importer)
- Modify: `frontend/lib/dashboard/comprendre.ts` (idem)

- [ ] **Step 1 : tests qui échouent** — créer `frontend/lib/format.signe.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { fmtPctAbs, fmtPctSigne, fmtFcfaSigne, fmtNumber, fmtFcfa } from './format';

describe('fmtPctSigne', () => {
  it('signe après arrondi, moins typographique', () => {
    expect(fmtPctSigne(1.954)).toBe(`+${fmtNumber(1.95, 2)} %`);
    expect(fmtPctSigne(-0.26)).toBe(`−${fmtNumber(0.26, 2)} %`);
  });
  it('jamais « +0,00 » ni « −0,00 »', () => {
    expect(fmtPctSigne(0.004)).toBe(`${fmtNumber(0, 2)} %`);
    expect(fmtPctSigne(-0.004)).toBe(`${fmtNumber(0, 2)} %`);
  });
  it('précision paramétrable', () => {
    expect(fmtPctSigne(-1.25, 1)).toBe(`−${fmtNumber(1.25, 1)} %`);
  });
});

describe('fmtPctAbs', () => {
  it('valeur absolue', () => {
    expect(fmtPctAbs(-0.26)).toBe(`${fmtNumber(0.26, 2)} %`);
  });
});

describe('fmtFcfaSigne', () => {
  it('signe et magnitude de fmtFcfa', () => {
    expect(fmtFcfaSigne(1_250_000)).toBe(`+${fmtFcfa(1_250_000)}`);
    expect(fmtFcfaSigne(-450_000)).toBe(`−${fmtFcfa(450_000)}`);
  });
  it('zéro et quasi-zéro sans signe', () => {
    expect(fmtFcfaSigne(0)).toBe(fmtFcfa(0));
    expect(fmtFcfaSigne(-0.3)).toBe(fmtFcfa(0.3));
  });
});
```

- [ ] **Step 2 : constater l'échec** — `npx vitest run lib/format.signe.test.ts` → FAIL (exports absents).

- [ ] **Step 3 : implémenter** — ajouter à la fin de `frontend/lib/format.ts` :

```ts
/**
 * Signe choisi APRÈS l'arrondi : jamais « +0,00 % » ni « −0,00 % ».
 * Le moins est typographique (U+2212), comme dans tout le site.
 */
function signeArrondi(v: number, d: number): '' | '+' | '−' {
  const r = Number(v.toFixed(d));
  return r > 0 ? '+' : r < 0 ? '−' : '';
}

/** « 0,26 % » — pour les phrases dont le verbe porte déjà le sens. */
export function fmtPctAbs(v: number, d = 2): string {
  return `${fmtNumber(Math.abs(v), d)} %`;
}

/** « +1,95 % », « −0,26 % », « 0,00 % ». */
export function fmtPctSigne(v: number, d = 2): string {
  return `${signeArrondi(v, d)}${fmtPctAbs(v, d)}`;
}

/** Montant FCFA signé : « +1,3 M », « −450 k ». Sans signe sous le franc. */
export function fmtFcfaSigne(n: number): string {
  return `${signeArrondi(n, 0)}${fmtFcfa(Math.abs(n))}`;
}
```

- [ ] **Step 4 : supprimer les copies**
  - Dans `frontend/lib/brief.ts`, supprimer les fonctions locales `pctSigne` et `pctAbs` (avec leurs commentaires JSDoc), puis remplacer la ligne d'import de `@/lib/format` par :

```ts
import { fmtNumber, fmtFcfa, fmtDateFR, fmtPctSigne as pctSigne, fmtPctAbs as pctAbs } from '@/lib/format';
```

  - Dans `frontend/lib/dashboard/comprendre.ts`, supprimer les deux constantes `pctAbs` et `pctSigne`, puis remplacer l'import par :

```ts
import { fmtNumber, fmtFcfa, fmtPctSigne as pctSigne, fmtPctAbs as pctAbs } from '@/lib/format';
```

  (Si `fmtNumber` ou `fmtDateFR` n'est plus utilisé dans l'un des fichiers, le retirer de l'import — `tsc` ne le signale pas, mais le linter si.)

- [ ] **Step 5 : vérifier** — `npx vitest run lib/format.signe.test.ts lib/brief.test.ts lib/dashboard/comprendre.test.ts` → tout PASS (les tests existants du brief et de comprendre ne changent pas : le comportement est identique). Puis `timeout 600 npx tsc --noEmit; echo EXIT $?` → `EXIT 0`.

- [ ] **Step 6 : commit**

```bash
git add lib/format.ts lib/format.signe.test.ts lib/brief.ts lib/dashboard/comprendre.ts
git commit -m "refactor(format): signes après arrondi en source unique (pourcentages et FCFA)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2 : Registre des widgets — nouvelles clés, ordres §3, masqués par défaut, rangées

**Files:**
- Modify: `frontend/lib/dashboard/widgets.ts` (remplacement complet)
- Modify: `frontend/lib/dashboard/widgets.test.ts`

- [ ] **Step 1 : tests qui échouent** — dans `frontend/lib/dashboard/widgets.test.ts` :
  - remplacer la ligne d'import par :

```ts
import {
  resolveLayout, DEFAULT_ORDER, ORDRE_ACTIF, ORDRE_DEBUTANT, deduireProfil, ordreParDefaut,
  MASQUES_PAR_DEFAUT, LARGEUR, grouperEnRangees, classeRangee, WIDGETS,
} from './widgets';
```

  - remplacer le test « sans layout sauvegardé, l ordre dépend du profil » par :

```ts
  it('sans layout sauvegardé, l ordre dépend du profil (comprendre masqué pour l actif)', () => {
    expect(resolveLayout(null, 'actif')).toEqual(ORDRE_ACTIF.filter((k) => k !== 'comprendre'));
    expect(resolveLayout(null, 'debutant')).toEqual(ORDRE_DEBUTANT);
    expect(resolveLayout(null, 'actif')[0]).toBe('portefeuille');
    expect(resolveLayout(null, 'debutant')[0]).toBe('etat');
  });
```

  - ajouter à la fin du fichier :

```ts
describe('ordres de la spec §3', () => {
  it('actif : portefeuille, agenda, publications, état, séance…', () => {
    expect(ORDRE_ACTIF).toEqual([
      'portefeuille', 'agenda', 'publications', 'etat', 'comprendre', 'seance',
      'liquidite', 'signaux', 'secteurs', 'indices', 'actus',
    ]);
  });
  it('débutant : état, comprendre, séance, agenda, publications, portefeuille…', () => {
    expect(ORDRE_DEBUTANT).toEqual([
      'etat', 'comprendre', 'seance', 'agenda', 'publications', 'portefeuille',
      'signaux', 'secteurs', 'indices', 'liquidite', 'actus',
    ]);
  });
  it('chaque clé a un libellé et une largeur', () => {
    for (const k of ORDRE_DEBUTANT) {
      expect(WIDGETS.find((w) => w.key === k)).toBeDefined();
      expect(LARGEUR[k]).toBeDefined();
    }
  });
});

describe('masqués par défaut', () => {
  it('comprendre masqué pour l actif seulement', () => {
    expect(MASQUES_PAR_DEFAUT.actif).toEqual(['comprendre']);
    expect(MASQUES_PAR_DEFAUT.debutant).toEqual([]);
    expect(resolveLayout(null, 'debutant')).toContain('comprendre');
  });
  it('layout sauvegardé AVANT l apparition de comprendre : reste masqué pour l actif', () => {
    const r = resolveLayout({ order: ['portefeuille', 'etat'], hidden: [] }, 'actif');
    expect(r).not.toContain('comprendre');
    expect(r).toContain('agenda');
  });
  it('comprendre réactivé explicitement (présent dans order) : visible', () => {
    const r = resolveLayout({ order: ['comprendre', 'portefeuille'], hidden: [] }, 'actif');
    expect(r[0]).toBe('comprendre');
  });
});

describe('rangées', () => {
  it('pleine seule ; demi par deux ; tiers par trois', () => {
    expect(grouperEnRangees(['portefeuille', 'agenda', 'publications', 'etat'])).toEqual([
      { largeur: 'pleine', cles: ['portefeuille'] },
      { largeur: 'demi', cles: ['agenda', 'publications'] },
      { largeur: 'pleine', cles: ['etat'] },
    ]);
    expect(grouperEnRangees(['signaux', 'secteurs', 'actus', 'signaux'])).toEqual([
      { largeur: 'tiers', cles: ['signaux', 'secteurs', 'actus'] },
      { largeur: 'tiers', cles: ['signaux'] },
    ]);
  });
  it('un bloc seul dans sa rangée prend toute la largeur', () => {
    expect(classeRangee({ largeur: 'demi', cles: ['agenda'] })).toBe('');
    expect(classeRangee({ largeur: 'demi', cles: ['agenda', 'publications'] })).toBe('grid gap-6 md:grid-cols-2');
    expect(classeRangee({ largeur: 'tiers', cles: ['signaux', 'actus'] })).toBe('grid gap-6 md:grid-cols-2 xl:grid-cols-3');
    expect(classeRangee({ largeur: 'pleine', cles: ['etat'] })).toBe('');
  });
});
```

- [ ] **Step 2 : constater l'échec** — `npx vitest run lib/dashboard/widgets.test.ts` → FAIL.

- [ ] **Step 3 : implémenter** — remplacer TOUT le contenu de `frontend/lib/dashboard/widgets.ts` par :

```ts
/** Registre des widgets du dashboard + résolution du layout utilisateur (pur). */

export type WidgetKey =
  | 'etat' | 'comprendre' | 'seance' | 'agenda' | 'publications' | 'portefeuille'
  | 'signaux' | 'secteurs' | 'indices' | 'liquidite' | 'actus';

export interface WidgetMeta { key: WidgetKey; label: string; desc: string }

/** Registre, dans l'ordre du profil débutant (spec §3). */
export const WIDGETS: WidgetMeta[] = [
  { key: 'etat', label: 'État du marché', desc: 'Hausses, baisses, valeur échangée' },
  { key: 'comprendre', label: 'Comprendre la séance', desc: 'La séance en constats simples' },
  { key: 'seance', label: 'Séance du jour', desc: 'Plus fortes hausses et baisses, indices, brief' },
  { key: 'agenda', label: 'Agenda', desc: 'Dividendes et jours fermés des 30 prochains jours' },
  { key: 'publications', label: 'Publications', desc: 'Documents des émetteurs, 7 derniers jours' },
  { key: 'portefeuille', label: 'Mon portefeuille', desc: 'Valeur, plus-value latente, positions' },
  { key: 'signaux', label: "Signaux d'opportunité", desc: 'Signaux actionnables récents' },
  { key: 'secteurs', label: 'Vos secteurs', desc: 'Perf du jour de vos secteurs favoris' },
  { key: 'indices', label: 'Indices BRVM', desc: 'Composite, BRVM-30, sectoriels' },
  { key: 'liquidite', label: 'Liquidité', desc: 'Facilité à échanger les valeurs' },
  { key: 'actus', label: 'Actualités', desc: 'Fil d’actualités BRVM' },
];

/** Profil déduit des positions (spec §2) : rien n'est stocké. */
export type Profil = 'actif' | 'debutant';

/** Au moins une position détenue → investisseur actif. */
export function deduireProfil(nbPositions: number): Profil {
  return nbPositions > 0 ? 'actif' : 'debutant';
}

/** Débutant : comprendre la séance avant d'en voir le détail (spec §3). */
export const ORDRE_DEBUTANT: WidgetKey[] = WIDGETS.map((w) => w.key);

/** Actif : ce qui le concerne d'abord (spec §3). `comprendre` y figure mais masqué par défaut. */
export const ORDRE_ACTIF: WidgetKey[] = [
  'portefeuille', 'agenda', 'publications', 'etat', 'comprendre', 'seance',
  'liquidite', 'signaux', 'secteurs', 'indices', 'actus',
];

/** @deprecated Utiliser ORDRE_DEBUTANT ou ordreParDefaut(profil). Conservé pour compatibilité. */
export const DEFAULT_ORDER: WidgetKey[] = ORDRE_DEBUTANT;

/** Widgets présents dans le registre mais masqués tant que l'utilisateur ne les active pas. */
export const MASQUES_PAR_DEFAUT: Record<Profil, WidgetKey[]> = {
  actif: ['comprendre'],
  debutant: [],
};

export function ordreParDefaut(profil: Profil): WidgetKey[] {
  return profil === 'actif' ? ORDRE_ACTIF : ORDRE_DEBUTANT;
}

const VALID = new Set<string>(ORDRE_DEBUTANT);

export interface DashboardLayout { order?: string[]; hidden?: string[] }

/**
 * Résout l'ordre + la visibilité des widgets.
 * - Layout sauvegardé : il l'emporte TOUJOURS sur le profil (spec §2).
 * - Sinon : l'ordre par défaut du profil, moins ses masqués par défaut.
 * Tolérant : ignore les clés inconnues ; un widget absent du layout sauvegardé
 * est ajouté en fin, SAUF s'il est masqué par défaut pour ce profil (un layout
 * enregistré avant son apparition ne doit pas le faire surgir).
 * Retourne la liste ORDONNÉE des widgets VISIBLES.
 */
export function resolveLayout(saved: DashboardLayout | null | undefined, profil: Profil = 'debutant'): WidgetKey[] {
  const defaut = ordreParDefaut(profil);
  const masquesProfil = new Set<WidgetKey>(MASQUES_PAR_DEFAUT[profil]);
  const savedOrder = (saved?.order ?? []).filter((k) => VALID.has(k)) as WidgetKey[];
  const seen = new Set<string>(savedOrder);
  const hidden = new Set<string>((saved?.hidden ?? []).filter((k) => VALID.has(k)));
  for (const k of defaut) if (!seen.has(k) && masquesProfil.has(k)) hidden.add(k);
  const merged = [...savedOrder, ...defaut.filter((k) => !seen.has(k))];
  return merged.filter((k) => !hidden.has(k));
}

/** Trois niveaux de lecture (spec §4.0). `seance`, `indices` : contenu déjà en grille → pleine largeur. */
export type Largeur = 'pleine' | 'demi' | 'tiers';

export const LARGEUR: Record<WidgetKey, Largeur> = {
  portefeuille: 'pleine', etat: 'pleine', comprendre: 'pleine', seance: 'pleine', indices: 'pleine',
  agenda: 'demi', publications: 'demi', liquidite: 'demi',
  signaux: 'tiers', secteurs: 'tiers', actus: 'tiers',
};

export interface Rangee { largeur: Largeur; cles: WidgetKey[] }

const PAR_RANGEE: Record<Largeur, number> = { pleine: 1, demi: 2, tiers: 3 };

/** Regroupe les widgets CONSÉCUTIFS de même largeur, dans l'ordre du layout. */
export function grouperEnRangees(cles: WidgetKey[]): Rangee[] {
  const out: Rangee[] = [];
  for (const k of cles) {
    const l = LARGEUR[k];
    const derniere = out[out.length - 1];
    if (derniere && derniere.largeur === l && derniere.cles.length < PAR_RANGEE[l]) derniere.cles.push(k);
    else out.push({ largeur: l, cles: [k] });
  }
  return out;
}

/** Classes de grille d'une rangée. Un bloc seul dans sa rangée prend toute la largeur. */
export function classeRangee(r: Rangee): string {
  if (r.cles.length === 1) return '';
  return r.largeur === 'tiers' ? 'grid gap-6 md:grid-cols-2 xl:grid-cols-3' : 'grid gap-6 md:grid-cols-2';
}
```

- [ ] **Step 4 : vérifier** — `npx vitest run lib/dashboard/widgets.test.ts` → PASS. `timeout 600 npx tsc --noEmit; echo EXIT $?` → `EXIT 0`. Si `tsc` signale `app/dashboard/page.tsx` (le `Record<WidgetKey, …>` des sections n'a pas les quatre nouvelles clés), ajouter TEMPORAIREMENT dans l'objet `sections` de la page : `agenda: null, publications: null, liquidite: null, comprendre: null,` — la tâche 13 les remplace.

- [ ] **Step 5 : commit**

```bash
git add lib/dashboard/widgets.ts lib/dashboard/widgets.test.ts app/dashboard/page.tsx
git commit -m "feat(dashboard): quatre nouveaux widgets, ordres de la spec, masqués par défaut, rangées

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3 : Métriques de séance pour « Comprendre » et séance close

**Files:**
- Create: `frontend/lib/dashboard/metriquesSeance.ts`
- Create: `frontend/lib/dashboard/metriquesSeance.test.ts`

- [ ] **Step 1 : tests qui échouent** — créer `frontend/lib/dashboard/metriquesSeance.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { metriquesDepuisSeance, estSeanceClose } from './metriquesSeance';
import type { ActionDaily, IndiceDaily } from '@/lib/types';

const a = (code: string, variation_pct: number | null, valeur_echangee: number | null = null, designation: string | null = null): ActionDaily => ({
  code, date_marche: '2026-10-13', designation, pays: null, secteur: null, cours_precedent: null,
  cours_jour: 1000, variation_pct, volume: null, nb_transactions: null, valeur_echangee,
});
const i = (code: string, libelle: string, valeur: number | null, variation_pct: number | null): IndiceDaily => ({
  code, date_marche: '2026-10-13', libelle, valeur, valeur_precedente: null, variation_pct,
});

const indices = [
  i('BRVMC', 'BRVM COMPOSITE', 545.46, -0.28),
  i('BRVMENER', 'BRVM - Énergie', 1200, 2.22),
  i('BRVMINDU', 'BRVM - Industriels', 900, 0.48),
  i('BRVM30', 'BRVM-30', 263, 3.5), // pas sectoriel : ignoré pour le secteur meneur
];

describe('metriquesDepuisSeance', () => {
  it('largeur comptée sur les variations CONNUES seulement', () => {
    const m = metriquesDepuisSeance({
      dateMarche: '2026-10-13', indices, valeurTransactions: 3e9, valeurTransactionsVeille: 2.5e9,
      actions: [a('SNTS', 1), a('ORAC', -2), a('SGBC', 0), a('XXXX', null)],
    });
    expect([m.hausses, m.baisses, m.stables]).toEqual([1, 1, 1]);
  });

  it('aucune variation connue : largeur nulle, jamais 0/0/0', () => {
    const m = metriquesDepuisSeance({ dateMarche: '2026-10-13', indices, valeurTransactions: null, valeurTransactionsVeille: null, actions: [a('X', null)] });
    expect([m.hausses, m.baisses, m.stables]).toEqual([null, null, null]);
  });

  it('composite et secteur meneur lus dans les indices sectoriels', () => {
    const m = metriquesDepuisSeance({ dateMarche: '2026-10-13', indices, valeurTransactions: null, valeurTransactionsVeille: null, actions: [] });
    expect(m.composite).toEqual({ valeur: 545.46, variationPct: -0.28 });
    expect(m.secteurMeneur).toEqual({ nom: 'Énergie', variationPct: 2.22 });
  });

  it('indices d une autre séance ignorés', () => {
    const m = metriquesDepuisSeance({
      dateMarche: '2026-10-14', indices, valeurTransactions: null, valeurTransactionsVeille: null, actions: [],
    });
    expect(m.composite).toBeNull();
    expect(m.secteurMeneur).toBeNull();
  });

  it('valeur la plus échangée : seulement si la valeur échangée est connue', () => {
    const m = metriquesDepuisSeance({
      dateMarche: '2026-10-13', indices, valeurTransactions: 3e9, valeurTransactionsVeille: null,
      actions: [a('SNTS', 1, 9e8, 'SONATEL SN'), a('ORAC', 1, 2e8, null), a('X', 1, null)],
    });
    expect(m.plusEchangee).toEqual({ code: 'SNTS', nom: 'SONATEL SN', valeur: 9e8 });
    expect(m.valeurEchangee).toBe(3e9);
    expect(m.valeurEchangeeVeille).toBeNull();
    const vide = metriquesDepuisSeance({ dateMarche: '2026-10-13', indices, valeurTransactions: null, valeurTransactionsVeille: null, actions: [a('X', 1, null)] });
    expect(vide.plusEchangee).toBeNull();
  });
});

describe('estSeanceClose', () => {
  it('séance passée : close ; future : non', () => {
    expect(estSeanceClose('2026-10-12', new Date('2026-10-13T08:00:00Z'))).toBe(true);
    expect(estSeanceClose('2026-10-14', new Date('2026-10-13T20:00:00Z'))).toBe(false);
  });
  it('jour même : close à partir de 15 h 30 UTC (Abidjan)', () => {
    expect(estSeanceClose('2026-10-13', new Date('2026-10-13T15:29:00Z'))).toBe(false);
    expect(estSeanceClose('2026-10-13', new Date('2026-10-13T15:30:00Z'))).toBe(true);
  });
});
```

- [ ] **Step 2 : constater l'échec** — `npx vitest run lib/dashboard/metriquesSeance.test.ts` → FAIL.

- [ ] **Step 3 : implémenter** — créer `frontend/lib/dashboard/metriquesSeance.ts` :

```ts
/**
 * Métriques nommées de « Comprendre la séance » (spec §4.4), extraites des
 * lignes de la séance affichée. PUR et testé.
 *
 * - Une variation inconnue n'est PAS « stable » : seules les variations
 *   connues entrent dans la largeur du marché (spec §11).
 * - Le secteur meneur vient des INDICES SECTORIELS publiés par la BRVM, pas
 *   d'une moyenne recalculée par nous.
 * - Tout indice d'une autre séance est ignoré : on ne mélange pas deux séances.
 */
import type { ActionDaily, IndiceDaily } from '@/lib/types';
import type { MetriquesSeance } from './comprendre';

/** Indices sectoriels BRVM (libellé « BRVM - <secteur> »). */
export const INDICES_SECTORIELS: readonly string[] = [
  'BRVMTELE', 'BRVMCBASE', 'BRVMCDISC', 'BRVMENER', 'BRVMINDU', 'BRVMFINS', 'BRVMSPUB',
];

/** Fermeture officielle 15 h 00 GMT (Abidjan, UTC+0), plus 30 min d'officialisation des cours. */
export const CLOTURE_MINUTES_UTC = 15 * 60 + 30;

const fini = (x: number | null | undefined): x is number => typeof x === 'number' && Number.isFinite(x);

function nomSecteur(i: IndiceDaily): string {
  const nom = (i.libelle ?? '').replace(/^BRVM\s*-\s*/i, '').trim();
  return nom || i.code;
}

export function metriquesDepuisSeance(e: {
  dateMarche: string;
  actions: ActionDaily[];
  indices: IndiceDaily[];
  valeurTransactions: number | null;
  valeurTransactionsVeille: number | null;
}): MetriquesSeance {
  const variations = e.actions.map((x) => x.variation_pct).filter(fini);
  const connue = variations.length > 0;
  const memeSeance = e.indices.filter((x) => x.date_marche === e.dateMarche);

  const brvmc = memeSeance.find((x) => x.code === 'BRVMC');
  const composite = brvmc && fini(brvmc.valeur) && fini(brvmc.variation_pct)
    ? { valeur: brvmc.valeur, variationPct: brvmc.variation_pct }
    : null;

  const meneur = memeSeance
    .filter((x) => INDICES_SECTORIELS.includes(x.code) && fini(x.variation_pct))
    .sort((x, y) => (y.variation_pct as number) - (x.variation_pct as number))[0];
  const secteurMeneur = meneur ? { nom: nomSecteur(meneur), variationPct: meneur.variation_pct as number } : null;

  const vedette = e.actions
    .filter((x) => fini(x.valeur_echangee) && (x.valeur_echangee as number) > 0)
    .sort((x, y) => (y.valeur_echangee as number) - (x.valeur_echangee as number))[0];
  const plusEchangee = vedette
    ? { code: vedette.code, nom: vedette.designation?.trim() || vedette.code, valeur: vedette.valeur_echangee as number }
    : null;

  return {
    dateMarche: e.dateMarche,
    hausses: connue ? variations.filter((v) => v > 0).length : null,
    baisses: connue ? variations.filter((v) => v < 0).length : null,
    stables: connue ? variations.filter((v) => v === 0).length : null,
    composite,
    secteurMeneur,
    valeurEchangee: e.valeurTransactions,
    valeurEchangeeVeille: e.valeurTransactionsVeille,
    plusEchangee,
  };
}

/** La séance `dateMarche` est-elle close à l'instant `maintenant` ? */
export function estSeanceClose(dateMarche: string, maintenant: Date): boolean {
  const jour = maintenant.toISOString().slice(0, 10);
  if (dateMarche < jour) return true;
  if (dateMarche > jour) return false;
  return maintenant.getUTCHours() * 60 + maintenant.getUTCMinutes() >= CLOTURE_MINUTES_UTC;
}
```

- [ ] **Step 4 : vérifier** — `npx vitest run lib/dashboard/metriquesSeance.test.ts` → PASS (7 tests) ; `timeout 600 npx tsc --noEmit; echo EXIT $?` → `EXIT 0`.

- [ ] **Step 5 : commit**

```bash
git add lib/dashboard/metriquesSeance.ts lib/dashboard/metriquesSeance.test.ts
git commit -m "feat(dashboard): métriques de séance (indices sectoriels, variations connues) et séance close

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4 : Publications — tri, libellés, liens sûrs

**Files:**
- Create: `frontend/lib/dashboard/publications.ts`
- Create: `frontend/lib/dashboard/publications.test.ts`

Types réels en base (sonde du 2026-10-14) : `autre`, `rapport`, `ag`, `notation`, `etats_financiers`, `bilan`.

- [ ] **Step 1 : tests qui échouent** — créer `frontend/lib/dashboard/publications.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { preparerPublications, libelleType, type PublicationSource } from './publications';

const p = (o: Partial<PublicationSource> & { code: string; date_publication: string }): PublicationSource => ({
  libelle: `Document ${o.code}`, type_publication: 'autre', source_url: `https://www.brvm.org/doc/${o.code}.pdf`, ...o,
});

describe('libelleType', () => {
  it('types connus et repli', () => {
    expect(libelleType('etats_financiers')).toBe('États financiers');
    expect(libelleType('bilan')).toBe('États financiers');
    expect(libelleType('ag')).toBe('Assemblée générale');
    expect(libelleType('notation')).toBe('Notation');
    expect(libelleType('rapport')).toBe('Rapport');
    expect(libelleType('autre')).toBe('Communiqué');
    expect(libelleType(null)).toBe('Communiqué');
    expect(libelleType('inconnu')).toBe('Communiqué');
  });
});

describe('preparerPublications', () => {
  const rows = [
    p({ code: 'SNTS', date_publication: '2026-10-13' }),
    p({ code: 'prsc', date_publication: '2026-10-12', type_publication: 'ag' }),
    p({ code: 'ORGT', date_publication: '2026-10-12', type_publication: 'rapport' }),
  ];

  it('mes valeurs d abord, puis la plus récente', () => {
    const r = preparerPublications(rows, new Set(['PRSC']));
    expect(r.map((x) => x.code)).toEqual(['PRSC', 'SNTS', 'ORGT']);
    expect(r[0]!.mienne).toBe(true);
    expect(r[0]!.typeLibelle).toBe('Assemblée générale');
  });

  it('lien seulement en http(s)', () => {
    const r = preparerPublications([
      p({ code: 'A', date_publication: '2026-10-13', source_url: 'javascript:alert(1)' }),
      p({ code: 'B', date_publication: '2026-10-13', source_url: null }),
      p({ code: 'C', date_publication: '2026-10-13', source_url: 'http://x.org/a.pdf' }),
    ], new Set());
    expect(r.find((x) => x.code === 'A')!.url).toBeNull();
    expect(r.find((x) => x.code === 'B')!.url).toBeNull();
    expect(r.find((x) => x.code === 'C')!.url).toBe('http://x.org/a.pdf');
  });

  it('date invalide ou libellé vide : écarté ; doublon d URL : une fois ; limite', () => {
    const r = preparerPublications([
      p({ code: 'A', date_publication: '13/10/2026' }),
      p({ code: 'B', date_publication: '2026-10-13', libelle: '  ' }),
      p({ code: 'C', date_publication: '2026-10-13', source_url: 'https://x.org/c.pdf' }),
      p({ code: 'C', date_publication: '2026-10-13', source_url: 'https://x.org/c.pdf' }),
    ], new Set());
    expect(r.map((x) => x.code)).toEqual(['C']);
    expect(preparerPublications(Array.from({ length: 12 }, (_, k) => p({ code: `X${k}`, date_publication: '2026-10-13' })), new Set(), 8)).toHaveLength(8);
  });
});
```

- [ ] **Step 2 : constater l'échec** — `npx vitest run lib/dashboard/publications.test.ts` → FAIL.

- [ ] **Step 3 : implémenter** — créer `frontend/lib/dashboard/publications.ts` :

```ts
/**
 * Bloc « Publications » (spec §4.2) — documents déposés par les émetteurs.
 * PUR et testé. Sources officielles uniquement : la presse reste dans `actus`.
 */
export interface PublicationSource {
  code: string;
  date_publication: string;
  libelle: string;
  type_publication: string | null;
  source_url: string | null;
}

export interface PublicationBloc {
  code: string;
  date: string;
  libelle: string;
  typeLibelle: string;
  url: string | null;
  mienne: boolean;
}

const TYPES: Record<string, string> = {
  etats_financiers: 'États financiers',
  bilan: 'États financiers',
  rapport: 'Rapport',
  ag: 'Assemblée générale',
  notation: 'Notation',
  autre: 'Communiqué',
};

export function libelleType(type: string | null): string {
  return (type && TYPES[type]) || 'Communiqué';
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Seuls les liens http(s) sont rendus : un `javascript:` en base ne doit jamais devenir cliquable. */
function urlSure(u: string | null): string | null {
  return u && /^https?:\/\//i.test(u.trim()) ? u.trim() : null;
}

export function preparerPublications(
  rows: PublicationSource[],
  codesDetenus: ReadonlySet<string>,
  limite = 8,
): PublicationBloc[] {
  const vus = new Set<string>();
  const out: PublicationBloc[] = [];
  for (const r of rows) {
    const libelle = r.libelle?.trim() ?? '';
    if (!ISO.test(r.date_publication) || !libelle) continue;
    const code = r.code.trim().toUpperCase();
    const url = urlSure(r.source_url);
    const cle = url ?? `${code}|${r.date_publication}|${libelle}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    out.push({ code, date: r.date_publication, libelle, typeLibelle: libelleType(r.type_publication), url, mienne: codesDetenus.has(code) });
  }
  return out
    .sort((x, y) => Number(y.mienne) - Number(x.mienne) || y.date.localeCompare(x.date) || x.code.localeCompare(y.code))
    .slice(0, limite);
}
```

- [ ] **Step 4 : vérifier** — `npx vitest run lib/dashboard/publications.test.ts` → PASS ; `tsc` → `EXIT 0`.

- [ ] **Step 5 : commit**

```bash
git add lib/dashboard/publications.ts lib/dashboard/publications.test.ts
git commit -m "feat(dashboard): publications d'émetteurs — mes valeurs d'abord, liens http(s) seulement

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5 : Liquidité — lignes par position, extrêmes du marché

**Files:**
- Create: `frontend/lib/dashboard/liquiditeBloc.ts`
- Create: `frontend/lib/dashboard/liquiditeBloc.test.ts`

Données réelles : `spread_pct` est en POURCENT (SNTS 0,0111 = 0,01 %), `spread_source` vaut `carnet` ou `roll`, `valeur_moyenne_30j` vaut 0 quand rien n'est mesuré (SVOC).

- [ ] **Step 1 : tests qui échouent** — créer `frontend/lib/dashboard/liquiditeBloc.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { lignesLiquiditePositions, extremesLiquidite, fourchetteTexte, type LiquiditeSource } from './liquiditeBloc';
import { fmtNumber } from '@/lib/format';

const l = (code: string, score: number | null, o: Partial<LiquiditeSource> = {}): LiquiditeSource => ({
  code, score, classe: score == null ? null : score >= 75 ? 'A' : score >= 50 ? 'B' : score >= 25 ? 'C' : 'D',
  spread_pct: 0.5, spread_source: 'carnet', valeur_moyenne_30j: 10_000_000, ...o,
});

describe('fourchetteTexte', () => {
  it('« ≈ » seulement pour une estimation de Roll', () => {
    expect(fourchetteTexte(0.0111, 'carnet')).toBe(`${fmtNumber(0.0111, 2)} %`);
    expect(fourchetteTexte(1.5, 'roll')).toBe(`≈ ${fmtNumber(1.5, 2)} %`);
  });
  it('absente ou invalide : null', () => {
    expect(fourchetteTexte(null, null)).toBeNull();
    expect(fourchetteTexte(Number.NaN, 'carnet')).toBeNull();
    expect(fourchetteTexte(-1, 'carnet')).toBeNull();
  });
});

describe('lignesLiquiditePositions', () => {
  const liq = [l('SNTS', 100, { valeur_moyenne_30j: 1_025_739_186 }), l('SVOC', 4, { valeur_moyenne_30j: 0, spread_pct: null, spread_source: null }), l('UNLC', 10, { valeur_moyenne_30j: 1_000_000 })];

  it('durée théorique par position, alertes en tête, liquidités exclues', () => {
    const r = lignesLiquiditePositions(
      [{ code: 'SNTS', valeur: 4_500_000 }, { code: 'UNLC', valeur: 5_000_000 }, { code: 'LIQUIDITES', valeur: 100_000 }],
      liq,
    );
    expect(r.map((x) => x.code)).toEqual(['UNLC', 'SNTS']);
    expect(r[0]!.duree).toEqual({ seances: 25, alerte: true });
    expect(r[1]!.duree).toEqual({ seances: 1, alerte: false });
    expect(r[1]!.classe).toBe('A');
  });

  it('valeur sans ligne ou sans moyenne : non mesurée, jamais 0', () => {
    const r = lignesLiquiditePositions([{ code: 'SVOC', valeur: 1_000_000 }, { code: 'ZZZZ', valeur: 1_000_000 }], liq);
    for (const x of r) {
      expect(x.duree.seances).toBeNull();
    }
    expect(r.find((x) => x.code === 'ZZZZ')!.mesuree).toBe(false);
    expect(r.find((x) => x.code === 'SVOC')!.valeurMoyenne30j).toBeNull();
  });
});

describe('extremesLiquidite', () => {
  it('cinq plus faciles, cinq plus difficiles, sans recouvrement', () => {
    const liq = Array.from({ length: 12 }, (_, k) => l(`V${k}`, k * 8));
    const e = extremesLiquidite(liq, 5);
    expect(e.faciles.map((x) => x.code)).toEqual(['V11', 'V10', 'V9', 'V8', 'V7']);
    expect(e.difficiles.map((x) => x.code)).toEqual(['V0', 'V1', 'V2', 'V3', 'V4']);
  });
  it('peu de valeurs : pas de doublon entre les deux listes ; scores nuls écartés', () => {
    const e = extremesLiquidite([l('A', 90), l('B', 50), l('C', 10), l('D', null)], 5);
    const tous = [...e.faciles, ...e.difficiles].map((x) => x.code);
    expect(new Set(tous).size).toBe(tous.length);
    expect(tous).not.toContain('D');
  });
});
```

- [ ] **Step 2 : constater l'échec** — `npx vitest run lib/dashboard/liquiditeBloc.test.ts` → FAIL.

- [ ] **Step 3 : implémenter** — créer `frontend/lib/dashboard/liquiditeBloc.ts` :

```ts
/**
 * Bloc « Liquidité » (spec §4.3). PUR et testé.
 * Une valeur sans ligne `liquidity_daily`, ou dont la moyenne vaut 0 (défaut
 * de la migration 0111), est « non mesurée » — jamais 0.
 */
import { fmtNumber } from '@/lib/format';
import { LIQUIDITES_CODE } from '@/lib/portfolio/constantes';
import { dureeTheorique, type DureeEcoulement } from './liquidite';

export interface LiquiditeSource {
  code: string;
  score: number | null;
  classe: string | null;
  spread_pct: number | null;
  spread_source: string | null;
  valeur_moyenne_30j: number | null;
}

export type Classe = 'A' | 'B' | 'C' | 'D';

export interface LigneLiquidite {
  code: string;
  valeurPosition: number | null;
  classe: Classe | null;
  fourchette: string | null;
  valeurMoyenne30j: number | null;
  duree: DureeEcoulement;
  mesuree: boolean;
}

const fini = (x: number | null | undefined): x is number => typeof x === 'number' && Number.isFinite(x);
const estClasse = (c: string | null): c is Classe => c === 'A' || c === 'B' || c === 'C' || c === 'D';

/** « 0,01 % » (carnet officiel) ou « ≈ 1,50 % » (estimation de Roll). */
export function fourchetteTexte(spreadPct: number | null, source: string | null): string | null {
  if (!fini(spreadPct) || spreadPct < 0) return null;
  return `${source === 'roll' ? '≈ ' : ''}${fmtNumber(spreadPct, 2)} %`;
}

export function lignesLiquiditePositions(
  positions: { code: string; valeur: number | null }[],
  liq: LiquiditeSource[],
): LigneLiquidite[] {
  const parCode = new Map(liq.map((r) => [r.code.trim().toUpperCase(), r]));
  return positions
    .filter((p) => p.code !== LIQUIDITES_CODE)
    .map((p) => {
      const code = p.code.trim().toUpperCase();
      const r = parCode.get(code);
      const moyenne = r && fini(r.valeur_moyenne_30j) && r.valeur_moyenne_30j > 0 ? r.valeur_moyenne_30j : null;
      const valeur = fini(p.valeur) ? p.valeur : null;
      return {
        code,
        valeurPosition: valeur,
        classe: r && estClasse(r.classe) ? r.classe : null,
        fourchette: r ? fourchetteTexte(r.spread_pct, r.spread_source) : null,
        valeurMoyenne30j: moyenne,
        duree: dureeTheorique(valeur, moyenne),
        mesuree: r != null && moyenne != null,
      };
    })
    .sort((x, y) => Number(y.duree.alerte) - Number(x.duree.alerte) || (y.valeurPosition ?? 0) - (x.valeurPosition ?? 0));
}

/** Les n valeurs les plus faciles et les n plus difficiles à échanger, sans recouvrement. */
export function extremesLiquidite(liq: LiquiditeSource[], n = 5): { faciles: LiquiditeSource[]; difficiles: LiquiditeSource[] } {
  const notees = liq.filter((r) => fini(r.score)).sort((x, y) => (y.score as number) - (x.score as number) || x.code.localeCompare(y.code));
  const faciles = notees.slice(0, n);
  const reste = notees.slice(faciles.length);
  const difficiles = reste.slice(-n).reverse();
  return { faciles, difficiles };
}
```

- [ ] **Step 4 : vérifier** — `npx vitest run lib/dashboard/liquiditeBloc.test.ts` → PASS ; `tsc` → `EXIT 0`.

- [ ] **Step 5 : commit**

```bash
git add lib/dashboard/liquiditeBloc.ts lib/dashboard/liquiditeBloc.test.ts
git commit -m "feat(dashboard): liquidité par position et extrêmes du marché, « non mesurée » plutôt que 0

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6 : Portefeuille — lignes de performance, contributions, positions sans cours

**Files:**
- Create: `frontend/lib/dashboard/portefeuilleBloc.ts`
- Create: `frontend/lib/dashboard/portefeuilleBloc.test.ts`

Rappel : `derivePortfolio` donne `cours = 0` à une position sans historique de cours. Le bloc doit le DIRE (« cours indisponible ») au lieu de valoriser à 0 en silence.

- [ ] **Step 1 : tests qui échouent** — créer `frontend/lib/dashboard/portefeuilleBloc.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { lignesPerfDepuis, contributions, positionsSansCours, variationsDuJour } from './portefeuilleBloc';
import type { EnrichedPosition } from '@/lib/portfolio/derive';

const pos = (code: string, o: Partial<EnrichedPosition> = {}): EnrichedPosition => ({
  code, quantite: 10, pru: 1000, cours: 1100, valeur: 11000, investi: 10000, pnl: 1000, pnlPct: 0.1,
  poids: 0.5, secteur: 'Autre', isLiquidites: false, ...o,
});
const jour = [
  { code: 'SNTS', cours_jour: 1100, variation_pct: 1.2, date_marche: '2026-10-13' },
  { code: 'ORAC', cours_jour: 500, variation_pct: -0.5, date_marche: '2026-10-13' },
];

describe('lignesPerfDepuis', () => {
  it('cours et variation de la séance, liquidités exclues, cours manquant = null', () => {
    const r = lignesPerfDepuis([pos('SNTS'), pos('BOAN'), pos('LIQUIDITES', { isLiquidites: true })], jour);
    expect(r).toEqual([
      { code: 'SNTS', quantite: 10, cours: 1100, variationPct: 1.2, dateMarche: '2026-10-13' },
      { code: 'BOAN', quantite: 10, cours: null, variationPct: null, dateMarche: null },
    ]);
  });
});

describe('variationsDuJour', () => {
  it('table code → variation, absente = undefined', () => {
    const v = variationsDuJour(jour);
    expect(v.get('SNTS')).toBe(1.2);
    expect(v.get('XXXX')).toBeUndefined();
  });
});

describe('contributions', () => {
  it('triées de la plus forte à la plus faible, largeur relative au maximum absolu', () => {
    const r = contributions([pos('A', { pnl: 3000 }), pos('B', { pnl: -6000 }), pos('C', { pnl: 0 }), pos('L', { isLiquidites: true, pnl: 0 })]);
    expect(r.map((x) => x.code)).toEqual(['A', 'C', 'B']);
    expect(r.find((x) => x.code === 'B')!.largeur).toBe(1);
    expect(r.find((x) => x.code === 'A')!.largeur).toBe(0.5);
  });
  it('position sans cours exclue (sa plus-value serait fausse)', () => {
    const r = contributions([pos('A', { pnl: 3000 }), pos('Z', { cours: 0, valeur: 0, pnl: -10000 })]);
    expect(r.map((x) => x.code)).toEqual(['A']);
  });
});

describe('positionsSansCours', () => {
  it('cours nul ou non fini, hors liquidités', () => {
    expect(positionsSansCours([pos('A'), pos('Z', { cours: 0 }), pos('L', { isLiquidites: true, cours: 0 })])).toEqual(['Z']);
  });
});
```

- [ ] **Step 2 : constater l'échec** — `npx vitest run lib/dashboard/portefeuilleBloc.test.ts` → FAIL.

- [ ] **Step 3 : implémenter** — créer `frontend/lib/dashboard/portefeuilleBloc.ts` :

```ts
/**
 * Bloc « Mon portefeuille » (spec §4.5). PUR et testé.
 * Aucun nouveau calcul financier : tout vient de `derivePortfolio` ; on ne
 * fait ici que relier ses positions aux cours de la séance affichée.
 */
import type { EnrichedPosition } from '@/lib/portfolio/derive';
import type { LignePerf } from './performanceJour';

export interface CoursSeance {
  code: string;
  cours_jour: number | null;
  variation_pct: number | null;
  date_marche: string;
}

const fini = (x: number | null | undefined): x is number => typeof x === 'number' && Number.isFinite(x);
const avecCours = (p: EnrichedPosition) => !p.isLiquidites && fini(p.cours) && p.cours > 0;

/** Lignes d'entrée de `performanceJour`, à partir des cours de LA séance affichée. */
export function lignesPerfDepuis(positions: EnrichedPosition[], seance: CoursSeance[]): LignePerf[] {
  const parCode = new Map(seance.map((s) => [s.code.trim().toUpperCase(), s]));
  return positions
    .filter((p) => !p.isLiquidites)
    .map((p) => {
      const s = parCode.get(p.code.trim().toUpperCase());
      return {
        code: p.code,
        quantite: p.quantite,
        cours: s && fini(s.cours_jour) ? s.cours_jour : null,
        variationPct: s && fini(s.variation_pct) ? s.variation_pct : null,
        dateMarche: s ? s.date_marche : null,
      };
    });
}

export function variationsDuJour(seance: CoursSeance[]): Map<string, number | null> {
  return new Map(seance.map((s) => [s.code.trim().toUpperCase(), fini(s.variation_pct) ? s.variation_pct : null]));
}

export interface Contribution { code: string; pnl: number; largeur: number }

/** Contribution de chaque position à la plus-value latente ; `largeur` ∈ [0,1] relative au plus grand écart. */
export function contributions(positions: EnrichedPosition[]): Contribution[] {
  const lignes = positions.filter((p) => avecCours(p) && fini(p.pnl));
  const max = Math.max(0, ...lignes.map((p) => Math.abs(p.pnl)));
  return lignes
    .map((p) => ({ code: p.code, pnl: p.pnl, largeur: max > 0 ? Math.abs(p.pnl) / max : 0 }))
    .sort((x, y) => y.pnl - x.pnl);
}

/** Positions valorisées à 0 faute de cours : à signaler, jamais à taire. */
export function positionsSansCours(positions: EnrichedPosition[]): string[] {
  return positions.filter((p) => !p.isLiquidites && !(fini(p.cours) && p.cours > 0)).map((p) => p.code);
}
```

- [ ] **Step 4 : vérifier** — `npx vitest run lib/dashboard/portefeuilleBloc.test.ts` → PASS ; `tsc` → `EXIT 0`.

- [ ] **Step 5 : commit**

```bash
git add lib/dashboard/portefeuilleBloc.ts lib/dashboard/portefeuilleBloc.test.ts
git commit -m "feat(dashboard): portefeuille relié à la séance, contributions, positions sans cours signalées

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7 : Chargeurs serveur et pagination

**Files:**
- Create: `frontend/lib/dashboard/pagination.ts`
- Create: `frontend/lib/dashboard/pagination.test.ts`
- Create: `frontend/lib/dashboard/chargement.ts`
- Modify: `frontend/lib/dashboard/agenda.ts` (exporter `plusJours`)

PostgREST tronque à 1000 lignes **sans prévenir** : en tri croissant, ce sont les cours les plus RÉCENTS qui disparaîtraient. D'où une lecture page par page.

- [ ] **Step 1 : tests qui échouent** — créer `frontend/lib/dashboard/pagination.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { toutesLesPages } from './pagination';

const source = Array.from({ length: 2350 }, (_, k) => k);
const page = async (de: number, a: number) => ({ data: source.slice(de, a + 1), error: null });

describe('toutesLesPages', () => {
  it('lit toutes les pages de 1000', async () => {
    expect(await toutesLesPages(page)).toHaveLength(2350);
  });
  it('une erreur arrête la lecture et remonte', async () => {
    let n = 0;
    const casse = async (de: number, a: number) => (++n === 2 ? { data: null, error: { message: 'boom' } } : page(de, a));
    await expect(toutesLesPages(casse)).rejects.toThrow('boom');
  });
  it('plafond de pages : refuse de tronquer en silence', async () => {
    await expect(toutesLesPages(page, 2)).rejects.toThrow(/plafond/);
  });
});
```

- [ ] **Step 2 : constater l'échec** — `npx vitest run lib/dashboard/pagination.test.ts` → FAIL.

- [ ] **Step 3 : implémenter** — créer `frontend/lib/dashboard/pagination.ts` :

```ts
/** PostgREST plafonne une réponse à 1000 lignes, en silence. */
export const TAILLE_PAGE = 1000;

type Page<T> = (de: number, a: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/**
 * Lit toutes les pages. Une erreur est levée (jamais un résultat partiel), et
 * dépasser `maxPages` lève aussi : mieux vaut un bloc indisponible qu'une
 * valorisation fausse et plausible.
 */
export async function toutesLesPages<T>(page: Page<T>, maxPages = 20): Promise<T[]> {
  const out: T[] = [];
  for (let n = 0; n < maxPages; n++) {
    const de = n * TAILLE_PAGE;
    const { data, error } = await page(de, de + TAILLE_PAGE - 1);
    if (error) throw new Error(error.message);
    const lignes = data ?? [];
    out.push(...lignes);
    if (lignes.length < TAILLE_PAGE) return out;
  }
  throw new Error(`plafond de ${maxPages} pages atteint`);
}
```

- [ ] **Step 4 : exporter `plusJours`** — dans `frontend/lib/dashboard/agenda.ts`, remplacer `function plusJours(` par `export function plusJours(`.

- [ ] **Step 5 : chargeurs** — créer `frontend/lib/dashboard/chargement.ts` :

```ts
import 'server-only';
/**
 * Chargeurs serveur des blocs du tableau de bord. Lecture sous RLS avec la
 * session de l'utilisateur. Chaque chargeur renvoie `null` en cas d'erreur
 * (journalisée côté serveur) : le bloc affiche alors « indisponible », jamais
 * une liste vide trompeuse.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { LIQUIDITES_CODE } from '@/lib/portfolio/constantes';
import { derivePortfolio, type PortfolioState, type RawPosition, type PricePoint } from '@/lib/portfolio/derive';
import { toutesLesPages } from './pagination';
import type { DividendeSource, FermetureSource } from './agenda';
import type { PublicationSource } from './publications';
import type { LiquiditeSource } from './liquiditeBloc';

function journal(bloc: string, message: string): null {
  console.error(`[dashboard] ${bloc} : lecture impossible :`, message);
  return null;
}

export async function chargerPortefeuille(sb: SupabaseClient, userId: string, aujourdhui: string): Promise<PortfolioState | null> {
  const { data: raw, error } = await sb
    .from('portfolios_positions')
    .select('code, quantite, prix_entree, date_entree')
    .eq('user_id', userId)
    .gt('quantite', 0);
  if (error) return journal('portefeuille', error.message);
  const rows = (raw ?? []) as { code: string; quantite: number; prix_entree: number; date_entree: string | null }[];
  const codes = [...new Set(rows.map((r) => r.code).filter((c) => c && c !== LIQUIDITES_CODE))];
  const entrees = rows.filter((r) => r.code !== LIQUIDITES_CODE).map((r) => r.date_entree).filter((d): d is string => !!d).sort();
  const depuis = entrees[0] ?? new Date(Date.parse(`${aujourdhui}T00:00:00Z`) - 365 * 86_400_000).toISOString().slice(0, 10);

  try {
    const [historique, instruments] = await Promise.all([
      codes.length
        ? toutesLesPages<{ code: string; cours_jour: number; date_marche: string }>((de, a) =>
            sb.from('brvm_actions_daily').select('code, cours_jour, date_marche')
              .in('code', codes).gte('date_marche', depuis).lte('date_marche', aujourdhui).not('cours_jour', 'is', null)
              .order('date_marche', { ascending: true }).order('code', { ascending: true }).range(de, a))
        : Promise.resolve([]),
      codes.length
        ? sb.from('brvm_instruments').select('code, secteur').in('code', codes)
        : Promise.resolve({ data: [] as { code: string; secteur: string | null }[], error: null }),
    ]);
    if (instruments.error) return journal('portefeuille (secteurs)', instruments.error.message);
    const secteurParCode = new Map(((instruments.data ?? []) as { code: string; secteur: string | null }[]).map((r) => [r.code, r.secteur]));
    const prix = new Map<string, PricePoint[]>();
    for (const r of historique) {
      const serie = prix.get(r.code) ?? [];
      serie.push({ date: r.date_marche, cours: r.cours_jour });
      prix.set(r.code, serie);
    }
    const positions: RawPosition[] = rows.map((r) => {
      const liq = r.code === LIQUIDITES_CODE;
      return {
        code: r.code, quantite: r.quantite, prix_entree: r.prix_entree, date_entree: r.date_entree,
        secteur: liq ? 'Liquidités' : (secteurParCode.get(r.code) ?? 'Autres'), is_liquidites: liq,
      };
    });
    return derivePortfolio(positions, prix, aujourdhui);
  } catch (e) {
    return journal('portefeuille (cours)', e instanceof Error ? e.message : String(e));
  }
}

export async function chargerDividendes(sb: SupabaseClient, debut: string, fin: string): Promise<DividendeSource[] | null> {
  const { data, error } = await sb
    .from('dividends')
    .select('code, montant, ex_date, payment_date, base_fiscale, source')
    .or(`and(ex_date.gte.${debut},ex_date.lte.${fin}),and(payment_date.gte.${debut},payment_date.lte.${fin})`)
    .limit(500);
  if (error) return journal('agenda (dividendes)', error.message);
  return (data ?? []) as DividendeSource[];
}

export async function chargerFermetures(sb: SupabaseClient, debut: string, fin: string): Promise<FermetureSource[] | null> {
  const { data, error } = await sb
    .from('market_calendar')
    .select('date, holiday_name, is_trading_day')
    .gte('date', debut).lte('date', fin).eq('is_trading_day', false);
  if (error) return journal('agenda (calendrier)', error.message);
  return (data ?? []) as FermetureSource[];
}

export async function chargerPublications(sb: SupabaseClient, depuis: string): Promise<PublicationSource[] | null> {
  const { data, error } = await sb
    .from('publications')
    .select('code, date_publication, libelle, type_publication, source_url')
    .gte('date_publication', depuis)
    .order('date_publication', { ascending: false })
    .limit(200);
  if (error) return journal('publications', error.message);
  return (data ?? []) as PublicationSource[];
}

export async function chargerLiquidite(sb: SupabaseClient): Promise<{ dateMarche: string; lignes: LiquiditeSource[] } | null> {
  const { data: der, error: e1 } = await sb.from('liquidity_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1);
  if (e1) return journal('liquidité', e1.message);
  const dateMarche = (der?.[0] as { date_marche: string } | undefined)?.date_marche;
  if (!dateMarche) return { dateMarche: '', lignes: [] };
  const { data, error } = await sb
    .from('liquidity_daily')
    .select('code, score, classe, spread_pct, spread_source, valeur_moyenne_30j')
    .eq('date_marche', dateMarche);
  if (error) return journal('liquidité', error.message);
  return { dateMarche, lignes: (data ?? []) as LiquiditeSource[] };
}
```

- [ ] **Step 6 : vérifier** — `npx vitest run lib/dashboard/pagination.test.ts lib/dashboard/agenda.test.ts` → PASS ; `timeout 600 npx tsc --noEmit; echo EXIT $?` → `EXIT 0`. Si le typage de `toutesLesPages` refuse le constructeur de requête Supabase (`PostgrestFilterBuilder` est un `PromiseLike`), garder le comportement et ajuster la signature de type — jamais avec `any`.

- [ ] **Step 7 : commit**

```bash
git add lib/dashboard/pagination.ts lib/dashboard/pagination.test.ts lib/dashboard/chargement.ts lib/dashboard/agenda.ts
git commit -m "feat(dashboard): chargeurs serveur des blocs, lecture paginée de l'historique de cours

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8 : Briques d'affichage communes

**Files:**
- Create: `frontend/components/dashboard/blocs/Cadre.tsx`

- [ ] **Step 1 : créer** `frontend/components/dashboard/blocs/Cadre.tsx` :

```tsx
import Link from 'next/link';
import type { ReactNode } from 'react';
import { fmtDateFR } from '@/lib/format';
import type { StatutAgenda } from '@/lib/dashboard/agenda';

/** Cadre commun d'un bloc : titre, date de référence TOUJOURS visible, lien. */
export function CadreBloc({
  id, titre, dateReference, legendeDate = 'Données du', ancienne = false, lien, children,
}: {
  id: string;
  titre: string;
  dateReference: string | null;
  legendeDate?: string;
  /** Donnée plus ancienne que la séance affichée : signalée dans la forme (spec §4). */
  ancienne?: boolean;
  lien?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="h-full min-w-0 rounded-panel border border-border bg-surface p-4 sm:p-5">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="font-display text-lg text-ivory">{titre}</h2>
        <div className="flex flex-wrap items-center gap-3">
          {dateReference && (
            <span
              className={`tabular rounded-full border px-2 py-0.5 text-[11px] ${ancienne ? 'border-warn/50 text-warn' : 'border-border text-muted'}`}
            >
              {legendeDate} {fmtDateFR(dateReference)}
            </span>
          )}
          {lien && (
            <Link href={lien.href} className="text-xs font-semibold text-accent-ink hover:underline">
              {lien.label} →
            </Link>
          )}
        </div>
      </header>
      {children}
    </section>
  );
}

/** État vide orienté action (spec §4.0) : toujours une phrase, jamais un cadre vide. */
export function EtatVide({ message, actions = [] }: { message: string; actions?: { href: string; label: string }[] }) {
  return (
    <div className="rounded-xl border border-dashed border-border-strong bg-bg/30 px-4 py-6 text-center">
      <p className="text-sm text-muted">{message}</p>
      {actions.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {actions.map((a) => (
            <Link key={a.href} href={a.href} className="rounded-full border border-accent/40 px-3 py-1.5 text-xs font-semibold text-accent-ink transition-colors hover:bg-accent/10">
              {a.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Lecture en erreur : distincte d'une liste vide. */
export function Indisponible() {
  return <EtatVide message="Données momentanément indisponibles. Réessayez dans quelques minutes." />;
}

const STATUTS: Record<StatutAgenda, { libelle: string; classe: string }> = {
  officiel: { libelle: 'Officiel', classe: 'border-up/40 text-up' },
  annonce: { libelle: 'Annoncé', classe: 'border-warn/40 text-warn' },
  fermeture: { libelle: 'Bourse fermée', classe: 'border-border-strong text-muted' },
};

export function PastilleStatut({ statut }: { statut: StatutAgenda }) {
  const s = STATUTS[statut];
  return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${s.classe}`}>{s.libelle}</span>;
}

/** Pastille neutre (type de publication, « Détenue »…). */
export function Pastille({ children, accent = false }: { children: ReactNode; accent?: boolean }) {
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${accent ? 'border-accent/50 text-accent-ink' : 'border-border-strong text-muted'}`}>
      {children}
    </span>
  );
}
```

- [ ] **Step 2 : vérifier** — `timeout 600 npx tsc --noEmit; echo EXIT $?` → `EXIT 0`. Vérifier par `grep` dans `tailwind.config.ts` que les couleurs utilisées existent : `warn`, `border-strong`, `accent-ink`, `up`, et le rayon `panel`.

- [ ] **Step 3 : commit**

```bash
git add components/dashboard/blocs/Cadre.tsx
git commit -m "feat(dashboard): cadre de bloc, date de référence, états vides et pastilles de statut

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9 : Bloc « Comprendre la séance »

**Files:**
- Create: `frontend/components/dashboard/blocs/BlocComprendre.tsx`

- [ ] **Step 1 : créer** :

```tsx
import { comprendreSeance, type MetriquesSeance } from '@/lib/dashboard/comprendre';
import { CadreBloc, EtatVide } from './Cadre';

/** Spec §4.4 — constats déterministes, affichés seulement une fois la séance close. */
export default function BlocComprendre({ metriques, close }: { metriques: MetriquesSeance | null; close: boolean }) {
  const constats = metriques && close ? comprendreSeance(metriques) : [];
  return (
    <CadreBloc
      id="bloc-comprendre"
      titre="Comprendre la séance"
      dateReference={metriques?.dateMarche ?? null}
      legendeDate="Séance du"
      lien={{ href: '/formations', label: "Apprendre avec l'Academy" }}
    >
      {!close ? (
        <EtatVide message="La séance n'est pas encore close ; l'explication paraît après la clôture." />
      ) : constats.length === 0 ? (
        <EtatVide message="Pas assez de données pour expliquer cette séance." />
      ) : (
        <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {constats.map((c, i) => (
            <li key={c.id} className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-border/60 bg-bg/40 p-3">
              <span className="tabular text-xs font-semibold text-accent-ink">{i + 1}</span>
              <p className="text-sm leading-snug text-ivory">{c.texte}</p>
              <p className="text-xs leading-snug text-muted">{c.sens}</p>
            </li>
          ))}
        </ol>
      )}
    </CadreBloc>
  );
}
```

- [ ] **Step 2 : vérifier** — `tsc` → `EXIT 0`.

- [ ] **Step 3 : commit**

```bash
git add components/dashboard/blocs/BlocComprendre.tsx
git commit -m "feat(dashboard): bloc Comprendre la séance

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10 : Blocs Agenda et Publications

**Files:**
- Create: `frontend/components/dashboard/blocs/BlocAgenda.tsx`
- Create: `frontend/components/dashboard/blocs/BlocPublications.tsx`

- [ ] **Step 1 : créer `BlocAgenda.tsx`** :

```tsx
import Link from 'next/link';
import { fmtNumber } from '@/lib/format';
import type { ItemAgenda } from '@/lib/dashboard/agenda';
import { CadreBloc, EtatVide, Indisponible, PastilleStatut, Pastille } from './Cadre';

const jourCourt = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

/**
 * Spec §4.1. Dividende PAR ACTION et TOTAL INDICATIF toujours distincts ;
 * « net » seulement si la source le dit. `items === null` : lecture en erreur.
 */
export default function BlocAgenda({
  items, aujourdhui, quantites,
}: {
  items: ItemAgenda[] | null;
  aujourdhui: string;
  quantites: ReadonlyMap<string, number>;
}) {
  const liste = (items ?? []).slice(0, 8);
  return (
    <CadreBloc id="bloc-agenda" titre="Agenda · 30 jours" dateReference={aujourdhui} legendeDate="À partir du" lien={{ href: '/calendrier', label: 'Calendrier complet' }}>
      {items === null ? (
        <Indisponible />
      ) : liste.length === 0 ? (
        <EtatVide
          message="Aucun dividende ni assemblée annoncés dans les 30 prochains jours."
          actions={[{ href: '/calendrier', label: 'Voir le calendrier complet' }]}
        />
      ) : (
        <ul className="divide-y divide-border/50">
          {liste.map((it) => {
            const n = it.code ? quantites.get(it.code) : undefined;
            return (
              <li key={`${it.type}-${it.code ?? ''}-${it.date}-${it.parAction ?? ''}`} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tabular w-24 shrink-0 text-xs text-muted">{jourCourt(it.date)}</span>
                  <PastilleStatut statut={it.statut} />
                  {it.mienne && <Pastille accent>Détenue</Pastille>}
                  {it.code ? (
                    <Link href={`/actions/${it.code}`} className="min-w-0 truncate text-sm text-ivory hover:text-accent-ink">{it.titre}</Link>
                  ) : (
                    <span className="min-w-0 truncate text-sm text-ivory">{it.titre}</span>
                  )}
                </div>
                {it.parAction != null && (
                  <p className="text-xs text-muted sm:pl-[6.5rem]">
                    <span className="tabular text-ivory">{fmtNumber(it.parAction, 2)} FCFA</span> par action
                    {it.baseFiscale === 'net' ? ' (net)' : it.baseFiscale === 'brut' ? ' (brut)' : ' · base fiscale non précisée'}
                    {it.totalIndicatif != null && n != null && (
                      <>
                        {' · '}total indicatif <span className="tabular text-ivory">{fmtNumber(it.totalIndicatif, 0)} FCFA</span> pour vos{' '}
                        {fmtNumber(n, 0)} titres, s&apos;ils sont détenus à la date de détachement
                      </>
                    )}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </CadreBloc>
  );
}
```

- [ ] **Step 2 : créer `BlocPublications.tsx`** :

```tsx
import Link from 'next/link';
import { fmtDateFR } from '@/lib/format';
import type { PublicationBloc } from '@/lib/dashboard/publications';
import { CadreBloc, EtatVide, Indisponible, Pastille } from './Cadre';

/** Spec §4.2 — documents des émetteurs (sources officielles), 7 derniers jours. */
export default function BlocPublications({ items, depuis }: { items: PublicationBloc[] | null; depuis: string }) {
  return (
    <CadreBloc id="bloc-publications" titre="Publications · 7 jours" dateReference={depuis} legendeDate="Depuis le">
      {items === null ? (
        <Indisponible />
      ) : items.length === 0 ? (
        <EtatVide message="Aucune publication d'émetteur ces 7 derniers jours." actions={[{ href: '/actualites', label: "Voir l'actualité" }]} />
      ) : (
        <ul className="divide-y divide-border/50">
          {items.map((p) => (
            <li key={`${p.code}-${p.date}-${p.url ?? p.libelle}`} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="tabular text-xs text-muted">{fmtDateFR(p.date)}</span>
                <Pastille>{p.typeLibelle}</Pastille>
                {p.mienne && <Pastille accent>Détenue</Pastille>}
                <Link href={`/actions/${p.code}`} className="text-xs font-semibold text-accent-ink hover:underline">{p.code}</Link>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 text-sm text-ivory">{p.libelle}</p>
                {p.url && (
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs text-accent-ink hover:underline">
                    Document ↗
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </CadreBloc>
  );
}
```

- [ ] **Step 3 : vérifier** — `tsc` → `EXIT 0`.

- [ ] **Step 4 : commit**

```bash
git add components/dashboard/blocs/BlocAgenda.tsx components/dashboard/blocs/BlocPublications.tsx
git commit -m "feat(dashboard): blocs Agenda et Publications

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11 : Bloc Liquidité

**Files:**
- Create: `frontend/components/dashboard/blocs/BlocLiquidite.tsx`

- [ ] **Step 1 : créer** :

```tsx
import Link from 'next/link';
import { fmtFcfa, fmtNumber, fmtDateFR } from '@/lib/format';
import { PARTICIPATION_VOLUME, SEUIL_ALERTE_SEANCES } from '@/lib/dashboard/liquidite';
import { lignesLiquiditePositions, extremesLiquidite, fourchetteTexte, type LiquiditeSource } from '@/lib/dashboard/liquiditeBloc';
import { CadreBloc, EtatVide, Indisponible } from './Cadre';

/**
 * Spec §4.3. Actif : ses positions, durée THÉORIQUE INDICATIVE. Débutant :
 * les valeurs les plus faciles et les plus difficiles à échanger.
 */
export default function BlocLiquidite({
  donnees, positions, dateSeance,
}: {
  donnees: { dateMarche: string; lignes: LiquiditeSource[] } | null;
  positions: { code: string; valeur: number | null }[];
  dateSeance: string;
}) {
  const ancienne = donnees != null && donnees.dateMarche !== '' && donnees.dateMarche < dateSeance;
  return (
    <CadreBloc
      id="bloc-liquidite"
      titre={positions.length > 0 ? 'Liquidité de mes positions' : 'Liquidité du marché'}
      dateReference={donnees?.dateMarche || null}
      ancienne={ancienne}
      lien={{ href: '/liquidite', label: 'Méthode et classement' }}
    >
      {donnees === null ? (
        <Indisponible />
      ) : donnees.lignes.length === 0 ? (
        <EtatVide message="Liquidité non mesurée pour le moment." />
      ) : positions.length > 0 ? (
        <Positions donnees={donnees} positions={positions} />
      ) : (
        <Marche lignes={donnees.lignes} />
      )}
    </CadreBloc>
  );
}

function Positions({ donnees, positions }: { donnees: { dateMarche: string; lignes: LiquiditeSource[] }; positions: { code: string; valeur: number | null }[] }) {
  const lignes = lignesLiquiditePositions(positions, donnees.lignes);
  return (
    <>
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[30rem] text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-faint">
            <tr className="border-b border-border">
              <th className="px-1 py-2 text-left font-medium">Valeur</th>
              <th className="px-1 py-2 text-right font-medium">Position</th>
              <th className="px-1 py-2 text-center font-medium">Classe</th>
              <th className="px-1 py-2 text-right font-medium">Fourchette</th>
              <th className="px-1 py-2 text-right font-medium">Échanges moy. 30 j</th>
              <th className="px-1 py-2 text-right font-medium">Durée théorique</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.code} className="border-b border-border/40 last:border-0">
                <td className="px-1 py-2"><Link href={`/actions/${l.code}`} className="font-semibold text-ivory hover:text-accent-ink">{l.code}</Link></td>
                <td className="tabular px-1 py-2 text-right text-muted">{l.valeurPosition != null ? fmtFcfa(l.valeurPosition) : '—'}</td>
                {l.mesuree ? (
                  <>
                    <td className="px-1 py-2 text-center text-ivory">{l.classe ?? '—'}</td>
                    <td className="tabular px-1 py-2 text-right text-muted">{l.fourchette ?? '—'}</td>
                    <td className="tabular px-1 py-2 text-right text-muted">{l.valeurMoyenne30j != null ? fmtFcfa(l.valeurMoyenne30j) : '—'}</td>
                    <td className="tabular px-1 py-2 text-right">
                      {l.duree.seances == null ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <span className={l.duree.alerte ? 'rounded-full border border-warn/50 px-2 py-0.5 text-warn' : 'text-ivory'}>
                          {fmtNumber(l.duree.seances, 0)} séance{l.duree.seances > 1 ? 's' : ''}
                        </span>
                      )}
                    </td>
                  </>
                ) : (
                  <td colSpan={4} className="px-1 py-2 text-right text-xs text-muted">Liquidité non mesurée pour cette valeur.</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] leading-snug text-faint">
        Durée théorique indicative, en supposant que vos ventes représentent {fmtNumber(PARTICIPATION_VOLUME * 100, 0)} % des échanges
        quotidiens moyens (30 séances au {fmtDateFR(donnees.dateMarche)}). Au-delà de {SEUIL_ALERTE_SEANCES} séances, la ligne est signalée.
        Ce n&apos;est pas une garantie d&apos;exécution. « ≈ » : fourchette estimée faute de carnet publié.
      </p>
    </>
  );
}

function Marche({ lignes }: { lignes: LiquiditeSource[] }) {
  const { faciles, difficiles } = extremesLiquidite(lignes, 5);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <ListeExtremes titre="Les plus faciles à échanger" items={faciles} />
        <ListeExtremes titre="Les plus difficiles à échanger" items={difficiles} />
      </div>
      <p className="mt-3 text-[11px] leading-snug text-faint">
        La fourchette est l&apos;écart entre le meilleur prix d&apos;achat et le meilleur prix de vente : plus elle est étroite, moins il en
        coûte d&apos;entrer ou de sortir. Une valeur peu échangée peut être difficile à vendre au prix affiché.
      </p>
    </>
  );
}

function ListeExtremes({ titre, items }: { titre: string; items: LiquiditeSource[] }) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs font-semibold text-muted">{titre}</p>
      <ul className="space-y-1.5">
        {items.map((r) => (
          <li key={r.code} className="flex items-baseline justify-between gap-2 text-sm">
            <Link href={`/actions/${r.code}`} className="font-semibold text-ivory hover:text-accent-ink">{r.code}</Link>
            <span className="tabular text-xs text-muted">
              classe {r.classe ?? '—'} · fourchette {fourchetteTexte(r.spread_pct, r.spread_source) ?? 'non mesurée'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2 : vérifier** — `tsc` → `EXIT 0`.

- [ ] **Step 3 : commit**

```bash
git add components/dashboard/blocs/BlocLiquidite.tsx
git commit -m "feat(dashboard): bloc Liquidité (mes positions / marché), durée théorique indicative

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12 : Bloc Portefeuille enrichi et courbe de valeur

**Files:**
- Create: `frontend/components/dashboard/blocs/CourbeValeur.tsx`
- Create: `frontend/components/dashboard/blocs/BlocPortefeuille.tsx`

- [ ] **Step 1 : créer `CourbeValeur.tsx`** (client — Recharts ne rend pas côté serveur) :

```tsx
'use client';

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useJetons } from '@/lib/theme/jetons';
import { fmtFcfa, fmtDateFR } from '@/lib/format';
import type { EquityPoint } from '@/lib/portfolio/derive';

const JETONS = ['accent', 'muted', 'border', 'surface', 'ivory'] as const;

/** Valeur du portefeuille et capital investi. Pas d'indice superposé (spec §4.5). */
export default function CourbeValeur({ points }: { points: EquityPoint[] }) {
  const c = useJetons(JETONS);
  if (points.length < 2) {
    return <p className="py-8 text-center text-sm text-muted">Historique insuffisant pour tracer la courbe (positions trop récentes).</p>;
  }
  return (
    <div className="h-56 w-full" role="img" aria-label="Courbe de la valeur du portefeuille et du capital investi">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 6, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid stroke={c.border} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickFormatter={(d: string) => fmtDateFR(d).slice(0, 5)} stroke={c.muted} style={{ fontSize: 11 }} minTickGap={28} />
          <YAxis tickFormatter={(v: number) => fmtFcfa(v)} stroke={c.muted} style={{ fontSize: 11 }} width={64} domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 8, color: c.ivory }}
            labelFormatter={(d) => fmtDateFR(String(d))}
            formatter={(v, nom) => [`${fmtFcfa(Number(v))} FCFA`, nom === 'value' ? 'Valeur' : 'Capital investi']}
          />
          <Line type="monotone" dataKey="invested" stroke={c.muted} strokeDasharray="4 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="value" stroke={c.accent} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2 : créer `BlocPortefeuille.tsx`** :

```tsx
import Link from 'next/link';
import type { ReactNode } from 'react';
import { fmtFcfa, fmtFcfaSigne, fmtNumber, fmtPctSigne } from '@/lib/format';
import type { PortfolioState } from '@/lib/portfolio/derive';
import type { ResultatPerfJour } from '@/lib/dashboard/performanceJour';
import { contributions, positionsSansCours } from '@/lib/dashboard/portefeuilleBloc';
import { CadreBloc, EtatVide, Indisponible } from './Cadre';
import CourbeValeur from './CourbeValeur';

const sens = (v: number | null | undefined) => (v == null ? 'text-ivory' : v > 0 ? 'text-up' : v < 0 ? 'text-down' : 'text-ivory');

const INVITATION = [
  { href: '/portefeuille', label: 'Créer mon portefeuille' },
  { href: '/portefeuille/import', label: 'Importer un relevé' },
  { href: '/actions', label: 'Suivre des valeurs' },
];

/**
 * Spec §4.5. `etat` : `undefined` = visiteur, `null` = lecture en erreur.
 * Aucun bouton « Vendre » : la plateforme ne passe pas d'ordres (spec §9).
 */
export default function BlocPortefeuille({
  etat, perf, variations,
}: {
  etat: PortfolioState | null | undefined;
  perf: ResultatPerfJour | null;
  variations: ReadonlyMap<string, number | null>;
}) {
  const titres = etat?.positions.filter((p) => !p.isLiquidites) ?? [];
  if (etat === null) {
    return <CadreBloc id="bloc-portefeuille" titre="Mon portefeuille" dateReference={null}><Indisponible /></CadreBloc>;
  }
  if (etat === undefined || titres.length === 0) {
    return (
      <CadreBloc id="bloc-portefeuille" titre="Mon portefeuille" dateReference={null}>
        <EtatVide message="Vous ne suivez encore aucune position." actions={INVITATION} />
      </CadreBloc>
    );
  }

  const manquants = positionsSansCours(etat.positions);
  const contrib = contributions(etat.positions);
  const pnlPct = etat.latentPnlPct != null ? etat.latentPnlPct * 100 : null;

  return (
    <CadreBloc
      id="bloc-portefeuille"
      titre="Mon portefeuille"
      dateReference={perf?.dateMarche ?? etat.lastDate}
      legendeDate="Séance du"
      lien={{ href: '/portefeuille', label: 'Détail' }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Chiffre libelle="Valeur" valeur={`${fmtFcfa(etat.currentValue)} FCFA`} />
        <Chiffre
          libelle="Plus-value latente"
          valeur={`${fmtFcfaSigne(etat.latentPnl)} FCFA`}
          detail={pnlPct != null ? fmtPctSigne(pnlPct, 1) : null}
          classe={sens(etat.latentPnl)}
        />
        <Chiffre
          libelle="Variation du jour"
          valeur={perf?.variationFcfa != null ? `${fmtFcfaSigne(perf.variationFcfa)} FCFA` : '—'}
          detail={
            perf?.portefeuillePct != null ? (
              <>
                {fmtPctSigne(perf.portefeuillePct)}
                <span className="text-muted">
                  {' · '}
                  {perf.comparable && perf.indicePct != null
                    ? `BRVM Composite ${fmtPctSigne(perf.indicePct)}`
                    : `indice non comparable (${perf.raison ?? 'indisponible'})`}
                </span>
              </>
            ) : (
              <span className="text-muted">{perf?.raison ?? 'non calculée'}</span>
            )
          }
          classe={sens(perf?.portefeuillePct)}
        />
      </div>

      {manquants.length > 0 && (
        <p className="mt-3 rounded-lg border border-warn/40 bg-warn/[0.06] px-3 py-2 text-xs text-warn">
          Valeur partielle : cours indisponible pour {manquants.join(', ')}.
        </p>
      )}

      <div className="mt-5">
        <CourbeValeur points={etat.equityCurve} />
        <p className="mt-1 text-[11px] text-faint">
          Trait plein : valeur au cours du marché · pointillés : capital investi. Suppose une détention continue depuis la date
          d&apos;entrée de chaque position.
        </p>
      </div>

      <div className="-mx-1 mt-5 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-faint">
            <tr className="border-b border-border">
              <th className="px-1 py-2 text-left font-medium">Valeur</th>
              <th className="px-1 py-2 text-right font-medium">Montant</th>
              <th className="px-1 py-2 text-right font-medium">Cours</th>
              <th className="px-1 py-2 text-right font-medium">Var. jour</th>
              <th className="px-1 py-2 text-right font-medium">Poids</th>
              <th className="px-1 py-2 text-right font-medium">PRU</th>
              <th className="px-1 py-2 text-right font-medium">Plus-value latente</th>
            </tr>
          </thead>
          <tbody>
            {etat.positions.map((p) => {
              const v = p.isLiquidites ? null : variations.get(p.code.trim().toUpperCase()) ?? null;
              const sansCours = !p.isLiquidites && !(p.cours > 0);
              return (
                <tr key={p.code} className="border-b border-border/40 last:border-0">
                  <td className="px-1 py-2">
                    {p.isLiquidites ? <span className="text-muted">Liquidités</span> : (
                      <Link href={`/actions/${p.code}`} className="font-semibold text-ivory hover:text-accent-ink">{p.code}</Link>
                    )}
                  </td>
                  <td className="tabular px-1 py-2 text-right text-ivory">{sansCours ? '—' : fmtFcfa(p.valeur)}</td>
                  <td className="tabular px-1 py-2 text-right text-muted">{p.isLiquidites || sansCours ? '—' : fmtNumber(p.cours, 0)}</td>
                  <td className={`tabular px-1 py-2 text-right ${sens(v)}`}>{v != null ? fmtPctSigne(v) : '—'}</td>
                  <td className="tabular px-1 py-2 text-right text-muted">{sansCours ? '—' : `${fmtNumber(p.poids * 100, 1)} %`}</td>
                  <td className="tabular px-1 py-2 text-right text-muted">{p.isLiquidites ? '—' : fmtNumber(p.pru, 0)}</td>
                  <td className={`tabular px-1 py-2 text-right ${sens(p.pnl)}`}>
                    {p.isLiquidites || sansCours ? '—' : `${fmtFcfaSigne(p.pnl)}${p.pnlPct != null ? ` (${fmtPctSigne(p.pnlPct * 100, 1)})` : ''}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold text-muted">Répartition par secteur</p>
          <ul className="space-y-2">
            {etat.sectors.map((s) => (
              <li key={s.secteur}>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">{s.secteur}</span>
                  <span className="tabular text-ivory">{fmtNumber(s.poids * 100, 1)} %</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border">
                  <div className="h-full rounded-full bg-accent/60" style={{ width: `${Math.max(0, Math.min(100, s.poids * 100))}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold text-muted">Contribution à la plus-value latente</p>
          <ul className="space-y-1.5">
            {contrib.map((c) => (
              <li key={c.code} className="grid grid-cols-[3.5rem_1fr_1fr_5.5rem] items-center gap-1 text-xs">
                <span className="font-semibold text-ivory">{c.code}</span>
                <span className="flex justify-end">{c.pnl < 0 && <span className="h-2 rounded-l bg-down/70" style={{ width: `${c.largeur * 100}%` }} />}</span>
                <span className="flex">{c.pnl > 0 && <span className="h-2 rounded-r bg-up/70" style={{ width: `${c.largeur * 100}%` }} />}</span>
                <span className={`tabular text-right ${sens(c.pnl)}`}>{fmtFcfaSigne(c.pnl)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </CadreBloc>
  );
}

function Chiffre({ libelle, valeur, detail, classe = 'text-ivory' }: { libelle: string; valeur: string; detail?: ReactNode; classe?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/60 bg-bg/40 p-3">
      <p className="text-[11px] uppercase tracking-wide text-faint">{libelle}</p>
      <p className={`tabular mt-1 text-xl font-semibold ${classe}`}>{valeur}</p>
      {detail != null && <p className={`tabular mt-0.5 text-xs ${classe}`}>{detail}</p>}
    </div>
  );
}
```

- [ ] **Step 3 : vérifier** — `timeout 600 npx tsc --noEmit; echo EXIT $?` → `EXIT 0`. Si les types du `Tooltip` Recharts refusent `formatter` / `labelFormatter`, typer les paramètres comme Recharts les déclare (`ValueType`, `NameType`), sans `any`, et sans changer l'affichage.

- [ ] **Step 4 : commit**

```bash
git add components/dashboard/blocs/CourbeValeur.tsx components/dashboard/blocs/BlocPortefeuille.tsx
git commit -m "feat(dashboard): portefeuille enrichi — bandeau, courbe, positions, secteurs, contributions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13 : Intégration dans la page et dans la personnalisation

**Files:**
- Modify: `frontend/app/dashboard/page.tsx`
- Modify: `frontend/components/dashboard/DashboardCustomizer.tsx`

- [ ] **Step 1 : imports de la page** — dans `frontend/app/dashboard/page.tsx` :
  - supprimer `import PortfolioComposition from '@/components/dashboard/PortfolioComposition';` (ne PAS supprimer le fichier du composant) ;
  - remplacer l'import de `@/lib/dashboard/widgets` par `import { resolveLayout, grouperEnRangees, classeRangee, type WidgetKey, type DashboardLayout, type Profil } from '@/lib/dashboard/widgets';` ;
  - ajouter :

```ts
import type { PortfolioState } from '@/lib/portfolio/derive';
import { construireAgenda, plusJours, HORIZON_JOURS } from '@/lib/dashboard/agenda';
import { performanceJour } from '@/lib/dashboard/performanceJour';
import { metriquesDepuisSeance, estSeanceClose } from '@/lib/dashboard/metriquesSeance';
import { preparerPublications } from '@/lib/dashboard/publications';
import { lignesPerfDepuis, variationsDuJour } from '@/lib/dashboard/portefeuilleBloc';
import { chargerPortefeuille, chargerDividendes, chargerFermetures, chargerPublications, chargerLiquidite } from '@/lib/dashboard/chargement';
import BlocComprendre from '@/components/dashboard/blocs/BlocComprendre';
import BlocAgenda from '@/components/dashboard/blocs/BlocAgenda';
import BlocPublications from '@/components/dashboard/blocs/BlocPublications';
import BlocLiquidite from '@/components/dashboard/blocs/BlocLiquidite';
import BlocPortefeuille from '@/components/dashboard/blocs/BlocPortefeuille';
```

- [ ] **Step 2 : chargement des blocs** — dans `Dashboard()`, JUSTE APRÈS le calcul de `const dateLabel = …` (donc après le retour anticipé `if (!lastDate)`), insérer :

```ts
  // ── Blocs adaptatifs : on ne lit que ce que le layout affiche ──────────────
  const aujourdhui = new Date().toISOString().slice(0, 10); // Abidjan = UTC+0
  const veut = (k: WidgetKey) => layout.includes(k);
  const besoinPortefeuille = veut('portefeuille') || veut('agenda') || veut('publications') || veut('liquidite');
  const finAgenda = plusJours(aujourdhui, HORIZON_JOURS);
  const depuisPublications = plusJours(aujourdhui, -7);
  const [etatPortefeuille, dividendes, fermetures, publicationsBrutes, liquidite] = await Promise.all([
    user && besoinPortefeuille
      ? chargerPortefeuille(supa, user.id, aujourdhui)
      : Promise.resolve<PortfolioState | null | undefined>(undefined),
    veut('agenda') ? chargerDividendes(supa, aujourdhui, finAgenda) : Promise.resolve([]),
    veut('agenda') ? chargerFermetures(supa, aujourdhui, finAgenda) : Promise.resolve([]),
    veut('publications') ? chargerPublications(supa, depuisPublications) : Promise.resolve([]),
    veut('liquidite') ? chargerLiquidite(supa) : Promise.resolve(null),
  ]);
  const titresDetenus = (etatPortefeuille?.positions ?? []).filter((p) => !p.isLiquidites);
  const quantites = new Map(titresDetenus.map((p) => [p.code.trim().toUpperCase(), p.quantite]));
  const agenda = dividendes === null || fermetures === null
    ? null
    : construireAgenda({
        aujourdhui,
        dividendes,
        assemblees: [], // spec §4.1 : vide tant qu'aucune date de RÉUNION n'est collectée
        fermetures,
        positions: titresDetenus.map((p) => ({ code: p.code, quantite: p.quantite })),
      });
  const publications = publicationsBrutes === null ? null : preparerPublications(publicationsBrutes, new Set(quantites.keys()));
  const coursSeance = actions.map((a) => ({ code: a.code, cours_jour: a.cours_jour, variation_pct: a.variation_pct, date_marche: a.date_marche }));
  const brvmc = indices.find((i) => i.code === 'BRVMC');
  const perf = etatPortefeuille
    ? performanceJour(
        lignesPerfDepuis(etatPortefeuille.positions, coursSeance),
        brvmc ? { variationPct: brvmc.variation_pct, dateMarche: brvmc.date_marche } : null,
      )
    : null;
  const metriques = metriquesDepuisSeance({
    dateMarche: lastDate,
    actions,
    indices,
    valeurTransactions: summary?.valeur_transactions ?? null,
    valeurTransactionsVeille: summaryPrev?.valeur_transactions ?? null,
  });
  const seanceClose = estSeanceClose(lastDate, new Date());
```

- [ ] **Step 3 : sections** — dans l'objet `sections`, remplacer l'entrée `portefeuille` (et retirer les entrées temporaires `null` de la tâche 2) par :

```tsx
    portefeuille: (
      <BlocPortefeuille etat={etatPortefeuille} perf={perf} variations={variationsDuJour(coursSeance)} />
    ),
    comprendre: <BlocComprendre metriques={metriques} close={seanceClose} />,
    agenda: <BlocAgenda items={agenda} aujourdhui={aujourdhui} quantites={quantites} />,
    publications: <BlocPublications items={publications} depuis={depuisPublications} />,
    liquidite: (
      <BlocLiquidite
        donnees={liquidite}
        positions={titresDetenus.map((p) => ({ code: p.code, valeur: p.cours > 0 ? p.valeur : null }))}
        dateSeance={lastDate}
      />
    ),
```

- [ ] **Step 4 : rendu par rangées et sections fixes déplacées** — dans le JSX :
  - remplacer le bloc `{layout.map((key) => (<div key={key}>{sections[key]}</div>))}` par :

```tsx
        {/* ── Widgets configurables, par rangées (spec §4.0) ── */}
        {grouperEnRangees(layout.filter((k) => sections[k] != null)).map((r) => (
          <div key={r.cles.join('-')} className={classeRangee(r)}>
            {r.cles.map((k) => (
              <div key={k} className="min-w-0">{sections[k]}</div>
            ))}
          </div>
        ))}
```

  - DÉPLACER, sans les modifier, les trois sections fixes `<MacroBanner />`, la section `aria-label="Indices pan-africains"` et la section `aria-label="Signaux intraday patterns"` APRÈS ce rendu des widgets (et avant le `<footer>`), précédées du commentaire `{/* Sections fixes, sous les widgets : le premier bloc lu est celui du profil (spec §8). */}`. Le bandeau d'alertes déclenchées reste AVANT les widgets.

- [ ] **Step 5 : personnalisation** — dans `frontend/components/dashboard/DashboardCustomizer.tsx` :
  - importer `MASQUES_PAR_DEFAUT` depuis `@/lib/dashboard/widgets` ;
  - dans `reset()`, remplacer `setHidden(new Set())` par `setHidden(new Set(MASQUES_PAR_DEFAUT[profil]))`.

- [ ] **Step 6 : vérifier**
  - `timeout 600 npx tsc --noEmit; echo EXIT $?` → `EXIT 0` ;
  - `timeout 600 npx vitest run` → tout vert ;
  - `grep -rn "PortfolioComposition" app components lib` : signaler dans le rapport s'il ne reste plus aucun import (ne PAS supprimer le fichier dans ce plan).

- [ ] **Step 7 : commit**

```bash
git add app/dashboard/page.tsx components/dashboard/DashboardCustomizer.tsx
git commit -m "feat(dashboard): blocs adaptatifs branchés, rangées par niveau, sections fixes sous les widgets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14 : E2E et vérification d'ensemble

**Files:**
- Create: `frontend/e2e/dashboard-blocs.spec.ts`

- [ ] **Step 1 : créer** `frontend/e2e/dashboard-blocs.spec.ts` (même convention de session que `frontend/e2e/dashboard-auth.spec.ts`) :

```ts
import { test, expect } from '@playwright/test';
import fs from 'node:fs';

/**
 * Blocs adaptatifs du tableau de bord (spec §8) : rendu sans valeur cassée et
 * sans débordement horizontal sur mobile. Exige une session locale sérialisée
 * en cookie Playwright (hors dépôt) ; sans elle → skip propre.
 */
const COOKIE_FILE = process.env.PW_COOKIES ?? String.raw`C:\Users\adego\AppData\Local\Temp\pw-cookies.json`;

for (const vue of [{ nom: 'ordinateur', width: 1366, height: 900 }, { nom: 'mobile', width: 390, height: 844 }]) {
  test(`dashboard (${vue.nom}) : blocs rendus, aucune valeur cassée`, async ({ page, context }) => {
    test.skip(!fs.existsSync(COOKIE_FILE), 'Session locale absente (cookie Playwright non fourni).');
    await context.addCookies(JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf8')));
    await page.setViewportSize({ width: vue.width, height: vue.height });
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    test.skip(page.url().includes('/login'), 'Session expirée → redirigé vers /login.');
    await page.waitForTimeout(3000);

    const texte = await page.locator('body').innerText();
    expect(texte).not.toMatch(/\bNaN\b|\bundefined\b|\bInfinity\b/);
    await expect(page.getByRole('heading', { name: 'Mon portefeuille' })).toBeVisible();

    const deborde = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(deborde, 'débordement horizontal de la page').toBe(false);
  });
}
```

- [ ] **Step 2 : vérification d'ensemble** (depuis `frontend/`) :
  - `timeout 600 npx vitest run` → tout vert ;
  - `timeout 600 npx tsc --noEmit; echo EXIT $?` → `EXIT 0` ;
  - E2E : seulement si une session locale existe (`PW_COOKIES` ou le fichier par défaut) ; sinon le noter NON exécuté dans le rapport. Ne jamais lancer `npm run build`.

- [ ] **Step 3 : commit**

```bash
git add e2e/dashboard-blocs.spec.ts
git commit -m "test(e2e): blocs du tableau de bord sans valeur cassée ni débordement mobile

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4 : PR empilée** — pousser `feat/dashboard-adaptatif-p2` et ouvrir une PR avec `--base feat/dashboard-adaptatif` (corps dans un fichier du scratchpad, terminé par la ligne 🤖). **Ne pas fusionner** sans « fusionner ».
