# Actualités Richbourse → Calendrier économique — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scraper richbourse.com/common/actualite/index (public, sans login) pour ingérer communiqués et actualités BRVM dans `market_events`, puis les afficher dans le calendrier économique `/calendrier`.

**Architecture:** Nouveau module `scraper/src/actualites/` (axios + cheerio, pagination, classifieur, extraction ticker). Stockage dans `market_events` existante via `MarketEvent` (même type que `events/`). Frontend : ajout chip "Actualités", badge source, lien "Lire →". Fix bug : la page calendrier requête `brvm_events` au lieu de `market_events`.

**Tech Stack:** Node.js ≥20, TypeScript ESM, axios, cheerio, @supabase/supabase-js (service_role), Next.js 14, TailwindCSS.

---

## Structure des fichiers

**Créer :**
- `scraper/src/actualites/parser.ts` — parse HTML richbourse → `ParsedActualite[]`
- `scraper/src/actualites/classify.ts` — `classifySourceType`, `classifyEventType`, `extractTicker`
- `scraper/src/actualites/mock.ts` — fixtures pour dev offline
- `scraper/src/actualites/runActualites.ts` — orchestrateur pagination + upsert
- `scraper/tests/actualites.test.ts` — tests unitaires

**Modifier :**
- `scraper/src/index.ts` — ajouter case `'actualites'`
- `scraper/package.json` — ajouter scripts `actualites` / `actualites:mock`
- `frontend/lib/calendarHelpers.ts` — ajouter kind `'ACTUALITE'`, champ `source`, update helpers
- `frontend/app/calendrier/page.tsx` — fix `brvm_events`→`market_events`, ajouter StatCard, type `'actualite'`
- `frontend/components/CalendarFilters.tsx` — ajouter chip "Actualités"
- `frontend/components/CalendarTimeline.tsx` — badge source + lien "Lire →"

**Réutiliser sans modifier :**
- `scraper/src/events/repository.ts` — `upsertEvents()` + `MarketEvent` type (identique)
- `scraper/src/events/types.ts` — `MarketEvent`, `EventSourceType`, `EventType`
- `scraper/src/utils/hash.ts` — `sha256()`
- `scraper/src/utils/dates.ts` — `parseFrDate()`
- `scraper/src/persistence/supabase.ts` — `getSupabase()`
- `scraper/src/logger.ts` — `logger`

---

## Task 1 : Parser HTML richbourse

**Files:**
- Create: `scraper/src/actualites/parser.ts`
- Test: `scraper/tests/actualites.test.ts`

- [ ] **Step 1 : Écrire le test échouant**

```ts
// scraper/tests/actualites.test.ts
import { describe, it, expect } from 'vitest';
import { parseActualitesPage } from '../src/actualites/parser.js';

const FIXTURE_HTML = `
<html><body>
  <div class="item-actualite">
    <span class="date">05/06/2026</span>
    <a href="/common/actualite/123" class="titre">SGBC : Résultats semestriels 2025</a>
    <p class="resume">La Société Générale annonce...</p>
  </div>
  <div class="item-actualite">
    <span class="date">04/06/2026</span>
    <a href="/common/actualite/122" class="titre">Convocation AGO - SNTS</a>
  </div>
  <div class="item-actualite">
    <span class="date">invalide</span>
    <a href="/common/actualite/121" class="titre">Article sans date valide</a>
  </div>
</html>`;

describe('parseActualitesPage', () => {
  it('extrait les actualités avec date valide', () => {
    const items = parseActualitesPage(FIXTURE_HTML, 'https://www.richbourse.com');
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      date_publication: '2026-06-05',
      titre: 'SGBC : Résultats semestriels 2025',
      url: 'https://www.richbourse.com/common/actualite/123',
      resume: 'La Société Générale annonce...',
    });
    expect(items[1]).toMatchObject({
      date_publication: '2026-06-04',
      titre: 'Convocation AGO - SNTS',
      url: 'https://www.richbourse.com/common/actualite/122',
      resume: null,
    });
  });

  it('déduplique les entrées identiques', () => {
    const html = `<html><body>
      <div class="item-actualite">
        <span class="date">05/06/2026</span>
        <a href="/common/actualite/123">SGBC : Résultats</a>
      </div>
      <div class="item-actualite">
        <span class="date">05/06/2026</span>
        <a href="/common/actualite/123">SGBC : Résultats</a>
      </div>
    </body></html>`;
    const items = parseActualitesPage(html, 'https://www.richbourse.com');
    expect(items).toHaveLength(1);
  });

  it('retourne [] si page vide', () => {
    const items = parseActualitesPage('<html><body></body></html>', 'https://www.richbourse.com');
    expect(items).toHaveLength(0);
  });
});
```

- [ ] **Step 2 : Vérifier que le test échoue**

```bash
cd scraper && npm test -- --reporter=verbose tests/actualites.test.ts
```
Attendu : FAIL — `parseActualitesPage` n'existe pas.

- [ ] **Step 3 : Implémenter le parser**

```ts
// scraper/src/actualites/parser.ts
import * as cheerio from 'cheerio';
import { parseFrDate } from '../utils/dates.js';

export interface ParsedActualite {
  date_publication: string; // YYYY-MM-DD
  titre: string;
  url: string | null;
  resume: string | null;
}

export function parseActualitesPage(html: string, baseUrl: string): ParsedActualite[] {
  const $ = cheerio.load(html);
  const results: ParsedActualite[] = [];
  const seen = new Set<string>();

  // Richbourse structure : blocs d'articles avec date + lien titre.
  // Sélecteurs larges pour s'adapter aux variations de markup.
  // Stratégie 1 : blocs .item-actualite / article / li avec date + lien
  const blocks: cheerio.Cheerio<cheerio.Element>[] = [];

  $('[class*="actualite"], [class*="news"], article, .item').each((_, el) => {
    blocks.push($(el));
  });

  // Stratégie 2 : si aucun bloc structuré, chercher tous les liens avec une
  // date nearby (mode tableau ou liste simple)
  if (blocks.length === 0) {
    $('a[href*="actualite"]').each((_, el) => {
      blocks.push($(el).parent());
    });
  }

  for (const block of blocks) {
    // Date : chercher d'abord un span/div avec "date", sinon le premier texte
    // qui ressemble à une date dans le bloc.
    let rawDate = block.find('[class*="date"]').first().text().trim();
    if (!rawDate) {
      // Chercher une date dans tout le texte du bloc
      const match = block.text().match(/\d{1,2}[/\-]\d{1,2}[/\-]\d{4}/);
      rawDate = match ? match[0] : '';
    }

    const date = parseFrDate(rawDate);
    if (!date) continue;

    const link = block.find('a').first();
    const titre = (link.text().trim() || block.find('[class*="titre"], [class*="title"]').first().text().trim());
    if (!titre) continue;

    let url: string | null = null;
    const href = link.attr('href');
    if (href) {
      try { url = new URL(href, baseUrl).href; } catch { url = null; }
    }

    const resume = block.find('[class*="resume"], [class*="desc"], p').first().text().trim() || null;

    const key = `${date}|${titre}`;
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({ date_publication: date, titre, url, resume });
  }

  return results;
}
```

- [ ] **Step 4 : Vérifier que le test passe**

```bash
cd scraper && npm test -- tests/actualites.test.ts
```
Attendu : PASS (3/3 tests). Si les sélecteurs ne matchent pas le fixture HTML exact, ajuster les sélecteurs cheerio.

- [ ] **Step 5 : Commit**

```bash
git add scraper/src/actualites/parser.ts scraper/tests/actualites.test.ts
git commit -m "feat(actualites): parser HTML richbourse + tests"
```

---

## Task 2 : Classifieur (source_type, event_type, ticker)

**Files:**
- Create: `scraper/src/actualites/classify.ts`
- Modify: `scraper/tests/actualites.test.ts` (ajouter describe blocks)

- [ ] **Step 1 : Ajouter les tests classifieur**

Ajouter à la fin de `scraper/tests/actualites.test.ts` :

```ts
import { classifySourceType, classifyEventType, extractTicker } from '../src/actualites/classify.js';

describe('classifySourceType', () => {
  it.each([
    ['SGBC : Avis de convocation AGO', 'communique'],
    ['Communiqué relatif aux résultats SNTS', 'communique'],
    ['Rapport annuel 2025 BOAB', 'communique'],
    ['Interview du DG de TOTAL CI', 'actualite'],
    ['Marché actions : semaine du 2 juin', 'actualite'],
  ])('%s → %s', (titre, expected) => {
    expect(classifySourceType(titre)).toBe(expected);
  });
});

describe('classifyEventType', () => {
  it.each([
    ['Résultats semestriels SGBC 2025', 'resultats'],
    ['Convocation AGO SNTS exercice 2025', 'assemblee'],
    ['Dividende 2025 : ex-date TTLC', 'dividende'],
    ['Admission de LNBB à la cote BRVM', 'admission'],
    ['Point de marché hebdomadaire', 'autre'],
  ])('%s → %s', (titre, expected) => {
    expect(classifyEventType(titre)).toBe(expected);
  });
});

describe('extractTicker', () => {
  it.each([
    ['SGBC : Résultats 2025', 'SGBC'],
    ['Convocation AGO - SNTS', 'SNTS'],
    ['BOABF annonce ses résultats', 'BOABF'],  // priorité 6 chars
    ['Marché sans ticker précis', null],
    ['BOAB et BOABF comparés', 'BOABF'],        // BOABF détecté en premier (ordre décroissant)
  ])('%s → %s', (titre, expected) => {
    expect(extractTicker(titre)).toBe(expected);
  });
});
```

- [ ] **Step 2 : Vérifier que les nouveaux tests échouent**

```bash
cd scraper && npm test -- tests/actualites.test.ts
```
Attendu : 3 describes parser PASS, 3 describes classifieur FAIL.

- [ ] **Step 3 : Implémenter le classifieur**

```ts
// scraper/src/actualites/classify.ts
import type { EventSourceType, EventType } from '../events/types.js';

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const COMMUNIQUE_KEYWORDS = [
  'avis', 'communique', 'decision', 'convocation', 'ago', 'age',
  'resultat', 'rapport', 'dividende', 'bilan', 'ifrs', 'syscohada',
  'notation', 'emission', 'offre', 'introduction', 'admission',
  'suspension', 'radiation',
];

export function classifySourceType(titre: string): EventSourceType {
  const n = normalize(titre);
  return COMMUNIQUE_KEYWORDS.some((kw) => n.includes(kw)) ? 'communique' : 'publication';
}

const EVENT_TYPE_RULES: Array<{ type: EventType; keywords: string[] }> = [
  { type: 'resultats', keywords: ['resultat', 'bilan', 'chiffre', 'ifrs', 'revenu', 'benefice', 'pnb'] },
  { type: 'assemblee', keywords: ['ago', 'age', 'convocation', 'assemblee'] },
  { type: 'dividende', keywords: ['dividende', 'coupon', 'ex-date', 'detachement'] },
  { type: 'admission', keywords: ['admission', 'introduction', 'suspension', 'radiation', 'retrait'] },
];

export function classifyEventType(titre: string): EventType {
  const n = normalize(titre);
  for (const rule of EVENT_TYPE_RULES) {
    if (rule.keywords.some((kw) => n.includes(kw))) return rule.type;
  }
  return 'autre';
}

// Ordre décroissant de longueur pour éviter BOAB avant BOABF.
const TICKERS = [
  'BOABF', 'CBIBF', 'ONTBF',
  'ABJC', 'BICB', 'BICC', 'BNBC', 'BOAB', 'BOAC', 'BOAM', 'BOAN', 'BOAS',
  'CABC', 'CFAC', 'CIEC', 'ECOC', 'ETIT', 'FTSC', 'LNBB', 'NEIC', 'NSBC',
  'NTLC', 'ORAC', 'ORGT', 'PALC', 'PRSC', 'SAFC', 'SCRC', 'SDCC', 'SDSC',
  'SEMC', 'SGBC', 'SHEC', 'SIBC', 'SICC', 'SIVC', 'SLBC', 'SMBC', 'SNTS',
  'SOGC', 'SPHC', 'STAC', 'STBC', 'TTLC', 'TTLS', 'UNLC', 'UNXC',
];

const TICKER_RE = new RegExp(`\\b(${TICKERS.join('|')})\\b`);

export function extractTicker(titre: string): string | null {
  const m = titre.match(TICKER_RE);
  return m ? m[1] : null;
}
```

- [ ] **Step 4 : Vérifier que tous les tests passent**

```bash
cd scraper && npm test -- tests/actualites.test.ts
```
Attendu : PASS (tous les describes). Si un test `extractTicker` échoue sur l'ordre BOAB/BOABF, c'est un problème de regex — vérifier que l'alternance est dans l'ordre BOABF avant BOAB dans `TICKERS`.

- [ ] **Step 5 : Commit**

```bash
git add scraper/src/actualites/classify.ts scraper/tests/actualites.test.ts
git commit -m "feat(actualites): classifieur source_type + event_type + extraction ticker"
```

---

## Task 3 : Mock + Runner orchestrateur

**Files:**
- Create: `scraper/src/actualites/mock.ts`
- Create: `scraper/src/actualites/runActualites.ts`

- [ ] **Step 1 : Créer les fixtures mock**

```ts
// scraper/src/actualites/mock.ts
import type { MarketEvent } from '../events/types.js';
import { sha256 } from '../utils/hash.js';

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function buildMockActualites(): MarketEvent[] {
  const samples = [
    {
      titre: 'SGBC : Résultats semestriels 2025 — hausse du PNB',
      date: daysFromNow(2),
      url: 'https://www.richbourse.com/common/actualite/1001',
      source_type: 'communique' as const,
      event_type: 'resultats' as const,
      ticker: 'SGBC',
    },
    {
      titre: 'Convocation AGO - SNTS exercice 2025',
      date: daysFromNow(5),
      url: 'https://www.richbourse.com/common/actualite/1002',
      source_type: 'communique' as const,
      event_type: 'assemblee' as const,
      ticker: 'SNTS',
    },
    {
      titre: 'TTLC : Détachement du dividende 2025',
      date: daysFromNow(10),
      url: 'https://www.richbourse.com/common/actualite/1003',
      source_type: 'communique' as const,
      event_type: 'dividende' as const,
      ticker: 'TTLC',
    },
    {
      titre: 'Admission de LNBB au second marché BRVM',
      date: daysFromNow(15),
      url: 'https://www.richbourse.com/common/actualite/1004',
      source_type: 'communique' as const,
      event_type: 'admission' as const,
      ticker: 'LNBB',
    },
    {
      titre: 'Bilan hebdomadaire : marché en légère hausse',
      date: daysFromNow(1),
      url: 'https://www.richbourse.com/common/actualite/1005',
      source_type: 'publication' as const,
      event_type: 'autre' as const,
      ticker: null,
    },
  ];

  return samples.map((s) => ({
    event_date: s.date,
    event_datetime: null,
    source: 'richbourse',
    source_url: s.url,
    source_type: s.source_type,
    title: s.titre,
    summary: null,
    event_type: s.event_type,
    issuer_name: null,
    instrument_code: s.ticker,
    sector: null,
    country_code: null,
    importance_level: s.source_type === 'communique' ? 3 : 1,
    sentiment: null,
    tags: ['richbourse'],
    related_codes: s.ticker ? [s.ticker] : [],
    dedupe_hash: sha256(`richbourse|${s.date}|${s.titre}`),
  }));
}
```

- [ ] **Step 2 : Créer le runner**

```ts
// scraper/src/actualites/runActualites.ts
import axios from 'axios';
import { logger } from '../logger.js';
import { parseActualitesPage } from './parser.js';
import { classifySourceType, classifyEventType, extractTicker } from './classify.js';
import { upsertEvents } from '../events/repository.js';
import { buildMockActualites } from './mock.js';
import { sha256 } from '../utils/hash.js';
import type { MarketEvent } from '../events/types.js';

export interface ActualitesResult {
  status: 'success' | 'failed' | 'mock';
  count: number;
  message?: string;
}

const BASE_URL = 'https://www.richbourse.com';
const MAX_PAGES = 20;
const MAX_DAYS_BACK = 90;
const THROTTLE_MS = 500;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isTooOld(date: string, maxDaysBack: number): boolean {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxDaysBack);
  return new Date(date + 'T00:00:00Z') < cutoff;
}

export async function runActualites(opts: { mock?: boolean; maxDaysBack?: number } = {}): Promise<ActualitesResult> {
  if (opts.mock) {
    const items = buildMockActualites();
    const n = await upsertEvents(items);
    logger.info({ count: n }, 'Actualités mock ingérées');
    return { status: 'mock', count: n };
  }

  const maxDaysBack = opts.maxDaysBack ?? MAX_DAYS_BACK;
  const allEvents: MarketEvent[] = [];

  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = `${BASE_URL}/common/actualite/index${page > 1 ? `?page=${page}` : ''}`;
      logger.info({ page, url }, 'Scraping page actualités');

      const { data: html } = await axios.get<string>(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BRVM-Analyst/1.0)' },
        timeout: 15000,
        responseType: 'text',
      });

      const parsed = parseActualitesPage(html, BASE_URL);

      if (parsed.length === 0) {
        logger.info({ page }, 'Page vide — arrêt pagination');
        break;
      }

      let allOld = true;
      for (const item of parsed) {
        if (isTooOld(item.date_publication, maxDaysBack)) continue;
        allOld = false;

        const ticker = extractTicker(item.titre);
        const event: MarketEvent = {
          event_date: item.date_publication,
          event_datetime: null,
          source: 'richbourse',
          source_url: item.url,
          source_type: classifySourceType(item.titre),
          title: item.titre,
          summary: item.resume,
          event_type: classifyEventType(item.titre),
          issuer_name: null,
          instrument_code: ticker,
          sector: null,
          country_code: null,
          importance_level: classifySourceType(item.titre) === 'communique' ? 3 : 1,
          sentiment: null,
          tags: ['richbourse'],
          related_codes: ticker ? [ticker] : [],
        };
        // Ajouter dedupe_hash directement (repository.ts le calcule aussi mais on le fournit)
        (event as MarketEvent & { dedupe_hash?: string }).dedupe_hash =
          sha256(`richbourse|${item.date_publication}|${item.titre}`);

        allEvents.push(event);
      }

      if (allOld) {
        logger.info({ page }, 'Tous les articles trop anciens — arrêt');
        break;
      }

      if (page < MAX_PAGES) await sleep(THROTTLE_MS);
    }

    if (allEvents.length === 0) {
      return { status: 'success', count: 0, message: 'aucune actualité dans la fenêtre' };
    }

    const n = await upsertEvents(allEvents);
    logger.info({ total: n }, 'Actualités ingérées');
    return { status: 'success', count: n };
  } catch (e) {
    logger.error({ err: (e as Error).message }, 'runActualites failed');
    return { status: 'failed', count: 0, message: (e as Error).message };
  }
}
```

- [ ] **Step 3 : Vérifier la compilation TypeScript**

```bash
cd scraper && npm run typecheck 2>&1 | head -30
```
Attendu : aucune erreur dans les nouveaux fichiers.

- [ ] **Step 4 : Commit**

```bash
git add scraper/src/actualites/
git commit -m "feat(actualites): runner pagination richbourse + mock"
```

---

## Task 4 : Intégration CLI

**Files:**
- Modify: `scraper/src/index.ts`
- Modify: `scraper/package.json`

- [ ] **Step 1 : Ajouter l'import dans index.ts**

Ajouter après la ligne `import { runPublications }...` (ligne ~38) :

```ts
import { runActualites } from './actualites/runActualites.js';
```

- [ ] **Step 2 : Ajouter le case dans le switch**

Ajouter après le case `'publications'` (ligne ~91) dans le switch de `main()` :

```ts
    case 'actualites': {
      const res = await runActualites({ mock });
      return res.status === 'failed' ? 1 : 0;
    }
```

- [ ] **Step 3 : Mettre à jour le message d'erreur default**

Modifier la ligne `logger.error({command}, 'Commandes: ...')` pour ajouter `actualites` :

```ts
      'Commandes: daily | date | score | events | dividends | shares | alerts | publications | actualites | backtest | backfill | validate',
```

- [ ] **Step 4 : Ajouter les scripts dans package.json**

Ajouter après la ligne `"publications:mock"` :

```json
    "actualites": "tsx src/index.ts actualites",
    "actualites:mock": "tsx src/index.ts actualites --mock",
```

- [ ] **Step 5 : Tester le mode mock**

```bash
cd scraper && npm run actualites:mock 2>&1
```
Attendu : log pino `{"count":5}` "Actualités mock ingérées", exit 0. Si erreur Supabase (connexion), normal en local sans `.env.local` — juste vérifier que le log "mock ingérées" apparaît avant l'erreur de connexion ou que le mock retourne bien le count.

- [ ] **Step 6 : Commit**

```bash
git add scraper/src/index.ts scraper/package.json
git commit -m "feat(actualites): CLI actualites + actualites:mock"
```

---

## Task 5 : Frontend — calendarHelpers + fix bug brvm_events

**Files:**
- Modify: `frontend/lib/calendarHelpers.ts`
- Modify: `frontend/app/calendrier/page.tsx`

- [ ] **Step 1 : Étendre CalendarItem dans calendarHelpers.ts**

Dans `frontend/lib/calendarHelpers.ts`, modifier l'interface `CalendarItem` pour ajouter `source` et le kind `'ACTUALITE'` :

```ts
export interface CalendarItem {
  id: string;
  date: string;
  datetime?: string | null;
  kind: 'ex-date' | 'payment' | 'AG' | 'RESULTAT' | 'COMMUNIQUE' | 'INTRODUCTION' | 'ACTUALITE' | 'AUTRE';
  source?: string | null;      // 'richbourse' | 'bdfin' | null
  sourceUrl?: string | null;   // lien externe direct
  code: string | null;
  societe: string | null;
  secteur: string | null;
  pays: string | null;
  detail: string;
  montant?: number | null;
  href?: string;
  importance?: number | null;
}
```

- [ ] **Step 2 : Mettre à jour mapEventType pour inclure ACTUALITE**

Modifier la fonction `mapEventType` pour gérer `source='richbourse'` :

```ts
function mapEventType(
  raw: string,
  source?: string,
): 'AG' | 'RESULTAT' | 'COMMUNIQUE' | 'INTRODUCTION' | 'ACTUALITE' | 'AUTRE' {
  if (source === 'richbourse') return 'ACTUALITE';
  const t = raw?.toUpperCase() ?? '';
  if (t === 'AG' || t.includes('ASSEMBL')) return 'AG';
  if (t === 'RESULTAT' || t.includes('RESULT')) return 'RESULTAT';
  if (t === 'COMMUNIQUE' || t.includes('COMMUN')) return 'COMMUNIQUE';
  if (t === 'INTRODUCTION' || t.includes('INTRO')) return 'INTRODUCTION';
  return 'AUTRE';
}
```

- [ ] **Step 3 : Mettre à jour combineDividendsAndEvents**

Dans le type du paramètre `events`, ajouter `source: string | null` :

```ts
  events: Array<{
    id: string;
    event_date: string;
    event_datetime: string | null;
    title: string;
    event_type: string;
    source: string | null;        // ← ajouter
    source_url: string | null;    // ← ajouter
    instrument_code: string | null;
    issuer_name: string | null;
    sector: string | null;
    country_code: string | null;
    importance_level: number | null;
  }>;
```

Dans la boucle `for (const e of events)`, changer :

```ts
    const kind = mapEventType(e.event_type, e.source ?? undefined);
    // ...
    items.push({
      id: `evt-${e.id}`,
      date: e.event_date,
      datetime: e.event_datetime,
      kind,
      source: e.source,
      sourceUrl: e.source_url,
      // ... reste inchangé
    });
```

- [ ] **Step 4 : Mettre à jour filterByKind**

```ts
export function filterByKind(
  items: CalendarItem[],
  type: 'dividende' | 'event' | 'actualite' | 'all',
): CalendarItem[] {
  if (type === 'all') return items;
  if (type === 'dividende') return items.filter((i) => i.kind === 'ex-date' || i.kind === 'payment');
  if (type === 'actualite') return items.filter((i) => i.kind === 'ACTUALITE');
  return items.filter((i) => i.kind !== 'ex-date' && i.kind !== 'payment' && i.kind !== 'ACTUALITE');
}
```

- [ ] **Step 5 : Mettre à jour iconForKind et colorForKind**

```ts
export function iconForKind(kind: CalendarItem['kind']): string {
  switch (kind) {
    case 'ex-date': return '💰';
    case 'payment': return '💵';
    case 'AG': return '🏛️';
    case 'RESULTAT': return '📊';
    case 'COMMUNIQUE': return '📰';
    case 'INTRODUCTION': return '🆕';
    case 'ACTUALITE': return '📡';
    default: return '📌';
  }
}

export function colorForKind(kind: CalendarItem['kind']): string {
  switch (kind) {
    case 'ex-date':
    case 'payment': return 'border-l-2 border-l-warn';
    case 'AG': return 'border-l-2 border-l-blue';
    case 'RESULTAT': return 'border-l-2 border-l-up';
    case 'COMMUNIQUE': return 'border-l-2 border-l-purple';
    case 'ACTUALITE': return 'border-l-2 border-l-orange-400';
    default: return 'border-l-2 border-l-muted';
  }
}
```

- [ ] **Step 6 : Fix bug + étendre la query dans calendrier/page.tsx**

Dans `frontend/app/calendrier/page.tsx`, remplacer `.from('brvm_events')` par `.from('market_events')` et ajouter `source, source_url` dans le select :

```ts
      supabase
        .from('market_events')          // ← était brvm_events (bug)
        .select(
          'id, event_date, event_datetime, title, event_type, source, source_url, instrument_code, issuer_name, sector, country_code, importance_level',
        )
        .gte('event_date', todayStr)
        .lte('event_date', endStr)
        .order('event_date', { ascending: true })
        .limit(200),
```

Mettre à jour le type `RawEvent` pour inclure `source` et `source_url` :

```ts
interface RawEvent {
  id: string;
  event_date: string;
  event_datetime: string | null;
  title: string;
  event_type: string;
  source: string | null;
  source_url: string | null;
  instrument_code: string | null;
  issuer_name: string | null;
  sector: string | null;
  country_code: string | null;
  importance_level: number | null;
}
```

- [ ] **Step 7 : Ajouter StatCard "Actualités" et valider le type 'actualite'**

Dans la fonction `getData`, ajouter le compteur :

```ts
  const countActualites = items.filter((i) => i.kind === 'ACTUALITE').length;
  return { items, countExDates, countPayments, countEvents, countActualites };
```

Dans la page, ajouter la 4e carte et valider le type `'actualite'` :

```ts
  const type = ['dividende', 'event', 'actualite', 'all'].includes(rawType) ? rawType : 'all';
  // ...
  const { items, countExDates, countPayments, countEvents, countActualites } = await getData(daysN);
  // Dans le JSX, grid-cols-3 → grid-cols-4 :
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
    <StatCard label="Ex-dates à venir" value={countExDates} color="text-warn" />
    <StatCard label="Paiements à venir" value={countPayments} color="text-up" />
    <StatCard label="Événements" value={countEvents} color="text-blue" />
    <StatCard label="Actualités" value={countActualites} color="text-orange-400" />
  </div>
```

- [ ] **Step 8 : Commit**

```bash
git add frontend/lib/calendarHelpers.ts frontend/app/calendrier/page.tsx
git commit -m "feat(calendrier): kind ACTUALITE + source field + fix brvm_events→market_events"
```

---

## Task 6 : Frontend — CalendarFilters + CalendarTimeline

**Files:**
- Modify: `frontend/components/CalendarFilters.tsx`
- Modify: `frontend/components/CalendarTimeline.tsx`

- [ ] **Step 1 : Ajouter chip "Actualités" dans CalendarFilters**

Dans `frontend/components/CalendarFilters.tsx`, modifier le tableau `TYPES` :

```ts
const TYPES = [
  { value: 'all', label: 'Tout' },
  { value: 'dividende', label: 'Dividendes' },
  { value: 'event', label: 'Événements' },
  { value: 'actualite', label: 'Actualités' },
];
```

- [ ] **Step 2 : Ajouter badge source + lien "Lire →" dans CalendarTimeline**

Dans `frontend/components/CalendarTimeline.tsx`, modifier la fonction `CalendarCard` pour afficher le badge source et le lien externe :

```ts
function SourceBadge({ source }: { source?: string | null }) {
  if (source === 'richbourse') {
    return (
      <span className="inline-block text-[9px] font-bold px-1 py-0.5 rounded"
            style={{ background: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b44' }}>
        RB
      </span>
    );
  }
  return null;
}

function CalendarCard({ item }: { item: CalendarItem }) {
  const borderClass = colorForKind(item.kind);
  const icon = iconForKind(item.kind);

  const inner = (
    <div className={`bg-surface border border-border ${borderClass} rounded-lg px-4 py-3 hover:border-blue/30 transition-colors`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <span className="text-base leading-none mt-0.5 shrink-0">{icon}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {item.code && (
                <span className="text-xs font-mono font-bold text-blue shrink-0">{item.code}</span>
              )}
              {item.societe && (
                <span className="text-sm font-medium text-white truncate">{item.societe}</span>
              )}
              <SourceBadge source={item.source} />
            </div>
            <p className="text-xs text-muted mt-0.5">{item.detail}</p>
            {item.datetime && (
              <p className="text-xs text-muted mt-0.5">
                {new Date(item.datetime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                {item.pays ? ` · ${item.pays}` : ''}
              </p>
            )}
            {/* Lien externe richbourse */}
            {item.sourceUrl && (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue hover:underline mt-1 inline-block"
                onClick={(e) => e.stopPropagation()}
              >
                Lire →
              </a>
            )}
          </div>
        </div>

        <div className="text-right shrink-0">
          {item.montant != null && (
            <span className="text-sm font-semibold text-warn tabular">
              +{fmtFcfa(item.montant)} FCFA
            </span>
          )}
          {item.secteur && (
            <p className="text-xs text-muted mt-0.5">{item.secteur}</p>
          )}
          {item.importance != null && item.importance >= 3 && (
            <span className="inline-block mt-1 text-[10px] uppercase tracking-wide text-warn">
              {'★'.repeat(item.importance)}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  // Si actualité richbourse : wrapper Link vers /actions/[code] si code dispo,
  // sinon pas de Link (lien est dans le bouton "Lire →")
  if (item.href && item.kind !== 'ACTUALITE') {
    return <Link href={item.href}>{inner}</Link>;
  }
  if (item.href && item.kind === 'ACTUALITE' && item.code) {
    return <Link href={item.href}>{inner}</Link>;
  }
  return inner;
}
```

- [ ] **Step 3 : Vérifier le typecheck frontend**

```bash
cd frontend && npm run typecheck 2>&1 | head -30
```
Attendu : 0 erreur dans les fichiers modifiés.

- [ ] **Step 4 : Commit**

```bash
git add frontend/components/CalendarFilters.tsx frontend/components/CalendarTimeline.tsx
git commit -m "feat(calendrier): chip Actualités + badge source RB + lien Lire →"
```

---

## Task 7 : Test end-to-end mock + vérification visuelle

**Files:** aucun nouveau fichier

- [ ] **Step 1 : Lancer les tests scraper au complet**

```bash
cd scraper && npm test
```
Attendu : tous les tests passent (dont les nouveaux dans actualites.test.ts).

- [ ] **Step 2 : Lancer le mock actualités (si Supabase dispo)**

```bash
cd scraper && npm run actualites:mock
```
Attendu : `"Actualités mock ingérées" count=5` dans les logs.

- [ ] **Step 3 : Vérifier le build frontend**

```bash
cd frontend && npm run build 2>&1 | tail -20
```
Attendu : build réussi, 0 erreur TypeScript.

- [ ] **Step 4 : Vérifier la page calendrier en dev**

```bash
cd frontend && npm run dev
```
Ouvrir http://localhost:3000/calendrier — vérifier :
- 4 StatCards visibles (Ex-dates, Paiements, Événements, Actualités)
- Chip "Actualités" dans les filtres
- Aucune erreur console (notamment pas de "relation brvm_events does not exist")

- [ ] **Step 5 : Push et commit final**

```bash
git push origin main
```

---

## Résumé des fichiers touchés

| Fichier | Action |
|---|---|
| `scraper/src/actualites/parser.ts` | Créer |
| `scraper/src/actualites/classify.ts` | Créer |
| `scraper/src/actualites/mock.ts` | Créer |
| `scraper/src/actualites/runActualites.ts` | Créer |
| `scraper/tests/actualites.test.ts` | Créer |
| `scraper/src/index.ts` | Modifier (case actualites) |
| `scraper/package.json` | Modifier (2 scripts) |
| `frontend/lib/calendarHelpers.ts` | Modifier (kind, source, filterByKind) |
| `frontend/app/calendrier/page.tsx` | Modifier (fix bug + StatCard) |
| `frontend/components/CalendarFilters.tsx` | Modifier (chip Actualités) |
| `frontend/components/CalendarTimeline.tsx` | Modifier (badge + lien Lire →) |
