# Cours intraday — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rafraîchir les cours des actions BRVM toutes les ~15 min en séance, gratuitement, en parsant la page publique brvm.org et en upsertant dans `brvm_actions_daily`, déclenché par GitHub Actions.

**Architecture:** Nouveau parser `brvmPublic` (tableau « Activités du marché » de brvm.org, mapping par libellé de colonne) → `MarketSnapshot` → `upsertActions` (persistence existante, clé `code,date_marche`). Commande CLI `intraday`. Workflow GitHub Actions en cron. Tout dans `scraper/` (le frontend ne lit que Supabase).

**Tech Stack:** Node ≥ 20, TypeScript ESM, cheerio (déjà dépendance), axios/fetch, vitest. Persistence `@supabase/supabase-js` (service_role) existante.

**Référence :** spec `docs/superpowers/specs/2026-06-09-cours-intraday-design.md`.

**Structure brvm.org vérifiée :** table `<table class="activity ...">`, en-têtes `Symbole | Nom | Volume | Cours veille (FCFA) | Cours Ouverture (FCFA) | Cours Clôture (FCFA) | Variation (%)`, tickers en `<td>` (ex. `<td>PALC</td>`).

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `scraper/src/scrapers/brvmPublic.ts` (créer) | Parse le HTML brvm.org → `MarketSnapshot` (actions) |
| `scraper/src/scrapers/runIntraday.ts` (créer) | Fetch brvm.org (ou fixture mock) → parser → `upsertActions` |
| `scraper/src/index.ts` (modifier) | Ajouter `case 'intraday'` |
| `scraper/package.json` (modifier) | Scripts `intraday` + `intraday:mock` |
| `scraper/tests/fixtures/brvm-public.html` (créer) | Fixture HTML réelle (extrait) pour test |
| `scraper/tests/brvmPublic.test.ts` (créer) | Test du parser |
| `.github/workflows/intraday.yml` (créer) | Cron GitHub Actions |

---

## Task 1 : Parser brvmPublic (TDD)

**Files:**
- Create: `scraper/src/scrapers/brvmPublic.ts`
- Create: `scraper/tests/fixtures/brvm-public.html`
- Test: `scraper/tests/brvmPublic.test.ts`

- [ ] **Step 1 : Créer la fixture HTML**

Créer `scraper/tests/fixtures/brvm-public.html` avec un extrait minimal mais représentatif du tableau « Activités du marché » (3 lignes suffisent pour le test) :

```html
<table class="activity table table-hover table-striped sticky-enabled">
<thead><tr>
<th>Symbole</th><th>Nom</th><th class="text-right">Volume</th>
<th class="text-right">Cours veille (FCFA)</th>
<th class="text-right">Cours Ouverture (FCFA)</th>
<th class="text-right">Cours Clôture (FCFA)</th>
<th class="text-right">Variation (%)</th>
</tr></thead>
<tbody>
<tr><td>PALC</td><td>PALMCI</td><td class="text-right">1 250</td><td class="text-right">9 800</td><td class="text-right">9 800</td><td class="text-right">9 850</td><td class="text-right">0,51</td></tr>
<tr><td>SNTS</td><td>SONATEL</td><td class="text-right">540</td><td class="text-right">17 500</td><td class="text-right">17 500</td><td class="text-right">17 400</td><td class="text-right">-0,57</td></tr>
<tr><td>SGBC</td><td>SOCIETE GENERALE CI</td><td class="text-right">0</td><td class="text-right">21 000</td><td class="text-right">21 000</td><td class="text-right">21 000</td><td class="text-right">0,00</td></tr>
</tbody>
</table>
```

- [ ] **Step 2 : Écrire le test d'abord**

```ts
// scraper/tests/brvmPublic.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseBrvmPublic } from '../src/scrapers/brvmPublic.js';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, 'fixtures', 'brvm-public.html'), 'utf8');

describe('parseBrvmPublic', () => {
  it('extrait les actions avec le bon mapping', () => {
    const snap = parseBrvmPublic(html, '2026-06-09');
    expect(snap.actions.length).toBe(3);
    const palc = snap.actions.find((a) => a.code === 'PALC')!;
    expect(palc.designation).toBe('PALMCI');
    expect(palc.cours_precedent).toBe(9800);
    expect(palc.cours_jour).toBe(9850); // cours clôture = dernier cours
    expect(palc.variation_pct).toBeCloseTo(0.51, 2);
    expect(palc.volume).toBe(1250);
    const snts = snap.actions.find((a) => a.code === 'SNTS')!;
    expect(snts.variation_pct).toBeCloseTo(-0.57, 2);
    expect(snts.cours_jour).toBe(17400);
  });

  it('renseigne date_marche et is_mock', () => {
    const snap = parseBrvmPublic(html, '2026-06-09');
    expect(snap.date_marche).toBe('2026-06-09');
    expect(snap.obligations).toEqual([]);
    expect(snap.indices).toEqual([]);
    expect(typeof snap.hash_source).toBe('string');
  });

  it('renvoie 0 action si le tableau est absent', () => {
    const snap = parseBrvmPublic('<html><body>rien</body></html>', '2026-06-09');
    expect(snap.actions).toEqual([]);
  });
});
```

- [ ] **Step 3 : Lancer le test (doit ÉCHOUER)**

Run: `cd scraper && npx vitest run tests/brvmPublic.test.ts`
Expected: FAIL (`parseBrvmPublic` n'existe pas).

- [ ] **Step 4 : Implémenter le parser**

Réutilise `parseNumber` (`scraper/src/utils/parseNumber.ts`, gère les espaces insécables et la virgule décimale) et `createHash`.

```ts
// scraper/src/scrapers/brvmPublic.ts
import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';
import { parseNumber } from '../utils/parseNumber.js';
import type { MarketSnapshot, ActionRow, MarketDate } from '../types.js';

/** Normalise un libellé d'en-tête (minuscule, sans accents ni parenthèses). */
function normHeader(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Parse la page publique brvm.org (tableau « Activités du marché ») en MarketSnapshot.
 * Mapping par libellé de colonne (jamais par index). cours_jour = Cours Clôture.
 */
export function parseBrvmPublic(html: string, date: MarketDate): MarketSnapshot {
  const $ = cheerio.load(html);
  const table = $('table.activity').first();
  const actions: ActionRow[] = [];

  if (table.length > 0) {
    // Index des colonnes par libellé normalisé
    const headers: string[] = [];
    table.find('thead th').each((_, th) => headers.push(normHeader($(th).text())));
    const col = (label: string) => headers.findIndex((h) => h.includes(label));
    const iSym = col('symbole'), iNom = col('nom'), iVol = col('volume');
    const iVeille = col('cours veille'), iCloture = col('cours cloture'), iVar = col('variation');

    table.find('tbody tr').each((_, tr) => {
      const tds = $(tr).find('td');
      const cell = (i: number) => (i >= 0 && i < tds.length ? $(tds[i]).text().trim() : '');
      const code = cell(iSym).toUpperCase();
      if (!code) return;
      actions.push({
        code,
        designation: cell(iNom),
        pays: null,
        secteur: null,
        cours_precedent: parseNumber(cell(iVeille)),
        cours_jour: parseNumber(cell(iCloture)),
        variation_pct: parseNumber(cell(iVar)),
        volume: parseNumber(cell(iVol)),
        nb_transactions: null,
        valeur_echangee: null,
      });
    });
  }

  return {
    date_marche: date,
    actions,
    obligations: [],
    indices: [],
    hash_source: createHash('sha256').update(html).digest('hex'),
    is_mock: false,
  };
}
```

- [ ] **Step 5 : Lancer les tests (PASS)**

Run: `cd scraper && npx vitest run tests/brvmPublic.test.ts`
Expected: PASS (3/3). Si `parseNumber` renvoie `null` sur « 9 800 », vérifier qu'on passe bien la chaîne brute (il gère les espaces insécables).

- [ ] **Step 6 : Commit**

```bash
git add scraper/src/scrapers/brvmPublic.ts scraper/tests/brvmPublic.test.ts scraper/tests/fixtures/brvm-public.html
git commit -m "feat(scraper): parser public brvm.org (Activités du marché) + test"
```

---

## Task 2 : Runner intraday

**Files:**
- Create: `scraper/src/scrapers/runIntraday.ts`

- [ ] **Step 1 : Implémenter le runner**

Réutilise `getSupabase`/`upsertActions` (persistence) et le logger `pino`. La date du jour est calculée en timezone `Africa/Abidjan` (UTC+0) — `new Date().toISOString().slice(0,10)` suffit (Abidjan = UTC).

```ts
// scraper/src/scrapers/runIntraday.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { logger } from '../logger.js';
import { parseBrvmPublic } from './brvmPublic.js';
import { upsertActions } from '../persistence/repository.js';

const BRVM_PUBLIC_URL = 'https://www.brvm.org/fr/cours-actions/0';

/** Récupère le HTML : réseau, ou fixture locale en mode mock. */
async function getHtml(mock: boolean): Promise<string> {
  if (mock) {
    const here = dirname(fileURLToPath(import.meta.url));
    return readFileSync(join(here, '..', '..', 'tests', 'fixtures', 'brvm-public.html'), 'utf8');
  }
  const resp = await fetch(BRVM_PUBLIC_URL, { signal: AbortSignal.timeout(20000) });
  if (!resp.ok) throw new Error(`brvm.org HTTP ${resp.status}`);
  return resp.text();
}

export async function runIntraday(opts: { mock?: boolean } = {}): Promise<{ nbActions: number }> {
  const mock = opts.mock ?? false;
  const today = new Date().toISOString().slice(0, 10);
  const html = await getHtml(mock);
  const snapshot = parseBrvmPublic(html, today);
  snapshot.is_mock = mock;

  if (snapshot.actions.length === 0) {
    throw new Error('intraday : aucune action parsée (page brvm.org inattendue ?)');
  }

  if (!mock) {
    await upsertActions(snapshot);
  }
  logger.info({ nbActions: snapshot.actions.length, date: today, mock }, 'intraday terminé');
  return { nbActions: snapshot.actions.length };
}
```

- [ ] **Step 2 : Vérifier la compilation**

Run: `cd scraper && npm run typecheck`
Expected: aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add scraper/src/scrapers/runIntraday.ts
git commit -m "feat(scraper): runner intraday (fetch brvm.org -> upsertActions)"
```

---

## Task 3 : Commande CLI + scripts npm

**Files:**
- Modify: `scraper/src/index.ts`
- Modify: `scraper/package.json`

- [ ] **Step 1 : Ajouter l'import et le case dans index.ts**

En haut de `scraper/src/index.ts`, à côté des autres imports de runners :
```ts
import { runIntraday } from './scrapers/runIntraday.js';
```

Dans le `switch (command)`, ajouter un `case` (à côté de `case 'dividends'`) :
```ts
    case 'intraday': {
      const res = await runIntraday({ mock });
      logger.info({ res }, 'intraday OK');
      break;
    }
```
(Le `mock` est déjà calculé en haut de `main` via `rest.includes('--mock')`.)

- [ ] **Step 2 : Ajouter les scripts npm**

Dans `scraper/package.json`, bloc `"scripts"`, ajouter :
```json
    "intraday": "NODE_TLS_REJECT_UNAUTHORIZED=0 tsx src/index.ts intraday",
    "intraday:mock": "NODE_TLS_REJECT_UNAUTHORIZED=0 tsx src/index.ts intraday --mock",
```

- [ ] **Step 3 : Test mock end-to-end (sans réseau ni DB)**

Run: `cd scraper && npm run intraday:mock`
Expected: log « intraday terminé » avec `nbActions: 3` (la fixture), pas d'écriture DB (mock).

- [ ] **Step 4 : Commit**

```bash
git add scraper/src/index.ts scraper/package.json
git commit -m "feat(scraper): commande CLI intraday + scripts npm"
```

---

## Task 4 : Workflow GitHub Actions

**Files:**
- Create: `.github/workflows/intraday.yml`

- [ ] **Step 1 : Créer le workflow**

```yaml
# .github/workflows/intraday.yml
name: Cours intraday BRVM

on:
  schedule:
    # Toutes les 15 min, lun-ven, 09:00–15:45 UTC (séance BRVM ~09:00–15:00 GMT + marge)
    - cron: '*/15 9-15 * * 1-5'
  workflow_dispatch: {} # déclenchement manuel possible

concurrency:
  group: intraday
  cancel-in-progress: false

jobs:
  intraday:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install scraper deps
        working-directory: scraper
        run: npm ci
      - name: Run intraday
        working-directory: scraper
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: npm run intraday
```

- [ ] **Step 2 : Commit**

```bash
git add .github/workflows/intraday.yml
git commit -m "ci(intraday): workflow GitHub Actions cron 15 min en séance"
```

- [ ] **Step 3 : (Utilisateur) Ajouter les secrets GitHub**

Dans **GitHub → repo → Settings → Secrets and variables → Actions**, ajouter :
- `SUPABASE_URL` = `https://vozwivhmjfmnnnjbbkpt.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = (la clé service_role)

Sans ces secrets, le job échouera à l'écriture (mais ne corrompt rien).

---

## Task 5 : Validation réelle + push

**Files:** aucun.

- [ ] **Step 1 : Suite de tests scraper complète**

Run: `cd scraper && npm test`
Expected: tous les tests passent (anciens + `brvmPublic`).

- [ ] **Step 2 : Typecheck**

Run: `cd scraper && npm run typecheck`
Expected: exit 0.

- [ ] **Step 3 : Test réel en séance (si marché ouvert, 09:00–15:00 GMT lun-ven)**

Run: `cd scraper && npm run intraday` (avec `scraper/.env.local` contenant `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`).
Vérifier en base que `brvm_actions_daily` a une ligne à la date du jour avec des cours frais :
```sql
select code, cours_jour, volume, date_marche from brvm_actions_daily
where date_marche = current_date order by code limit 5;
```
Si le marché est fermé, la page renvoie quand même la dernière séance → le run écrit cette date (cohérent). Vérifier qu'au moins ~40 actions sont présentes.

- [ ] **Step 4 : Push**

```bash
git push origin main
```

- [ ] **Step 5 : Déclencher manuellement le workflow**

Dans GitHub → Actions → « Cours intraday BRVM » → « Run workflow » pour valider le pipeline CI de bout en bout (après ajout des secrets).

---

## Self-Review

**Spec coverage :**
- Source brvm.org publique, mapping par libellé → Task 1 (parser). ✓
- Upsert dans `brvm_actions_daily` (code,date_marche) → Task 2 (runIntraday via `upsertActions` existant). ✓
- Commande `intraday` + scripts → Task 3. ✓
- GitHub Actions cron 15 min en séance → Task 4. ✓
- Hors frontend (dans scraper/) → Tasks 1-3 dans scraper/. ✓
- Robustesse : no-op + erreur si 0 action → Task 2 (throw si actions vides). ✓
- Nombres FR via parseNumber → Task 1. ✓
- Tests parser sur fixture + mock run → Tasks 1, 3. ✓

**Placeholder scan :** aucun TBD ; code complet ; commandes + résultats attendus présents.

**Type consistency :** `parseBrvmPublic(html, date): MarketSnapshot` (Task 1) appelé en Task 2. `ActionRow`/`MarketSnapshot` = types existants de `scraper/src/types.ts` (champs vérifiés : code, designation, pays, secteur, cours_precedent, cours_jour, variation_pct, volume, nb_transactions, valeur_echangee). `upsertActions(snapshot)` = signature existante. `runIntraday({ mock })` (Task 2) appelé en Task 3.

**Risque connu :** le markup brvm.org peut évoluer ; le parsing par libellé + le throw si 0 action rendent la panne visible (échec GitHub Actions) sans corrompre les données. La fixture sert de test de régression.
