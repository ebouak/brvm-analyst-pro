# Fiche action — données marché étendues + événements sur graphique

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrichir la fiche action `/actions/[code]` avec (A) un panneau de données marché complet (Ouverture, +haut/+bas, Clôture veille, Capitalisation, Volume moyen) et (B) des marqueurs d'événements sur le graphique de cours (AG, Dividende, Publication, Admission). Phase B scraper richbourse pour les champs manquants.

**Architecture:** Phase A (frontend only) : passer les événements existants (market_events + dividends + publications) comme `ChartMarker[]` à `PriceChart`, afficher les champs dérivables. Phase B (scraper + migration) : scraper `richbourse.com/common/mouvements/index/[CODE]` → nouvelles colonnes `brvm_actions_daily` (ouverture, plus_haut, plus_bas) + `brvm_instruments` (flottant).

**Tech Stack:** Next.js 14, lightweight-charts v5 (`createSeriesMarkers`), TypeScript strict, axios + cheerio (scraper), Supabase PostgreSQL.

---

## Structure des fichiers

**Créer :**
- `frontend/components/EventMarkerLegend.tsx` — légende des marqueurs (AG / D / RT / A)
- `scraper/src/scrapers/richbourse-details.ts` — scraper détails par code
- `scraper/src/scrapers/runDetails.ts` — orchestrateur
- `supabase/migrations/0017_market_details.sql` — nouvelles colonnes

**Modifier :**
- `frontend/components/PriceChart.tsx` — accepter `markers?: ChartMarker[]`, les afficher via `createSeriesMarkers`
- `frontend/app/actions/[code]/page.tsx` — panel cotation étendu + construction ChartMarker[] + passage à PriceChart
- `scraper/src/index.ts` — case `'details'`
- `scraper/package.json` — scripts `details` / `details:mock`

---

## Task 1 : Marqueurs d'événements dans PriceChart

**Files:**
- Modify: `frontend/components/PriceChart.tsx`
- Create: `frontend/components/EventMarkerLegend.tsx`

- [ ] **Step 1 : Définir le type ChartMarker et l'ajouter à PriceChart**

Dans `frontend/components/PriceChart.tsx`, ajouter en tête du fichier (après les imports lightweight-charts existants) :

```ts
import { createSeriesMarkers } from 'lightweight-charts';
```

Ajouter le type (après `PricePoint`) :

```ts
export interface ChartMarker {
  date: string;         // YYYY-MM-DD
  label: string;        // 'AG' | 'D' | 'RT' | 'PUB' | 'A'
  color: string;        // hex
  title: string;        // tooltip au hover
}
```

Modifier l'interface Props :

```ts
interface Props {
  data: PricePoint[];
  designation?: string;
  markers?: ChartMarker[];   // ← ajouter
}
```

Modifier la signature du composant :

```ts
export default function PriceChart({ data, designation, markers = [] }: Props) {
```

- [ ] **Step 2 : Brancher createSeriesMarkers après areaSeries.setData()**

Dans le `useEffect` principal, après la ligne `areaSeries.setData(areaData);` (≈ ligne 203), ajouter :

```ts
    // ── Event markers ─────────────────────────────────────────────────────
    if (markers.length > 0) {
      // Filtrer les marqueurs dans la fenêtre de dates affichées
      const dateSet = new Set(dates);
      // Pour un marqueur sans séance exacte, prendre la date de séance la + proche
      const sessionDates = dates.slice().sort();

      function nearestSession(markerDate: string): string | null {
        // Cherche la date de séance <= markerDate la plus récente
        let best: string | null = null;
        for (const d of sessionDates) {
          if (d <= markerDate) best = d;
          else break;
        }
        return best;
      }

      const seriesMarkers = markers
        .map((m) => {
          const t = dateSet.has(m.date) ? m.date : nearestSession(m.date);
          if (!t) return null;
          return {
            time: toTime(t),
            position: 'aboveBar' as const,
            color: m.color,
            shape: 'circle' as const,
            text: m.label,
            size: 1,
            id: `${m.label}-${m.date}`,
          };
        })
        .filter((m): m is NonNullable<typeof m> => m !== null)
        // lightweight-charts v5 exige un tri croissant par time
        .sort((a, b) => String(a.time).localeCompare(String(b.time)));

      if (seriesMarkers.length > 0) {
        createSeriesMarkers(areaSeries, seriesMarkers);
      }
    }
```

- [ ] **Step 3 : Ajouter markers dans le tableau des dépendances useEffect**

Modifier la ligne de dépendances :

```ts
  }, [mounted, data, visible, period, markers]);
```

- [ ] **Step 4 : Créer la légende des marqueurs**

```tsx
// frontend/components/EventMarkerLegend.tsx
import type { ChartMarker } from './PriceChart';

const LEGEND_ITEMS: { label: string; color: string; desc: string }[] = [
  { label: 'AG', color: '#42a5f5', desc: 'Assemblée Générale' },
  { label: 'D',  color: '#ffb300', desc: 'Dividende / Ex-date' },
  { label: 'RT', color: '#7e57c2', desc: 'Rapport / Publication' },
  { label: 'A',  color: '#00c853', desc: 'Admission / Événement' },
];

export default function EventMarkerLegend({ markers }: { markers: ChartMarker[] }) {
  if (markers.length === 0) return null;
  const present = new Set(markers.map((m) => m.label));
  const visible = LEGEND_ITEMS.filter((i) => present.has(i.label));
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3 pt-2 border-t border-border/50">
      {visible.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span
            className="inline-flex items-center justify-center rounded-full text-[9px] font-bold"
            style={{ width: 18, height: 18, background: item.color, color: '#0f1117' }}
          >
            {item.label}
          </span>
          <span className="text-xs text-muted">{item.desc}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5 : Vérifier le typecheck**

```bash
cd frontend && npm run typecheck 2>&1 | grep -E "PriceChart|EventMarker" | head -10
```
Attendu : 0 erreur TypeScript sur ces fichiers.

- [ ] **Step 6 : Commit**

```bash
git add frontend/components/PriceChart.tsx frontend/components/EventMarkerLegend.tsx
git commit -m "feat(chart): marqueurs d'événements sur graphique (AG, D, RT, A)"
```

---

## Task 2 : Construction des ChartMarkers dans la page action

**Files:**
- Modify: `frontend/app/actions/[code]/page.tsx`

- [ ] **Step 1 : Ajouter l'import des nouveaux composants**

En tête du fichier, ajouter après les imports existants :

```ts
import type { ChartMarker } from '@/components/PriceChart';
import EventMarkerLegend from '@/components/EventMarkerLegend';
```

- [ ] **Step 2 : Ajouter `shares` à la query instruments**

La query `brvm_instruments` utilise déjà `select('*')` → `shares` est déjà disponible dans `instrument`. Vérifier que le type est typé correctement (ligne ~74) :

```ts
    instrument: instr as {
      designation?: string;
      secteur?: string;
      pays?: string;
      type?: string;
      shares?: number | null;
      shares_source?: string | null;
    } | null,
```
Ce type existe déjà — aucun changement nécessaire.

- [ ] **Step 3 : Construire les ChartMarkers à partir des données existantes**

Après la ligne `const det = detect(validCloses);` (≈ ligne 118), ajouter :

```ts
  // ── Marqueurs d'événements pour le graphique ──────────────────────────────
  const chartMarkers: ChartMarker[] = [];

  // Dividendes → marqueur 'D' jaune sur la ex_date
  for (const d of dividends as { montant: number; ex_date: string | null; payment_date?: string | null }[]) {
    if (d.ex_date) {
      chartMarkers.push({
        date: d.ex_date,
        label: 'D',
        color: '#ffb300',
        title: `Dividende ${d.montant} FCFA`,
      });
    }
  }

  // Publications → marqueur 'RT' violet
  for (const p of publications.slice(0, 20)) {
    chartMarkers.push({
      date: p.date_publication,
      label: 'RT',
      color: '#7e57c2',
      title: p.libelle ?? 'Publication',
    });
  }

  // Événements marché → marqueur selon event_type
  for (const e of events as { event_date: string; event_type: string; title: string }[]) {
    const t = e.event_type?.toLowerCase() ?? '';
    let label = 'A';
    let color = '#00c853';
    if (t.includes('assembl') || t === 'assemblee') { label = 'AG'; color = '#42a5f5'; }
    else if (t.includes('result') || t.includes('rapport')) { label = 'RT'; color = '#7e57c2'; }
    else if (t.includes('dividend')) { label = 'D'; color = '#ffb300'; }
    chartMarkers.push({ date: e.event_date, label, color, title: e.title });
  }
```

- [ ] **Step 4 : Calculer la capitalisation (Valorisation)**

Après le calcul de `divYield` (≈ ligne 155), ajouter :

```ts
  // Capitalisation boursière = cours_jour × shares
  const shares = instrument?.shares ?? null;
  const capitalisation = shares != null && last.cours_jour != null
    ? (last.cours_jour * shares) / 1_000_000  // en MFCFA
    : null;

  // Volume moyen (20 dernières séances avec volume valide)
  const recentVols = rows.slice(-20).map((r) => r.volume).filter((v): v is number => v != null);
  const volMoyen = recentVols.length > 0
    ? Math.round(recentVols.reduce((a, b) => a + b, 0) / recentVols.length)
    : null;
```

- [ ] **Step 5 : Étendre le panneau "Cotation" avec les nouvelles métriques**

Remplacer le grid `grid-cols-2 md:grid-cols-4` de la section Cotation (≈ ligne 226) :

```tsx
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm border-t border-border/50 pt-3">
          <Metric label="Clôture veille" value={fmtNumber(last.cours_precedent) + ' FCFA'} />
          <Metric label="Volume du jour" value={fmtNumber(last.volume) + ' titres'} />
          <Metric label="Valeur échangée" value={fmtFcfa(last.valeur_echangee) + ' FCFA'} />
          <Metric label="Transactions" value={fmtNumber(last.nb_transactions)} />
          {shares != null && (
            <Metric label="Nbre total titres" value={fmtNumber(shares)} />
          )}
          {capitalisation != null && (
            <Metric label="Capitalisation" value={fmtNumber(Math.round(capitalisation)) + ' MFCFA'} />
          )}
          {volMoyen != null && (
            <Metric label="Vol. moyen 20j" value={fmtNumber(volMoyen) + ' titres'} />
          )}
          {divYield != null && (
            <Metric label="Rdt dividende" value={divYield.toFixed(2) + '%'} />
          )}
        </div>
```

- [ ] **Step 6 : Passer les marqueurs à PriceChart et ajouter la légende**

Trouver la ligne avec `<PriceChart data={priceData} ...` (≈ ligne 280) et remplacer :

```tsx
        <PriceChart
          data={priceData}
          designation={instrument?.designation ?? last.designation ?? code}
          markers={chartMarkers}
        />
        <EventMarkerLegend markers={chartMarkers} />
```

- [ ] **Step 7 : Vérifier le typecheck**

```bash
cd frontend && npm run typecheck 2>&1 | head -20
```
Attendu : 0 erreur.

- [ ] **Step 8 : Commit**

```bash
git add frontend/app/actions/[code]/page.tsx
git commit -m "feat(action): capitalisation + vol moyen + marqueurs événements passés au graphique"
```

---

## Task 3 : Migration SQL — nouvelles colonnes

**Files:**
- Create: `supabase/migrations/0017_market_details.sql`

- [ ] **Step 1 : Créer la migration**

```sql
-- 0017_market_details.sql
-- Champs de cotation détaillés (source : richbourse.com/common/mouvements)
alter table public.brvm_actions_daily
  add column if not exists ouverture     numeric(12,2),
  add column if not exists plus_haut     numeric(12,2),
  add column if not exists plus_bas      numeric(12,2);

-- Données société complémentaires
alter table public.brvm_instruments
  add column if not exists flottant      bigint,      -- nombre de titres du flottant
  add column if not exists vol_moyen_30j integer;     -- volume moyen 30 jours (titres)

comment on column public.brvm_actions_daily.ouverture  is 'Cours d''ouverture de séance (source richbourse)';
comment on column public.brvm_actions_daily.plus_haut  is 'Plus haut intraday (source richbourse)';
comment on column public.brvm_actions_daily.plus_bas   is 'Plus bas intraday (source richbourse)';
comment on column public.brvm_instruments.flottant     is 'Titres du flottant (source richbourse)';
comment on column public.brvm_instruments.vol_moyen_30j is 'Volume moyen 30 jours (source richbourse)';
```

- [ ] **Step 2 : Appliquer la migration dans Supabase**

Dans l'éditeur SQL Supabase (dashboard → SQL Editor), coller et exécuter le contenu de `0017_market_details.sql`.

Vérifier :
```sql
select column_name from information_schema.columns
where table_name = 'brvm_actions_daily'
  and column_name in ('ouverture', 'plus_haut', 'plus_bas');
-- Attendu : 3 lignes
```

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/0017_market_details.sql
git commit -m "feat(db): colonnes ouverture/plus_haut/plus_bas + flottant/vol_moyen_30j"
```

---

## Task 4 : Scraper richbourse détails par code

**Files:**
- Create: `scraper/src/scrapers/richbourse-details.ts`
- Create: `scraper/src/scrapers/runDetails.ts`

- [ ] **Step 1 : Créer le scraper richbourse-details**

```ts
// scraper/src/scrapers/richbourse-details.ts
import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../logger.js';

export interface RichbourseDetail {
  code: string;
  date_marche: string;           // YYYY-MM-DD séance du jour (la plus récente)
  ouverture: number | null;
  plus_haut: number | null;
  plus_bas: number | null;
  flottant: number | null;       // Titres du flottant
  vol_moyen: number | null;      // Volume moyen
}

const BASE = 'https://www.richbourse.com';
const THROTTLE_MS = 800;

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function parseNum(s: string | undefined): number | null {
  if (!s) return null;
  const clean = s.replace(/\s/g, '').replace(/ /g, '').replace(/,/g, '.');
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

function parseRow($: cheerio.CheerioAPI, label: string): number | null {
  let val: number | null = null;
  $('tr').each((_, tr) => {
    const cells = $(tr).find('td');
    if (cells.length < 2) return;
    const key = $(cells[0]).text().trim().toLowerCase();
    if (key.includes(label.toLowerCase())) {
      val = parseNum($(cells[1]).text().trim());
      return false; // break
    }
  });
  return val;
}

export async function scrapeDetails(code: string): Promise<RichbourseDetail | null> {
  const url = `${BASE}/common/mouvements/index/${code}`;
  try {
    const { data: html } = await axios.get<string>(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BRVM-Analyst/1.0)' },
      timeout: 15000,
      responseType: 'text',
    });
    const $ = cheerio.load(html);

    // Date de la séance : chercher un texte de forme "XX/XX/XXXX" dans le titre/header
    let dateMarche = new Date().toISOString().slice(0, 10); // fallback = aujourd'hui
    $('h2, h3, .titre, .date-seance').each((_, el) => {
      const text = $(el).text();
      const m = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (m) {
        dateMarche = `${m[3]}-${m[2]}-${m[1]}`;
        return false;
      }
    });

    const ouverture = parseRow($, 'ouverture');
    const plus_haut = parseRow($, 'plus haut');
    const plus_bas  = parseRow($, 'plus bas');
    const flottant  = parseRow($, 'flottant');
    const vol_moyen = parseRow($, 'volume moyen');

    logger.info({ code, ouverture, plus_haut, plus_bas, flottant }, 'Détails richbourse');
    return { code, date_marche: dateMarche, ouverture, plus_haut, plus_bas, flottant, vol_moyen };
  } catch (e) {
    logger.warn({ code, err: (e as Error).message }, 'scrapeDetails échoué');
    return null;
  }
}
```

- [ ] **Step 2 : Créer le runner**

```ts
// scraper/src/scrapers/runDetails.ts
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { scrapeDetails } from './richbourse-details.js';

const THROTTLE_MS = 800;
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

export interface DetailsResult {
  status: 'success' | 'failed' | 'mock';
  count: number;
  message?: string;
}

export async function runDetails(opts: { codes?: string[]; mock?: boolean } = {}): Promise<DetailsResult> {
  if (opts.mock) {
    logger.info('Details mock — pas de scraping richbourse');
    return { status: 'mock', count: 0, message: 'mode mock, aucun upsert' };
  }

  const sb = getSupabase();

  // Charger les codes actifs si non fournis
  let codes = opts.codes ?? [];
  if (codes.length === 0) {
    const { data } = await sb.from('brvm_instruments').select('code').eq('actif', true).eq('type', 'action');
    codes = (data ?? []).map((r: { code: string }) => r.code);
  }

  logger.info({ total: codes.length }, 'Scraping détails richbourse');
  let successCount = 0;

  for (let i = 0; i < codes.length; i++) {
    const code = codes[i]!;
    const detail = await scrapeDetails(code);
    if (!detail) continue;

    // Upsert ouverture/plus_haut/plus_bas dans brvm_actions_daily
    if (detail.ouverture != null || detail.plus_haut != null || detail.plus_bas != null) {
      const { error: e1 } = await sb
        .from('brvm_actions_daily')
        .update({
          ouverture: detail.ouverture,
          plus_haut: detail.plus_haut,
          plus_bas: detail.plus_bas,
        })
        .eq('code', code)
        .eq('date_marche', detail.date_marche);
      if (e1) logger.warn({ code, err: e1.message }, 'Update brvm_actions_daily échoué');
    }

    // Upsert flottant/vol_moyen dans brvm_instruments
    if (detail.flottant != null || detail.vol_moyen != null) {
      const patch: Record<string, number> = {};
      if (detail.flottant != null) patch.flottant = detail.flottant;
      if (detail.vol_moyen != null) patch.vol_moyen_30j = detail.vol_moyen;
      const { error: e2 } = await sb.from('brvm_instruments').update(patch).eq('code', code);
      if (e2) logger.warn({ code, err: e2.message }, 'Update brvm_instruments échoué');
    }

    successCount++;
    if (i < codes.length - 1) await sleep(THROTTLE_MS);
  }

  logger.info({ count: successCount, total: codes.length }, 'Détails richbourse ingérés');
  return { status: 'success', count: successCount };
}
```

- [ ] **Step 3 : Vérifier le typecheck scraper**

```bash
cd scraper && npm run typecheck 2>&1 | grep -E "richbourse-details|runDetails" | head -10
```
Attendu : 0 erreur.

- [ ] **Step 4 : Commit**

```bash
git add scraper/src/scrapers/richbourse-details.ts scraper/src/scrapers/runDetails.ts
git commit -m "feat(scraper): richbourse-details — ouverture/+haut/+bas/flottant par code"
```

---

## Task 5 : Intégration CLI + affichage frontend des champs scrapés

**Files:**
- Modify: `scraper/src/index.ts`
- Modify: `scraper/package.json`
- Modify: `frontend/app/actions/[code]/page.tsx`

- [ ] **Step 1 : Ajouter l'import dans index.ts**

Après les imports existants (≈ ligne 39) :

```ts
import { runDetails } from './scrapers/runDetails.js';
```

- [ ] **Step 2 : Ajouter le case**

Après le case `'publications'` dans le switch :

```ts
    case 'details': {
      const codes = positional.length > 0 ? positional : undefined;
      const res = await runDetails({ codes, mock });
      return res.status === 'failed' ? 1 : 0;
    }
```

Mettre à jour le message d'erreur default pour ajouter `details`.

- [ ] **Step 3 : Ajouter les scripts dans package.json**

Après `"actualites:mock"` :

```json
    "details": "tsx src/index.ts details",
    "details:mock": "tsx src/index.ts details --mock",
```

- [ ] **Step 4 : Étendre la query dans la page action pour lire ouverture/plus_haut/plus_bas**

Dans `getData()`, la query `brvm_actions_daily` utilise déjà `select('*')` → les nouveaux champs sont automatiquement inclus. Mettre à jour le type `ActionDaily` dans `frontend/lib/types.ts` pour inclure ces champs optionnels :

Chercher la définition de `ActionDaily` dans `frontend/lib/types.ts` et ajouter :

```ts
  ouverture?: number | null;
  plus_haut?: number | null;
  plus_bas?: number | null;
```

- [ ] **Step 5 : Afficher ouverture/plus_haut/plus_bas dans le panneau Cotation**

Dans la page action, dans le grid des métriques (Task 2 Step 5), ajouter conditionnellement après "Clôture veille" :

```tsx
          {last.ouverture != null && (
            <Metric label="Ouverture" value={fmtNumber(last.ouverture) + ' FCFA'} />
          )}
          {last.plus_haut != null && (
            <Metric label="Plus haut" value={fmtNumber(last.plus_haut) + ' FCFA'} />
          )}
          {last.plus_bas != null && (
            <Metric label="Plus bas" value={fmtNumber(last.plus_bas) + ' FCFA'} />
          )}
          {instrument?.flottant != null && (
            <Metric label="Titres flottant" value={fmtNumber(instrument.flottant)} />
          )}
```

Mettre à jour le type inline du instrument pour inclure `flottant` :

```ts
    instrument: instr as {
      designation?: string;
      secteur?: string;
      pays?: string;
      type?: string;
      shares?: number | null;
      shares_source?: string | null;
      flottant?: number | null;
      vol_moyen_30j?: number | null;
    } | null,
```

- [ ] **Step 6 : Typecheck final**

```bash
cd frontend && npm run typecheck 2>&1 | head -20
cd scraper && npm run typecheck 2>&1 | head -20
```
Attendu : 0 erreur.

- [ ] **Step 7 : Commit + push**

```bash
git add scraper/src/index.ts scraper/package.json frontend/app/actions/[code]/page.tsx frontend/lib/types.ts
git commit -m "feat(action): panel données complet (ouverture/+haut/+bas/flottant) + CLI details"
git push origin main
```

---

## Résumé des fichiers touchés

| Fichier | Action |
|---|---|
| `frontend/components/PriceChart.tsx` | Modifier (markers prop + createSeriesMarkers) |
| `frontend/components/EventMarkerLegend.tsx` | Créer (légende AG/D/RT/A) |
| `frontend/app/actions/[code]/page.tsx` | Modifier (panel étendu + ChartMarkers) |
| `frontend/lib/types.ts` | Modifier (ouverture/plus_haut/plus_bas) |
| `supabase/migrations/0017_market_details.sql` | Créer |
| `scraper/src/scrapers/richbourse-details.ts` | Créer |
| `scraper/src/scrapers/runDetails.ts` | Créer |
| `scraper/src/index.ts` | Modifier (case details) |
| `scraper/package.json` | Modifier (2 scripts) |

## Ordre d'exécution recommandé

1. Task 1 + 2 (graphique + panel frontend) — valeur immédiate, 0 dépendance DB
2. Task 3 (migration SQL) — appliquer dans Supabase
3. Task 4 + 5 (scraper) — enrichissement progressif au fil des runs quotidiens
