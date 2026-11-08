# Fiche action en quatre chapitres — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Réorganiser `/actions/[code]` en quatre chapitres sans retirer d'information, avec une source unique pour chaque chiffre, et aligner les cinq sous-parties (revue, états financiers, dossier A4, publications, Quant).

**Architecture:** Un module pur `frontend/lib/fiche/` (testé avec vitest) calcule les valeurs partagées : plages, règles d'affichage, lecture technique, flux comptables. La page serveur `app/actions/[code]/page.tsx` garde ses requêtes et compose des composants de chapitre dans `components/fiche/`. Les sous-pages lisent les mêmes fonctions.

**Tech Stack:** Next 14 App Router (Server Components), TypeScript strict, Tailwind (jetons `--color-*`), vitest (`lib/**/*.test.ts`), ECharts existant pour le graphique de cours, SVG serveur pour les nouveaux graphiques.

**Spec :** `docs/superpowers/specs/2026-11-08-fiche-action-chapitres-design.md`. Maquette : https://claude.ai/artifact/7JfL1N5m9BdzS3rHB7xSGJ (v12, note « Inventaire » = liste de contrôle).

**Règles du dépôt :** pas de `loading.tsx` au-dessus de `/actions/[code]` ; libellés de signal via `lib/signalLabel.ts` ; aucun chiffre inventé ; chaque bloc gère l'état vide ; dossier A4 : ni taille, ni marge, ni hauteur de feuille modifiée.

---

## Carte des fichiers

| Fichier | Rôle |
|---|---|
| `frontend/lib/fiche/plages.ts` (créer) | Plages 1 j / 52 sem. / 2 ans sur fenêtre datée |
| `frontend/lib/fiche/affichage.ts` (créer) | PER, distribution, évolution du résultat, hors exploitation, dividende courant, détection volume, ligne de verdict, synthèse d'exercice, titre de publication |
| `frontend/lib/fiche/lecture.ts` (créer) | Lecture technique unique : soutient / retient / neutres |
| `frontend/lib/fiche/flux.ts` (créer) | Flux du compte de résultat équilibrés |
| `frontend/lib/fiche/*.test.ts` (créer) | Tests vitest |
| `frontend/components/fiche/Chapitre.tsx`, `Essentiel.tsx`, `JaugesPlage.tsx`, `SeanceIntraday.tsx`, `LectureTechnique.tsx`, `CombinedAlphaCarte.tsx`, `FluxComptable.tsx` (créer) | Composants de la fiche |
| `frontend/components/actions/VerdictBand.tsx` (modifier) | Note A–F en grand, libellé et score corrects |
| `frontend/components/actions/FicheStickyNav.tsx` (modifier) | Chapitres + documents |
| `frontend/app/actions/[code]/page.tsx` (modifier) | Correctifs puis composition en chapitres |
| `frontend/components/fundamentals/FundamentalsPanel.tsx` (modifier) | PER / distribution affichables |
| `frontend/app/actions/[code]/financials/page.tsx`, `revue/page.tsx`, `quant/page.tsx`, `rapport/page.tsx` (modifier) | Sous-pages |
| `frontend/app/rapports/dossier/[code]/page.tsx`, `frontend/lib/dossier/narratif.ts` (modifier) | Dossier A4 |
| `frontend/components/PublicationsModal.tsx` (modifier) | Publications |

---

### Task 1 : Plages de cours sur fenêtre datée

**Files:** Create `frontend/lib/fiche/plages.ts` · Test `frontend/lib/fiche/plages.test.ts`

- [ ] **Step 1 : test qui échoue**

```ts
import { describe, it, expect } from 'vitest';
import { plageSurFenetre } from './plages';

const rows = [
  { date_marche: '2024-12-26', cours_jour: 405 },
  { date_marche: '2025-11-06', cours_jour: 925 },
  { date_marche: '2025-11-07', cours_jour: 975 },
  { date_marche: '2026-04-08', cours_jour: 3895 },
  { date_marche: '2026-05-01', cours_jour: 0 },
  { date_marche: '2026-11-06', cours_jour: 1950 },
];

describe('plageSurFenetre', () => {
  it('52 semaines : fenêtre de 365 jours inclusive (STAC : 925, pas 405)', () => {
    const p = plageSurFenetre(rows, '2026-11-06', 365, 1950)!;
    expect(p.bas).toBe(925);
    expect(p.dateBas).toBe('2025-11-06');
    expect(p.haut).toBe(3895);
    expect(p.dateHaut).toBe('2026-04-08');
    expect(p.position).toBeCloseTo((1950 - 925) / (3895 - 925), 4);
  });
  it('2 ans : reprend le plus bas de décembre 2024', () => {
    expect(plageSurFenetre(rows, '2026-11-06', 730, 1950)!.bas).toBe(405);
  });
  it('ignore les zéros et rend null sans donnée', () => {
    expect(plageSurFenetre([{ date_marche: '2026-11-06', cours_jour: 0 }], '2026-11-06', 365, 1950)).toBeNull();
  });
});
```

- [ ] **Step 2 :** `cd frontend && npx vitest run lib/fiche/plages.test.ts` → FAIL (import introuvable).
- [ ] **Step 3 : implémentation**

```ts
/** Plage de cours sur N jours calendaires, bornes incluses. Zéros et nuls écartés : un zéro en base est un trou de collecte. */
export interface Plage { bas: number; dateBas: string | null; haut: number; dateHaut: string | null; position: number | null }

export function plageSurFenetre(
  rows: { date_marche: string; cours_jour: number | null }[],
  dateRef: string,
  jours: number,
  cours: number | null,
): Plage | null {
  const debut = new Date(dateRef + 'T00:00:00Z');
  debut.setUTCDate(debut.getUTCDate() - jours);
  const borne = debut.toISOString().slice(0, 10);
  const utiles = rows.filter((r) => r.date_marche >= borne && r.date_marche <= dateRef && r.cours_jour != null && r.cours_jour > 0);
  if (utiles.length === 0) return null;
  let b = utiles[0]!, h = utiles[0]!;
  for (const r of utiles) {
    if (r.cours_jour! < b.cours_jour!) b = r;
    if (r.cours_jour! > h.cours_jour!) h = r;
  }
  const bas = b.cours_jour!, haut = h.cours_jour!;
  const position = cours != null && haut > bas ? (cours - bas) / (haut - bas) : null;
  return { bas, dateBas: b.date_marche, haut, dateHaut: h.date_marche, position };
}

/** Plage d'une séance (plus bas / plus haut publiés), sans dates. */
export function plageSeance(bas: number | null, haut: number | null, cours: number | null): Plage | null {
  if (bas == null || haut == null || bas <= 0 || haut <= 0) return null;
  return { bas, dateBas: null, haut, dateHaut: null, position: cours != null && haut > bas ? (cours - bas) / (haut - bas) : null };
}
```

- [ ] **Step 4 :** relancer → 3 PASS.
- [ ] **Step 5 :** `git add frontend/lib/fiche/plages* && git commit -m "feat(fiche): plages de cours sur fenêtre datée inclusive"`

---

### Task 2 : Règles d'affichage partagées

**Files:** Create `frontend/lib/fiche/affichage.ts` · Test `frontend/lib/fiche/affichage.test.ts`

- [ ] **Step 1 : test qui échoue**

```ts
import { describe, it, expect } from 'vitest';
import {
  perAffichable, distributionAffichable, evolutionResultat, horsExploitation,
  dividendeCourant, volumeAuDessusMoyenne, ligneVerdict, syntheseExercice, titrePublication,
} from './affichage';

const sp = (s: string | null) => s?.replace(/ | /g, ' ') ?? null;

describe('perAffichable', () => {
  it('non calculable si BPA ≤ 0', () => expect(perAffichable(-271.42, -7.18)).toEqual({ valeur: null, motif: 'non calculable, perte' }));
  it('rend le PER si BPA > 0', () => expect(perAffichable(12.3, 40)).toEqual({ valeur: 12.3, motif: null }));
});

describe('distributionAffichable', () => {
  it('sans objet si résultat ≤ 0', () => expect(distributionAffichable(-9.207, -96.6e6)).toEqual({ valeur: null, motif: 'sans objet, perte' }));
  it('rend la valeur si bénéfice', () => expect(distributionAffichable(0.4, 1e9)).toEqual({ valeur: 0.4, motif: null }));
});

describe('evolutionResultat', () => {
  it('perte réduite', () => expect(sp(evolutionResultat(-96.6e6, -348.2e6))).toBe('perte réduite de 72,3 %'));
  it('perte aggravée', () => expect(sp(evolutionResultat(-200e6, -100e6))).toBe('perte aggravée de 100,0 %'));
  it('changements de signe', () => {
    expect(evolutionResultat(10e6, -5e6)).toBe('retour au bénéfice');
    expect(evolutionResultat(-5e6, 10e6)).toBe('passage en perte');
  });
  it('variation signée', () => expect(sp(evolutionResultat(120, 100))).toBe('+20,0 %'));
  it('null sans exercice précédent', () => expect(evolutionResultat(10, null)).toBeNull());
});

describe('horsExploitation', () => {
  it('STAC 2025 : 776,3 M', () => expect(horsExploitation(4.3e6, -772.0e6)).toBeCloseTo(776.3e6, -4));
  it('null si un terme manque', () => expect(horsExploitation(null, -1)).toBeNull());
});

describe('dividendeCourant', () => {
  it('marque ancien un dividende de plus d’un exercice', () => {
    expect(dividendeCourant([{ montant: 66.15, exercice: 2021, ex_date: null, payment_date: '2022-07-18' }], 2025))
      .toMatchObject({ montant: 66.15, exercice: 2021, ancien: true });
  });
  it('courant', () => expect(dividendeCourant([{ montant: 100, exercice: 2025, ex_date: '2026-06-01', payment_date: null }], 2025)!.ancien).toBe(false));
  it('ignore les montants nuls', () => expect(dividendeCourant([{ montant: 0, exercice: 2025, ex_date: null, payment_date: null }], 2025)).toBeNull());
});

describe('volumeAuDessusMoyenne', () => {
  it('faux à 0,3× (STAC 6 nov.)', () => expect(volumeAuDessusMoyenne(1551, 4782)).toBe(false));
  it('vrai au-dessus', () => expect(volumeAuDessusMoyenne(5000, 4782)).toBe(true));
  it('faux sans moyenne', () => expect(volumeAuDessusMoyenne(5000, null)).toBe(false));
});

describe('ligneVerdict', () => {
  it('libellé français, score à deux décimales', () => expect(ligneVerdict('HOLD', 0.4412, 5.41)).toBe('Signal Attente · score 0,44. Séance en hausse de 5,41 %.'));
  it('baisse', () => expect(ligneVerdict('SELL', -0.7, -2)).toBe('Signal Vente · score −0,70. Séance en baisse de 2,00 %.'));
  it('null sans signal', () => expect(ligneVerdict(null, null, 1)).toBeNull());
});

describe('syntheseExercice', () => {
  it('STAC 2025', () => {
    expect(syntheseExercice({ croissanceCaPct: 116.3, evolution: 'perte réduite de 72,3 %', resultatExploitation: -772e6, horsExpl: 776.3e6 }))
      .toBe("Le chiffre d'affaires a plus que doublé et la perte se réduit, mais l'exploitation reste déficitaire et le résultat dépend de produits hors exploitation.");
  });
  it('null sans donnée', () => expect(syntheseExercice({ croissanceCaPct: null, evolution: null, resultatExploitation: null, horsExpl: null })).toBeNull());
});

describe('titrePublication', () => {
  it('harmonise les graphies BRVM', () => {
    expect(titrePublication('Etats Financiers exercice 2020 - SETAO CI')).toBe('États financiers exercice 2020 - SETAO CI');
    expect(titrePublication('Etats financiers - Exercice 2017: SETAO CI')).toBe('États financiers - Exercice 2017 · SETAO CI');
  });
});
```

- [ ] **Step 2 :** `npx vitest run lib/fiche/affichage.test.ts` → FAIL.
- [ ] **Step 3 : implémentation**

```ts
import { libelleSignal } from '@/lib/signalLabel';

const nf = (x: number, d: number) => x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const moins = (s: string) => s.replace('-', '−'); // U+2212, comme le reste du site

export interface Affichable { valeur: number | null; motif: string | null }

export function perAffichable(per: number | null, bpa: number | null): Affichable {
  if (bpa != null && bpa <= 0) return { valeur: null, motif: 'non calculable, perte' };
  if (per == null) return { valeur: null, motif: 'non disponible' };
  return { valeur: per, motif: null };
}

export function distributionAffichable(payout: number | null, resultatNet: number | null): Affichable {
  if (resultatNet != null && resultatNet <= 0) return { valeur: null, motif: 'sans objet, perte' };
  if (payout == null) return { valeur: null, motif: 'non disponible' };
  return { valeur: payout, motif: null };
}

export function evolutionResultat(n: number | null, n1: number | null): string | null {
  if (n == null || n1 == null || n1 === 0) return null;
  if (n < 0 && n1 < 0) {
    const r = (Math.abs(Math.abs(n) - Math.abs(n1)) / Math.abs(n1)) * 100;
    return `${Math.abs(n) < Math.abs(n1) ? 'perte réduite' : 'perte aggravée'} de ${nf(r, 1)} %`;
  }
  if (n >= 0 && n1 < 0) return 'retour au bénéfice';
  if (n < 0 && n1 > 0) return 'passage en perte';
  const v = ((n - n1) / n1) * 100;
  return `${v >= 0 ? '+' : '−'}${nf(Math.abs(v), 1)} %`;
}

export function horsExploitation(resultatAvantImpot: number | null, resultatExploitation: number | null): number | null {
  if (resultatAvantImpot == null || resultatExploitation == null) return null;
  return resultatAvantImpot - resultatExploitation;
}

export interface DividendeLigne { montant: number; exercice: number | null; ex_date: string | null; payment_date: string | null }
export interface DividendeCourant extends DividendeLigne { ancien: boolean }

/** Dernier dividende > 0. « ancien » : son exercice précède le dernier exercice publié de plus d'un an. */
export function dividendeCourant(lignes: DividendeLigne[], dernierExercice: number | null): DividendeCourant | null {
  const d = lignes.find((l) => l.montant > 0);
  if (!d) return null;
  return { ...d, ancien: dernierExercice != null && d.exercice != null && dernierExercice - d.exercice > 1 };
}

export function volumeAuDessusMoyenne(volume: number | null, moyenne: number | null): boolean {
  return volume != null && moyenne != null && moyenne > 0 && volume > moyenne;
}

export function ligneVerdict(signal: string | null, score: number | null, variationPct: number | null): string | null {
  if (!signal) return null;
  const s = score != null ? ` · score ${moins(nf(score, 2))}` : '';
  const v = variationPct ?? 0;
  return `Signal ${libelleSignal(signal)}${s}. Séance en ${v >= 0 ? 'hausse' : 'baisse'} de ${nf(Math.abs(v), 2)} %.`;
}

/** Synthèse d'un exercice construite uniquement sur quatre valeurs déjà affichées. */
export function syntheseExercice(p: { croissanceCaPct: number | null; evolution: string | null; resultatExploitation: number | null; horsExpl: number | null }): string | null {
  const morceaux: string[] = [];
  if (p.croissanceCaPct != null) morceaux.push(p.croissanceCaPct >= 100 ? "le chiffre d'affaires a plus que doublé" : p.croissanceCaPct >= 0 ? "le chiffre d'affaires progresse" : "le chiffre d'affaires recule");
  if (p.evolution) morceaux.push(p.evolution.startsWith('perte réduite') ? 'la perte se réduit' : p.evolution);
  let s = morceaux.join(' et ');
  if (p.resultatExploitation != null && p.resultatExploitation < 0 && p.horsExpl != null && p.horsExpl > 0) {
    s += (s ? ', mais ' : '') + "l'exploitation reste déficitaire et le résultat dépend de produits hors exploitation";
  }
  return s ? s.charAt(0).toUpperCase() + s.slice(1) + '.' : null;
}

/** Harmonise à l'affichage les graphies variées de la BRVM. Le document source n'est pas touché. */
export function titrePublication(t: string): string {
  return t
    .replace(/\bEtats Financiers\b/gi, 'États financiers')
    .replace(/\bEtats\b/g, 'États')
    .replace(/\s*:\s+/g, ' · ')
    .replace(/\s+/g, ' ')
    .trim();
}
```

- [ ] **Step 4 :** relancer → PASS.
- [ ] **Step 5 :** `git add frontend/lib/fiche/affichage* && git commit -m "feat(fiche): règles d'affichage partagées"`

---

### Task 3 : Lecture technique unique

**Files:** Create `frontend/lib/fiche/lecture.ts` · Test `frontend/lib/fiche/lecture.test.ts`

- [ ] **Step 1 : test**

```ts
import { describe, it, expect } from 'vitest';
import { lectureTechnique } from './lecture';

describe('lectureTechnique (STAC 6 nov. 2026)', () => {
  const l = lectureTechnique({ cours: 1950, variationPct: 5.41, ma20: 1911, ma50: 2187.7, ma200: 2531.8, macd: -85.4, macdSignal: -111.27, rsi: 48.1, volume: 1551, volumeMoyen: 4782 });
  it('classe les facteurs sans contradiction', () => {
    expect(l.soutient).toEqual(['Forte hausse du jour, +5,41 %', 'Cours au-dessus de sa moyenne 20 séances', 'MACD au-dessus de son signal']);
    expect(l.retient).toEqual(['Moyennes 20, 50, 200 en ordre baissier', 'MACD sous zéro', 'Volume sous la moyenne (0,3×)']);
    expect(l.neutres).toEqual(['RSI 48 en zone neutre']);
  });
  it('vide sans données', () => {
    expect(lectureTechnique({ cours: null, variationPct: null, ma20: null, ma50: null, ma200: null, macd: null, macdSignal: null, rsi: null, volume: null, volumeMoyen: null }))
      .toEqual({ soutient: [], retient: [], neutres: [] });
  });
});
```

- [ ] **Step 2 :** FAIL attendu.
- [ ] **Step 3 : implémentation**

```ts
export interface EntreesLecture {
  cours: number | null; variationPct: number | null;
  ma20: number | null; ma50: number | null; ma200: number | null;
  macd: number | null; macdSignal: number | null; rsi: number | null;
  volume: number | null; volumeMoyen: number | null;
}
export interface Lecture { soutient: string[]; retient: string[]; neutres: string[] }

const f = (x: number, d: number) => x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/ | /g, ' ');

/** Une seule lecture : remplace jauge, analyse technique, signal et « lecture baissière », qui se contredisaient. */
export function lectureTechnique(e: EntreesLecture): Lecture {
  const soutient: string[] = [], retient: string[] = [], neutres: string[] = [];
  if (e.variationPct != null && Math.abs(e.variationPct) >= 2) {
    const h = e.variationPct > 0;
    (h ? soutient : retient).push(`Forte ${h ? 'hausse' : 'baisse'} du jour, ${h ? '+' : '−'}${f(Math.abs(e.variationPct), 2)} %`);
  }
  if (e.cours != null && e.ma20 != null) (e.cours >= e.ma20 ? soutient : retient).push(`Cours ${e.cours >= e.ma20 ? 'au-dessus' : 'en dessous'} de sa moyenne 20 séances`);
  if (e.macd != null && e.macdSignal != null) (e.macd >= e.macdSignal ? soutient : retient).push(`MACD ${e.macd >= e.macdSignal ? 'au-dessus' : 'en dessous'} de son signal`);
  if (e.ma20 != null && e.ma50 != null && e.ma200 != null) {
    if (e.ma20 < e.ma50 && e.ma50 < e.ma200) retient.push('Moyennes 20, 50, 200 en ordre baissier');
    else if (e.ma20 > e.ma50 && e.ma50 > e.ma200) soutient.push('Moyennes 20, 50, 200 en ordre haussier');
  }
  if (e.macd != null) (e.macd >= 0 ? soutient : retient).push(`MACD ${e.macd >= 0 ? 'au-dessus de' : 'sous'} zéro`);
  if (e.volume != null && e.volumeMoyen != null && e.volumeMoyen > 0) {
    const r = e.volume / e.volumeMoyen;
    (r < 1 ? retient : soutient).push(`Volume ${r < 1 ? 'sous' : 'au-dessus de'} la moyenne (${f(r, 1)}×)`);
  }
  if (e.rsi != null) {
    const r = Math.round(e.rsi);
    if (e.rsi < 30) soutient.push(`RSI ${r}, zone de survente`);
    else if (e.rsi > 70) retient.push(`RSI ${r}, zone de surachat`);
    else neutres.push(`RSI ${r} en zone neutre`);
  }
  return { soutient, retient, neutres };
}
```

- [ ] **Step 4 :** PASS.
- [ ] **Step 5 :** `git add frontend/lib/fiche/lecture* && git commit -m "feat(fiche): lecture technique unique"`

---

### Task 4 : Flux du compte de résultat

**Files:** Create `frontend/lib/fiche/flux.ts` · Test `frontend/lib/fiche/flux.test.ts`

- [ ] **Step 1 : test**

```ts
import { describe, it, expect } from 'vitest';
import { fluxCompteResultat } from './flux';

describe('fluxCompteResultat (STAC 2025, millions)', () => {
  const f = fluxCompteResultat({ chiffreAffaires: 3880, resultatExploitation: -772, resultatAvantImpot: 4.3, resultatNet: -96.6 })!;
  const r1 = (x: number) => Math.round(x * 10) / 10;
  it('équilibre ressources et emplois', () => {
    expect(f.ressources.reduce((a, n) => a + n.valeur, 0)).toBeCloseTo(f.emplois.reduce((a, n) => a + n.valeur, 0), 6);
  });
  it('nœuds attendus', () => {
    expect(f.ressources.map((n) => [n.cle, r1(n.valeur)])).toEqual([['chiffreAffaires', 3880], ['horsExploitation', 776.3], ['perte', 96.6]]);
    expect(f.emplois.map((n) => [n.cle, r1(n.valeur)])).toEqual([['chargesExploitation', 4652], ['impot', 100.9]]);
  });
  it('null si un poste manque', () => {
    expect(fluxCompteResultat({ chiffreAffaires: 3880, resultatExploitation: null, resultatAvantImpot: 4.3, resultatNet: -96.6 })).toBeNull();
  });
  it('bénéficiaire : le bénéfice est un emploi', () => {
    const b = fluxCompteResultat({ chiffreAffaires: 1000, resultatExploitation: 200, resultatAvantImpot: 180, resultatNet: 150 })!;
    expect(b.emplois.map((n) => n.cle)).toEqual(['chargesExploitation', 'horsExploitation', 'impot', 'benefice']);
  });
});
```

- [ ] **Step 2 :** FAIL attendu.
- [ ] **Step 3 : implémentation**

```ts
export interface Noeud { cle: string; libelle: string; valeur: number }
export interface FluxCR { ressources: Noeud[]; emplois: Noeud[]; total: number }

/**
 * Ressources = CA + hors exploitation positif + perte (+ produit d'impôt) ;
 * emplois = charges d'exploitation (CA − résultat d'exploitation) + hors exploitation négatif + impôt + bénéfice.
 * Quatre postes publiés suffisent ; un poste manquant → null, jamais un flux estimé.
 */
export function fluxCompteResultat(p: { chiffreAffaires: number | null; resultatExploitation: number | null; resultatAvantImpot: number | null; resultatNet: number | null }): FluxCR | null {
  const { chiffreAffaires: ca, resultatExploitation: re, resultatAvantImpot: rai, resultatNet: rn } = p;
  if (ca == null || re == null || rai == null || rn == null) return null;
  const hors = rai - re, impot = rai - rn;
  const ressources: Noeud[] = [{ cle: 'chiffreAffaires', libelle: "Chiffre d'affaires", valeur: ca }];
  const emplois: Noeud[] = [{ cle: 'chargesExploitation', libelle: "Charges d'exploitation", valeur: ca - re }];
  (hors >= 0 ? ressources : emplois).push({ cle: 'horsExploitation', libelle: 'Hors exploitation', valeur: Math.abs(hors) });
  if (impot >= 0) emplois.push({ cle: 'impot', libelle: 'Impôt', valeur: impot });
  else ressources.push({ cle: 'impot', libelle: "Produit d'impôt", valeur: -impot });
  if (rn < 0) ressources.push({ cle: 'perte', libelle: "Perte de l'exercice", valeur: -rn });
  else emplois.push({ cle: 'benefice', libelle: "Bénéfice de l'exercice", valeur: rn });
  return { ressources, emplois, total: ressources.reduce((a, n) => a + n.valeur, 0) };
}
```

- [ ] **Step 4 :** PASS.
- [ ] **Step 5 :** `git add frontend/lib/fiche/flux* && git commit -m "feat(fiche): flux du compte de résultat équilibrés"`

---

### Task 5 : Correctifs immédiats sur l'existant

**Files:** Modify `frontend/app/actions/[code]/page.tsx` (verdict ~l.592-597, détections ~l.609-618, `range52` ~l.1167-1174), `frontend/components/fundamentals/FundamentalsPanel.tsx`, `frontend/app/actions/[code]/rapport/page.tsx:19`, `frontend/app/actions/[code]/quant/page.tsx:7`

- [ ] **Step 1 : verdict** — remplacer la construction de `verdictLine` :

```ts
import { ligneVerdict, volumeAuDessusMoyenne, perAffichable, distributionAffichable } from '@/lib/fiche/affichage';
import { plageSurFenetre } from '@/lib/fiche/plages';
const verdictLine = ligneVerdict(signal?.signal ?? null, signal?.score_total ?? null, last.variation_pct ?? null);
```

- [ ] **Step 2 : détection volume** — l'entrée devient `{ label: 'Volume > moyenne', ok: volumeAuDessusMoyenne(last.volume ?? null, volMoyen) }`.
- [ ] **Step 3 : 52 semaines** — dans le bloc Fondamentaux :

```ts
const p52 = plageSurFenetre(rows.map((r) => ({ date_marche: r.date_marche, cours_jour: r.cours_jour ?? null })), last.date_marche, 365, last.cours_jour ?? null);
const range52 = { low: p52?.bas ?? null, high: p52?.haut ?? null, current: last.cours_jour ?? null };
```

- [ ] **Step 4 : PER et distribution** — dans `FundamentalsPanel.tsx`, là où `r.per` et `r.payout` sont rendus (lignes ~120-135), afficher `perAffichable(r.per, r.bpa)` et `distributionAffichable(r.payout, resultatNet)` : `valeur` formatée si non nulle, sinon `motif`. Ajouter la prop `resultatNet: number | null` au composant et la passer depuis `page.tsx` (`latest.net_income ?? null`).
- [ ] **Step 5 : rapport** — supprimer `SIGNAL_LABEL` de `rapport/page.tsx` et afficher `libelleSignal(signal.signal)` (`import { libelleSignal } from '@/lib/signalLabel'`).
- [ ] **Step 6 : Quant** — `quant/page.tsx:7` :

```ts
function fr(c: string) {
  const m: Record<string, string> = {
    'Strong Buy Quant': 'Achat quant fort', 'Buy Quant': 'Achat quant',
    'Watchlist / Neutral': 'À surveiller', 'Reduce / Avoid': 'Alléger / éviter',
    'High Risk / Avoid': 'Risque élevé — éviter', 'Insufficient Data': 'Données insuffisantes',
  };
  return m[c] ?? c;
}
```

  (Remplacer « éviter » par un constat est une décision de l'exploitant, spec §5 : ne pas le faire ici.)
- [ ] **Step 7 :** `cd frontend && npx tsc --noEmit && npx vitest run` → vert.
- [ ] **Step 8 :** `git add frontend/app/actions frontend/components/fundamentals && git commit -m "fix(fiche): verdict en français, volume réel, 52 semaines datées, PER et distribution affichables"`

---

### Task 6 : Composants Chapitre, Essentiel, JaugesPlage

**Files:** Create `frontend/components/fiche/Chapitre.tsx`, `Essentiel.tsx`, `JaugesPlage.tsx`

- [ ] **Step 1 : `Chapitre.tsx`**

```tsx
export function Chapitre({ id, numero, titre, sousTitre }: { id: string; numero: string; titre: string; sousTitre: string }) {
  return (
    <div id={id} className="mt-16 grid scroll-mt-24 grid-cols-[48px_1fr] gap-y-1 border-t border-border-strong pt-11">
      <span className="tabular pt-2.5 text-sm text-accent-ink">{numero}</span>
      <h2 className="font-display text-3xl leading-tight text-ivory md:text-[34px]">{titre}</h2>
      <p className="col-start-2 text-sm text-faint">{sousTitre}</p>
    </div>
  );
}
```

- [ ] **Step 2 : `Essentiel.tsx`**

```tsx
import Link from 'next/link';
import type { ReactNode } from 'react';
export interface CarteEssentiel { href: string; etiquette: string; titre: ReactNode; detail: ReactNode }
export function Essentiel({ cartes }: { cartes: CarteEssentiel[] }) {
  if (cartes.length === 0) return null;
  return (
    <section id="essentiel" aria-labelledby="t-essentiel" className="mt-10 scroll-mt-24">
      <h2 id="t-essentiel" className="mb-3.5 text-base font-semibold text-ivory">L&apos;essentiel</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cartes.map((c) => (
          <Link key={c.etiquette} href={c.href} className="block rounded-card border border-border bg-surface p-5 transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <p className="text-xs text-faint">{c.etiquette}</p>
            <p className="mt-1 text-[17px] text-ivory">{c.titre}</p>
            <p className="mt-2 text-[13px] text-muted">{c.detail}</p>
          </Link>
        ))}
      </div>
      <p className="mt-3 text-xs text-faint">Constats tirés de la séance et des comptes publiés. Ce n&apos;est pas un conseil en investissement.</p>
    </section>
  );
}
```

- [ ] **Step 3 : `JaugesPlage.tsx`** — vérifier d'abord le nom du formateur de date courte : `grep -n "export function fmtDate" frontend/lib/format.ts` ; utiliser celui qui produit « 6 nov. 2026 » (le commit `9df361e9` l'a introduit sous `fmtDateCourte`).

```tsx
import type { Plage } from '@/lib/fiche/plages';
import { fmtNumber, fmtDateCourte } from '@/lib/format';

function Jauge({ titre, p, plein }: { titre: string; p: Plage | null; plein?: boolean }) {
  if (!p) return null;
  const pos = Math.max(0, Math.min(1, p.position ?? 0)) * 100;
  return (
    <div className="flex gap-4 rounded-card border border-border bg-surface py-[18px] pl-7 pr-5">
      <div role="img" aria-label={`${titre} : entre ${fmtNumber(p.bas)} et ${fmtNumber(p.haut)}, cours à ${Math.round(pos)} % de la plage`} className="relative w-2 shrink-0 rounded bg-border">
        <div className={`absolute inset-x-0 bottom-0 rounded ${plein ? 'bg-up' : 'bg-muted'}`} style={{ height: `${plein ? 100 : pos}%` }} />
        <span className="absolute -left-3 h-0 w-0 border-y-[5px] border-l-[7px] border-y-transparent border-l-ivory" style={{ bottom: `calc(${pos}% - 5px)` }} />
      </div>
      <div className="flex flex-col justify-between gap-3">
        <p className="text-xs text-faint">{titre}</p>
        <div><p className="text-xs text-faint">Haut{p.dateHaut ? ` · ${fmtDateCourte(p.dateHaut)}` : ''}</p><p className="tabular text-[17px] text-ivory">{fmtNumber(p.haut)}</p></div>
        <div><p className="text-xs text-faint">Bas{p.dateBas ? ` · ${fmtDateCourte(p.dateBas)}` : ''}</p><p className="tabular text-[17px] text-ivory">{fmtNumber(p.bas)}</p></div>
      </div>
    </div>
  );
}

export function JaugesPlage({ jour, an, deuxAns, hausseDuJour }: { jour: Plage | null; an: Plage | null; deuxAns: Plage | null; hausseDuJour: boolean }) {
  if (!jour && !an && !deuxAns) return null;
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <Jauge titre="1 jour" p={jour} plein={hausseDuJour} />
      <Jauge titre="52 semaines" p={an} />
      <Jauge titre="2 ans" p={deuxAns} />
    </div>
  );
}
```

- [ ] **Step 4 :** `npx tsc --noEmit` → 0 erreur.
- [ ] **Step 5 :** `git add frontend/components/fiche && git commit -m "feat(fiche): chapitre, essentiel et jauges de plage"`

---

### Task 7 : Bandeau de verdict et barre de chapitres

**Files:** Modify `frontend/components/actions/VerdictBand.tsx`, `frontend/components/actions/FicheStickyNav.tsx`

- [ ] **Step 1 : VerdictBand** — ajouter la prop `note: string | null` (la notation A–F que la page lit déjà pour `NotationBadge`) et la rendre en premier :

```tsx
{note && (
  <div className="flex items-center gap-3">
    <span className="text-xs text-faint">Note</span>
    <span className="font-display rounded-[10px] border border-ivory px-3 py-1.5 text-3xl leading-none text-ivory">{note}</span>
    <span className="max-w-[110px] text-[11px] leading-snug text-faint">notation financière, échelle A à F</span>
  </div>
)}
```

  Le signal passe par `libelleSignal(signal)`, le score s'affiche à deux décimales avec virgule, la sparkline prend `text-muted`, la plage est libellée « Plage observée sur 2 ans ».
- [ ] **Step 2 : FicheStickyNav** — sections `[{id:'essentiel',label:"L'essentiel"},{id:'aujourdhui',label:"Aujourd'hui"},{id:'titre',label:'Le titre'},{id:'entreprise',label:"L'entreprise"},{id:'suivi',label:'Mon suivi'}]` ; nouvelle prop `documents: { href: string; label: string }[]` rendue à droite en pastilles, qui passent à la ligne sous 900 px. Sous 768 px : les chapitres deviennent une rangée d'onglets défilante horizontalement (`overflow-x-auto`, cibles de 44 px), les documents regroupés derrière un onglet « Documents ».
- [ ] **Step 3 :** `npx tsc --noEmit` ; adapter les appels dans `page.tsx`.
- [ ] **Step 4 :** `git commit -am "feat(fiche): note en tête du bandeau, barre de chapitres et documents"`

---

### Task 8 : Graphique de séance intraday

**Files:** Create `frontend/components/fiche/SeanceIntraday.tsx` · Modify `frontend/app/actions/[code]/page.tsx`

- [ ] **Step 1 : requête** (avec les autres lectures `liqDailyClient`) :

```ts
const { data: snapRows } = await liqDailyClient
  .from('brvm_intraday_snapshots')
  .select('captured_at, close, volume')
  .eq('code', code)
  .eq('date_marche', last.date_marche)
  .order('captured_at', { ascending: true });
const instantanes = ((snapRows ?? []) as { captured_at: string; close: number | null; volume: number | null }[]).filter((s) => s.close != null && s.close > 0);
```

- [ ] **Step 2 : composant**

```tsx
const DEBUT = 9 * 60 + 15, FIN = 15 * 60 + 45, W = 520, H = 150;
export function SeanceIntraday({ points, plusBasPublie }: { points: { captured_at: string; close: number | null; volume: number | null }[]; plusBasPublie: number | null }) {
  const pts = points
    .map((p) => { const d = new Date(p.captured_at); return { m: d.getUTCHours() * 60 + d.getUTCMinutes(), c: p.close as number, v: p.volume ?? 0 }; })
    .filter((p) => p.m >= DEBUT && p.m <= FIN);
  if (pts.length < 2) return null;
  const min = Math.min(...pts.map((p) => p.c)), max = Math.max(...pts.map((p) => p.c));
  const marge = Math.max((max - min) * 0.15, max * 0.005);
  const x = (m: number) => ((m - DEBUT) / (FIN - DEBUT)) * W;
  const y = (c: number) => H - ((c - (min - marge)) / (max - min + 2 * marge)) * H;
  let d = `M0 ${y(pts[0]!.c).toFixed(1)}`;
  for (const p of pts.slice(1)) d += ` H${x(p.m).toFixed(1)} V${y(p.c).toFixed(1)}`;
  d += ` H${W}`;
  const barres = pts.slice(1).map((p, i) => ({ x: x(p.m), v: Math.max(0, p.v - pts[i]!.v) })).filter((b) => b.v > 0);
  const vmax = Math.max(1, ...barres.map((b) => b.v));
  const hausse = pts[pts.length - 1]!.c >= pts[0]!.c;
  const couleur = hausse ? 'var(--color-up)' : 'var(--color-down)';
  return (
    <figure className="rounded-card border border-border bg-surface px-5 pb-3.5 pt-5">
      <figcaption className="text-xs text-faint">Séance du jour · cours et volume par intervalle de 15 minutes</figcaption>
      <svg viewBox={`-4 -10 ${W + 64} 222`} className="mt-3 block h-auto w-full" role="img" aria-label={`Séance : de ${pts[0]!.c} à ${pts[pts.length - 1]!.c}, plus bas relevé ${min}, plus haut relevé ${max}`}>
        <path d={`${d} V${H} H0 Z`} style={{ fill: `rgb(${couleur} / 0.1)` }} />
        <path d={d} fill="none" strokeWidth={2.5} style={{ stroke: `rgb(${couleur})` }} />
        <g transform={`translate(0,${H + 40})`}>
          {barres.map((b) => <rect key={b.x} x={b.x - 3} y={-(b.v / vmax) * 40} width={6} height={(b.v / vmax) * 40} style={{ fill: 'rgb(var(--color-border-strong))' }} />)}
        </g>
      </svg>
      {plusBasPublie != null && min < plusBasPublie && (
        <p className="mt-1 text-[11px] text-faint">Plus bas relevé {min} ; la cote publiée indique {plusBasPublie}.</p>
      )}
    </figure>
  );
}
```

- [ ] **Step 3 :** `npx tsc --noEmit`.
- [ ] **Step 4 :** `git add frontend/components/fiche/SeanceIntraday.tsx frontend/app/actions && git commit -m "feat(fiche): graphique de séance à partir des instantanés intraday"`

---

### Task 9 : LectureTechnique et CombinedAlphaCarte

**Files:** Create `frontend/components/fiche/LectureTechnique.tsx`, `frontend/components/fiche/CombinedAlphaCarte.tsx` · Modify `frontend/app/actions/[code]/page.tsx`

- [ ] **Step 1 : `LectureTechnique`** — props :

```ts
interface Props {
  lecture: Lecture; signal: string | null; score: number | null; qualiteDonnees: number | null;
  graphiques: React.ReactNode;      // <IndicatorCharts data={indicatorData} /> existant
  synthese: { haussiers: number; neutres: number; baissiers: number; tendancePct: number | null } | null; // depuis technicalSummary
  saisonnalite: React.ReactNode;    // <SeasonalityCard … /> existant
  detections: { label: string; ok: boolean }[];
  position: React.ReactNode;        // phrase « Vous ne détenez pas … » de la section Signal actuelle
  detailScore: React.ReactNode;     // <SignalPanel signal={signal} /> existant, rendu dans <details>
}
```

  Rendu : titre « Lecture technique », badge `libelleSignal(signal)` et « qualité des données N % » ; échelle −1…+1 (repère à `((score + 1) / 2) * 100 %`, zones colorées sous −0,6 et au-dessus de +0,6, libellés des seuils) ; trois listes « Ce qui soutient », « Ce qui retient », « Neutres » (une liste vide n'est pas rendue) ; `graphiques` ; grille synthèse / saisonnalité / détections actives (les inactives résumées en une phrase) / position avec lien « Voir tous les signaux » ; `<details>` « Comment le score est calculé » contenant `detailScore`.
- [ ] **Step 2 : `CombinedAlphaCarte`** — props `{ code: string; score: number | null; rang: number | null; piliers: { libelle: string; valeur: number | null }[]; penalite: number | null; calculeLe: string | null; derniereSeance: string }`. Texte d'en-tête fixe :

  > Un score de 0 à 100 pour comparer toutes les actions BRVM. 5 piliers — valorisation, momentum, qualité bénéficiaire, solidité financière et dividende — puis une pénalité risque (max 25 pts) si garde-fous déclenchés.

  Barres en `bg-muted` avec repères 50 et 65 ; « calculé le … » et, si `calculeLe < derniereSeance`, « antérieur à la dernière séance » ; liens `/actions/${code}/quant` et `/analyse/combined-alpha`. Si `score == null` : « Score non calculé pour cette valeur. »
- [ ] **Step 3 : données Combined Alpha dans `page.tsx`** — reprendre la requête de `quant/page.tsx:19-20` (`quant_model_runs` où `model_code = 'WB_COMBINED_ALPHA'` → `quant_model_scores` pour le code) et mapper les colonnes de piliers, pénalité, rang et date exactement comme `quant/page.tsx` les lit.
- [ ] **Step 4 :** `npx tsc --noEmit`.
- [ ] **Step 5 :** `git add frontend/components/fiche frontend/app/actions && git commit -m "feat(fiche): lecture technique unique et bloc Combined Alpha"`

---

### Task 10 : Recomposition de la fiche

**Files:** Modify `frontend/app/actions/[code]/page.tsx` (JSX à partir de ~l.622)

Chaque bloc existant est **déplacé** ; seuls les blocs listés comme fusionnés disparaissent en tant que tels, leurs informations passant dans la lecture technique.

- [ ] **Step 1 : en-tête** — identité et pastilles (rendement + exercice via `dividendeCourant(divRows, exCourant?.year ?? null)`) ; prix ; boutons Suivre, Créer une alerte de prix, Fiche Quant · Combined Alpha, Classement complet, `ActionMenu` conservé ; `SeanceIntraday` à droite ; grille des 13 `SessionMetric` (flottant suivi de son % = flottant ÷ titres) ; `JaugesPlage` avec `plageSeance(last.plus_bas, last.plus_haut, last.cours_jour)`, `plageSurFenetre(…, 365, …)`, `plageSurFenetre(…, 730, …)` ; `VerdictBand` avec `note`.
- [ ] **Step 2 : `Essentiel`** — quatre cartes construites à partir de `bruitSeance` + `carnet` (Aujourd'hui), `signal` (Le titre), `economieSociete` + `evolutionResultat` (L'entreprise), `liquidity` (Négociabilité). Une carte dont la donnée manque n'est pas créée.
- [ ] **Step 3 : `Chapitre id="aujourdhui" numero="01"`** — `CarnetCommentaire` (synthèse visible ; constats et « Ce que ce commentaire ne dit pas » dans des `<details>` : si le composant ne les replie pas déjà, ajouter une prop `replie` qui enveloppe ces listes), séance en chiffres, `CarnetOrdres`, `LiquidityCard`.
- [ ] **Step 4 : `Chapitre id="titre" numero="02"`** — graphique cours et volume existant ; `EventMarkerLegend` complété de « AG assemblée générale · RT rapport ou publication » ; `LectureTechnique` qui **remplace** `TechnicalSummary`, la section « Analyse technique », la section « Signal quantitatif » et `IndicatorCommentary` (fusionnés) ; entrées de `lectureTechnique` depuis `last`, `lastRsi`, `lastMacd`, les MA calculées et `volMoyen`.
- [ ] **Step 5 : `Chapitre id="entreprise" numero="03"`** — alerte de perte ; `FundamentalsPanel` ; `ChartBuilder` dans un `<details>` « Personnaliser ce graphique » sous le graphique CA (remplace le doublon) ; détail du dernier exercice (`horsExploitation`, `evolutionResultat`) ; `ValuationPanel` ; dividendes (5 exercices + dernier versement + détachement) ; événements avec « Lire l'analyse » ; `CombinedAlphaCarte`.
- [ ] **Step 6 : `Chapitre id="suivi" numero="04"`** — `ThesisPanel` ; actions (watchlist, alerte, backtest, rapport PDF d'analyse, CSV, analyser) ; les 4 questions à l'assistant ; `ForumTopicList` et lien de démarrage.
- [ ] **Step 7 :** `npx tsc --noEmit && npx vitest run` → vert.
- [ ] **Step 8 : inventaire** — `npm run dev`, session QA Premium (`node scripts/qa-sessions-locales.mjs`), ouvrir `/actions/STAC` et cocher chaque ligne de la note « Inventaire » de la maquette. Une information absente fait échouer la tâche.
- [ ] **Step 9 :** `git commit -am "feat(fiche): fiche action recomposée en quatre chapitres"`

---

### Task 11 : États financiers

**Files:** Create `frontend/components/fiche/FluxComptable.tsx` · Modify `frontend/app/actions/[code]/financials/page.tsx`

- [ ] **Step 1 : `FluxComptable`** (`'use client'`) — props `parExercice: Record<number, FluxCR | null>` (calculés côté serveur avec `fluxCompteResultat`), `exercices: number[]`. État local : exercice choisi (dernier par défaut) et vue « Barres / Flux ». Dessin : colonne gauche (ressources), nœud central « Ressources » (total), colonne droite (emplois) ; hauteur ∝ valeur, 260 px pour le total, 10 px entre nœuds ; bande entre deux nœuds : `M x1 y1a C xm y1a, xm y2a, x2 y2a L x2 y2b C xm y2b, xm y1b, x1 y1b Z` avec `xm = (x1 + x2) / 2` ; libellés et montants via `fmtFcfa`. Couleurs : chiffre d'affaires `accent`, hors exploitation `up`, perte et impôt `down`, charges `purple`, bénéfice `up`. Flux `null` : « Flux non disponible pour cet exercice ».
- [ ] **Step 2 : page** — ordre : alerte de perte ; onglets Compte de résultat / Bilan / Flux (tableaux 5 ans existants, « — » = non extrait) ; `FluxComptable` ; ratios en trois cartes (Valorisation, Rentabilité, Solidité et croissance) avec formule en sous-libellé ; PER / distribution via `perAffichable` / `distributionAffichable` ; évolution du résultat via `evolutionResultat` ; dette / fonds propres = `computeRatios(...).gearing` (plus de « non disponible » quand dette et fonds propres existent) ; constructeur de graphique (remplace « Évolution CA et résultat net ») ; plage 52 semaines via `plageSurFenetre` ; sources ; diagnostic Premium.
- [ ] **Step 3 :** `npx tsc --noEmit`.
- [ ] **Step 4 :** `git add frontend/components/fiche/FluxComptable.tsx frontend/app/actions && git commit -m "feat(etats): tableaux d'abord, vue en flux, ratios avec formule"`

---

### Task 12 : Revue de résultats

**Files:** Modify `frontend/app/actions/[code]/revue/page.tsx`

- [ ] **Step 1 :** phrase de synthèse via `syntheseExercice` (Task 2) ; 4 KPI (CA et croissance, résultat d'exploitation et N-1, résultat net et `evolutionResultat`, capitaux propres et variation).
- [ ] **Step 2 :** cascade SVG exploitation → hors exploitation → avant impôt → impôt → net (barres flottantes, montants via `fmtFcfa`, rendue seulement si les 4 postes existent).
- [ ] **Step 3 :** tableau N / N-1 (colonne Évolution du résultat net via `evolutionResultat`) ; 5 exercices ; dividende en texte (dernier versement et exercice) ; **supprimer** le graphique de dividende ; « À suivre ».
- [ ] **Step 4 :** `npx tsc --noEmit && npx vitest run` ; `git commit -am "feat(revue): synthèse chiffrée, cascade et évolutions en mots"`

---

### Task 13 : Dossier A4 (dimensions inchangées)

**Files:** Modify `frontend/app/rapports/dossier/[code]/page.tsx`, `frontend/lib/dossier/narratif.ts`, `frontend/lib/dossier/narratif.test.mjs`

- [ ] **Step 1 : panneau 05** — PER via `perAffichable`.
- [ ] **Step 2 : panneau 06** — la carte « Part non opérationnelle » (l.~418) affiche `horsExploitation(...)` formaté en FCFA, libellé « Produits hors exploitation » ; l'encadré « À lire avec prudence » cite ce montant.
- [ ] **Step 3 : panneau 07** — taux de distribution via `distributionAffichable`.
- [ ] **Step 4 : panneaux 10/11** — dans `narratif.ts`, un dividende `ancien` (`dividendeCourant`) ne produit plus de point d'appui ; la vigilance « % du résultat avant impôts » devient le montant hors exploitation. Mettre à jour `narratif.test.mjs` puis `cd frontend && npx tsx lib/dossier/narratif.test.mjs`.
- [ ] **Step 5 : feuille 1** — ajouter « En une page » (activité, résultat, bilan, dividende) et un sommaire paginé dans l'espace libre existant, sans toucher à `.dv`, à la hauteur des feuilles ni aux marges.
- [ ] **Step 6 : verrous du worker** — tirer le PDF de STAC en local selon `video/README.md` (section dossiers) : même nombre de feuilles qu'avant, aucune feuille qui déborde.
- [ ] **Step 7 :** `git commit -am "fix(dossier): montants hors exploitation, PER et distribution affichables, feuille 1 complétée"`

---

### Task 14 : Publications

**Files:** Modify `frontend/components/PublicationsModal.tsx`

- [ ] **Step 1 :** trois liens clés (derniers états financiers, dernier rapport d'activités, dernière assemblée), calculés depuis la liste reçue.
- [ ] **Step 2 :** recherche (`<label>` + `<input type="search">`) sur le titre ; filtres par type avec compteurs ; filtre « Sans type » si `total − somme des types > 0`.
- [ ] **Step 3 :** liste groupée par année, la plus récente d'abord ; titres via `titrePublication` (Task 2).
- [ ] **Step 4 :** `npx tsc --noEmit` ; `git commit -am "feat(publications): documents clés, recherche, liste par année"`

---

### Task 15 : Fiche Quant

**Files:** Modify `frontend/app/actions/[code]/quant/page.tsx`

- [ ] **Step 1 :** lire la dernière `date_marche` de `brvm_actions_daily` pour le code ; afficher « Calculée le … » en bandeau si la date du run est antérieure.
- [ ] **Step 2 :** carte « Comment on arrive à N » : somme pondérée des piliers (calculée depuis les piliers et leurs poids affichés), pénalité = somme pondérée − score, score.
- [ ] **Step 3 :** barres des piliers en `bg-muted` avec repères 50 et 65 ; libellés accentués (« Qualité bénéficiaire », « Solidité financière », « Garde-fous et notes », « pénalité », « Fiabilité moyenne »).
- [ ] **Step 4 :** `npx tsc --noEmit` ; `git commit -am "feat(quant): date de calcul, décomposition du score, barres neutres"`

---

### Task 16 : Vérification et critique

- [ ] **Step 1 :** `cd frontend && npx tsc --noEmit && npx vitest run && npm run build` → vert.
- [ ] **Step 2 :** `NEXT_DIST_DIR=.next-fiche npx next start -p 3140` puis `MSYS_NO_PATHCONV=1 npm run -s eval:visual -- --base http://localhost:3140 --etat "$TEMP/westbourse-qa/actif-state.json" --out "$TEMP/fiche-eval" --pages /actions/STAC,/actions/STAC/revue,/actions/STAC/financials,/actions/STAC/quant,/actions/STAC/rapport,/rapports/dossier/STAC`. Point de départ mesuré le 2026-11-08 : fiche 2 échecs de contraste sur 4 vues, financials 2, rapport 4, revue 0, quant 0. Aucun échec nouveau.
- [ ] **Step 3 :** contrôler `SNTS` (bénéficiaire) et `SVOC` (sans comptes) : aucun bloc cassé, états vides lisibles.
- [ ] **Step 4 :** `curl -s -o /dev/null -w "%{http_code}" http://localhost:3140/actions/ZZZZ` → `404`.
- [ ] **Step 5 :** critique `design-critic` (fiche + 5 sous-pages), seuil 7/10, aucune dimension sous 5.
- [ ] **Step 6 :** pousser, ouvrir la PR (aperçu Vercel) ; fusion seulement sur « fusionne » de l'exploitant, contrôles verts.
- [ ] **Step 7 :** fermer les sessions QA : `node scripts/qa-sessions-locales.mjs --fermer`.
