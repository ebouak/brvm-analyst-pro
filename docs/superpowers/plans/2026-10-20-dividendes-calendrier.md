# Dividendes étape 1 — calendrier officiel BRVM : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill `dividends` with the official BRVM payment calendar (net amount, gross amount, withholding rate, notice number, ex-date, payment date) and stop the site from deducting the IRVM twice.

**Architecture:** The scraper reads the latest calendar PDF by position (pure parser), finds it through the notice dates of the HTML payments table, cross-checks dates against that table by notice number, and upserts into the existing `dividends` table on `(code, exercice)` with source `brvm-calendrier`, which no other writer may overwrite. On the frontend, the Ivorian rate becomes 12 % (individuals) and a yield computed from an already-net amount is never taxed again.

**Tech Stack:** Node 20 + TypeScript ESM (scraper, vitest, cheerio, pdfjs-dist), Supabase Postgres, Next.js 14 (frontend, vitest + `tsx` script tests), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-20-dividendes-calendrier-design.md`

**Worktree / branch:** `C:/Users/adego/wt/brvm-contact`, branch `feat/dividendes-calendrier` (already created and pushed).

**Ground rules (from CLAUDE.md, binding):**
- Never print, copy into chat or commit the content of any `.env*` file.
- No `npm run build` locally; `tsc --noEmit` and tests only.
- The user applies migrations in the Supabase SQL editor; never apply one yourself.
- No write to production (`--ecrire`) without the user's explicit go.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Validated by prototype on 2026-10-20** (scratchpad, real documents): the parser reads 35 rows from the 09/10 calendar and 33 + 1 rejection (TRACTAFRIC) from the 06/10 one; cross-checking the 09/10 calendar with table pages 0–1 keeps 34 rows (16 cross-checked) and rejects only SOGB; `2606 × 0.88` rounds to `2293.28`, `800 × 0.88` to `704`.

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `supabase/migrations/0157_dividendes_calendrier.sql` | create | 3 nullable columns + checks + comments |
| `scraper/src/dividends/calendrier.ts` | create | PURE: PDF fragments → calendar rows + rejections |
| `scraper/src/dividends/calendrierCodes.ts` | create | PURE: curated issuer name → BRVM code |
| `scraper/src/dividends/esv.ts` | create | PURE: HTML payments table → rows; candidate calendar URLs |
| `scraper/src/dividends/rapprochementCalendrier.ts` | create | PURE: net/gross for the base, date cross-check, classification |
| `scraper/src/dividends/calendrierFetch.ts` | create | Network: table pages, calendar discovery, PDF fragments |
| `scraper/src/dividends/runCalendrier.ts` | create | Orchestration + DB read/write |
| `scraper/src/dividends/runDividends.ts` | modify | `SOURCES_REFERENCE`, `chargerReferences()` |
| `scraper/src/dividends/runDividendHistory.ts` | modify | respect official sources |
| `scraper/src/dividends/runDividendesBoc.ts` | modify | never overwrite `brvm-calendrier` |
| `scraper/src/index.ts` | modify | CLI `dividends:calendrier` |
| `scraper/package.json` | modify | npm script |
| `scraper/scripts/verify-data.ts` | modify | mode `dividends-calendrier` |
| `scraper/scripts/fixture-calendrier.mjs` | create | regenerate PDF fixtures |
| `.github/workflows/dividends.yml` | modify | calendar step + verification |
| `scraper/tests/fixtures/calendrier-dividendes-2026100{6,9}.json` | create | real PDF fragments |
| `scraper/tests/fixtures/brvm-esv-dividendes-p{0,1}.html` | create | real HTML table pages |
| `scraper/tests/calendrierDividendes.test.ts` | create | tests of the 4 pure modules |
| `scraper/tests/dividendesBoc.test.ts` | modify | BOC yields to the calendar |
| `frontend/lib/tax/rates.ts` | modify | CI 12 % + `tauxPersonneMorale` |
| `frontend/lib/tax/compute.ts` | modify | `rendementNetSelonBase` |
| `frontend/lib/tax/rendementSelonBase.test.ts` | create | vitest |
| `frontend/lib/dividends.ts` | modify | `base_fiscale` on `DividendRow` |
| `frontend/app/dividendes/page.tsx` | modify | select + map `base_fiscale` |
| `frontend/components/DividendsTable.tsx` | modify | no double deduction |
| `frontend/app/actions/[code]/page.tsx` | modify | no double deduction |
| `frontend/lib/budgetSimulator.ts` | modify | `rendementDejaNet` |
| `frontend/lib/budgetSimulator.test.mjs` | modify | test it |
| `frontend/app/simulateur-budget/page.tsx` | modify | feed `rendementDejaNet` |
| `frontend/components/public/BudgetSimulator.tsx` | modify | rate from the scale, not « 10 % » |
| `CLAUDE.md` | modify | session notes |

---

### Task 0: Workspace

**Files:** none (local setup only).

- [ ] **Step 1: Install dependencies in the worktree**

```bash
cd C:/Users/adego/wt/brvm-contact/scraper && npm install --no-audit --no-fund
cd C:/Users/adego/wt/brvm-contact/frontend && npm install --no-audit --no-fund
```
Expected: both finish without error (warnings are fine).

- [ ] **Step 2: Baseline — scraper tests and types are green before any change**

```bash
cd C:/Users/adego/wt/brvm-contact/scraper && npx vitest run 2>&1 | tail -4 && npx tsc -p tsconfig.json --noEmit && echo TSC-OK
```
Expected: `Tests  N passed`, `TSC-OK`. Write N down: it is the regression baseline.

- [ ] **Step 3: Give the worktree the local secrets WITHOUT displaying them**

```bash
cp C:/Users/adego/OneDrive/Documents/brvm-analyst-pro/scraper/.env.local C:/Users/adego/wt/brvm-contact/scraper/.env.local
cp C:/Users/adego/OneDrive/Documents/brvm-analyst-pro/frontend/.env.local C:/Users/adego/wt/brvm-contact/frontend/.env.local
cd C:/Users/adego/wt/brvm-contact && git check-ignore -q scraper/.env.local && git check-ignore -q frontend/.env.local && echo IGNORED
```
Expected: `IGNORED`. Never `cat` these files. `src/config.ts` loads `dotenv/config`, i.e. `.env` by default: local scraper runs below pass `DOTENV_CONFIG_PATH=.env.local`.

---

### Task 1: Migration 0157

**Files:**
- Create: `supabase/migrations/0157_dividendes_calendrier.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================================
-- 0157_dividendes_calendrier.sql
-- Calendrier officiel de paiement des dividendes (BRVM) — spec
-- docs/superpowers/specs/2026-10-20-dividendes-calendrier-design.md
--
-- `montant` reste le NET pour une personne physique. On ajoute, à côté :
--   montant_brut  : brut par action quand la source le publie (lignes « (*) »
--                   du calendrier) ; NULL sinon — jamais reconstitué ;
--   taux_retenue  : retenue appliquée pour passer du brut au net (0,12 = IRVM
--                   CI personnes physiques depuis la LF 2025) ;
--   avis_brvm     : numéro de l'avis BRVM, ex. « 102-2026 BRVMDG ».
-- Additive et rejouable. Aucune donnée personnelle : la RLS existante de
-- `dividends` (lecture publique, écriture service_role) s'applique.
-- ============================================================================

alter table public.dividends
  add column if not exists montant_brut numeric,
  add column if not exists taux_retenue numeric,
  add column if not exists avis_brvm text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'dividends_taux_retenue_chk') then
    alter table public.dividends
      add constraint dividends_taux_retenue_chk
      check (taux_retenue is null or (taux_retenue >= 0 and taux_retenue < 1));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dividends_montant_brut_chk') then
    alter table public.dividends
      add constraint dividends_montant_brut_chk
      check (montant_brut is null or montant_brut >= montant);
  end if;
end $$;

comment on column public.dividends.montant_brut is
  'Brut par action quand la source le publie (calendrier BRVM, lignes « (*) »). NULL = non publié, jamais reconstitué.';
comment on column public.dividends.taux_retenue is
  'Retenue appliquée pour passer de montant_brut à montant (ex. 0,12). NULL quand montant_brut est NULL.';
comment on column public.dividends.avis_brvm is
  'Numéro de l''avis BRVM de paiement, ex. « 102-2026 BRVMDG ».';
```

- [ ] **Step 2: Check its number is free on every branch**

```bash
cd C:/Users/adego/wt/brvm-contact && ls supabase/migrations | grep -c "^0157_" && git fetch -q origin && for b in $(git branch -r --format='%(refname:short)' | grep -v HEAD); do git ls-tree --name-only $b supabase/migrations/ | grep "/0157_" | sed "s|^|$b: |"; done
```
Expected: `1`, and no branch listed.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0157_dividendes_calendrier.sql
git commit -m "feat(dividendes): migration 0157 — brut, taux de retenue et avis BRVM

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

The user applies it later in the Supabase SQL editor (Task 13). Nothing below depends on it being applied, except `--ecrire`.

---

### Task 2: Fixtures from the real BRVM documents

**Files:**
- Create: `scraper/scripts/fixture-calendrier.mjs`
- Create: `scraper/tests/fixtures/calendrier-dividendes-20261006.json`
- Create: `scraper/tests/fixtures/calendrier-dividendes-20261009.json`
- Create: `scraper/tests/fixtures/brvm-esv-dividendes-p0.html`
- Create: `scraper/tests/fixtures/brvm-esv-dividendes-p1.html`

- [ ] **Step 1: Write the fragment-extraction script (same extraction as production: trim + round)**

`scraper/scripts/fixture-calendrier.mjs`:
```js
// Extrait les fragments positionnés d'un calendrier BRVM en fixture de test.
// Même extraction que src/dividends/calendrierFetch.ts (trim, x/y arrondis).
// Usage : node scripts/fixture-calendrier.mjs <calendrier.pdf> <sortie.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const [entree, sortie] = process.argv.slice(2);
if (!entree || !sortie) {
  console.error('Usage : node scripts/fixture-calendrier.mjs <calendrier.pdf> <sortie.json>');
  process.exit(1);
}
const doc = await getDocument({ data: new Uint8Array(readFileSync(entree)) }).promise;
const pages = [];
for (let i = 1; i <= doc.numPages; i++) {
  const contenu = await (await doc.getPage(i)).getTextContent();
  pages.push(
    contenu.items
      .filter((x) => 'str' in x && x.str.trim())
      .map((x) => ({ s: x.str.trim(), x: Math.round(x.transform[4]), y: Math.round(x.transform[5]) })),
  );
}
writeFileSync(sortie, JSON.stringify(pages));
console.log(`${sortie} : ${pages.length} page(s), ${pages.flat().length} fragments`);
```

- [ ] **Step 2: Get the documents into a fresh directory**

The table is paginated newest-first: pages saved on 2026-10-20 are already in the scratchpad and MUST be reused (re-downloading later shifts the rows and breaks the Task 5 assertions). Only the two PDFs are fetched, 10 s apart (`Crawl-delay: 10`):
```bash
S="C:/Users/adego/AppData/Local/Temp/claude/c--Users-adego-OneDrive-Documents-brvm-analyst-pro/fbf2fb5b-f56e-494c-b0a9-85725b05bbc2/scratchpad"
D="$S/fixtures-brvm"; mkdir -p "$D"
cp "$S/cal-pdf/esv.html" "$D/p0.html"; cp "$S/cal-pdf/esv1.html" "$D/p1.html"
UA="WESTBOURSE-dividendes/1.0 (+https://www.westbourse.com)"; F=https://www.brvm.org/sites/default/files
curl -sS -A "$UA" -o "$D/cal1006.pdf" "$F/20261006_-_calendrier_de_paiement_des_dividendes_-_exercice_2025.pdf"; sleep 10
curl -sS -A "$UA" -o "$D/cal1009.pdf" "$F/20261009_-_calendrier_de_paiement_des_dividendes_-_exercice_2025.pdf"
ls -la "$D"
```
Expected: two PDFs (~200 KB) and two HTML files (~60 KB).

- [ ] **Step 3: Produce the fixtures**

```bash
cd C:/Users/adego/wt/brvm-contact/scraper
D="C:/Users/adego/AppData/Local/Temp/claude/c--Users-adego-OneDrive-Documents-brvm-analyst-pro/fbf2fb5b-f56e-494c-b0a9-85725b05bbc2/scratchpad/fixtures-brvm"
node scripts/fixture-calendrier.mjs "$D/cal1006.pdf" tests/fixtures/calendrier-dividendes-20261006.json
node scripts/fixture-calendrier.mjs "$D/cal1009.pdf" tests/fixtures/calendrier-dividendes-20261009.json
cp "$D/p0.html" tests/fixtures/brvm-esv-dividendes-p0.html
cp "$D/p1.html" tests/fixtures/brvm-esv-dividendes-p1.html
```
Expected: `… 2 page(s), … fragments` twice.

- [ ] **Step 4: Commit**

```bash
git add scripts/fixture-calendrier.mjs tests/fixtures/calendrier-dividendes-2026100*.json tests/fixtures/brvm-esv-dividendes-p*.html
git commit -m "test(dividendes): fixtures réelles — calendriers BRVM du 06/10 et du 09/10, table des paiements

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Pure calendar parser

**Files:**
- Create: `scraper/src/dividends/calendrier.ts`
- Create: `scraper/tests/calendrierDividendes.test.ts`

- [ ] **Step 1: Write the failing tests**

`scraper/tests/calendrierDividendes.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import type { ItemPdf } from '../src/dividends/boc.js';
import { lireCalendrier, dateFr, type Calendrier } from '../src/dividends/calendrier.js';

const fixture = (nom: string) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${nom}`, import.meta.url), 'utf8')) as ItemPdf[][];
const c1009 = lireCalendrier(fixture('calendrier-dividendes-20261009.json'));
const c1006 = lireCalendrier(fixture('calendrier-dividendes-20261006.json'));
const parAvis = (c: Calendrier, avis: string) => c.lignes.find((l) => l.avis === avis);

describe('calendrier officiel BRVM — lecture par position', () => {
  it('exercice et taux sont lus dans le document, pas supposés', () => {
    expect({ e: c1009.exercice, pp: c1009.tauxPersonnePhysique, pm: c1009.tauxPersonneMorale }).toEqual({
      e: 2025,
      pp: 0.12,
      pm: 0.1,
    });
  });

  it('09/10/2026 : 35 lignes, aucune rejetée', () => {
    expect(c1009.lignes).toHaveLength(35);
    expect(c1009.rejets).toEqual([]);
  });

  it('ligne sans « (*) » : montant tel que publié, déjà net', () => {
    expect(parAvis(c1009, '111-2026 BRVMDG')).toEqual({
      nom: 'SONATEL SENEGAL',
      montant: 1740,
      brut: false,
      avis: '111-2026 BRVMDG',
      publication: '2026-04-23',
      ex_date: '2026-05-22',
      paiement: '2026-05-26',
    });
  });

  it('« (*) » = brut, y compris quand le marqueur est sur la ligne suivante du nom', () => {
    expect(parAvis(c1009, '138-2026 BRVMDG')).toMatchObject({ nom: 'ORANGE CI', montant: 800, brut: true });
    expect(parAvis(c1009, '184-2026 BRVMDG')).toMatchObject({ nom: 'SOCIETE IVOIRIENNE DE BANQUE', montant: 425, brut: true });
    expect(parAvis(c1009, '245-2026 BRVMDG')).toMatchObject({ nom: 'TOTALENERGIES MARKETING CI', brut: true });
  });

  it('la virgule est un séparateur DÉCIMAL ici (pas le piège du carnet)', () => {
    expect(parAvis(c1009, '170-2026 BRVMDG')?.montant).toBe(0.9184);
    expect(parAvis(c1009, '137-2026 BRVMDG')?.montant).toBe(145.3214);
    expect(parAvis(c1009, '102-2026 BRVMDG')?.montant).toBe(594.528);
    expect(parAvis(c1009, '226-2026 BRVMDG')?.montant).toBe(1940);
  });

  it('nom sur deux lignes, recollé ; numéro d’avis sans zéro de tête', () => {
    expect(parAvis(c1009, '170-2026 BRVMDG')?.nom).toBe('Ecobank Transnational Incorporated TG');
    expect(parAvis(c1009, '72-2026 BRVMDG')?.nom).toBe('BOA BURKINA FASO');
  });

  it('06/10/2026 : TRACTAFRIC rejetée (ex-dividende après le paiement), nommée, jamais écrite', () => {
    expect(c1006.lignes).toHaveLength(33);
    expect(c1006.rejets).toHaveLength(1);
    expect(c1006.rejets[0]).toMatchObject({ nom: 'TRACTAFRIC MOTORS CI', avis: '294-2026 BRVMDG' });
    expect(c1006.rejets[0]?.motif).toMatch(/postérieur au paiement/);
  });

  it('dates : format JJ/MM/AAAA strict, date impossible refusée', () => {
    expect(dateFr('06/10/2026')).toBe('2026-10-06');
    expect(dateFr('31/02/2026')).toBeNull();
    expect(dateFr('2026-10-06')).toBeNull();
  });

  it('document sans ligne « ANNEE » : erreur, rien d’inventé', () => {
    expect(() => lireCalendrier([[]])).toThrow(/ANNEE/);
  });
});
```

- [ ] **Step 2: Run to see it fail**

```bash
cd C:/Users/adego/wt/brvm-contact/scraper && npx vitest run tests/calendrierDividendes.test.ts 2>&1 | tail -5
```
Expected: FAIL — cannot load `../src/dividends/calendrier.js`.

- [ ] **Step 3: Implement**

`scraper/src/dividends/calendrier.ts`:
```ts
/**
 * Calendrier officiel de paiement des dividendes (BRVM) — module PUR et testé
 * (tests/calendrierDividendes.test.ts, sur les PDF réels du 06/10 et du 09/10/2026).
 *
 * POURQUOI. Au 2026-10-20, 2 dividendes sur 36 de l'exercice 2025 avaient une
 * date de détachement en base. Ce document les donne toutes, avec le numéro
 * de l'avis, et il est le SEUL à distinguer brut et net : l'en-tête annonce
 * un « montant net », mais les lignes marquées « (*) » sont BRUTES (note de bas
 * de page : IRVM 12 % personnes physiques, 10 % personnes morales). Le marqueur
 * prime sur l'en-tête ; le taux est lu dans la note, jamais supposé.
 *
 * LECTURE PAR POSITION, ancrée sur le fragment « BRVMDG » de chaque ligne : un
 * nom peut tenir sur deux lignes de texte, un montant tomber au-dessus de son
 * nom (même piège que dividends/boc.ts et carnet/parse.ts).
 *
 * La virgule est ici un vrai séparateur décimal (0,9184 FCFA pour ETI ; 594,528
 * pour BOA CI) — contrairement au carnet d'ordres, où « 3,955 » vaut 3 955.
 */
import { parseFrNumber } from '../utils/parseNumber.js';
import type { ItemPdf } from './boc.js';

export interface LigneCalendrier {
  /** Libellé publié, sans « (*) ». */
  nom: string;
  /** Montant par action tel que publié : BRUT si `brut`, NET sinon. */
  montant: number;
  brut: boolean;
  /** « 102-2026 BRVMDG » (numéro sans zéro de tête, comme la table HTML). */
  avis: string;
  publication: string | null;
  ex_date: string;
  paiement: string;
}

export interface RejetCalendrier {
  nom: string;
  avis: string | null;
  motif: string;
}

export interface Calendrier {
  exercice: number;
  tauxPersonnePhysique: number | null;
  tauxPersonneMorale: number | null;
  lignes: LigneCalendrier[];
  rejets: RejetCalendrier[];
}

/** Colonnes relevées sur les calendriers de 2026 (x en points PDF). */
const COL = {
  montant: [190, 258],
  avis: [258, 330],
  publication: [370, 440],
  ex: [440, 510],
  paiement: [510, 600],
} as const;
const NOM_X_MAX = 190;
const MEME_LIGNE = 3;
/** Un nom sur deux lignes s'écarte de 6 à 7 points de son ancre ; la ligne voisine, de 17 et plus. */
const NOM_ECART_MAX = 9;

const joindre = (items: ItemPdf[]) => [...items].sort((a, b) => a.x - b.x).map((i) => i.s).join('');

/** « 06/10/2026 » → « 2026-10-06 » ; null pour toute autre forme ou une date impossible. */
export function dateFr(s: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.replace(/\s/g, ''));
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso;
}

export function lireCalendrier(pages: ItemPdf[][]): Calendrier {
  const ligneDe = (re: RegExp): string | null => {
    for (const p of pages) {
      const a = p.find((i) => re.test(i.s));
      if (a) return joindre(p.filter((i) => Math.abs(i.y - a.y) <= 2));
    }
    return null;
  };
  const titre = ligneDe(/^ANNEE/);
  const annee = titre ? /ANNEE\s*:\s*(\d{4})/.exec(titre) : null;
  if (!annee?.[1]) throw new Error('calendrier : ligne « ANNEE : AAAA » introuvable');
  const note = ligneDe(/IRVM/) ?? '';
  const taux =
    /de\s*(\d+(?:,\d+)?)\s*%\s*pour\s*les\s*personnes\s*physiques\s*et\s*(\d+(?:,\d+)?)\s*%\s*pour\s*les\s*personnes\s*morales/i.exec(
      note,
    );
  const pct = (s: string | undefined) => {
    const n = parseFrNumber(s);
    return n == null ? null : n / 100;
  };

  const lignes: LigneCalendrier[] = [];
  const rejets: RejetCalendrier[] = [];
  for (const items of pages) {
    const ancres = items.filter((i) => /BRVMDG/.test(i.s) && i.x >= COL.avis[0] && i.x < COL.avis[1]);
    const ancreLaPlusProche = (y: number) => ancres.reduce((m, a) => (Math.abs(a.y - y) < Math.abs(m.y - y) ? a : m));
    for (const a of ancres) {
      const cellule = ([x0, x1]: readonly [number, number]) =>
        joindre(items.filter((i) => Math.abs(i.y - a.y) <= MEME_LIGNE && i.x >= x0 && i.x < x1));
      const nomBrut = items
        .filter((i) => i.x < NOM_X_MAX && Math.abs(i.y - a.y) <= NOM_ECART_MAX && ancreLaPlusProche(i.y) === a)
        .sort((p, q) => q.y - p.y || p.x - q.x)
        .map((i) => i.s)
        .join(' ');
      const nom = nomBrut.replace(/\(\*\)/g, '').replace(/\s+/g, ' ').trim();
      const brut = /\(\*\)/.test(nomBrut);
      const avisM = /^(\d{1,4})-(\d{4})BRVMDG$/.exec(cellule(COL.avis).replace(/\s/g, ''));
      const avis = avisM ? `${Number(avisM[1])}-${avisM[2]} BRVMDG` : null;
      const montant = parseFrNumber(cellule(COL.montant));
      const exDate = dateFr(cellule(COL.ex));
      const paiement = dateFr(cellule(COL.paiement));
      const rejeter = (motif: string) => rejets.push({ nom, avis, motif });
      if (!nom) { rejeter('nom illisible'); continue; }
      if (!avis) { rejeter('numéro d’avis illisible'); continue; }
      if (montant == null || montant <= 0) { rejeter('montant illisible'); continue; }
      if (!exDate || !paiement) { rejeter('date illisible'); continue; }
      if (exDate > paiement) { rejeter(`ex-dividende (${exDate}) postérieur au paiement (${paiement})`); continue; }
      lignes.push({ nom, montant, brut, avis, publication: dateFr(cellule(COL.publication)), ex_date: exDate, paiement });
    }
  }
  return {
    exercice: Number(annee[1]),
    tauxPersonnePhysique: pct(taux?.[1]),
    tauxPersonneMorale: pct(taux?.[2]),
    lignes,
    rejets,
  };
}
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run tests/calendrierDividendes.test.ts 2>&1 | tail -5
```
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/dividends/calendrier.ts tests/calendrierDividendes.test.ts
git commit -m "feat(dividendes): lecture par position du calendrier officiel BRVM (brut « (*) », taux lu dans la note)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Curated issuer → code table

**Files:**
- Create: `scraper/src/dividends/calendrierCodes.ts`
- Modify: `scraper/tests/calendrierDividendes.test.ts` (append)

- [ ] **Step 1: Append the failing tests** (put the `import` with the other imports at the top of the file)

```ts
import { cleNom, codeDuNom } from '../src/dividends/calendrierCodes.js';

describe('correspondance nom → code (table curée, aucun repli flou)', () => {
  it('les 35 lignes du 09/10 sont rapprochées, chacune vers un code distinct', () => {
    const codes = c1009.lignes.map((l) => codeDuNom(l.nom));
    expect(codes.filter((c) => c == null)).toEqual([]);
    expect(new Set(codes).size).toBe(35);
  });

  it('accents, apostrophes et espaces parasites sont neutralisés', () => {
    expect(cleNom('BOA CÔTE D’IVOIRE')).toBe('BOACOTEDIVOIRE');
    expect(codeDuNom('BOA CÔTE D’IVOIRE')).toBe('BOAC');
    expect(codeDuNom('SOCIETE GENERALE C I')).toBe('SGBC');
    expect(codeDuNom('NEI - CEDA CI')).toBe('NEIC');
  });

  it('un nom inconnu ou partiel ne devine rien', () => {
    expect(codeDuNom('BANQUE INCONNUE CI')).toBeNull();
    expect(codeDuNom('ORANGE')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to see it fail**

```bash
npx vitest run tests/calendrierDividendes.test.ts 2>&1 | tail -5
```
Expected: FAIL — cannot load `calendrierCodes.js`.

- [ ] **Step 3: Implement**

`scraper/src/dividends/calendrierCodes.ts`:
```ts
/**
 * Libellés du calendrier officiel BRVM → codes, par table CURÉE.
 *
 * Aucun repli flou : un libellé inconnu reste non rapproché et le run le nomme
 * (leçon du 2026-09-08 — le flou avait attribué à TTLC les dividendes de TOTAL
 * SENEGAL). Les 35 codes ont été vérifiés contre brvm_instruments le 2026-10-20.
 * Nouvelle valeur au calendrier : ajouter sa clé ici (voir cleNom).
 */

/** Clé compacte : sans accents, majuscules, lettres et chiffres seulement. */
export function cleNom(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export const CODES_CALENDRIER: Readonly<Record<string, string>> = {
  BOABURKINAFASO: 'BOABF',
  BOACOTEDIVOIRE: 'BOAC',
  SONATELSENEGAL: 'SNTS',
  BOABENIN: 'BOAB',
  ECOBANKCI: 'ECOC',
  BOASENEGAL: 'BOAS',
  SICABLECI: 'CABC',
  BOAMALI: 'BOAM',
  ORANGECI: 'ORAC',
  ONATELBF: 'ONTBF',
  CORISBANKINTBF: 'CBIBF',
  PALMCI: 'PALC',
  ECOBANKTRANSNATIONALINCORPORATEDTG: 'ETIT',
  BICICI: 'BICC',
  TOTALENERGIESMARKETINGSN: 'TTLS',
  CIECI: 'CIEC',
  SOLIBRACI: 'SLBC',
  SOCIETEIVOIRIENNEDEBANQUE: 'SIBC',
  BIICBN: 'BICB',
  LOTERIENATIONALEDUBENIN: 'LNBB',
  NSIABANQUECI: 'NSBC',
  SOGBCI: 'SOGC',
  SITABCI: 'STBC',
  CFAOMOTORSCI: 'CFAC',
  SOCIETEGENERALECI: 'SGBC',
  SAPHCI: 'SPHC',
  TOTALENERGIESMARKETINGCI: 'TTLC',
  NESTLECI: 'NTLC',
  NEICEDACI: 'NEIC',
  SODECI: 'SDCC',
  SMBCI: 'SMBC',
  VIVOENERGYCI: 'SHEC',
  SERVAIRABIDJANCI: 'ABJC',
  TRACTAFRICMOTORSCI: 'PRSC',
  AFRICAGLOBALLOGISTICSCI: 'SDSC',
};

export function codeDuNom(nom: string): string | null {
  return CODES_CALENDRIER[cleNom(nom)] ?? null;
}
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run tests/calendrierDividendes.test.ts 2>&1 | tail -5
```
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add src/dividends/calendrierCodes.ts tests/calendrierDividendes.test.ts
git commit -m "feat(dividendes): table curée des libellés du calendrier BRVM (35 valeurs, sans repli flou)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Pure HTML payments-table parser and calendar URL candidates

**Files:**
- Create: `scraper/src/dividends/esv.ts`
- Modify: `scraper/tests/calendrierDividendes.test.ts` (append)

- [ ] **Step 1: Append the failing tests** (import at the top of the file)

```ts
import { lireTableEsv, urlsCandidatesCalendrier, exerciceDepuisUrlCalendrier } from '../src/dividends/esv.js';

const html = (nom: string) => readFileSync(new URL(`./fixtures/${nom}`, import.meta.url), 'utf8');
const p0 = lireTableEsv(html('brvm-esv-dividendes-p0.html'));
const p1 = lireTableEsv(html('brvm-esv-dividendes-p1.html'));

describe('table HTML des paiements de dividendes (brvm.org/fr/esv)', () => {
  it('dates lues dans les attributs ISO, avis et date de publication tirés du lien', () => {
    expect(p0).toHaveLength(10);
    expect(p0[0]).toEqual({
      emetteur: 'BOLLORE TRANSPORT & LOGISTICS',
      exercice: 2025,
      paiement: '2026-10-27',
      ex_date: '2026-10-26',
      avis: '297-2026 BRVMDG',
      avisUrl: expect.stringContaining('avis_ndeg297_brvmdg'),
      datePublication: '2026-10-09',
    });
  });

  it('les erreurs de la table sont lues telles quelles (le recoupement les tranchera)', () => {
    expect(p1.find((r) => r.avis === '213-2026 BRVMDG')).toMatchObject({ emetteur: 'SOGB', ex_date: '2026-07-05' });
    expect(p1.some((r) => r.avis === '211-2025 BRVMDG')).toBe(true);
  });

  it('candidats : un calendrier par date d’avis, du plus récent, au plus 5, sans doublon', () => {
    const urls = urlsCandidatesCalendrier([...p0, ...p1]);
    expect(urls[0]).toBe(
      'https://www.brvm.org/sites/default/files/20261009_-_calendrier_de_paiement_des_dividendes_-_exercice_2025.pdf',
    );
    expect(urls.length).toBeLessThanOrEqual(5);
    expect(new Set(urls).size).toBe(urls.length);
    expect(exerciceDepuisUrlCalendrier(urls[0]!)).toBe(2025);
  });
});
```

- [ ] **Step 2: Run to see it fail**

```bash
npx vitest run tests/calendrierDividendes.test.ts 2>&1 | tail -5
```
Expected: FAIL — cannot load `esv.js`.

- [ ] **Step 3: Implement**

`scraper/src/dividends/esv.ts`:
```ts
/**
 * Table HTML « Paiement de dividendes » de brvm.org (/fr/esv/paiement-de-dividendes)
 * — module PUR et testé.
 *
 * Deux usages, et pas davantage :
 *  1. TROUVER le dernier calendrier PDF. La page de liste officielle des
 *     calendriers est figée au 31/03/2026 ; chaque mise à jour du calendrier
 *     porte en revanche la date d'un avis de paiement, et ces dates figurent
 *     ici (lien de l'avis : AAAAMMJJ_-_avis_ndegNNN_brvmdg_…pdf).
 *  2. RECOUPER les dates du calendrier, avis par avis.
 * Elle ne sert PAS de source de montants : sa colonne « net » porte des bruts
 * (SGCI 2 606) et rien n'y distingue l'un de l'autre. Elle a aussi ses propres
 * erreurs (SOGB : ex-dividende 05/07 au lieu du 05/08) — d'où un recoupement,
 * jamais une confiance aveugle.
 */
import * as cheerio from 'cheerio';

export interface PaiementEsv {
  emetteur: string;
  exercice: number;
  paiement: string;
  ex_date: string | null;
  /** « 297-2026 BRVMDG », tiré du nom du fichier de l'avis ; null s'il n'est pas reconnu. */
  avis: string | null;
  avisUrl: string | null;
  /** Date de l'avis (préfixe du nom de fichier), ISO. */
  datePublication: string | null;
}

const FICHIERS = 'https://www.brvm.org/sites/default/files';
const isoDe = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

export function lireTableEsv(html: string): PaiementEsv[] {
  const $ = cheerio.load(html);
  const out: PaiementEsv[] = [];
  $('td.views-field-field-emetteur-esv').each((_, td) => {
    const tr = $(td).closest('tr');
    const champ = (cls: string) => tr.find(`td.views-field-${cls}`);
    const exercice = isoDe(champ('field-exercice-comptable-esv').find('[content]').attr('content'));
    const paiement = isoDe(champ('field-date-de-paiement-esv').find('[content]').attr('content'));
    if (!exercice || !paiement) return;
    const avisUrl = champ('field-avis-dividende-esv').find('a').attr('href') ?? null;
    const m = avisUrl ? /\/(\d{4})(\d{2})(\d{2})_-_avis_n(?:deg|°|o)?_?(\d{1,4})_brvmdg/i.exec(avisUrl) : null;
    out.push({
      emetteur: $(td).text().replace(/\s+/g, ' ').trim(),
      exercice: Number(exercice.slice(0, 4)),
      paiement,
      ex_date: isoDe(champ('field-date-ex-dividende').find('[content]').attr('content')),
      avis: m ? `${Number(m[4])}-${m[1]} BRVMDG` : null,
      avisUrl,
      datePublication: m ? `${m[1]}-${m[2]}-${m[3]}` : null,
    });
  });
  return out;
}

export function urlCalendrier(datePublication: string, exercice: number): string {
  return `${FICHIERS}/${datePublication.replace(/-/g, '')}_-_calendrier_de_paiement_des_dividendes_-_exercice_${exercice}.pdf`;
}

/** URL candidates du calendrier, de la date d'avis la plus récente à la plus ancienne. */
export function urlsCandidatesCalendrier(paiements: PaiementEsv[], max = 5): string[] {
  const urls = paiements
    .filter((p): p is PaiementEsv & { datePublication: string } => p.datePublication != null)
    .sort((a, b) => b.datePublication.localeCompare(a.datePublication))
    .map((p) => urlCalendrier(p.datePublication, p.exercice));
  return [...new Set(urls)].slice(0, max);
}

export function exerciceDepuisUrlCalendrier(url: string): number | null {
  const m = /_exercice_(\d{4})\.pdf$/i.exec(url);
  return m ? Number(m[1]) : null;
}
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run tests/calendrierDividendes.test.ts 2>&1 | tail -5
```
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add src/dividends/esv.ts tests/calendrierDividendes.test.ts
git commit -m "feat(dividendes): table HTML des paiements BRVM — découverte du calendrier et recoupement des dates

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Pure reconciliation (net for the base, date cross-check, classification)

**Files:**
- Create: `scraper/src/dividends/rapprochementCalendrier.ts`
- Modify: `scraper/tests/calendrierDividendes.test.ts` (append)

- [ ] **Step 1: Append the failing tests** (import at the top of the file)

```ts
import { montantsPourBase, recouperDates, classer, type Cible } from '../src/dividends/rapprochementCalendrier.js';

describe('rapprochement : montants, recoupement, classement', () => {
  const ligne = (avis: string) => parAvis(c1009, avis)!;

  it('brut « (*) » → net = brut × (1 − taux lu), brut et taux conservés', () => {
    expect(montantsPourBase(ligne('138-2026 BRVMDG'), 0.12)).toEqual({ montant: 704, montant_brut: 800, taux_retenue: 0.12 });
    expect(montantsPourBase(ligne('231-2026 BRVMDG'), 0.12)?.montant).toBe(2293.28);
  });

  it('ligne nette : montant tel quel, brut NON reconstitué', () => {
    expect(montantsPourBase(ligne('111-2026 BRVMDG'), 0.12)).toEqual({ montant: 1740, montant_brut: null, taux_retenue: null });
  });

  it('brut sans taux lisible : refusé, jamais calculé avec un taux supposé', () => {
    expect(montantsPourBase(ligne('138-2026 BRVMDG'), null)).toBeNull();
  });

  it('recoupement : SOGB divergente rejetée, TRACTAFRIC concordante, BOA CI absente de la table', () => {
    const { retenues, divergences } = recouperDates(c1009.lignes, [...p0, ...p1]);
    expect(divergences.map((d) => d.ligne.avis)).toEqual(['213-2026 BRVMDG']);
    expect(retenues).toHaveLength(34);
    expect(retenues.filter((r) => r.recoupee)).toHaveLength(16);
    expect(retenues.find((r) => r.ligne.avis === '294-2026 BRVMDG')?.recoupee).toBe(true);
    expect(retenues.find((r) => r.ligne.avis === '102-2026 BRVMDG')?.recoupee).toBe(false);
  });

  const cible: Cible = {
    montant: 704,
    montant_brut: 800,
    taux_retenue: 0.12,
    ex_date: '2026-06-05',
    payment_date: '2026-06-08',
    avis_brvm: '138-2026 BRVMDG',
  };
  const base = {
    montant: 704,
    montant_brut: 800,
    ex_date: '2026-06-05',
    payment_date: '2026-06-08',
    avis_brvm: '138-2026 BRVMDG',
    source: 'brvm-calendrier',
  };

  it('classement', () => {
    expect(classer(cible, null)).toBe('absent');
    expect(classer(cible, { ...base, montant: 800 })).toBe('montant_different');
    expect(classer(cible, { ...base, ex_date: null, source: 'brvm-boc' })).toBe('date_ajoutee');
    expect(classer(cible, base)).toBe('concordant');
  });
});
```

- [ ] **Step 2: Run to see it fail**

```bash
npx vitest run tests/calendrierDividendes.test.ts 2>&1 | tail -5
```
Expected: FAIL — cannot load `rapprochementCalendrier.js`.

- [ ] **Step 3: Implement**

`scraper/src/dividends/rapprochementCalendrier.ts`:
```ts
/**
 * Rapprochement du calendrier officiel avec la table HTML et avec la base —
 * module PUR et testé.
 */
import type { LigneCalendrier } from './calendrier.js';
import type { PaiementEsv } from './esv.js';

export interface MontantsBase {
  /** NET pour une personne physique — la convention de `dividends.montant`. */
  montant: number;
  montant_brut: number | null;
  taux_retenue: number | null;
}

/**
 * Ligne « (*) » : net = brut × (1 − taux lu dans la note du document), arrondi
 * à 4 décimales. Ligne nette : montant tel quel, brut NON reconstitué (le taux
 * du pays n'est pas donné par le document). Brut sans taux lisible → null : la
 * ligne est refusée plutôt que calculée avec un taux supposé.
 */
export function montantsPourBase(l: LigneCalendrier, tauxPersonnePhysique: number | null): MontantsBase | null {
  if (!l.brut) return { montant: l.montant, montant_brut: null, taux_retenue: null };
  if (tauxPersonnePhysique == null) return null;
  return {
    montant: Math.round(l.montant * (1 - tauxPersonnePhysique) * 1e4) / 1e4,
    montant_brut: l.montant,
    taux_retenue: tauxPersonnePhysique,
  };
}

export interface Divergence {
  ligne: LigneCalendrier;
  esv: PaiementEsv;
}

/**
 * Compare chaque ligne du calendrier à la ligne de la table qui porte le MÊME
 * avis. Dates divergentes → la ligne sort (deux sources officielles qui se
 * contredisent ne se tranchent pas). Avis absent de la table → retenue, non
 * recoupée.
 */
export function recouperDates(
  lignes: LigneCalendrier[],
  esv: PaiementEsv[],
): { retenues: { ligne: LigneCalendrier; recoupee: boolean }[]; divergences: Divergence[] } {
  const parAvis = new Map<string, PaiementEsv>();
  for (const e of esv) if (e.avis) parAvis.set(e.avis, e);
  const retenues: { ligne: LigneCalendrier; recoupee: boolean }[] = [];
  const divergences: Divergence[] = [];
  for (const ligne of lignes) {
    const e = parAvis.get(ligne.avis);
    if (!e) {
      retenues.push({ ligne, recoupee: false });
    } else if (e.paiement !== ligne.paiement || (e.ex_date != null && e.ex_date !== ligne.ex_date)) {
      divergences.push({ ligne, esv: e });
    } else {
      retenues.push({ ligne, recoupee: true });
    }
  }
  return { retenues, divergences };
}

export interface Cible extends MontantsBase {
  ex_date: string;
  payment_date: string;
  avis_brvm: string;
}

export interface LigneBase {
  montant: number | null;
  montant_brut: number | null;
  ex_date: string | null;
  payment_date: string | null;
  avis_brvm: string | null;
  source: string | null;
}

/**
 * concordant        : la base porte déjà exactement la ligne du calendrier ;
 * date_ajoutee      : même montant net, mais dates, brut, avis ou source à compléter ;
 * montant_different : montant net différent (écart imprimé avec les deux valeurs) ;
 * absent            : aucune ligne pour (code, exercice).
 */
export type Ecart = 'concordant' | 'date_ajoutee' | 'montant_different' | 'absent';

export function classer(cible: Cible, base: LigneBase | null): Ecart {
  if (!base || base.montant == null) return 'absent';
  if (Math.abs(base.montant - cible.montant) >= 0.01) return 'montant_different';
  const identique =
    base.ex_date === cible.ex_date &&
    base.payment_date === cible.payment_date &&
    base.avis_brvm === cible.avis_brvm &&
    (base.montant_brut ?? null) === cible.montant_brut &&
    base.source === 'brvm-calendrier';
  return identique ? 'concordant' : 'date_ajoutee';
}
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run tests/calendrierDividendes.test.ts 2>&1 | tail -5
```
Expected: PASS, 20 tests.

- [ ] **Step 5: Commit**

```bash
git add src/dividends/rapprochementCalendrier.ts tests/calendrierDividendes.test.ts
git commit -m "feat(dividendes): rapprochement du calendrier — net d'un brut, recoupement par avis, classement

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Source precedence — no other writer overwrites the calendar

**Files:**
- Modify: `scraper/src/dividends/runDividends.ts` (block around lines 108-133)
- Modify: `scraper/src/dividends/runDividendHistory.ts` (upsert block, ~line 113)
- Modify: `scraper/src/dividends/runDividendesBoc.ts` (`Ecart`, `classer`, write filter)
- Modify: `scraper/tests/dividendesBoc.test.ts`

- [ ] **Step 1: Add the failing tests to `tests/dividendesBoc.test.ts`**

Change the import `import { sansEcraserReference } from '../src/dividends/runDividends.js';` to:
```ts
import { sansEcraserReference, SOURCES_REFERENCE } from '../src/dividends/runDividends.js';
```
Inside `describe('rapprochement avec la base', …)` add:
```ts
  it('une ligne du calendrier officiel n’est jamais réécrite par le Bulletin', () => {
    expect(classer(boc, { montant: 1750, payment_date: null, source: 'brvm-calendrier', base_fiscale: 'net' }, jour)).toBe('calendrier');
  });
```
Inside `describe('priorité des sources', …)` add:
```ts
  it('le calendrier et le Bulletin sont les deux sources de référence, le calendrier d’abord', () => {
    expect(SOURCES_REFERENCE).toEqual(['brvm-calendrier', 'brvm-boc']);
  });
```

- [ ] **Step 2: Run to see it fail**

```bash
npx vitest run tests/dividendesBoc.test.ts 2>&1 | tail -6
```
Expected: FAIL — `SOURCES_REFERENCE` undefined; `classer` returns `montant_different` instead of `calendrier`.

- [ ] **Step 3: `runDividends.ts` — shared reference loader**

Replace the block that starts with the comment `/**\n * Une ligne issue du Bulletin Officiel de la Cote (source 'brvm-boc', voir` and ends with the closing `}` of `sansEcraserReference` by:
```ts
/**
 * Sources OFFICIELLES BRVM : aucune autre source ne les écrase. Le calendrier
 * de paiement (runCalendrier.ts) prime sur le Bulletin officiel
 * (runDividendesBoc.ts), qui prime sur RichBourse et Sikafinance.
 * Sans ce filtre, RichBourse — importé en dernier, et qui l'emporte donc —
 * remettait chaque samedi ses propres valeurs par-dessus celles de la BRVM.
 */
export const SOURCES_REFERENCE = ['brvm-calendrier', 'brvm-boc'] as const;

export function sansEcraserReference<T extends { code: string; exercice?: number | null }>(
  rows: T[],
  references: Set<string>,
): T[] {
  return rows.filter((r) => r.exercice == null || !references.has(`${r.code}|${r.exercice}`));
}

/** Couples « code|exercice » déjà tenus par une source officielle. */
export async function chargerReferences(): Promise<Set<string>> {
  const { data, error } = await getSupabase()
    .from('dividends')
    .select('code, exercice')
    .in('source', [...SOURCES_REFERENCE]);
  if (error) throw new Error(`dividends (références officielles) : ${error.message}`);
  return new Set(((data ?? []) as { code: string; exercice: number | null }[]).map((r) => `${r.code}|${r.exercice}`));
}
```
Then in `upsert()`, replace these three lines:
```ts
  const { data: refs, error: errRefs } = await sb.from('dividends').select('code, exercice').eq('source', 'brvm-boc');
  if (errRefs) throw new Error(`dividends (références brvm-boc) : ${errRefs.message}`);
  const references = new Set(((refs ?? []) as { code: string; exercice: number | null }[]).map((r) => `${r.code}|${r.exercice}`));
```
with:
```ts
  const references = await chargerReferences();
```
and the log message `'dividendes : lignes du Bulletin officiel préservées'` with `'dividendes : lignes officielles BRVM préservées'`. Keep `const sb = getSupabase();` (still used by the upserts below).

- [ ] **Step 4: `runDividendHistory.ts` — respect the official sources**

Add to the imports:
```ts
import { chargerReferences, sansEcraserReference } from './runDividends.js';
```
Replace:
```ts
  const { error } = await getSupabase()
    .from('dividends')
    .upsert(rows, { onConflict: 'code,exercice' });
```
with:
```ts
  // Une ligne du calendrier officiel ou du Bulletin n'est jamais réécrite par
  // Sikafinance (cette commande n'en tenait aucun compte avant le 2026-10-20).
  const aEcrire = sansEcraserReference(
    rows as (Record<string, unknown> & { code: string; exercice: number | null })[],
    await chargerReferences(),
  );
  if (aEcrire.length < rows.length) {
    logger.info({ preservees: rows.length - aEcrire.length }, 'dividend-history: lignes officielles BRVM préservées');
  }
  if (aEcrire.length === 0) return { titres: titresOk.size, lignes: 0, echecs };
  const { error } = await getSupabase()
    .from('dividends')
    .upsert(aEcrire, { onConflict: 'code,exercice' });
```

- [ ] **Step 5: `runDividendesBoc.ts` — yield to the calendar**

Change the type:
```ts
export type Ecart = 'concordant' | 'date_manquante' | 'montant_different' | 'absent' | 'ancien' | 'calendrier';
```
In `classer`, right after the `if (!base || base.montant == null) { … }` block, insert:
```ts
  // Le calendrier officiel prime : le Bulletin ne le réécrit jamais.
  if (base.source === 'brvm-calendrier') return 'calendrier';
```
Replace the write filter:
```ts
  const aEcrire = lignes.filter((l) => l.ecart !== 'concordant' && l.ecart !== 'ancien');
```
with:
```ts
  const aEcrire = lignes.filter((l) => l.ecart !== 'concordant' && l.ecart !== 'ancien' && l.ecart !== 'calendrier');
```

- [ ] **Step 6: Run the whole scraper suite and types**

```bash
npx vitest run 2>&1 | tail -4 && npx tsc -p tsconfig.json --noEmit && echo TSC-OK
```
Expected: all pass (baseline N + 22), `TSC-OK`.

- [ ] **Step 7: Commit**

```bash
git add src/dividends/runDividends.ts src/dividends/runDividendHistory.ts src/dividends/runDividendesBoc.ts tests/dividendesBoc.test.ts
git commit -m "fix(dividendes): aucun écrivain n'écrase plus le calendrier officiel ni le Bulletin

dividends:history ne tenait compte d'aucune source de référence ; le
Bulletin cède désormais au calendrier.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Network layer and orchestration

**Files:**
- Create: `scraper/src/dividends/calendrierFetch.ts`
- Create: `scraper/src/dividends/runCalendrier.ts`

- [ ] **Step 1: `calendrierFetch.ts`**

```ts
/**
 * Accès réseau au calendrier de paiement des dividendes (brvm.org).
 *
 * Politesse : robots.txt de brvm.org → Crawl-delay 10. Une exécution fait au
 * plus 6 pages de table, 5 essais d'URL et 1 téléchargement, espacés de 10 s.
 */
import type { ItemPdf } from './boc.js';
import { lireTableEsv, urlsCandidatesCalendrier, type PaiementEsv } from './esv.js';

const BASE = 'https://www.brvm.org';
const TABLE = `${BASE}/fr/esv/paiement-de-dividendes`;
const LISTE = `${BASE}/fr/avis-calendrier-de-paiement-de-dividendes`;
const UA = 'WESTBOURSE-dividendes/1.0 (+https://www.westbourse.com ; contact ebouak@gmail.com)';
export const DELAI_MS = 10_000;
const MAX_PAGES = 6;

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const requete = (url: string, method: 'GET' | 'HEAD' = 'GET') =>
  fetch(url, { method, headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30_000) });

/** Pages de la table, de la plus récente, jusqu'à atteindre un exercice antérieur. */
export async function lirePaiementsEsv(): Promise<PaiementEsv[]> {
  const tous: PaiementEsv[] = [];
  let exerciceMax: number | null = null;
  for (let p = 0; p < MAX_PAGES; p++) {
    if (p > 0) await pause(DELAI_MS);
    const r = await requete(p === 0 ? TABLE : `${TABLE}?page=${p}`);
    if (!r.ok) throw new Error(`table des paiements BRVM : HTTP ${r.status} (page ${p})`);
    const lus = lireTableEsv(await r.text());
    if (lus.length === 0) break;
    tous.push(...lus);
    exerciceMax ??= Math.max(...lus.map((l) => l.exercice));
    if (lus.some((l) => l.exercice < (exerciceMax as number))) break;
  }
  return tous;
}

/**
 * Dernier calendrier publié. D'abord par les dates d'avis de la table ; en
 * repli, le lien de la page de liste — figée au 31/03/2026, donc signalée.
 */
export async function trouverCalendrier(paiements: PaiementEsv[]): Promise<{ url: string; via: 'avis' | 'liste' }> {
  for (const url of urlsCandidatesCalendrier(paiements)) {
    await pause(DELAI_MS);
    if ((await requete(url, 'HEAD')).ok) return { url, via: 'avis' };
  }
  await pause(DELAI_MS);
  const r = await requete(LISTE);
  if (r.ok) {
    const m = /href="([^"]*_-_calendrier_de_paiement_des_dividendes_-_exercice_\d{4}\.pdf)"/i.exec(await r.text());
    if (m?.[1]) return { url: m[1].startsWith('http') ? m[1] : `${BASE}${m[1]}`, via: 'liste' };
  }
  throw new Error('aucun calendrier de paiement des dividendes trouvé sur brvm.org');
}

/** Fragments positionnés de toutes les pages (même extraction que la fixture). */
export async function telechargerCalendrier(url: string): Promise<ItemPdf[][]> {
  await pause(DELAI_MS);
  const r = await requete(url);
  if (!r.ok) throw new Error(`calendrier : HTTP ${r.status} sur ${url}`);
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await r.arrayBuffer()) }).promise;
  const pages: ItemPdf[][] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const contenu = await (await doc.getPage(i)).getTextContent();
    const items: ItemPdf[] = [];
    for (const x of contenu.items) {
      if (!('str' in x) || !x.str.trim()) continue;
      items.push({ s: x.str.trim(), x: Math.round(x.transform[4]), y: Math.round(x.transform[5]) });
    }
    pages.push(items);
  }
  return pages;
}
```

- [ ] **Step 2: `runCalendrier.ts`**

```ts
/**
 * Calendrier officiel de paiement des dividendes → table `dividends`.
 * Spec : docs/superpowers/specs/2026-10-20-dividendes-calendrier-design.md
 *
 * À BLANC par défaut : lit, recoupe, classe et imprime. `--ecrire` fait
 * l'upsert sur (code, exercice), source 'brvm-calendrier', que plus aucun
 * autre écrivain n'écrase (runDividends.SOURCES_REFERENCE).
 */
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { sha256 } from '../utils/hash.js';
import { lireCalendrier, type RejetCalendrier } from './calendrier.js';
import { codeDuNom } from './calendrierCodes.js';
import { exerciceDepuisUrlCalendrier } from './esv.js';
import { lirePaiementsEsv, telechargerCalendrier, trouverCalendrier } from './calendrierFetch.js';
import { classer, montantsPourBase, recouperDates, type Cible, type Ecart, type LigneBase } from './rapprochementCalendrier.js';

/** Sous ce nombre de lignes exploitables, la lecture est jugée suspecte : rien n'est fait. */
export const MIN_LIGNES = 20;

export interface LigneRapportCalendrier {
  code: string;
  nom: string;
  recoupee: boolean;
  cible: Cible;
  base: LigneBase | null;
  ecart: Ecart;
}

export interface RapportCalendrier {
  url: string;
  via: 'avis' | 'liste';
  exercice: number;
  lignes: LigneRapportCalendrier[];
  rejets: RejetCalendrier[];
  nonRapproches: string[];
  ecrites: number;
}

const COLONNES = 'code, montant, montant_brut, ex_date, payment_date, avis_brvm, source';
const COLONNES_AVANT_0157 = 'code, montant, ex_date, payment_date, source';

async function lireBase(codes: string[], exercice: number): Promise<{ base: Map<string, LigneBase>; colonnes0157: boolean }> {
  const sb = getSupabase();
  const lire = (cols: string) => sb.from('dividends').select(cols).eq('exercice', exercice).in('code', codes);
  let colonnes0157 = true;
  let { data, error } = await lire(COLONNES);
  if (error?.code === '42703') {
    // Migration 0157 pas encore appliquée : l'exécution À BLANC reste possible.
    colonnes0157 = false;
    logger.warn('dividends : colonnes de la migration 0157 absentes — lecture sans brut ni avis');
    ({ data, error } = await lire(COLONNES_AVANT_0157));
  }
  if (error) throw new Error(`dividends : ${error.message}`);
  const base = new Map<string, LigneBase>();
  for (const r of (data ?? []) as unknown as (Partial<LigneBase> & { code: string })[]) {
    base.set(r.code, {
      montant: r.montant ?? null,
      montant_brut: r.montant_brut ?? null,
      ex_date: r.ex_date ?? null,
      payment_date: r.payment_date ?? null,
      avis_brvm: r.avis_brvm ?? null,
      source: r.source ?? null,
    });
  }
  return { base, colonnes0157 };
}

export async function runCalendrier(opts: { ecrire?: boolean } = {}): Promise<RapportCalendrier> {
  const esv = await lirePaiementsEsv();
  const { url, via } = await trouverCalendrier(esv);
  if (via === 'liste') logger.warn({ url }, 'calendrier trouvé par la page de liste : peut-être périmé');
  const cal = lireCalendrier(await telechargerCalendrier(url));
  const exerciceUrl = exerciceDepuisUrlCalendrier(url);
  if (exerciceUrl !== cal.exercice) {
    throw new Error(`calendrier : exercice ${cal.exercice} dans le document, ${exerciceUrl} dans l'URL — rien n'est fait`);
  }

  const rejets: RejetCalendrier[] = [...cal.rejets];
  const nonRapproches: string[] = [];
  const { retenues, divergences } = recouperDates(cal.lignes, esv);
  for (const d of divergences) {
    rejets.push({
      nom: d.ligne.nom,
      avis: d.ligne.avis,
      motif:
        `dates divergentes : calendrier ex ${d.ligne.ex_date} / paiement ${d.ligne.paiement}, ` +
        `table BRVM ex ${d.esv.ex_date ?? '—'} / paiement ${d.esv.paiement}`,
    });
  }

  const candidats: Omit<LigneRapportCalendrier, 'base' | 'ecart'>[] = [];
  for (const { ligne, recoupee } of retenues) {
    const code = codeDuNom(ligne.nom);
    if (!code) {
      nonRapproches.push(ligne.nom);
      continue;
    }
    const m = montantsPourBase(ligne, cal.tauxPersonnePhysique);
    if (!m) {
      rejets.push({ nom: ligne.nom, avis: ligne.avis, motif: 'dividende brut sans taux lisible dans la note du document' });
      continue;
    }
    candidats.push({
      code,
      nom: ligne.nom,
      recoupee,
      cible: { ...m, ex_date: ligne.ex_date, payment_date: ligne.paiement, avis_brvm: ligne.avis },
    });
  }

  // Deux dividendes d'une même société pour un même exercice ne tiennent pas
  // dans la clé (code, exercice) : non tranché, rejeté et nommé.
  const parCode = new Map<string, number>();
  for (const c of candidats) parCode.set(c.code, (parCode.get(c.code) ?? 0) + 1);
  const uniques = candidats.filter((c) => {
    if ((parCode.get(c.code) ?? 0) === 1) return true;
    rejets.push({ nom: c.nom, avis: c.cible.avis_brvm, motif: `plusieurs dividendes pour ${c.code} dans le calendrier : non tranché` });
    return false;
  });
  if (uniques.length < MIN_LIGNES) {
    throw new Error(`calendrier : ${uniques.length} lignes exploitables dans ${url} — lecture suspecte, rien n'est fait`);
  }

  const { base, colonnes0157 } = await lireBase(uniques.map((c) => c.code), cal.exercice);
  const lignes: LigneRapportCalendrier[] = uniques.map((c) => {
    const b = base.get(c.code) ?? null;
    return { ...c, base: b, ecart: classer(c.cible, b) };
  });

  let ecrites = 0;
  const aEcrire = lignes.filter((l) => l.ecart !== 'concordant');
  if (opts.ecrire && aEcrire.length) {
    if (!colonnes0157) throw new Error('écriture impossible : appliquer d’abord la migration 0157');
    const rows = aEcrire.map((l) => ({
      code: l.code,
      exercice: cal.exercice,
      montant: l.cible.montant,
      montant_brut: l.cible.montant_brut,
      taux_retenue: l.cible.taux_retenue,
      avis_brvm: l.cible.avis_brvm,
      ex_date: l.cible.ex_date,
      payment_date: l.cible.payment_date,
      base_fiscale: 'net',
      devise: 'XOF',
      source: 'brvm-calendrier',
      source_url: url,
      // Même clé que runDividends et runDividendesBoc (code|exercice|montant).
      dedupe_hash: sha256(`${l.code}|${cal.exercice}|${l.cible.montant}`),
    }));
    const { error } = await getSupabase().from('dividends').upsert(rows, { onConflict: 'code,exercice' });
    if (error) throw new Error(`upsert dividends (brvm-calendrier) : ${error.message}`);
    ecrites = rows.length;
  }
  logger.info(
    {
      url,
      via,
      exercice: cal.exercice,
      lignes: lignes.length,
      rejets: rejets.length,
      non_rapproches: nonRapproches.length,
      ecrites,
      ecrire: Boolean(opts.ecrire),
    },
    'calendrier officiel des dividendes',
  );
  return { url, via, exercice: cal.exercice, lignes, rejets, nonRapproches, ecrites };
}
```

- [ ] **Step 3: Types**

```bash
npx tsc -p tsconfig.json --noEmit && echo TSC-OK
```
Expected: `TSC-OK`. If the client's types reject `select(cols)` with a non-literal `cols`, give `lire` an explicit return type `Promise<{ data: unknown[] | null; error: { code?: string; message: string } | null }>` (wrapping the builder in `async (cols: string) => { const r = await …; return { data: r.data as unknown[] | null, error: r.error }; }`) — never `any`.

- [ ] **Step 4: Commit**

```bash
git add src/dividends/calendrierFetch.ts src/dividends/runCalendrier.ts
git commit -m "feat(dividendes): collecte du calendrier officiel — découverte, recoupement, à blanc par défaut

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: CLI, npm script, dry run against production (read-only)

**Files:**
- Modify: `scraper/src/index.ts` (new `case` right after `case 'dividends:boc'`, ~line 552)
- Modify: `scraper/package.json` (after line 36)

- [ ] **Step 1: CLI case** — insert after the closing `}` of `case 'dividends:boc': { … return 0; }`:

```ts
    case 'dividends:calendrier': {
      // Calendrier officiel de paiement (BRVM). À BLANC sauf --ecrire.
      const { runCalendrier } = await import('./dividends/runCalendrier.js');
      const r = await runCalendrier({ ecrire: process.argv.includes('--ecrire') });
      console.log(`Calendrier ${r.url} (trouvé par ${r.via}) — exercice ${r.exercice}`);
      const parEcart: Record<string, number> = {};
      for (const l of r.lignes) {
        parEcart[l.ecart] = (parEcart[l.ecart] ?? 0) + 1;
        if (l.ecart === 'concordant') continue;
        const brut = l.cible.montant_brut != null ? ` (brut ${l.cible.montant_brut})` : '';
        const base = l.base
          ? `${l.base.montant} (${l.base.source ?? '—'}) ex ${l.base.ex_date ?? '—'} paiement ${l.base.payment_date ?? '—'}`
          : '—';
        console.log(
          `${l.code.padEnd(6)} ${l.ecart.padEnd(18)} net ${l.cible.montant}${brut} ex ${l.cible.ex_date} ` +
            `paiement ${l.cible.payment_date}${l.recoupee ? '' : ' [non recoupé]'}  |  base ${base}`,
        );
      }
      for (const j of r.rejets) console.log(`REJET  ${j.nom} (${j.avis ?? 'avis illisible'}) : ${j.motif}`);
      for (const n of r.nonRapproches) console.log(`NON RAPPROCHÉ  « ${n} » — à ajouter à src/dividends/calendrierCodes.ts`);
      console.log(
        `${JSON.stringify({ ...parEcart, rejets: r.rejets.length, non_rapproches: r.nonRapproches.length })} — ` +
          (r.ecrites ? `${r.ecrites} ligne(s) écrite(s)` : 'à blanc, rien écrit'),
      );
      // Une valeur nouvelle au calendrier doit faire du bruit (leçon BBGC) ;
      // un rejet motivé, lui, est imprimé sans faire échouer la semaine.
      return r.nonRapproches.length > 0 ? 1 : 0;
    }
```

- [ ] **Step 2: npm script** — in `scraper/package.json`, after the `"dividends:mock": …,` line add:
```json
    "dividends:calendrier": "tsx src/index.ts dividends:calendrier",
```

- [ ] **Step 3: Types + full suite**

```bash
npx tsc -p tsconfig.json --noEmit && echo TSC-OK && npx vitest run 2>&1 | tail -3
```
Expected: `TSC-OK`, all tests pass.

- [ ] **Step 4: Dry run against the real site and the production base (reads only)**

```bash
cd C:/Users/adego/wt/brvm-contact/scraper && DOTENV_CONFIG_PATH=.env.local USE_MOCK=false npx tsx src/index.ts dividends:calendrier 2>&1 | grep -v '^{' | tail -45
```
Expected (≈ 2 min, because of the 10 s delays):
- `Calendrier https://…/20261009_-_calendrier…exercice_2025.pdf (trouvé par avis)` (or a later date if BRVM published since);
- `SGBC   montant_different  net 2293.28 (brut 2606) …  |  base 2298.75 (brvm-boc) …`;
- `BOAC   montant_different  net 594.528 …  |  base 597.53 (brvm-boc) …`;
- a line `REJET  SOGB CI (213-2026 BRVMDG) : dates divergentes …` (unless BRVM corrected its table meanwhile);
- no `NON RAPPROCHÉ` line;
- last line ends with `à blanc, rien écrit`.

Before 0157 is applied, a warning about missing 0157 columns appears: expected for a dry run.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts package.json
git commit -m "feat(dividendes): commande dividends:calendrier (à blanc sauf --ecrire)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Post-run verification and weekly schedule

**Files:**
- Modify: `scraper/scripts/verify-data.ts`
- Modify: `.github/workflows/dividends.yml`

- [ ] **Step 1: New verification mode** — in `scripts/verify-data.ts`:

header list, after the `dividends` line:
```ts
 *   dividends-calendrier — bloquant : ≥ 20 dividendes du calendrier officiel datés (2 derniers exercices)
```
before `case 'alerts': {`:
```ts
    case 'dividends-calendrier': {
      // Un run vert ne prouve rien : on relit la base.
      const depuis = new Date().getUTCFullYear() - 2;
      const { count, error } = await client
        .from('dividends')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'brvm-calendrier')
        .not('ex_date', 'is', null)
        .gte('exercice', depuis);
      if (error) {
        console.error('❌ Échec requête:', error.message);
        process.exit(1);
      }
      if ((count ?? 0) < 20) {
        console.error(`❌ ${count ?? 0} dividende(s) du calendrier officiel avec date de détachement depuis l'exercice ${depuis} (attendu ≥ 20)`);
        process.exit(1);
      }
      console.log(`✅ ${count} dividendes du calendrier officiel avec date de détachement (exercices ≥ ${depuis})`);
      break;
    }
```
and in the `default:` message replace `| dividends | alerts` with `| dividends | dividends-calendrier | alerts`.

- [ ] **Step 2: Workflow** — in `.github/workflows/dividends.yml`:
  - the first `timeout-minutes: 10` (job `dividends`, line 24) becomes `timeout-minutes: 15`;
  - insert immediately after the step `Verify dividends written` (before `Notify failure on Slack`):
```yaml
      # Calendrier officiel BRVM (dates de détachement, brut/net). APRÈS
      # « dividends » : le calendrier est le dernier à écrire, et plus aucune
      # autre source ne l'écrase (runDividends.SOURCES_REFERENCE).
      - name: Calendrier officiel des dividendes
        working-directory: scraper
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          LOG_LEVEL: info
        run: npx tsx src/index.ts dividends:calendrier --ecrire

      - name: Vérifier le calendrier en base
        working-directory: scraper
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: npx tsx scripts/verify-data.ts dividends-calendrier
```

- [ ] **Step 3: YAML is valid and in the right order**

```bash
cd C:/Users/adego/wt/brvm-contact && python -I -c "import yaml; d=yaml.safe_load(open('.github/workflows/dividends.yml',encoding='utf-8')); print([s.get('name') for s in d['jobs']['dividends']['steps']])"
```
Expected: `Calendrier officiel des dividendes` then `Vérifier le calendrier en base`, right after `Verify dividends written`. (PyYAML missing → `python -m pip install pyyaml`.)

- [ ] **Step 4: Types**

```bash
cd scraper && npx tsc -p tsconfig.json --noEmit && echo TSC-OK
```

- [ ] **Step 5: Commit**

```bash
cd C:/Users/adego/wt/brvm-contact && git add scraper/scripts/verify-data.ts .github/workflows/dividends.yml
git commit -m "ci(dividendes): calendrier officiel chaque samedi, vérifié en relisant la base

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Frontend — Ivorian rate and yield according to the amount's basis

**Files:**
- Modify: `frontend/lib/tax/rates.ts` (interface `TauxFiscal`, entry `CI.dividende_cote`)
- Modify: `frontend/lib/tax/compute.ts` (append)
- Create: `frontend/lib/tax/rendementSelonBase.test.ts`

- [ ] **Step 1: Failing test** — `frontend/lib/tax/rendementSelonBase.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { rendementNetSelonBase } from './compute';
import { BAREME, type TauxFiscal } from './rates';

const T = (taux: number | null): TauxFiscal => ({ taux, source: 'test', sourceUrl: null, verifieLe: '2026-10-20' });
const FIXTURE = { CI: { dividende_cote: T(0.12) }, SN: { dividende_cote: T(null) } };

describe('rendement net selon la base du montant', () => {
  it('montant déjà net : jamais retaxé (double IRVM corrigée le 2026-10-20)', () => {
    expect(rendementNetSelonBase(5, 'net', 'CI', FIXTURE)).toEqual({ valeur: 5, deja_net: true });
  });
  it('montant brut : retenue du barème', () => {
    const r = rendementNetSelonBase(5, 'brut', 'CI', FIXTURE);
    expect(r.indisponible).toBeUndefined();
    if (!r.indisponible) expect(r.valeur).toBeCloseTo(4.4, 10);
  });
  it('base inconnue, ou taux non confirmé : indisponible, jamais supposé', () => {
    expect(rendementNetSelonBase(5, 'inconnu', 'CI', FIXTURE)).toEqual({ indisponible: true });
    expect(rendementNetSelonBase(5, null, 'CI', FIXTURE)).toEqual({ indisponible: true });
    expect(rendementNetSelonBase(5, 'brut', 'SN', FIXTURE)).toEqual({ indisponible: true });
  });
  it('barème réel : CI 12 % personnes physiques, 10 % personnes morales (LF 2025)', () => {
    expect(BAREME.CI.dividende_cote.taux).toBe(0.12);
    expect(BAREME.CI.dividende_cote.tauxPersonneMorale).toBe(0.1);
  });
});
```

- [ ] **Step 2: Run to see it fail**

```bash
cd C:/Users/adego/wt/brvm-contact/frontend && npx vitest run lib/tax/rendementSelonBase.test.ts 2>&1 | tail -5
```
Expected: FAIL — `rendementNetSelonBase` is not a function.

- [ ] **Step 3: `rates.ts`**

In `interface TauxFiscal`, after the `note?: string;` line add:
```ts
  /** Taux des personnes morales quand il diffère de `taux` (qui vise les personnes physiques). */
  tauxPersonneMorale?: number;
```
Replace the CI `dividende_cote: { … },` object (from `dividende_cote: {` to its closing `},` just before `obligation_etat: ETAT_EXONERE,`) with:
```ts
    dividende_cote: {
      taux: 0.12,
      tauxPersonneMorale: 0.10,
      source:
        "Annexe fiscale à la loi de finances 2025 (DGBF) ; BRVM, calendrier de paiement des dividendes du 09/10/2026 — 12 % personnes physiques, 10 % personnes morales",
      sourceUrl: 'https://www.dgbf.ci/wp-content/uploads/2025/01/Annexe1-Annexe-Fiscale.pdf',
      verifieLe: '2026-10-20',
      note: 'Personnes morales : 10 %. Avant 2025 : 10 % pour tous. Quelques émetteurs (FILTISAC…) appliquent un taux consolidé plus bas variable.',
    },
```
(SITAB leaves the note: its 2025 dividend, 1 940 gross → 1 707,20 net, is exactly 12 %.)

- [ ] **Step 4: `compute.ts`** — append:

```ts
export type BaseFiscale = 'brut' | 'net' | 'inconnu' | null | undefined;

export type RendementSelonBase =
  | { valeur: number; deja_net: true; taux?: undefined; indisponible?: undefined }
  | { valeur: number; deja_net: false; taux: number; indisponible?: undefined }
  | { indisponible: true };

/**
 * Rendement net d'IRVM selon la BASE du montant dont il est tiré.
 * `dividends.montant` est NET (calendrier officiel, Bulletin) : lui retirer
 * encore l'IRVM comptait l'impôt deux fois — défaut corrigé le 2026-10-20.
 * Base inconnue → indisponible, jamais une retenue supposée.
 */
export function rendementNetSelonBase(
  rendementPct: number,
  base: BaseFiscale,
  pays: string,
  bareme: Bareme = BAREME,
): RendementSelonBase {
  if (base === 'net') return { valeur: rendementPct, deja_net: true };
  if (base !== 'brut') return { indisponible: true };
  const r = rendementNet(rendementPct, pays, 'dividende_cote', bareme);
  return r.indisponible ? { indisponible: true } : { valeur: r.valeur, deja_net: false, taux: r.taux };
}
```

- [ ] **Step 5: Run the test, the existing tax script test, and types**

```bash
npx vitest run lib/tax/rendementSelonBase.test.ts 2>&1 | tail -4 && npx tsx lib/tax/compute.test.mjs && echo COMPUTE-OK && npx tsc --noEmit && echo TSC-OK
```
Expected: 4 passed, `COMPUTE-OK`, `TSC-OK`.

- [ ] **Step 6: Commit**

```bash
git add lib/tax/rates.ts lib/tax/compute.ts lib/tax/rendementSelonBase.test.ts
git commit -m "fix(fiscalite): IRVM CI 12 % personnes physiques (LF 2025) et rendement selon la base du montant

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Frontend — remove the double deduction on three screens

**Files:**
- Modify: `frontend/lib/budgetSimulator.ts`, `frontend/lib/budgetSimulator.test.mjs`
- Modify: `frontend/app/simulateur-budget/page.tsx`, `frontend/components/public/BudgetSimulator.tsx`
- Modify: `frontend/lib/dividends.ts`, `frontend/app/dividendes/page.tsx`, `frontend/components/DividendsTable.tsx`
- Modify: `frontend/app/actions/[code]/page.tsx`

- [ ] **Step 1: Failing budget-simulator test** — in `lib/budgetSimulator.test.mjs`, replace:
```js
assert.ok(Math.abs(rNet.divNet - rNet.divBrut * (1 - IRVM)) < 1e-6, 'IRVM appliqué (-10 %)');
```
with:
```js
assert.ok(Math.abs(rNet.divNet - rNet.divBrut * (1 - IRVM)) < 1e-6, `IRVM appliqué (-${IRVM * 100} %)`);

// --- montant déjà net : aucune seconde retenue (double IRVM corrigée le 2026-10-20)
const UNIV_NET = UNIV.map((a) => ({ ...a, rendementDejaNet: true }));
const rDejaNet = computeStrategy(meta('div'), UNIV_NET, 3, 1_000_000, 0.012, false, true);
assert.ok(rDejaNet.divBrut > 0, 'des dividendes sont projetés');
assert.ok(Math.abs(rDejaNet.divNet - rDejaNet.divBrut) < 1e-6, 'montant déjà net : pas de seconde retenue');
```
Run: `cd C:/Users/adego/wt/brvm-contact/frontend && npx tsx lib/budgetSimulator.test.mjs`. Expected: `AssertionError … montant déjà net : pas de seconde retenue`.

- [ ] **Step 2: `lib/budgetSimulator.ts`**

In `interface SimAction`, after `perf12: number | null;` add:
```ts
  /** Vrai quand le rendement vient d'un montant déjà NET d'IRVM (`dividends.base_fiscale = 'net'`) :
   *  aucune retenue n'est alors réappliquée. */
  rendementDejaNet?: boolean;
```
In `computeStrategy`, replace `  let divBrut = 0;` with:
```ts
  let divBrut = 0; // dividendes tels que publiés
  let divNet = 0;
```
replace:
```ts
    if (l.action.rendement != null) divBrut += (m * l.action.rendement) / 100;
```
with:
```ts
    if (l.action.rendement != null) {
      const d = (m * l.action.rendement) / 100;
      divBrut += d;
      divNet += netTax && !l.action.rendementDejaNet ? d * (1 - IRVM) : d;
    }
```
and delete the line:
```ts
  const divNet = netTax ? divBrut * (1 - IRVM) : divBrut;
```
Run `npx tsx lib/budgetSimulator.test.mjs` → no output, exit code 0.

- [ ] **Step 3: `app/simulateur-budget/page.tsx`** — the dividends select becomes:
```ts
        .select('code, exercice, montant, base_fiscale')
```
replace the `divByCode` block (from `const divByCode = new Map<string, { exercice: number; total: number }>();` to the closing `}` of its `for`) with:
```ts
  const divByCode = new Map<string, { exercice: number; total: number; toutNet: boolean }>();
  for (const d of divData ?? []) {
    if (d.exercice == null || d.montant == null) continue;
    const code = d.code as string;
    const ex = d.exercice as number;
    const net = d.base_fiscale === 'net';
    const cur = divByCode.get(code);
    if (!cur || ex > cur.exercice) divByCode.set(code, { exercice: ex, total: d.montant as number, toutNet: net });
    else if (ex === cur.exercice) {
      cur.total += d.montant as number;
      cur.toutNet &&= net;
    }
  }
```
and in `univers.push({ … })`, after `perf12,` add:
```ts
      rendementDejaNet: div?.toutNet ?? false,
```

- [ ] **Step 4: `components/public/BudgetSimulator.tsx`** — import becomes:
```ts
import {
  IRVM,
  STRATEGIES,
  computeStrategy,
  type SimAction,
  type StrategyResult,
} from '@/lib/budgetSimulator';
```
replace `              Dividendes nets d&apos;IRVM (10&nbsp;%)` with:
```tsx
              Dividendes nets d&apos;IRVM ({Math.round(IRVM * 100)}&nbsp;%)
```
replace the two lines
```tsx
          investissement. Les dividendes projetés sont des estimations (le net suppose une IRVM de 10&nbsp;% sur
          actions cotées, à vérifier) et la « perf 12 mois » est historique : les performances passées ne préjugent
```
with:
```tsx
          investissement. Les dividendes projetés sont des estimations (le net retient une IRVM de{' '}
          {Math.round(IRVM * 100)}&nbsp;% sur les seuls montants publiés bruts ; un montant déjà net n&apos;est pas
          retaxé) et la « perf 12 mois » est historique : les performances passées ne préjugent
```

- [ ] **Step 5: `/dividendes` data** — `lib/dividends.ts`, in `interface DividendRow`, after `payment_date: string | null;`:
```ts
  /** Base du montant : 'net' (cas courant), 'brut' ou 'inconnu'. */
  base_fiscale?: string | null;
```
`app/dividendes/page.tsx`: in `interface RawDividend` add `base_fiscale: string | null;`; the select becomes
```ts
      .select('id, code, exercice, ex_date, payment_date, montant, devise, base_fiscale')
```
and in the `rows` mapping, after `payment_date: d.payment_date,` add:
```ts
      base_fiscale: d.base_fiscale,
```

- [ ] **Step 6: `components/DividendsTable.tsx`** — replace `import { rendementNet } from '@/lib/tax/compute';` with:
```ts
import { rendementNetSelonBase, type BaseFiscale } from '@/lib/tax/compute';
```
replace:
```tsx
                      const r = p
                        ? rendementNet(row.rendement_pct, p, 'dividende_cote')
                        : ({ indisponible: true } as const);
```
with:
```tsx
                      const r = p
                        ? rendementNetSelonBase(row.rendement_pct, (row.base_fiscale ?? null) as BaseFiscale, p)
                        : ({ indisponible: true } as const);
```
and replace
```tsx
            * taux non confirmé pour ce pays → rendement brut affiché. Net = brut × (1 − IRVM du
            pays de l&apos;émetteur).{' '}
```
with:
```tsx
            * base du montant inconnue ou taux non confirmé → valeur publiée affichée. Un montant déjà
            net n&apos;est pas retaxé ; sinon net = brut × (1 − IRVM du pays de l&apos;émetteur).{' '}
```

- [ ] **Step 7: `app/actions/[code]/page.tsx`** — line 58 becomes:
```ts
import { rendementNetSelonBase, type BaseFiscale } from '@/lib/tax/compute';
```
the dividends select (≈ line 176):
```ts
        .select('montant, ex_date, payment_date, exercice, base_fiscale')
```
the `divRows` cast (≈ line 383):
```ts
  const divRows = dividends as { montant: number; ex_date: string | null; exercice: number | null; payment_date?: string; base_fiscale?: string | null }[];
```
replace the block from `  // Rendement dividende net d'IRVM (barème sourcé lib/tax — null si taux non confirmé).` through `  const divYieldNet = divNetRes.indisponible ? null : divNetRes.valeur;` with:
```ts
  // Rendement net d'IRVM. `montant` est déjà NET dans la base : on ne le retaxe
  // pas (double IRVM corrigée le 2026-10-20) ; on n'applique le barème qu'à un
  // montant publié brut, et rien quand la base est inconnue.
  const paysFiscal = toPaysUemoa(pays);
  const divNetRes = divYield != null && paysFiscal
    ? rendementNetSelonBase(divYield, (lastDiv?.base_fiscale ?? null) as BaseFiscale, paysFiscal)
    : ({ indisponible: true } as const);
  const divDejaNet = !divNetRes.indisponible && divNetRes.deja_net;
  const divYieldNet = divNetRes.indisponible || divNetRes.deja_net ? null : divNetRes.valeur;
```
and the session metric
```tsx
              {divYield != null && <SessionMetric label="Rdt dividende" value={divYield.toFixed(2)} unit="%" accent />}
```
with:
```tsx
              {divYield != null && <SessionMetric label={divDejaNet ? 'Rdt dividende net' : 'Rdt dividende'} value={divYield.toFixed(2)} unit="%" accent />}
```

- [ ] **Step 8: No caller of `rendementNet(` left outside the tax module**

```bash
cd C:/Users/adego/wt/brvm-contact/frontend && grep -rn "rendementNet(" app components lib --include=*.ts --include=*.tsx | grep -v "lib/tax/compute.ts"
```
Expected: no output. If one remains, give it the same `rendementNetSelonBase` treatment with its row's `base_fiscale`.

- [ ] **Step 9: Types and tests**

```bash
npx tsc --noEmit && echo TSC-OK && npx tsx lib/budgetSimulator.test.mjs && echo BUDGET-OK && npx vitest run 2>&1 | tail -3
```
Expected: `TSC-OK`, `BUDGET-OK`, vitest all passed.

- [ ] **Step 10: Commit**

```bash
git add lib/dividends.ts app/dividendes/page.tsx components/DividendsTable.tsx "app/actions/[code]/page.tsx" lib/budgetSimulator.ts lib/budgetSimulator.test.mjs app/simulateur-budget/page.tsx components/public/BudgetSimulator.tsx
git commit -m "fix(dividendes): l'IRVM n'est plus retirée deux fois d'un montant déjà net

/dividendes (bouton net), fiche action (Rdt net d'IRVM) et
/simulateur-budget retaxaient dividends.montant, qui est NET.
Le passage à 12 % aurait aggravé l'écart.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Documentation, push, PR — and the production sequence (user-gated)

**Files:**
- Modify: `CLAUDE.md` (new subsection at the end of §8, just before `## 9. Bugs connus / limites`)

- [ ] **Step 1: CLAUDE.md** — insert before `## 9. Bugs connus / limites`:

```markdown
### Ajouts (passage 2026-10-20) — Calendrier officiel des dividendes

Spec `docs/superpowers/specs/2026-10-20-dividendes-calendrier-design.md`, plan
`docs/superpowers/plans/2026-10-20-dividendes-calendrier.md`. Migration `0157`.

- **Source** : le calendrier de paiement BRVM (PDF) est le SEUL document qui
  distingue brut et net — l'en-tête dit « net », les lignes « (*) » sont
  BRUTES (IRVM CI 12 % personnes physiques depuis la LF 2025, 10 % personnes
  morales ; taux lu dans la note). `montant` reste le NET personne physique ;
  `montant_brut`, `taux_retenue`, `avis_brvm` à côté. Brut jamais reconstitué.
- **Découverte** : la page de liste officielle est figée au 31/03/2026. Le
  dernier PDF se trouve par les dates d'avis de la table
  `brvm.org/fr/esv/paiement-de-dividendes`, qui sert aussi à RECOUPER les dates
  par numéro d'avis (elle a ses propres erreurs : SOGB). Divergence → rejet nommé.
- **Priorité** : calendrier > BOC > richbourse > sikafinance
  (`runDividends.SOURCES_REFERENCE`, respectée aussi par `dividends:history`,
  qui ne l'était pas, et par `dividends:boc`). SGBC passe à 2 293,28
  (2 606 × 0,88) contre 2 298,75 au Bulletin — renversement assumé.
- **Double IRVM corrigée** : `/dividendes`, la fiche action et
  `/simulateur-budget` retiraient l'IRVM d'un `montant` déjà net.
  `rendementNetSelonBase` (lib/tax/compute.ts) ne retaxe jamais une base `net`.
- **Cron** : étape de `dividends.yml` (samedi), vérifiée en relisant la base
  (`verify-data.ts dividends-calendrier`). Libellé inconnu → code 1 (bruit voulu).
```

- [ ] **Step 2: Full verification before pushing**

```bash
cd C:/Users/adego/wt/brvm-contact/scraper && npx vitest run 2>&1 | tail -3 && npx tsc -p tsconfig.json --noEmit && echo SCRAPER-TSC-OK
cd ../frontend && npx tsc --noEmit && echo FRONT-TSC-OK && npx vitest run 2>&1 | tail -3 && npx tsx lib/budgetSimulator.test.mjs && npx tsx lib/tax/compute.test.mjs && echo SCRIPTS-OK
cd .. && git status --short
```
Expected: all green; `git status` shows only `CLAUDE.md` modified (the `.env.local` copies are ignored; the untracked `frontend/tests/_tmp/` left by an earlier session must NOT be added).

- [ ] **Step 3: Commit, push, open the PR (do NOT merge)**

```bash
git add CLAUDE.md
git commit -m "docs: calendrier officiel des dividendes et double IRVM (CLAUDE.md)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
gh pr create --title "Dividendes étape 1 : calendrier officiel BRVM, IRVM CI 12 %, fin de la double retenue" --body "$(cat <<'EOF'
## Ce que ça change
- Collecte du calendrier officiel de paiement BRVM : dates de détachement (2/36 → ~35), brut et net distingués, numéro d'avis. À blanc par défaut, `--ecrire` sur accord.
- Dernier PDF trouvé par les dates d'avis (la page de liste est figée au 31/03) ; dates recoupées avec la table HTML BRVM par numéro d'avis.
- Le calendrier n'est plus écrasé par aucune autre source (dont `dividends:history`, qui ne protégeait rien).
- IRVM CI : 12 % personnes physiques (LF 2025), 10 % personnes morales.
- L'IRVM n'est plus retirée deux fois d'un montant déjà net (`/dividendes`, fiche action, `/simulateur-budget`).

## Avant la fusion
1. Appliquer `supabase/migrations/0157_dividendes_calendrier.sql` dans l'éditeur SQL Supabase.
2. Exécution à blanc relue, puis `dividends:calendrier --ecrire` sur accord.

Spec : `docs/superpowers/specs/2026-10-20-dividendes-calendrier-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Production sequence — each step needs the user's explicit go**
  1. User applies migration 0157 in the Supabase SQL editor.
  2. Check the new columns with the ANON key (public read, as for the rest of `dividends`):
     ```bash
     cd C:/Users/adego/wt/brvm-contact/frontend && node -e "
     const fs=require('fs');const e=Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).map(l=>l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map(m=>[m[1],m[2].replace(/^[\"']|[\"']$/g,'')]));
     const k=e.NEXT_PUBLIC_SUPABASE_ANON_KEY;const h=k.startsWith('sb_')?{apikey:k}:{apikey:k,Authorization:'Bearer '+k};
     fetch(e.NEXT_PUBLIC_SUPABASE_URL+'/rest/v1/dividends?select=code,montant_brut,taux_retenue,avis_brvm&limit=1',{headers:{...h,'User-Agent':'westbourse-verif/1'}}).then(r=>r.text().then(t=>console.log(r.status,t.slice(0,120))));"
     ```
     Expected: `200` and a JSON array (values may be null). The script prints neither key.
  3. Dry run again (Task 9 Step 4), report shown to the user.
  4. On « go » : `cd scraper && DOTENV_CONFIG_PATH=.env.local USE_MOCK=false npx tsx src/index.ts dividends:calendrier --ecrire`, then `DOTENV_CONFIG_PATH=.env.local npx tsx scripts/verify-data.ts dividends-calendrier` (expected `✅ ≥ 20 …`). `verify-data.ts` reads `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` from the environment: export them from `.env.local` in the same shell command without echoing them if it does not load dotenv itself.
  5. Spot-check ORAC (704 / 800 / 0,12 / `138-2026 BRVMDG`) and SNTS (1740 / brut null), then re-read `/dividendes`, the SNTS stock page and `/simulateur-budget`.
  6. Merge only on « fusionner », after the CI checks have registered and passed.
