# Publications Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a scraper module for "Publications de l'émetteur" on BDFIN BRVM, ingesting financial reports, AGO/AGE notices, and quarterly reports into a `publications` Supabase table.

**Architecture:** A new `scraper/src/publications/` module mirrors the structure of `events/` and `dividends/` — pure `classify.ts` + `parser.ts` + `repository.ts` + `runPublications.ts` orchestrator. The orchestrator authenticates with the existing BDFIN session, iterates over instruments, does ASP.NET postbacks to select each emitter, parses the HTML table, and upserts idempotently via `dedupe_hash`. A Supabase migration creates the `publications` table.

**Tech Stack:** TypeScript ESM, Node 20, cheerio (HTML parsing), @supabase/supabase-js, existing `aspnet.ts` postback helpers, vitest for tests.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/0012_publications.sql` | Create | DDL: table + indexes + RLS |
| `scraper/src/publications/types.ts` | Create | `Publication` interface |
| `scraper/src/publications/classify.ts` | Create | Pure function: libellé → type_publication |
| `scraper/src/publications/parser.ts` | Create | Parse BDFIN HTML table → `ParsedPubRow[]` |
| `scraper/src/publications/repository.ts` | Create | `dedupeHash`, `upsertPublications` |
| `scraper/src/publications/mock.ts` | Create | `buildMockPublications()` for dev/CI |
| `scraper/src/publications/runPublications.ts` | Create | Orchestrator (mock + real mode) |
| `scraper/src/index.ts` | Modify | Add `publications` case + update docstring |
| `scraper/package.json` | Modify | Add `publications` and `publications:mock` scripts |
| `.github/workflows/scrape-daily.yml` | Modify | Add step 5 in post-cloture and step 3 in matin-events; renumber |
| `scraper/tests/publications.test.ts` | Create | Unit tests: classify, parser, dedupeHash |
| `scraper/tests/fixtures/publications-sample.html` | Create | Minimal HTML fixture for parser tests |

---

### Task 1: Supabase Migration

**Files:**
- Create: `supabase/migrations/0012_publications.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- 0012_publications.sql
-- Publications déposées par les émetteurs (états financiers, AG, rapports, etc.)

create table if not exists public.publications (
  id              uuid        primary key default gen_random_uuid(),
  code            text        not null references public.brvm_instruments(code) on update cascade,
  date_publication date       not null,
  libelle         text        not null,
  type_publication text,
  source_url      text,
  source          text        not null default 'bdfin',
  dedupe_hash     text        unique,
  created_at      timestamptz not null default now()
);

create index if not exists idx_publications_code
  on public.publications (code, date_publication desc);

create index if not exists idx_publications_date
  on public.publications (date_publication desc);

alter table public.publications enable row level security;

create policy "lecture publique publications"
  on public.publications for select using (true);
-- Écriture réservée au service_role (scraper back-end uniquement)
```

- [ ] **Step 2: Verify the file was created correctly**

Open `supabase/migrations/0012_publications.sql` and confirm:
- Table name is `publications`
- `dedupe_hash text unique` is present
- RLS is enabled with a read-only public policy

---

### Task 2: Types

**Files:**
- Create: `scraper/src/publications/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
/**
 * Types du module publications BDFIN.
 */

export type PublicationType =
  | 'etats_financiers'
  | 'ag'
  | 'rapport'
  | 'bilan'
  | 'notation'
  | 'avis'
  | 'autre';

export interface Publication {
  /** Code instrument BRVM (ex: "SNTS"). */
  code: string;
  /** Date de publication au format YYYY-MM-DD. */
  date_publication: string;
  /** Libellé complet de la publication tel qu'affiché sur BDFIN. */
  libelle: string;
  /** Catégorie dérivée du libellé. */
  type_publication: PublicationType;
  /** URL "Visualiser" (PDF ou page de détail). Null si absente. */
  source_url: string | null;
  /** Toujours 'bdfin' pour ce scraper. */
  source: 'bdfin';
  /** SHA-256 de code|date_publication|libelle — clé d'idempotence. */
  dedupe_hash: string;
}
```

---

### Task 3: classify.ts — unit tests first, then implementation

**Files:**
- Create: `scraper/tests/publications.test.ts` (partial — classify section)
- Create: `scraper/src/publications/classify.ts`

- [ ] **Step 1: Write the failing classify tests**

Create `scraper/tests/publications.test.ts` with:

```typescript
import { describe, it, expect } from 'vitest';
import { classifyPublication } from '../src/publications/classify.js';

describe('classifyPublication', () => {
  it('détecte états financiers IFRS', () => {
    expect(classifyPublication('Etats financiers IFRS - Exercice 2025 - SERVAIR ABIDJAN CI'))
      .toBe('etats_financiers');
  });
  it('détecte états financiers SYSCOHADA', () => {
    expect(classifyPublication('Etats financiers SYSCOHADA - Exercice 2025'))
      .toBe('etats_financiers');
  });
  it('détecte assemblée générale ordinaire', () => {
    expect(classifyPublication('Avis de convocation - Assemblée Générale Ordinaire - SERVAIR ABIDJAN CI'))
      .toBe('ag');
  });
  it('détecte AGO acronyme', () => {
    expect(classifyPublication('PV AGO du 15 avril 2026'))
      .toBe('ag');
  });
  it('détecte rapport trimestriel', () => {
    expect(classifyPublication("Rapport d'activités - 1er trimestre 2026"))
      .toBe('rapport');
  });
  it('détecte bilan semestriel', () => {
    expect(classifyPublication('Bilan semestriel du contrat de liquidité'))
      .toBe('bilan');
  });
  it('détecte notation financière', () => {
    expect(classifyPublication('Notation financière SNTS - Agence GCR'))
      .toBe('notation');
  });
  it('retourne autre pour libellé inconnu', () => {
    expect(classifyPublication('Attestation des CACs sur le rapport'))
      .toBe('autre');
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
cd "c:\Users\adego\OneDrive\Documents\brvm-analyst-pro\scraper"
npx vitest run tests/publications.test.ts
```

Expected: FAIL — `classifyPublication` not found / module not found.

- [ ] **Step 3: Implement classify.ts**

Create `scraper/src/publications/classify.ts`:

```typescript
/**
 * Heuristiques de classification d'une publication émetteur à partir du libellé.
 * L'ordre des règles est important : les règles spécifiques passent avant les générales.
 */
import type { PublicationType } from './types.js';

export function classifyPublication(libelle: string): PublicationType {
  const l = libelle.toLowerCase();

  // États financiers — inclut les référentiels comptables
  if (
    /[eé]tats\s+financiers/.test(l) ||
    /\bifrs\b/.test(l) ||
    /\bsyscohada\b/.test(l)
  ) {
    return 'etats_financiers';
  }

  // Assemblée générale — convocation, PV, AGO/AGE
  if (
    /assembl[eé]e\s+g[eé]n[eé]rale/.test(l) ||
    /\bago\b/.test(l) ||
    /\bage\b/.test(l) ||
    /\bconvocation\b/.test(l)
  ) {
    return 'ag';
  }

  // Rapport d'activités trimestriel / semestriel / annuel
  if (/\brapport\b/.test(l) && /(trimestre|annuel|semestriel|activit[eé]s)/.test(l)) {
    return 'rapport';
  }

  // Bilan (avant "rapport" générique pour éviter collision)
  if (/\bbilan\b/.test(l)) {
    return 'bilan';
  }

  // Notation
  if (/\bnotation\b/.test(l)) {
    return 'notation';
  }

  // Avis
  if (/\bavis\b/.test(l)) {
    return 'avis';
  }

  return 'autre';
}
```

- [ ] **Step 4: Run the tests — expect them to pass**

```bash
cd "c:\Users\adego\OneDrive\Documents\brvm-analyst-pro\scraper"
npx vitest run tests/publications.test.ts
```

Expected: 8 tests PASS.

---

### Task 4: parser.ts — tests first, then implementation

**Files:**
- Modify: `scraper/tests/publications.test.ts` (add parser section)
- Create: `scraper/tests/fixtures/publications-sample.html`
- Create: `scraper/src/publications/parser.ts`

- [ ] **Step 1: Create the HTML fixture**

Create `scraper/tests/fixtures/publications-sample.html`:

```html
<!DOCTYPE html>
<html>
<head><title>Publications BDFIN</title></head>
<body>
<form id="form1">
  <input type="hidden" name="__VIEWSTATE" value="abc123" />
  <input type="hidden" name="__EVENTVALIDATION" value="def456" />
  <select name="ctl00$Main$DropDownList1">
    <option value="">-- Sélectionner un émetteur --</option>
    <option value="SNTS" selected>SONATEL</option>
    <option value="BOAB">BOA BENIN</option>
  </select>
  <table id="ctl00_Main_GridView1" class="table-publications">
    <tr class="header">
      <th>Date</th>
      <th>Libellé</th>
      <th>Visualiser</th>
    </tr>
    <tr>
      <td>15/04/2026</td>
      <td>Avis de convocation - Assemblée Générale Ordinaire - SONATEL</td>
      <td><a href="/Docs/pub_AG_SNTS_2026.pdf">Visualiser</a></td>
    </tr>
    <tr>
      <td>31/03/2026</td>
      <td>Rapport d'activités - 1er trimestre 2026</td>
      <td><a href="/Docs/rapport_Q1_SNTS_2026.pdf">Visualiser</a></td>
    </tr>
    <tr>
      <td>10/01/2026</td>
      <td>Etats financiers IFRS - Exercice 2025 - SONATEL</td>
      <td></td>
    </tr>
  </table>
</form>
</body>
</html>
```

- [ ] **Step 2: Add parser tests to publications.test.ts**

Append to `scraper/tests/publications.test.ts`:

```typescript
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parsePublicationsTable } from '../src/publications/parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pubHtml = readFileSync(
  join(__dirname, 'fixtures', 'publications-sample.html'),
  'utf8',
);

describe('parsePublicationsTable', () => {
  const rows = parsePublicationsTable(pubHtml, 'https://bfin.brvm.org');

  it('extrait 3 lignes (hors header)', () => {
    expect(rows).toHaveLength(3);
  });

  it('convertit la date FR en ISO', () => {
    expect(rows[0]!.date_publication).toBe('2026-04-15');
  });

  it('extrait le libellé', () => {
    expect(rows[0]!.libelle).toBe(
      'Avis de convocation - Assemblée Générale Ordinaire - SONATEL',
    );
  });

  it('résout l\'URL PDF en absolu', () => {
    expect(rows[0]!.source_url).toBe(
      'https://bfin.brvm.org/Docs/pub_AG_SNTS_2026.pdf',
    );
  });

  it('retourne null pour source_url manquante', () => {
    expect(rows[2]!.source_url).toBeNull();
  });
});
```

- [ ] **Step 3: Run the tests — expect FAIL (module not found)**

```bash
cd "c:\Users\adego\OneDrive\Documents\brvm-analyst-pro\scraper"
npx vitest run tests/publications.test.ts
```

Expected: FAIL — parser module not found.

- [ ] **Step 4: Implement parser.ts**

Create `scraper/src/publications/parser.ts`:

```typescript
/**
 * Parse la table des publications BDFIN après sélection d'un émetteur.
 *
 * Stratégie de localisation de la table (robuste aux changements de markup) :
 *   1. Cherche <table id="ctl00_Main_GridView1"> (convention ASP.NET GridView).
 *   2. Sinon cherche la table contenant un <th> "Libellé" ou "Visualiser".
 *   3. Si aucune table trouvée, logge un warning (TODO: calibrage).
 *
 * Format de date attendu : JJ/MM/AAAA (format FR BDFIN).
 */
import * as cheerio from 'cheerio';
import { parseFrDate } from '../utils/dates.js';
import { logger } from '../logger.js';

export interface ParsedPubRow {
  /** Date de publication au format YYYY-MM-DD. */
  date_publication: string;
  /** Libellé de la publication. */
  libelle: string;
  /** URL absolue du PDF / détail, ou null. */
  source_url: string | null;
}

/**
 * Trouve la table des publications dans le HTML de la page.
 * Renvoie l'élément cheerio ou null si introuvable.
 */
function findPublicationsTable(
  $: cheerio.CheerioAPI,
): cheerio.Cheerio<cheerio.AnyNode> | null {
  // Tentative 1 : ID conventionnel ASP.NET GridView
  const byId = $('#ctl00_Main_GridView1');
  if (byId.length > 0) return byId;

  // Tentative 2 : table contenant un th "Libellé" ou "Visualiser"
  let found: cheerio.Cheerio<cheerio.AnyNode> | null = null;
  $('table').each((_, table) => {
    const headerText = $(table).find('th').text().toLowerCase();
    if (headerText.includes('libell') || headerText.includes('visualiser')) {
      found = $(table);
      return false; // break
    }
  });

  return found;
}

export function parsePublicationsTable(html: string, baseUrl: string): ParsedPubRow[] {
  const $ = cheerio.load(html);
  const table = findPublicationsTable($);

  if (!table) {
    logger.warn(
      {
        htmlSnippet: html.slice(0, 500),
      },
      'parsePublicationsTable: aucune table publications trouvée — TODO calibrage markup BDFIN',
    );
    return [];
  }

  const rows: ParsedPubRow[] = [];

  table.find('tr').each((_, tr) => {
    const cells = $(tr).find('td');
    if (cells.length < 2) return; // ligne header (th) ou vide

    const rawDate = $(cells[0]).text().trim();
    const date_publication = parseFrDate(rawDate);
    if (!date_publication) return; // pas une ligne de données valide

    const libelle = $(cells[1]).text().trim();
    if (!libelle) return;

    // Colonne "Visualiser" : cherche un <a href>
    let source_url: string | null = null;
    if (cells.length >= 3) {
      const href = $(cells[2]).find('a').attr('href');
      if (href && href.trim()) {
        try {
          source_url = new URL(href.trim(), baseUrl).href;
        } catch {
          source_url = href.trim();
        }
      }
    }

    rows.push({ date_publication, libelle, source_url });
  });

  return rows;
}
```

- [ ] **Step 5: Run all tests — expect them to pass**

```bash
cd "c:\Users\adego\OneDrive\Documents\brvm-analyst-pro\scraper"
npx vitest run tests/publications.test.ts
```

Expected: All 13 tests PASS (8 classify + 5 parser).

---

### Task 5: repository.ts + dedupeHash test

**Files:**
- Modify: `scraper/tests/publications.test.ts` (add dedupeHash section)
- Create: `scraper/src/publications/repository.ts`

- [ ] **Step 1: Add dedupeHash test**

Append to `scraper/tests/publications.test.ts`:

```typescript
import { dedupeHash } from '../src/publications/repository.js';
import type { Publication } from '../src/publications/types.js';

describe('dedupeHash', () => {
  const pub: Publication = {
    code: 'SNTS',
    date_publication: '2026-04-15',
    libelle: 'Avis de convocation - AGO',
    type_publication: 'ag',
    source_url: null,
    source: 'bdfin',
    dedupe_hash: '',
  };

  it('est déterministe', () => {
    expect(dedupeHash(pub)).toBe(dedupeHash({ ...pub }));
  });

  it('change si le libellé change', () => {
    expect(dedupeHash(pub)).not.toBe(dedupeHash({ ...pub, libelle: 'autre' }));
  });

  it('change si le code change', () => {
    expect(dedupeHash(pub)).not.toBe(dedupeHash({ ...pub, code: 'BOAB' }));
  });
});
```

- [ ] **Step 2: Run to confirm FAIL**

```bash
cd "c:\Users\adego\OneDrive\Documents\brvm-analyst-pro\scraper"
npx vitest run tests/publications.test.ts
```

Expected: FAIL — repository module not found.

- [ ] **Step 3: Implement repository.ts**

Create `scraper/src/publications/repository.ts`:

```typescript
/**
 * Persistance des publications (idempotente par dedupe_hash).
 */
import { getSupabase } from '../persistence/supabase.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { sha256 } from '../utils/hash.js';
import type { Publication } from './types.js';

export function dedupeHash(p: Pick<Publication, 'code' | 'date_publication' | 'libelle'>): string {
  return sha256(`${p.code}|${p.date_publication}|${p.libelle}`);
}

export async function upsertPublications(pubs: Publication[]): Promise<number> {
  if (pubs.length === 0) return 0;

  const cfg = getConfig();
  if (cfg.DRY_RUN) {
    logger.warn({ count: pubs.length }, 'DRY_RUN — publications non écrites');
    return pubs.length;
  }

  const sb = getSupabase();
  const rows = pubs.map((p) => ({
    code: p.code,
    date_publication: p.date_publication,
    libelle: p.libelle,
    type_publication: p.type_publication,
    source_url: p.source_url,
    source: p.source,
    dedupe_hash: p.dedupe_hash,
  }));

  const { error } = await sb
    .from('publications')
    .upsert(rows, { onConflict: 'dedupe_hash' });

  if (error) throw new Error(`upsert publications: ${error.message}`);
  return rows.length;
}
```

- [ ] **Step 4: Run all tests — expect pass**

```bash
cd "c:\Users\adego\OneDrive\Documents\brvm-analyst-pro\scraper"
npx vitest run tests/publications.test.ts
```

Expected: All 16 tests PASS.

---

### Task 6: mock.ts

**Files:**
- Create: `scraper/src/publications/mock.ts`

- [ ] **Step 1: Create mock.ts**

```typescript
/**
 * Données fictives pour le mode --mock (dev et CI sans accès BDFIN).
 */
import { sha256 } from '../utils/hash.js';
import { classifyPublication } from './classify.js';
import type { Publication } from './types.js';

const RAW: Omit<Publication, 'type_publication' | 'dedupe_hash' | 'source'>[] = [
  {
    code: 'SNTS',
    date_publication: '2026-04-15',
    libelle: 'Avis de convocation - Assemblée Générale Ordinaire - SONATEL',
    source_url: 'https://bfin.brvm.org/Docs/mock_AG_SNTS_2026.pdf',
  },
  {
    code: 'SNTS',
    date_publication: '2026-03-31',
    libelle: "Rapport d'activités - 1er trimestre 2026 - SONATEL",
    source_url: 'https://bfin.brvm.org/Docs/mock_rapport_Q1_SNTS.pdf',
  },
  {
    code: 'SNTS',
    date_publication: '2026-01-10',
    libelle: 'Etats financiers IFRS - Exercice 2025 - SONATEL',
    source_url: null,
  },
  {
    code: 'BOAB',
    date_publication: '2026-04-20',
    libelle: 'Etats financiers SYSCOHADA - Exercice 2025 - BOA BENIN',
    source_url: 'https://bfin.brvm.org/Docs/mock_EF_BOAB_2025.pdf',
  },
  {
    code: 'BOAB',
    date_publication: '2026-02-01',
    libelle: 'Notation financière - BOA BENIN',
    source_url: null,
  },
];

export function buildMockPublications(): Publication[] {
  return RAW.map((r) => {
    const type_publication = classifyPublication(r.libelle);
    const dedupe_hash = sha256(`${r.code}|${r.date_publication}|${r.libelle}`);
    return { ...r, source: 'bdfin' as const, type_publication, dedupe_hash };
  });
}
```

---

### Task 7: runPublications.ts — orchestrator

**Files:**
- Create: `scraper/src/publications/runPublications.ts`

- [ ] **Step 1: Create runPublications.ts**

```typescript
/**
 * Orchestrateur d'ingestion des publications émetteurs BDFIN.
 *
 *  - mode mock : publications fictives (dev/CI, pas d'accès BDFIN) ;
 *  - mode réel :
 *      1. Auth BDFIN (login Forms ASP.NET).
 *      2. Chargement des instruments (actions actives).
 *      3. Pour chaque émetteur : postback ASP.NET sur /Publications.aspx,
 *         parsing de la table, classification, upsert idempotent.
 *
 * NOTE CALIBRAGE :
 *   Les noms des contrôles ASP.NET (dropdown, GridView ID) sont des valeurs
 *   par défaut basées sur les conventions WebForms. Si la page réelle a un
 *   markup différent, le scraper logge un warning avec un extrait HTML.
 *   TODO: confirmer les valeurs suivantes après inspection réelle de BDFIN :
 *     - PUBLICATIONS_PATH : chemin exact de la page (défaut: /Publications.aspx)
 *     - DROPDOWN_NAME     : UniqueID du select émetteur (défaut: ctl00$Main$DropDownList1)
 *   Voir docs/SCRAPER.md §"Calibrage publications".
 */
import { createHttpClient } from '../client/http.js';
import { login } from '../client/auth.js';
import { extractAspNetState, buildPostback } from '../client/aspnet.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { loadInstrumentRefs } from '../events/repository.js';
import { parsePublicationsTable } from './parser.js';
import { classifyPublication } from './classify.js';
import { upsertPublications, dedupeHash } from './repository.js';
import { buildMockPublications } from './mock.js';
import type { Publication } from './types.js';

/** Chemin de la page Publications sur BDFIN. À calibrer selon le markup réel. */
const PUBLICATIONS_PATH = '/Publications.aspx';

/**
 * UniqueID ASP.NET du dropdown de sélection d'émetteur.
 * À calibrer si différent — l'inspect du HTML source de la page le révèle.
 */
const DROPDOWN_NAME = 'ctl00$Main$DropDownList1';

export interface PublicationsRunResult {
  status: 'success' | 'failed' | 'mock';
  count: number;
  message?: string;
}

export async function runPublications(
  opts: { mock?: boolean } = {},
): Promise<PublicationsRunResult> {
  const cfg = getConfig();
  const useMock = opts.mock || cfg.USE_MOCK;

  try {
    if (useMock) {
      logger.warn('Mode MOCK publications');
      const pubs = buildMockPublications();
      const nb = await upsertPublications(pubs);
      return { status: 'mock', count: nb };
    }

    return await runReal(cfg.BDFIN_BASE_URL ?? '');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, 'Ingestion publications échouée');
    return { status: 'failed', count: 0, message };
  }
}

async function runReal(baseUrl: string): Promise<PublicationsRunResult> {
  const http = createHttpClient();
  await login(http);

  // Charger la liste des instruments actifs
  const instruments = await loadInstrumentRefs();
  if (instruments.length === 0) {
    logger.warn('Aucun instrument dans le référentiel — ingestion publications ignorée');
    return { status: 'success', count: 0, message: 'Référentiel vide' };
  }

  // Charger la page Publications une fois pour avoir le VIEWSTATE initial
  const pageUrl = baseUrl + PUBLICATIONS_PATH;
  logger.info({ pageUrl }, 'Chargement page Publications BDFIN');
  let initialHtml: string;
  try {
    const resp = await http.get(pageUrl);
    initialHtml = resp.data;
  } catch (err) {
    // Essai avec le chemin racine pour découverte du bon lien
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      `Page ${PUBLICATIONS_PATH} injoignable — tentative de découverte via /Default.aspx`,
    );
    try {
      const homeResp = await http.get(baseUrl + '/Default.aspx');
      const pubLink = discoverPublicationsLink(homeResp.data, baseUrl);
      if (!pubLink) {
        logger.error(
          { htmlSnippet: homeResp.data.slice(0, 1000) },
          'Impossible de localiser le lien Publications dans le menu — TODO calibrage',
        );
        return { status: 'failed', count: 0, message: 'Page Publications introuvable' };
      }
      logger.info({ pubLink }, 'Lien Publications découvert via le menu');
      const resp2 = await http.get(pubLink);
      initialHtml = resp2.data;
    } catch (err2) {
      const msg = err2 instanceof Error ? err2.message : String(err2);
      return { status: 'failed', count: 0, message: `Publications inaccessibles: ${msg}` };
    }
  }

  // Vérification que la page contient bien un dropdown émetteur
  const state = extractAspNetState(initialHtml);
  if (!state.hidden['__VIEWSTATE']) {
    logger.warn(
      { htmlSnippet: initialHtml.slice(0, 800) },
      'Page Publications sans __VIEWSTATE — markup inattendu, TODO calibrage',
    );
  }

  const allPubs: Publication[] = [];
  let errorCount = 0;

  for (const instrument of instruments) {
    try {
      const pubs = await fetchPublicationsForInstrument(
        http,
        pageUrl,
        baseUrl,
        state,
        instrument.code,
      );
      allPubs.push(...pubs);
      if (pubs.length > 0) {
        logger.debug(
          { code: instrument.code, count: pubs.length },
          'Publications récupérées',
        );
      }
    } catch (err) {
      errorCount++;
      logger.error(
        { code: instrument.code, err: err instanceof Error ? err.message : String(err) },
        'Erreur publications pour cet instrument — on continue',
      );
    }
  }

  const nb = await upsertPublications(allPubs);
  logger.info(
    { total: nb, instruments: instruments.length, errors: errorCount },
    'Ingestion publications terminée',
  );

  return { status: 'success', count: nb };
}

async function fetchPublicationsForInstrument(
  http: ReturnType<typeof createHttpClient>,
  pageUrl: string,
  baseUrl: string,
  initialState: ReturnType<typeof extractAspNetState>,
  code: string,
): Promise<Publication[]> {
  // Postback ASP.NET : sélectionner l'émetteur dans le dropdown
  const form = buildPostback(initialState, DROPDOWN_NAME, '', {
    [DROPDOWN_NAME]: code,
  });

  const resp = await http.postForm(pageUrl, form);
  const rows = parsePublicationsTable(resp.data, baseUrl);

  return rows.map((row) => {
    const type_publication = classifyPublication(row.libelle);
    const pub: Publication = {
      code,
      date_publication: row.date_publication,
      libelle: row.libelle,
      type_publication,
      source_url: row.source_url,
      source: 'bdfin',
      dedupe_hash: '',
    };
    pub.dedupe_hash = dedupeHash(pub);
    return pub;
  });
}

/**
 * Tente de trouver le lien "Publications" dans le menu principal de BDFIN.
 * Retourne l'URL absolue ou null si introuvable.
 */
function discoverPublicationsLink(html: string, baseUrl: string): string | null {
  // Cherche un lien contenant "publication" (case-insensitive) dans le nav
  const match = html.match(/href="([^"]*[Pp]ublication[^"]*)"/);
  if (!match || !match[1]) return null;
  try {
    return new URL(match[1], baseUrl).href;
  } catch {
    return null;
  }
}
```

---

### Task 8: Wire into index.ts CLI

**Files:**
- Modify: `scraper/src/index.ts`

- [ ] **Step 1: Add the import**

In `scraper/src/index.ts`, add after the last import (line ~36, before the `async function main` line):

```typescript
import { runPublications } from './publications/runPublications.js';
```

- [ ] **Step 2: Add the CLI case**

In the `switch (command)` block, add before the `default:` case:

```typescript
    case 'publications': {
      const res = await runPublications({ mock });
      return res.status === 'failed' ? 1 : 0;
    }
```

- [ ] **Step 3: Update the docstring comment at the top of index.ts**

Replace the `Usage :` comment block to add publications lines. After `tsx src/index.ts alerts --mock         # notification de démonstration`, add:

```
 *   tsx src/index.ts publications             # ingère les publications émetteurs
 *   tsx src/index.ts publications --mock      # publications mock
```

- [ ] **Step 4: Update the error message in default:**

Change:
```typescript
'Commande inconnue. Commandes: daily | date | score | events | dividends | alerts | backtest | backfill | validate',
```
To:
```typescript
'Commande inconnue. Commandes: daily | date | score | events | dividends | alerts | publications | backtest | backfill | validate',
```

---

### Task 9: Add npm scripts to package.json

**Files:**
- Modify: `scraper/package.json`

- [ ] **Step 1: Add the scripts**

In `scraper/package.json`, in the `"scripts"` object, add after the `"validate"` entry:

```json
"publications": "NODE_TLS_REJECT_UNAUTHORIZED=0 tsx src/index.ts publications",
"publications:mock": "NODE_TLS_REJECT_UNAUTHORIZED=0 tsx src/index.ts publications --mock"
```

---

### Task 10: Update GitHub Actions workflow

**Files:**
- Modify: `.github/workflows/scrape-daily.yml`

- [ ] **Step 1: Add step 5 (publications) in post-cloture job**

In the `post-cloture` job, after step "4 · Ingérer les dividendes" and before step "5 · Évaluer et envoyer les alertes", add:

```yaml
      - name: 5 · Ingérer les publications
        run: cd scraper && npm run publications
        env:
          BDFIN_BASE_URL:           ${{ secrets.BDFIN_BASE_URL }}
          BDFIN_USERNAME:           ${{ secrets.BDFIN_USERNAME }}
          BDFIN_PASSWORD:           ${{ secrets.BDFIN_PASSWORD }}
          SUPABASE_URL:             ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

- [ ] **Step 2: Renumber subsequent steps in post-cloture**

Rename:
- `5 · Évaluer et envoyer les alertes` → `6 · Évaluer et envoyer les alertes`
- `6 · Déclencher redéploiement Vercel` → `7 · Déclencher redéploiement Vercel`

- [ ] **Step 3: Add step 3 (publications) in matin-events job**

In the `matin-events` job, after step "2 · Dividendes du matin", add:

```yaml
      - name: 3 · Publications du matin
        run: cd scraper && npm run publications
        env:
          BDFIN_BASE_URL:           ${{ secrets.BDFIN_BASE_URL }}
          BDFIN_USERNAME:           ${{ secrets.BDFIN_USERNAME }}
          BDFIN_PASSWORD:           ${{ secrets.BDFIN_PASSWORD }}
          SUPABASE_URL:             ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

---

### Task 11: Final verification

- [ ] **Step 1: Run all tests**

```bash
cd "c:\Users\adego\OneDrive\Documents\brvm-analyst-pro\scraper"
npx vitest run
```

Expected: All tests PASS (existing 32 + new 16 = 48 tests).

- [ ] **Step 2: Run typecheck**

```bash
cd "c:\Users\adego\OneDrive\Documents\brvm-analyst-pro\scraper"
npx tsc -p tsconfig.json --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Smoke test mock mode**

```bash
cd "c:\Users\adego\OneDrive\Documents\brvm-analyst-pro\scraper"
# With DRY_RUN=true to avoid needing Supabase credentials
DRY_RUN=true npx tsx src/index.ts publications --mock
```

Expected: logs "Mode MOCK publications", "DRY_RUN — publications non écrites", exit code 0.

---

## Calibration Notes (TODO after real BDFIN access)

The following values in `runPublications.ts` are **best-guess defaults** based on ASP.NET WebForms conventions. They must be confirmed against the real BDFIN markup:

| Constant | Default | How to confirm |
|---|---|---|
| `PUBLICATIONS_PATH` | `/Publications.aspx` | Check menu links on `/Default.aspx` |
| `DROPDOWN_NAME` | `ctl00$Main$DropDownList1` | Inspect `<select name="...">` in page source |
| GridView table ID | `ctl00_Main_GridView1` | Inspect `<table id="...">` in page source |

When the scraper runs in real mode and cannot find the table, it logs a warning with `htmlSnippet` (first 500 chars of the HTML). Use this to identify the correct selectors without manual browser inspection.
