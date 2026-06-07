# Analyse Technique — Configuration technique + Tendance

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un panneau "Configuration technique" à la fiche action avec 7 signaux calculés localement (MA20, MACD, DMI, Bollinger, RSI, Stochastique, CCI) et une tendance court terme avec indice de confiance.

**Architecture:** Deux nouveaux indicateurs dans `lib/indicators.ts` (stochasticSeries, cciSeries). Logique de classification dans `lib/technicalSummary.ts` (pur, testable). Composant client `TechnicalSummary.tsx`. Calcul côté serveur dans la page action. Aucune migration SQL, aucun fetch externe.

**Tech Stack:** TypeScript strict, React 18, Next.js 14 App Router, TailwindCSS. Gate de qualité : `npm run typecheck`.

---

## Structure des fichiers

| Fichier | Action |
|---|---|
| `frontend/lib/indicators.ts` | Modifier — ajouter `stochasticSeries`, `cciSeries` |
| `frontend/lib/technicalSummary.ts` | Créer — types + `computeTechnicalSummary` |
| `frontend/components/TechnicalSummary.tsx` | Créer — composant UI |
| `frontend/app/actions/[code]/page.tsx` | Modifier — calculs + rendu |

---

## Task 1 : Indicateurs Stochastique et CCI dans `lib/indicators.ts`

**Files:**
- Modify: `frontend/lib/indicators.ts`

- [ ] **Step 1 : Ajouter `stochasticSeries` à la fin de `frontend/lib/indicators.ts`**

```ts
export interface StochasticPoint {
  k: number | null; // %K lissé
  d: number | null; // %D = SMA(%K)
}

/**
 * Stochastique %K/%D calculé sur closes uniquement (approximation sans H/L).
 * period=14, smoothK=3, smoothD=3 (valeurs classiques).
 * Retourne un tableau aligné sur closes (null en tête tant que la fenêtre n'est pas remplie).
 */
export function stochasticSeries(
  closes: number[],
  period = 14,
  smoothK = 3,
  smoothD = 3,
): StochasticPoint[] {
  const n = closes.length;
  const out: StochasticPoint[] = new Array(n).fill(null).map(() => ({ k: null, d: null }));

  // %K brut
  const rawK: (number | null)[] = new Array(n).fill(null);
  for (let i = period - 1; i < n; i++) {
    const window = closes.slice(i - period + 1, i + 1);
    const lo = Math.min(...window);
    const hi = Math.max(...window);
    rawK[i] = hi === lo ? null : ((closes[i]! - lo) / (hi - lo)) * 100;
  }

  // %K lissé = SMA(rawK, smoothK)
  const smoothedK: (number | null)[] = new Array(n).fill(null);
  for (let i = period + smoothK - 2; i < n; i++) {
    const window = rawK.slice(i - smoothK + 1, i + 1).filter((v): v is number => v != null);
    if (window.length === smoothK) smoothedK[i] = window.reduce((a, b) => a + b, 0) / smoothK;
  }

  // %D = SMA(%K lissé, smoothD)
  for (let i = period + smoothK + smoothD - 3; i < n; i++) {
    const window = smoothedK.slice(i - smoothD + 1, i + 1).filter((v): v is number => v != null);
    const d = window.length === smoothD ? window.reduce((a, b) => a + b, 0) / smoothD : null;
    out[i] = { k: smoothedK[i] ?? null, d };
  }

  return out;
}

/**
 * CCI (Commodity Channel Index) sur closes (approximation : typical price = close).
 * period=20. Retourne tableau aligné sur closes.
 */
export function cciSeries(closes: number[], period = 20): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i++) {
    const window = closes.slice(i - period + 1, i + 1);
    const mean = window.reduce((a, b) => a + b, 0) / period;
    const mad = window.reduce((a, b) => a + Math.abs(b - mean), 0) / period;
    out[i] = mad === 0 ? null : (closes[i]! - mean) / (0.015 * mad);
  }
  return out;
}
```

- [ ] **Step 2 : Vérifier le typecheck**

```bash
cd frontend && npm run typecheck 2>&1 | grep -E "indicators" | head -5
```
Attendu : 0 erreur sur `indicators.ts`.

- [ ] **Step 3 : Commit**

```bash
git add frontend/lib/indicators.ts
git commit -m "feat(indicators): stochasticSeries + cciSeries"
```

---

## Task 2 : Logique `computeTechnicalSummary` dans `lib/technicalSummary.ts`

**Files:**
- Create: `frontend/lib/technicalSummary.ts`

- [ ] **Step 1 : Créer `frontend/lib/technicalSummary.ts`**

```ts
// frontend/lib/technicalSummary.ts
// Logique pure — aucun import React, aucun fetch.

export type SignalDirection = 'up' | 'down' | 'neutral' | 'na';

export interface TechnicalSignal {
  id: 'ma20' | 'macd' | 'dmi' | 'bb' | 'rsi' | 'stoch' | 'cci';
  label: string;
  direction: SignalDirection;
  value: number | null;
  detail: string;
}

export interface TechnicalSummaryResult {
  signals: TechnicalSignal[];
  trend: 'hausse' | 'baisse' | 'neutre';
  confidence: number; // 0–100
  bullCount: number;
  bearCount: number;
  neutCount: number;
}

export interface TechnicalSummaryParams {
  lastClose: number | null;
  ma20Last: number | null;
  macdVal: number | null;
  macdSignal: number | null;
  rsiVal: number | null;
  bbUpper: number | null;
  bbLower: number | null;
  stochK: number | null;
  cci: number | null;
  // DMI — null = données H/L manquantes (affiché N/A)
  dmiPlus: number | null;
  dmiMinus: number | null;
}

function phrase(id: TechnicalSignal['id'], direction: SignalDirection, value: number | null): string {
  const v = value != null ? value.toFixed(2) : '—';
  switch (id) {
    case 'ma20':
      return direction === 'up'
        ? 'Le cours est au-dessus de la moyenne mobile à 20 jours'
        : direction === 'down'
        ? 'Le cours est sous la moyenne mobile à 20 jours'
        : 'Le cours évolue autour de la moyenne mobile à 20 jours';
    case 'macd':
      return direction === 'up'
        ? 'La MACD évolue au-dessus de sa ligne de signal'
        : direction === 'down'
        ? 'La MACD évolue en dessous de sa ligne de signal'
        : 'La MACD est proche de sa ligne de signal';
    case 'dmi':
      if (direction === 'na') return '+DI/-DI indisponibles (données OHLCV manquantes)';
      return direction === 'up'
        ? `+DI (${v}) est au-dessus de -DI : tendance haussière`
        : direction === 'down'
        ? `-DI est au-dessus de +DI : tendance baissière`
        : '+DI et -DI sont proches : la tendance est neutre';
    case 'bb':
      return direction === 'up'
        ? 'Les cours évoluent au-dessus de la bande supérieure de Bollinger'
        : direction === 'down'
        ? 'Les cours évoluent sous la bande inférieure de Bollinger'
        : 'Les cours évoluent dans les bandes de Bollinger';
    case 'rsi':
      return direction === 'up'
        ? `RSI 14j est à ${v} — zone de survente (opportunité)`
        : direction === 'down'
        ? `RSI 14j est à ${v} — zone de surachat (prudence)`
        : `RSI 14j est à ${v} — zone neutre`;
    case 'stoch':
      return direction === 'up'
        ? `Le Stochastique %K est à ${v} — zone de survente`
        : direction === 'down'
        ? `Le Stochastique %K est à ${v} — zone de surachat`
        : `Le Stochastique %K est à ${v} — zone neutre`;
    case 'cci':
      return direction === 'up'
        ? `CCI 20 est à ${v} — momentum positif`
        : direction === 'down'
        ? `CCI 20 est à ${v} — momentum négatif`
        : `CCI 20 est à ${v} — zone neutre`;
  }
}

export function computeTechnicalSummary(p: TechnicalSummaryParams): TechnicalSummaryResult {
  const signals: TechnicalSignal[] = [];

  // MA20
  {
    const dir: SignalDirection =
      p.lastClose == null || p.ma20Last == null ? 'na'
      : p.lastClose > p.ma20Last ? 'up'
      : p.lastClose < p.ma20Last ? 'down'
      : 'neutral';
    signals.push({ id: 'ma20', label: 'MA20', direction: dir, value: p.ma20Last, detail: phrase('ma20', dir, p.ma20Last) });
  }

  // MACD
  {
    const dir: SignalDirection =
      p.macdVal == null || p.macdSignal == null ? 'na'
      : p.macdVal > p.macdSignal ? 'up'
      : p.macdVal < p.macdSignal ? 'down'
      : 'neutral';
    const diff = p.macdVal != null && p.macdSignal != null ? p.macdVal - p.macdSignal : null;
    signals.push({ id: 'macd', label: 'MACD', direction: dir, value: diff, detail: phrase('macd', dir, diff) });
  }

  // DMI
  {
    const dir: SignalDirection =
      p.dmiPlus == null || p.dmiMinus == null ? 'na'
      : p.dmiPlus > p.dmiMinus ? 'up'
      : p.dmiPlus < p.dmiMinus ? 'down'
      : 'neutral';
    signals.push({ id: 'dmi', label: 'DMI', direction: dir, value: p.dmiPlus, detail: phrase('dmi', dir, p.dmiPlus) });
  }

  // Bollinger
  {
    const dir: SignalDirection =
      p.lastClose == null || p.bbUpper == null || p.bbLower == null ? 'na'
      : p.lastClose > p.bbUpper ? 'up'
      : p.lastClose < p.bbLower ? 'down'
      : 'neutral';
    signals.push({ id: 'bb', label: 'Bollinger', direction: dir, value: p.bbUpper, detail: phrase('bb', dir, p.bbUpper) });
  }

  // RSI — convention : survente (<30) = signal UP (opportunité d'achat)
  {
    const dir: SignalDirection =
      p.rsiVal == null ? 'na'
      : p.rsiVal < 30 ? 'up'
      : p.rsiVal > 70 ? 'down'
      : 'neutral';
    signals.push({ id: 'rsi', label: 'RSI(14)', direction: dir, value: p.rsiVal, detail: phrase('rsi', dir, p.rsiVal) });
  }

  // Stochastique
  {
    const dir: SignalDirection =
      p.stochK == null ? 'na'
      : p.stochK < 20 ? 'up'
      : p.stochK > 80 ? 'down'
      : 'neutral';
    signals.push({ id: 'stoch', label: 'Stochastique', direction: dir, value: p.stochK, detail: phrase('stoch', dir, p.stochK) });
  }

  // CCI — >100 = momentum positif (up), <-100 = momentum négatif (down)
  {
    const dir: SignalDirection =
      p.cci == null ? 'na'
      : p.cci > 100 ? 'up'
      : p.cci < -100 ? 'down'
      : 'neutral';
    signals.push({ id: 'cci', label: 'CCI(20)', direction: dir, value: p.cci, detail: phrase('cci', dir, p.cci) });
  }

  // Comptage (exclu 'na')
  const valid = signals.filter((s) => s.direction !== 'na');
  const bullCount = valid.filter((s) => s.direction === 'up').length;
  const bearCount = valid.filter((s) => s.direction === 'down').length;
  const neutCount = valid.filter((s) => s.direction === 'neutral').length;

  const trend: TechnicalSummaryResult['trend'] =
    bullCount > bearCount ? 'hausse'
    : bearCount > bullCount ? 'baisse'
    : 'neutre';

  const confidence = valid.length > 0
    ? Math.round((Math.abs(bullCount - bearCount) / valid.length) * 100)
    : 0;

  return { signals, trend, confidence, bullCount, bearCount, neutCount };
}
```

- [ ] **Step 2 : Vérifier le typecheck**

```bash
cd frontend && npm run typecheck 2>&1 | grep -E "technicalSummary" | head -5
```
Attendu : 0 erreur.

- [ ] **Step 3 : Commit**

```bash
git add frontend/lib/technicalSummary.ts
git commit -m "feat(indicators): computeTechnicalSummary — 7 signaux + tendance + confiance"
```

---

## Task 3 : Composant `TechnicalSummary.tsx`

**Files:**
- Create: `frontend/components/TechnicalSummary.tsx`

- [ ] **Step 1 : Créer `frontend/components/TechnicalSummary.tsx`**

```tsx
'use client';
import type { TechnicalSummaryResult, SignalDirection } from '@/lib/technicalSummary';

function dirIcon(dir: SignalDirection): string {
  switch (dir) {
    case 'up': return '↑';
    case 'down': return '↓';
    case 'neutral': return '→';
    case 'na': return '○';
  }
}

function dirClass(dir: SignalDirection): string {
  switch (dir) {
    case 'up': return 'text-up';
    case 'down': return 'text-down';
    case 'neutral': return 'text-muted';
    case 'na': return 'text-muted opacity-50';
  }
}

function trendColor(trend: TechnicalSummaryResult['trend']): string {
  switch (trend) {
    case 'hausse': return 'bg-up';
    case 'baisse': return 'bg-down';
    case 'neutre': return 'bg-muted';
  }
}

function trendTextClass(trend: TechnicalSummaryResult['trend']): string {
  switch (trend) {
    case 'hausse': return 'text-up';
    case 'baisse': return 'text-down';
    case 'neutre': return 'text-muted';
  }
}

export default function TechnicalSummary({ result }: { result: TechnicalSummaryResult }) {
  const { signals, trend, confidence, bullCount, bearCount } = result;

  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold">⚙️ Configuration technique</h3>

      {/* Signaux */}
      <div className="space-y-1.5">
        {signals.map((s) => (
          <div key={s.id} className="flex items-start gap-2">
            <span className={`text-sm font-bold leading-5 shrink-0 w-4 text-center ${dirClass(s.direction)}`}>
              {dirIcon(s.direction)}
            </span>
            <span className={`text-xs leading-5 ${s.direction === 'na' ? 'text-muted opacity-60 italic' : 'text-white/80'}`}>
              {s.detail}
            </span>
          </div>
        ))}
      </div>

      {/* Tendance + barre de confiance */}
      <div className="border-t border-border/50 pt-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">Tendance court terme :</span>
          <span className={`text-xs font-bold ${trendTextClass(trend)}`}>
            {dirIcon(trend === 'hausse' ? 'up' : trend === 'baisse' ? 'down' : 'neutral')}{' '}
            {trend.charAt(0).toUpperCase() + trend.slice(1)}
          </span>
        </div>

        {/* Barre de confiance */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-border overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${trendColor(trend)}`}
              style={{ width: `${confidence}%` }}
            />
          </div>
          <span className="text-xs text-muted tabular w-8 text-right">{confidence}%</span>
        </div>

        {/* Compteurs */}
        <div className="flex gap-3 text-xs">
          <span className="text-up">↑ {bullCount} haussier{bullCount !== 1 ? 's' : ''}</span>
          <span className="text-down">↓ {bearCount} baissier{bearCount !== 1 ? 's' : ''}</span>
          <span className="text-muted">→ {result.neutCount} neutre{result.neutCount !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier le typecheck**

```bash
cd frontend && npm run typecheck 2>&1 | grep -E "TechnicalSummary" | head -5
```
Attendu : 0 erreur.

- [ ] **Step 3 : Commit**

```bash
git add frontend/components/TechnicalSummary.tsx
git commit -m "feat(ui): composant TechnicalSummary — signaux + barre de confiance"
```

---

## Task 4 : Intégration dans la page action

**Files:**
- Modify: `frontend/app/actions/[code]/page.tsx`

- [ ] **Step 1 : Ajouter les imports en tête du fichier**

Après les imports existants (après la ligne `import brvmLogos from...`), ajouter :

```ts
import { stochasticSeries, cciSeries, bollingerSeries } from '@/lib/indicators';
import { computeTechnicalSummary } from '@/lib/technicalSummary';
import type { TechnicalSummaryResult } from '@/lib/technicalSummary';
import TechnicalSummary from '@/components/TechnicalSummary';
```

- [ ] **Step 2 : Calculer Stochastique, CCI, Bollinger last dans la page**

Dans le composant `InstrumentPage`, après la ligne `const det = detect(validCloses);` (≈ ligne 118), ajouter :

```ts
  // ── Nouveaux indicateurs pour TechnicalSummary ──────────────────────────
  const stochArr = stochasticSeries(validCloses, 14, 3, 3);
  const lastStochPoint = stochArr[stochArr.length - 1] ?? null;
  const lastStochK = lastStochPoint?.k ?? null;

  const cciArr = cciSeries(validCloses, 20);
  const lastCci = cciArr[cciArr.length - 1] ?? null;

  // Bollinger sur toutes les closes valides (pas juste les 20 dernières)
  const bbArr = bollingerSeries(validCloses, 20, 2);
  const lastBbPoint = bbArr[bbArr.length - 1] ?? null;
  const lastBbUpper = lastBbPoint?.upper ?? null;
  const lastBbLower = lastBbPoint?.lower ?? null;

  const lastClose = validCloses[validCloses.length - 1] ?? null;
  const lastMacdPoint = macdByRow[macdByRow.length - 1] ?? null;

  const technicalSummary: TechnicalSummaryResult = computeTechnicalSummary({
    lastClose,
    ma20Last: lastMa20,
    macdVal: lastMacdPoint?.macd ?? null,
    macdSignal: lastMacdPoint?.signal ?? null,
    rsiVal: lastRsi,
    bbUpper: lastBbUpper,
    bbLower: lastBbLower,
    stochK: lastStochK,
    cci: lastCci,
    dmiPlus: null,   // activé quand plus_haut/plus_bas disponibles (plan 0017)
    dmiMinus: null,
  });
```

- [ ] **Step 3 : Insérer le composant dans le JSX**

Trouver le commentaire `{/* ── Indicateurs + Détections ── */}` (≈ ligne 296) et insérer **avant** ce div :

```tsx
      {/* ── Configuration technique ── */}
      <TechnicalSummary result={technicalSummary} />
```

- [ ] **Step 4 : Vérifier le typecheck complet**

```bash
cd frontend && npm run typecheck 2>&1 | head -20
```
Attendu : 0 erreur TypeScript.

- [ ] **Step 5 : Commit + push**

```bash
git add frontend/app/actions/[code]/page.tsx
git commit -m "feat(action): panneau configuration technique — 7 signaux + tendance + confiance"
git push origin main
```

---

## Vérification manuelle post-déploiement

Après `npm run dev`, ouvrir http://localhost:3000/actions/SNTS (ou tout code avec historique > 20 séances) et vérifier :

1. Le panneau "⚙️ Configuration technique" apparaît sous le graphique
2. Les 7 signaux s'affichent avec icônes ↑ / ↓ / → / ○
3. DMI affiche "○" et texte en italique grisé (données H/L manquantes)
4. La barre de confiance a une largeur proportionnelle à `confidence%`
5. Les compteurs "↑ N haussiers / ↓ N baissiers / → N neutres" sont cohérents
6. Pour un code avec peu d'historique (<20 séances) : les signaux affichent "○" (na) sans crash
