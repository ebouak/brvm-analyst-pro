# Correction du backtest — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Éliminer le biais de look-ahead, faire entrer les frais dans la courbe d'equity, supprimer la troncature silencieuse à 1000 séances, et unifier les deux moteurs dupliqués.

**Architecture:** La boucle de `runBacktest` est restructurée en trois temps ordonnés (rendement du jour selon la position de la veille → exécution de l'ordre décidé la veille → le signal du jour devient l'ordre de demain), avec un `ordreEnAttente` portant le délai d'une séance. Le moteur dupliqué du scraper est supprimé plutôt que corrigé en double.

**Tech Stack:** TypeScript strict, vitest (frontend **et** scraper), Next.js 14 App Router, Supabase.

---

## Contraintes d'environnement

- **Ne JAMAIS lancer `npm run build`** — la commande part en arrière-plan et bloque la tâche.
- Garde-fou : `npx tsc --noEmit` depuis `frontend/`, **~5 minutes** → timeout 540000 ms.
- Tests frontend : `npx vitest run <chemin>` (vitest est installé et configuré, `npm test` = `vitest run`).
- Tests scraper : `cd scraper && npm test`.
- Branche `main`, pas de worktree.

## Ligne de base (vérifiée avant rédaction)

`npx vitest run lib/backtest/backtest.test.ts` → **9 tests verts**. Deux d'entre eux
changeront nécessairement de valeur attendue, et c'est normal : le décalage
d'exécution modifie les prix d'entrée et de sortie. Les nouvelles valeurs sont
calculées et fournies en Task 3 — ne pas les deviner.

## Structure des fichiers

| Fichier | Changement |
|---|---|
| `frontend/lib/backtest.ts` | Boucle en 3 temps, frais dans l'equity, annualisation calendaire, dénominateurs unifiés |
| `frontend/lib/backtest/backtest.test.ts` | Nouveaux tests + mise à jour des 2 tests dont les valeurs changent |
| `frontend/app/backtest/page.tsx` | Pagination, fraîcheur, proportion de signaux réels, avertissement d'illiquidité |
| `scraper/src/backtesting/runBacktest.ts` | **Supprimé** |
| `scraper/src/index.ts` | Retrait de l'import, du `case 'backtest'` et de la mention dans l'aide |

---

### Task 1 : Le test de look-ahead (doit échouer)

C'est le test décisif du chantier. **S'il passe du premier coup, c'est qu'il est
mal écrit** — il doit échouer sur le code actuel.

**Files:**
- Modify: `frontend/lib/backtest/backtest.test.ts`

- [ ] **Step 1 : Ajouter le test**

Ajouter ce bloc à la fin de `frontend/lib/backtest/backtest.test.ts` :

```ts
describe('runBacktest — absence de look-ahead', () => {
  it('n’encaisse PAS le mouvement du jour qui a produit le signal', () => {
    // Le signal BUY tombe en i=1, jour où le cours passe de 100 à 110.
    // Ce mouvement est l'ENTRÉE de la décision : il ne peut pas être capté.
    // Exécution au fixing suivant -> entrée à closes[2] = 110.
    const closes = [100, 110, 110, 121];
    const signals = ['HOLD', 'BUY', 'HOLD', 'HOLD'] as const;
    const r = runBacktest({ closes, signals: [...signals], feesPct: 0, slippagePct: 0 });

    // La stratégie ne détient le titre qu'à partir de i=2 : elle capte 110 -> 121,
    // soit +10 %, et non 100 -> 121 (+21 %).
    expect(r.totalReturn).toBeCloseTo(0.10, 3);
    expect(r.trades[0]!.entryIndex).toBe(2);
  });

  it('n’esquive PAS la baisse du jour de vente', () => {
    // SELL en i=2 : la position est encore détenue ce jour-là et subit la baisse.
    // La sortie n'a lieu qu'au fixing suivant, en i=3.
    const closes = [100, 100, 90, 90];
    const signals = ['BUY', 'HOLD', 'SELL', 'HOLD'] as const;
    const r = runBacktest({ closes, signals: [...signals], feesPct: 0, slippagePct: 0 });

    expect(r.trades).toHaveLength(1);
    expect(r.trades[0]!.exitIndex).toBe(3);
    expect(r.totalReturn).toBeCloseTo(-0.10, 3);
  });
});
```

- [ ] **Step 2 : Lancer et CONSTATER l'échec**

Run: `cd frontend && npx vitest run lib/backtest/backtest.test.ts`
Expected: **2 tests en échec**. Le premier montrera `totalReturn` ≈ 0,21 au lieu
de 0,10 — c'est exactement le biais de look-ahead, mesuré. Noter la valeur
observée dans le rapport de tâche : elle chiffre le défaut.

- [ ] **Step 3 : Commit du test rouge**

```bash
git add frontend/lib/backtest/backtest.test.ts
git commit -m "test(backtest): test de look-ahead — echoue volontairement sur le code actuel"
```

---

### Task 2 : Restructurer la boucle

**Files:**
- Modify: `frontend/lib/backtest.ts`

- [ ] **Step 1 : Remplacer le corps de la boucle**

Dans `frontend/lib/backtest.ts`, remplacer tout le bloc allant de
`let equity = 100;` jusqu'à la fermeture de la boucle `for` (actuellement lignes
92 à 156) par :

```ts
  let equity = 100;
  let inPosition = false;
  let entryPrice = 0;
  let entryIndex = 0;

  let peakEquity = 100;
  let maxDrawdown = 0;

  const trades: Trade[] = [];

  // Coût aller (ou retour) d'une transaction : frais + slippage.
  const coutTransaction = feesPct + slippagePct;

  // Ordre décidé la veille, exécuté aujourd'hui à la clôture. Porte le délai
  // d'une séance : on ne peut pas acheter à un cours qui est lui-même l'entrée
  // de la décision.
  let ordreEnAttente: 'BUY' | 'SELL' | null = null;

  for (let i = 0; i < n; i++) {
    // (a) Rendement du jour — dépend de la position détenue DEPUIS LA VEILLE.
    //     C'est cet ordre qui élimine le biais de look-ahead.
    const prec = closes[i - 1];
    const cours = closes[i];
    let dayReturn = 0;
    if (inPosition && i > 0 && prec != null && prec !== 0 && cours != null) {
      dayReturn = (cours - prec) / prec;
    }
    dailyReturns.push(dayReturn);
    equity = equity * (1 + dayReturn);

    // (b) Exécution de l'ordre décidé la veille, à la clôture d'aujourd'hui.
    //     Les frais frappent l'equity : sans cela, totalReturn et maxDrawdown
    //     resteraient bruts alors que les stats par trade sont nettes.
    const prix = cours ?? 0;
    if (ordreEnAttente === 'BUY' && !inPosition) {
      inPosition = true;
      entryIndex = i;
      entryPrice = prix * (1 + coutTransaction);
      equity = equity * (1 - coutTransaction);
    } else if (ordreEnAttente === 'SELL' && inPosition) {
      const prixSortie = prix * (1 - coutTransaction);
      equity = equity * (1 - coutTransaction);
      inPosition = false;
      const tr: Trade = {
        entryIndex,
        exitIndex: i,
        entryPrice,
        exitPrice: prixSortie,
        returnPct: entryPrice !== 0 ? prixSortie / entryPrice - 1 : 0,
        bars: i - entryIndex,
        win: prixSortie > entryPrice,
      };
      if (dates) {
        if (dates[entryIndex] !== undefined) tr.entryDate = dates[entryIndex];
        if (dates[i] !== undefined) tr.exitDate = dates[i];
      }
      trades.push(tr);
    }
    ordreEnAttente = null;

    // (c) Le signal d'aujourd'hui devient l'ordre de demain. Un ordre contraire
    //     REMPLACE le précédent — on ne conserve qu'une intention, la plus
    //     récente. Un signal tombant sur la dernière séance ne s'exécute jamais :
    //     un backtest n'invente pas une transaction qui n'aurait pas eu lieu.
    const signal = signals[i];
    if (signal === 'BUY' && !inPosition) ordreEnAttente = 'BUY';
    else if (signal === 'SELL' && inPosition) ordreEnAttente = 'SELL';

    const pt: { date_index: number; date?: string; value: number } = {
      date_index: i,
      value: equity,
    };
    if (dates && dates[i] !== undefined) pt.date = dates[i];
    equityCurve.push(pt);

    if (equity > peakEquity) peakEquity = equity;
    const drawdown = (peakEquity - equity) / peakEquity;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
```

Supprimer également les déclarations devenues inutiles `let numTrades = 0;`,
`let winningTrades = 0;` et `let closedTrades = 0;` — la Task 4 recalcule ces
grandeurs depuis `trades`.

- [ ] **Step 2 : Adapter la clôture de la position latente**

Remplacer le bloc `if (inPosition) { ... }` (actuellement lignes 182-195) par :

```ts
  // Position encore ouverte en fin de période : trade latent valorisé au dernier
  // cours, frais de sortie inclus pour rester cohérent avec les trades clôturés.
  if (inPosition) {
    const dernier = (closes[n - 1] ?? 0) * (1 - coutTransaction);
    const tr: Trade = {
      entryIndex,
      exitIndex: null,
      entryPrice,
      exitPrice: dernier,
      returnPct: entryPrice !== 0 ? dernier / entryPrice - 1 : 0,
      bars: n - 1 - entryIndex,
      win: dernier > entryPrice,
    };
    if (dates && dates[entryIndex] !== undefined) tr.entryDate = dates[entryIndex];
    trades.push(tr);
  }
```

- [ ] **Step 3 : Lancer le test de look-ahead**

Run: `cd frontend && npx vitest run lib/backtest/backtest.test.ts -t "look-ahead"`
Expected: les 2 tests de look-ahead **passent**. D'autres tests du fichier
échouent encore — c'est attendu, la Task 3 s'en occupe.

- [ ] **Step 4 : Commit**

```bash
git add frontend/lib/backtest.ts
git commit -m "fix(backtest): eliminer le biais de look-ahead et faire entrer les frais dans l'equity"
```

---

### Task 3 : Mettre à jour les deux tests dont les valeurs changent

Les valeurs ci-dessous sont **calculées**, pas devinées. Ne pas les ajuster pour
faire passer le test : si l'observé diffère, c'est l'implémentation qu'il faut
examiner.

**Files:**
- Modify: `frontend/lib/backtest/backtest.test.ts:6-25`

- [ ] **Step 1 : Remplacer le premier test**

Remplacer le bloc `it('enregistre les trades avec rendement net et clôt la position ouverte', ...)` par :

```ts
  it('enregistre les trades avec rendement net et clôt la position ouverte', () => {
    // BUY signalé en i=1, exécuté au fixing suivant (i=2, prix 110).
    // SELL signalé en i=3, exécuté au fixing suivant (i=4, prix 120).
    // Le trade capte donc 110 -> 120 = +9,09 %, et NON 100 -> 120 = +20 % :
    // la hausse 100 -> 110 s'est produite le jour même du signal.
    const closes = [100, 100, 110, 120, 120];
    const signals = ['HOLD', 'BUY', 'HOLD', 'SELL', 'HOLD'] as const;
    const r = runBacktest({ closes, signals: [...signals], feesPct: 0, slippagePct: 0 });
    expect(r.trades).toHaveLength(1);
    expect(r.trades[0]!.entryIndex).toBe(2);
    expect(r.trades[0]!.exitIndex).toBe(4);
    expect(r.trades[0]!.returnPct).toBeCloseTo(0.0909, 3);
    expect(r.trades[0]!.win).toBe(true);
    expect(r.bestTradePct).toBeCloseTo(0.0909, 3);
  });
```

- [ ] **Step 2 : Remplacer le second test**

Remplacer le bloc `it('clôture une position encore ouverte au dernier cours (latent)', ...)` par :

```ts
  it('clôture une position encore ouverte au dernier cours (latent)', () => {
    // BUY signalé en i=1, exécuté en i=2 au prix 130. La série continue jusqu'à
    // 140 : le trade latent vaut donc 130 -> 140 = +7,69 %.
    const closes = [100, 100, 130, 140];
    const signals = ['HOLD', 'BUY', 'HOLD', 'HOLD'] as const;
    const r = runBacktest({ closes, signals: [...signals] });
    expect(r.trades).toHaveLength(1);
    expect(r.trades[0]!.entryIndex).toBe(2);
    expect(r.trades[0]!.exitIndex).toBeNull();
    expect(r.trades[0]!.returnPct).toBeCloseTo(0.0769, 3);
  });
```

- [ ] **Step 3 : Ajouter le test des frais**

Ajouter dans le même `describe` :

```ts
  it('les frais réduisent le rendement TOTAL, pas seulement les stats par trade', () => {
    const closes = [100, 100, 110, 110];
    const signals = ['HOLD', 'BUY', 'HOLD', 'HOLD'] as const;
    const sansFrais = runBacktest({ closes, signals: [...signals], feesPct: 0 });
    const avecFrais = runBacktest({ closes, signals: [...signals], feesPct: 0.01 });
    // Avant correction, les deux totalReturn étaient IDENTIQUES : les frais
    // n'atteignaient jamais la courbe d'equity.
    expect(avecFrais.totalReturn).toBeLessThan(sansFrais.totalReturn);
  });
```

- [ ] **Step 4 : Ajouter les tests des cas limites du délai d'exécution**

La spec tranche explicitement ces deux situations ; sans test, l'implémentation
pourrait dériver sans que personne le voie.

```ts
describe('runBacktest — cas limites du délai d’exécution', () => {
  it('un signal sur la dernière séance n’est jamais exécuté', () => {
    // L'ordre ne peut pas s'exécuter : il n'y a pas de séance suivante.
    // Un backtest n'invente pas une transaction qui n'aurait pas eu lieu.
    const closes = [100, 100, 100];
    const signals = ['HOLD', 'HOLD', 'BUY'] as const;
    const r = runBacktest({ closes, signals: [...signals] });
    expect(r.trades).toHaveLength(0);
    expect(r.totalReturn).toBeCloseTo(0, 6);
  });

  it('un signal contraire REMPLACE l’ordre en attente au lieu de s’empiler', () => {
    // BUY en i=0 puis SELL en i=1, avant toute exécution : l'intention la plus
    // récente l'emporte, et comme aucune position n'est ouverte le SELL est
    // ignoré. Aucun trade ne doit apparaître.
    const closes = [100, 110, 120, 130];
    const signals = ['BUY', 'SELL', 'HOLD', 'HOLD'] as const;
    const r = runBacktest({ closes, signals: [...signals] });
    expect(r.trades).toHaveLength(0);
  });

  it('série de moins de 2 points : résultat vide, aucune exception', () => {
    const r = runBacktest({ closes: [100], signals: ['BUY'] });
    expect(r.trades).toHaveLength(0);
    expect(r.totalReturn).toBe(0);
    expect(r.numTrades).toBe(0);
  });
});
```

- [ ] **Step 5 : Lancer tout le fichier**

Run: `cd frontend && npx vitest run lib/backtest/backtest.test.ts`
Expected: **tous les tests passent** (15 au total).

- [ ] **Step 6 : Commit**

```bash
git add frontend/lib/backtest/backtest.test.ts
git commit -m "test(backtest): valeurs recalculees + cas limites du delai d'execution"
```

---

### Task 4 : Annualisation calendaire et dénominateurs unifiés

**Files:**
- Modify: `frontend/lib/backtest.ts`

- [ ] **Step 1 : Ajouter le champ au type de résultat**

Dans l'interface `BacktestResult`, ajouter après `riskFreeRate: number;` :

```ts
  /** true = annualisé sur le temps calendaire réel ; false = repli 252 séances
   *  (aucune date fournie). L'interface ne doit jamais présenter le repli comme
   *  une mesure. */
  annualisationCalendaire: boolean;
```

Et dans `EMPTY_RESULT`, ajouter `annualisationCalendaire: false,`.

- [ ] **Step 2 : Remplacer le bloc de métriques finales**

Remplacer depuis `const finalEquity = equity;` jusqu'à
`const buyAndHoldReturn = ...` inclus par :

```ts
  const finalEquity = equity;
  const totalReturn = finalEquity / 100 - 1;

  // Annualisation sur le temps RÉELLEMENT écoulé. Sur la BRVM un titre peut
  // coter 40 fois dans l'année : 252/n serait sans rapport avec la réalité.
  // Sans dates, on retombe exactement sur l'ancienne convention (n/252 années
  // donne pow(eq, 252/n)), signalée par annualisationCalendaire=false.
  const premiereDate = dates?.[0];
  const derniereDate = dates?.[n - 1];
  const joursEcoules =
    premiereDate && derniereDate
      ? (Date.parse(derniereDate) - Date.parse(premiereDate)) / 86_400_000
      : NaN;
  const annualisationCalendaire = Number.isFinite(joursEcoules) && joursEcoules > 0;
  const anneesBrutes = annualisationCalendaire ? joursEcoules / 365.25 : n / 252;
  const annees = Math.max(anneesBrutes, 1 / 365.25);   // jamais zéro

  const annualizedReturn = Math.pow(finalEquity / 100, 1 / annees) - 1;

  // Volatilité mise à l'échelle du nombre RÉEL de séances par an.
  const seancesParAn = n / annees;
  const vol = stddev(dailyReturns) * Math.sqrt(seancesParAn);

  const premierCours = closes[0];
  const dernierCours = closes[n - 1];
  const buyAndHoldReturn =
    premierCours != null && premierCours !== 0 && dernierCours != null
      ? (dernierCours - premierCours) / premierCours
      : 0;
```

- [ ] **Step 3 : Unifier les dénominateurs**

Remplacer `const winRate = closedTrades > 0 ? winningTrades / closedTrades : 0;` par :

```ts
  // winRate, avgWinPct et bestTradePct partagent désormais le MÊME tableau
  // `trades`, position latente incluse. Auparavant la position encore ouverte
  // comptait dans les uns et pas dans l'autre.
  const winRate = trades.length > 0 ? trades.filter((t) => t.win === true).length / trades.length : 0;
  const numTrades = trades.length;
```

- [ ] **Step 4 : Remplacer `rfDaily` par une base cohérente**

Remplacer `const rfDaily = Math.pow(1 + riskFreeRate, 1 / 252) - 1;` par :

```ts
  // Taux sans risque ramené à la séance, sur le rythme réel de cotation.
  const rfSeance = Math.pow(1 + riskFreeRate, 1 / Math.max(seancesParAn, 1)) - 1;
```

et, dans le calcul du downside, remplacer `r - rfDaily` par `r - rfSeance`.

- [ ] **Step 5 : Ajouter le champ au retour**

Dans l'objet retourné par `runBacktest`, ajouter `annualisationCalendaire,`
après `riskFreeRate,`.

- [ ] **Step 6 : Ajouter le test d'annualisation**

Ajouter dans `frontend/lib/backtest/backtest.test.ts` :

```ts
describe('runBacktest — annualisation', () => {
  it('annualise sur le temps calendaire quand les dates sont fournies', () => {
    // 3 séances étalées sur 2 ans : un titre très peu liquide.
    const closes = [100, 110, 121];
    const signals = ['BUY', 'HOLD', 'HOLD'] as const;
    const dates = ['2024-01-02', '2025-01-02', '2026-01-02'];
    const r = runBacktest({ closes, signals: [...signals], dates, feesPct: 0 });
    expect(r.annualisationCalendaire).toBe(true);
    // Sans dates, 252/3 aurait donné un rendement annualisé absurde.
    expect(r.annualizedReturn).toBeLessThan(1);
  });

  it('retombe sur la convention 252 sans dates, et le signale', () => {
    const closes = [100, 110, 121];
    const signals = ['BUY', 'HOLD', 'HOLD'] as const;
    const r = runBacktest({ closes, signals: [...signals] });
    expect(r.annualisationCalendaire).toBe(false);
  });

  it('cours nul en série : rendement 0, jamais Infinity', () => {
    const closes = [0, 100, 110];
    const signals = ['BUY', 'HOLD', 'HOLD'] as const;
    const r = runBacktest({ closes, signals: [...signals] });
    expect(Number.isFinite(r.totalReturn)).toBe(true);
    expect(Number.isFinite(r.buyAndHoldReturn)).toBe(true);
  });
});
```

- [ ] **Step 7 : Lancer les tests puis le typecheck**

Run: `cd frontend && npx vitest run lib/backtest/backtest.test.ts`
Expected: tous verts.

Run: `cd frontend && npx tsc --noEmit` (timeout 540000)
Expected: aucune sortie. Si une erreur signale un consommateur de `BacktestResult`
auquel il manque `annualisationCalendaire`, l'ajouter là où l'objet est construit
à la main.

- [ ] **Step 8 : Commit**

```bash
git add frontend/lib/backtest.ts frontend/lib/backtest/backtest.test.ts
git commit -m "fix(backtest): annualisation calendaire, denominateurs unifies, garde division par zero"
```

---

### Task 5 : Pagination des données

**Files:**
- Modify: `frontend/app/backtest/page.tsx:125-157`

- [ ] **Step 1 : Ajouter l'utilitaire de pagination**

Ajouter dans `frontend/app/backtest/page.tsx`, avant le composant :

```tsx
/**
 * PostgREST plafonne toute réponse à 1000 lignes. Sans pagination, un backtest
 * pluriannuel portait silencieusement sur les 1000 premières séances seulement.
 */
async function chargerTout<T>(
  construire: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const LOT = 1000;
  const tout: T[] = [];
  for (let debut = 0; ; debut += LOT) {
    const { data } = await construire(debut, debut + LOT - 1);
    const lot = data ?? [];
    tout.push(...lot);
    if (lot.length < LOT) break;
  }
  return tout;
}
```

- [ ] **Step 2 : Paginer les trois requêtes**

Remplacer le bloc `const [{ data: rows }, { data: sigRows }, { data: idxRows }] = await Promise.all([...]);`
par :

```tsx
    const [priceRowsAll, sigRowsAll, idxRowsAll] = await Promise.all([
      chargerTout<{ cours_jour: number; date_marche: string }>((from, to) => {
        let q = supabase
          .from('brvm_actions_daily')
          .select('cours_jour, date_marche')
          .eq('code', selectedCode)
          .order('date_marche', { ascending: true })
          .not('cours_jour', 'is', null);
        if (fromDate) q = q.gte('date_marche', fromDate);
        if (dateTo) q = q.lte('date_marche', dateTo);
        return q.range(from, to);
      }),
      chargerTout<{ signal: string; date_marche: string }>((from, to) => {
        let q = supabase
          .from('signals_daily')
          .select('signal, date_marche')
          .eq('code', selectedCode)
          .order('date_marche', { ascending: true });
        if (fromDate) q = q.gte('date_marche', fromDate);
        if (dateTo) q = q.lte('date_marche', dateTo);
        return q.range(from, to);
      }),
      chargerTout<{ valeur: number; date_marche: string }>((from, to) => {
        let q = supabase
          .from('brvm_indices_daily')
          .select('valeur, date_marche')
          .eq('code', 'BRVMC')
          .order('date_marche', { ascending: true })
          .not('valeur', 'is', null);
        if (fromDate) q = q.gte('date_marche', fromDate);
        if (dateTo) q = q.lte('date_marche', dateTo);
        return q.range(from, to);
      }),
    ]);
```

- [ ] **Step 3 : Adapter les usages en aval**

Remplacer `const priceRows = (rows ?? []) as { cours_jour: number; date_marche: string }[];`
par `const priceRows = priceRowsAll;`

Remplacer `(sigRows ?? [])` par `sigRowsAll` dans la construction de `signalMap`.

Remplacer toute occurrence restante de `idxRows` par `idxRowsAll`.

- [ ] **Step 4 : Typecheck**

Run: `cd frontend && npx tsc --noEmit` (timeout 540000)
Expected: aucune sortie.

- [ ] **Step 5 : Commit**

```bash
git add "frontend/app/backtest/page.tsx"
git commit -m "fix(backtest): paginer les requetes — la troncature a 1000 seances etait silencieuse"
```

---

### Task 6 : Fraîcheur, proportion de signaux réels, avertissement d'illiquidité

**Files:**
- Modify: `frontend/app/backtest/page.tsx`

- [ ] **Step 1 : Calculer les indicateurs**

Remplacer :

```tsx
      const hasRealSignals = dates.some((d) => signalMap.has(d));
```

par :

```tsx
      // Proportion RÉELLE de signaux : un booléen vrai dès une seule occurrence
      // laissait annoncer « signaux réels » sur une série majoritairement
      // synthétique.
      const nbSignauxReels = dates.filter((d) => signalMap.has(d)).length;
      const hasRealSignals = nbSignauxReels > 0;
```

- [ ] **Step 2 : Exposer les indicateurs au rendu**

Repérer la ligne construisant `result` :

```tsx
      result = { ...runBacktest({ closes, signals, dates, feesPct, slippagePct, riskFreeRate: RISK_FREE_RATE }), hasRealSignals };
```

la remplacer par :

```tsx
      result = {
        ...runBacktest({ closes, signals, dates, feesPct, slippagePct, riskFreeRate: RISK_FREE_RATE }),
        hasRealSignals,
        nbSignauxReels,
        nbSeances: dates.length,
        premiereSeance: dates[0] ?? null,
        derniereSeance: dates[dates.length - 1] ?? null,
      };
```

Et étendre le type `BacktestResultEx`, déclaré ligne 26 de ce même fichier.
Remplacer :

```tsx
type BacktestResultEx = BacktestResult & { hasRealSignals?: boolean };
```

par :

```tsx
type BacktestResultEx = BacktestResult & {
  hasRealSignals?: boolean;
  nbSignauxReels?: number;
  nbSeances?: number;
  premiereSeance?: string | null;
  derniereSeance?: string | null;
};
```

Les champs restent optionnels : `result` est aussi construit ailleurs dans le
fichier (cas sans données), et les rendre obligatoires casserait ces branches.

- [ ] **Step 3 : Afficher le bandeau**

Insérer ce bloc juste AVANT le `<StatPill>` de la ligne 344 (celui qui lit
`result.hasRealSignals`), et remplacer ce StatPill et son contenu par le bandeau —
il devient redondant puisque le bandeau donne la proportion exacte :

```tsx
        {result && (
          <div className="rounded-xl border border-border bg-surface p-3 text-xs text-muted space-y-1">
            <p>
              {result.nbSeances ?? 0} séances utilisées, du {result.premiereSeance ?? '—'} au {result.derniereSeance ?? '—'}.
            </p>
            <p>
              {result.nbSignauxReels ?? 0} séance{(result.nbSignauxReels ?? 0) > 1 ? 's' : ''} sur {result.nbSeances ?? 0}
              {' '}port{(result.nbSignauxReels ?? 0) > 1 ? 'ent' : 'e'} un signal réel
              {(result.nbSignauxReels ?? 0) < (result.nbSeances ?? 0) && ' ; le reste utilise un signal technique de repli'}.
            </p>
            {(result.nbSeances ?? 0) > 0 && (result.nbSeances ?? 0) < 60 && (
              <p className="text-warn">
                ⓘ Moins de 60 séances sur la période : les ratios annualisés (Sharpe, Sortino,
                Calmar, rendement annualisé) reposent sur trop peu d’observations pour être fiables.
              </p>
            )}
            {!result.annualisationCalendaire && (
              <p className="text-warn">
                ⓘ Annualisation approchée sur 252 séances théoriques, faute de dates exploitables.
              </p>
            )}
          </div>
        )}
```

- [ ] **Step 4 : Typecheck**

Run: `cd frontend && npx tsc --noEmit` (timeout 540000)
Expected: aucune sortie.

- [ ] **Step 5 : Commit**

```bash
git add "frontend/app/backtest/page.tsx"
git commit -m "feat(backtest): fraicheur, proportion de signaux reels et avertissement d'illiquidite"
```

---

### Task 7 : Supprimer le moteur dupliqué du scraper

**Files:**
- Delete: `scraper/src/backtesting/runBacktest.ts`
- Modify: `scraper/src/index.ts`

- [ ] **Step 1 : Vérifier une dernière fois l'absence d'usage planifié**

Run: `cd /c/Users/adego/OneDrive/Documents/brvm-analyst-pro && grep -ln "backtest" .github/workflows/*.yml`
Expected: **aucune sortie**. Si un workflow apparaît, STOP — la suppression n'est
plus sûre, signaler et demander.

- [ ] **Step 2 : Supprimer le fichier et le dossier**

```bash
cd /c/Users/adego/OneDrive/Documents/brvm-analyst-pro
git rm -r scraper/src/backtesting
```

- [ ] **Step 3 : Retirer l'import et la commande**

Dans `scraper/src/index.ts` :

- supprimer la ligne `import { runBacktestCmd } from './backtesting/runBacktest.js';`
- supprimer entièrement le bloc `case 'backtest': { ... }` (autour de la ligne 432),
  en conservant `case 'backtest-signals'` qui est une commande distincte
- dans le message d'aide listant les commandes, remplacer `| backtest |` par `| `
  (retirer la mention `backtest` sans toucher à `backtest-signals`)

- [ ] **Step 4 : Vérifier la compilation et les tests du scraper**

Run: `cd scraper && npx tsc --noEmit`
Expected: aucune sortie. Toute référence résiduelle à `runBacktestCmd`
apparaîtrait ici.

Run: `cd scraper && npm test`
Expected: suite verte. Si un test portait sur le moteur supprimé, le supprimer
aussi — il teste du code qui n'existe plus.

- [ ] **Step 5 : Commit**

```bash
git add -A scraper/
git commit -m "refactor(backtest): supprimer le moteur duplique du scraper

Copie de lib/backtest.ts ayant DIVERGE : elle protegeait la division par zero
que le frontend ignorait, et n'appliquait aucun frais. Commande CLI 'backtest'
appelee par aucun cron, dupliquant une fonctionnalite d'exploration interactive.
backtest-signals, qui est autre chose, reste intact."
```

---

### Task 8 : Vérification finale

- [ ] **Step 1 : Toute la suite frontend**

Run: `cd frontend && npx vitest run`
Expected: suite verte. Une régression ailleurs signalerait un consommateur de
`BacktestResult` non adapté.

- [ ] **Step 2 : Typecheck frontend**

Run: `cd frontend && npx tsc --noEmit` (timeout 540000)
Expected: aucune sortie.

- [ ] **Step 3 : Typecheck et tests scraper**

Run: `cd scraper && npx tsc --noEmit && npm test`
Expected: aucune erreur, suite verte.

- [ ] **Step 4 : Rapport**

Indiquer dans le rapport final :

1. la valeur de `totalReturn` observée à l'échec du test de look-ahead en Task 1,
   étape 2 — elle chiffre l'ampleur du biais corrigé ;
2. le nombre de tests avant (9) et après ;
3. le rappel que **les backtests afficheront désormais des performances plus
   basses**, et que c'est le résultat attendu, non une régression.
