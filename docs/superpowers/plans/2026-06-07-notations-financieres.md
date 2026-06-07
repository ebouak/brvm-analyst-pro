# Notations Financières Richbourse — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scraper les notations financières par société depuis richbourse.com/common/notation-financiere/index/[CODE], stocker dans `brvm_instruments.notation_json` (JSONB), et afficher dans la fiche action.

**Architecture:** Migration légère (1 colonne JSONB nullable sur `brvm_instruments`). Module scraper `scraper/src/notations/` (parser cheerio + runner avec throttle 500ms). Composant frontend `NotationBadge.tsx` (SSR, conditionnel). La requête `brvm_instruments` existante sélectionne déjà `*` — aucune requête supplémentaire nécessaire.

**Tech Stack:** Node.js/TypeScript ESM, axios, cheerio, @supabase/supabase-js (service_role), Next.js 14 App Router, TailwindCSS.

---

## Structure des fichiers

| Fichier | Action |
|---|---|
| `supabase/migrations/0017_notations.sql` | Créer — ALTER TABLE add column |
| `scraper/src/notations/types.ts` | Créer — interface ParsedNotation |
| `scraper/src/notations/parser.ts` | Créer — cheerio parser |
| `scraper/src/notations/mock.ts` | Créer — 5 fixtures |
| `scraper/src/notations/runNotations.ts` | Créer — runner avec throttle |
| `scraper/src/index.ts` | Modifier — ajouter case 'notations' |
| `scraper/package.json` | Modifier — ajouter scripts notations |
| `scraper/tests/notations.test.ts` | Créer — tests parser + mock |
| `frontend/components/NotationBadge.tsx` | Créer — composant SSR |
| `frontend/app/actions/[code]/page.tsx` | Modifier — afficher NotationBadge |

---

## Task 1 : Migration SQL

**Files:**
- Create: `supabase/migrations/0017_notations.sql`

- [ ] **Step 1 : Créer la migration**

```sql
-- supabase/migrations/0017_notations.sql
-- Ajoute la colonne notation_json à brvm_instruments (nullable, non destructif).

alter table public.brvm_instruments
  add column if not exists notation_json jsonb;

comment on column public.brvm_instruments.notation_json
  is 'Dernière notation financière (Bloomfield, GCR, etc.) scrapée depuis richbourse.com. Ex: {"agence":"Bloomfield Investment","note":"A+","perspective":"Stable","date_notation":"2024-11-15","source_url":"https://..."}';
```

- [ ] **Step 2 : Appliquer la migration en base Supabase**

Via l'éditeur SQL Supabase ou `supabase db push`. La colonne est nullable — aucune ligne existante n'est affectée.

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/0017_notations.sql
git commit -m "feat(db): notation_json JSONB sur brvm_instruments"
```

---

## Task 2 : Types + Parser scraper

**Files:**
- Create: `scraper/src/notations/types.ts`
- Create: `scraper/src/notations/parser.ts`
- Create: `scraper/tests/notations.test.ts` (tests parser)

- [ ] **Step 1 : Créer `scraper/src/notations/types.ts`**

```ts
export interface ParsedNotation {
  agence: string;           // ex: "Bloomfield Investment"
  note: string;             // ex: "A+", "BBB-", "B"
  perspective: string;      // ex: "Stable", "Positive", "Négative"
  date_notation: string;    // ISO "YYYY-MM-DD"
  source_url: string;       // URL de la page scrapée
}

export interface NotationsResult {
  updated: number;
  skipped: number;
  errors: number;
}
```

- [ ] **Step 2 : Créer `scraper/src/notations/parser.ts`**

```ts
import * as cheerio from 'cheerio';
import { parseFrDate } from '../utils/dates.js';
import type { ParsedNotation } from './types.js';

/**
 * Parse la page richbourse.com/common/notation-financiere/index/[CODE].
 * Retourne null si aucune notation détectée.
 */
export function parseNotationPage(html: string, sourceUrl: string): ParsedNotation | null {
  const $ = cheerio.load(html);

  // Richbourse affiche les notations dans un tableau ou des blocs structurés.
  // On cherche les champs clés : agence, note, perspective, date.
  // Stratégie : parcourir tous les textes visibles et extraire par pattern.

  let agence = '';
  let note = '';
  let perspective = '';
  let dateRaw = '';

  // Chercher dans les cellules de tableau (pattern le plus courant sur richbourse)
  $('table tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 2) return;
    const label = $(cells[0]).text().trim().toLowerCase();
    const value = $(cells[1]).text().trim();

    if (!agence && (label.includes('agence') || label.includes('organisme'))) {
      agence = value;
    }
    if (!note && (label.includes('note') || label.includes('rating'))) {
      note = value;
    }
    if (!perspective && (label.includes('perspective') || label.includes('outlook'))) {
      perspective = value;
    }
    if (!dateRaw && (label.includes('date') || label.includes('mise à jour'))) {
      dateRaw = value;
    }
  });

  // Fallback : chercher dans les divs/spans si le tableau n'a rien donné
  if (!note) {
    $('[class*="note"], [class*="rating"], [class*="notation"]').each((_, el) => {
      const text = $(el).text().trim();
      if (/^[A-D][+-]?$/.test(text) || /^[A-D]{1,3}[+-]?\d?$/.test(text)) {
        note = text;
        return false; // break
      }
    });
  }

  // Si aucune note trouvée → pas de notation pour cette société
  if (!note) return null;

  const date_notation = parseFrDate(dateRaw) ?? new Date().toISOString().slice(0, 10);

  return {
    agence: agence || 'Inconnu',
    note,
    perspective: perspective || 'N/D',
    date_notation,
    source_url: sourceUrl,
  };
}
```

- [ ] **Step 3 : Créer `scraper/tests/notations.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { parseNotationPage } from '../src/notations/parser.js';

const HTML_WITH_NOTATION = `
<html><body>
<table>
  <tr><td>Agence de notation</td><td>Bloomfield Investment</td></tr>
  <tr><td>Note</td><td>A+</td></tr>
  <tr><td>Perspective</td><td>Stable</td></tr>
  <tr><td>Date de notation</td><td>15/11/2024</td></tr>
</table>
</body></html>
`;

const HTML_WITHOUT_NOTATION = `
<html><body>
<p>Aucune notation disponible pour cette société.</p>
</body></html>
`;

describe('parseNotationPage', () => {
  it('extrait la notation depuis un tableau HTML', () => {
    const result = parseNotationPage(HTML_WITH_NOTATION, 'https://richbourse.com/notation/SNTS');
    expect(result).not.toBeNull();
    expect(result!.agence).toBe('Bloomfield Investment');
    expect(result!.note).toBe('A+');
    expect(result!.perspective).toBe('Stable');
    expect(result!.date_notation).toBe('2024-11-15');
    expect(result!.source_url).toBe('https://richbourse.com/notation/SNTS');
  });

  it('retourne null si aucune notation présente', () => {
    const result = parseNotationPage(HTML_WITHOUT_NOTATION, 'https://richbourse.com/notation/XXXX');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 4 : Lancer les tests**

```bash
cd scraper && npm test -- notations
```
Attendu : 2 tests passent.

- [ ] **Step 5 : Commit**

```bash
git add scraper/src/notations/types.ts scraper/src/notations/parser.ts scraper/tests/notations.test.ts
git commit -m "feat(notations): types + parser cheerio + tests"
```

---

## Task 3 : Mock + Runner

**Files:**
- Create: `scraper/src/notations/mock.ts`
- Create: `scraper/src/notations/runNotations.ts`

- [ ] **Step 1 : Créer `scraper/src/notations/mock.ts`**

```ts
import type { ParsedNotation } from './types.js';

export const MOCK_NOTATIONS: Record<string, ParsedNotation> = {
  SNTS: {
    agence: 'Bloomfield Investment',
    note: 'A+',
    perspective: 'Stable',
    date_notation: '2024-11-15',
    source_url: 'https://www.richbourse.com/common/notation-financiere/index/SNTS',
  },
  ETIT: {
    agence: 'Bloomfield Investment',
    note: 'A',
    perspective: 'Positive',
    date_notation: '2024-09-20',
    source_url: 'https://www.richbourse.com/common/notation-financiere/index/ETIT',
  },
  BOABF: {
    agence: 'GCR Ratings',
    note: 'BBB+',
    perspective: 'Stable',
    date_notation: '2024-06-10',
    source_url: 'https://www.richbourse.com/common/notation-financiere/index/BOABF',
  },
  SGBC: {
    agence: 'Bloomfield Investment',
    note: 'BBB',
    perspective: 'Négative',
    date_notation: '2024-03-01',
    source_url: 'https://www.richbourse.com/common/notation-financiere/index/SGBC',
  },
  SIVC: {
    agence: 'Bloomfield Investment',
    note: 'B+',
    perspective: 'Stable',
    date_notation: '2023-12-15',
    source_url: 'https://www.richbourse.com/common/notation-financiere/index/SIVC',
  },
};
```

- [ ] **Step 2 : Créer `scraper/src/notations/runNotations.ts`**

```ts
import axios from 'axios';
import { parseNotationPage } from './parser.js';
import { MOCK_NOTATIONS } from './mock.js';
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import type { NotationsResult } from './types.js';

// Liste exhaustive des 47 codes BRVM (ordre alphabétique)
const BRVM_CODES = [
  'ABJC', 'BICC', 'BNBC', 'BOAB', 'BOABF', 'BOAC', 'BOAM', 'BOAN', 'BOAS',
  'CABC', 'CBIBF', 'CFAC', 'CIEC', 'ECOC', 'ETIT', 'FTSC', 'LNBB', 'NEIC',
  'NSBC', 'NTLC', 'ORAC', 'ORGT', 'ONTBF', 'PALC', 'PRSC', 'SAFC', 'SCRC',
  'SDCC', 'SDSC', 'SEMC', 'SGBC', 'SHEC', 'SIBC', 'SICC', 'SIVC', 'SLBC',
  'SMBC', 'SNTS', 'SOGC', 'SPHC', 'STAC', 'STBC', 'TTLC', 'TTLS', 'UNLC',
  'UNXC', 'BICB',
];

const BASE_URL = 'https://www.richbourse.com/common/notation-financiere/index';
const THROTTLE_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runNotations(opts: { mock?: boolean } = {}): Promise<NotationsResult> {
  const result: NotationsResult = { updated: 0, skipped: 0, errors: 0 };

  if (opts.mock) {
    // Mode mock : upsert les 5 fixtures directement
    const supabase = getSupabase();
    for (const [code, notation] of Object.entries(MOCK_NOTATIONS)) {
      const { error } = await supabase
        .from('brvm_instruments')
        .update({ notation_json: notation, updated_at: new Date().toISOString() })
        .eq('code', code);
      if (error) {
        logger.warn({ code, error: error.message }, 'Mock notation update failed');
        result.errors++;
      } else {
        logger.info({ code, note: notation.note }, 'Notation mock upserted');
        result.updated++;
      }
    }
    return result;
  }

  // Mode réel : scraper richbourse pour chaque code
  for (const code of BRVM_CODES) {
    const url = `${BASE_URL}/${code}`;
    try {
      const { data: html } = await axios.get<string>(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BRVM-Analyst/1.0)' },
        timeout: 10_000,
      });

      const notation = parseNotationPage(html, url);
      if (!notation) {
        logger.debug({ code }, 'Pas de notation');
        result.skipped++;
        await sleep(THROTTLE_MS);
        continue;
      }

      const supabase = getSupabase();
      const { error } = await supabase
        .from('brvm_instruments')
        .update({ notation_json: notation, updated_at: new Date().toISOString() })
        .eq('code', code);

      if (error) {
        logger.warn({ code, error: error.message }, 'Notation update failed');
        result.errors++;
      } else {
        logger.info({ code, note: notation.note, agence: notation.agence }, 'Notation updated');
        result.updated++;
      }
    } catch (err) {
      logger.warn({ code, err: err instanceof Error ? err.message : String(err) }, 'Notation fetch error');
      result.errors++;
    }

    await sleep(THROTTLE_MS);
  }

  logger.info(result, 'runNotations terminé');
  return result;
}
```

- [ ] **Step 3 : Commit**

```bash
git add scraper/src/notations/mock.ts scraper/src/notations/runNotations.ts
git commit -m "feat(notations): mock + runner avec throttle 500ms"
```

---

## Task 4 : Intégration CLI scraper

**Files:**
- Modify: `scraper/src/index.ts`
- Modify: `scraper/package.json`

- [ ] **Step 1 : Ajouter l'import dans `scraper/src/index.ts`**

Après la ligne `import { runBackfill } from './backfill/runBackfill.js';`, ajouter :

```ts
import { runNotations } from './notations/runNotations.js';
```

- [ ] **Step 2 : Ajouter le case dans le switch de `main()`**

Après le `case 'validate':` block et avant le `default:`, ajouter :

```ts
    case 'notations': {
      const res = await runNotations({ mock });
      logger.info(res, 'Notations terminées');
      return res.errors > 0 ? 1 : 0;
    }
```

- [ ] **Step 3 : Mettre à jour le message d'erreur du default**

Changer la liste des commandes dans `logger.error` du `default:` pour inclure `notations` :

```ts
      'Commande inconnue. Commandes: daily | date | score | events | dividends | shares | alerts | publications | backtest | backfill | validate | notations',
```

- [ ] **Step 4 : Ajouter les scripts dans `scraper/package.json`**

Dans la section `"scripts"`, ajouter :

```json
"notations": "tsx src/index.ts notations",
"notations:mock": "tsx src/index.ts notations --mock"
```

- [ ] **Step 5 : Vérifier le typecheck**

```bash
cd scraper && npm run typecheck 2>&1 | tail -5
```
Attendu : 0 erreur.

- [ ] **Step 6 : Commit**

```bash
git add scraper/src/index.ts scraper/package.json
git commit -m "feat(notations): CLI notations + notations:mock"
```

---

## Task 5 : Composant `NotationBadge.tsx` + intégration page action

**Files:**
- Create: `frontend/components/NotationBadge.tsx`
- Modify: `frontend/app/actions/[code]/page.tsx`

- [ ] **Step 1 : Créer `frontend/components/NotationBadge.tsx`**

```tsx
// Composant serveur (pas de 'use client') — rendu conditionnel côté SSR.

interface NotationData {
  agence: string;
  note: string;
  perspective: string;
  date_notation: string;
  source_url?: string | null;
}

function formatDateNotation(iso: string): string {
  // "2024-11-15" → "nov. 2024"
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
}

export default function NotationBadge({ notation }: { notation: NotationData }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted font-medium">🏅 Notation financière</span>
        <span className="text-xs text-muted">{notation.agence}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-2xl font-bold text-up tabular">{notation.note}</span>
        <div className="flex flex-col">
          <span className="text-xs text-white/80">Perspective : {notation.perspective}</span>
          <span className="text-xs text-muted">Mise à jour : {formatDateNotation(notation.date_notation)}</span>
        </div>
        {notation.source_url && (
          <a
            href={notation.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-xs text-up hover:underline"
          >
            Lire →
          </a>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Étendre le type `instrument` dans `frontend/app/actions/[code]/page.tsx`**

Trouver la ligne (≈ ligne 77) :
```ts
    instrument: instr as { designation?: string; secteur?: string; pays?: string; type?: string; shares?: number | null; shares_source?: string | null } | null,
```

Remplacer par :
```ts
    instrument: instr as {
      designation?: string;
      secteur?: string;
      pays?: string;
      type?: string;
      shares?: number | null;
      shares_source?: string | null;
      notation_json?: {
        agence: string;
        note: string;
        perspective: string;
        date_notation: string;
        source_url?: string | null;
      } | null;
    } | null,
```

- [ ] **Step 3 : Ajouter l'import du composant**

En tête du fichier, après les imports existants de composants :
```ts
import NotationBadge from '@/components/NotationBadge';
```

- [ ] **Step 4 : Insérer le composant dans le JSX**

Trouver dans le JSX le commentaire `{/* ── Configuration technique ── */}` (ajouté par le plan précédent). Insérer **avant** ce bloc :

```tsx
      {/* ── Notation financière ── */}
      {instrument?.notation_json && (
        <NotationBadge notation={instrument.notation_json} />
      )}
```

- [ ] **Step 5 : Vérifier le typecheck**

```bash
cd frontend && npm run typecheck 2>&1 | tail -5
```
Attendu : 0 erreur.

- [ ] **Step 6 : Commit + push**

```bash
git add frontend/components/NotationBadge.tsx frontend/app/actions/[code]/page.tsx
git commit -m "feat(action): badge notation financière (agence, note, perspective)"
git push origin main
```

---

## Vérification post-implémentation

1. Lancer `cd scraper && npm run notations:mock` — doit afficher "updated: 5, skipped: 0, errors: 0"
2. Ouvrir `/actions/SNTS` → badge "🏅 Notation financière | A+ | Stable | nov. 2024" visible
3. Ouvrir `/actions/PALC` (sans notation) → section absente (pas d'état vide)
4. Lancer `npm test -- notations` → 2 tests verts
