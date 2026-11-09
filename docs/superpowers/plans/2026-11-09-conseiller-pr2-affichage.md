# Conseiller — PR 2 (affichage) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retirer du site tous les verdicts Acheter/Conserver/Vendre du Conseiller.
À la place, afficher que le Conseiller s'abstient et pourquoi, puis la position de
chaque valeur par famille de facteurs, lue dans `conseiller_facteurs`. Supprimer le
moteur v1, son cron et le code mort.

**Architecture:**
- Un module pur `lib/conseiller/facteurs.ts` regroupe libellés et types.
- Un chargeur serveur `lib/conseiller/lecture.ts` lit la dernière séance et LÈVE
  en cas d'erreur de lecture.
- La page `/conseiller`, la route `/api/advisor/portfolio` et le composant
  `MyPortfolioAdvice` s'appuient tous les trois sur ce chargeur.
- Le frontend ne recalcule JAMAIS un tiers.

Spec : `docs/superpowers/specs/2026-11-09-conseiller-v2-design.md` §12.

**Tech Stack:** Next 14 App Router, TypeScript strict, Tailwind (jetons du design
system), vitest (`frontend/lib/**/*.test.ts`), Supabase (clé publique).

---

## Règles

- Travaille dans le worktree `C:\Users\adego\wt\brvm-conseiller`, branche `design/conseiller-pr2` (déjà créée depuis main). Ne pousse rien.
- Textes en français, sobres et exacts. N'écris aucun chiffre qui ne vienne pas de la base ou de la mesure documentée dans la spec.
- Réutilise l'existant :
  - `components/marche/EnTeteCote.tsx` ;
  - `components/fiche/Chapitre.tsx` ;
  - `components/marche/LigneSource.tsx` ;
  - `EmptyStatePremium` (`@/components/ui/premium`) ;
  - les jetons de style : `text-ivory`, `text-muted`, `text-faint`, `border-border`, `bg-surface`, `rounded-card`, `.tabular`.
- Aucune couleur verte ni rouge pour un tiers : un tiers est une POSITION, pas un verdict.
- Si `frontend/node_modules` manque, crée une jonction vers `C:\Users\adego\OneDrive\Documents\brvm-analyst-pro\frontend\node_modules`.
- Tests : `cd frontend && npx vitest run lib/conseiller`.
- Typecheck : `npx tsc --noEmit -p .`. Prévois un délai long : il dépasse 2 minutes.
- Commits en français, terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Module pur `lib/conseiller/facteurs.ts`

**Files:**
- Create: `frontend/lib/conseiller/facteurs.ts`
- Test: `frontend/lib/conseiller/facteurs.test.ts`

- [ ] **Step 1: Tests**

```ts
import { describe, it, expect } from 'vitest';
import { FAMILLES, libelleTier, ligneValide } from './facteurs';

describe('FAMILLES', () => {
  it('décrit les cinq familles dans l ordre d affichage', () => {
    expect(FAMILLES.map((f) => f.cle)).toEqual(['tendance', 'risque', 'valorisation', 'qualite', 'rendement']);
    for (const f of FAMILLES) expect(f.haut.length).toBeGreaterThan(5);
  });
});

describe('libelleTier', () => {
  it('traduit les tiers sans verdict', () => {
    expect(libelleTier('haut')).toBe('Tiers haut');
    expect(libelleTier('milieu')).toBe('Tiers médian');
    expect(libelleTier('bas')).toBe('Tiers bas');
    expect(libelleTier(null)).toBe('—');
  });
});

describe('ligneValide', () => {
  it('rejette une ligne sans tiers ni code', () => {
    expect(ligneValide({ code: 'SNTS', date_marche: '2026-11-09', tiers: { tendance: 'haut' }, classe_liquidite: 'A' })).toBe(true);
    expect(ligneValide({ code: '', date_marche: '2026-11-09', tiers: {}, classe_liquidite: null })).toBe(false);
    expect(ligneValide({ code: 'SNTS', date_marche: '2026-11-09', tiers: null, classe_liquidite: null })).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer (échec attendu)** : `cd frontend && npx vitest run lib/conseiller` → FAIL.

- [ ] **Step 3: Implémenter**

```ts
/**
 * Positions du Conseiller par famille de facteurs (table conseiller_facteurs,
 * écrite par le scraper). Le Conseiller s'ABSTIENT de tout verdict : un tiers
 * est une position dans la cote du jour, pas un conseil. Le frontend ne
 * recalcule jamais un tiers (spec conseiller v2 §12).
 */
export type Tier = 'haut' | 'milieu' | 'bas';
export type CleFamille = 'tendance' | 'risque' | 'valorisation' | 'qualite' | 'rendement';

export interface Famille {
  cle: CleFamille;
  titre: string;
  /** Ce que veut dire « tiers haut » pour cette famille. */
  haut: string;
}

export const FAMILLES: Famille[] = [
  { cle: 'tendance', titre: 'Tendance', haut: 'parcours le plus fort face au marché sur 60 et 120 séances' },
  { cle: 'risque', titre: 'Risque', haut: 'volatilité et plus forte baisse les plus faibles' },
  { cle: 'valorisation', titre: 'Valorisation', haut: 'PER et cours / fonds propres les plus bas de sa famille comptable' },
  { cle: 'qualite', titre: 'Qualité', haut: 'croissance du résultat et rentabilité des fonds propres les plus élevées' },
  { cle: 'rendement', titre: 'Rendement', haut: 'dividende le plus élevé rapporté au cours' },
];

export interface LigneFacteurs {
  code: string;
  date_marche: string;
  tiers: Partial<Record<CleFamille, Tier | null>>;
  effectifs?: Partial<Record<CleFamille, number>>;
  classe_liquidite: 'A' | 'B' | 'C' | 'D' | null;
}

export function libelleTier(t: Tier | null | undefined): string {
  if (t === 'haut') return 'Tiers haut';
  if (t === 'milieu') return 'Tiers médian';
  if (t === 'bas') return 'Tiers bas';
  return '—';
}

export function ligneValide(l: { code?: unknown; date_marche?: unknown; tiers?: unknown; classe_liquidite?: unknown }): boolean {
  return typeof l.code === 'string' && l.code.length > 0 && typeof l.date_marche === 'string' && l.tiers != null && typeof l.tiers === 'object';
}
```

- [ ] **Step 4: Lancer les tests** : les 3 passent.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/conseiller/facteurs.ts frontend/lib/conseiller/facteurs.test.ts
git commit -m "feat(conseiller): libellés et types des positions par famille (sans verdict)"
```

---

### Task 2: Chargeur serveur `lib/conseiller/lecture.ts`

**Files:**
- Create: `frontend/lib/conseiller/lecture.ts`

- [ ] **Step 1: Implémenter**

```ts
import { createPublicClient } from '@/lib/supabase/public';
import { ligneValide, type LigneFacteurs } from './facteurs';

/**
 * Dernière séance de conseiller_facteurs. LÈVE si la lecture échoue : une
 * panne n'est pas une table vide, et la page doit dire laquelle des deux.
 * Renvoie `null` si la table est vide.
 */
export async function lirePositions(): Promise<{ date: string; lignes: LigneFacteurs[] } | null> {
  const sb = createPublicClient();
  const { data: der, error: e1 } = await sb
    .from('conseiller_facteurs')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);
  if (e1) throw new Error(`conseiller_facteurs illisible : ${e1.message}`);
  const date = der?.[0]?.date_marche as string | undefined;
  if (!date) return null;
  const { data, error } = await sb
    .from('conseiller_facteurs')
    .select('code, date_marche, tiers, effectifs, classe_liquidite')
    .eq('date_marche', date)
    .order('code');
  if (error) throw new Error(`conseiller_facteurs illisible : ${error.message}`);
  const lignes = ((data ?? []) as LigneFacteurs[]).filter(ligneValide);
  return { date, lignes };
}
```

- [ ] **Step 2: Typecheck, puis commit**

```bash
git add frontend/lib/conseiller/lecture.ts
git commit -m "feat(conseiller): lecture serveur des positions de la dernière séance"
```

---

### Task 3: Page `/conseiller`

**Files:**
- Modify (réécriture complète) : `frontend/app/conseiller/page.tsx`
- Create : `frontend/components/conseiller/TableauPositions.tsx`

Garde le contrôle d'accès existant : `canAccess('conseiller')`, puis `AccessGate`. Remplace seulement son `hint` par : « Positions de chaque valeur par famille de facteurs. »

- [ ] **Step 1: `TableauPositions.tsx`** (composant serveur)

Il reçoit `lignes: LigneFacteurs[]` et rend un tableau.

- **Conteneur.** Enveloppe le tableau dans un bloc `overflow-x-auto` avec `tabIndex={0}`, `role="region"` et `aria-label="Positions par famille, défilement horizontal"`.
- **Colonnes, dans l'ordre :**
  - « Valeur » : un lien vers `/actions/<code>`, en `font-medium text-ivory` ;
  - « Liquidité » : la classe, ou `—` ;
  - une colonne par famille, dans l'ordre de `FAMILLES`.
- **Cellules de famille.** Elles affichent `libelleTier(...)` en `text-xs`, avec `text-ivory` pour un tiers et `text-faint` pour `—`. Jamais de verdict, jamais de couleur sémantique.
- **Lecture.** Un `<caption className="sr-only">` explique comment lire le tableau.
- **Tri.** Par code.

- [ ] **Step 2: Réécrire `app/conseiller/page.tsx`**

Structure, dans cet ordre :

1. **En-tête.** `EnTeteCote` avec :
   - `titre="Conseiller"` ;
   - `description="Où se situe chaque valeur de la cote, famille par famille, sans recommandation d'achat ni de vente."` ;
   - `seance` = date des positions ;
   - `compte={{ n: lignes.length, libelle: 'valeurs' }}` ;
   - `source="Calcul WESTBOURSE sur les cours et comptes publiés"`.
2. **Bandeau d'abstention.** Un `<section aria-labelledby="t-abstention" className="mt-8 rounded-card border border-border bg-surface p-5">` qui contient :
   - un `h2` `id="t-abstention"` : « Le Conseiller s'abstient de recommander d'acheter ou de vendre » ;
   - un paragraphe, texte EXACT : « Nous avons testé, sur l'historique de la BRVM depuis 2007, si une règle combinant tendance, risque et valorisation battait le marché. Le marché est trop étroit pour le prouver : environ 46 périodes indépendantes seulement, et il faudrait un écart de près de 27 % par an pour que le test le confirme. Plutôt que d'afficher un conseil que nous ne pouvons pas justifier, nous montrons où se situe chaque valeur, et vous décidez. » ;
   - un lien vers `/conseiller/track-record` : « Comment nous l'avons mesuré ».
3. **Chapitre 01.** `Chapitre id="mes-positions" numero="01" titre="Mes positions" sousTitre="Vos lignes, avec leur position par famille."`, puis `<MyPortfolioAdvice />` (réécrit à la tâche 4).
4. **Chapitre 02.** `Chapitre id="cote" numero="02" titre="Toute la cote" sousTitre="Tiers haut = tiers le plus favorable de la famille dans la cote du jour."`, puis `<TableauPositions lignes={...} />`.
5. **Définitions.** Un `<dl>` qui reprend `FAMILLES` : le titre de chaque famille, puis « Tiers haut : » suivi de `f.haut`.
6. **Source.** `LigneSource` : « Positions calculées par WESTBOURSE pour la séance du {date} à partir des cours, des comptes et des dividendes publiés. Valeurs de liquidité C ou D : cours peu échangés, positions à lire avec prudence. Ce n'est pas un conseil en investissement. »

**États d'erreur et vide :**
- si `lirePositions()` LÈVE : `EmptyStatePremium title="Positions momentanément illisibles" hint="Réessayez dans un instant."` ;
- si elle renvoie `null` : `EmptyStatePremium title="Positions pas encore calculées" hint="Elles sont mises à jour chaque soir de séance."`.

**À supprimer** de l'ancienne page : les compteurs Acheter/Conserver/Vendre, « Changements de recommandation », `AdvisorCard` et `getLiquidityMap`.

- [ ] **Step 3: Typecheck, puis commit**

```bash
git add frontend/app/conseiller/page.tsx frontend/components/conseiller/TableauPositions.tsx
git commit -m "feat(conseiller): page en abstention, positions par famille sans verdict"
```

---

### Task 4: `/api/advisor/portfolio` et `MyPortfolioAdvice`

**Files:**
- Modify: `frontend/app/api/advisor/portfolio/route.ts`
- Modify: `frontend/components/advisor/MyPortfolioAdvice.tsx`

- [ ] **Step 1: Route**
  - Garde l'authentification et la lecture des positions de l'utilisateur.
  - Remplace `getAdvisorRecommendations()` par `lirePositions()`, qui fournit les tiers.
  - Lis aussi le dernier cours de chaque code détenu : `brvm_actions_daily`, dernière `date_marche`, champ `cours_jour`.
  - Chaque position renvoie `{ code, quantite, pru, cours, valeur, pnl, pnlPct, tiers, classe_liquidite }`.
  - Supprime `action`, `conviction` et `reasons`.
  - Si une lecture échoue, renvoie `{ logged: true, erreur: true, positions: [] }`.
- [ ] **Step 2: Composant**
  - Remplace la colonne « Conseil » par cinq colonnes courtes, une par famille de `FAMILLES`. Chaque cellule affiche `libelleTier(...)` en `text-xs`, en `text-ivory`, ou en `text-faint` pour `—`.
  - Ajoute une colonne « Liquidité ».
  - Titre : « Mes positions ».
  - Note de bas : « Positions par famille, sans recommandation : à vous de décider. Exécution via votre SGI. »
  - Si `erreur` vaut true, affiche : « Positions momentanément illisibles. »
  - Supprime `VERB`, `BADGE` et le type `Act`.
- [ ] **Step 3: Typecheck, puis commit**

```bash
git add frontend/app/api/advisor/portfolio/route.ts frontend/components/advisor/MyPortfolioAdvice.tsx
git commit -m "feat(conseiller): portefeuille avec positions par famille, sans renforcer/alléger"
```

---

### Task 5: Track record réécrit

**Files:**
- Modify (réécriture complète) : `frontend/app/conseiller/track-record/page.tsx`

- [ ] **Step 1: Réécrire la page**

La page est statique : `export const revalidate = 86400`.

- `metadata.title` : « Comment nous avons mesuré le Conseiller ».
- `metadata.description` : « Pourquoi le Conseiller WESTBOURSE ne recommande plus d'acheter ni de vendre : la mesure, ses limites et ce que nous montrons à la place. »
- En-tête : `EnTeteCote titre="Comment nous avons mesuré le Conseiller"`, sans séance, avec `source={null}`.

Le contenu tient en trois chapitres (`Chapitre`). Recopie les chiffres EXACTEMENT : ils viennent des §1 et §12 de la spec.

1. **« L'ancien moteur, du 19 juin au 6 novembre 2026 »**
   - Premier paragraphe : « Il combinait un signal quantitatif, une valorisation par flux actualisés, le RSI et le dividende. Sur 93 séances et 49 valeurs, le marché a progressé de 17,6 %. Vingt séances après chaque recommandation : »
   - Tableau, colonnes Recommandation | Cas | Cours dans le bon sens | Écart moyen au marché :
     - Acheter | 363 | 50 % | −1,1 pt
     - Vendre | 2 093 | 50 % | −2,1 pt
     - Conserver | 985 | — | −5,0 pt
   - Second paragraphe : « Acheter et Vendre ne se distinguaient presque pas. 61 % des recommandations étaient « Vendre » en plein marché haussier : la valorisation par flux actualisés, calculée à un taux d'environ 18 % et appliquée aussi aux banques, jugeait presque tout trop cher. Ces chiffres portent sur quatre périodes indépendantes seulement : ils décrivent, ils ne prouvent pas. »
2. **« Le test du nouveau moteur »** : « Avant toute mesure, nous avons écrit la règle et le critère de réussite : les valeurs à « Acheter » devaient battre le marché sur 20 séances, frais de 1,5 % déduits, sur l'historique depuis 2007. Nous avons d'abord vérifié si le test pouvait réussir. Il fallait un écart d'au moins 26,9 % par an pour que la mesure le confirme, avec environ 46 périodes indépendantes. Aucune règle honnête n'atteint ce niveau : le test ne pouvait rien prouver, nous l'avons arrêté avant d'en lire le résultat. »
3. **« Ce que nous montrons à la place »** : « Pour chaque valeur, sa position dans la cote du jour sur cinq familles : tendance, risque, valorisation, qualité, rendement. Ce sont des faits mesurés, pas des conseils. Nous referons le test chaque année : le jour où il pourra prouver quelque chose, nous publierons le résultat, quel qu'il soit. » Puis un lien vers `/conseiller` : « Voir les positions du jour ».

`LigneSource` : « Mesures du 9 novembre 2026. Ce n'est pas un conseil en investissement. »

Supprime l'import de `lib/advisor/trackRecord` et toute lecture de `advisor_history`.

- [ ] **Step 2: Typecheck, puis commit**

```bash
git add frontend/app/conseiller/track-record/page.tsx
git commit -m "feat(conseiller): page de mesure honnête à la place du track record"
```

---

### Task 6: Suppressions (moteur v1, cron, code mort) et textes

**Files:**
- Delete :
  - `frontend/app/api/cron/advisor-snapshot/route.ts`
  - `frontend/lib/advisor/recommend.ts` et `recommend.test.ts`
  - `frontend/lib/advisor/server.ts`, `changes.ts`, `notify.ts`, `notify.test.ts`
  - `frontend/lib/advisor/trackRecord.ts` et `trackRecord.test.ts`
  - `frontend/components/advisor/AdvisorCard.tsx`
  - `frontend/components/advisor/PatternEnrichmentBadge.tsx`
  - `frontend/components/dashboard/ConseillierWidget.tsx`
  - `frontend/lib/conseiller.ts`
- Modify : `vercel.json` ET `frontend/vercel.json`, pour retirer l'entrée `/api/cron/advisor-snapshot`.
- Modify, textes de la landing :
  - `frontend/components/landing/ToolsGrid.tsx:131` → `desc: 'Position de chaque valeur par famille, sans verdict'`
  - `frontend/components/landing/PlatformUniverses.tsx:46` → `desc: 'Tendance, risque, valorisation : la position de chaque valeur'`
  - `frontend/components/landing/AppPreview.tsx`, autour de la ligne 121 : lis le bloc et remplace tout texte qui promet des recommandations par une description des positions par famille, sans verdict.

- [ ] **Step 1: Vérifier les importeurs avant de supprimer**

Lance :

```bash
git grep -n "lib/advisor\|lib/conseiller'\|lib/conseiller\"\|AdvisorCard\|PatternEnrichmentBadge\|ConseillierWidget\|patterns/advisor\|advisor-snapshot" -- frontend vercel.json
```

- Chaque importeur restant doit figurer dans la liste ci-dessus, ou avoir été réécrit aux tâches 3 à 5.
- Si `lib/patterns/advisor.ts` n'est plus importé que par `lib/conseiller.ts`, supprime-le aussi, avec son test.
- Si un autre fichier importe encore l'un d'eux, ARRÊTE-TOI et signale-le.

- [ ] **Step 2: Supprimer et modifier**

Supprime les fichiers, modifie les deux `vercel.json` et les trois textes de la landing.

- [ ] **Step 3: Chercher les verdicts restants**

Lance :

```bash
git grep -n -i "conseiller" -- frontend/lib/agent frontend/lib/dossier frontend/app | grep -v "app/conseiller"
```

Rapporte toute occurrence qui présenterait un verdict du Conseiller (Acheter, Vendre, Renforcer, Alléger). Ne touche pas aux « signaux » du scoring §9 : c'est une autre fonction.

- [ ] **Step 4: Vérifier, puis commit**

Lance `npx tsc --noEmit -p .`, `npx vitest run lib`, puis `npm run build`. Le build doit passer ; prévois un délai long.

```bash
git add -A frontend/lib/advisor frontend/components/advisor frontend/components/dashboard/ConseillierWidget.tsx frontend/lib/conseiller.ts frontend/app/api/cron/advisor-snapshot vercel.json frontend/vercel.json frontend/components/landing
git commit -m "refactor(conseiller): retrait du moteur v1, de son cron et du code mort"
```
