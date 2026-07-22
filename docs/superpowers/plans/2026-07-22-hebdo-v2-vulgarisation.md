# Analyse hebdo v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre l'analyse hebdo compréhensible par un public non averti, la livrer en deux formats prêts à poster (LinkedIn/Facebook et WhatsApp), et l'enrichir du fondamental quand il est notable et de la veille quand elle est récente — sans jamais affirmer de causalité.

**Architecture:** Deux nouveaux modules purs testés (`fundamentals.ts`, `context.ts`) alimentent un `narrative.ts` réécrit en langage courant ; `post.ts` compose les deux formats depuis les sections validées ; un second garde-fou `assertNoCausalClaim` complète l'existant. Le worker charge les deux sources supplémentaires et stocke les posts.

**Tech Stack:** TypeScript, Next.js 14 App Router, Supabase, tests `.test.mjs` via `npx tsx --test`, scraper TS ESM (imports `.js`).

**Spec:** `docs/superpowers/specs/2026-07-22-hebdo-v2-vulgarisation-design.md`

---

## Règles transverses (à respecter dans CHAQUE task)

1. **Ne JAMAIS lancer `npm run build`** (il passe en arrière-plan dans cet environnement). Garde-fou = `npx tsc --noEmit` en avant-plan.
2. **Duplication frontend ↔ scraper** : `scraper/src/hebdo/pure/` contient des copies de `frontend/lib/hebdo/`. Toute modification d'un module pur doit être **reportée dans la copie** (Task 8 s'en charge une fois pour toutes ; les tasks intermédiaires ne touchent que le frontend).
3. Les tests vivent dans `frontend/lib/hebdo/hebdo.test.mjs` (17 tests existants — ne jamais les supprimer).

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `frontend/lib/hebdo/format.ts` | `fmtMontant` (millions/milliards) partagé (créé) |
| `frontend/lib/hebdo/fundamentals.ts` | `pickNotableFundamental` (créé) |
| `frontend/lib/hebdo/context.ts` | `pickRecentEvent` (créé) |
| `frontend/lib/hebdo/narrative.ts` | vulgarisation + `assertNoCausalClaim` + section contexte (modifié) |
| `frontend/lib/hebdo/post.ts` | `buildPost` long/court (créé) |
| `frontend/lib/hebdo/hebdo.test.mjs` | tests (modifié) |
| `supabase/migrations/0114_hebdo_posts.sql` | colonnes `post_long`/`post_court` (créé) |
| `scraper/src/hebdo/pure/*` | copies synchronisées (modifié) |
| `scraper/src/hebdo/polish.ts` | + `assertNoCausalClaim` (modifié) |
| `scraper/src/hebdo/runHebdo.ts` | charge fondamentaux + événements, écrit les posts (modifié) |
| `frontend/components/hebdo/CopyPostButton.tsx` | bouton copier (créé) |
| `frontend/app/analyses/hebdo/[date]/page.tsx` | boutons copier (modifié) |

---

### Task 1 : `format.ts` — montants lisibles (TDD)

**Files:** Create `frontend/lib/hebdo/format.ts`; Modify `frontend/lib/hebdo/hebdo.test.mjs`

- [ ] **Step 1 : Ajouter les tests** (à la fin de `hebdo.test.mjs`, avec l'import en haut)

```js
import { fmtMontant } from './format.ts';

test('fmtMontant : milliards, millions, milliers', () => {
  assert.equal(fmtMontant(13075000000), '13,1 milliards FCFA');
  assert.equal(fmtMontant(-96558000), '96,6 millions FCFA');
  assert.equal(fmtMontant(1351000000), '1,4 milliard FCFA');
  assert.equal(fmtMontant(450000), '450 000 FCFA');
});

test('fmtMontant : valeur absolue (le signe est porté par la phrase)', () => {
  assert.equal(fmtMontant(-13075000000), '13,1 milliards FCFA');
});
```

- [ ] **Step 2 : Vérifier l'échec** — `cd frontend && npx tsx --test lib/hebdo/hebdo.test.mjs` → FAIL (module absent).

- [ ] **Step 3 : Implémenter**

```ts
// frontend/lib/hebdo/format.ts
/**
 * Formatage de montants FCFA pour un lecteur non averti : « 96,6 millions FCFA »
 * plutôt que « 96558000 ». PUR, testé. Renvoie toujours la valeur ABSOLUE :
 * le signe (perte / bénéfice) est porté par la phrase qui l'entoure.
 */

const nf1 = (x: number) => x.toFixed(1).replace('.', ',');

export function fmtMontant(montant: number): string {
  const v = Math.abs(montant);
  if (v >= 1_000_000_000) {
    const n = v / 1_000_000_000;
    return `${nf1(n)} ${n >= 2 ? 'milliards' : 'milliard'} FCFA`;
  }
  if (v >= 1_000_000) {
    const n = v / 1_000_000;
    return `${nf1(n)} ${n >= 2 ? 'millions' : 'million'} FCFA`;
  }
  return `${Math.round(v).toLocaleString('fr-FR')} FCFA`;
}
```

- [ ] **Step 4 : Vérifier** — `npx tsx --test lib/hebdo/hebdo.test.mjs` → 19/19 verts. `npx tsc --noEmit` → 0 erreur.

- [ ] **Step 5 : Commit**

```bash
git add frontend/lib/hebdo/format.ts frontend/lib/hebdo/hebdo.test.mjs
git commit -m "feat(hebdo): fmtMontant — montants lisibles (millions/milliards)"
```

---

### Task 2 : `fundamentals.ts` — fondamental notable (TDD)

**Files:** Create `frontend/lib/hebdo/fundamentals.ts`; Modify `frontend/lib/hebdo/hebdo.test.mjs`

- [ ] **Step 1 : Ajouter les tests**

```js
import { pickNotableFundamental } from './fundamentals.ts';

const perte = [{ periode: '2025', resultat_net: -96558000, benefice_par_action: null, dividende_par_action: null }];
const banal = [
  { periode: '2025', resultat_net: 1000000000, benefice_par_action: 100, dividende_par_action: null },
  { periode: '2024', resultat_net: 950000000, benefice_par_action: 95, dividende_par_action: null },
];

test('pickNotableFundamental : une perte est toujours notable', () => {
  const f = pickNotableFundamental(perte, 3000);
  assert.ok(f);
  assert.match(f.phrase, /perte/i);
  assert.match(f.phrase, /96,6 millions/);
  assert.ok(f.chiffres.includes(96.6));
});

test('pickNotableFundamental : bond du benefice >= 30 %', () => {
  const rows = [
    { periode: '2025', resultat_net: 2000000000, benefice_par_action: 200, dividende_par_action: null },
    { periode: '2024', resultat_net: 1000000000, benefice_par_action: 100, dividende_par_action: null },
  ];
  const f = pickNotableFundamental(rows, 3000);
  assert.ok(f);
  assert.match(f.phrase, /progress/i);
});

test('pickNotableFundamental : PER bas (< 5)', () => {
  const rows = [{ periode: '2025', resultat_net: 5000000000, benefice_par_action: 1000, dividende_par_action: null }];
  const f = pickNotableFundamental(rows, 3000); // PER = 3
  assert.ok(f);
  assert.match(f.phrase, /fois les b[ée]n[ée]fices/i);
  assert.match(f.phrase, /bas/i);
});

test('pickNotableFundamental : rendement du dividende >= 6 %', () => {
  const rows = [{ periode: '2025', resultat_net: 5000000000, benefice_par_action: 300, dividende_par_action: 240 }];
  const f = pickNotableFundamental(rows, 3000); // PER = 10 (non notable), rendement = 8 %
  assert.ok(f);
  assert.match(f.phrase, /dividende/i);
});

test('pickNotableFundamental : cas banal → null (pas de remplissage)', () => {
  assert.equal(pickNotableFundamental(banal, 3000), null);
});

test('pickNotableFundamental : aucune donnee → null', () => {
  assert.equal(pickNotableFundamental([], 3000), null);
});
```

- [ ] **Step 2 : Vérifier l'échec** — FAIL (module absent).

- [ ] **Step 3 : Implémenter**

```ts
// frontend/lib/hebdo/fundamentals.ts
/**
 * Éclairage fondamental d'une valeur — PUR, testé. On ne cite un chiffre que
 * s'il est NOTABLE (perte, forte variation, PER extrême, gros rendement) :
 * sinon la section est omise plutôt que remplie de banalités.
 * Seuils validés par le propriétaire produit (spec §3).
 */
import { fmtMontant } from './format';

export interface IncomeRow {
  periode: string;
  resultat_net: number | null;
  benefice_par_action: number | null;
  dividende_par_action: number | null;
}

export interface NotableFundamental {
  phrase: string;
  /** Chiffres à ajouter à la whitelist du garde-fou. */
  chiffres: number[];
}

const VARIATION_NOTABLE = 30; // %
const PER_BAS = 5;
const PER_HAUT = 25;
const RENDEMENT_NOTABLE = 6; // %

const r1 = (x: number) => Math.round(x * 10) / 10;

export function pickNotableFundamental(rows: IncomeRow[], cours: number): NotableFundamental | null {
  const annuels = [...rows]
    .filter((r) => r.periode)
    .sort((a, b) => b.periode.localeCompare(a.periode));
  const dernier = annuels[0];
  if (!dernier) return null;
  const annee = dernier.periode;

  // 1. Perte — toujours notable.
  if (dernier.resultat_net != null && dernier.resultat_net < 0) {
    const montant = fmtMontant(dernier.resultat_net);
    return {
      phrase: `La société a publié une perte de ${montant} sur l'exercice ${annee}.`,
      chiffres: [r1(Math.abs(dernier.resultat_net) / (Math.abs(dernier.resultat_net) >= 1e9 ? 1e9 : 1e6))],
    };
  }

  // 2. Variation du résultat net ≥ 30 %.
  const precedent = annuels[1];
  if (
    dernier.resultat_net != null && dernier.resultat_net > 0 &&
    precedent?.resultat_net != null && precedent.resultat_net > 0
  ) {
    const varPct = ((dernier.resultat_net - precedent.resultat_net) / precedent.resultat_net) * 100;
    if (Math.abs(varPct) >= VARIATION_NOTABLE) {
      const sens = varPct >= 0 ? 'progressé' : 'reculé';
      return {
        phrase: `Son bénéfice a ${sens} de ${Math.abs(r1(varPct))} % sur le dernier exercice (${annee}).`,
        chiffres: [Math.abs(r1(varPct))],
      };
    }
  }

  // 3. PER extrême.
  if (dernier.benefice_par_action != null && dernier.benefice_par_action > 0 && cours > 0) {
    const per = cours / dernier.benefice_par_action;
    if (per < PER_BAS || per > PER_HAUT) {
      const niveau = per < PER_BAS ? 'bas' : 'élevé';
      return {
        phrase: `Le titre se paie ${r1(per)} fois les bénéfices de ${annee}, un niveau ${niveau} pour la cote.`,
        chiffres: [r1(per)],
      };
    }
  }

  // 4. Rendement du dividende.
  if (dernier.dividende_par_action != null && dernier.dividende_par_action > 0 && cours > 0) {
    const rendement = (dernier.dividende_par_action / cours) * 100;
    if (rendement >= RENDEMENT_NOTABLE) {
      return {
        phrase: `Le dividende versé au titre de ${annee} représente ${r1(rendement)} % du cours actuel.`,
        chiffres: [r1(rendement)],
      };
    }
  }

  return null;
}
```

- [ ] **Step 4 : Vérifier** — `npx tsx --test lib/hebdo/hebdo.test.mjs` → 25/25 verts. `npx tsc --noEmit`.

> Si le test « perte » échoue sur `chiffres`, adapter l'assertion du test à la valeur réellement produite (96.6) — l'important est que le nombre affiché dans la phrase figure dans `chiffres`.

- [ ] **Step 5 : Commit**

```bash
git add frontend/lib/hebdo/fundamentals.ts frontend/lib/hebdo/hebdo.test.mjs
git commit -m "feat(hebdo): fondamental notable (perte, variation, PER, rendement) sinon omis"
```

---

### Task 3 : `context.ts` + `assertNoCausalClaim` — veille sans causalité (TDD)

**Files:** Create `frontend/lib/hebdo/context.ts`; Modify `frontend/lib/hebdo/narrative.ts`, `frontend/lib/hebdo/hebdo.test.mjs`

- [ ] **Step 1 : Ajouter les tests**

```js
import { pickRecentEvent } from './context.ts';
import { assertNoCausalClaim } from './narrative.ts';

const evts = [
  { event_date: '2026-07-18', title: 'Résultats semestriels 2026', event_type: 'resultats' },
  { event_date: '2026-05-12', title: 'Avis de convocation AGO', event_type: 'assemblee' },
];

test('pickRecentEvent : retient un evenement dans la fenetre de 14 jours', () => {
  const e = pickRecentEvent(evts, '2026-07-22');
  assert.ok(e);
  assert.match(e.phrase, /Résultats semestriels 2026/);
  assert.match(e.phrase, /18/);
});

test('pickRecentEvent : ecarte un evenement trop ancien', () => {
  const vieux = [{ event_date: '2026-05-12', title: 'Avis de convocation AGO', event_type: 'assemblee' }];
  assert.equal(pickRecentEvent(vieux, '2026-07-22'), null);
});

test('pickRecentEvent : aucun evenement → null', () => {
  assert.equal(pickRecentEvent([], '2026-07-22'), null);
});

test('pickRecentEvent : la phrase ne contient aucun lien de causalite', () => {
  const e = pickRecentEvent(evts, '2026-07-22');
  assert.equal(assertNoCausalClaim(e.phrase), true);
});

test('assertNoCausalClaim : accepte une juxtaposition datee', () => {
  assert.equal(assertNoCausalClaim('À noter : Résultats publiés le 18 juillet 2026.'), true);
});

test('assertNoCausalClaim : REJETTE une causalite affirmee', () => {
  assert.equal(assertNoCausalClaim('Le cours a chuté à cause de la publication.'), false);
  assert.equal(assertNoCausalClaim('La hausse s’explique par les résultats.'), false);
  assert.equal(assertNoCausalClaim('Le titre monte suite à l’annonce.'), false);
});
```

- [ ] **Step 2 : Vérifier l'échec** — FAIL.

- [ ] **Step 3 : Créer `context.ts`**

```ts
// frontend/lib/hebdo/context.ts
/**
 * Contexte d'actualité — PUR, testé. Ne retient qu'un événement RÉCENT et se
 * contente de le JUXTAPOSER au mouvement de cours : jamais de lien de cause à
 * effet (spec §4). Un événement hors fenêtre est écarté, quitte à n'afficher
 * aucun contexte — mieux vaut le silence qu'un rapprochement trompeur.
 */

export interface MarketEventRow {
  event_date: string;
  title: string;
  event_type?: string | null;
}

export interface RecentEvent {
  phrase: string;
  chiffres: number[];
}

const FENETRE_JOURS = 14;

const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** « 2026-07-18 » → « 18 juillet 2026 ». */
function dateLisible(iso: string): { texte: string; jour: number; annee: number } {
  const [a, m, j] = iso.split('-').map((x) => parseInt(x, 10));
  const jour = j ?? 1;
  const annee = a ?? 0;
  return { texte: `${jour} ${MOIS[(m ?? 1) - 1] ?? ''} ${annee}`, jour, annee };
}

function joursEntre(aIso: string, bIso: string): number {
  const a = Date.parse(`${aIso}T00:00:00Z`);
  const b = Date.parse(`${bIso}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.POSITIVE_INFINITY;
  return Math.abs(b - a) / 86_400_000;
}

export function pickRecentEvent(
  events: MarketEventRow[],
  dateEdition: string,
  fenetreJours = FENETRE_JOURS,
): RecentEvent | null {
  const eligibles = events
    .filter((e) => e.event_date && e.title)
    .filter((e) => joursEntre(e.event_date, dateEdition) <= fenetreJours)
    .sort((a, b) => b.event_date.localeCompare(a.event_date));
  const e = eligibles[0];
  if (!e) return null;
  const d = dateLisible(e.event_date);
  return {
    // Gabarit FIGÉ et purement factuel : on énonce, on n'explique pas.
    phrase: `À noter : ${e.title}, publié le ${d.texte}.`,
    chiffres: [d.jour, d.annee],
  };
}
```

- [ ] **Step 4 : Ajouter `assertNoCausalClaim` à `frontend/lib/hebdo/narrative.ts`** (à la suite de `assertNoForeignNumber`)

```ts
/**
 * Connecteurs qui affirment une CAUSE. Un texte d'analyse peut juxtaposer un
 * fait daté et un mouvement de cours ; il ne peut pas prétendre que l'un
 * explique l'autre — nous n'avons aucune donnée qui l'établisse.
 */
const CONNECTEURS_CAUSAUX = [
  'à cause de', 'a cause de',
  'en raison de',
  'suite à', 'suite a',
  'provoqué par', 'provoque par',
  'expliqué par', 'explique par',
  's’explique par', "s'explique par",
  'dû à', 'du à', 'due à',
  'sous l’effet de', "sous l'effet de",
  'grâce à', 'grace a',
  'porté par', 'porte par',
  'plombé par', 'plombe par',
];

/** false si le texte affirme un lien de causalité (→ on rejette la sortie LLM). */
export function assertNoCausalClaim(texte: string): boolean {
  const t = texte.toLowerCase();
  return !CONNECTEURS_CAUSAUX.some((c) => t.includes(c));
}
```

- [ ] **Step 5 : Vérifier** — `npx tsx --test lib/hebdo/hebdo.test.mjs` → 31/31 verts. `npx tsc --noEmit`.

- [ ] **Step 6 : Commit**

```bash
git add frontend/lib/hebdo/context.ts frontend/lib/hebdo/narrative.ts frontend/lib/hebdo/hebdo.test.mjs
git commit -m "feat(hebdo): veille recente juxtaposee + garde-fou anti-causalite"
```

---

### Task 4 : `narrative.ts` — vulgarisation + section contexte (TDD)

**Files:** Modify `frontend/lib/hebdo/narrative.ts`, `frontend/lib/hebdo/types.ts`, `frontend/lib/hebdo/hebdo.test.mjs`

- [ ] **Step 1 : Ajouter les tests**

```js
test('buildSkeleton : le texte est vulgarise (pas de jargon brut)', () => {
  const s = buildSkeleton(metrics);
  const texte = s.sections.map((x) => x.texte).join(' ');
  assert.ok(!/RSI\(14\) s’établit/.test(texte), 'plus de formulation brute du RSI');
  assert.match(texte, /surachet|survendu|tension/i);
  assert.match(texte, /fois plus de titres|habitude/i);
});

test('buildSkeleton : section contexte presente si fondamental notable', () => {
  const s = buildSkeleton(metrics, {
    fondamental: { phrase: 'La société a publié une perte de 96,6 millions FCFA sur l’exercice 2025.', chiffres: [96.6, 2025] },
    evenement: null,
  });
  const ctx = s.sections.find((x) => x.titre === 'Le contexte');
  assert.ok(ctx);
  assert.match(ctx.texte, /perte/);
  assert.ok(s.chiffres.includes(96.6));
});

test('buildSkeleton : pas de section contexte si rien de notable', () => {
  const s = buildSkeleton(metrics, { fondamental: null, evenement: null });
  assert.equal(s.sections.find((x) => x.titre === 'Le contexte'), undefined);
});

test('buildSkeleton : le squelette passe ses deux gardes-fous', () => {
  const s = buildSkeleton(metrics, {
    fondamental: { phrase: 'La société a publié une perte de 96,6 millions FCFA sur l’exercice 2025.', chiffres: [96.6, 2025] },
    evenement: { phrase: 'À noter : Résultats semestriels 2026, publié le 18 juillet 2026.', chiffres: [18, 2026] },
  });
  const texte = s.sections.map((x) => x.texte).join(' ');
  assert.equal(assertNoForeignNumber(texte, s.chiffres), true);
  assert.equal(assertNoCausalClaim(texte), true);
});
```

- [ ] **Step 2 : Vérifier l'échec** — FAIL (signature `buildSkeleton` à un seul argument).

- [ ] **Step 3 : Étendre le type dans `frontend/lib/hebdo/types.ts`** (à la fin du fichier)

```ts
/** Éclairages optionnels injectés dans le narratif (spec §3 et §4). */
export interface HebdoContexte {
  fondamental: { phrase: string; chiffres: number[] } | null;
  evenement: { phrase: string; chiffres: number[] } | null;
}
```

- [ ] **Step 4 : Réécrire les 3 sections de `buildSkeleton`** dans `frontend/lib/hebdo/narrative.ts`. Remplacer la signature et le corps (garder `CONSTANTES_TEXTE`, `pct`, la logique directionnelle des niveaux et le calcul de `verdict`) :

```ts
export function buildSkeleton(m: HebdoMetrics, ctx?: HebdoContexte): Skeleton {
  const sections: { titre: string; texte: string }[] = [];
  const chiffres: number[] = [m.dernier, ...CONSTANTES_TEXTE];

  // 1. Ce qui s'est passé — langage courant, chiffre en appui.
  let s1 = `${m.code} termine la semaine à ${m.dernier} FCFA`;
  if (m.variationHebdo != null) {
    const sens = m.variationHebdo >= 0 ? 'en hausse' : 'en repli';
    s1 += `, ${sens} de ${Math.abs(m.variationHebdo).toFixed(2)} % sur cinq séances`;
    chiffres.push(Math.abs(Math.round(m.variationHebdo * 100) / 100));
  }
  if (m.ratioVolume != null) {
    s1 += `. Il s'est échangé ${m.ratioVolume.toFixed(1)} fois plus de titres que d'habitude, ` +
          `signe que le mouvement a mobilisé du monde`;
    chiffres.push(Math.round(m.ratioVolume * 10) / 10);
  }
  sections.push({ titre: 'Ce qui s’est passé', texte: `${s1}.` });

  // 2. Ce que ça veut dire — on traduit, puis on chiffre.
  if (m.rsiDernier != null) {
    chiffres.push(Math.round(m.rsiDernier * 10) / 10);
    const lecture =
      m.rsiDernier > 70
        ? 'Le titre a beaucoup monté en peu de temps : il est en zone de surachat, ce qui appelle souvent une pause'
        : m.rsiDernier < 30
          ? 'Le titre a beaucoup baissé en peu de temps : il est en zone de survente, où des acheteurs reviennent parfois'
          : 'Le titre n’est ni suracheté ni survendu : la tension reste modérée';
    const macd = m.macdPositif == null ? '' : m.macdPositif
      ? ' La dynamique de fond reste orientée à la hausse.'
      : ' La dynamique de fond reste orientée à la baisse.';
    sections.push({
      titre: 'Ce que ça veut dire',
      texte: `${lecture} (indicateur de tension : ${m.rsiDernier.toFixed(0)} sur 100).${macd}`,
    });
  }

  // 3. Le contexte — uniquement si un éclairage existe (jamais de remplissage).
  const morceaux: string[] = [];
  if (ctx?.fondamental) { morceaux.push(ctx.fondamental.phrase); chiffres.push(...ctx.fondamental.chiffres); }
  if (ctx?.evenement) { morceaux.push(ctx.evenement.phrase); chiffres.push(...ctx.evenement.chiffres); }
  if (morceaux.length > 0) sections.push({ titre: 'Le contexte', texte: morceaux.join(' ') });

  // 4. Les niveaux à surveiller — directionnels, en langage courant.
  if (m.levels) {
    const l = m.levels;
    chiffres.push(l.resistance, l.support);
    let texte: string;
    if (l.cassureBas) {
      chiffres.push(l.objectifBas1, l.objectifBas2);
      texte =
        `Le cours est passé sous son plancher des 20 dernières séances (${l.support} FCFA), ` +
        `un seuil que les acheteurs défendaient jusqu'ici. Les prochains paliers à surveiller ` +
        `sont ${l.objectifBas1} puis ${l.objectifBas2} FCFA. Repasser durablement au-dessus de ` +
        `${l.support} FCFA annulerait ce signal.`;
    } else if (l.cassureHaut) {
      chiffres.push(l.objectif1, l.objectif2, l.invalidation);
      texte =
        `Le cours a dépassé son plafond des 20 dernières séances (${l.resistance} FCFA), ` +
        `un seuil qui bloquait la hausse jusqu'ici. Les prochains paliers sont ${l.objectif1} ` +
        `puis ${l.objectif2} FCFA. Un retour sous ${l.invalidation} FCFA remettrait ce signal en cause.`;
    } else {
      texte =
        `Le cours reste coincé entre ${l.support} et ${l.resistance} FCFA. ` +
        `C'est la sortie de ce couloir qui donnera la direction : au-dessus de ${l.resistance} FCFA ` +
        `pour la hausse, sous ${l.support} FCFA pour la baisse.`;
    }
    sections.push({ titre: 'Les niveaux à surveiller', texte });
  }

  const verdict = m.variationHebdo != null && m.variationHebdo >= 0
    ? 'Dynamique haussière sur la semaine'
    : 'Repli sur la semaine';

  return { sections, chiffres: [...new Set(chiffres.map((x) => Math.round(x * 100) / 100))], verdict };
}
```

Ajouter l'import du type en tête : `import type { HebdoMetrics, HebdoContexte } from './types';`

- [ ] **Step 5 : Vérifier** — `npx tsx --test lib/hebdo/hebdo.test.mjs` → 35/35 verts. Les tests existants qui cherchaient `/cassure|franchi/i` peuvent échouer : adapter **l'attente du test** à la nouvelle formulation (`/plancher|plafond|couloir/i`), la vulgarisation étant précisément l'objet de la task. `npx tsc --noEmit`.

- [ ] **Step 6 : Commit**

```bash
git add frontend/lib/hebdo/narrative.ts frontend/lib/hebdo/types.ts frontend/lib/hebdo/hebdo.test.mjs
git commit -m "feat(hebdo): narratif vulgarise + section contexte optionnelle"
```

---

### Task 5 : `post.ts` — deux formats prêts à poster (TDD)

**Files:** Create `frontend/lib/hebdo/post.ts`; Modify `frontend/lib/hebdo/hebdo.test.mjs`

- [ ] **Step 1 : Ajouter les tests**

```js
import { buildPost } from './post.ts';

test('buildPost long : sections attendues + avertissement', () => {
  const s = buildSkeleton(metrics);
  const p = buildPost(s, metrics, 'long');
  assert.match(p, /^📈 ETIT/);
  assert.match(p, /Ce qui s’est passé/);
  assert.match(p, /Les niveaux à surveiller/);
  assert.match(p, /⚠️/);
  assert.match(p, /pas un conseil/i);
});

test('buildPost court : compact, emojis, avertissement', () => {
  const s = buildSkeleton(metrics);
  const p = buildPost(s, metrics, 'court');
  assert.ok(p.length <= 700, `trop long : ${p.length}`);
  assert.match(p, /^📈 ETIT/);
  assert.match(p, /⚠️/);
});

test('buildPost : emoji baissier pour une valeur en repli', () => {
  const baisse = { ...metrics, variationHebdo: -6.42 };
  const s = buildSkeleton(baisse);
  assert.match(buildPost(s, baisse, 'court'), /^📉/);
});

test('buildPost long : le contexte apparait quand il existe', () => {
  const s = buildSkeleton(metrics, {
    fondamental: { phrase: 'La société a publié une perte de 96,6 millions FCFA sur l’exercice 2025.', chiffres: [96.6, 2025] },
    evenement: null,
  });
  assert.match(buildPost(s, metrics, 'long'), /Le contexte/);
});
```

- [ ] **Step 2 : Vérifier l'échec** — FAIL.

- [ ] **Step 3 : Implémenter**

```ts
// frontend/lib/hebdo/post.ts
/**
 * Compose les deux formats prêts à poster depuis un squelette DÉJÀ validé
 * (donc soumis aux mêmes garde-fous) : `long` pour LinkedIn/Facebook,
 * `court` pour WhatsApp/Telegram. PUR, testé.
 */
import type { Skeleton } from './narrative';
import type { HebdoMetrics } from './types';

export type PostFormat = 'long' | 'court';

const AVERTISSEMENT = '⚠️ Information à but pédagogique — ce n’est pas un conseil en investissement.';

function emoji(m: HebdoMetrics): string {
  return (m.variationHebdo ?? 0) >= 0 ? '📈' : '📉';
}

/** Première phrase d'un texte, pour condenser dans le format court. */
function premierePhrase(texte: string): string {
  const i = texte.search(/[.!?]/);
  return (i > 0 ? texte.slice(0, i + 1) : texte).trim();
}

export function buildPost(sk: Skeleton, m: HebdoMetrics, format: PostFormat): string {
  const tete = `${emoji(m)} ${m.code}`;

  if (format === 'court') {
    const lignes: string[] = [];
    const v = m.variationHebdo;
    lignes.push(`${tete} — ${v == null ? 'stable' : `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)} %`} cette semaine`);
    if (m.ratioVolume != null) {
      lignes.push(`📊 ${m.ratioVolume.toFixed(1)}× plus de titres échangés que d’habitude`);
    }
    const sens = sk.sections.find((s) => s.titre === 'Ce que ça veut dire');
    if (sens) lignes.push(`🔍 ${premierePhrase(sens.texte)}`);
    const ctx = sk.sections.find((s) => s.titre === 'Le contexte');
    if (ctx) lignes.push(`📌 ${premierePhrase(ctx.texte)}`);
    const niv = sk.sections.find((s) => s.titre === 'Les niveaux à surveiller');
    if (niv) lignes.push(`🎯 ${premierePhrase(niv.texte)}`);
    lignes.push(AVERTISSEMENT);
    return lignes.join('\n');
  }

  // Format long : accroche + sections + avertissement.
  const accroche = `${tete} : ${sk.verdict.toLowerCase()}`;
  const corps = sk.sections.map((s) => `${s.titre}\n${s.texte}`).join('\n\n');
  return `${accroche}\n\n${corps}\n\n${AVERTISSEMENT}`;
}
```

- [ ] **Step 4 : Vérifier** — `npx tsx --test lib/hebdo/hebdo.test.mjs` → 39/39 verts. `npx tsc --noEmit`.

- [ ] **Step 5 : Commit**

```bash
git add frontend/lib/hebdo/post.ts frontend/lib/hebdo/hebdo.test.mjs
git commit -m "feat(hebdo): buildPost — formats LinkedIn et WhatsApp prets a poster"
```

---

### Task 6 : Migration `0114` — colonnes des posts

**Files:** Create `supabase/migrations/0114_hebdo_posts.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- ============================================================================
-- 0114_hebdo_posts.sql
-- Deux formats prêts à poster, stockés avec l'item hebdo.
-- Spec : docs/superpowers/specs/2026-07-22-hebdo-v2-vulgarisation-design.md
-- RLS inchangée : héritée de hebdo_items (lecture publique si édition publiée).
-- ============================================================================

alter table public.hebdo_items
  add column if not exists post_long  text not null default '',
  add column if not exists post_court text not null default '';

comment on column public.hebdo_items.post_long is
  'Post prêt à publier (LinkedIn/Facebook), généré depuis le squelette validé.';
comment on column public.hebdo_items.post_court is
  'Post prêt à publier (WhatsApp/Telegram), format condensé avec émojis.';
```

- [ ] **Step 2 : Demander à l'utilisateur d'appliquer la migration** (SQL Editor), suivie de `NOTIFY pgrst, 'reload schema';`. Les tasks 7-9 (code) avancent sans attendre ; la task 10 (run réel) l'exige.

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/0114_hebdo_posts.sql
git commit -m "feat(db): colonnes post_long/post_court sur hebdo_items"
```

---

### Task 7 : Synchroniser les copies du scraper + garde-fou causal

**Files:** Modify `scraper/src/hebdo/pure/*`, `scraper/src/hebdo/polish.ts`

- [ ] **Step 1 : Reporter les modules purs** du frontend vers `scraper/src/hebdo/pure/`, en conservant l'en-tête de copie et en ajoutant l'extension `.js` aux imports internes. Fichiers à copier : `format.ts` (nouveau), `fundamentals.ts` (nouveau), `context.ts` (nouveau), `post.ts` (nouveau), `narrative.ts` (modifié), `types.ts` (modifié).

```bash
cd /c/Users/adego/OneDrive/Documents/brvm-analyst-pro
python - <<'PY'
import io
hdr = ("// COPIE de frontend/lib/hebdo — frontend et scraper sont deux paquets TS distincts\n"
       "// (pas de module partagé dans ce repo). Toute correction doit être reportée des deux côtés.\n")
for name in ('format','fundamentals','context','post','narrative','types'):
    src = io.open(f'frontend/lib/hebdo/{name}.ts', encoding='utf-8').read()
    for mod in ('types','levels','format','narrative','fundamentals','context','post'):
        src = src.replace(f"from './{mod}'", f"from './{mod}.js'")
    io.open(f'scraper/src/hebdo/pure/{name}.ts','w',encoding='utf-8').write(hdr + src)
    print('copie', name)
PY
```

- [ ] **Step 2 : Ajouter le garde-fou causal à `scraper/src/hebdo/polish.ts`.** Après la fonction `assertNoForeignNumber`, ajouter :

```ts
/**
 * Connecteurs causaux — même liste que frontend/lib/hebdo/narrative.ts
 * (dupliquée : paquets séparés). Un texte peut juxtaposer un fait daté et un
 * mouvement de cours, jamais prétendre que l'un explique l'autre.
 */
const CONNECTEURS_CAUSAUX = [
  'à cause de', 'a cause de', 'en raison de', 'suite à', 'suite a',
  'provoqué par', 'provoque par', 'expliqué par', 'explique par',
  's’explique par', "s'explique par", 'dû à', 'du à', 'due à',
  'sous l’effet de', "sous l'effet de", 'grâce à', 'grace a',
  'porté par', 'porte par', 'plombé par', 'plombe par',
];

function assertNoCausalClaim(texte: string): boolean {
  const t = texte.toLowerCase();
  return !CONNECTEURS_CAUSAUX.some((c) => t.includes(c));
}
```

Puis, dans `polishNarrative`, remplacer le bloc de vérification :

```ts
      if (!assertNoForeignNumber(out, chiffres)) {
        logger.warn({ provider: p.provider }, 'hebdo : reformulation rejetée (chiffre étranger) — squelette conservé');
        continue;
      }
      if (!assertNoCausalClaim(out)) {
        logger.warn({ provider: p.provider }, 'hebdo : reformulation rejetée (causalité affirmée) — squelette conservé');
        continue;
      }
```

Et compléter le prompt (après « AUCUNE prévision. ») par :
`` `N'affirme JAMAIS qu'un événement explique un mouvement de cours (pas de « à cause de », « en raison de », « suite à », « grâce à », « porté par »). ` ``

- [ ] **Step 3 : Vérifier** — `cd scraper && npx tsc --noEmit` → 0 erreur.

- [ ] **Step 4 : Commit**

```bash
git add scraper/src/hebdo/pure scraper/src/hebdo/polish.ts
git commit -m "chore(hebdo): synchronise les copies scraper + garde-fou anti-causalite LLM"
```

---

### Task 8 : `runHebdo` — charger fondamentaux et événements, écrire les posts

**Files:** Modify `scraper/src/hebdo/runHebdo.ts`

- [ ] **Step 1 : Ajouter les imports** en tête du fichier :

```ts
import { pickNotableFundamental } from './pure/fundamentals.js';
import { pickRecentEvent } from './pure/context.js';
import { buildPost } from './pure/post.js';
```

- [ ] **Step 2 : Charger les deux sources**, juste après le calcul de `picks` (et avant la boucle d'upsert des items) :

```ts
  // Éclairages : fondamental (si notable) et actualité (si récente) — chargés
  // uniquement pour les valeurs retenues.
  const codes = picks.map((p) => p.code);
  const { data: incomeRows } = await sb
    .from('income_statements')
    .select('code, periode, resultat_net, benefice_par_action, dividende_par_action')
    .in('code', codes)
    .eq('type_periode', 'annuel');
  const { data: eventRows } = await sb
    .from('market_events')
    .select('instrument_code, event_date, title, event_type')
    .in('instrument_code', codes)
    .order('event_date', { ascending: false });

  const incomeByCode = new Map<string, { periode: string; resultat_net: number | null; benefice_par_action: number | null; dividende_par_action: number | null }[]>();
  for (const r of (incomeRows ?? []) as ({ code: string } & { periode: string; resultat_net: number | null; benefice_par_action: number | null; dividende_par_action: number | null })[]) {
    if (!incomeByCode.has(r.code)) incomeByCode.set(r.code, []);
    incomeByCode.get(r.code)!.push(r);
  }
  const eventsByCode = new Map<string, { event_date: string; title: string; event_type?: string | null }[]>();
  for (const r of (eventRows ?? []) as { instrument_code: string; event_date: string; title: string; event_type?: string | null }[]) {
    if (!eventsByCode.has(r.instrument_code)) eventsByCode.set(r.instrument_code, []);
    eventsByCode.get(r.instrument_code)!.push(r);
  }
```

- [ ] **Step 3 : Utiliser les éclairages et générer les posts.** Dans la boucle `for (const p of picks)`, remplacer les lignes qui construisent le squelette et le narratif par :

```ts
    const ctx = {
      fondamental: pickNotableFundamental(incomeByCode.get(p.code) ?? [], metrics.dernier),
      evenement: pickRecentEvent(eventsByCode.get(p.code) ?? [], dateEdition),
    };
    const sk = buildSkeleton(metrics, ctx);
    const sections = await polishNarrative(sk.sections, sk.chiffres, resolveApiKeyForScraper);
    const narratif = sections.map((s) => `## ${s.titre}\n\n${s.texte}`).join('\n\n');
    // Les posts sont composés depuis les sections VALIDÉES : mêmes garanties.
    const skValide = { ...sk, sections };
    const postLong = buildPost(skValide, metrics, 'long');
    const postCourt = buildPost(skValide, metrics, 'court');
```

et compléter l'objet de l'upsert `hebdo_items` avec :

```ts
        post_long: postLong,
        post_court: postCourt,
```

- [ ] **Step 4 : Vérifier** — `cd scraper && npx tsc --noEmit` → 0 erreur ; `NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx src/index.ts hebdo --mock` → exit 0. Ne PAS lancer le run réel tant que la migration `0114` n'est pas appliquée.

- [ ] **Step 5 : Commit**

```bash
git add scraper/src/hebdo/runHebdo.ts
git commit -m "feat(hebdo): worker enrichi (fondamental notable, veille recente) + posts generes"
```

---

### Task 9 : Boutons « Copier » sur la page

**Files:** Create `frontend/components/hebdo/CopyPostButton.tsx`; Modify `frontend/app/analyses/hebdo/[date]/page.tsx`

- [ ] **Step 1 : Créer le bouton**

```tsx
// frontend/components/hebdo/CopyPostButton.tsx
'use client';
import { useState } from 'react';

/** Copie un post prêt à publier dans le presse-papier, avec retour visuel. */
export default function CopyPostButton({ texte, label }: { texte: string; label: string }) {
  const [copie, setCopie] = useState(false);
  if (!texte) return null;

  async function copier() {
    try {
      await navigator.clipboard.writeText(texte);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      setCopie(false);
    }
  }

  return (
    <button type="button" onClick={copier}
      className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition hover:border-accent/40 hover:text-white">
      {copie ? '✓ Copié' : `Copier (${label})`}
    </button>
  );
}
```

- [ ] **Step 2 : Brancher sur la page.** Dans `frontend/app/analyses/hebdo/[date]/page.tsx` :
  a) ajouter l'import `import CopyPostButton from '@/components/hebdo/CopyPostButton';` ;
  b) étendre l'interface `Item` avec `post_long: string; post_court: string;` ;
  c) ajouter `post_long, post_court` à la liste du `.select(...)` de `load()` ;
  d) remplacer le bloc du lien « Télécharger l'image » par :

```tsx
            <div className="flex flex-wrap gap-2">
              <CopyPostButton texte={it.post_long} label="LinkedIn" />
              <CopyPostButton texte={it.post_court} label="WhatsApp" />
              <a href={`/api/hebdo/${e.date}/image?code=${it.code}`} download
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-white">
                ⤓ Télécharger l’image
              </a>
            </div>
```

- [ ] **Step 3 : Vérifier** — `cd frontend && npx tsc --noEmit` → 0 erreur.

- [ ] **Step 4 : Commit**

```bash
git add frontend/components/hebdo/CopyPostButton.tsx "frontend/app/analyses/hebdo/[date]/page.tsx"
git commit -m "feat(hebdo): boutons copier (LinkedIn, WhatsApp) sur la page"
```

---

### Task 10 : Vérifications finales

- [ ] **Step 1 : Tests & types** — `cd frontend && npx tsx --test lib/hebdo/hebdo.test.mjs` (39 verts) puis `npx tsc --noEmit` ; `cd ../scraper && npx tsc --noEmit && npm test` (397 verts, aucune régression).
- [ ] **Step 2 : Run réel** (après application de `0114` + `NOTIFY pgrst, 'reload schema';`) — `cd scraper && NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx src/index.ts hebdo` → édition republiée. Vérifier qu'aucun log « rejetée (causalité affirmée) » ne masque un problème systématique : un rejet ponctuel est sain, 100 % de rejets signale un prompt à corriger.
- [ ] **Step 3 : Contrôle du rendu** — lire un `post_court` et un `post_long` en base :

```bash
curl -s "$SUPABASE_URL/rest/v1/hebdo_items?select=code,post_court&limit=2" -H "apikey: $K" -H "Authorization: Bearer $K"
```

Vérifier : émojis présents, longueur du court ≤ 700 caractères, avertissement présent, aucun jargon brut (« RSI(14) s'établit »).

- [ ] **Step 4 : Docs & push** — ajouter à `CLAUDE.md` §8, sous l'entrée hebdo existante : « v2 : narratif vulgarisé, formats LinkedIn/WhatsApp copiables (`post_long`/`post_court`, migration 0114), fondamental notable + veille ≤ 14 j, garde-fou `assertNoCausalClaim`. » Puis :

```bash
git add CLAUDE.md docs/superpowers/plans/2026-07-22-hebdo-v2-vulgarisation.md
git commit -m "docs: hebdo v2 executee, etat CLAUDE.md"
git push
```

---

## Self-review (fait à la rédaction)

- **Couverture spec** : vulgarisation §2 → Task 4 ; fondamentaux §3 → Tasks 1-2 ; veille + anti-causalité §4 → Tasks 3 et 7 ; formats §5 → Task 5 ; stockage/affichage §6 → Tasks 6, 8, 9 ; garde-fous §7 → Tasks 3 et 7 ; tests §8 → Tasks 1-5 et 10.
- **Placeholders** : aucun TBD. Deux points d'adaptation explicitement bornés avec la conduite à tenir : l'assertion `chiffres` du test « perte » (Task 2 Step 4) et les attentes des tests v1 sur `/cassure|franchi/` devenues obsolètes par la vulgarisation (Task 4 Step 5).
- **Cohérence de types** : `fmtMontant` (Tasks 1, 2) · `IncomeRow`/`NotableFundamental` (Tasks 2, 8) · `MarketEventRow`/`RecentEvent` (Tasks 3, 8) · `HebdoContexte` (Tasks 4, 8) · `Skeleton`/`buildSkeleton(m, ctx?)` (Tasks 4, 5, 8) · `buildPost(sk, m, format)` (Tasks 5, 8) · colonnes `post_long`/`post_court` (Tasks 6, 8, 9).
- **Ordre** : Task 7 (synchronisation des copies) est placée APRÈS toutes les modifications de modules purs (Tasks 1-5) pour ne copier qu'une fois.
