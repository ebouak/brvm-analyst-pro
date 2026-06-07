# Analyse technique — Configuration technique + Tendance — Design

> **Pour les agents:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ajouter un panneau "Configuration technique" à la fiche action `/actions/[code]` : 7 signaux calculés localement (MA20, MACD, DMI, Bollinger, RSI, Stochastique, CCI) + tendance court terme avec indice de confiance.

**Architecture:** Logique pure dans `frontend/lib/technicalSummary.ts` (testable, aucun fetch). Deux nouveaux indicateurs dans `frontend/lib/indicators.ts` (stochasticSeries, cciSeries). Composant client `TechnicalSummary.tsx`. Calcul côté serveur dans `app/actions/[code]/page.tsx`, résultat passé en prop. Aucune dépendance externe, aucune migration SQL.

**Tech Stack:** TypeScript strict, React 18, Next.js 14 App Router, TailwindCSS dark finance.

---

## 1. Nouveaux indicateurs (`frontend/lib/indicators.ts`)

### 1.1 `stochasticSeries(closes, period, smoothK, smoothD)`

- `period` = 14 (lookback min/max)
- `smoothK` = 3 (SMA sur %K brut)
- `smoothD` = 3 (SMA sur %K lissé)
- `%K_raw[i]` = `(close[i] - min(close[i-period+1..i])) / (max - min) * 100`
- Si `max === min` → null (évite division par zéro)
- Retourne `Array<{ k: number | null; d: number | null }>`

### 1.2 `cciSeries(closes, period)`

- `period` = 20
- `typical[i]` = `close[i]` (approximation sans H/L — note dans les commentaires)
- `sma[i]` = moyenne des `period` derniers `typical`
- `mad[i]` = moyenne absolue des déviations sur `period`
- `CCI[i]` = `(typical[i] - sma[i]) / (0.015 * mad[i])`
- Si `mad === 0` → null
- Retourne `(number | null)[]`

---

## 2. Logique summary (`frontend/lib/technicalSummary.ts`)

### Types

```ts
export type SignalDirection = 'up' | 'down' | 'neutral' | 'na';

export interface TechnicalSignal {
  id: string;                  // 'ma20' | 'macd' | 'dmi' | 'bb' | 'rsi' | 'stoch' | 'cci'
  label: string;               // texte affiché
  direction: SignalDirection;
  value: number | null;        // valeur numérique pour affichage (ex: RSI=57.20)
  detail: string;              // phrase descriptive (ex: "RSI 14j à 57.20 — zone neutre")
}

export interface TechnicalSummaryResult {
  signals: TechnicalSignal[];
  trend: 'hausse' | 'baisse' | 'neutre';
  confidence: number;          // 0–100
  bullCount: number;
  bearCount: number;
  neutCount: number;
}
```

### `computeTechnicalSummary(params)`

```ts
params: {
  closes: number[];
  ma20: (number | null)[];
  macd: { macd: number | null; signal: number | null; hist: number | null } | null;
  rsi: number | null;
  bbUpper: number | null;
  bbLower: number | null;
  stochK: number | null;
  stochD: number | null;
  cci: number | null;
  plusHaut?: number[];   // pour DMI futur
  plusBas?: number[];    // pour DMI futur
}
→ TechnicalSummaryResult
```

**Logique par signal :**

| id | Condition ↑ | Condition ↓ | Sinon |
|---|---|---|---|
| `ma20` | `last_close > ma20_last` | `last_close < ma20_last` | neutral |
| `macd` | `macd > signal` | `macd < signal` | neutral |
| `dmi` | `plusHaut/plusBas` dispo ET +DI > -DI | +DI < -DI | `na` si données manquantes |
| `bb` | `last_close > bbUpper` | `last_close < bbLower` | neutral (entre les bandes) |
| `rsi` | `rsi < 30` (survente = opportunité) | `rsi > 70` (surachat = risque) | neutral |
| `stoch` | `stochK < 20` | `stochK > 80` | neutral |
| `cci` | `cci > 100` (surachat = momentum) | `cci < -100` (survente) | neutral |

**Confiance :**
```
valid = signals où direction ≠ 'na'
confidence = |bullCount - bearCount| / valid.length * 100
trend = bullCount > bearCount ? 'hausse' : bearCount > bullCount ? 'baisse' : 'neutre'
```

**Phrases descriptives** (exemples) :
- `ma20` ↑ : "Le cours est au-dessus de la moyenne mobile à 20 jours"
- `rsi` → : `RSI 14j est à ${rsi.toFixed(1)} — zone neutre`
- `cci` ↑ : `CCI 20 est à ${cci.toFixed(1)} — zone de surachat`
- `dmi` na : "+DI/-DI indisponibles (données OHLCV manquantes)"

---

## 3. Composant `TechnicalSummary.tsx`

Composant client (`'use client'`). Props :

```ts
interface Props {
  result: TechnicalSummaryResult;
}
```

**Icônes direction :**
- ↑ vert `text-up` = haussier
- ↓ rouge `text-down` = baissier
- → gris `text-muted` = neutre
- ○ gris pâle = N/A

**Barre de confiance :**
- Barre horizontale colorée selon trend (vert=hausse, rouge=baisse, gris=neutre)
- Largeur = `confidence%`
- Texte : "↑ Hausse — indice de confiance : 62%"

**Position dans la page :** entre le graphique+légende MA et les sections "Indicateurs + Détections" existantes.

---

## 4. Intégration `app/actions/[code]/page.tsx`

Côté serveur (le composant est async) :

1. Importer `stochasticSeries`, `cciSeries` depuis `@/lib/indicators`
2. Importer `computeTechnicalSummary` depuis `@/lib/technicalSummary`
3. Importer `TechnicalSummary` depuis `@/components/TechnicalSummary`

Calculs à ajouter après les indicateurs existants (≈ ligne 115) :

```ts
const stochArr = stochasticSeries(validCloses, 14, 3, 3);
const lastStoch = stochArr[stochArr.length - 1] ?? null;
const cciArr = cciSeries(validCloses, 20);
const lastCci = cciArr[cciArr.length - 1] ?? null;

const lastBb = bollingerSeries(validCloses.slice(-20), 20, 2).slice(-1)[0] ?? null;

const technicalSummary = computeTechnicalSummary({
  closes: validCloses,
  ma20: [lastMa20],
  macd: lastMacd,
  rsi: lastRsi,
  bbUpper: lastBb?.upper ?? null,
  bbLower: lastBb?.lower ?? null,
  stochK: lastStoch?.k ?? null,
  stochD: lastStoch?.d ?? null,
  cci: lastCci,
});
```

Dans le JSX, après la section graphique et avant les indicateurs :

```tsx
<TechnicalSummary result={technicalSummary} />
```

---

## 5. Aucune migration SQL, aucun scraping

Tout est calculé depuis `validCloses` (historique déjà chargé). DMI reste `na` jusqu'à ce que le plan `2026-06-07-action-market-data-events-chart.md` Task 3-4 soit exécuté (colonnes ouverture/plus_haut/plus_bas).

---

## 6. Tests

Fichier `frontend/lib/technicalSummary.test.ts` (vitest) :
- `stochasticSeries` : série de 20 closes → %K et %D dans [0,100], null si max=min
- `cciSeries` : série connue → CCI attendu à ±5%
- `computeTechnicalSummary` : 5 scénarios (tout haussier, tout baissier, mixte, données nulles, DMI na)
