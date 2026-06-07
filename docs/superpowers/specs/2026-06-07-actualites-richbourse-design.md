# Actualités Richbourse → Calendrier économique — Design

> **Pour les agents:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Scraper richbourse.com/common/actualite/index (public, sans login) pour ingérer communiqués et actualités BRVM dans `market_events`, et les afficher dans le calendrier économique `/calendrier`.

**Architecture:** Nouveau module `scraper/src/actualites/` (axios + cheerio, pagination automatique, classifieur source_type + event_type, extraction ticker). Stockage dans la table `market_events` existante (`source='richbourse'`). Frontend `/calendrier` étendu avec badge source, chip filtre "Actualités", et lien "Lire →".

**Tech Stack:** Node.js/TypeScript ESM, axios, cheerio, @supabase/supabase-js (service_role), Next.js 14 App Router, TailwindCSS.

---

## 1. Scraper — module `scraper/src/actualites/`

### 1.1 Types (`types.ts`)

```ts
export interface ParsedActualite {
  date_publication: string;  // ISO "YYYY-MM-DD"
  titre: string;
  url: string | null;
  resume: string | null;
}
```

Les données sont converties en `market_events` row avant upsert — pas de type `Actualite` persisté séparément.

### 1.2 Parser (`parser.ts`)

- Entrée : HTML string de la page richbourse, baseUrl string
- Sélecteurs cheerio : cibler les blocs d'articles répétitifs (div/li/article avec date + titre + lien)
- Date : format `DD/MM/YYYY` ou `DD-MM-YYYY` → `parseFrDate()` existant dans `utils/dates.ts`
- Résumé : texte du bloc si disponible (optionnel)
- Lien : `new URL(href, baseUrl).href`
- Déduplication locale : Set sur `date|titre` avant retour
- Retourne `ParsedActualite[]`

### 1.3 Classifieur (`classify.ts`)

**`classifySourceType(titre)`** → `'communique' | 'actualite'`
Mots-clés communiqué (insensible casse, sans accents) :
`avis`, `communique`, `decision`, `convocation`, `ago`, `age`, `resultat`, `rapport`, `dividende`, `bilan`, `ifrs`, `syscohada`, `notation`, `emission`, `offre`
→ si au moins 1 trouvé : `communique`, sinon `actualite`

**`classifyEventType(titre)`** → `'resultats' | 'assemblee' | 'dividende' | 'admission' | 'autre'`
- `resultats` : "resultat", "bilan", "chiffre", "ifrs", "revenu", "benefice"
- `assemblee` : "ago", "age", "convocation", "assemblee"
- `dividende` : "dividende", "coupon", "ex-date", "detachement"
- `admission` : "admission", "introduction", "suspension", "radiation", "retrait"
- `autre` : tout le reste

**`extractTicker(titre)`** → `string | null`
Regex sur la liste exhaustive des 47 tickers BRVM (ordre décroissant de longueur pour éviter BOAB/BOABF ambiguïté) :
`BOABF, CBIBF, ONTBF, ABJC, BICB, BICC, BNBC, BOAB, BOAC, BOAM, BOAN, BOAS, CABC, CFAC, CIEC, ECOC, ETIT, FTSC, LNBB, NEIC, NSBC, NTLC, ORAC, ORGT, PALC, PRSC, SAFC, SCRC, SDCC, SDSC, SEMC, SGBC, SHEC, SIBC, SICC, SIVC, SLBC, SMBC, SNTS, SOGC, SPHC, STAC, STBC, TTLC, TTLS, UNLC, UNXC`
Premier match retourné, null si aucun.

### 1.4 Repository (`repository.ts`)

```ts
import { sha256 } from '../utils/hash.js';
import { getSupabase } from '../persistence/supabase.js';

export function dedupeHash(date: string, titre: string): string {
  return sha256(`richbourse|${date}|${titre}`);
}

export async function upsertActualites(rows: MarketEventRow[]): Promise<number>
// upsert batch 200 sur market_events, onConflict: 'dedupe_hash', ignoreDuplicates: true
```

Type `MarketEventRow` = subset des colonnes de `market_events` :
`{ event_date, source, source_url, source_type, title, event_type, instrument_code, dedupe_hash }`

### 1.5 Runner (`runActualites.ts`)

```ts
export async function runActualites(opts: { mock?: boolean; maxDaysBack?: number }): Promise<ActualitesResult>
```

- `maxDaysBack` défaut 90 jours
- Pagination : GET `https://www.richbourse.com/common/actualite/index?page=N` (N=1,2,3…)
- Arrêt : page vide OU tous articles plus vieux que `maxDaysBack` OU N > 20 (garde-fou)
- Pour chaque `ParsedActualite` : classifier, extraire ticker, construire `MarketEventRow`, ajouter au batch
- Upsert final

### 1.6 Mock (`mock.ts`)

5 fixtures couvrant les 5 event_types (resultats, assemblee, dividende, admission, autre) avec tickers variés, dates dans les 30 prochains jours.

### 1.7 Intégration CLI (`scraper/src/index.ts`)

Nouveau sous-commande `actualites[:mock]` → appelle `runActualites({ mock })`.
`package.json` : `"actualites": "tsx src/index.ts actualites"`, `"actualites:mock": "tsx src/index.ts actualites --mock"`.

---

## 2. Frontend — extensions calendrier

### 2.1 Badge source dans `CalendarTimeline` et `CalendarTable`

Ajouter un indicateur visuel sur chaque item dont `source === 'richbourse'` :
- Petit badge `RB` orange `#f59e0b` à côté du titre
- Items `source === 'bdfin'` (publications) : badge `BDFIN` bleu `#3b82f6`
- Dividendes : inchangés

### 2.2 Chip filtre "Actualités" dans `CalendarFilters`

Ajouter `type = 'actualite'` aux options existantes (`all`, `dividende`, `event`) :
- URL param `?type=actualite`
- Filtre côté serveur dans `calendarHelpers.ts` : `source === 'richbourse'`

### 2.3 Lien "Lire →" dans les cartes timeline/table

Si `source_url` non null → `<a href={source_url} target="_blank" rel="noopener">Lire →</a>`
Si `instrument_code` non null → lien secondaire vers `/actions/[code]`

### 2.4 `calendarHelpers.ts` — ajout du kind `'actualite'`

Étendre `CalendarItem.kind` : `'ex-date' | 'payment' | 'event' | 'actualite'`
Items `source='richbourse'` → kind `'actualite'`
`filterByKind('actualite')` → filtre sur ce kind.

### 2.5 Compteur StatCard

Ajouter une 4e carte "Actualités" (couleur orange) dans `/calendrier/page.tsx`.

---

## 3. Aucune migration SQL

La table `market_events` dispose déjà de toutes les colonnes nécessaires. Pas de nouvelle migration.

---

## 4. Tests

Fichier `scraper/tests/actualites.test.ts` :
- `parseActualitesPage` : HTML fixture → ParsedActualite[] attendu
- `classifySourceType` : 10 titres → source_type attendu
- `classifyEventType` : 10 titres → event_type attendu
- `extractTicker` : titres avec ticker + titres ambigus → résultat attendu (couvre BOABF vs BOAB)

---

## 5. Contraintes

- Pas de login richbourse.com — axios simple suffit, User-Agent neutre
- Respecter les robots.txt (vérifier avant scraping)
- Délai de 500ms entre requêtes paginées (throttle poli)
- `dedupe_hash` garantit l'idempotence des runs quotidiens
- Ne jamais écrire côté frontend avec service_role
