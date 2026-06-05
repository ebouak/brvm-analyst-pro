# Import Fondamentaux par IA (multi-LLM) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Page `/admin/import-fondamentaux` où l'on dépose des PDF d'états financiers, analysés par une cascade LLM (DeepSeek → Mistral → Grok ; vision Mistral/Grok pour scannés), avec garde-fous et écriture en base.

**Architecture:** Extraction PDF côté navigateur (pdf.js : texte, ou images des 6 premières pages si scanné). Relais LLM côté serveur (route API, clés jamais exposées). Garde-fous de magnitude (réutilise `assessQuality`). Écriture via `/api/fundamentals` existante (service_role, `is_manual=true`).

**Tech Stack:** Next.js 14 (App Router), TypeScript strict, `pdfjs-dist`, `react-dropzone`, Supabase auth, fetch vers APIs LLM compatibles OpenAI Chat Completions.

---

## Fichiers

| Fichier | Responsabilité |
|---|---|
| `frontend/lib/import/validate.ts` | Garde-fous magnitude (réutilise assessQuality) |
| `frontend/lib/import/llmProviders.ts` | Types, ordre cascade, parsing JSON tolérant, prompt |
| `frontend/lib/import/pdfClient.ts` | pdf.js : extraire texte OU rendre 6 pages en images |
| `frontend/app/api/extract-llm/route.ts` | Relais serveur : cascade DeepSeek→Mistral→Grok |
| `frontend/components/import/FundamentalReview.tsx` | Formulaire pré-rempli (corrige + enregistre) |
| `frontend/components/import/ImportRow.tsx` | 1 PDF : statut + extraction + review |
| `frontend/components/import/PdfDropzone.tsx` | Drag & drop multi-fichiers |
| `frontend/app/admin/import-fondamentaux/page.tsx` | Page (assemble dropzone + lignes) |
| `frontend/lib/import/validate.test.mjs` | Tests garde-fous |
| `frontend/lib/import/llmProviders.test.mjs` | Tests parsing JSON tolérant |
| `frontend/package.json` | Ajout pdfjs-dist + react-dropzone |

---

## Task 1: Dépendances

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Installer les libs**

Run (depuis `frontend/`): `npm install pdfjs-dist@4.4.168 react-dropzone@14.2.3`
Expected: ajout aux dependencies, aucune erreur.

- [ ] **Step 2: Vérifier le worker pdf.js**

pdf.js 4.x nécessite un worker. On utilisera l'import dynamique du worker bundlé.
Vérifier que le fichier existe :
Run: `ls frontend/node_modules/pdfjs-dist/build/pdf.worker.min.mjs`
Expected: le fichier existe.

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore(import-ia): deps pdfjs-dist + react-dropzone"
```

---

## Task 2: Garde-fous (`validate.ts`)

**Files:**
- Create: `frontend/lib/import/validate.ts`
- Create: `frontend/lib/import/validate.test.mjs`

- [ ] **Step 1: Écrire le test**

```javascript
// frontend/lib/import/validate.test.mjs
import assert from 'node:assert';
import { validateExtraction } from './validate.ts';

// Tout plausible -> auto
const okRes = validateExtraction({
  revenue: 1_923_100, net_income: 413_588, equity: 1_399_263,
  debt_total: null, cash: null, eps: 3420, dividend_per_share: null, shares_outstanding: 100_000_000,
});
assert.equal(okRes.status, 'auto', `attendu auto, eu ${okRes.status}`);
assert.equal(okRes.suspects.length, 0);

// Valeur aberrante (CA=3 en millions => en FCFA 3M, < 1Md => suspect via assessQuality 'revenue')
const badRes = validateExtraction({
  revenue: 3, net_income: 1000, equity: 5000,
  debt_total: null, cash: null, eps: null, dividend_per_share: null, shares_outstanding: null,
});
assert.equal(badRes.status, 'review', `attendu review, eu ${badRes.status}`);
assert.ok(badRes.suspects.includes('revenue'), 'revenue doit être suspect');

console.log('✓ validate tests OK');
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run (depuis `frontend/`): `npx tsx lib/import/validate.test.mjs`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter `validate.ts`**

```typescript
// frontend/lib/import/validate.ts
/**
 * Garde-fous de l'import IA. Les valeurs reçues du LLM sont en MILLIONS de FCFA
 * (sauf eps/shares). On reconvertit en FCFA pour réutiliser assessQuality (qui
 * raisonne en FCFA bruts), et on classe chaque champ. Statut global :
 *  - 'auto'   : aucune valeur suspecte -> écriture directe possible
 *  - 'review' : >= 1 valeur suspecte  -> validation manuelle requise
 */
import { assessQuality } from '@/lib/fundamentals';

export interface FundamentalExtraction {
  revenue: number | null;
  net_income: number | null;
  equity: number | null;
  debt_total: number | null;
  cash: number | null;
  eps: number | null;
  dividend_per_share: number | null;
  shares_outstanding: number | null;
}

export interface ValidationResult {
  status: 'auto' | 'review';
  suspects: string[];   // noms des champs suspects
}

const M = 1_000_000;

export function validateExtraction(x: FundamentalExtraction): ValidationResult {
  const suspects: string[] = [];
  // Champs monétaires : millions -> FCFA pour assessQuality.
  const checks: Array<[string, number | null]> = [
    ['revenue', x.revenue != null ? x.revenue * M : null],
    ['net_income', x.net_income != null ? x.net_income * M : null],
    ['equity', x.equity != null ? x.equity * M : null],
  ];
  for (const [field, fcfa] of checks) {
    if (fcfa != null && assessQuality(field, fcfa) === 'suspect') suspects.push(field);
  }
  return { status: suspects.length === 0 ? 'auto' : 'review', suspects };
}
```

- [ ] **Step 4: Lancer le test (succès attendu)**

Run (depuis `frontend/`): `npx tsx lib/import/validate.test.mjs`
Expected: `✓ validate tests OK`

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/import/validate.ts frontend/lib/import/validate.test.mjs
git commit -m "feat(import-ia): garde-fous magnitude + tests"
```

---

## Task 3: Cascade LLM côté client (`llmProviders.ts`)

**Files:**
- Create: `frontend/lib/import/llmProviders.ts`
- Create: `frontend/lib/import/llmProviders.test.mjs`

Ce module contient les types partagés client/serveur, l'ordre de cascade, le
prompt, et un **parseur JSON tolérant** (les LLM ajoutent parfois du texte
autour du JSON).

- [ ] **Step 1: Écrire le test du parseur**

```javascript
// frontend/lib/import/llmProviders.test.mjs
import assert from 'node:assert';
import { parseLlmJson, TEXT_PROVIDERS, VISION_PROVIDERS } from './llmProviders.ts';

// JSON pur
assert.deepEqual(parseLlmJson('{"revenue": 100}'), { revenue: 100 });
// JSON entouré de texte
assert.deepEqual(parseLlmJson('Voici le résultat:\n```json\n{"revenue": 100}\n```\nFin.'), { revenue: 100 });
// JSON avec préambule sans fence
assert.deepEqual(parseLlmJson('Réponse : {"a": 1, "b": null} merci'), { a: 1, b: null });
// invalide -> null
assert.equal(parseLlmJson('pas de json ici'), null);

// Ordre cascade
assert.deepEqual(TEXT_PROVIDERS, ['deepseek', 'mistral', 'grok']);
assert.deepEqual(VISION_PROVIDERS, ['mistral', 'grok']);

console.log('✓ llmProviders tests OK');
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run (depuis `frontend/`): `npx tsx lib/import/llmProviders.test.mjs`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter `llmProviders.ts`**

```typescript
// frontend/lib/import/llmProviders.ts
/**
 * Types partagés + ordre de cascade + prompt + parseur JSON tolérant pour
 * l'extraction LLM des fondamentaux. Utilisé par le client (orchestration) et
 * le serveur (appel API). Aucune clé ici.
 */
import type { FundamentalExtraction } from './validate';

export type Provider = 'deepseek' | 'mistral' | 'grok';

/** Ordre de priorité (texte) : DeepSeek d'abord. */
export const TEXT_PROVIDERS: Provider[] = ['deepseek', 'mistral', 'grok'];
/** Voie vision (PDF scannés) : DeepSeek exclu (pas de vision). */
export const VISION_PROVIDERS: Provider[] = ['mistral', 'grok'];

export interface ExtractRequest {
  mode: 'text' | 'vision';
  symbol: string;
  year: number;
  text?: string;            // mode text
  images?: string[];        // mode vision : data URLs PNG
}

export interface ExtractResponse {
  provider: Provider;
  data: FundamentalExtraction;
}

/** Prompt système commun (règles d'unité éprouvées). */
export const SYSTEM_PROMPT =
  "Tu es un expert en analyse financière. À partir du document d'états financiers, " +
  "extrais les fondamentaux et renvoie UNIQUEMENT un JSON valide (aucun texte autour). " +
  "Valeurs en MILLIONS de FCFA sauf eps (FCFA/action) et shares_outstanding (unités). " +
  "Repère l'unité réelle du tableau (en millions / en milliers / en FCFA) et convertis " +
  "tout en MILLIONS (milliers÷1000, FCFA bruts÷1000000). Ignore les chiffres marketing " +
  "(infographies, 'X milliards' narratif). Prends les lignes du compte de résultat et du " +
  "bilan consolidés. net_income = résultat net part du groupe sinon consolidé. " +
  "Champs JSON: revenue, net_income, equity, debt_total, cash, eps, dividend_per_share, " +
  "shares_outstanding. Mets null si non trouvé.";

export function userPrompt(symbol: string, year: number, text?: string): string {
  const head = `Société: ${symbol}. Exercice: ${year}.`;
  return text ? `${head}\n\nTexte du rapport:\n${text}` : head;
}

/** Extrait le premier objet JSON d'une réponse LLM (tolère le texte autour). */
export function parseLlmJson(raw: string): Record<string, unknown> | null {
  // 1) tentative directe
  try { return JSON.parse(raw); } catch { /* continue */ }
  // 2) bloc entre la première { et la dernière }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Lancer le test (succès attendu)**

Run (depuis `frontend/`): `npx tsx lib/import/llmProviders.test.mjs`
Expected: `✓ llmProviders tests OK`

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/import/llmProviders.ts frontend/lib/import/llmProviders.test.mjs
git commit -m "feat(import-ia): types cascade LLM + prompt + parseur JSON tolérant + tests"
```

---

## Task 4: Route API relais LLM (`/api/extract-llm`)

**Files:**
- Create: `frontend/app/api/extract-llm/route.ts`

- [ ] **Step 1: Implémenter la route**

```typescript
// frontend/app/api/extract-llm/route.ts
import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import {
  TEXT_PROVIDERS, VISION_PROVIDERS, SYSTEM_PROMPT, userPrompt, parseLlmJson,
  type Provider, type ExtractRequest,
} from '@/lib/import/llmProviders';

export const maxDuration = 60; // Vercel : laisse le temps à l'appel LLM

interface ProviderCfg {
  key: string | undefined;
  url: string;
  model: (mode: 'text' | 'vision') => string;
}

function providers(): Record<Provider, ProviderCfg> {
  return {
    deepseek: {
      key: process.env.DEEPSEEK_API_KEY,
      url: 'https://api.deepseek.com/chat/completions',
      model: () => 'deepseek-chat',
    },
    mistral: {
      key: process.env.MISTRAL_API_KEY,
      url: 'https://api.mistral.ai/v1/chat/completions',
      model: (m) => (m === 'vision' ? 'pixtral-large-latest' : 'mistral-large-latest'),
    },
    grok: {
      key: process.env.XAI_API_KEY,
      url: 'https://api.x.ai/v1/chat/completions',
      model: (m) => (m === 'vision' ? 'grok-2-vision-latest' : 'grok-2-latest'),
    },
  };
}

function buildMessages(req: ExtractRequest) {
  const sys = { role: 'system', content: SYSTEM_PROMPT };
  if (req.mode === 'vision' && req.images?.length) {
    const content: unknown[] = [{ type: 'text', text: userPrompt(req.symbol, req.year) }];
    for (const img of req.images) content.push({ type: 'image_url', image_url: { url: img } });
    return [sys, { role: 'user', content }];
  }
  return [sys, { role: 'user', content: userPrompt(req.symbol, req.year, req.text) }];
}

async function callProvider(cfg: ProviderCfg, req: ExtractRequest): Promise<Record<string, unknown> | null> {
  const resp = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
    body: JSON.stringify({
      model: cfg.model(req.mode),
      messages: buildMessages(req),
      temperature: 0,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(55000),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const json = await resp.json();
  const content: string = json?.choices?.[0]?.message?.content ?? '';
  return parseLlmJson(content);
}

export async function POST(request: Request) {
  const supa = createServerClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const req = (await request.json().catch(() => null)) as ExtractRequest | null;
  if (!req || (req.mode !== 'text' && req.mode !== 'vision')) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const cfgs = providers();
  const order = req.mode === 'vision' ? VISION_PROVIDERS : TEXT_PROVIDERS;
  const available = order.filter((p) => cfgs[p].key);
  if (available.length === 0) {
    return NextResponse.json(
      { error: 'Aucune clé LLM configurée (DEEPSEEK_API_KEY requis ; MISTRAL_API_KEY pour les scannés).' },
      { status: 503 },
    );
  }

  const errors: string[] = [];
  for (const p of available) {
    try {
      const data = await callProvider(cfgs[p], req);
      if (data) return NextResponse.json({ provider: p, data });
      errors.push(`${p}: JSON illisible`);
    } catch (e) {
      errors.push(`${p}: ${e instanceof Error ? e.message : 'erreur'}`);
    }
  }
  return NextResponse.json({ error: `Tous les fournisseurs ont échoué — ${errors.join(' ; ')}` }, { status: 502 });
}
```

- [ ] **Step 2: Typecheck**

Run (depuis `frontend/`): `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/api/extract-llm/route.ts
git commit -m "feat(import-ia): route relais LLM (cascade DeepSeek->Mistral->Grok, auth)"
```

---

## Task 5: Extraction PDF client (`pdfClient.ts`)

**Files:**
- Create: `frontend/lib/import/pdfClient.ts`

- [ ] **Step 1: Implémenter pdfClient**

```typescript
// frontend/lib/import/pdfClient.ts
'use client';

/**
 * Lecture de PDF côté navigateur (pdf.js). Renvoie soit le texte (PDF natif),
 * soit des images des 6 premières pages (PDF scanné, pour la voie vision LLM).
 */
import * as pdfjs from 'pdfjs-dist';

// Worker bundlé (Next.js sert l'URL via new URL(..., import.meta.url)).
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const TEXT_MIN = 200;       // sous ce seuil de texte total -> considéré scanné
const MAX_TEXT = 45000;
const VISION_PAGES = 6;     // bilan + compte de résultat en début de doc
const RENDER_SCALE = 2.0;   // ~144 dpi : lisible pour la vision

export interface PdfResult {
  mode: 'text' | 'vision';
  text?: string;
  images?: string[];        // data URLs PNG
}

export async function readPdf(file: File): Promise<PdfResult> {
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;

  // 1) tentative texte
  let text = '';
  const nText = Math.min(doc.numPages, 30);
  for (let i = 1; i <= nText; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => ('str' in it ? it.str : '')).join(' ') + '\n';
    if (text.length > MAX_TEXT) break;
  }
  if (text.trim().length >= TEXT_MIN) {
    return { mode: 'text', text: text.slice(0, MAX_TEXT) };
  }

  // 2) scanné -> images des premières pages
  const images: string[] = [];
  const nImg = Math.min(doc.numPages, VISION_PAGES);
  for (let i = 1; i <= nImg; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    images.push(canvas.toDataURL('image/png'));
  }
  return { mode: 'vision', images };
}
```

- [ ] **Step 2: Typecheck**

Run (depuis `frontend/`): `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/import/pdfClient.ts
git commit -m "feat(import-ia): lecture PDF client (texte ou images scanné, pdf.js)"
```

---

## Task 6: Formulaire de revue (`FundamentalReview.tsx`)

**Files:**
- Create: `frontend/components/import/FundamentalReview.tsx`

- [ ] **Step 1: Implémenter le composant**

```tsx
// frontend/components/import/FundamentalReview.tsx
'use client';

import { useState } from 'react';
import type { FundamentalExtraction } from '@/lib/import/validate';

interface Props {
  symbol: string;
  year: number;
  initial: FundamentalExtraction;
  suspects: string[];        // champs à surligner
  onSaved: () => void;
}

const FIELDS: Array<{ key: keyof FundamentalExtraction; label: string }> = [
  { key: 'revenue', label: "Chiffre d'affaires (M FCFA)" },
  { key: 'net_income', label: 'Résultat net (M FCFA)' },
  { key: 'equity', label: 'Capitaux propres (M FCFA)' },
  { key: 'debt_total', label: 'Dette (M FCFA)' },
  { key: 'cash', label: 'Trésorerie (M FCFA)' },
  { key: 'shares_outstanding', label: "Nombre d'actions" },
];

const M = 1_000_000;

/** Formulaire pré-rempli : corrige puis écrit via /api/fundamentals (millions -> FCFA). */
export default function FundamentalReview({ symbol, year, initial, suspects, onSaved }: Props) {
  const [vals, setVals] = useState<FundamentalExtraction>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/fundamentals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: symbol,
          year,
          revenue: vals.revenue != null ? Math.round(vals.revenue * M) : null,
          net_income: vals.net_income != null ? Math.round(vals.net_income * M) : null,
          equity: vals.equity != null ? Math.round(vals.equity * M) : null,
          debt: vals.debt_total != null ? Math.round(vals.debt_total * M) : null,
          shares: vals.shares_outstanding ?? null,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Échec');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {FIELDS.map(({ key, label }) => (
          <div key={key}>
            <label className="block text-[10px] text-muted mb-0.5">
              {label}{suspects.includes(key) && <span className="text-warn ml-1">⚠️</span>}
            </label>
            <input
              type="number" step="any"
              value={vals[key] ?? ''}
              onChange={(e) => setVals({ ...vals, [key]: e.target.value === '' ? null : Number(e.target.value) })}
              className={`w-full bg-bg border rounded px-2 py-1 text-sm ${suspects.includes(key) ? 'border-warn' : 'border-border'}`}
            />
          </div>
        ))}
      </div>
      {error && <p className="text-xs text-down">{error}</p>}
      <button type="button" onClick={save} disabled={busy}
        className="text-xs bg-up/90 hover:bg-up text-black font-medium rounded px-3 py-1.5 disabled:opacity-50">
        {busy ? 'Enregistrement…' : 'Enregistrer en base'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run (depuis `frontend/`): `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/import/FundamentalReview.tsx
git commit -m "feat(import-ia): formulaire de revue/correction des fondamentaux"
```

---

## Task 7: Ligne d'import (`ImportRow.tsx`)

**Files:**
- Create: `frontend/components/import/ImportRow.tsx`

Orchestration d'un PDF : déduit symbole/année du nom, lit le PDF, appelle
`/api/extract-llm`, valide, puis auto-écrit (statut `auto`) ou montre la revue
(statut `review`).

- [ ] **Step 1: Implémenter le composant**

```tsx
// frontend/components/import/ImportRow.tsx
'use client';

import { useEffect, useState } from 'react';
import { readPdf } from '@/lib/import/pdfClient';
import { validateExtraction, type FundamentalExtraction } from '@/lib/import/validate';
import FundamentalReview from './FundamentalReview';

type Status = 'pending' | 'reading' | 'analyzing' | 'auto-saving' | 'review' | 'done' | 'error';

interface Props {
  file: File;
  validCodes: Set<string>;   // codes BRVM connus
}

function parseName(name: string): { symbol: string; year: number } {
  const stem = name.replace(/\.[^.]+$/, '');
  const symbol = stem.split('_')[0]!.toUpperCase();
  const m = stem.match(/(20\d{2})/);
  return { symbol, year: m ? Number(m[1]) : new Date().getFullYear() - 1 };
}

const M = 1_000_000;

export default function ImportRow({ file, validCodes }: Props) {
  const parsed = parseName(file.name);
  const [symbol, setSymbol] = useState(parsed.symbol);
  const [year, setYear] = useState(parsed.year);
  const [status, setStatus] = useState<Status>('pending');
  const [provider, setProvider] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<FundamentalExtraction | null>(null);
  const [suspects, setSuspects] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    if (!validCodes.has(symbol)) { setStatus('error'); setError(`Code ${symbol} inconnu — corrigez-le.`); return; }
    try {
      setStatus('reading');
      const pdf = await readPdf(file);
      setStatus('analyzing');
      const res = await fetch('/api/extract-llm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: pdf.mode, symbol, year, text: pdf.text, images: pdf.images }),
      });
      const j = await res.json();
      if (!res.ok) { setStatus('error'); setError(j.error ?? 'Échec analyse'); return; }
      setProvider(j.provider);
      const data = j.data as FundamentalExtraction;
      setExtraction(data);
      const v = validateExtraction(data);
      setSuspects(v.suspects);
      if (v.status === 'auto') {
        setStatus('auto-saving');
        const w = await fetch('/api/fundamentals', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: symbol, year,
            revenue: data.revenue != null ? Math.round(data.revenue * M) : null,
            net_income: data.net_income != null ? Math.round(data.net_income * M) : null,
            equity: data.equity != null ? Math.round(data.equity * M) : null,
            debt: data.debt_total != null ? Math.round(data.debt_total * M) : null,
            shares: data.shares_outstanding ?? null,
          }),
        });
        if (!w.ok) { const e = await w.json(); setStatus('error'); setError(e.error ?? 'Échec écriture'); return; }
        setStatus('done');
      } else {
        setStatus('review');
      }
    } catch (e) {
      setStatus('error'); setError(e instanceof Error ? e.message : 'Erreur');
    }
  }

  useEffect(() => { void run(); /* lancé une fois au montage */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-surface border border-border rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-3 text-sm">
        <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          className="w-20 bg-bg border border-border rounded px-2 py-1 text-sm font-medium" />
        <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))}
          className="w-20 bg-bg border border-border rounded px-2 py-1 text-sm" />
        <span className="text-muted text-xs truncate flex-1">{file.name}</span>
        <span className="text-xs">
          {status === 'reading' && '📄 lecture…'}
          {status === 'analyzing' && '🤖 analyse…'}
          {status === 'auto-saving' && '💾 écriture…'}
          {status === 'done' && <span className="text-up">✓ enregistré ({provider})</span>}
          {status === 'review' && <span className="text-warn">⚠️ à valider ({provider})</span>}
          {status === 'error' && <span className="text-down">✕ {error}</span>}
        </span>
        {status === 'error' && (
          <button type="button" onClick={() => void run()} className="text-xs text-up hover:underline">Réessayer</button>
        )}
      </div>
      {status === 'review' && extraction && (
        <FundamentalReview symbol={symbol} year={year} initial={extraction} suspects={suspects} onSaved={() => setStatus('done')} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run (depuis `frontend/`): `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/import/ImportRow.tsx
git commit -m "feat(import-ia): ligne d'import (lecture, analyse, auto/review)"
```

---

## Task 8: Dropzone + page

**Files:**
- Create: `frontend/components/import/PdfDropzone.tsx`
- Create: `frontend/app/admin/import-fondamentaux/page.tsx`

- [ ] **Step 1: Implémenter la dropzone**

```tsx
// frontend/components/import/PdfDropzone.tsx
'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

export default function PdfDropzone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const onDrop = useCallback((accepted: File[]) => onFiles(accepted), [onFiles]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'application/pdf': ['.pdf'] }, multiple: true,
  });
  return (
    <div {...getRootProps()}
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
        isDragActive ? 'border-up bg-up/5' : 'border-border hover:border-up/40'
      }`}>
      <input {...getInputProps()} />
      <p className="text-sm text-muted">📥 Glissez des PDF d'états financiers ici, ou cliquez pour choisir.</p>
      <p className="text-[10px] text-muted mt-1">Nom recommandé : SYMBOLE_ANNEE.pdf (ex. SNTS_2025.pdf)</p>
    </div>
  );
}
```

- [ ] **Step 2: Implémenter la page**

```tsx
// frontend/app/admin/import-fondamentaux/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import PdfDropzone from '@/components/import/PdfDropzone';
import ImportRow from '@/components/import/ImportRow';

interface Queued { id: string; file: File; }

export default function ImportFondamentauxPage() {
  const [files, setFiles] = useState<Queued[]>([]);
  const [validCodes, setValidCodes] = useState<Set<string>>(new Set());
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const sb = createClient();
    sb.auth.getUser().then(({ data }) => setAuthed(!!data.user));
    sb.from('brvm_instruments').select('code').eq('type', 'action').then(({ data }) => {
      setValidCodes(new Set((data ?? []).map((r) => r.code as string)));
    });
  }, []);

  function addFiles(accepted: File[]) {
    setFiles((prev) => [
      ...prev,
      ...accepted.map((file) => ({ id: `${file.name}-${Date.now()}-${Math.random()}`, file })),
    ]);
  }

  if (authed === false) {
    return <div className="p-6 text-muted">Connectez-vous pour importer des fondamentaux.</div>;
  }

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">📥 Import fondamentaux (IA)</h1>
        <p className="text-sm text-muted">
          Déposez des PDF d'états financiers : analyse par IA (DeepSeek → Mistral → Grok),
          écriture automatique si les valeurs sont plausibles, validation sinon.
        </p>
      </div>
      <PdfDropzone onFiles={addFiles} />
      <div className="space-y-2">
        {files.map((q) => <ImportRow key={q.id} file={q.file} validCodes={validCodes} />)}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + build**

Run (depuis `frontend/`): `npx tsc --noEmit && npm run build`
Expected: `✓ Compiled successfully`, route `/admin/import-fondamentaux` listée.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/import/PdfDropzone.tsx "frontend/app/admin/import-fondamentaux/page.tsx"
git commit -m "feat(import-ia): dropzone + page /admin/import-fondamentaux"
```

---

## Task 9: Lien sidebar + déploiement

**Files:**
- Modify: `frontend/components/Sidebar.tsx`

- [ ] **Step 1: Ajouter l'entrée sidebar**

Dans le tableau `NAV` de `frontend/components/Sidebar.tsx`, ajouter après l'entrée
`{ href: '/fondamentaux', label: '🏦 Analyse fondamentale' },` :

```tsx
  { href: '/admin/import-fondamentaux', label: '📥 Import IA' },
```

- [ ] **Step 2: Typecheck + build**

Run (depuis `frontend/`): `npx tsc --noEmit && npm run build`
Expected: succès.

- [ ] **Step 3: Ajouter les clés API dans Vercel**

Les clés doivent exister côté serveur Vercel (Production). Vérifier / ajouter :
```bash
cd frontend && npx vercel env ls production | grep -E "DEEPSEEK|MISTRAL|XAI" || echo "à ajouter"
```
Si absentes, l'utilisateur les ajoute (Settings → Environment Variables) :
`DEEPSEEK_API_KEY`, `MISTRAL_API_KEY`, `XAI_API_KEY`. La fonctionnalité renverra
503 tant qu'aucune n'est présente (message clair).

- [ ] **Step 4: Déployer**

Run (depuis `frontend/`): `npx vercel deploy --prod --yes`
Expected: `Aliased: https://frontend-zeta-ten-22.vercel.app`.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/Sidebar.tsx
git commit -m "feat(import-ia): lien sidebar Import IA + déploiement"
```

---

## Self-review (effectué)

- **Couverture spec** : deps (T1), garde-fous (T2), cascade+prompt+parseur (T3),
  route relais LLM auth (T4), lecture PDF texte/vision 6 pages (T5), revue
  manuelle (T6), orchestration auto/review (T7), dropzone+page (T8), sidebar+env
  Vercel+deploy (T9). Toutes les sections de la spec sont couvertes.
- **Types cohérents** : `FundamentalExtraction` défini en T2, réutilisé T3/T6/T7.
  `Provider`, `ExtractRequest`, `TEXT_PROVIDERS`, `VISION_PROVIDERS`,
  `parseLlmJson`, `SYSTEM_PROMPT`, `userPrompt` définis T3, utilisés T4. `readPdf`
  / `PdfResult` (T5) utilisés T7. `validateExtraction` (T2) utilisé T7.
- **Pas de placeholder** : tout le code est fourni.
- **Conversion unités** : millions → FCFA (×1 000 000) appliquée à l'écriture
  (T6 et T7), cohérente avec `/api/fundamentals` et le pipeline scanner existant.
- **Sécurité** : clés en env serveur, routes authentifiées (T4 reprend le pattern
  de `/api/fundamentals`).
- **YAGNI** : pas de file d'attente, pas de stockage PDF, 1 PDF à la fois.
