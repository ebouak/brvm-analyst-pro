# Agrégats bancaires — 2. Affichage (Revue, fiche, dossier, articles) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher une banque avec son vocabulaire et ses agrégats (PNB, charges, coût du risque, encours, solvabilité, ratios calculés une seule fois) sur les quatre surfaces — Revue de résultats, fiche société, Dossier valeur, articles de résultats — avec le même chiffre partout et chaque valeur reliée à sa source.

**Architecture:** Un module PUR unique `frontend/lib/bank/lecture.ts` transforme les lignes de comptes (valeurs retenues de `lignes_specifiques` + leurs sources `sources_specifiques`, écrites par le plan 1) en une `LectureBancaire` : agrégats publiés, comparaisons, ratios, agrégats non publiés, constat de titre. Les surfaces frontend l'appellent ; le scraper (articles) en porte une COPIE OCTET POUR OCTET (`scraper/src/bank/pure/lecture.ts`), vérifiée par test, et écrit chaque chiffre par `Plume`. Une période sans agrégat sourcé garde l'ancien affichage, avec le libellé « produit net bancaire ».

**Tech Stack:** Next.js 15 (App Router, rendu serveur), React 19, TypeScript, vitest ; scraper Node 22 ESM ; Supabase (lecture des tables `income_statements` / `balance_sheets`, publiques).

Spécification : `docs/superpowers/specs/2026-11-15-agregats-bancaires-design.md` §3 (calculés), §5, §6. Prérequis : plan 1 fusionné (colonne `sources_specifiques`, migration 0245). Sans reprise réelle (PR 3), aucune période n'est « extraite » : toutes les banques gardent l'ancien affichage relabellisé — c'est le comportement attendu et il est testé.

---

## Report des décisions du 2026-11-15 (plan 1, avenant)

- **USD** : `sources_specifiques[clé].unite` vaut `fcfa`, `usd` ou `pct`. ETIT
  publie en USD : ses agrégats s'affichent EN USD (unité écrite), sans
  conversion ; ses ratios se calculent sans conversion. `LigneAgregat.unite`
  doit donc accepter `usd`, et les formateurs écrire « USD » au lieu de « FCFA ».
- **Coefficient d'exploitation** : la valeur stockée
  `lignes_specifiques.coefficient_exploitation` n'est PLUS affichée ; seul le
  coefficient recalculé (charges d'exploitation ÷ PNB) l'est. La valeur stockée
  sert de recoupement à l'extraction (plan 1, contrôle D3).

## Avenant de l'exploitant pour la PR 2 (2026-11-15) — PRIME sur la suite du plan

1. **ETIT en USD, tel que publié.** L'unité vient de
   `sources_specifiques[clé].unite` (`fcfa` | `usd` | `pct`). Concrètement :
   - `Valeur` porte `unite` ; une valeur de la base sans source (résultat net,
     capitaux propres) est en `fcfa` ;
   - `compatibles()` exige le même périmètre (règle inchangée) ET la même
     unité : aucun ratio, aucune comparaison, aucune marche de cascade entre
     USD et FCFA (jamais de conversion) ; les ratios USD ÷ USD se calculent ;
   - `LigneAgregat.unite` vaut `fcfa` | `usd` | `pct` ; `lecture.ts` exporte
     `deviseDe(unite)` et `montantCourt(v, unite)`, et TOUTES les surfaces
     (Revue, fiche, carte bancaire, dossier, article) écrivent l'unité de la
     ligne, jamais « FCFA » en dur à côté d'un agrégat ; le titre de la Revue et
     l'en-tête « Compte de résultat » suivent l'unité ;
   - la trajectoire du dossier (graphique en FCFA) ne reprend un PNB sourcé
     que s'il est en FCFA ;
   - lecteurs historiques de `lignes_specifiques` (tableau des comptes, carte
     bancaire `computeBankKpis`, diagnostic, impression, comparateur) : tous
     passent par `loadCompanyFinancials`, qui retire désormais les clés dont la
     source est en USD (`lib/bank/unites.ts`, pur, testé) — un montant USD ne
     se glisse jamais dans un tableau en FCFA ;
   - un test de rendu (`lib/bank/usd.test.ts`) échoue si une surface affiche
     un montant USD suivi de « FCFA » ;
   - DERNIÈRE tâche seulement (Task 10), une fois toutes les surfaces
     branchées : `ECRITURE_USD_AUTORISEE = true` dans
     `scraper/src/agregats/ecritures.ts`, copie frontend régénérée
     (`node scripts/copier-agregats-purs.mjs`), tests du verrou mis à jour
     (copie.test.ts vert).
2. **Coefficient d'exploitation stocké : plus affiché nulle part.** Seul le
   coefficient de `lecture.ts` (charges d'exploitation ÷ PNB) s'affiche :
   `loadCompanyFinancials` retire `coefficient_exploitation` des lignes lues
   (la ligne disparaît du tableau des comptes et du diagnostic) ;
   `appliquerLecture` met `costIncome` à la valeur de la lecture ou à `null`
   (le « frais généraux ÷ PNB » de `computeBankKpis` n'est plus affiché : une
   autre définition donnerait un autre chiffre). La valeur stockée reste lue
   par le scraper (contrôle D3 de l'extraction).
3. **Cascade du dossier (et de la Revue) : gabarit `cascade` de l'Academy.**
   On construit une `Illustration` (`gabarit: 'cascade'`, `reel: true`,
   source datée) validée par `illustrationSchema`, rendue par
   `components/academy/lecon/Illustration.tsx` — pas de second composant. Le
   gabarit n'a pas de sous-total intermédiaire : la cascade est PNB → charges
   d'exploitation → coût du risque → autres éléments et impôt → résultat net
   (le RBE reste dans le tableau). Si le schéma refuse les données (perte qui
   fait passer le cumul sous zéro, marche nulle, unités mêlées), on affiche la
   grille de mesures à la place. Animation coupée à l'impression.
4. Exécution tâche par tâche, test d'abord, un commit par tâche.

## Conventions

- Tests frontend : `cd C:\tmp\wt-banques\frontend; npx vitest run <fichier>` ; scraper : `cd C:\tmp\wt-banques\scraper; npx vitest run <fichier>`. Toujours depuis un chemin `C:` en majuscule.
- `lib/bank/lecture.ts` n'a AUCUN import (il est copié tel quel dans le scraper). Il formate lui-même ses nombres en `fr-FR`.
- Phrases descriptives, jamais un verdict (« les charges représentent 45 % du PNB », jamais « bonne maîtrise des coûts »).
- Une feuille du dossier a une hauteur fixe ; toute liste variable passe par `borner` (`lib/dossier/bornes.ts`).
- Deux périmètres ne se comparent pas : `individuel` et `consolide` ne se rapprochent jamais ; `non_precise` (périmètre non écrit dans le document, ou valeur de base sans source) se rapproche des deux. C'est la seule souplesse admise.

## Carte des fichiers

| Fichier | Rôle |
|---|---|
| `frontend/lib/bank/lecture.ts` (+ `lecture.test.ts`) | module pur unique : périodes, agrégats, comparaisons, ratios, constat |
| `scraper/src/bank/pure/lecture.ts` | copie octet pour octet |
| `frontend/lib/bank/chargerLecture.ts` | chargement serveur des lignes d'une banque |
| `scraper/src/bank/chargerPeriodes.ts` | même chargement côté scraper |
| `frontend/lib/bank/lectureKpis.ts` (+ test) | aligne `BankKpis` sur la lecture (même coefficient, même transformation) |
| `frontend/lib/revue/periode.ts`, `frontend/lib/document/constats.ts` (modif.) | vocabulaire paramétrable (`produit net bancaire`) |
| `frontend/components/bank/LectureRevue.tsx` | tableaux bancaires de la Revue |
| `frontend/components/bank/TableauLecture.tsx` | bloc bancaire de la fiche et de la page financials |
| `frontend/app/actions/[code]/revue/page.tsx` (modif.) | Revue bancaire |
| `frontend/app/societes/[code]/page.tsx`, `frontend/app/actions/[code]/financials/page.tsx`, `frontend/components/financials/BankScorecard.tsx` (modif.) | fiche |
| `frontend/lib/bank/dossierBancaire.ts` (+ test) | trajectoire, cascade, encours bornés (purs) |
| `frontend/lib/dossier/build.ts`, `frontend/lib/dossier/bornes.ts`, `frontend/components/dossier/Graphiques.tsx`, `frontend/app/rapports/dossier/[code]/page.tsx` (modif.) | dossier |
| `scraper/src/articles/redaction.ts`, `types.ts`, `runArticles.ts` (modif.), `scraper/src/articles/resultatsBanque.ts` (nouveau) | article de résultats bancaires |
| `frontend/lib/bank/coherence.test.ts`, `scraper/tests/resultatsBanque.test.ts` | cohérence entre surfaces |

---

### Task 1: Module pur `lib/bank/lecture.ts`

**Files:**
- Create: `frontend/lib/bank/lecture.ts`
- Test: `frontend/lib/bank/lecture.test.ts`

- [ ] **Step 1: Écrire le test**

```ts
import { describe, expect, it } from 'vitest';
import { periodesDepuisLignes, lireBanque, lirePeriode, dernierExercice, type LigneComptesBancaire } from './lecture';

const sp = (s: string) => s.replace(/[  ]/g, ' ');
const src = (perimetre: 'individuel' | 'consolide' | 'non_precise' = 'individuel', doc = 'https://x/s1.pdf') =>
  ({ document_url: doc, document_libelle: 'Rapport S1', page: 3, perimetre });

/** Construit une ligne dont chaque clé est sourcée. */
const ligne = (periode: string, valeurs: Record<string, number>, extra: Partial<LigneComptesBancaire> = {}, perimetre: 'individuel' | 'consolide' = 'individuel'): LigneComptesBancaire => ({
  periode,
  lignes_specifiques: valeurs,
  sources_specifiques: Object.fromEntries(Object.keys(valeurs).map((k) => [k, src(perimetre)])),
  ...extra,
});

const income = [
  ligne('2026-S1', { pnb: 160e9, charges_exploitation: 72e9, cout_du_risque: 8e9 }, { resultat_net: 50e9 }),
  ligne('2025-S1', { pnb: 145e9, charges_exploitation: 70e9, cout_du_risque: 10e9 }, { resultat_net: 45e9 }),
  ligne('2025', {}, { resultat_net: 95e9 }),
];
const balance = [
  ligne('2026-S1', { credits_clientele: 3000e9, depots_clientele: 3800e9, fonds_propres: 600e9 }),
  ligne('2025-S1', { credits_clientele: 2800e9, depots_clientele: 3500e9 }),
  ligne('2025', { credits_clientele: 2900e9 }),
];
const periodes = periodesDepuisLignes(income, balance);
const s1 = lireBanque(periodes, { annee: 2026, code: 'S1' })!;

describe('lirePeriode', () => {
  it('formats de période en base', () => {
    expect(lirePeriode('2026-S1')).toEqual({ annee: 2026, code: 'S1' });
    expect(lirePeriode('2025')).toEqual({ annee: 2025, code: 'exercice' });
    expect(lirePeriode('2025-12-31')).toEqual({ annee: 2025, code: 'exercice' });
    expect(lirePeriode('2026-S2')).toBeNull();
  });
});

describe('periodesDepuisLignes', () => {
  it('ne retient qu’une valeur sourcée ; le résultat net vient de la base, sans source', () => {
    const p = periodesDepuisLignes([{ periode: '2026-S1', lignes_specifiques: { pnb: 1e9 }, sources_specifiques: null, resultat_net: 2e8 }], []);
    expect(p[0]!.valeurs.pnb).toBeUndefined();
    expect(p[0]!.valeurs.resultat_net).toEqual({ valeur: 2e8, perimetre: 'non_precise', source: null });
  });
  it('fonds propres de base seulement à défaut d’un agrégat sourcé', () => {
    const p = periodesDepuisLignes([], [{ periode: '2025', lignes_specifiques: null, sources_specifiques: null, total_capitaux_propres: 5e11 }]);
    expect(p[0]!.valeurs.fonds_propres).toEqual({ valeur: 5e11, perimetre: 'non_precise', source: null });
  });
  it('trie du plus récent au plus ancien, intermédiaires compris', () => {
    expect(periodes.map((p) => `${p.annee}-${p.code}`)).toEqual(['2026-S1', '2025-exercice', '2025-S1']);
  });
});

describe('lireBanque — 1er semestre 2026', () => {
  it('période et vocabulaire', () => {
    expect(s1).toMatchObject({ annee: 2026, code: 'S1', libelle: '1er semestre 2026', libellePrecedent: '1er semestre 2025', extrait: true });
  });

  it('compte de résultat dans l’ordre PNB → résultat net, comparé au même semestre N−1', () => {
    expect(s1.compteResultat.map((l) => l.cle)).toEqual(['pnb', 'charges_exploitation', 'cout_du_risque', 'resultat_net']);
    const pnb = s1.compteResultat[0]!;
    expect(pnb.precedent).toMatchObject({ valeur: 145e9, libelle: '1er semestre 2025', uniteVariation: '%' });
    expect(pnb.precedent!.variation).toBeCloseTo(10.345, 2);
    expect(pnb.valeur.source).toEqual({ document_url: 'https://x/s1.pdf', document_libelle: 'Rapport S1', page: 3 });
  });

  it('encours comparés à la même date N−1, puis à la dernière clôture annuelle', () => {
    const credits = s1.encours.find((l) => l.cle === 'credits_clientele')!;
    expect(credits.precedent).toMatchObject({ valeur: 2800e9, libelle: '1er semestre 2025' });
    expect(credits.cloture).toMatchObject({ valeur: 2900e9, libelle: 'exercice 2025' });
  });

  it('ratios calculés une seule fois, avec phrase descriptive', () => {
    const r = Object.fromEntries(s1.ratios.map((x) => [x.cle, x]));
    expect(r.coefficient_exploitation!.valeur).toBeCloseTo(0.45, 6);
    expect(r.coefficient_exploitation!.precedent).toBeCloseTo(70 / 145, 6);
    expect(sp(r.coefficient_exploitation!.phrase)).toBe('Les charges d’exploitation représentent 45,0 % du PNB.');
    expect(r.cout_du_risque_relatif!.valeur).toBeCloseTo((8 / 3000) * 2, 8);
    expect(r.cout_du_risque_relatif!.mention).toBe('semestre annualisé (×2)');
    expect(r.credits_sur_depots!.valeur).toBeCloseTo(3000 / 3800, 6);
    expect(r.roe!.valeur).toBeCloseTo(100 / 600, 6);
    expect(r.roe!.mention).toBe('douze mois glissants : exercice 2025 + 1er semestre 2026 − 1er semestre 2025');
  });

  it('agrégats non publiés : nommés, jamais à zéro', () => {
    expect(s1.nonPublies).toEqual(['Marge d’intérêts', 'Commissions nettes', 'Créances en souffrance brutes', 'Solvabilité totale']);
    expect(s1.mentionNonPublies).toBe('Autres agrégats non publiés pour ce semestre : marge d’intérêts, commissions nettes, créances en souffrance brutes, solvabilité totale.');
  });

  it('constat de titre : PNB, puis le constat le plus marquant (règle déterministe)', () => {
    expect(sp(s1.titre)).toBe('PNB en hausse de 10,3 % sur le 1er semestre 2026, coefficient d’exploitation en baisse de 3,3 points, à 45,0 %');
    expect(s1.constat.second?.cle).toBe('coefficient_exploitation');
  });

  it('sources uniques', () => {
    expect(s1.sources).toEqual([{ document_url: 'https://x/s1.pdf', document_libelle: 'Rapport S1', page: 3 }]);
  });
});

describe('règles de prudence', () => {
  it('ROE non affiché sans les trois termes du glissement (pas d’annualisation naïve)', () => {
    const p = periodesDepuisLignes(income.filter((l) => l.periode !== '2025'), balance);
    expect(lireBanque(p, { annee: 2026, code: 'S1' })!.ratios.find((r) => r.cle === 'roe')).toBeUndefined();
  });

  it('périmètres différents : aucun ratio ni comparaison', () => {
    const p = periodesDepuisLignes(
      [ligne('2026-S1', { pnb: 160e9 }), ligne('2026-S1', { charges_exploitation: 72e9 }, {}, 'consolide'), ligne('2025-S1', { pnb: 145e9 }, {}, 'consolide')],
      [],
    );
    const l = lireBanque(p, { annee: 2026, code: 'S1' })!;
    expect(l.ratios.find((r) => r.cle === 'coefficient_exploitation')).toBeUndefined();
    expect(l.compteResultat.find((x) => x.cle === 'pnb')!.precedent).toBeNull();
  });

  it('aucune valeur sourcée → extrait = false (ancien affichage)', () => {
    const p = periodesDepuisLignes([{ periode: '2026-S1', lignes_specifiques: { pnb: 1e9 }, sources_specifiques: null, resultat_net: 1e8 }], []);
    expect(lireBanque(p, { annee: 2026, code: 'S1' })!.extrait).toBe(false);
  });

  it('exercice : ROE sur l’exercice, aucun coût du risque annualisé, mention « pour cet exercice »', () => {
    const p = periodesDepuisLignes(
      [ligne('2025', { pnb: 300e9, cout_du_risque: 20e9 }, { resultat_net: 95e9 })],
      [ligne('2025', { credits_clientele: 2900e9, fonds_propres: 600e9 })],
    );
    const l = lireBanque(p, { annee: 2025, code: 'exercice' })!;
    const r = Object.fromEntries(l.ratios.map((x) => [x.cle, x]));
    expect(r.roe!.valeur).toBeCloseTo(95 / 600, 6);
    expect(r.roe!.mention).toBeNull();
    expect(r.cout_du_risque_relatif!.mention).toBeNull();
    expect(l.mentionNonPublies).toMatch(/^Autres agrégats non publiés pour cet exercice/);
  });

  it('sans PNB ni comparaison : titre neutre', () => {
    const p = periodesDepuisLignes([], [ligne('2026-S1', { credits_clientele: 3000e9 })]);
    expect(lireBanque(p, { annee: 2026, code: 'S1' })!.titre).toBe('Comptes du 1er semestre 2026');
  });

  it('période absente → null', () => {
    expect(lireBanque(periodes, { annee: 2024, code: 'S1' })).toBeNull();
  });

  it('dernierExercice : le plus récent qui porte une valeur sourcée', () => {
    expect(dernierExercice(periodes)).toEqual({ annee: 2025, code: 'exercice' });
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `cd C:\tmp\wt-banques\frontend; npx vitest run lib/bank/lecture.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Écrire le module**

```ts
/**
 * Lecture bancaire — module PUR et UNIQUE (spec 2026-11-15 §3 et §5).
 *
 * Entrée : les lignes income_statements / balance_sheets d'une banque. Seules
 * comptent les valeurs RETENUES par la sélection du scraper, c'est-à-dire
 * celles qui portent une source dans `sources_specifiques` ; s'y ajoutent le
 * résultat net de la base (recoupé à l'extraction) et, à défaut d'agrégat
 * sourcé, les capitaux propres de la base. Sortie : agrégats publiés,
 * comparaisons, ratios CALCULÉS (une seule définition), agrégats non publiés,
 * constat de titre. Revue, fiche, dossier et articles l'appellent ; aucune
 * surface ne recalcule.
 *
 * ⚠️ COPIE OCTET POUR OCTET : scraper/src/bank/pure/lecture.ts (deux paquets
 * TS distincts). frontend/lib/bank/coherence.test.ts échoue si les deux
 * fichiers divergent : toute correction se fait ici, puis se recopie.
 * Pour rester copiable, ce fichier n'importe RIEN.
 */

export type Perimetre = 'individuel' | 'consolide' | 'non_precise';
export type CodePeriode = 'exercice' | 'S1' | 'T1' | 'T3';
export type Agregat =
  | 'pnb' | 'marge_interets' | 'produits_interets' | 'charges_interets' | 'commissions_nettes'
  | 'charges_exploitation' | 'resultat_brut_exploitation' | 'cout_du_risque' | 'resultat_net'
  | 'credits_clientele' | 'depots_clientele' | 'creances_souffrance_brutes' | 'taux_creances_souffrance'
  | 'couverture_creances_souffrance' | 'fonds_propres' | 'total_bilan' | 'solvabilite_total' | 'ratio_cet1' | 'ratio_tier1';

export interface SourceValeur {
  document_url: string;
  document_libelle: string | null;
  page: number | null;
}

export interface Valeur {
  valeur: number;
  perimetre: Perimetre;
  /** null = valeur de la base (résultat net, capitaux propres), sans document rattaché. */
  source: SourceValeur | null;
}

export interface PeriodeBancaire {
  annee: number;
  code: CodePeriode;
  valeurs: Partial<Record<Agregat, Valeur>>;
}

export interface LigneComptesBancaire {
  periode: string;
  lignes_specifiques: Record<string, unknown> | null;
  sources_specifiques: Record<string, { document_url: string; document_libelle: string | null; page: number | null; perimetre: Perimetre }> | null;
  resultat_net?: number | null;
  total_capitaux_propres?: number | null;
}

export interface Comparaison {
  valeur: number;
  libelle: string;
  /** Variation en % (montants, base strictement positive) ou en points (ratios publiés). */
  variation: number | null;
  uniteVariation: '%' | 'pts';
}

export interface LigneAgregat {
  cle: Agregat;
  libelle: string;
  unite: 'fcfa' | 'pct';
  valeur: Valeur;
  precedent: Comparaison | null;
  cloture: Comparaison | null;
}

export type CleRatio = 'coefficient_exploitation' | 'cout_du_risque_relatif' | 'credits_sur_depots' | 'roe';

export interface LigneRatio {
  cle: CleRatio;
  libelle: string;
  /** Fraction (0,45 = 45 %). */
  valeur: number;
  precedent: number | null;
  phrase: string;
  mention: string | null;
}

export interface Constat {
  pnb: { valeur: number; variation: number | null } | null;
  second: { cle: 'coefficient_exploitation' | 'cout_du_risque' | 'resultat_net'; variation: number; valeur: number } | null;
}

export interface LectureBancaire {
  annee: number;
  code: CodePeriode;
  libelle: string;
  libellePrecedent: string;
  /** Au moins une valeur sourcée : sinon la surface garde l'ancien affichage. */
  extrait: boolean;
  compteResultat: LigneAgregat[];
  encours: LigneAgregat[];
  ratios: LigneRatio[];
  nonPublies: string[];
  mentionNonPublies: string | null;
  constat: Constat;
  titre: string;
  sources: SourceValeur[];
}

const LIBELLES: Record<Agregat, string> = {
  pnb: 'Produit net bancaire',
  marge_interets: 'Marge d’intérêts',
  produits_interets: 'Intérêts et produits assimilés',
  charges_interets: 'Intérêts et charges assimilées',
  commissions_nettes: 'Commissions nettes',
  charges_exploitation: 'Charges d’exploitation',
  resultat_brut_exploitation: 'Résultat brut d’exploitation',
  cout_du_risque: 'Coût du risque',
  resultat_net: 'Résultat net',
  credits_clientele: 'Crédits à la clientèle',
  depots_clientele: 'Dépôts de la clientèle',
  creances_souffrance_brutes: 'Créances en souffrance brutes',
  taux_creances_souffrance: 'Taux de créances en souffrance',
  couverture_creances_souffrance: 'Couverture des créances en souffrance',
  fonds_propres: 'Fonds propres',
  total_bilan: 'Total du bilan',
  solvabilite_total: 'Solvabilité totale',
  ratio_cet1: 'Ratio CET1',
  ratio_tier1: 'Ratio Tier 1',
};

const EN_POURCENT = new Set<Agregat>(['taux_creances_souffrance', 'couverture_creances_souffrance', 'solvabilite_total', 'ratio_cet1', 'ratio_tier1']);

const ORDRE_CR: Agregat[] = ['pnb', 'marge_interets', 'produits_interets', 'charges_interets', 'commissions_nettes', 'charges_exploitation', 'resultat_brut_exploitation', 'cout_du_risque', 'resultat_net'];
const ORDRE_ENCOURS: Agregat[] = ['credits_clientele', 'depots_clientele', 'creances_souffrance_brutes', 'taux_creances_souffrance', 'couverture_creances_souffrance', 'fonds_propres', 'total_bilan', 'solvabilite_total', 'ratio_cet1', 'ratio_tier1'];
/** Agrégats dont l'absence est dite au lecteur. */
const PRINCIPAUX: Agregat[] = ['pnb', 'marge_interets', 'commissions_nettes', 'charges_exploitation', 'cout_du_risque', 'credits_clientele', 'depots_clientele', 'creances_souffrance_brutes', 'fonds_propres', 'solvabilite_total'];

/** Clé de lignes_specifiques → agrégat (clés historiques de lib/bank/kpis.ts conservées). */
const CLE_VERS_AGREGAT: Record<string, Agregat> = {
  pnb: 'pnb', produit_interets: 'produits_interets', charges_interets: 'charges_interets', marge_interets: 'marge_interets',
  commissions_nettes: 'commissions_nettes', charges_exploitation: 'charges_exploitation', resultat_brut_exploitation: 'resultat_brut_exploitation',
  cout_du_risque: 'cout_du_risque', total_bilan: 'total_bilan', credits_clientele: 'credits_clientele', depots_clientele: 'depots_clientele',
  fonds_propres: 'fonds_propres', creances_souffrance_brutes: 'creances_souffrance_brutes', taux_creances_souffrance: 'taux_creances_souffrance',
  couverture_creances_souffrance: 'couverture_creances_souffrance', ratio_solvabilite: 'solvabilite_total', ratio_cet1: 'ratio_cet1', ratio_tier1: 'ratio_tier1',
};

const MOIS: Record<CodePeriode, number> = { T1: 3, S1: 6, T3: 9, exercice: 12 };

const nf = (v: number, d: number) => v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (fraction: number) => `${nf(fraction * 100, 1)} %`;
const md = (v: number) => `${nf(v / 1e9, Math.abs(v) >= 1e12 ? 0 : 1)} Md FCFA`;
const minuscule = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function lirePeriode(periode: string): { annee: number; code: CodePeriode } | null {
  if (/^\d{4}$/.test(periode)) return { annee: Number(periode), code: 'exercice' };
  if (/^\d{4}-12-31$/.test(periode)) return { annee: Number(periode.slice(0, 4)), code: 'exercice' };
  const m = /^(\d{4})-(T1|S1|T3)$/.exec(periode);
  return m ? { annee: Number(m[1]), code: m[2] as CodePeriode } : null;
}

export function libellePeriode(annee: number, code: CodePeriode): string {
  switch (code) {
    case 'T1': return `1er trimestre ${annee}`;
    case 'S1': return `1er semestre ${annee}`;
    case 'T3': return `9 premiers mois de ${annee}`;
    default: return `exercice ${annee}`;
  }
}

export function avecArticle(annee: number, code: CodePeriode): string {
  const l = libellePeriode(annee, code);
  return code === 'T3' ? `les ${l}` : code === 'exercice' ? `l’${l}` : `le ${l}`;
}

const POUR_CE: Record<CodePeriode, string> = { T1: 'ce trimestre', S1: 'ce semestre', T3: 'ces neuf mois', exercice: 'cet exercice' };
const ANNUALISATION: Record<CodePeriode, string | null> = { T1: 'trimestre annualisé (×4)', S1: 'semestre annualisé (×2)', T3: 'neuf mois annualisés (×4/3)', exercice: null };

export function periodesDepuisLignes(income: LigneComptesBancaire[], balance: LigneComptesBancaire[]): PeriodeBancaire[] {
  const parCle = new Map<string, PeriodeBancaire>();
  const periodeDe = (l: LigneComptesBancaire): PeriodeBancaire | null => {
    const p = lirePeriode(l.periode);
    if (!p) return null;
    const k = `${p.annee}|${p.code}`;
    let pb = parCle.get(k);
    if (!pb) {
      pb = { annee: p.annee, code: p.code, valeurs: {} };
      parCle.set(k, pb);
    }
    return pb;
  };
  for (const l of [...income, ...balance]) {
    const pb = periodeDe(l);
    if (!pb) continue;
    const ls = l.lignes_specifiques ?? {};
    for (const [cle, s] of Object.entries(l.sources_specifiques ?? {})) {
      const ag = CLE_VERS_AGREGAT[cle];
      const brut = ls[cle];
      if (!ag || !s || brut == null || !Number.isFinite(Number(brut))) continue;
      pb.valeurs[ag] = { valeur: Number(brut), perimetre: s.perimetre, source: { document_url: s.document_url, document_libelle: s.document_libelle, page: s.page } };
    }
  }
  for (const l of income) {
    const pb = periodeDe(l);
    if (pb && l.resultat_net != null && !pb.valeurs.resultat_net) pb.valeurs.resultat_net = { valeur: Number(l.resultat_net), perimetre: 'non_precise', source: null };
  }
  for (const l of balance) {
    const pb = periodeDe(l);
    if (pb && l.total_capitaux_propres != null && !pb.valeurs.fonds_propres) pb.valeurs.fonds_propres = { valeur: Number(l.total_capitaux_propres), perimetre: 'non_precise', source: null };
  }
  return [...parCle.values()].sort((a, b) => b.annee - a.annee || MOIS[b.code] - MOIS[a.code]);
}

const compatibles = (a: Perimetre, b: Perimetre) => a === b || a === 'non_precise' || b === 'non_precise';
const variationPct = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : null);
const trouver = (ps: PeriodeBancaire[], annee: number, code: CodePeriode) => ps.find((p) => p.annee === annee && p.code === code) ?? null;

function rapport(p: PeriodeBancaire | null, num: Agregat, den: Agregat): number | null {
  const x = p?.valeurs[num];
  const y = p?.valeurs[den];
  if (!x || !y || !compatibles(x.perimetre, y.perimetre) || !(y.valeur > 0)) return null;
  return x.valeur / y.valeur;
}

function comparer(cour: PeriodeBancaire, ag: Agregat, ref: PeriodeBancaire | null): Comparaison | null {
  const v = cour.valeurs[ag];
  const r = ref?.valeurs[ag];
  if (!v || !r || !ref || !compatibles(v.perimetre, r.perimetre)) return null;
  const enPoints = EN_POURCENT.has(ag);
  return { valeur: r.valeur, libelle: libellePeriode(ref.annee, ref.code), variation: enPoints ? v.valeur - r.valeur : variationPct(v.valeur, r.valeur), uniteVariation: enPoints ? 'pts' : '%' };
}

function ligneAgregat(cour: PeriodeBancaire, ag: Agregat, nm1: PeriodeBancaire | null, cloture: PeriodeBancaire | null): LigneAgregat {
  return {
    cle: ag, libelle: LIBELLES[ag], unite: EN_POURCENT.has(ag) ? 'pct' : 'fcfa', valeur: cour.valeurs[ag]!,
    precedent: comparer(cour, ag, nm1), cloture: cloture ? comparer(cour, ag, cloture) : null,
  };
}

export function lireBanque(periodes: PeriodeBancaire[], visee: { annee: number; code: CodePeriode }): LectureBancaire | null {
  const cour = trouver(periodes, visee.annee, visee.code);
  if (!cour) return null;
  const nm1 = trouver(periodes, visee.annee - 1, visee.code);
  const annuelNm1 = trouver(periodes, visee.annee - 1, 'exercice');
  const cloture = visee.code === 'exercice' ? null : annuelNm1;
  const facteur = 12 / MOIS[visee.code];

  const compteResultat = ORDRE_CR.filter((ag) => cour.valeurs[ag]).map((ag) => ligneAgregat(cour, ag, nm1, null));
  const encours = ORDRE_ENCOURS.filter((ag) => cour.valeurs[ag]).map((ag) => ligneAgregat(cour, ag, nm1, cloture));

  const ratios: LigneRatio[] = [];
  const coef = rapport(cour, 'charges_exploitation', 'pnb');
  if (coef != null) {
    ratios.push({ cle: 'coefficient_exploitation', libelle: 'Coefficient d’exploitation', valeur: coef, precedent: rapport(nm1, 'charges_exploitation', 'pnb'), phrase: `Les charges d’exploitation représentent ${pct(coef)} du PNB.`, mention: null });
  }
  const cdr = rapport(cour, 'cout_du_risque', 'credits_clientele');
  if (cdr != null) {
    const prec = rapport(nm1, 'cout_du_risque', 'credits_clientele');
    ratios.push({
      cle: 'cout_du_risque_relatif', libelle: 'Coût du risque rapporté aux crédits', valeur: cdr * facteur, precedent: prec == null ? null : prec * facteur,
      phrase: `Le coût du risque représente ${pct(cdr * facteur)} de l’encours de crédits à la clientèle${ANNUALISATION[visee.code] ? `, ${ANNUALISATION[visee.code]}` : ''}.`,
      mention: ANNUALISATION[visee.code],
    });
  }
  const cd = rapport(cour, 'credits_clientele', 'depots_clientele');
  if (cd != null) {
    ratios.push({ cle: 'credits_sur_depots', libelle: 'Crédits ÷ dépôts', valeur: cd, precedent: rapport(nm1, 'credits_clientele', 'depots_clientele'), phrase: `Les crédits à la clientèle représentent ${pct(cd)} des dépôts de la clientèle.`, mention: null });
  }
  const fp = cour.valeurs.fonds_propres;
  const rn = cour.valeurs.resultat_net;
  if (fp && rn && fp.valeur > 0 && compatibles(fp.perimetre, rn.perimetre)) {
    if (visee.code === 'exercice') {
      const roe = rn.valeur / fp.valeur;
      ratios.push({ cle: 'roe', libelle: 'Rentabilité des fonds propres', valeur: roe, precedent: rapport(nm1, 'resultat_net', 'fonds_propres'), phrase: `Le résultat net de l’exercice représente ${pct(roe)} des fonds propres.`, mention: null });
    } else {
      const rnNm1 = nm1?.valeurs.resultat_net;
      const rnAn = annuelNm1?.valeurs.resultat_net;
      const termes = [rn, rnNm1, rnAn, fp];
      const ok = rnNm1 && rnAn && termes.every((a) => termes.every((b) => compatibles(a!.perimetre, b!.perimetre)));
      if (ok) {
        const roe = (rnAn!.valeur + rn.valeur - rnNm1!.valeur) / fp.valeur;
        ratios.push({
          cle: 'roe', libelle: 'Rentabilité des fonds propres', valeur: roe, precedent: null,
          phrase: `Le résultat net des douze derniers mois représente ${pct(roe)} des fonds propres.`,
          mention: `douze mois glissants : exercice ${visee.annee - 1} + ${libellePeriode(visee.annee, visee.code)} − ${libellePeriode(visee.annee - 1, visee.code)}`,
        });
      }
    }
  }

  const nonPublies = PRINCIPAUX.filter((ag) => !cour.valeurs[ag]).map((ag) => LIBELLES[ag]);
  const extrait = Object.values(cour.valeurs).some((v) => v?.source != null);
  const mentionNonPublies = extrait && nonPublies.length
    ? `Autres agrégats non publiés pour ${POUR_CE[visee.code]} : ${nonPublies.map(minuscule).join(', ')}.`
    : null;

  // Constat : PNB d'abord, puis le plus marquant (score = écart ÷ seuil de lecture ; ≥ 1 pour être cité).
  const lignePnb = compteResultat.find((l) => l.cle === 'pnb');
  const constat: Constat = { pnb: lignePnb ? { valeur: lignePnb.valeur.valeur, variation: lignePnb.precedent?.variation ?? null } : null, second: null };
  const candidats: { cle: 'coefficient_exploitation' | 'cout_du_risque' | 'resultat_net'; variation: number; valeur: number; score: number }[] = [];
  const rCoef = ratios.find((r) => r.cle === 'coefficient_exploitation');
  if (rCoef?.precedent != null) {
    const ecart = (rCoef.valeur - rCoef.precedent) * 100;
    candidats.push({ cle: 'coefficient_exploitation', variation: ecart, valeur: rCoef.valeur, score: Math.abs(ecart) / 2 });
  }
  for (const [cle, seuil] of [['cout_du_risque', 20], ['resultat_net', 10]] as const) {
    const l = compteResultat.find((x) => x.cle === cle);
    const v = l?.precedent?.variation;
    if (l && v != null) candidats.push({ cle, variation: v, valeur: l.valeur.valeur, score: Math.abs(v) / seuil });
  }
  const meilleur = candidats.filter((c) => c.score >= 1).sort((a, b) => b.score - a.score)[0];
  if (meilleur) constat.second = { cle: meilleur.cle, variation: meilleur.variation, valeur: meilleur.valeur };

  const sens = (v: number) => (v >= 0 ? 'hausse' : 'baisse');
  const art = avecArticle(visee.annee, visee.code);
  const debut = constat.pnb
    ? constat.pnb.variation != null
      ? `PNB en ${sens(constat.pnb.variation)} de ${nf(Math.abs(constat.pnb.variation), 1)} % sur ${art}`
      : `PNB de ${md(constat.pnb.valeur)} sur ${art}`
    : null;
  const s = constat.second;
  const suite = s
    ? s.cle === 'coefficient_exploitation'
      ? `coefficient d’exploitation en ${sens(s.variation)} de ${nf(Math.abs(s.variation), 1)} point${Math.abs(s.variation) >= 2 ? 's' : ''}, à ${pct(s.valeur)}`
      : `${s.cle === 'cout_du_risque' ? 'coût du risque' : 'résultat net'} en ${sens(s.variation)} de ${nf(Math.abs(s.variation), 1)} %`
    : null;
  const prefixe = visee.code === 'exercice' ? 'de l’' : visee.code === 'T3' ? 'des ' : 'du ';
  const titre = debut && suite ? `${debut}, ${suite}` : debut ?? (suite ? `${majuscule(suite)} sur ${art}` : `Comptes ${prefixe}${libellePeriode(visee.annee, visee.code)}`);

  const vus = new Set<string>();
  const sources: SourceValeur[] = [];
  for (const v of Object.values(cour.valeurs)) {
    if (!v?.source || vus.has(v.source.document_url)) continue;
    vus.add(v.source.document_url);
    sources.push(v.source);
  }

  return {
    annee: visee.annee, code: visee.code, libelle: libellePeriode(visee.annee, visee.code), libellePrecedent: libellePeriode(visee.annee - 1, visee.code),
    extrait, compteResultat, encours, ratios, nonPublies, mentionNonPublies, constat, titre, sources,
  };
}

/** Dernier exercice portant une valeur sourcée ; à défaut le dernier exercice ; null sinon. */
export function dernierExercice(periodes: PeriodeBancaire[]): { annee: number; code: 'exercice' } | null {
  const exercices = periodes.filter((p) => p.code === 'exercice');
  const p = exercices.find((x) => Object.values(x.valeurs).some((v) => v?.source != null)) ?? exercices[0];
  return p ? { annee: p.annee, code: 'exercice' } : null;
}
```

- [ ] **Step 4: Lancer le test**

Run: `cd C:\tmp\wt-banques\frontend; npx vitest run lib/bank/lecture.test.ts`
Expected: PASS (17 tests).

- [ ] **Step 5: Commit**

```bash
git -C C:\tmp\wt-banques add frontend/lib/bank/lecture.ts frontend/lib/bank/lecture.test.ts
git -C C:\tmp\wt-banques commit -m "feat(banques): module pur de lecture bancaire (agrégats, ratios, constat)"
```

---

### Task 2: Copie scraper, chargeurs, test d'identité

**Files:**
- Create: `scraper/src/bank/pure/lecture.ts` (copie), `scraper/src/bank/chargerPeriodes.ts`, `frontend/lib/bank/chargerLecture.ts`
- Test: `frontend/lib/bank/coherence.test.ts` (première partie)

- [ ] **Step 1: Écrire le test d'identité**

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const racine = path.resolve(__dirname, '../../..');
const lire = (p: string) => readFileSync(path.join(racine, p), 'utf8');

describe('lecture bancaire : une seule source', () => {
  it('la copie du scraper est identique octet pour octet', () => {
    expect(lire('scraper/src/bank/pure/lecture.ts')).toBe(lire('frontend/lib/bank/lecture.ts'));
  });
});
```

- [ ] **Step 2: Lancer (échec attendu)**

Run: `cd C:\tmp\wt-banques\frontend; npx vitest run lib/bank/coherence.test.ts`
Expected: FAIL — `ENOENT … scraper/src/bank/pure/lecture.ts`.

- [ ] **Step 3: Créer la copie**

Run: `Copy-Item C:\tmp\wt-banques\frontend\lib\bank\lecture.ts C:\tmp\wt-banques\scraper\src\bank\pure\lecture.ts` (créer le dossier avant : `New-Item -ItemType Directory -Force C:\tmp\wt-banques\scraper\src\bank\pure`).

- [ ] **Step 4: Chargeur frontend `frontend/lib/bank/chargerLecture.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { periodesDepuisLignes, type LigneComptesBancaire, type PeriodeBancaire } from './lecture';

/**
 * Lignes de comptes d'une banque (tables publiques) → périodes bancaires.
 * Une erreur de lecture rend [] : la surface garde alors l'ancien affichage,
 * qui ne montre aucun chiffre faux. L'erreur est journalisée.
 */
export async function chargerPeriodesBancaires(sb: SupabaseClient, code: string): Promise<PeriodeBancaire[]> {
  const [inc, bal] = await Promise.all([
    sb.from('income_statements').select('periode,resultat_net,lignes_specifiques,sources_specifiques').eq('code', code),
    sb.from('balance_sheets').select('periode,total_capitaux_propres,lignes_specifiques,sources_specifiques').eq('code', code),
  ]);
  if (inc.error || bal.error) {
    console.error(`[lecture bancaire] ${code} : ${inc.error?.message ?? bal.error?.message}`);
    return [];
  }
  return periodesDepuisLignes((inc.data ?? []) as LigneComptesBancaire[], (bal.data ?? []) as LigneComptesBancaire[]);
}
```

- [ ] **Step 5: Chargeur scraper `scraper/src/bank/chargerPeriodes.ts`**

```ts
/**
 * Lignes de comptes d'une banque → périodes bancaires, côté scraper (articles).
 * Lève en cas d'erreur : un article ne s'écrit pas sur une lecture partielle.
 */
import { getSupabase } from '../persistence/supabase.js';
import { periodesDepuisLignes, type LigneComptesBancaire, type PeriodeBancaire } from './pure/lecture.js';

export async function chargerPeriodesBancaires(code: string): Promise<PeriodeBancaire[]> {
  const sb = getSupabase();
  const [inc, bal] = await Promise.all([
    sb.from('income_statements').select('periode,resultat_net,lignes_specifiques,sources_specifiques').eq('code', code),
    sb.from('balance_sheets').select('periode,total_capitaux_propres,lignes_specifiques,sources_specifiques').eq('code', code),
  ]);
  if (inc.error) throw new Error(`income_statements ${code} : ${inc.error.message}`);
  if (bal.error) throw new Error(`balance_sheets ${code} : ${bal.error.message}`);
  return periodesDepuisLignes((inc.data ?? []) as LigneComptesBancaire[], (bal.data ?? []) as LigneComptesBancaire[]);
}
```

- [ ] **Step 6: Tests et typecheck des deux paquets**

Run: `cd C:\tmp\wt-banques\frontend; npx vitest run lib/bank/coherence.test.ts; npx tsc --noEmit -p tsconfig.json; cd C:\tmp\wt-banques\scraper; npx tsc -p tsconfig.json --noEmit`
Expected: PASS et deux typechecks verts. Le scraper est en `noUncheckedIndexedAccess` : si une erreur apparaît dans la copie, la corriger dans `frontend/lib/bank/lecture.ts` (avec `!` ou un test explicite), relancer les tests de la Task 1, puis recopier.

- [ ] **Step 7: Commit**

```bash
git -C C:\tmp\wt-banques add scraper/src/bank frontend/lib/bank/chargerLecture.ts frontend/lib/bank/coherence.test.ts
git -C C:\tmp\wt-banques commit -m "feat(banques): copie scraper de la lecture bancaire et chargeurs"
```

---

### Task 3: Aligner `BankKpis` sur la lecture

**Files:**
- Create: `frontend/lib/bank/lectureKpis.ts`
- Test: `frontend/lib/bank/lectureKpis.test.ts`

- [ ] **Step 1: Écrire le test**

```ts
import { describe, expect, it } from 'vitest';
import { appliquerLecture } from './lectureKpis';
import type { BankKpis } from './kpis';
import type { LectureBancaire } from './lecture';

const kpis = { costIncome: 0.6, transformation: 0.9, ratioSolvabilite: null } as unknown as BankKpis;
const lecture = (ratios: LectureBancaire['ratios'], encours: LectureBancaire['encours'] = []) =>
  ({ extrait: true, ratios, encours } as unknown as LectureBancaire);

describe('appliquerLecture', () => {
  it('le coefficient et la transformation de la carte deviennent ceux de la lecture', () => {
    const k = appliquerLecture(kpis, lecture([
      { cle: 'coefficient_exploitation', libelle: '', valeur: 0.45, precedent: null, phrase: '', mention: null },
      { cle: 'credits_sur_depots', libelle: '', valeur: 0.79, precedent: null, phrase: '', mention: null },
    ]));
    expect(k.costIncome).toBe(0.45);
    expect(k.transformation).toBe(0.79);
  });
  it('la solvabilité retenue (en %) devient une fraction', () => {
    const k = appliquerLecture(kpis, lecture([], [{ cle: 'solvabilite_total', libelle: '', unite: 'pct', valeur: { valeur: 14.39, perimetre: 'individuel', source: null }, precedent: null, cloture: null }]));
    expect(k.ratioSolvabilite).toBeCloseTo(0.1439, 6);
  });
  it('sans lecture extraite : inchangé', () => {
    expect(appliquerLecture(kpis, null)).toBe(kpis);
    expect(appliquerLecture(kpis, { ...lecture([]), extrait: false } as LectureBancaire)).toBe(kpis);
  });
});
```

- [ ] **Step 2: Lancer (échec attendu)**

Run: `cd C:\tmp\wt-banques\frontend; npx vitest run lib/bank/lectureKpis.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Écrire le module**

```ts
import type { BankKpis } from './kpis';
import type { LectureBancaire } from './lecture';

/**
 * La carte « Analyse bancaire » affiche le même coefficient d'exploitation,
 * la même transformation et la même solvabilité que la Revue et le dossier :
 * quand une lecture extraite existe, ses ratios remplacent ceux de
 * computeBankKpis (frais généraux ÷ PNB y est une autre définition).
 */
export function appliquerLecture(kpis: BankKpis, lecture: LectureBancaire | null): BankKpis {
  if (!lecture?.extrait) return kpis;
  const ratio = (cle: string) => lecture.ratios.find((r) => r.cle === cle)?.valeur;
  const solva = lecture.encours.find((l) => l.cle === 'solvabilite_total')?.valeur.valeur;
  return {
    ...kpis,
    costIncome: ratio('coefficient_exploitation') ?? kpis.costIncome,
    transformation: ratio('credits_sur_depots') ?? kpis.transformation,
    ratioSolvabilite: solva != null ? solva / 100 : kpis.ratioSolvabilite,
  };
}
```

- [ ] **Step 4: Lancer le test**

Run: `cd C:\tmp\wt-banques\frontend; npx vitest run lib/bank/lectureKpis.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git -C C:\tmp\wt-banques add frontend/lib/bank/lectureKpis.ts frontend/lib/bank/lectureKpis.test.ts
git -C C:\tmp\wt-banques commit -m "feat(banques): la carte bancaire reprend les ratios de la lecture"
```

---

### Task 4: Vocabulaire de la Revue (« produit net bancaire »)

**Files:**
- Modify: `frontend/lib/revue/periode.ts`, `frontend/lib/document/constats.ts:98-114`
- Test: `frontend/lib/revue/periode.test.ts` (ajout)

- [ ] **Step 1: Ajouter les tests (fin de `periode.test.ts`)**

```ts
import { VOCABULAIRE } from './periode';

describe('vocabulaire bancaire', () => {
  const inter = lectureIntermediaire([
    { periode: '2025', revenu_total: 1000, resultat_net: 200 },
    { periode: '2026-S1', revenu_total: 520, resultat_net: 110 },
    { periode: '2025-S1', revenu_total: 500, resultat_net: 100 },
  ]);
  const p = periodePrincipale(annuels, inter)!;
  it('les lignes et le chiffre géant disent « produit net bancaire », jamais « chiffre d’affaires »', () => {
    expect(lignesComparaison(p, VOCABULAIRE.banque).map((l) => l.libelle)).toEqual(['Produit net bancaire', 'Résultat net']);
    const t = JSON.stringify([constatPeriode(p, VOCABULAIRE.banque), chiffreGeantPeriode(p, VOCABULAIRE.banque)]);
    expect(t).not.toMatch(/chiffre d’affaires/i);
  });
  it('par défaut, le vocabulaire général reste inchangé', () => {
    expect(lignesComparaison(p).map((l) => l.libelle)).toEqual(['Chiffre d’affaires', 'Résultat net']);
  });
});
```

- [ ] **Step 2: Lancer (échec attendu)**

Run: `cd C:\tmp\wt-banques\frontend; npx vitest run lib/revue/periode.test.ts`
Expected: FAIL — `VOCABULAIRE` non exporté.

- [ ] **Step 3: Modifier `lib/document/constats.ts`**

Remplacer la signature et la ligne du chiffre d'affaires de `constatIntermediaire` :

```ts
export function constatIntermediaire(i: {
  libelle: string; periodePrecedente: string;
  revenu: number | null; revenuPrecedent: number | null;
  resultatNet: number | null; resultatNetPrecedent: number | null;
} | null, revenuLibelle = 'chiffre d’affaires'): string | null {
  if (!i) return null;
  const v = (a: number | null, b: number | null) => (a != null && b != null && b > 0 ? pct(((a - b) / b) * 100) : null);
  const membres = [
    v(i.revenu, i.revenuPrecedent) ? `${revenuLibelle} ${v(i.revenu, i.revenuPrecedent)}` : null,
```

(le reste de la fonction est inchangé ; les appelants existants n'ont pas de second argument et gardent le comportement actuel).

- [ ] **Step 4: Modifier `lib/revue/periode.ts`**

Ajouter après les imports :

```ts
/** Libellés du revenu : une banque n'a pas de « chiffre d'affaires », elle a un PNB. */
export interface Vocabulaire { revenu: string; revenuMinuscule: string }
export const VOCABULAIRE: Record<'general' | 'banque', Vocabulaire> = {
  general: { revenu: 'Chiffre d’affaires', revenuMinuscule: 'chiffre d’affaires' },
  banque: { revenu: 'Produit net bancaire', revenuMinuscule: 'produit net bancaire' },
};
```

Puis, dans les trois fonctions, ajouter le paramètre `voc: Vocabulaire = VOCABULAIRE.general` et remplacer chaque libellé :
- `constatPeriode(p: PeriodePrincipale, voc: Vocabulaire = VOCABULAIRE.general)` : passer `voc.revenuMinuscule` en second argument de `constatIntermediaire(...)` ; remplacer `` `chiffre d’affaires de ${sansArrondiNul(p.revenu)}` `` par `` `${voc.revenuMinuscule} de ${sansArrondiNul(p.revenu)}` ``.
- `chiffreGeantPeriode(p: PeriodePrincipale, voc: Vocabulaire = VOCABULAIRE.general)` : dans la branche `vCa`, `legende: \`Évolution du ${voc.revenuMinuscule} sur …\`` — attention à l'élision : écrire `` `Évolution ${voc === VOCABULAIRE.banque ? 'du produit net bancaire' : 'du chiffre d’affaires'} sur ${avecArticle(p.libelle)}, ${comp}. Le résultat net n’est pas comparable (base nulle, négative ou absente).` `` et `titre: \`${voc.revenu} ${vCa >= 0 ? 'en hausse' : 'en baisse'} de …\``.
- `lignesComparaison(p: PeriodePrincipale, voc: Vocabulaire = VOCABULAIRE.general)` : `l(voc.revenu, p.revenu, p.revenuPrecedent)`.

- [ ] **Step 5: Lancer les tests**

Run: `cd C:\tmp\wt-banques\frontend; npx vitest run lib/revue/periode.test.ts lib/document`
Expected: PASS (anciens et nouveaux).

- [ ] **Step 6: Commit**

```bash
git -C C:\tmp\wt-banques add frontend/lib/revue/periode.ts frontend/lib/revue/periode.test.ts frontend/lib/document/constats.ts
git -C C:\tmp\wt-banques commit -m "feat(revue): vocabulaire bancaire, le PNB remplace le chiffre d'affaires"
```

---

### Task 5: Revue de résultats bancaire

**Files:**
- Create: `frontend/components/bank/LectureRevue.tsx`
- Modify: `frontend/app/actions/[code]/revue/page.tsx`

- [ ] **Step 1: Écrire le composant `components/bank/LectureRevue.tsx`**

```tsx
import { fmtFcfa, fmtNumber } from '@/lib/format';
import type { LectureBancaire, LigneAgregat } from '@/lib/bank/lecture';
import { Mesures } from '@/components/document/Document';

/**
 * Tableaux bancaires de la Revue : compte de résultat (PNB → résultat net),
 * encours, ratios calculés par lib/bank/lecture.ts. Chaque libellé renvoie au
 * document source (page). Aucun calcul ici.
 */
const moins = (s: string) => s.replace('-', '−');
const montant = (l: LigneAgregat, v: number) => (l.unite === 'pct' ? `${fmtNumber(v, 2)} %` : moins(`${fmtFcfa(v)} FCFA`));
const variation = (c: LigneAgregat['precedent']) =>
  c?.variation == null ? '—' : `${c.variation >= 0 ? '+' : '−'}${fmtNumber(Math.abs(c.variation), 1)}${c.uniteVariation === 'pts' ? ' pt' : ' %'}`;
const ton = (c: LigneAgregat['precedent']) => (c?.variation == null ? undefined : c.variation > 0 ? 'hausse' : c.variation < 0 ? 'baisse' : undefined);

function Libelle({ l }: { l: LigneAgregat }) {
  const s = l.valeur.source;
  if (!s) return <>{l.libelle}</>;
  return (
    <a href={s.document_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>
      {l.libelle}{s.page ? <sup> p. {s.page}</sup> : null}
    </a>
  );
}

function Tableau({ titre, lignes, colPrec, avecCloture }: { titre: string; lignes: LigneAgregat[]; colPrec: string; avecCloture: boolean }) {
  if (lignes.length === 0) return null;
  return (
    <table className="rv-table">
      <thead>
        <tr>
          <th scope="col">{titre}</th>
          <th scope="col">Publié</th>
          <th scope="col">{colPrec}</th>
          <th scope="col">Évolution</th>
          {avecCloture && <th scope="col">Dernière clôture</th>}
        </tr>
      </thead>
      <tbody>
        {lignes.map((l) => (
          <tr key={l.cle}>
            <td><Libelle l={l} /></td>
            <td className="fort">{montant(l, l.valeur.valeur)}</td>
            <td>{l.precedent ? montant(l, l.precedent.valeur) : '—'}</td>
            <td className={ton(l.precedent)}>{variation(l.precedent)}</td>
            {avecCloture && <td>{l.cloture ? montant(l, l.cloture.valeur) : '—'}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function LectureRevue({ lecture }: { lecture: LectureBancaire }) {
  const interim = lecture.code !== 'exercice';
  return (
    <>
      <Tableau titre="Compte de résultat, en FCFA" lignes={lecture.compteResultat} colPrec={lecture.libellePrecedent} avecCloture={false} />
      <Tableau titre="Encours et solidité" lignes={lecture.encours} colPrec={`même date ${lecture.annee - 1}`} avecCloture={interim} />
      {lecture.ratios.length > 0 && (
        <Mesures items={lecture.ratios.map((r) => ({ libelle: r.libelle, valeur: `${fmtNumber(r.valeur * 100, 1)} %`, note: [r.phrase, r.mention].filter(Boolean).join(' ') }))} />
      )}
      {lecture.mentionNonPublies && <p className="doc-note">{lecture.mentionNonPublies}</p>}
      {interim && <p className="doc-note">Flux cumulés depuis le début de l’exercice, comparés au même cumul de {lecture.annee - 1} ; encours à la date d’arrêté, comparés à la même date de {lecture.annee - 1}, puis à la dernière clôture annuelle.</p>}
      <p className="doc-note">
        Sources : {lecture.sources.map((s, i) => (
          <span key={s.document_url}>{i > 0 ? ' ; ' : ''}<a href={s.document_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>{s.document_libelle ?? 'document publié'}</a></span>
        ))}. Le résultat net est celui des comptes en base, recoupé avec le document. Ratios calculés par WESTBOURSE, aucun n’est repris tel quel.
      </p>
    </>
  );
}
```

- [ ] **Step 2: Brancher la Revue**

Dans `frontend/app/actions/[code]/revue/page.tsx` :

1. Imports à ajouter :

```ts
import { FAMILLE_PAR_CODE } from '@/lib/financials/sectors';
import { chargerPeriodesBancaires } from '@/lib/bank/chargerLecture';
import { lireBanque, lirePeriode } from '@/lib/bank/lecture';
import LectureRevue from '@/components/bank/LectureRevue';
import { VOCABULAIRE } from '@/lib/revue/periode';
```

2. Remplacer le `Promise.all` initial par :

```ts
  const banque = FAMILLE_PAR_CODE[d.code] === 'banque';
  const [inter, evtResultats, periodesBanque] = await Promise.all([
    chargerIntermediaire(sb, d.code, d.years.map((y) => ({ year: Number(y.periode), revenue: y.revenu, net_income: y.resultatNet }))),
    chargerDerniereMiseAJour(sb, d.code),
    banque ? chargerPeriodesBancaires(sb, d.code) : Promise.resolve([]),
  ]);
```

3. Après `const principale = …;` :

```ts
  const voc = banque ? VOCABULAIRE.banque : VOCABULAIRE.general;
  const visee = principale ? lirePeriode(principale.periode) : null;
  const lectureBrute = banque && visee ? lireBanque(periodesBanque, visee) : null;
  // Période non encore extraite : ancien affichage, vocabulaire bancaire.
  const lecture = lectureBrute?.extrait ? lectureBrute : null;
  const lPnb = lecture?.compteResultat.find((l) => l.cle === 'pnb') ?? null;
  const lRn = lecture?.compteResultat.find((l) => l.cle === 'resultat_net') ?? null;
```

4. `ligne("Chiffre d'affaires", (y) => y.revenu)` devient `ligne(voc.revenu, (y) => y.revenu)` ; dans le `GraphiqueBarres` de la feuille 3, `<h3>{voc.revenu}</h3>` et `titre={`${voc.revenu} par exercice`}`. Le `hint` de l'`AccessGate` reste générique (il est affiché avant de connaître la famille) : le remplacer par « Les derniers comptes de chaque société lus pour vous : activité, résultat, dividende et ratios, comparés à la même période de l'année précédente. »

5. Couverture : remplacer `constat` et `chiffres` par

```tsx
        constat={lecture ? lecture.titre : principale ? constatPeriode(principale, voc) : 'Aucun compte publié n’est disponible pour cette valeur.'}
        total={TOTAL}
        chiffres={[
          lecture
            ? lPnb ? { libelle: 'Produit net bancaire', valeur: `${md(lPnb.valeur.valeur)} FCFA`, note: lecture.libelle } : null
            : principale?.revenu != null ? { libelle: voc.revenu, valeur: `${md(principale.revenu)} FCFA`, note: principale.libelle } : null,
          lecture
            ? lRn ? { libelle: 'Résultat net', valeur: `${md(lRn.valeur.valeur)} FCFA`, note: lecture.libelle } : null
            : principale?.resultatNet != null ? { libelle: 'Résultat net', valeur: `${md(principale.resultatNet)} FCFA`, note: principale.libelle } : null,
          d.price?.cours != null ? { libelle: 'Cours', valeur: fcfa(d.price.cours)!, note: d.price.date ? `au ${fmtDateCourte(d.price.date)}` : null } : null,
        ].filter((x): x is NonNullable<typeof x> => x != null)}
```

6. Feuille 2 : envelopper le contenu existant :

```tsx
      <Feuille entete={entete} societe={nom} page={2} total={TOTAL}>
        {lecture ? (
          <Panneau titre={lecture.titre}>
            <LectureRevue lecture={lecture} />
            {miseAJour && <p className="rv-maj">{miseAJour}</p>}
          </Panneau>
        ) : principale && geant ? (
          /* bloc existant, inchangé, sauf : chiffreGeantPeriode(principale, voc), lignesComparaison(principale, voc),
             et dans `Mesures` du glissant : `${voc.revenu}, ${principale.glissant.libelle}` */
```

et `const geant = principale ? chiffreGeantPeriode(principale, voc) : null;`.

- [ ] **Step 3: Typecheck et build**

Run: `cd C:\tmp\wt-banques\frontend; npx tsc --noEmit -p tsconfig.json; npm run build`
Expected: vert.

- [ ] **Step 4: Rendu (3 banques, une non-banque)**

Run: `cd C:\tmp\wt-banques\frontend; npm run dev` puis, connecté en Premium (procédure de la mémoire « Vérifier une page connectée »), ouvrir `/actions/SGBC/revue`, `/actions/SIBC/revue`, `/actions/CBIBF/revue`, `/actions/SNTS/revue`. Vérifier par `innerText` (pas le HTML brut) :
- banques : aucune occurrence de « Chiffre d’affaires » ; avant la PR 3, vocabulaire « Produit net bancaire » sur l'ancien affichage ; après une reprise écrite, tableaux bancaires et sources cliquables ;
- SNTS : affichage identique à `main`.
Puis impression (Ctrl+P, aperçu) : 4 feuilles, aucun débordement.

- [ ] **Step 5: Commit**

```bash
git -C C:\tmp\wt-banques add frontend/components/bank/LectureRevue.tsx "frontend/app/actions/[code]/revue/page.tsx"
git -C C:\tmp\wt-banques commit -m "feat(revue): Revue de résultats bancaire (PNB, charges, risque, encours, ratios sourcés)"
```

---

### Task 6: Fiche société et page financials

**Files:**
- Create: `frontend/components/bank/TableauLecture.tsx`
- Modify: `frontend/app/societes/[code]/page.tsx` (bloc « Fondamentaux », ~l. 488-520)
- Modify: `frontend/app/actions/[code]/financials/page.tsx` (bloc `bankAnalysis`), `frontend/components/financials/BankScorecard.tsx`

- [ ] **Step 1: Composant `components/bank/TableauLecture.tsx`**

```tsx
import { fmtFcfa, fmtNumber } from '@/lib/format';
import type { LectureBancaire, LigneAgregat } from '@/lib/bank/lecture';

/** Bloc bancaire de la fiche : mêmes agrégats, mêmes ratios, même vocabulaire que la Revue. */
const valeur = (l: LigneAgregat) => (l.unite === 'pct' ? `${fmtNumber(l.valeur.valeur, 2)} %` : `${fmtFcfa(l.valeur.valeur).replace('-', '−')} FCFA`);

function Ligne({ l }: { l: LigneAgregat }) {
  const s = l.valeur.source;
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/40 py-1.5 last:border-0">
      <span className="text-xs text-muted">
        {s ? <a href={s.document_url} target="_blank" rel="noopener noreferrer" className="hover:underline">{l.libelle}{s.page ? ` (p. ${s.page})` : ''}</a> : l.libelle}
      </span>
      <span className="tabular text-sm font-medium text-white">{valeur(l)}</span>
    </div>
  );
}

export default function TableauLecture({ lecture }: { lecture: LectureBancaire }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="mb-3 text-xs text-muted">Compte de résultat bancaire ({lecture.libelle})</h3>
        {lecture.compteResultat.map((l) => <Ligne key={l.cle} l={l} />)}
      </div>
      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="mb-3 text-xs text-muted">Encours et solidité</h3>
        {lecture.encours.map((l) => <Ligne key={l.cle} l={l} />)}
        {lecture.ratios.map((r) => (
          <div key={r.cle} className="border-b border-border/40 py-1.5 last:border-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-muted">{r.libelle}</span>
              <span className="tabular text-sm font-medium text-white">{fmtNumber(r.valeur * 100, 1)} %</span>
            </div>
            <p className="text-[11px] text-faint">{r.phrase}{r.mention ? ` (${r.mention})` : ''}</p>
          </div>
        ))}
      </div>
      {lecture.mentionNonPublies && <p className="text-[11px] text-faint md:col-span-2">{lecture.mentionNonPublies}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Fiche `/societes/[code]`**

Ajouter les imports :

```ts
import { FAMILLE_PAR_CODE } from '@/lib/financials/sectors';
import { chargerPeriodesBancaires } from '@/lib/bank/chargerLecture';
import { lireBanque } from '@/lib/bank/lecture';
import TableauLecture from '@/components/bank/TableauLecture';
```

Après `const bestFund = pickBestFundamental(fundamentals);` :

```ts
  const estBanque = FAMILLE_PAR_CODE[code] === 'banque';
  const lectureFiche = estBanque && bestFund?.year != null
    ? lireBanque(await chargerPeriodesBancaires(createPublicClient(), code), { annee: bestFund.year, code: 'exercice' })
    : null;
  const lectureBanque = lectureFiche?.extrait ? lectureFiche : null;
  // Même chiffre que la Revue et le dossier : le PNB retenu l'emporte sur la colonne revenue.
  const revenuFiche = lectureBanque?.compteResultat.find((l) => l.cle === 'pnb')?.valeur.valeur ?? bestFund?.revenue ?? null;
```

Dans la liste des mesures, remplacer la première entrée par :

```ts
              { label: estBanque ? 'Produit net bancaire' : "Chiffre d'affaires", value: avecUnite(fmtFcfa(revenuFiche), 'FCFA'), badge: badgeCalcule(revenuFiche) },
```

et, juste avant la fermeture `</section>` du bloc Fondamentaux, ajouter :

```tsx
          {lectureBanque && (
            <div className="mt-4">
              <TableauLecture lecture={lectureBanque} />
            </div>
          )}
```

Vérifier dans le même bloc les autres libellés « chiffre d'affaires » : `rg -n "hiffre d" "C:\tmp\wt-banques\frontend\app\societes\[code]\page.tsx"` — tout libellé visible pour une banque passe par `estBanque ? 'Produit net bancaire' : …`.

- [ ] **Step 3: Page financials et `BankScorecard`**

Dans `frontend/app/actions/[code]/financials/page.tsx`, ajouter les imports :

```ts
import { chargerPeriodesBancaires } from '@/lib/bank/chargerLecture';
import { lireBanque } from '@/lib/bank/lecture';
import { appliquerLecture } from '@/lib/bank/lectureKpis';
```

Avant `const bankAnalysis = (() => {`, ajouter :

```ts
  const anneeBanque = latestIncome?.periode ? Number(String(latestIncome.periode).slice(0, 4)) : null;
  const lectureBanqueBrute = data.instrument.famille_comptable === 'banque' && anneeBanque != null && Number.isFinite(anneeBanque)
    ? lireBanque(await chargerPeriodesBancaires(createClient(), code), { annee: anneeBanque, code: 'exercice' })
    : null;
  const lectureBanque = lectureBanqueBrute?.extrait ? lectureBanqueBrute : null;
```

Dans `bankAnalysis`, remplacer `const kpis = computeBankKpis(…);` par

```ts
    const kpis = appliquerLecture(computeBankKpis(cur, prev, {
      cours: data.latestDaily?.cours_jour ?? null,
      shares: data.instrument.shares,
      dividendeParAction: latestIncome?.dividende_par_action ?? null,
    }), lectureBanque);
```

et ajouter `lecture: lectureBanque,` dans l'objet retourné. Passer la prop au rendu : `<BankScorecard … lecture={bankAnalysis.lecture} />` (repérer l'appel par `rg -n "<BankScorecard" "C:\tmp\wt-banques\frontend\app\actions\[code]\financials\page.tsx"`).

Dans `components/financials/BankScorecard.tsx` : importer `TableauLecture` et le type `LectureBancaire`, ajouter la prop `lecture?: LectureBancaire | null` à la signature, et en tête du `<div className="space-y-4">` :

```tsx
      {lecture && <TableauLecture lecture={lecture} />}
```

Le libellé « Coefficient d'exploitation » de la carte affiche désormais `kpis.costIncome`, déjà remplacé par la valeur de la lecture : même chiffre que la Revue.

- [ ] **Step 4: Typecheck, tests, build**

Run: `cd C:\tmp\wt-banques\frontend; npx tsc --noEmit -p tsconfig.json; npx vitest run lib/bank; npm run build`
Expected: vert.

- [ ] **Step 5: Commit**

```bash
git -C C:\tmp\wt-banques add frontend/components/bank/TableauLecture.tsx "frontend/app/societes/[code]/page.tsx" "frontend/app/actions/[code]/financials/page.tsx" frontend/components/financials/BankScorecard.tsx
git -C C:\tmp\wt-banques commit -m "feat(fiche): agrégats bancaires sourcés sur la fiche et la carte bancaire"
```

---

### Task 7: Dossier valeur, version bancaire des feuilles 6 et 7

**Files:**
- Create: `frontend/lib/bank/dossierBancaire.ts`, `frontend/lib/bank/dossierBancaire.test.ts`
- Modify: `frontend/lib/dossier/bornes.ts`, `frontend/lib/dossier/build.ts`, `frontend/components/dossier/Graphiques.tsx`, `frontend/app/rapports/dossier/[code]/page.tsx`

- [ ] **Step 1: Écrire le test**

```ts
import { describe, expect, it } from 'vitest';
import { trajectoireBancaire, etapesCascade, encoursDossier } from './dossierBancaire';
import type { LectureBancaire, LigneAgregat } from './lecture';

const l = (cle: LigneAgregat['cle'], v: number, unite: 'fcfa' | 'pct' = 'fcfa'): LigneAgregat => ({ cle, libelle: cle, unite, valeur: { valeur: v, perimetre: 'individuel', source: null }, precedent: null, cloture: null });
const lecture = (cr: LigneAgregat[], enc: LigneAgregat[] = []) => ({ compteResultat: cr, encours: enc } as unknown as LectureBancaire);

describe('trajectoireBancaire', () => {
  it('le PNB retenu remplace la colonne de revenu de l’exercice, le reste est gardé', () => {
    expect(trajectoireBancaire(
      [{ exercice: '2024', chiffre_affaires: 280e9, resultat_net: 80e9 }, { exercice: '2025', chiffre_affaires: 299e9, resultat_net: 95e9 }],
      [{ exercice: '2025', pnb: 300e9 }],
    )).toEqual([{ exercice: '2024', chiffre_affaires: 280e9, resultat_net: 80e9 }, { exercice: '2025', chiffre_affaires: 300e9, resultat_net: 95e9 }]);
  });
});

describe('etapesCascade', () => {
  it('PNB → charges → RBE → coût du risque → autres et impôt → résultat net', () => {
    const e = etapesCascade(lecture([l('pnb', 300e9), l('charges_exploitation', 150e9), l('resultat_brut_exploitation', 150e9), l('cout_du_risque', 20e9), l('resultat_net', 95e9)]))!;
    expect(e.map((x) => [x.libelle, x.debut, x.fin, x.total])).toEqual([
      ['PNB', 0, 300e9, true],
      ['Charges d’exploitation', 300e9, 150e9, false],
      ['RBE', 0, 150e9, true],
      ['Coût du risque', 150e9, 130e9, false],
      ['Autres éléments et impôt', 130e9, 95e9, false],
      ['Résultat net', 0, 95e9, true],
    ]);
  });
  it('un maillon non publié : pas de cascade (jamais reconstituée)', () => {
    expect(etapesCascade(lecture([l('pnb', 300e9), l('charges_exploitation', 150e9), l('resultat_net', 95e9)]))).toBeNull();
  });
});

describe('encoursDossier', () => {
  it('solvabilité d’abord, au plus N, le reste compté', () => {
    const r = encoursDossier(lecture([], [l('credits_clientele', 1), l('depots_clientele', 2), l('creances_souffrance_brutes', 3), l('fonds_propres', 4), l('solvabilite_total', 14, 'pct')]), 4);
    expect(r.affichees.map((x) => x.cle)).toEqual(['solvabilite_total', 'credits_clientele', 'depots_clientele', 'fonds_propres']);
    expect(r.omis).toBe(1);
  });
});
```

- [ ] **Step 2: Lancer (échec attendu)**

Run: `cd C:\tmp\wt-banques\frontend; npx vitest run lib/bank/dossierBancaire.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Écrire `lib/bank/dossierBancaire.ts`**

```ts
import { borner, type ListeBornee } from '@/lib/dossier/bornes';
import type { PointAnnuel } from '@/lib/dossier/build';
import type { Agregat, LectureBancaire, LigneAgregat } from './lecture';

/**
 * Version bancaire des feuilles « trajectoire » et « origine du bénéfice » du
 * dossier — PUR. Aucun chiffre calculé ici hormis les marches de la cascade,
 * qui sont des différences entre agrégats PUBLIÉS (jamais un agrégat manquant
 * reconstitué).
 */
export function trajectoireBancaire(base: PointAnnuel[], sourcee: { exercice: string; pnb: number | null }[]): PointAnnuel[] {
  const pnb = new Map(sourcee.filter((s) => s.pnb != null).map((s) => [s.exercice, s.pnb!]));
  return base.map((p) => (pnb.has(p.exercice) ? { ...p, chiffre_affaires: pnb.get(p.exercice)! } : p));
}

export interface EtapeCascade { libelle: string; debut: number; fin: number; total: boolean }

export function etapesCascade(l: LectureBancaire): EtapeCascade[] | null {
  const v = (cle: Agregat) => l.compteResultat.find((x) => x.cle === cle)?.valeur.valeur ?? null;
  const pnb = v('pnb'), ce = v('charges_exploitation'), rbe = v('resultat_brut_exploitation'), cdr = v('cout_du_risque'), rn = v('resultat_net');
  if (pnb == null || ce == null || rbe == null || cdr == null || rn == null) return null;
  const apresRisque = rbe - cdr;
  return [
    { libelle: 'PNB', debut: 0, fin: pnb, total: true },
    { libelle: 'Charges d’exploitation', debut: pnb, fin: rbe, total: false },
    { libelle: 'RBE', debut: 0, fin: rbe, total: true },
    { libelle: 'Coût du risque', debut: rbe, fin: apresRisque, total: false },
    { libelle: 'Autres éléments et impôt', debut: apresRisque, fin: rn, total: false },
    { libelle: 'Résultat net', debut: 0, fin: rn, total: true },
  ];
}

const PRIORITE: Agregat[] = ['solvabilite_total', 'credits_clientele', 'depots_clientele', 'fonds_propres', 'creances_souffrance_brutes', 'taux_creances_souffrance', 'couverture_creances_souffrance', 'ratio_cet1', 'ratio_tier1', 'total_bilan'];

export function encoursDossier(l: LectureBancaire, max: number): ListeBornee<LigneAgregat> {
  const tries = [...l.encours].sort((a, b) => PRIORITE.indexOf(a.cle) - PRIORITE.indexOf(b.cle));
  return borner(tries, max);
}
```

Note : la marche « Charges d'exploitation » va de PNB au RBE publié (pas à PNB − charges) ; le contrôle d'égalité du plan 1 garantit que les deux coïncident à l'arrondi pour une valeur retenue.

- [ ] **Step 4: Lancer le test**

Run: `cd C:\tmp\wt-banques\frontend; npx vitest run lib/bank/dossierBancaire.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Borne (`lib/dossier/bornes.ts`)**

Ajouter dans `BORNES` :

```ts
  /** Feuille 7 (banque) : encours et solvabilité affichés sous la cascade. */
  encoursBancaires: 4,
```

- [ ] **Step 6: `buildDossier` (`lib/dossier/build.ts`)**

Imports :

```ts
import { chargerPeriodesBancaires } from '@/lib/bank/chargerLecture';
import { lireBanque, dernierExercice, type LectureBancaire } from '@/lib/bank/lecture';
```

Dans `interface DossierValeur`, ajouter :

```ts
  /** Banque seulement : lecture de l'exercice de référence et PNB retenu par exercice (lib/bank/lecture). */
  banque: { lecture: LectureBancaire | null; pnbParExercice: { exercice: string; pnb: number | null }[] } | null;
```

Dans `buildDossier`, après le calcul de `exerciceRef` :

```ts
  const banque = FAMILLE_PAR_CODE[CODE] === 'banque'
    ? await (async () => {
        const periodes = await chargerPeriodesBancaires(sb, CODE);
        const visee = exerciceRef ? { annee: Number(exerciceRef), code: 'exercice' as const } : dernierExercice(periodes);
        const lecture = visee ? lireBanque(periodes, visee) : null;
        return {
          lecture: lecture?.extrait ? lecture : null,
          pnbParExercice: periodes.filter((p) => p.code === 'exercice').map((p) => ({ exercice: String(p.annee), pnb: p.valeurs.pnb?.source ? p.valeurs.pnb.valeur : null })),
        };
      })()
    : null;
```

et `banque,` dans l'objet retourné. Rechercher les autres constructeurs de `DossierValeur` (fixtures de test) : `rg -n "nb_publications:" C:\tmp\wt-banques\frontend\lib` — ajouter `banque: null` à chacun pour garder les tests verts.

- [ ] **Step 7: Graphiques (`components/dossier/Graphiques.tsx`)**

1. `BarresAnnuelles` reçoit un libellé : signature `export function BarresAnnuelles({ points, libelleRevenu = "Chiffre d'affaires" }: { points: PointAnnuel[]; libelleRevenu?: string })` ; remplacer `aria-label="Chiffre d'affaires et résultat net par exercice"` par `` aria-label={`${libelleRevenu} et résultat net par exercice`} `` et la légende `Chiffre d&apos;affaires` par `{libelleRevenu}`.

2. Ajouter, après `BarresAnnuelles` :

```tsx
// ── Cascade bancaire : PNB → résultat net ───────────────────────────────────
export function CascadeBancaire({ etapes }: { etapes: { libelle: string; debut: number; fin: number; total: boolean }[] }) {
  const L = 620;
  const H = 200;
  const MG = { haut: 18, bas: 40, gauche: 8, droite: 8 };
  const valeurs = etapes.flatMap((e) => [e.debut, e.fin]);
  const { min, max } = bornes(valeurs);
  const y = (v: number) => MG.haut + (H - MG.haut - MG.bas) * (1 - (v - min) / (max - min));
  const pas = (L - MG.gauche - MG.droite) / etapes.length;
  const largeur = Math.min(pas * 0.6, 64);
  return (
    <figure className="dv-figure">
      <svg viewBox={`0 0 ${L} ${H}`} role="img" aria-label={`Du PNB au résultat net : ${etapes.map((e) => `${e.libelle} ${fmtFcfa(e.total ? e.fin : e.fin - e.debut)}`).join(', ')}`}>
        <line x1={MG.gauche} x2={L - MG.droite} y1={y(0)} y2={y(0)} stroke={DOUX} strokeWidth={1} />
        {etapes.map((e, i) => {
          const x = MG.gauche + pas * i + (pas - largeur) / 2;
          const haut = y(Math.max(e.debut, e.fin));
          const delta = e.fin - e.debut;
          const fill = e.total ? ACCENT : delta >= 0 ? HAUSSE : BAISSE;
          return (
            <g key={e.libelle}>
              <rect x={x} y={haut} width={largeur} height={Math.max(Math.abs(y(e.debut) - y(e.fin)), 1)} fill={fill} rx="2" />
              <text x={x + largeur / 2} y={haut - 4} textAnchor="middle" fontSize="10" fill={ENCRE}>
                {`${!e.total && delta > 0 ? '+' : ''}${fmtFcfa(e.total ? e.fin : delta)}`}
              </text>
              <text x={x + largeur / 2} y={H - 22} textAnchor="middle" fontSize="9.5" fill={DOUX}>{e.libelle.split(' ').slice(0, 2).join(' ')}</text>
              <text x={x + largeur / 2} y={H - 10} textAnchor="middle" fontSize="9.5" fill={DOUX}>{e.libelle.split(' ').slice(2).join(' ')}</text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
```

- [ ] **Step 8: Page du dossier**

Dans `app/rapports/dossier/[code]/page.tsx` :

1. Imports : `CascadeBancaire` à côté de `BarresAnnuelles` ; `import { trajectoireBancaire, etapesCascade, encoursDossier } from '@/lib/bank/dossierBancaire';`.

2. Après `const traj = d.trajectoire;` :

```ts
  const lb = d.banque?.lecture ?? null;
  const trajAffichee = d.banque ? trajectoireBancaire(d.trajectoire, d.banque.pnbParExercice) : d.trajectoire;
  const cascade = lb ? etapesCascade(lb) : null;
  const encoursB = lb ? encoursDossier(lb, BORNES.encoursBancaires) : null;
```

3. Feuille 6, panneau trajectoire :

```tsx
        <Panneau
          n={PANNEAU.trajectoire}
          titre={d.banque ? 'Trajectoire du PNB et du résultat' : 'Trajectoire des résultats'}
          chapo={d.banque
            ? 'Produit net bancaire et résultat net par exercice, à la même échelle, en FCFA.'
            : "Chiffre d'affaires et résultat net par exercice, à la même échelle : les deux sont en FCFA, la comparaison est directe."}
        >
          <BarresAnnuelles points={trajAffichee} libelleRevenu={d.banque ? 'Produit net bancaire' : "Chiffre d'affaires"} />
        </Panneau>
```

Dans la grille « Valorisation » de la même feuille, la mesure `Cours / chiffre d'affaires` devient `libelle={d.banque ? 'Cours / PNB' : "Cours / chiffre d'affaires"}`.

4. Feuille 7, panneau bénéfice : remplacer l'ouverture `<Panneau n={PANNEAU.benefice} titre="D'où vient le bénéfice" chapo=…>{q ? (…) : (…)}</Panneau>` par

```tsx
        {lb ? (
          <Panneau
            n={PANNEAU.benefice}
            titre="D'où vient le bénéfice"
            chapo={`Du produit net bancaire au résultat net, ${lb.libelle}. Chaque marche est un agrégat publié ; aucune n'est reconstituée.`}
          >
            {cascade ? (
              <CascadeBancaire etapes={cascade} />
            ) : (
              <dl className="dv-grille">
                {lb.compteResultat.slice(0, 4).map((l) => (
                  <Mesure key={l.cle} libelle={l.libelle} valeur={cfa(l.valeur.valeur)} />
                ))}
              </dl>
            )}
            {encoursB && encoursB.affichees.length > 0 && (
              <dl className="dv-grille" style={{ marginTop: '3mm' }}>
                {encoursB.affichees.map((l) => (
                  <Mesure key={l.cle} libelle={l.libelle} valeur={l.unite === 'pct' ? `${nb(l.valeur.valeur, 2)} %` : cfa(l.valeur.valeur)} />
                ))}
              </dl>
            )}
            {encoursB && phraseOmis(encoursB.omis, 'indicateur') && (
              <p className="dv-note">{phraseOmis(encoursB.omis, 'indicateur')}, détaillés dans la Revue de résultats.</p>
            )}
            {lb.mentionNonPublies && <p className="dv-note">{lb.mentionNonPublies}</p>}
          </Panneau>
        ) : (
          /* panneau existant, inchangé */
        )}
```

`cfa` et `nb` sont les formateurs déjà définis dans la page (vérifier leurs noms : `rg -n "const (cfa|nb|part|fois) =" "C:\tmp\wt-banques\frontend\app\rapports\dossier\[code]\page.tsx"`) ; si la classe `dv-note` n'existe pas dans `dossier.css`, utiliser la classe de note déjà employée par les autres panneaux (`rg -n "dv-note|dv-legende" …\dossier.css`).

- [ ] **Step 9: Tests, typecheck, build**

Run: `cd C:\tmp\wt-banques\frontend; npx vitest run lib/dossier lib/bank; npx tsc --noEmit -p tsconfig.json; npm run build`
Expected: vert (dont `structure.test.ts` : toujours 17 feuilles).

- [ ] **Step 10: Impression de 3 banques, 17 feuilles, aucun débordement**

Run (deux terminaux) : `cd C:\tmp\wt-banques\frontend; $env:DOSSIER_RENDER_SECRET='<secret local de 32+ caractères>'; npm run dev` puis
`cd C:\tmp\wt-banques\video; $env:DOSSIER_DRY='1'; $env:DOSSIER_SITE_URL='http://localhost:3000'; $env:DOSSIER_RENDER_SECRET='<même secret>'; node dossiers.mjs SGBC SIBC CBIBF`
Expected : `3 rangé(s), 0 échec(s)` avec la mention `imprimé (dry)` (rien n'est envoyé au bucket) ; PDF dans `video/out/dossiers/`. Un « contenu qui déborde » fait échouer : réduire `BORNES.encoursBancaires` à 2, ou le nombre de mesures de repli, puis relancer — jamais rogner.

- [ ] **Step 11: Commit**

```bash
git -C C:\tmp\wt-banques add frontend/lib/bank/dossierBancaire.ts frontend/lib/bank/dossierBancaire.test.ts frontend/lib/dossier/bornes.ts frontend/lib/dossier/build.ts frontend/components/dossier/Graphiques.tsx "frontend/app/rapports/dossier/[code]/page.tsx"
git -C C:\tmp\wt-banques commit -m "feat(dossier): trajectoire du PNB et cascade bancaire, 17 feuilles inchangées"
```

---

### Task 8: Article de résultats bancaires (scraper, `Plume`)

**Files:**
- Modify: `scraper/src/articles/redaction.ts` (exporter `Plume`, `Outils` ; préfixe ; dispatch), `scraper/src/articles/types.ts`, `scraper/src/articles/runArticles.ts`
- Create: `scraper/src/articles/resultatsBanque.ts`
- Test: `scraper/tests/resultatsBanque.test.ts`

Le type `'resultats'` existe déjà dans la contrainte de `articles.type` (migration 0167) : aucune migration. Il n'est PAS dans `TYPES_AUTOMATIQUES` : l'article part en `a_valider` (relecture dans `/admin/articles`), comme prévu pour le lot 2.

- [ ] **Step 1: Écrire le test**

```ts
import { describe, expect, it } from 'vitest';
import { periodesDepuisLignes, lireBanque, type LigneComptesBancaire } from '../src/bank/pure/lecture.js';
import { assembler, rediger } from '../src/articles/redaction.js';
import { verifier } from '../src/articles/verrous.js';
import { assertNoForeignNumber } from '../src/hebdo/polish.js';
import type { Fait } from '../src/articles/types.js';

const src = { document_url: 'https://x/s1.pdf', document_libelle: 'Rapport d’activités S1 2026', page: 3, perimetre: 'individuel' as const };
const l = (periode: string, v: Record<string, number>, extra: Partial<LigneComptesBancaire> = {}): LigneComptesBancaire =>
  ({ periode, lignes_specifiques: v, sources_specifiques: Object.fromEntries(Object.keys(v).map((k) => [k, src])), ...extra });
const lecture = lireBanque(periodesDepuisLignes(
  [l('2026-S1', { pnb: 160e9, charges_exploitation: 72e9, cout_du_risque: 8e9 }, { resultat_net: 50e9 }), l('2025-S1', { pnb: 145e9, charges_exploitation: 70e9 }, { resultat_net: 45e9 })],
  [l('2026-S1', { credits_clientele: 3000e9, depots_clientele: 3800e9, ratio_solvabilite: 14.39 })],
), { annee: 2026, code: 'S1' })!;
const fait: Fait = { type: 'resultats', code: 'SGBC', cle: '2026-S1', dateFait: '2026-08-01', donnees: { lecture } };

describe('article de résultats bancaires', () => {
  const b = rediger(fait, { SGBC: 'SOCIETE GENERALE COTE D’IVOIRE' });
  const corps = assembler(b.sections, b.sources);

  it('chaque chiffre écrit est dans la liste blanche de Plume', () => {
    expect(assertNoForeignNumber(`${b.titre}\n${b.chapo}\n${corps}`, b.chiffres)).toBe(true);
  });
  it('vocabulaire bancaire, jamais « chiffre d’affaires »', () => {
    expect(`${b.titre} ${b.chapo} ${corps}`).not.toMatch(/chiffre d’affaires/i);
    expect(b.titre).toMatch(/PNB/);
  });
  it('les agrégats non publiés sont dits', () => {
    expect(corps).toMatch(/non publiés pour ce semestre/);
  });
  it('les sources sont les documents de la lecture', () => {
    expect(b.sources).toEqual([{ label: 'Rapport d’activités S1 2026', url: 'https://x/s1.pdf' }]);
    expect(b.slug).toBe('resultats-sgbc-2026-s1');
  });
  it('les verrous passent ; le type n’est pas automatique (a_valider)', () => {
    const v = verifier({ titre: b.titre, chapo: b.chapo, corps_md: corps, sources: b.sources, chiffres: b.chiffres }, fait, { aujourdhui: '2026-08-03', derniereSeance: '2026-08-03' });
    expect(v.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Lancer (échec attendu)**

Run: `cd C:\tmp\wt-banques\scraper; npx vitest run tests/resultatsBanque.test.ts`
Expected: FAIL — `'resultats'` absent de `TypeArticle`, rédaction inconnue.

- [ ] **Step 3: Types (`scraper/src/articles/types.ts`)**

Ajouter `| 'resultats'` à `TypeArticle` (sans l'ajouter à `TYPES_AUTOMATIQUES`), et compléter le commentaire de `TYPES_AUTOMATIQUES` : « `resultats` (banques, agrégats sourcés) passe par la validation ».

- [ ] **Step 4: Exporter `Plume` et `Outils` (`scraper/src/articles/redaction.ts`)**

- `class Plume {` → `export class Plume {`
- `interface Outils {` → `export interface Outils {`
- `type Corps = Omit<…>` → `export type Corps = Omit<Brouillon, 'slug' | 'chiffres'>;`
- Dans `PREFIXE`, ajouter `resultats: 'resultats',`.
- Import en tête : `import { resultatsBanque } from './resultatsBanque.js';`
- Dans `rediger`, remplacer la ligne `const corps = …` par :

```ts
  const corps =
    f.type === 'operation_titres' ? operation(f, o)
      : f.type === 'seance_hors_norme' ? seance(f, o)
        : f.type === 'resultats' ? resultatsBanque(f, o)
          : dividende(f, o);
```

`Source` est déjà exporté. `resultatsBanque.ts` n'importe de `redaction.ts` que des TYPES (`import type`), effacés à la compilation : aucun import circulaire à l'exécution.

- [ ] **Step 5: Écrire `scraper/src/articles/resultatsBanque.ts`**

```ts
/**
 * Article de résultats d'une BANQUE (spec agrégats bancaires §5) : il porte
 * sur les agrégats sourcés de la lecture bancaire (bank/pure/lecture.ts, copie
 * du module unique du frontend). Tout nombre écrit passe par Plume ; aucune
 * phrase de la lecture n'est recopiée (ses nombres ne sont pas dans la liste
 * blanche). Aucun verdict, aucune causalité.
 */
import type { LectureBancaire, LigneAgregat } from '../bank/pure/lecture.js';
import { avecArticle } from '../bank/pure/lecture.js';
import type { Corps, Outils, Source } from './redaction.js';
import type { Fait } from './types.js';

const sens = (v: number) => (v >= 0 ? 'hausse' : 'baisse');

export function resultatsBanque(f: Fait, o: Outils): Corps {
  const { p, nom } = o;
  const l = f.donnees.lecture as LectureBancaire;
  const art = p.nom(avecArticle(l.annee, l.code));
  const montant = (x: LigneAgregat, v: number) => (x.unite === 'pct' ? `${p.n(v, 2)} %` : p.fcfa(v));
  const evolution = (x: LigneAgregat) => {
    const c = x.precedent;
    if (!c || c.variation == null) return '';
    const unite = c.uniteVariation === 'pts' ? ` point${Math.abs(c.variation) >= 2 ? 's' : ''}` : ' %';
    return `, en ${sens(c.variation)} de ${p.n(Math.abs(c.variation), 1)}${unite} sur ${p.nom(c.libelle)} (${montant(x, c.valeur)})`;
  };
  // Libellés passés par p.nom : « Ratio CET1 », « Tier 1 » portent un chiffre qui est de la donnée.
  const puce = (x: LigneAgregat) => `- **${p.nom(x.libelle)}** : ${montant(x, x.valeur.valeur)}${evolution(x)}.`;

  const c = l.constat;
  const debut = c.pnb
    ? c.pnb.variation != null ? `PNB en ${sens(c.pnb.variation)} de ${p.n(Math.abs(c.pnb.variation), 1)} % sur ${art}` : `PNB de ${p.fcfa(c.pnb.valeur)} sur ${art}`
    : `Comptes bancaires : ${art}`;
  const s = c.second;
  const suite = s
    ? s.cle === 'coefficient_exploitation'
      ? `, coefficient d’exploitation à ${p.n(s.valeur * 100, 1)} %`
      : `, ${s.cle === 'cout_du_risque' ? 'coût du risque' : 'résultat net'} en ${sens(s.variation)} de ${p.n(Math.abs(s.variation), 1)} %`
    : '';
  const titre = `${nom} : ${debut}${suite}`;

  const rn = l.compteResultat.find((x) => x.cle === 'resultat_net');
  const chapo = `${nom} publie ses comptes ${art}${rn ? ` : résultat net de ${p.fcfa(rn.valeur.valeur)}${evolution(rn)}` : ''}.`;

  const sections = [
    { titre: 'Compte de résultat', texte: l.compteResultat.map(puce).join('\n') },
    ...(l.encours.length ? [{ titre: 'Encours et solidité', texte: l.encours.map(puce).join('\n') }] : []),
    ...(l.ratios.length ? [{
      titre: 'Ratios calculés par WESTBOURSE',
      texte: l.ratios.map((r) => `- **${p.nom(r.libelle)}** : ${p.n(r.valeur * 100, 1)} %${r.mention ? ` (${p.nom(r.mention)})` : ''}.`).join('\n'),
    }] : []),
    ...(l.mentionNonPublies ? [{ titre: 'Ce que le document ne publie pas', texte: p.nom(l.mentionNonPublies) }] : []),
  ];
  const sources: Source[] = l.sources.map((x) => ({ label: x.document_libelle ?? 'Document publié', url: x.document_url }));
  const image = c.pnb
    ? { chiffre: c.pnb.variation != null ? `${c.pnb.variation >= 0 ? '+' : '−'}${p.n(Math.abs(c.pnb.variation), 1)} %` : p.fcfa(c.pnb.valeur), legende: `${nom} · PNB ${p.nom(l.libelle)}` }
    : { chiffre: p.nom(String(l.annee)), legende: `${nom} · comptes ${p.nom(l.libelle)}` };
  return { titre, chapo, sections, sources, image };
}
```

`p.nom()` inscrit dans la liste blanche les nombres d'un texte issu de la donnée (année, « ×2 », « 12 » de « douze » n'en est pas un) : c'est ce qui permet de citer la mention d'annualisation et la période sans fabriquer de chiffre étranger.

- [ ] **Step 6: Détection dans `runArticles.ts`**

Imports :

```ts
import { chargerPeriodesBancaires } from '../bank/chargerPeriodes.js';
import { lireBanque, lirePeriode } from '../bank/pure/lecture.js';
```

Après `const faits = detecter(ctx, divs, operations);`, ajouter :

```ts
  // Résultats bancaires : un PNB nouvellement RETENU par la sélection des
  // agrégats (trace correction_champ des 3 derniers jours) fait un article.
  const { data: retenus, error: eRet } = await sb.from('correction_champ')
    .select('code,periode,corrige_le')
    .eq('corrige_par', 'selection-agregats').eq('champ', 'lignes_specifiques.pnb').not('valeur_apres', 'is', null)
    .gte('corrige_le', `${decaler(aujourdhui, -3)}T00:00:00Z`);
  if (eRet) throw new Error(`correction_champ (résultats bancaires) : ${eRet.message}`);
  const vus = new Set<string>();
  for (const r of (retenus ?? []) as { code: string; periode: string; corrige_le: string }[]) {
    const visee = lirePeriode(r.periode);
    if (!visee || vus.has(`${r.code}|${r.periode}`)) continue;
    vus.add(`${r.code}|${r.periode}`);
    const lecture = lireBanque(await chargerPeriodesBancaires(r.code), visee);
    if (!lecture?.extrait || !lecture.constat.pnb) continue;
    faits.push({ type: 'resultats', code: r.code, cle: r.periode, dateFait: r.corrige_le.slice(0, 10), donnees: { lecture } });
  }
  res.detectes = faits.length;
```

(supprimer la ligne `res.detectes = faits.length;` qui précédait). `cleFait` donne `resultats|SGBC|2026-S1` : un même semestre ne produit jamais deux articles. Le verrou `fraicheur` lit la dernière séance, pas la date du fait : il passe.

- [ ] **Step 7: Tests et typecheck**

Run: `cd C:\tmp\wt-banques\scraper; npx vitest run tests/resultatsBanque.test.ts tests/articles.test.ts; npx tsc -p tsconfig.json --noEmit`
Expected: PASS (5 nouveaux tests, les tests d'articles existants inchangés), typecheck vert.

- [ ] **Step 8: Essai à blanc**

Run: `cd C:\tmp\wt-banques\scraper; $env:DRY_RUN='true'; $env:USE_MOCK='false'; npx tsx src/index.ts articles`
Expected: journal `DRY_RUN — article non écrit` ; avant la PR 3, aucun fait `resultats` (aucune trace `selection-agregats`) — c'est attendu. Après la PR 3, les semestres retenus des trois derniers jours apparaissent en `statut: a_valider`.

- [ ] **Step 9: Commit**

```bash
git -C C:\tmp\wt-banques add scraper/src/articles scraper/tests/resultatsBanque.test.ts
git -C C:\tmp\wt-banques commit -m "feat(articles): article de résultats bancaires, chiffres par Plume, validation humaine"
```

---

### Task 9: Test de cohérence entre les quatre surfaces

**Files:**
- Modify: `frontend/lib/bank/coherence.test.ts`
- Create: `scraper/tests/lectureBancaireCopie.test.ts`

- [ ] **Step 1: Compléter `frontend/lib/bank/coherence.test.ts`**

Ajouter à la fin du fichier :

```ts
import { periodesDepuisLignes, lireBanque, type LigneComptesBancaire } from './lecture';
import { appliquerLecture } from './lectureKpis';
import { trajectoireBancaire, etapesCascade } from './dossierBancaire';
import type { BankKpis } from './kpis';

const s = { document_url: 'https://x/a.pdf', document_libelle: 'États financiers 2025', page: 12, perimetre: 'individuel' as const };
const lg = (periode: string, v: Record<string, number>, extra: Partial<LigneComptesBancaire> = {}): LigneComptesBancaire =>
  ({ periode, lignes_specifiques: v, sources_specifiques: Object.fromEntries(Object.keys(v).map((k) => [k, s])), ...extra });

/** Trois banques témoins : complète, partielle, sans extraction. */
const BANQUES: Record<string, { income: LigneComptesBancaire[]; balance: LigneComptesBancaire[] }> = {
  SGBC: {
    income: [lg('2025', { pnb: 300e9, charges_exploitation: 150e9, resultat_brut_exploitation: 150e9, cout_du_risque: 20e9 }, { resultat_net: 95e9 }), lg('2024', { pnb: 280e9 }, { resultat_net: 80e9 })],
    balance: [lg('2025', { credits_clientele: 2900e9, depots_clientele: 3600e9, fonds_propres: 600e9, ratio_solvabilite: 14.39 })],
  },
  SIBC: { income: [lg('2025', { pnb: 120e9 }, { resultat_net: 40e9 })], balance: [] },
  CBIBF: { income: [{ periode: '2025', lignes_specifiques: { pnb: 90e9 }, sources_specifiques: null, resultat_net: 30e9 }], balance: [] },
};

describe('cohérence : le même chiffre sur chaque surface', () => {
  for (const [code, b] of Object.entries(BANQUES)) {
    it(code, () => {
      const periodes = periodesDepuisLignes(b.income, b.balance);
      const visee = { annee: 2025, code: 'exercice' as const };
      // Revue (période principale = exercice 2025), fiche, financials, dossier : même appel, même résultat.
      const revue = lireBanque(periodes, visee);
      const fiche = lireBanque(periodes, visee);
      expect(fiche).toEqual(revue);
      const pnbLecture = revue?.extrait ? revue.compteResultat.find((x) => x.cle === 'pnb')?.valeur.valeur ?? null : null;
      // Dossier : la trajectoire porte le PNB retenu de la lecture.
      const traj = trajectoireBancaire([{ exercice: '2025', chiffre_affaires: 1, resultat_net: 1 }], periodes.filter((p) => p.code === 'exercice').map((p) => ({ exercice: String(p.annee), pnb: p.valeurs.pnb?.source ? p.valeurs.pnb.valeur : null })));
      expect(traj[0]!.chiffre_affaires).toBe(pnbLecture ?? 1);
      // Carte bancaire : même coefficient que la lecture.
      const coef = revue?.ratios.find((r) => r.cle === 'coefficient_exploitation')?.valeur ?? null;
      const k = appliquerLecture({ costIncome: 0.99, transformation: null, ratioSolvabilite: null } as unknown as BankKpis, revue?.extrait ? revue : null);
      expect(k.costIncome).toBe(coef ?? 0.99);
      // Dossier, cascade : PNB et résultat net identiques à la lecture.
      const casc = revue?.extrait ? etapesCascade(revue) : null;
      if (casc) {
        expect(casc[0]!.fin).toBe(pnbLecture);
        expect(casc.at(-1)!.fin).toBe(revue!.compteResultat.find((x) => x.cle === 'resultat_net')!.valeur.valeur);
      }
    });
  }

  it('aucune surface ne recalcule : chacune passe par lireBanque', () => {
    for (const f of [
      'frontend/app/actions/[code]/revue/page.tsx',
      'frontend/app/societes/[code]/page.tsx',
      'frontend/app/actions/[code]/financials/page.tsx',
      'frontend/lib/dossier/build.ts',
      'scraper/src/articles/runArticles.ts',
    ]) {
      const t = lire(f);
      expect(t, f).toContain('lireBanque(');
      expect(t, f).not.toMatch(/charges_exploitation\s*\/|\/\s*[a-zA-Z.?]*pnb\b/);
    }
  });
});
```

- [ ] **Step 2: Test miroir côté scraper `scraper/tests/lectureBancaireCopie.test.ts`**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as copie from '../src/bank/pure/lecture.js';

describe('copie scraper de la lecture bancaire', () => {
  it('identique au module du frontend', () => {
    const a = readFileSync(new URL('../src/bank/pure/lecture.ts', import.meta.url), 'utf8');
    const b = readFileSync(new URL('../../frontend/lib/bank/lecture.ts', import.meta.url), 'utf8');
    expect(a).toBe(b);
  });
  it('donne le même résultat qu’au frontend sur un exemple', () => {
    const s = { document_url: 'u', document_libelle: 'd', page: 1, perimetre: 'individuel' as const };
    const p = copie.periodesDepuisLignes([{ periode: '2025', lignes_specifiques: { pnb: 300e9, charges_exploitation: 150e9 }, sources_specifiques: { pnb: s, charges_exploitation: s }, resultat_net: 95e9 }], []);
    expect(copie.lireBanque(p, { annee: 2025, code: 'exercice' })!.ratios[0]!.valeur).toBe(0.5);
  });
});
```

- [ ] **Step 3: Lancer**

Run: `cd C:\tmp\wt-banques\frontend; npx vitest run lib/bank; cd C:\tmp\wt-banques\scraper; npx vitest run tests/lectureBancaireCopie.test.ts`
Expected: PASS. Si le test statique signale une division sur `pnb` dans une surface, déplacer ce calcul dans `lib/bank/lecture.ts`.

- [ ] **Step 4: Suites complètes**

Run: `cd C:\tmp\wt-banques\frontend; npm test; npx tsc --noEmit -p tsconfig.json; npm run build; cd C:\tmp\wt-banques\scraper; npm test; npm run typecheck`
Expected: tout vert.

- [ ] **Step 5: Commit et PR**

```bash
git -C C:\tmp\wt-banques add frontend/lib/bank/coherence.test.ts scraper/tests/lectureBancaireCopie.test.ts
git -C C:\tmp\wt-banques commit -m "test(banques): même chiffre sur la Revue, la fiche, le dossier et les articles"
```

Ouvrir la PR 2 « Agrégats bancaires 2/3 : affichage » avec les captures de la Revue, de la fiche et du dossier (SGBC, SIBC, CBIBF) et la sortie de `dossiers.mjs` (3 rangés, 0 échec, dry).
