# Bulletin du marché (Stress Monitor) et sections landing — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** rendre `/stress-monitor` lisible (bulletin en clair, graphique annoté, détail repliable) et ajouter à la landing un « thermomètre du marché » et une section « Apprendre ».

**Architecture:** un module pur `lib/stress/bulletin.ts` produit TOUS les textes dépendant des données (verdict, phrases, facteurs, repères) ; la page et la landing ne font qu'afficher. Composants serveur sans JS ajouté (sauf le graphique Recharts existant). Landing : deux sections dans `components/vitrine/`, styles dans `vitrine.css`, données par deux chargeurs `lib/vitrine/*`.

**Tech Stack:** Next.js 15 (App Router, RSC), React 19, TypeScript strict, Tailwind (page Stress), CSS vitrine (landing), Recharts, vitest, Playwright.

Spec : `docs/superpowers/specs/2026-11-28-stress-bulletin-landing-design.md`. Copie de travail : `C:\Users\adego\wt-bulletin` (branche `feat/stress-bulletin-landing`).

Commandes (PowerShell, depuis `C:\Users\adego\wt-bulletin\frontend`, jonction `node_modules` posée) :
`npx vitest run <fichiers>` · `npx tsc --noEmit -p .` · `npm run build` (avec `NODE_OPTIONS=--max-old-space-size=8192`) · `npx playwright test <spec>`.

Convention d'extraction : chaque fichier à créer est annoncé par une ligne « Créer `chemin` : » suivie
d'un bloc de code complet (la source de vérité du fichier).

---

## PR 1 — Bulletin de la page Stress Monitor

### Task 1 : module pur `lib/stress/bulletin.ts` (TDD)

**Files:** Create `frontend/lib/stress/bulletin.test.ts`, `frontend/lib/stress/bulletin.ts`.

- [ ] **Step 1 : écrire le test qui échoue**

Créer `frontend/lib/stress/bulletin.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import {
  construireBulletin,
  choisirFacteurs,
  phraseAmpleur,
  reperesFenetre,
  REPONSES_THERMOMETRE,
  VERDICTS,
} from './bulletin';
import type { MapComposantesStress, RegimeStress, StressDailyRow } from './stressIndexTypes';

function composantes(over: Partial<Record<keyof MapComposantesStress, [number | null, number | null]>> = {}): MapComposantesStress {
  const base: Record<keyof MapComposantesStress, [number | null, number | null, number]> = {
    drawdown_composite: [53, -18.6, 0.25],
    largeur_baissiere: [68, 62.5, 0.2],
    volatilite_brvmv: [74, 17.6, 0.15],
    diffusion_sectorielle: [100, 100, 0.15],
    pression_volumes: [88, 77.2, 0.15],
    momentum_court_terme: [100, -15.5, 0.1],
  };
  const out = {} as MapComposantesStress;
  for (const cle of Object.keys(base) as (keyof MapComposantesStress)[]) {
    const [score, brute, poids] = base[cle];
    const o = over[cle];
    out[cle] = {
      score_0_100: o ? o[0] : score,
      valeur_brute: o ? o[1] : brute,
      unite_brute: '%',
      poids_nominal: poids,
      poids_effectif: poids,
    };
  }
  return out;
}

function ligne(date: string, indice: number, over: Partial<StressDailyRow> = {}): StressDailyRow {
  return {
    date_marche: date,
    stress_index: indice,
    regime: 'tension_extreme',
    couverture_composantes_pct: 100,
    nb_composantes_actives: 6,
    composantes: composantes(),
    variation_5j_pts: 11.1,
    variation_20j_pts: 29,
    variation_60j_pts: 56.3,
    observables_marche: {
      brvmc_cloture: 453.57,
      drawdown_brvmc_pct: -18.35,
      largeur_hausses_5j_pct: 19.6,
      ecart_brvmc_mm20_pct: -9.9,
      variation_brvmv_20j_pts: 5.37,
      ratio_volume_60j: 0.26,
    },
    ...over,
  };
}

const HIST = [ligne('2026-09-10', 18), ligne('2026-09-11', 20), ligne('2026-11-26', 76.1), ligne('2026-11-27', 76.2)];

describe('verdict et réponse', () => {
  const cas: [RegimeStress, number][] = [
    ['faible_tension', 12],
    ['tension_moderee', 30],
    ['tension_elevee', 60],
    ['tension_extreme', 80],
  ];
  it.each(cas)('régime %s', (regime, indice) => {
    const b = construireBulletin({ actuel: ligne('2026-11-27', indice, { regime }), historique: [] });
    expect(b.verdict).toBe(VERDICTS[regime]);
    expect(b.reponse).toBe(REPONSES_THERMOMETRE[regime]);
    expect(b.note).toBe(Math.round(indice));
  });

  it('régime inconnu : recalculé depuis l’indice', () => {
    const b = construireBulletin({ actuel: ligne('2026-11-27', 55, { regime: 'autre' as RegimeStress }), historique: [] });
    expect(b.regime).toBe('tension_elevee');
  });
});

describe('phrases', () => {
  it('trajectoire depuis le plus haut du Composite, ampleur datée, étendue', () => {
    const b = construireBulletin({
      actuel: HIST[3],
      historique: HIST,
      composite: { drawdownPct: -18.39, dateSommet: '2026-09-11' },
    });
    expect(b.phrases).toEqual([
      'Depuis le 11 sept. 2026, la tension est passée de 20 à 76.',
      'Le BRVM Composite est 18\u00a0% sous son plus haut du 11 sept. 2026.',
      'La baisse touche tous les secteurs.',
    ]);
  });

  it('sans plus haut connu : trajectoire sur 20 séances, ampleur sans date', () => {
    const b = construireBulletin({ actuel: HIST[3], historique: HIST });
    expect(b.phrases[0]).toBe('En 20 séances, la tension a augmenté de 29 points.');
    expect(b.phrases[1]).toBe('Le BRVM Composite est 18\u00a0% sous son plus haut.');
  });

  it('variation faible : tension stable ; variation absente : phrase omise', () => {
    expect(construireBulletin({ actuel: ligne('2026-11-27', 40, { variation_20j_pts: 1.4 }), historique: [] }).phrases[0]).toBe(
      'En 20 séances, la tension est restée stable.',
    );
    const sans = construireBulletin({ actuel: ligne('2026-11-27', 40, { variation_20j_pts: null }), historique: [] });
    expect(sans.phrases.some((p) => p.startsWith('En 20 séances'))).toBe(false);
  });

  it('Composite à son plus haut', () => {
    expect(phraseAmpleur(ligne('2026-11-27', 10), { drawdownPct: -0.2, dateSommet: '2026-11-27' })).toBe(
      'Le BRVM Composite est à son plus haut.',
    );
  });

  it.each([
    [100, 'La baisse touche tous les secteurs.'],
    [75, 'La baisse touche la plupart des secteurs.'],
    [45, 'Une partie des secteurs recule.'],
    [10, 'Peu de secteurs reculent.'],
  ])('étendue : %s %%', (valeur, attendu) => {
    const b = construireBulletin({
      actuel: ligne('2026-11-27', 50, { composantes: composantes({ diffusion_sectorielle: [50, valeur] }) }),
      historique: [],
    });
    expect(b.phrases).toContain(attendu);
  });

  it('étendue indisponible : phrase omise', () => {
    const b = construireBulletin({
      actuel: ligne('2026-11-27', 50, { composantes: composantes({ diffusion_sectorielle: [null, null] }) }),
      historique: [],
    });
    expect(b.phrases.some((p) => /secteur/.test(p))).toBe(false);
  });
});

describe('facteurs', () => {
  it('les trois plus fortes contributions, avec une mesure chiffrée', () => {
    const f = choisirFacteurs(ligne('2026-11-27', 76));
    // 100×0,15 = 15 ; 68×0,20 = 13,6 ; 53×0,25 = 13,25 (devant 88×0,15 = 13,2).
    expect(f.map((x) => x.cle)).toEqual(['diffusion_sectorielle', 'largeur_baissiere', 'drawdown_composite']);
    expect(f[1].mesure).toBe('6 titres sur 10 en baisse (5 séances)');
    expect(f[0].titre).toBe('Secteurs en baisse');
  });

  it('composantes indisponibles ignorées ; égalité départagée par le poids nominal', () => {
    const f = choisirFacteurs(
      ligne('2026-11-27', 50, {
        composantes: composantes({
          diffusion_sectorielle: [null, null],
          largeur_baissiere: [50, 50],
          drawdown_composite: [40, -10],
          pression_volumes: [10, 10],
          volatilite_brvmv: [10, 10],
          momentum_court_terme: [100, -5],
        }),
      }),
    );
    // largeur 50×0,20 = 10 ; drawdown 40×0,25 = 10 ; momentum 100×0,10 = 10 → poids nominal : drawdown, largeur, momentum.
    expect(f.map((x) => x.cle)).toEqual(['drawdown_composite', 'largeur_baissiere', 'momentum_court_terme']);
  });
});

describe('repères du graphique', () => {
  const serie = [
    { date: 'a', valeur: 30 },
    { date: 'b', valeur: 12 },
    { date: 'c', valeur: 55 },
    { date: 'd', valeur: 40 },
    { date: 'e', valeur: 78 },
    { date: 'f', valeur: 76 },
  ];

  it('dernier franchissement de 75, point le plus bas, plus haut du Composite', () => {
    expect(reperesFenetre(serie, 'c')).toEqual([
      { date: 'e', valeur: 78, libelle: 'Seuil 75 franchi' },
      { date: 'b', valeur: 12, libelle: 'Point le plus calme' },
      { date: 'c', valeur: 55, libelle: 'Plus haut du Composite' },
    ]);
  });

  it('sans franchissement de 75 : seuil 50 ; au plus trois repères ; dates uniques', () => {
    const r = reperesFenetre(serie.slice(0, 4), 'b');
    expect(r).toEqual([
      { date: 'c', valeur: 55, libelle: 'Seuil 50 franchi' },
      { date: 'b', valeur: 12, libelle: 'Point le plus calme' },
    ]);
    expect(reperesFenetre([{ date: 'x', valeur: 1 }], null)).toEqual([]);
  });
});
```

- [ ] **Step 2 : vérifier l'échec** — `npx vitest run lib/stress/bulletin.test.ts` → FAIL (module introuvable).

- [ ] **Step 3 : implémenter**

Créer `frontend/lib/stress/bulletin.ts` :

```ts
/**
 * Bulletin du marché (Stress Monitor) : TOUT texte qui dépend des données sort d'ici.
 * Pur, sans I/O, testé (bulletin.test.ts). Spec :
 * docs/superpowers/specs/2026-11-28-stress-bulletin-landing-design.md.
 *
 * Descriptif, jamais prédictif : on dit le niveau de tension MESURÉ, jamais ce qui va
 * suivre (banc d'évaluation 2007-2026 : `non_prouve`). Aucun conseil.
 */
import { fmtDateCourte, fmtNumber, fmtPctSigne } from '@/lib/format';
import { POIDS_NOMINAUX_STRESS, type CleComposanteStress, type RegimeStress, type StressDailyRow } from './stressIndexTypes';

const NBSP = '\u00a0';

export const VERDICTS: Record<RegimeStress, string> = {
  faible_tension: 'Le marché est calme',
  tension_moderee: 'Le marché est sous tension modérée',
  tension_elevee: 'Le marché est sous tension élevée',
  tension_extreme: 'Le marché est sous forte tension',
};

/** Réponse courte de la landing à « Le marché est-il nerveux ? ». */
export const REPONSES_THERMOMETRE: Record<RegimeStress, string> = {
  faible_tension: 'Non, plutôt calme.',
  tension_moderee: 'Un peu.',
  tension_elevee: 'Oui.',
  tension_extreme: 'Oui, très.',
};

export const NIVEAUX_COURTS: Record<RegimeStress, string> = {
  faible_tension: 'calme',
  tension_moderee: 'modérée',
  tension_elevee: 'élevée',
  tension_extreme: 'extrême',
};

/** Titres NEUTRES : le titre ne qualifie jamais, c'est la mesure qui dit le fait (vrai aussi en marché calme). */
const TITRES: Record<CleComposanteStress, string> = {
  drawdown_composite: 'Recul depuis le plus haut',
  largeur_baissiere: 'Titres en baisse',
  volatilite_brvmv: 'Agitation des cours',
  diffusion_sectorielle: 'Secteurs en baisse',
  pression_volumes: 'Échanges sur titres en baisse',
  momentum_court_terme: 'Tendance des dernières semaines',
};

/** Définitions simples, reprises par les bulles « ⓘ » de la partie détaillée. */
export const DEFINITIONS_COMPOSANTES: Record<CleComposanteStress, string> = {
  drawdown_composite: 'Écart entre le niveau du BRVM Composite et son plus haut. Plus il est grand, plus la tension monte.',
  largeur_baissiere: 'Part des titres cotés en baisse, en moyenne sur les cinq dernières séances.',
  volatilite_brvmv: 'Amplitude des variations quotidiennes du marché (volatilité réalisée sur vingt séances, indice BRVM-V).',
  diffusion_sectorielle: 'Part de la capitalisation boursière située dans des secteurs en baisse sur vingt séances.',
  pression_volumes: 'Part des volumes échangés sur des titres en baisse, sur cinq séances.',
  momentum_court_terme: 'Variation du BRVM Composite sur les vingt dernières séances.',
};

function mesure(cle: CleComposanteStress, v: number): string {
  switch (cle) {
    case 'drawdown_composite':
      return `${fmtNumber(Math.abs(v), 1)}${NBSP}% sous le plus haut`;
    case 'largeur_baissiere':
      return `${fmtNumber(Math.round(v / 10), 0)} titres sur 10 en baisse (5 séances)`;
    case 'volatilite_brvmv':
      return `Volatilité de ${fmtNumber(v, 1)}${NBSP}% (20 séances)`;
    case 'diffusion_sectorielle':
      return `${fmtNumber(v, 0)}${NBSP}% de la capitalisation dans des secteurs en baisse`;
    case 'pression_volumes':
      return `${fmtNumber(v, 0)}${NBSP}% des volumes sur des titres en baisse (5 séances)`;
    case 'momentum_court_terme':
      return `${fmtPctSigne(v, 1)} en 20 séances`;
  }
}

export interface PlusHautComposite {
  /** Recul du BRVM Composite depuis son plus haut, en % (négatif). Même source que `dateSommet`. */
  drawdownPct: number;
  dateSommet: string | null;
}

export interface CriseProche {
  libelle: string;
  ressemblance: number;
}

export interface EntreeBulletin {
  actuel: StressDailyRow;
  /** Ordre chronologique croissant. */
  historique: readonly StressDailyRow[];
  composite?: PlusHautComposite | null;
  criseProche?: CriseProche | null;
}

export interface Facteur {
  cle: CleComposanteStress;
  titre: string;
  mesure: string;
  score: number;
  poids: number;
  definition: string;
}

export interface Repere {
  date: string;
  valeur: number;
  libelle: string;
}

export interface Bulletin {
  regime: RegimeStress;
  verdict: string;
  reponse: string;
  niveau: string;
  note: number;
  phrases: string[];
  facteurs: Facteur[];
  passe: CriseProche | null;
}

export function regimeDe(indice: number): RegimeStress {
  if (indice >= 75) return 'tension_extreme';
  if (indice >= 50) return 'tension_elevee';
  if (indice >= 25) return 'tension_moderee';
  return 'faible_tension';
}

export function phraseTrajectoire(e: EntreeBulletin): string | null {
  const actuel = Math.round(e.actuel.stress_index);
  const date = e.composite?.dateSommet ?? null;
  if (date) {
    const jour = e.historique.find((r) => r.date_marche === date);
    if (jour && Number.isFinite(jour.stress_index)) {
      const depart = Math.round(jour.stress_index);
      if (depart !== actuel) return `Depuis le ${fmtDateCourte(date)}, la tension est passée de ${depart} à ${actuel}.`;
    }
  }
  const v = e.actuel.variation_20j_pts;
  if (v == null || !Number.isFinite(v)) return null;
  if (Math.abs(v) < 2) return 'En 20 séances, la tension est restée stable.';
  return `En 20 séances, la tension a ${v > 0 ? 'augmenté' : 'baissé'} de ${fmtNumber(Math.abs(v), 0)} points.`;
}

export function phraseAmpleur(actuel: StressDailyRow, composite?: PlusHautComposite | null): string | null {
  const dd = composite?.drawdownPct ?? actuel.observables_marche?.drawdown_brvmc_pct;
  if (dd == null || !Number.isFinite(dd)) return null;
  if (dd > -0.5) return 'Le BRVM Composite est à son plus haut.';
  const date = composite?.dateSommet ? ` du ${fmtDateCourte(composite.dateSommet)}` : '';
  return `Le BRVM Composite est ${fmtNumber(Math.abs(dd), 0)}${NBSP}% sous son plus haut${date}.`;
}

export function phraseEtendue(actuel: StressDailyRow): string | null {
  const v = actuel.composantes?.diffusion_sectorielle?.valeur_brute;
  if (v == null || !Number.isFinite(v)) return null;
  if (v >= 99.5) return 'La baisse touche tous les secteurs.';
  if (v >= 60) return 'La baisse touche la plupart des secteurs.';
  if (v >= 30) return 'Une partie des secteurs recule.';
  return 'Peu de secteurs reculent.';
}

/** Les trois composantes de plus forte contribution score × poids (indisponibles ignorées). */
export function choisirFacteurs(actuel: StressDailyRow): Facteur[] {
  const cles = Object.keys(TITRES) as CleComposanteStress[];
  return cles
    .flatMap((cle) => {
      const c = actuel.composantes?.[cle];
      if (!c || c.score_0_100 == null || c.valeur_brute == null) return [];
      if (!Number.isFinite(c.score_0_100) || !Number.isFinite(c.valeur_brute)) return [];
      const poids = c.poids_effectif ?? c.poids_nominal;
      return [{ cle, score: c.score_0_100, brute: c.valeur_brute, poids, contribution: c.score_0_100 * poids }];
    })
    .sort((a, b) => b.contribution - a.contribution || POIDS_NOMINAUX_STRESS[b.cle] - POIDS_NOMINAUX_STRESS[a.cle])
    .slice(0, 3)
    .map(({ cle, score, brute, poids }) => ({
      cle,
      titre: TITRES[cle],
      mesure: mesure(cle, brute),
      score,
      poids,
      definition: DEFINITIONS_COMPOSANTES[cle],
    }));
}

/** Repères dessinés sur la fenêtre affichée (au plus trois, dates uniques). */
export function reperesFenetre(serie: readonly { date: string; valeur: number }[], dateSommet?: string | null): Repere[] {
  if (serie.length < 2) return [];
  const reperes: Repere[] = [];
  for (const seuil of [75, 50]) {
    let dernier: Repere | null = null;
    for (let i = 1; i < serie.length; i++) {
      if (serie[i - 1].valeur < seuil && serie[i].valeur >= seuil) {
        dernier = { date: serie[i].date, valeur: serie[i].valeur, libelle: `Seuil ${seuil} franchi` };
      }
    }
    if (dernier) {
      reperes.push(dernier);
      break;
    }
  }
  const bas = serie.reduce((m, p) => (p.valeur < m.valeur ? p : m), serie[0]);
  reperes.push({ date: bas.date, valeur: bas.valeur, libelle: 'Point le plus calme' });
  if (dateSommet) {
    const p = serie.find((x) => x.date === dateSommet);
    if (p) reperes.push({ date: p.date, valeur: p.valeur, libelle: 'Plus haut du Composite' });
  }
  const vues = new Set<string>();
  return reperes
    .filter((r) => {
      if (vues.has(r.date)) return false;
      vues.add(r.date);
      return true;
    })
    .slice(0, 3);
}

export function construireBulletin(e: EntreeBulletin): Bulletin {
  const regime = e.actuel.regime in VERDICTS ? e.actuel.regime : regimeDe(e.actuel.stress_index);
  return {
    regime,
    verdict: VERDICTS[regime],
    reponse: REPONSES_THERMOMETRE[regime],
    niveau: NIVEAUX_COURTS[regime],
    note: Math.round(e.actuel.stress_index),
    phrases: [phraseTrajectoire(e), phraseAmpleur(e.actuel, e.composite), phraseEtendue(e.actuel)].filter(
      (p): p is string => Boolean(p),
    ),
    facteurs: choisirFacteurs(e.actuel),
    passe: e.criseProche ?? null,
  };
}
```

- [ ] **Step 4 : vérifier le succès** — `npx vitest run lib/stress/bulletin.test.ts` → PASS.
- [ ] **Step 5 : commit** — `git add frontend/lib/stress/bulletin.ts frontend/lib/stress/bulletin.test.ts && git commit -m "feat(stress): module pur du bulletin du marché"`

### Task 2 : bulle de définition `InfoTerme`

Créer `frontend/components/stress/InfoTerme.tsx` :

```tsx
import { Info } from 'lucide-react';

/**
 * Bulle « ⓘ » de définition, sans JavaScript (<details>) : clavier et lecteur
 * d'écran compris. Texte fourni par lib/stress/bulletin.ts (DEFINITIONS_COMPOSANTES).
 */
export function InfoTerme({ terme, definition }: { terme: string; definition: string }) {
  return (
    <details className="relative inline-block align-middle">
      <summary
        aria-label={`Définition : ${terme}`}
        className="inline-flex cursor-pointer list-none items-center text-faint hover:text-accent-ink [&::-webkit-details-marker]:hidden"
      >
        <Info className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
      </summary>
      <span
        role="note"
        className="absolute left-0 top-5 z-20 block w-60 max-w-[calc(100vw-3rem)] rounded-lg border border-border bg-surface p-3 text-xs font-normal leading-relaxed text-ivory shadow-card"
      >
        <span className="mb-1 block font-semibold">{terme}</span>
        {definition}
      </span>
    </details>
  );
}
```

### Task 3 : composant `BulletinMarche`

Créer `frontend/components/stress/BulletinMarche.tsx` :

```tsx
import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import type { Bulletin } from '@/lib/stress/bulletin';
import { fmtDateCourte, fmtNumber } from '@/lib/format';

/**
 * Haut de page du Stress Monitor : verdict, jauge, résumé, « Pourquoi ? », repère historique.
 * Tous les textes variables viennent de construireBulletin (lib/stress/bulletin.ts).
 */
export function BulletinMarche({ b, dateSeance }: { b: Bulletin; dateSeance: string }) {
  const pos = Math.min(100, Math.max(0, b.note));
  return (
    <section aria-labelledby="bulletin-titre" className="rounded-panel border border-border bg-surface p-5 md:p-6">
      <p className="text-xs text-muted">Bulletin du marché · séance du {fmtDateCourte(dateSeance)}</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h2 id="bulletin-titre" className="font-display text-2xl font-semibold text-ivory md:text-3xl">
          {b.verdict}
        </h2>
        <span className="tabular rounded-full border border-border-strong px-3 py-1 text-sm font-semibold text-ivory">
          {b.note} / 100 · tension {b.niveau}
        </span>
      </div>

      <div className="mt-4">
        <div
          role="meter"
          aria-label="Indice de tension du marché"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pos}
          aria-valuetext={`${pos} sur 100, tension ${b.niveau}`}
          className="relative h-2.5 w-full rounded-full"
          style={{ background: 'linear-gradient(90deg, rgb(var(--color-accent-ink) / .12), rgb(var(--color-accent-ink) / .9))' }}
        >
          {[25, 50, 75].map((t) => (
            <span key={t} aria-hidden="true" className="absolute top-0 h-full w-px bg-surface" style={{ left: `${t}%` }} />
          ))}
          <span
            aria-hidden="true"
            className="absolute -top-1.5 h-5 w-1 -translate-x-1/2 rounded-full bg-ivory"
            style={{ left: `${pos}%` }}
          />
        </div>
        <div aria-hidden="true" className="mt-1.5 grid grid-cols-4 text-[11px] text-faint">
          <span>Calme</span>
          <span className="text-center">Modérée</span>
          <span className="text-center">Élevée</span>
          <span className="text-right">Extrême</span>
        </div>
      </div>

      {b.phrases.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-sm leading-relaxed text-ivory md:text-base">
          {b.phrases.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      {b.facteurs.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-ivory">Pourquoi {b.note} ?</h3>
          <p className="text-xs text-muted">Les trois mesures qui pèsent le plus dans la note du jour.</p>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            {b.facteurs.map((f) => (
              <details key={f.cle} className="group rounded-lg border border-border bg-sunken p-3 text-sm">
                <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <span className="block font-medium text-ivory">{f.titre}</span>
                  <span className="tabular mt-0.5 block text-xs text-muted">{f.mesure}</span>
                  <span className="mt-1 block text-xs text-accent-ink group-open:hidden">Voir le détail</span>
                </summary>
                <dl className="mt-2 space-y-1 text-xs text-muted">
                  <div className="flex justify-between gap-2">
                    <dt>Score de la mesure</dt>
                    <dd className="tabular text-ivory">{fmtNumber(f.score, 0)} / 100</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Poids dans la note</dt>
                    <dd className="tabular text-ivory">{fmtNumber(f.poids * 100, 0)} %</dd>
                  </div>
                </dl>
                <p className="mt-2 text-xs leading-relaxed text-muted">{f.definition}</p>
              </details>
            ))}
          </div>
        </div>
      )}

      {b.passe && (
        <div className="mt-6 rounded-lg border border-border/70 p-3 text-sm">
          <h3 className="font-semibold text-ivory">Et dans le passé ?</h3>
          <p className="mt-1 leading-relaxed text-muted">
            La situation la plus proche dans l&apos;historique : <span className="text-ivory">{b.passe.libelle}</span>{' '}
            (ressemblance <span className="tabular">{fmtNumber(b.passe.ressemblance, 0)} / 100</span>). Un repère pour
            situer la séance, ce n&apos;est pas une prévision.
          </p>
          <Link href="/stress-monitor/crises" className="mt-1 inline-flex items-center gap-1 text-xs text-accent-ink hover:underline">
            Comparer avec les crises historiques
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </div>
      )}

      <Link
        href="/stress-monitor/methodologie"
        className="print:hidden mt-4 inline-flex items-center gap-1 text-xs text-accent-ink hover:underline"
      >
        <BookOpen className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        Comment est calculé cet indice
      </Link>
    </section>
  );
}
```

### Task 4 : graphique — périodes, repères, info-bulle en clair

**Modify** `frontend/components/stress/StressHistoriqueChart.tsx` :

- imports : ajouter `ReferenceDot` à l'import `recharts` ; ajouter
  `import { NIVEAUX_COURTS, regimeDe, reperesFenetre } from '@/lib/stress/bulletin';` ;
  retirer `fmtPctSigne` (plus utilisé).
- signature : `StressHistoriqueChart({ historique, dateSommet = null }: { historique: readonly StressDailyRow[]; dateSommet?: string | null })`.
- l'état `fenetre: 60 | 180` devient trois périodes :

```tsx
const PERIODES = [
  { id: '3m', libelle: '3 mois', n: 63 },
  { id: '6m', libelle: '6 mois', n: 126 },
  { id: 'tout', libelle: 'Tout', n: Number.POSITIVE_INFINITY },
] as const;
type IdPeriode = (typeof PERIODES)[number]['id'];
// dans le composant :
const [periode, setPeriode] = useState<IdPeriode>('6m');
const choix = PERIODES.find((p) => p.id === periode)!;
const serie = (Number.isFinite(choix.n) ? historique.slice(-choix.n) : historique).map((r) => ({
  date: r.date_marche,
  stress: r.stress_index,
  dd: r.observables_marche.drawdown_brvmc_pct,
  brvmc: r.observables_marche.brvmc_cloture,
}));
const reperes = reperesFenetre(serie.map((p) => ({ date: p.date, valeur: p.stress })), dateSommet);
```

- titre « La tension, séance après séance » ; sous-titre « Repères : 25 modérée · 50 élevée · 75 extrême. Survolez la courbe pour le détail d'une séance. » ; boutons `PERIODES.map` (libellé `p.libelle`, style actuel).
- conteneur : `role="img"`, `aria-label={`Évolution de l'indice de tension, ${choix.libelle.toLowerCase()}`}`, hauteur 280 px.
- info-bulle :

```tsx
<p className="font-semibold text-ivory">{fmtDateCourte(pt.date)}</p>
<p className="tabular text-ivory">Tension : {fmtNumber(pt.stress, 1)} / 100 ({NIVEAUX_COURTS[regimeDe(pt.stress)]})</p>
<p className="tabular text-muted">Composite : {fmtNumber(pt.brvmc, 2)} pts</p>
<p className="tabular text-muted">Recul depuis le plus haut : {fmtNumber(Math.abs(pt.dd), 2)} %</p>
```

- après `<Area … />` :

```tsx
{reperes.map((r) => (
  <ReferenceDot
    key={`${r.date}-${r.libelle}`}
    x={r.date}
    y={r.valeur}
    r={4}
    fill={theme.accent}
    stroke={theme.surface}
    label={{ value: r.libelle, position: 'top', fill: theme.muted, fontSize: 11 }}
  />
))}
```

### Task 5 : page — bulletin en tête, détail en dessous

**Modify** `frontend/app/stress-monitor/page.tsx` :

1. imports : `construireBulletin, DEFINITIONS_COMPOSANTES` (`@/lib/stress/bulletin`), `BulletinMarche`, `InfoTerme`.
2. `chargerStressIndexOverview(sb, 180)` → `chargerStressIndexOverview(sb, 750)`.
3. après `const obs = …` :

```tsx
const bulletin = stressActuel
  ? construireBulletin({
      actuel: stressActuel,
      historique: stressOverview.historique,
      composite: brvmc ? { drawdownPct: brvmc.drawdown_pct, dateSommet: brvmc.date_sommet } : null,
      criseProche:
        enCours && plusSimilaire?.similarite_actuelle != null
          ? { libelle: plusSimilaire.libelle, ressemblance: plusSimilaire.similarite_actuelle }
          : null,
    })
  : null;
```

4. dans `<div className="mt-8 space-y-8">`, avant la zone A :

```tsx
{bulletin && stressActuel && <BulletinMarche b={bulletin} dateSeance={stressActuel.date_marche} />}

<div className="rounded-panel border border-border bg-surface p-5">
  <StressHistoriqueChart historique={stressOverview.historique} dateSommet={brvmc?.date_sommet ?? null} />
</div>

<div className="border-t border-border pt-6">
  <h2 className="font-display text-xl font-semibold text-ivory">Le détail, pour les initiés</h2>
  <p className="mt-1 text-xs text-muted">Les mesures complètes, leurs poids et l&apos;historique des épisodes de baisse.</p>
</div>
```

5. zone A, grille des six composantes : le libellé devient

```tsx
<span className="inline-flex items-center gap-1.5 font-medium text-ivory">
  {LIBELLES_COMPOSANTES_STRESS[cle]}
  <InfoTerme terme={LIBELLES_COMPOSANTES_STRESS[cle]} definition={DEFINITIONS_COMPOSANTES[cle]} />
</span>
```

6. zone B : le graphique a monté ; la grille `lg:grid-cols-3` ne garde que le panneau « Épisode en cours », en pleine largeur (`<dl>` en `grid-cols-2 lg:grid-cols-4`).

### Task 6 : e2e de la page

Créer `frontend/e2e/stress-bulletin.spec.ts` :

```ts
import { test, expect } from '@playwright/test';

/** Bulletin du marché : page publique (clé anonyme), exécutable en CI. */
test.describe('Stress Monitor : bulletin du marché', () => {
  test('le haut de page résume la tension en clair', async ({ page }) => {
    await page.goto('/stress-monitor', { waitUntil: 'domcontentloaded' });
    const bulletin = page.locator('section[aria-labelledby="bulletin-titre"]');
    test.skip((await bulletin.count()) === 0, 'Aucune donnée de tension en base.');
    await expect(bulletin.getByRole('heading', { level: 2 })).toHaveText(/^Le marché est /);
    await expect(bulletin.getByRole('meter')).toBeVisible();
    await expect(bulletin.getByRole('heading', { name: /^Pourquoi \d+ \?$/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Le détail, pour les initiés' })).toBeVisible();
  });

  test('aucun débordement horizontal à 360 px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/stress-monitor', { waitUntil: 'networkidle' });
    const deborde = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(deborde).toBe(false);
  });
});
```

### Task 7 : vérifier et livrer la PR 1

- [ ] `npx vitest run lib/stress` → vert ; `npx tsc --noEmit -p .` → 0 erreur.
- [ ] `npm run build` puis `npx playwright test e2e/stress-bulletin.spec.ts` → verts.
- [ ] Captures `/stress-monitor` (1440 px, 360 px, clair, sombre) ; relire.
- [ ] Commit, push, PR, CI verte, fusion, vérification en production.

---

## PR 2 — Landing : thermomètre et « Apprendre »

### Task 8 : courbe et parcours (purs, TDD)

Créer `frontend/lib/vitrine/landingPur.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { parcoursDepuis, pointsCourbe } from './landingPur';

describe('pointsCourbe', () => {
  it('axe vertical fixe 0-100 : la hauteur dit la tension', () => {
    expect(pointsCourbe([0, 100], 100, 50)).toBe('0.0,50.0 100.0,0.0');
    expect(pointsCourbe([50, 50, 50], 100, 40)).toBe('0.0,20.0 50.0,20.0 100.0,20.0');
  });
  it('moins de deux points ou valeurs non finies : courbe vide ou filtrée', () => {
    expect(pointsCourbe([42], 100, 50)).toBe('');
    expect(pointsCourbe([Number.NaN, 0, 100], 100, 50)).toBe('0.0,50.0 100.0,0.0');
  });
});

describe('parcoursDepuis', () => {
  const lignes = [
    { niveau: 'expert', content: { lessons: [1, 2, 3, 4, 5] } },
    { niveau: 'debutant', content: { lessons: new Array(11).fill(0) } },
    { niveau: 'avance', content: { lessons: new Array(8).fill(0) } },
    { niveau: 'intermediaire', content: { lessons: new Array(18).fill(0) } },
  ];
  it('quatre niveaux, dans l’ordre du parcours', () => {
    expect(parcoursDepuis(lignes)).toEqual([
      { niveau: 'debutant', lecons: 11 },
      { niveau: 'intermediaire', lecons: 18 },
      { niveau: 'avance', lecons: 8 },
      { niveau: 'expert', lecons: 5 },
    ]);
  });
  it('un niveau manquant ou vide : rien (jamais un parcours partiel)', () => {
    expect(parcoursDepuis(lignes.slice(1))).toBeNull();
    expect(parcoursDepuis([...lignes.slice(1), { niveau: 'expert', content: { lessons: [] } }])).toBeNull();
    expect(parcoursDepuis([...lignes, { niveau: 'inconnu', content: null }])).toHaveLength(4);
  });
});
```

Créer `frontend/lib/vitrine/landingPur.ts` :

```ts
/** Calculs purs des sections « thermomètre » et « Apprendre » de la landing (testés). */
import { NIVEAUX, type Niveau } from '@/lib/academy/types';

/** Points SVG d'une courbe 0-100 sur un axe vertical FIXE (la hauteur dit la tension, pas l'amplitude locale). */
export function pointsCourbe(valeurs: readonly number[], largeur: number, hauteur: number): string {
  const v = valeurs.filter((x) => Number.isFinite(x));
  if (v.length < 2) return '';
  const pas = largeur / (v.length - 1);
  return v
    .map((x, i) => `${(i * pas).toFixed(1)},${(hauteur - (Math.min(100, Math.max(0, x)) / 100) * hauteur).toFixed(1)}`)
    .join(' ');
}

/** Nom court de chaque niveau, tel qu'il figure dans les adresses des cours. */
export const NOMS_NIVEAUX: Record<Niveau, string> = {
  debutant: 'Initiation',
  intermediaire: 'Fondamental',
  avance: 'Technique',
  expert: 'Expert',
};

export interface NiveauParcours {
  niveau: Niveau;
  lecons: number;
}

/** Nombre de leçons par niveau, dans l'ordre du parcours ; null si un niveau manque (jamais de parcours partiel). */
export function parcoursDepuis(
  lignes: readonly { niveau: string | null; content: { lessons?: unknown } | null }[],
): NiveauParcours[] | null {
  const parNiveau = new Map<Niveau, number>();
  for (const l of lignes) {
    if (!l.niveau || !(NIVEAUX as readonly string[]).includes(l.niveau)) continue;
    const n = Array.isArray(l.content?.lessons) ? (l.content!.lessons as unknown[]).length : 0;
    if (n > 0) parNiveau.set(l.niveau as Niveau, (parNiveau.get(l.niveau as Niveau) ?? 0) + n);
  }
  if (!NIVEAUX.every((n) => parNiveau.has(n))) return null;
  return NIVEAUX.map((niveau) => ({ niveau, lecons: parNiveau.get(niveau)! }));
}
```

### Task 9 : chargeurs

Créer `frontend/lib/vitrine/thermometre.ts` :

```ts
import { createPublicClient } from '@/lib/supabase/public';
import { construireBulletin, phraseAmpleur, type Bulletin } from '@/lib/stress/bulletin';
import type { StressDailyRow } from '@/lib/stress/stressIndexTypes';

export interface DonneesThermometre {
  bulletin: Bulletin;
  date: string;
  phrase: string | null;
  serie: number[];
}

/** Les 130 dernières séances de l'indice de tension (clé publique). Null sur erreur ou table vide : la section disparaît. */
export async function chargerThermometre(): Promise<DonneesThermometre | null> {
  try {
    const { data, error } = await createPublicClient()
      .from('stress_daily_index')
      .select('*')
      .order('date_marche', { ascending: false })
      .limit(130);
    if (error || !data || data.length === 0) return null;
    const lignes = (data as StressDailyRow[])
      .map((r) => ({ ...r, date_marche: String(r.date_marche).slice(0, 10), stress_index: Number(r.stress_index) }))
      .reverse();
    const actuel = lignes[lignes.length - 1];
    if (!Number.isFinite(actuel.stress_index)) return null;
    return {
      bulletin: construireBulletin({ actuel, historique: lignes }),
      date: actuel.date_marche,
      phrase: phraseAmpleur(actuel),
      serie: lignes.map((l) => l.stress_index),
    };
  } catch {
    return null;
  }
}
```

Créer `frontend/lib/vitrine/apprendre.ts` :

```ts
import { unstable_cache } from 'next/cache';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { parcoursDepuis, type NiveauParcours } from './landingPur';

/**
 * Nombre de leçons par niveau. Le contenu des cours n'est pas lisible à la clé publique :
 * lecture côté serveur (clé service, jamais exposée), mise en cache 24 h (≈ 745 ko lus).
 * Null sur erreur (ex. CI sans clé) : la ligne du parcours disparaît.
 */
const lireParcours = unstable_cache(
  async (): Promise<NiveauParcours[] | null> => {
    try {
      const { data, error } = await getServiceClient()
        .from('academy_courses')
        .select('niveau, content')
        .eq('published', true)
        .like('slug', 'academy-niveau-%');
      if (error || !data) return null;
      return parcoursDepuis(data as { niveau: string | null; content: { lessons?: unknown } | null }[]);
    } catch {
      return null;
    }
  },
  ['vitrine-apprendre-parcours'],
  { revalidate: 86400 },
);

export async function chargerParcours(): Promise<NiveauParcours[] | null> {
  return lireParcours();
}
```

### Task 10 : sections et styles

Créer `frontend/components/vitrine/SectionThermometre.tsx` :

```tsx
import Link from 'next/link';
import { Apparition } from './mouvement/Apparition';
import { pointsCourbe } from '@/lib/vitrine/landingPur';
import { fmtDateCourte } from '@/lib/format';
import type { DonneesThermometre } from '@/lib/vitrine/thermometre';

const PAS_CONSEIL = 'Pas un conseil en investissement.';

/** Le thermomètre du marché (spec 2026-11-28) : textes issus de lib/stress/bulletin.ts ; absent sans donnée. */
export function SectionThermometre({ t }: { t: DonneesThermometre | null }) {
  if (!t) return null;
  const b = t.bulletin;
  const pos = Math.min(100, Math.max(0, b.note));
  const points = pointsCourbe(t.serie, 600, 90);
  return (
    <section id="thermometre" className="bande-sombre v-bloc v-bloc--serre" aria-labelledby="h-thermometre">
      <div className="v-colonne">
        <Apparition className="v-tete-section">
          <p className="v-surtitre">Le thermomètre du marché</p>
          <h2 id="h-thermometre" className="v-section v-section--petit">
            Le marché est-il nerveux ? <span className="vitrine-accent">{b.reponse}</span>
          </h2>
        </Apparition>
        <div className="v-thermo">
          <p className="v-thermo-note v-mono">
            {b.note}
            <span className="v-thermo-sur">/100</span>
          </p>
          <div
            className="v-thermo-jauge"
            role="meter"
            aria-label="Indice de tension du marché"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pos}
            aria-valuetext={`${pos} sur 100, tension ${b.niveau}`}
          >
            <span className="v-thermo-repere" style={{ left: `${pos}%` }} aria-hidden="true" />
          </div>
          <p className="v-thermo-phrase">
            Tension {b.niveau}.{t.phrase ? ` ${t.phrase}` : ''}
          </p>
          {points && (
            <svg className="v-thermo-courbe" viewBox="0 0 600 90" preserveAspectRatio="none" aria-hidden="true">
              <polyline points={points} />
            </svg>
          )}
          <p className="v-note">
            Séance du {fmtDateCourte(t.date)} · indice de tension WESTBOURSE, calculé chaque soir depuis les cours de la
            BRVM. {PAS_CONSEIL}
          </p>
          <Link href="/stress-monitor" className="v-bouton-second v-thermo-lien">
            Comprendre la tension du marché
          </Link>
        </div>
      </div>
    </section>
  );
}
```

Créer `frontend/components/vitrine/SectionApprendre.tsx` :

```tsx
import Link from 'next/link';
import { Apparition } from './mouvement/Apparition';
import { LECON0 } from '@/lib/academy/lecon0';
import { GUIDE_SGI } from '@/lib/academy/guideSgi';
import { lienOffre, offreDuCours } from '@/lib/academy/leconsOffertes';
import { NOMS_NIVEAUX, type NiveauParcours } from '@/lib/vitrine/landingPur';

/** La formation sur la landing (spec 2026-11-28) : vidéo Leçon 0, entrées gratuites, parcours certifiant. */
export function SectionApprendre({ parcours }: { parcours: NiveauParcours[] | null }) {
  const n1 = offreDuCours('academy-niveau-1-initiation');
  const n2 = offreDuCours('academy-niveau-2-fondamental');
  const entrees = [
    n1 ? { href: lienOffre(n1), titre: 'Leçon 1 interactive', detail: 'Ouverte à tous' } : null,
    n2 ? { href: lienOffre(n2), titre: 'Cas réel : les comptes 2025 de Sonatel', detail: 'Avec un compte gratuit' } : null,
    { href: GUIDE_SGI.chemin, titre: 'Guide vidéo : choisir sa SGI', detail: `Vidéo de ${GUIDE_SGI.duree}` },
  ].filter((e): e is { href: string; titre: string; detail: string } => e !== null);
  const total = parcours ? parcours.reduce((s, p) => s + p.lecons, 0) : null;
  return (
    <section id="apprendre" className="bande-claire v-bloc" aria-labelledby="h-apprendre">
      <div className="v-colonne">
        <Apparition className="v-tete-section">
          <p className="v-surtitre">La formation</p>
          <h2 id="h-apprendre" className="v-section v-section--moyen">
            Apprendre à investir à la BRVM. <span className="vitrine-accent">Commencez gratuitement.</span>
          </h2>
        </Apparition>
        <div className="v-apprendre">
          <figure className="v-apprendre-video">
            <video controls preload="none" playsInline poster={LECON0.affiche} aria-label={`Leçon 0 : ${LECON0.titre}`}>
              <source src={LECON0.video} type="video/mp4" />
            </video>
            <figcaption className="v-note">
              Leçon 0 · {LECON0.titre} · {LECON0.duree}
            </figcaption>
          </figure>
          <div className="v-apprendre-entrees">
            {entrees.map((e) => (
              <Link key={e.href} href={e.href} className="v-apprendre-entree">
                <span className="v-apprendre-titre">{e.titre}</span>
                <span className="v-apprendre-detail">{e.detail}</span>
              </Link>
            ))}
          </div>
        </div>
        {parcours && total != null && (
          <p className="v-apprendre-parcours">
            {parcours.map((p, i) => (
              <span key={p.niveau}>
                {i > 0 && <span aria-hidden="true"> → </span>}
                {NOMS_NIVEAUX[p.niveau]} <span className="v-mono">({p.lecons})</span>
              </span>
            ))}
            <span> · {total} leçons · un examen et un certificat à chaque niveau</span>
          </p>
        )}
        <div className="v-cta-duo v-apprendre-actions">
          {n1 && (
            <Link href={lienOffre(n1)} className="v-bouton">
              Commencer la Leçon 1
            </Link>
          )}
          <Link href="/formations/academy" className="v-bouton-second">
            Voir le programme
          </Link>
        </div>
      </div>
    </section>
  );
}
```

**Modify** `frontend/components/vitrine/vitrine.css` — ajouter à la fin :

```css
/* ── Thermomètre du marché (spec 2026-11-28) ─────────────────────────── */
.vitrine .v-thermo { display: grid; gap: 14px; margin-top: 28px; max-width: 720px; }
.vitrine .v-thermo-note { margin: 0; font-size: clamp(56px, 8vw, 96px); font-weight: 600; line-height: 1; letter-spacing: -.05em; }
.vitrine .v-thermo-sur { font-size: .3em; color: rgb(var(--color-faint)); letter-spacing: 0; margin-left: 4px; }
.vitrine .v-thermo-jauge { position: relative; height: 10px; border-radius: 999px; background: linear-gradient(90deg, rgb(var(--color-accent) / .12), rgb(var(--color-accent) / .95)); }
.vitrine .v-thermo-repere { position: absolute; top: -5px; width: 4px; height: 20px; border-radius: 2px; background: rgb(var(--color-ivory)); transform: translateX(-50%); }
.vitrine .v-thermo-phrase { margin: 0; font-size: 17px; line-height: 1.45; color: rgb(var(--color-muted)); }
.vitrine .v-thermo-courbe { width: 100%; height: 90px; display: block; }
.vitrine .v-thermo-courbe polyline { fill: none; stroke: rgb(var(--color-accent)); stroke-width: 2; vector-effect: non-scaling-stroke; }
.vitrine .v-thermo-lien { justify-self: start; }

/* ── Section « Apprendre » (spec 2026-11-28) ─────────────────────────── */
.vitrine .v-apprendre { display: grid; gap: 20px; margin-top: 32px; }
@media (min-width: 900px) { .vitrine .v-apprendre { grid-template-columns: 1.3fr 1fr; align-items: start; } }
.vitrine .v-apprendre-video { margin: 0; display: grid; gap: 8px; }
.vitrine .v-apprendre-video video { width: 100%; aspect-ratio: 16 / 9; border-radius: 14px; background: rgb(var(--color-sunken)); }
.vitrine .v-apprendre-entrees { display: grid; gap: 12px; }
.vitrine .v-apprendre-entree { display: grid; gap: 2px; padding: 16px 18px; border: 1px solid rgb(var(--color-border-strong)); border-radius: 14px; background: rgb(var(--color-surface)); color: inherit; text-decoration: none; transition: border-color .2s; }
.vitrine .v-apprendre-entree:hover { border-color: rgb(var(--color-accent-ink)); }
.vitrine .v-apprendre-titre { font-weight: 600; font-size: 17px; }
.vitrine .v-apprendre-detail { font-size: 14px; color: rgb(var(--color-up)); }
.vitrine .v-apprendre-parcours { margin: 24px 0 0; font-size: 15px; line-height: 1.6; color: rgb(var(--color-muted)); }
.vitrine .v-apprendre-actions { margin-top: 20px; }
```

### Task 11 : branchement dans `app/page.tsx`

- imports : `chargerThermometre` (`@/lib/vitrine/thermometre`), `chargerParcours` (`@/lib/vitrine/apprendre`), `SectionThermometre`, `SectionApprendre`.
- `Promise.all` : ajouter `chargerThermometre()` et `chargerParcours()` en fin de liste, `thermometre, parcours` en fin de déstructuration.
- JSX : `<SectionThermometre t={thermometre} />` juste après `<Indice … />` ; `<SectionApprendre parcours={parcours} />` juste après `<SectionMethode … />`.

### Task 12 : e2e landing

Créer `frontend/e2e/landing-sections.spec.ts` :

```ts
import { test, expect } from '@playwright/test';

/** Landing : thermomètre du marché et section « Apprendre » (spec 2026-11-28). */
test.describe('landing : thermomètre et formation', () => {
  test('le thermomètre suit l’indice et mène au Stress Monitor', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const t = page.locator('#thermometre');
    test.skip((await t.count()) === 0, 'Aucune donnée de tension en base.');
    await expect(t.getByRole('heading', { level: 2 })).toHaveText(/^Le marché est-il nerveux \?/);
    await expect(t.getByRole('meter')).toBeAttached();
    await expect(t.getByRole('link', { name: 'Comprendre la tension du marché' })).toHaveAttribute('href', '/stress-monitor');
  });

  test('la section Apprendre propose la Leçon 1 et le programme', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const a = page.locator('#apprendre');
    await expect(a.getByRole('heading', { level: 2 })).toContainText('Apprendre à investir à la BRVM.');
    await expect(a.getByRole('link', { name: 'Commencer la Leçon 1' })).toHaveAttribute(
      'href',
      '/formations/academy/academy-niveau-1-initiation?lecon=1',
    );
    await expect(a.getByRole('link', { name: 'Voir le programme' })).toHaveAttribute('href', '/formations/academy');
    await expect(a.locator('video')).toHaveAttribute('preload', 'none');
  });
});
```

### Task 13 : vérifier et livrer la PR 2

- [ ] `npx vitest run lib/vitrine lib/stress` → vert (dont `motsInterdits.test.ts`) ; `npx tsc --noEmit -p .` → 0 erreur.
- [ ] `npm run build` puis `npx playwright test e2e/landing-sections.spec.ts e2e/stress-bulletin.spec.ts` → verts.
- [ ] Captures de la landing (1440 px, 390 px) autour des deux sections ; relire.
- [ ] Commit, push, PR, CI verte, fusion, vérification en production.
