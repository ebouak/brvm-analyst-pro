# Fiche action en note d'analyse — PR 1 : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Réorganiser la fiche `/actions/[code]` en six rubriques éditoriales + Mon suivi, avec un seul système de titres, des états d'absence explicites, l'actionnariat toujours visible, la fraîcheur en tête, et l'onglet mobile « Actions » à la place de « Conseiller ».

**Architecture:** Aucune nouvelle requête ni migration : la page serveur `app/actions/[code]/page.tsx` redistribue les données qu'elle charge déjà. Les règles (rubriques, ancres héritées, états d'absence, fraîcheur) vivent dans des modules purs testés sous `lib/fiche/`. Les blocs existants sont déplacés tels quels ; `ProfilSociete` et `VueEnsemble` sont découpés en sous-composants exportés.

**Tech Stack:** Next 14 App Router (rendu serveur), React 18, Tailwind (jetons `--color-*`), vitest, PostHog (`phCapture`, derrière consentement), Playwright (captures).

Spec : `docs/superpowers/specs/2026-11-10-fiche-action-note-analyse-design.md` (v2). Worktree : `C:\Users\adego\wt\brvm-fiche-note`, branche `design/fiche-note-analyse`. Commandes lancées depuis `frontend/`.

**Écarts à la spec relevés en lisant le code** (reportés dans la spec) :
- `lib/fiche/lecture.ts` existe déjà (lecture technique) : le module de conclusion de la PR 2 s'appellera `lib/fiche/lectureSynthese.ts`.
- La liquidité en base est une **moyenne** de valeur échangée sur 30 séances (`liquidity.valeurMoyenne`), pas une médiane ; L'essentiel l'affiche déjà (carte « Négociabilité »).
- La barre est faite de liens de page : `nav` + `aria-current`, pas `role="tablist"` (un `tablist` annoncerait des panneaux sans changement d'adresse).

---

## Carte des fichiers

| Fichier | Rôle | Action |
|---|---|---|
| `lib/fiche/rubriques.ts` (+ test) | 7 rubriques, anciennes valeurs, ancres héritées, liens | Modifier |
| `lib/fiche/absence.ts` (+ test) | Textes des 4 états d'absence | Créer |
| `lib/fiche/fraicheur.ts` (+ test) | Comptes anciens au-delà de 18 mois | Créer |
| `components/fiche/DonneeAbsente.tsx` | Rendu d'un état d'absence | Créer |
| `components/fiche/SousSection.tsx` | `h3` + ancre + pied | Créer |
| `components/fiche/Chapitre.tsx` | `numero` facultatif, `h2` focalisable | Modifier |
| `components/fiche/ProfilSociete.tsx` | Découpé en exports nommés | Modifier |
| `components/fiche/VueEnsemble.tsx` | Réduit à `StatsEtCours` + `AProposBloc` | Modifier |
| `components/analytics/LienSuivi.tsx` | `Link` qui capture un événement | Créer |
| `components/premium/SectionLock.tsx` | Prop facultative `suivi` | Modifier |
| `components/actions/FicheStickyNav.tsx` | Mon suivi séparé, priorité du paramètre, défilement, focus | Modifier |
| `components/BottomNav.tsx` | « Conseiller » → « Actions » | Modifier |
| `app/actions/[code]/page.tsx` | Rendu par rubrique réécrit | Modifier |

---

### Task 1 : rubriques, anciennes valeurs, ancres héritées

**Files:** Modify `lib/fiche/rubriques.ts`, `lib/fiche/rubriques.test.ts`

- [ ] **Step 1 : remplacer les tests**

```ts
import { describe, expect, it } from 'vitest';
import { RUBRIQUES, rubriqueDepuis, rubriqueDeAncre, hrefRubrique } from './rubriques';

describe('RUBRIQUES', () => {
  it('six rubriques de la note puis Mon suivi, à part', () => {
    expect(RUBRIQUES.map((r) => r.id)).toEqual(['synthese', 'societe', 'resultats', 'valorisation', 'marche', 'actualites', 'suivi']);
    expect(RUBRIQUES.filter((r) => r.groupe === 'perso').map((r) => r.id)).toEqual(['suivi']);
  });
  it('chaque rubrique porte une question', () => {
    for (const r of RUBRIQUES) expect(r.question.endsWith('?')).toBe(true);
  });
});

describe('rubriqueDepuis', () => {
  it('synthèse par défaut, valeur inconnue refusée', () => {
    expect(rubriqueDepuis(undefined)).toBe('synthese');
    expect(rubriqueDepuis('')).toBe('synthese');
    expect(rubriqueDepuis('<script>')).toBe('synthese');
  });
  it('accepte une rubrique connue et la première valeur répétée', () => {
    expect(rubriqueDepuis('resultats')).toBe('resultats');
    expect(rubriqueDepuis(['suivi', 'marche'])).toBe('suivi');
  });
  it('traduit les anciennes valeurs (liens partagés)', () => {
    expect(rubriqueDepuis('vue-ensemble')).toBe('synthese');
    expect(rubriqueDepuis('aujourdhui')).toBe('marche');
    expect(rubriqueDepuis('titre')).toBe('marche');
    expect(rubriqueDepuis('entreprise')).toBe('societe');
  });
});

describe('rubriqueDeAncre', () => {
  it('rattache les ancres héritées', () => {
    expect(rubriqueDeAncre('#liquidite')).toBe('marche');
    expect(rubriqueDeAncre('#carnet')).toBe('marche');
    expect(rubriqueDeAncre('#technique')).toBe('marche');
    expect(rubriqueDeAncre('#profil')).toBe('societe');
    expect(rubriqueDeAncre('#actionnariat')).toBe('societe');
    expect(rubriqueDeAncre('#fondamentaux')).toBe('resultats');
    expect(rubriqueDeAncre('#dividendes')).toBe('valorisation');
    expect(rubriqueDeAncre('#valorisation')).toBe('valorisation');
    expect(rubriqueDeAncre('#actualites-officielles')).toBe('actualites');
    expect(rubriqueDeAncre('#these')).toBe('suivi');
    expect(rubriqueDeAncre('#essentiel')).toBe('synthese');
  });
  it('ignore une ancre inconnue ou vide', () => {
    expect(rubriqueDeAncre('#rubrique')).toBeNull();
    expect(rubriqueDeAncre('')).toBeNull();
  });
});

describe('hrefRubrique', () => {
  it('garde la période, pose l’ancre de contenu ou une ancre précise', () => {
    expect(hrefRubrique('resultats', '2025-01-01')).toBe('?rubrique=resultats&from=2025-01-01#rubrique');
    expect(hrefRubrique('synthese', '')).toBe('?#rubrique');
    expect(hrefRubrique('marche', '', 'liquidite')).toBe('?rubrique=marche#liquidite');
  });
});
```

- [ ] **Step 2 :** `npx vitest run lib/fiche/rubriques` → FAIL (ids inconnus).

- [ ] **Step 3 : réécrire `lib/fiche/rubriques.ts`**

```ts
/**
 * Rubriques de la fiche action : une seule s'affiche à la fois (`?rubrique=`).
 * Chaque rubrique répond à UNE question du lecteur (spec v2 § 1.2). Les anciennes
 * valeurs et les anciennes ancres restent valides : un lien partagé ne casse pas.
 */
export const RUBRIQUES = [
  { id: 'synthese', label: 'Synthèse', groupe: 'note', question: 'Que faut-il retenir, et avec quel degré de confiance ?' },
  { id: 'societe', label: 'Société', groupe: 'note', question: 'Que fait-elle et qui la contrôle ?' },
  { id: 'resultats', label: 'Résultats', groupe: 'note', question: 'Gagne-t-elle de l’argent, et de mieux en mieux ?' },
  { id: 'valorisation', label: 'Valorisation et dividendes', groupe: 'note', question: 'Est-ce cher, et que me verse-t-elle ?' },
  { id: 'marche', label: 'Cours et liquidité', groupe: 'note', question: 'Puis-je acheter et revendre, à quel coût ?' },
  { id: 'actualites', label: 'Actualités et calendrier', groupe: 'note', question: 'Qu’est-ce qui a changé, qu’est-ce qui arrive ?' },
  { id: 'suivi', label: 'Mon suivi', groupe: 'perso', question: 'Où en est ma propre thèse ?' },
] as const;

export type Rubrique = (typeof RUBRIQUES)[number]['id'];

const IDS = new Set<string>(RUBRIQUES.map((r) => r.id));

/** Valeurs de `?rubrique=` livrées par la PR #201 (5 rubriques). */
const ANCIENNES: Record<string, Rubrique> = {
  'vue-ensemble': 'synthese', aujourdhui: 'marche', titre: 'marche', entreprise: 'societe',
};

export function rubriqueDepuis(param: string | string[] | undefined): Rubrique {
  const v = Array.isArray(param) ? param[0] : param;
  if (!v) return 'synthese';
  if (IDS.has(v)) return v as Rubrique;
  return ANCIENNES[v] ?? 'synthese';
}

/** Ancres historiques → rubrique qui les contient désormais. */
const ANCRES: Record<string, Rubrique> = {
  synthese: 'synthese', 'vue-ensemble': 'synthese', essentiel: 'synthese', 'analyse-ia': 'synthese', lecture: 'synthese',
  societe: 'societe', entreprise: 'societe', profil: 'societe', direction: 'societe', actionnariat: 'societe', identite: 'societe',
  resultats: 'resultats', fondamentaux: 'resultats', exercice: 'resultats', ifrs: 'resultats', 'points-cles': 'resultats',
  valorisation: 'valorisation', dividendes: 'valorisation', multiples: 'valorisation',
  marche: 'marche', aujourdhui: 'marche', titre: 'marche', liquidite: 'marche', carnet: 'marche', seance: 'marche',
  cours: 'marche', technique: 'marche', saisonnalite: 'marche',
  actualites: 'actualites', evenements: 'actualites', calendrier: 'actualites', 'actualites-officielles': 'actualites',
  suivi: 'suivi', these: 'suivi', discussions: 'suivi', outils: 'suivi',
};

export function rubriqueDeAncre(hash: string): Rubrique | null {
  return ANCRES[hash.replace(/^#/, '')] ?? null;
}

/** Lien relatif vers une rubrique ; conserve la période du graphique (`from`). */
export function hrefRubrique(id: Rubrique, from: string, ancre = 'rubrique'): string {
  const p = new URLSearchParams();
  if (id !== 'synthese') p.set('rubrique', id);
  if (from) p.set('from', from);
  return `?${p.toString()}#${ancre}`;
}
```

- [ ] **Step 4 :** `npx vitest run lib/fiche/rubriques` → PASS.
- [ ] **Step 5 :** commit `feat(fiche): sept rubriques, anciennes valeurs et ancres traduites`.

### Task 2 : états d'absence et fraîcheur (purs)

**Files:** Create `lib/fiche/absence.ts`, `lib/fiche/absence.test.ts`, `lib/fiche/fraicheur.ts`, `lib/fiche/fraicheur.test.ts`

- [ ] **Step 1 : tests**

```ts
// lib/fiche/absence.test.ts
import { describe, expect, it } from 'vitest';
import { fmtDateCourte } from '@/lib/format';
import { texteAbsence } from './absence';

describe('texteAbsence', () => {
  it('distingue non collecté et non publié', () => {
    expect(texteAbsence({ etat: 'non_collecte' })).toBe('Pas encore collecté par WESTBOURSE.');
    expect(texteAbsence({ etat: 'non_publie', verifieLe: '2026-11-09' }))
      .toBe(`Non publié par la société ni par la BRVM à notre connaissance (vérifié le ${fmtDateCourte('2026-11-09')}).`);
  });
  it('sans objet et ancien', () => {
    expect(texteAbsence({ etat: 'sans_objet' })).toBe('Sans objet pour cette société.');
    expect(texteAbsence({ etat: 'ancien', date: '2023-12-31' })).toBe(`Dernière donnée connue : ${fmtDateCourte('2023-12-31')}.`);
  });
});
```

```ts
// lib/fiche/fraicheur.test.ts
import { describe, expect, it } from 'vitest';
import { fraicheurComptes } from './fraicheur';

describe('fraicheurComptes (clôture au 31/12, ancien au-delà de 18 mois)', () => {
  const auj = new Date('2026-11-10T00:00:00Z');
  it('2025 : limite 30/06/2027, à jour', () => {
    expect(fraicheurComptes(2025, auj)).toEqual({ exercice: 2025, ancien: false });
  });
  it('2024 : limite 30/06/2026 dépassée, ancien', () => {
    expect(fraicheurComptes(2024, auj)).toEqual({ exercice: 2024, ancien: true });
  });
  it('sans exercice : null', () => {
    expect(fraicheurComptes(null, auj)).toBeNull();
  });
});
```

- [ ] **Step 2 :** `npx vitest run lib/fiche/absence lib/fiche/fraicheur` → FAIL (modules absents).

- [ ] **Step 3 : implémentations**

```ts
// lib/fiche/absence.ts
import { fmtDateCourte } from '@/lib/format';

/** Les quatre états d'absence de la spec v2 § 6. Jamais de tiret ni de zéro par défaut. */
export type EtatAbsence =
  | { etat: 'non_collecte' }
  | { etat: 'non_publie'; verifieLe: string }
  | { etat: 'sans_objet' }
  | { etat: 'ancien'; date: string };

export function texteAbsence(a: EtatAbsence): string {
  switch (a.etat) {
    case 'non_collecte': return 'Pas encore collecté par WESTBOURSE.';
    case 'non_publie': return `Non publié par la société ni par la BRVM à notre connaissance (vérifié le ${fmtDateCourte(a.verifieLe)}).`;
    case 'sans_objet': return 'Sans objet pour cette société.';
    case 'ancien': return `Dernière donnée connue : ${fmtDateCourte(a.date)}.`;
  }
}
```

```ts
// lib/fiche/fraicheur.ts
/** Comptes « anciens » au-delà de 18 mois après la clôture (31/12 de l'exercice). */
export const MOIS_COMPTES_ANCIENS = 18;

export function fraicheurComptes(exercice: number | null, maintenant = new Date()): { exercice: number; ancien: boolean } | null {
  if (exercice == null) return null;
  const limite = new Date(Date.UTC(exercice, 11, 31));
  limite.setUTCMonth(limite.getUTCMonth() + MOIS_COMPTES_ANCIENS);
  return { exercice, ancien: maintenant.getTime() > limite.getTime() };
}
```

- [ ] **Step 4 :** tests → PASS.
- [ ] **Step 5 :** commit `feat(fiche): états d'absence et fraîcheur des comptes`.

### Task 3 : composants de titre et d'absence

**Files:** Create `components/fiche/SousSection.tsx`, `components/fiche/DonneeAbsente.tsx`; Modify `components/fiche/Chapitre.tsx`

- [ ] **Step 1 : `Chapitre`, `numero` facultatif** (les pages qui le passent, comme `/secteurs`, restent identiques)

```tsx
/** `premier` resserre l'espace au-dessus d'un chapitre qui suit directement l'en-tête de page. */
export function Chapitre({ id, numero, titre, sousTitre, premier }: { id: string; numero?: string; titre: string; sousTitre: string; premier?: boolean }) {
  return (
    <div id={id} className={`${premier ? 'mt-8 pt-8' : 'mt-16 pt-11'} grid scroll-mt-24 ${numero ? 'grid-cols-[48px_1fr]' : 'grid-cols-1'} gap-y-1 border-t border-border-strong`}>
      {numero && <span className="tabular pt-2.5 text-sm text-accent-ink">{numero}</span>}
      <h2 id={`${id}-titre`} tabIndex={-1} className="font-display text-3xl leading-tight text-ivory [text-wrap:balance] focus:outline-none md:text-[34px]">{titre}</h2>
      <p className={`${numero ? 'col-start-2' : ''} text-sm text-faint`}>{sousTitre}</p>
    </div>
  );
}
```

- [ ] **Step 2 : `SousSection`**

```tsx
import type { ReactNode } from 'react';

/** Sous-section d'une rubrique de la fiche : un seul format de titre partout (spec v2 § 4). */
export function SousSection({ id, titre, pied, action, children }: { id: string; titre: string; pied?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id={`${id}-h`} className="text-lg font-medium text-ivory">{titre}</h3>
        {action}
      </div>
      {children}
      {pied && <p className="mt-2 text-xs text-faint">{pied}</p>}
    </section>
  );
}
```

- [ ] **Step 3 : `DonneeAbsente`**

```tsx
import { texteAbsence, type EtatAbsence } from '@/lib/fiche/absence';

/** Rendu unique des quatre états d'absence (spec v2 § 6). */
export function DonneeAbsente(a: EtatAbsence) {
  return <p className="rounded-card border border-dashed border-border px-4 py-3 text-sm text-muted">{texteAbsence(a)}</p>;
}
```

- [ ] **Step 4 :** `npx tsc --noEmit -p .` → 0 erreur. Commit `feat(fiche): SousSection, DonneeAbsente, numéro de chapitre facultatif`.

### Task 4 : découper `ProfilSociete`

**Files:** Modify `components/fiche/ProfilSociete.tsx` (seul importeur : `app/actions/[code]/page.tsx`, vérifié le 2026-11-10)

Le composant par défaut est remplacé par des exports nommés. Le markup interne de chaque bloc est repris **tel quel** du fichier actuel.

- [ ] **Step 1 :** exporter, avec les classes existantes :
  - `ProfilPresentation({ profil })` → paragraphe `presentation`, ou `null` ;
  - `ProfilHistorique({ profil })` → paragraphe `historique`, ou `null` ;
  - `ProfilListe({ items, ton })` → liste à tiret (Métiers `ton="fort"`, Déterminants `ton="doux"`), `null` si vide ;
  - `PointsCles({ points })` → liste + « Calculés à partir des comptes et des dividendes affichés sur cette fiche. », `null` si vide ;
  - `ProfilDirection({ profil })` → `dl` des dirigeants avec `Source` ; vide ou `profil` nul → `<DonneeAbsente etat="non_collecte" />` ;
  - `ProfilActionnariat({ profil })` → barres + « Document du {date}, source {Source} » ; `actionnariat` nul → `<DonneeAbsente etat="non_collecte" />` ; somme des `pct` < 99,5 → ligne « Flottant et autres (calculé) » = `100 − somme`, barre `bg-border` ;
  - `ProfilIdentite({ profil })` → `dl` d'identité, ou `null` ;
  - `NoteSources({ profil })` → « Dirigeants et actionnariat ne sont repris que de sources officielles (BRVM, société) ; vérifié le {date}. » + lignes Identité et Site web actuelles.
  - Les trois blocs nuls acceptent `profil: Profil | null`.
- [ ] **Step 2 :** commit `refactor(fiche): profil découpé en sous-sections, actionnariat toujours rendu` (tsc rouge jusqu'à la Task 8, attendu).

### Task 5 : découper `VueEnsemble`

**Files:** Modify `components/fiche/VueEnsemble.tsx` (seul importeur : `page.tsx`)

- [ ] **Step 1 :** remplacer l'export `VueEnsemble` par :
  - `StatsEtCours({ lignes, series, jour, variationJour, periodeDefaut })` : colonne gauche haute actuelle (grille `dl` + `CoursPeriodes`), inchangée ;
  - `export function AProposBloc` (rendu affiché dans Société › Identité), titre interne « À propos de {nom} » remplacé par « Le titre en bref » ;
  - `PerformanceBloc`, `SyntheseBloc` supprimés (doublons de `FundamentalsPanel`, qui porte le graphique CA / résultat net, et de `VerdictBand` + `CombinedAlphaCarte`) ; import `ActualitesValeur` retiré.
- [ ] **Step 2 :** commit `refactor(fiche): VueEnsemble réduit à StatsEtCours et AProposBloc`.

### Task 6 : suivi des clics de verrou

**Files:** Create `components/analytics/LienSuivi.tsx`; Modify `components/premium/SectionLock.tsx`

- [ ] **Step 1 : `LienSuivi`**

```tsx
'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { phCapture } from '@/lib/analytics/posthogClient';

/** Lien qui capture un événement au clic (no-op sans consentement, cf. phCapture). */
export function LienSuivi({ href, evenement, proprietes, className, children }: { href: string; evenement: string; proprietes?: Record<string, unknown>; className?: string; children: ReactNode }) {
  return <Link href={href} className={className} onClick={() => { void phCapture(evenement, proprietes); }}>{children}</Link>;
}
```

- [ ] **Step 2 : `SectionLock`** : prop facultative `suivi?: Record<string, unknown>`. Si présente, « Débloquer » est rendu par `<LienSuivi href="/account/plan" evenement="fiche_verrou_clic" proprietes={suivi} className={CLS}>`, sinon par le `Link` actuel, où `CLS` = classes actuelles + `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`.
- [ ] **Step 3 :** tsc ; commit `feat(analytics): clic sur un verrou de la fiche mesuré`.

### Task 7 : barre de rubriques

**Files:** Modify `components/actions/FicheStickyNav.tsx`

- [ ] **Step 1 : redirection d'ancre, paramètre prioritaire, défilement**

```tsx
useEffect(() => {
  const hash = window.location.hash;
  const aParam = new URLSearchParams(window.location.search).has('rubrique');
  const cible = rubriqueDeAncre(hash);
  if (!aParam && cible && cible !== actif) {
    router.replace(hrefRubrique(cible, from, hash.slice(1)), { scroll: false });
    return;
  }
  if (hash && hash !== '#rubrique') document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
}, [actif, from, router]);
```

- [ ] **Step 2 : focus et onglet actif visible au changement de rubrique**

```tsx
const premierRendu = useRef(true);
useEffect(() => {
  document.querySelector<HTMLElement>('[data-rubrique][aria-current="page"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  if (premierRendu.current) { premierRendu.current = false; return; }
  document.getElementById(`${actif}-titre`)?.focus({ preventScroll: true });
}, [actif]);
```

- [ ] **Step 3 : rendu** : rubriques `groupe === 'note'`, puis `<span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />`, puis `suivi`. Chaque `Link` reçoit `data-rubrique={r.id}` et `title={r.question}`. Conteneur défilant : `[mask-image:linear-gradient(to_right,black_85%,transparent)] md:[mask-image:none]` pour signaler le débordement sur mobile.
- [ ] **Step 4 :** tsc ; commit `feat(fiche): barre de rubriques, priorité au paramètre, focus et défilement`.

### Task 8 : la page, rendu par rubrique

**Files:** Modify `app/actions/[code]/page.tsx`

- [ ] **Step 1 : imports** : retirer `VueEnsemble`, `ProfilSociete` (défaut) et `Eyebrow` s'il n'est plus utilisé ; ajouter `StatsEtCours, AProposBloc`, les exports de `ProfilSociete`, `ActualitesValeur`, `SousSection`, `DonneeAbsente`, `ViewTracker`, `RUBRIQUES`, `fraicheurComptes`.
- [ ] **Step 2 : cartes de L'essentiel** : `'#aujourdhui'` → `hrefRubrique('marche', fromDate, 'seance')` (étiquette « Séance ») ; `'#titre'` → `hrefRubrique('marche', fromDate, 'technique')` (« Signal ») ; `'#entreprise'` → `hrefRubrique('resultats', fromDate)` (« Résultats ») ; `'#liquidite'` → `hrefRubrique('marche', fromDate, 'liquidite')` (« Liquidité »).
- [ ] **Step 3 : en-tête de rubrique**, juste après `<div id="rubrique" …>` :

```tsx
<ViewTracker event="fiche_rubrique_vue" properties={{ code, rubrique }} />
<Chapitre premier id={rubrique} titre={infoRubrique.label} sousTitre={infoRubrique.question} />
```

avec `const infoRubrique = RUBRIQUES.find((r) => r.id === rubrique)!;` déclaré avant le `return`. Les `<Chapitre … numero="0X" />` des anciennes rubriques sont supprimés.
- [ ] **Step 4 : Synthèse**, dans l'ordre :
  1. fraîcheur : `<p className="text-xs text-muted">Cours du <time>{fmtDateCourte(last.date_marche)}</time></p>` suivi, si `fraicheurComptes(exCourant?.year ?? null)` : « Derniers comptes : exercice {n} », ou `<DonneeAbsente etat="ancien" date={`${n}-12-31`} />` si `ancien` ;
  2. `SousSection cours « Le cours »` : `StatsEtCours` (props de l'appel `VueEnsemble` actuel) puis `JaugesPlage` ;
  3. `SousSection lecture « Ce que disent nos indicateurs »` : les deux branches `VerdictBand` actuelles, `NotationBadge`, `CombinedAlphaCarte` (déplacée de L'entreprise, props inchangées) ;
  4. `SousSection essentiel « L’essentiel »` : `Essentiel` ;
  5. `SousSection analyse-ia « Analyse par IA »` : `AnalyseIA` ;
  6. `SousSection plus-loin « Pour aller plus loin »` : deux liens, Société (première phrase de `profil?.presentation`, sinon « Présentation, direction et actionnariat ») et Résultats (phrase `phrasePerformance(...)` actuelle si `gateFonda.allowed`, sinon « Comptes publiés et leur évolution »).
- [ ] **Step 5 : Société** : Présentation, Historique, Métiers, Ce qui fait varier l'activité, Direction (toujours), **Actionnariat (toujours)**, Identité (`ProfilIdentite` + `AProposBloc` avec l'objet `apropos` actuel), pied `NoteSources`. Une sous-section au contenu `null` n'est pas rendue (sauf Direction et Actionnariat).
- [ ] **Step 6 : Résultats** : alerte de perte (inchangée) ; Points clés (`points-cles`) ; Comptes publiés (`fondamentaux`, bloc actuel sans `Eyebrow`, `SectionLock suivi={{ code, rubrique: 'resultats' }}`) ; Comptes IFRS (`ifrs`) ; Construire un graphique (`graphique`, le `details` actuel) ; L'exercice {année} en détail (`exercice`) ; liens Revue de résultats et États financiers complets.
- [ ] **Step 7 : Valorisation et dividendes** : Multiples de valorisation (`multiples` : `ValuationPanel`, `SectionLock suivi`, ou `DonneeAbsente non_collecte` si `!valuation?.metrics.reliable`) ; Dividendes (`dividendes`, colonne Dividendes actuelle) avec base : `divDejaNet ? 'net d’IRVM' : lastDiv?.base_fiscale === 'brut' ? 'brut' : 'tel que publié'` ; sans dividende → `DonneeAbsente non_collecte`.
- [ ] **Step 8 : Cours et liquidité** : avertissement < 20 séances ; Cours et volume (`cours`) ; Liquidité et coût d'exécution (`liquidite`) ; Carnet d'ordres (`carnet`) ; La séance du {date} (`seance`) ; Lecture technique (`technique`, avec la saisonnalité qu'elle porte déjà en dernier) ; dans la branche verrouillée : `SectionLock suivi`, Signal quantitatif, puis Saisonnalité (`saisonnalite`).
- [ ] **Step 9 : Actualités et calendrier** : Calendrier (`calendrier` : détachement / paiement de `divRows` postérieurs à aujourd'hui, sinon « Aucune date annoncée. ») ; Événements récents (`evenements`, colonne Événements actuelle) ; Publications officielles (`actualites-officielles` : `ActualitesValeur groupes={groupesActus} nom={nomSociete}`).
- [ ] **Step 10 : Mon suivi** : Ma thèse (`these`), Mes outils (`outils`), Discussions sur le titre (`discussions`, action « Démarrer une discussion »).
- [ ] **Step 11 :** `grep -n "Eyebrow\|numero=\"0\|href: '#\|#aujourdhui\|#entreprise" "app/actions/[code]/page.tsx"` → aucune ligne. tsc → 0 ; `npx vitest run lib/fiche` → vert. Commit `feat(fiche): rendu en note d'analyse, sept rubriques`.

### Task 9 : menu mobile

**Files:** Modify `components/BottomNav.tsx`

- [ ] **Step 1 :** l'entrée Conseiller devient :

```tsx
{
  href: '/actions',
  label: 'Actions',
  match: (p) => p.startsWith('/actions') || p.startsWith('/societes'),
  icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
},
```

et Marché : `match: (p) => p === '/dashboard' || p.startsWith('/secteurs') || p.startsWith('/heatmap') || p.startsWith('/obligations')`. Conseiller reste dans `lib/nav.ts`.
- [ ] **Step 2 :** tsc ; commit `feat(mobile): onglet Actions à la place de Conseiller`.

### Task 10 : vérification et aperçu

- [ ] **Step 1 :** `npx vitest run` → vert ; `npx tsc --noEmit -p .` → 0.
- [ ] **Step 2 :** `NEXT_DIST_DIR=.next-note npx next build` → vert ; `git checkout -q tsconfig.json`.
- [ ] **Step 3 :** `next start -p 3147` ; sessions QA ; captures des 7 rubriques pour SNTS, SGBC, BBGC et une valeur de classe de liquidité D (dernière séance de `liquidity_daily`) : bureau et mobile en sombre, clair pour SNTS ; « avant » = production.
- [ ] **Step 4 :** anciens liens : `/actions/SNTS#dividendes` → `?rubrique=valorisation#dividendes` ; `?rubrique=entreprise` → Société ; `?rubrique=marche#these` → reste sur Cours et liquidité (paramètre prioritaire).
- [ ] **Step 5 :** accessibilité (script Playwright) : chaque `h3` précédé d'un `h2` ; un seul `aria-current` ; focus visible sur la barre au clavier.
- [ ] **Step 6 :** budget : poids HTML de `/actions/SNTS` avant/après à ±5 %.
- [ ] **Step 7 :** aperçu publié (artifact) ; fusion seulement sur accord ; `node scripts/qa-sessions-locales.mjs --fermer`.
