# Notations Financières Richbourse — Design

> **Pour les agents:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Scraper les notations financières par société depuis richbourse.com/common/notation-financiere/index/[CODE], les stocker dans `brvm_instruments.notation_json` (JSONB), et les afficher dans la fiche action `/actions/[code]`.

**Architecture:** Migration légère (1 colonne JSONB sur table existante). Nouveau module `scraper/src/notations/`. Frontend SSR sans requête supplémentaire (notation_json déjà dans le SELECT * existant).

**Tech Stack:** Node.js/TypeScript ESM, axios, cheerio, @supabase/supabase-js (service_role), Next.js 14 App Router, TailwindCSS dark finance.

---

## 1. Migration SQL

`supabase/migrations/0017_notations.sql` :

```sql
alter table public.brvm_instruments
  add column if not exists notation_json jsonb;

comment on column public.brvm_instruments.notation_json
  is 'Dernière notation financière (Bloomfield, GCR, etc.) scrapée depuis richbourse.com';
```

Aucune contrainte NOT NULL — la colonne reste null pour les sociétés sans notation.

---

## 2. Scraper — module `scraper/src/notations/`

### 2.1 Type (`types.ts`)

```ts
export interface ParsedNotation {
  agence: string;           // ex: "Bloomfield Investment"
  note: string;             // ex: "A+", "BBB-", "B"
  perspective: string;      // ex: "Stable", "Positive", "Négative"
  date_notation: string;    // ISO "YYYY-MM-DD"
  source_url: string;       // URL de la page scrapée
}
```

### 2.2 Parser (`parser.ts`)

- Entrée : HTML string de la page richbourse + code + baseUrl
- Sélecteurs cheerio : cibler les blocs contenant agence, note, perspective, date
- Date : format `DD/MM/YYYY` → `parseFrDate()` depuis `utils/dates.ts`
- Si aucune notation détectée → retourne `null`
- Retourne `ParsedNotation | null`

### 2.3 Runner (`runNotations.ts`)

```ts
export async function runNotations(opts: { mock?: boolean }): Promise<NotationsResult>
```

- Liste fixe des 47 codes BRVM (même ordre que dans `scraper/src/events/classify.ts`)
- Pour chaque code : GET `https://www.richbourse.com/common/notation-financiere/index/[CODE]`
- Délai 500ms entre requêtes (politesse)
- Si `ParsedNotation` non null : `UPDATE brvm_instruments SET notation_json = $1, updated_at = now() WHERE code = $2`
- Si la page retourne 404 ou notation null : skip (ne pas effacer une notation existante)
- Retourne `{ updated: number; skipped: number; errors: number }`

### 2.4 Mock (`mock.ts`)

5 fixtures couvrant notes variées :
- `SNTS` → `{ agence: "Bloomfield Investment", note: "A+", perspective: "Stable", date_notation: "2024-11-15", source_url: "..." }`
- `ETIT` → note `A`, perspective `Positive`
- `BOABF` → note `BBB+`, perspective `Stable`
- `SGBC` → note `BBB`, perspective `Négative`
- `SIVC` → note `B+`, perspective `Stable`

### 2.5 Intégration CLI (`scraper/src/index.ts`)

Nouveau sous-commande `notations[:mock]` → appelle `runNotations({ mock })`.

`package.json` :
```json
"notations": "tsx src/index.ts notations",
"notations:mock": "tsx src/index.ts notations --mock"
```

---

## 3. Frontend — fiche action `/actions/[code]`

### 3.1 Pas de nouvelle requête

`brvm_instruments` est déjà sélectionné avec `select('*')` dans `getData()` → `notation_json` arrive automatiquement.

Étendre le type instrument dans la page :

```ts
instrument: {
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
    source_url?: string;
  } | null;
} | null
```

### 3.2 Composant `NotationBadge.tsx`

Composant serveur (pas de `'use client'`). Affiché conditionnellement si `notation_json` non null.

```tsx
// Position dans la page : après le bloc cotation, avant les indicateurs
{instrument?.notation_json && (
  <NotationBadge notation={instrument.notation_json} />
)}
```

UI :
```
┌─ Notation financière ─────────────────────┐
│  🏅 Bloomfield Investment                  │
│  Note : A+   •   Perspective : Stable      │
│  Mise à jour : nov. 2024    [Lire →]       │
└────────────────────────────────────────────┘
```

- Section masquée si `notation_json` null (pas d'état vide)
- `source_url` non null → `<a href={source_url} target="_blank" rel="noopener">Lire →</a>`
- Date formatée `MMM YYYY` en français (ex: "nov. 2024")
- Style dark finance : `bg-surface border border-border rounded-xl p-4`

---

## 4. Aucune migration destructive

Seul `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` — totalement non-destructif. Les pages existantes qui sélectionnent `brvm_instruments` avec `select('*')` récupèrent la colonne nullable sans aucune modification de leur logique.

---

## 5. Tests

Fichier `scraper/tests/notations.test.ts` (vitest) :
- `parseNotationPage` : HTML fixture avec notation → ParsedNotation attendu
- `parseNotationPage` : HTML sans notation → null
- Runner mock : 5 fixtures → 5 updates, 0 errors
