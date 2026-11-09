# Conseiller — PR 1 (données) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Calculer chaque jour, dans le scraper, la position de chaque valeur sur
les cinq familles de facteurs, sans verdict. Le résultat est écrit dans une table
`conseiller_facteurs`, contrôlée sur la donnée et suivie par la tour de contrôle.

**Architecture:** Le job réutilise `chargerHistorique`, `scoresFamilles` et
`classeA`, déjà testés pour le banc. Deux fonctions pures s'y ajoutent :
`lignesFacteurs` (scores → lignes avec tiers et effectifs) et `verifierEcriture`
(contrôle du lot). Le runner écrit en upsert idempotent sur `(date_marche, code)`,
relit la base, puis la contrôle. Spec :
`docs/superpowers/specs/2026-11-09-conseiller-v2-design.md` §12.

**Tech Stack:** Node ≥ 22 TS ESM, vitest, supabase-js (service_role, côté
scraper uniquement), GitHub Actions, Next 14 (tour de contrôle).

---

## Règles

- Branche `design/conseiller-v2`, worktree `C:\Users\adego\wt\brvm-conseiller`.
  Rien n'est poussé sans instruction.
- L'exécutant n'applique PAS la migration : c'est le contrôleur qui s'en charge,
  à la tâche 6.
- Aucun secret affiché. Ne lis ni n'imprime `.env.local`.
- Commits en français, terminés par
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Tests : `cd scraper && npx vitest run tests/conseiller`. Typecheck :
  `npm run typecheck` (scraper) et, pour la tâche 5, `npx tsc --noEmit -p .`
  dans `frontend`.

---

### Task 1: Migration `0200_conseiller_facteurs.sql`

**Files:**
- Create: `supabase/migrations/0200_conseiller_facteurs.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- Conseiller : position de chaque valeur par famille de facteurs, SANS verdict.
-- Spec docs/superpowers/specs/2026-11-09-conseiller-v2-design.md §12.
-- Données de marché uniquement : aucune donnée personnelle.
create table if not exists public.conseiller_facteurs (
  date_marche      date        not null,
  code             text        not null references public.brvm_instruments(code) on update cascade,
  scores           jsonb       not null,
  tiers            jsonb       not null,
  effectifs        jsonb       not null,
  classe_liquidite text        check (classe_liquidite in ('A','B','C','D')),
  moteur_version   text        not null,
  created_at       timestamptz not null default now(),
  primary key (date_marche, code)
);
create index if not exists idx_conseiller_facteurs_date on public.conseiller_facteurs (date_marche desc);

alter table public.conseiller_facteurs enable row level security;
drop policy if exists "lecture publique conseiller_facteurs" on public.conseiller_facteurs;
create policy "lecture publique conseiller_facteurs" on public.conseiller_facteurs
  for select to anon, authenticated using (true);
-- Écriture : service_role seulement (aucune policy d'écriture).
revoke insert, update, delete on public.conseiller_facteurs from anon, authenticated;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0200_conseiller_facteurs.sql
git commit -m "feat(db): table conseiller_facteurs (positions par famille, sans verdict)"
```

---

### Task 2: Fonctions pures `lignesFacteurs` et `verifierEcriture`

**Files:**
- Create: `scraper/src/conseiller/lignes.ts`
- Test: `scraper/tests/conseillerLignes.test.ts`

- [ ] **Step 1: Écrire les tests**

```ts
import { describe, it, expect } from 'vitest';
import { lignesFacteurs, tierDe, verifierEcriture, MOTEUR_VERSION } from '../src/conseiller/lignes.js';

const sc = (t: number | null, r: number | null) => ({ valorisation: null, qualite: null, rendement: null, tendance: t, risque: r });

describe('tierDe', () => {
  it('découpe en tiers', () => {
    expect(tierDe(0.5)).toBe('haut');
    expect(tierDe(1 / 3)).toBe('haut');
    expect(tierDe(0)).toBe('milieu');
    expect(tierDe(-1 / 3)).toBe('bas');
    expect(tierDe(null)).toBeNull();
  });
});

describe('lignesFacteurs', () => {
  it('produit une ligne par valeur avec tiers et effectifs par famille', () => {
    const scores = new Map([['A', sc(0.8, -0.5)], ['B', sc(-0.8, null)]]);
    const classes = new Map([['A', 'B' as const], ['B', null]]);
    const l = lignesFacteurs('2026-11-06', scores, classes);
    expect(l).toHaveLength(2);
    expect(l[0]).toMatchObject({ date_marche: '2026-11-06', code: 'A', classe_liquidite: 'B', moteur_version: MOTEUR_VERSION });
    expect(l[0]!.tiers).toEqual({ valorisation: null, qualite: null, rendement: null, tendance: 'haut', risque: 'bas' });
    expect(l[0]!.effectifs).toEqual({ valorisation: 0, qualite: 0, rendement: 0, tendance: 2, risque: 1 });
    expect(l[1]!.classe_liquidite).toBeNull();
  });
});

describe('verifierEcriture', () => {
  const ligne = (code: string, t: number | null) => lignesFacteurs('2026-11-06', new Map([[code, sc(t, t)]]), new Map([[code, 'A' as const]]))[0]!;
  it('accepte un lot complet sur la bonne séance', () => {
    const lot = Array.from({ length: 47 }, (_, i) => ligne(`V${i}`, 0.5));
    expect(verifierEcriture(lot, '2026-11-06', 48)).toEqual([]);
  });
  it('refuse une mauvaise séance', () => {
    expect(verifierEcriture([ligne('A', 0.5)], '2026-11-07', 1)[0]).toMatch(/séance/);
  });
  it('refuse un lot trop court (moins que cotées − 2)', () => {
    const lot = Array.from({ length: 40 }, (_, i) => ligne(`V${i}`, 0.5));
    expect(verifierEcriture(lot, '2026-11-06', 48).join(' ')).toMatch(/lignes/);
  });
  it('refuse plus de 30 % de lignes entièrement nulles', () => {
    const lot = [...Array.from({ length: 30 }, (_, i) => ligne(`V${i}`, 0.5)), ...Array.from({ length: 18 }, (_, i) => ligne(`N${i}`, null))];
    expect(verifierEcriture(lot, '2026-11-06', 48).join(' ')).toMatch(/nulles/);
  });
});
```

- [ ] **Step 2: Lancer (échec attendu)**

Run: `cd scraper && npx vitest run tests/conseillerLignes.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter**

```ts
import type { LiquidityClass } from '../liquidity/compute.js';
import { FAMILLES_FACTEURS, type FamilleFacteur } from './types.js';
import type { ScoresFamilles } from './facteurs.js';

/** Version du calcul écrit en base. À changer si une règle de facteurs change. */
export const MOTEUR_VERSION = 'facteurs-v2-2026-11-09';

export type Tier = 'haut' | 'milieu' | 'bas';
type ParFamille<T> = Record<FamilleFacteur, T>;

export interface LigneFacteurs {
  date_marche: string;
  code: string;
  scores: ParFamille<number | null>;
  tiers: ParFamille<Tier | null>;
  effectifs: ParFamille<number>;
  classe_liquidite: LiquidityClass | null;
  moteur_version: string;
}

/** Rang [−1, +1] → tiers. Les bornes ±1/3 suivent la règle du banc. */
export function tierDe(v: number | null): Tier | null {
  if (v == null) return null;
  if (v >= 1 / 3) return 'haut';
  if (v <= -1 / 3) return 'bas';
  return 'milieu';
}

/** Une ligne par valeur. `effectifs` = nombre de valeurs classées par famille ce jour-là. */
export function lignesFacteurs(date: string, scores: Map<string, ScoresFamilles>, classes: Map<string, LiquidityClass | null>): LigneFacteurs[] {
  const effectifs = Object.fromEntries(
    FAMILLES_FACTEURS.map((f) => [f, [...scores.values()].filter((s) => s[f] != null).length]),
  ) as ParFamille<number>;
  return [...scores]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([code, s]) => ({
      date_marche: date,
      code,
      scores: { ...s },
      tiers: Object.fromEntries(FAMILLES_FACTEURS.map((f) => [f, tierDe(s[f])])) as ParFamille<Tier | null>,
      effectifs,
      classe_liquidite: classes.get(code) ?? null,
      moteur_version: MOTEUR_VERSION,
    }));
}

export const MARGE_LIGNES = 2;
export const PART_NULLE_MAX = 0.3;

/** Contrôle d'un lot relu en base. Renvoie la liste des anomalies ; vide = conforme. */
export function verifierEcriture(lignes: LigneFacteurs[], derniereSeance: string, nbCotees: number): string[] {
  const erreurs: string[] = [];
  if (lignes.some((l) => l.date_marche !== derniereSeance)) erreurs.push(`séance écrite différente de la dernière séance (${derniereSeance})`);
  if (lignes.length < nbCotees - MARGE_LIGNES) erreurs.push(`${lignes.length} lignes pour ${nbCotees} valeurs cotées`);
  const nulles = lignes.filter((l) => FAMILLES_FACTEURS.every((f) => l.scores[f] == null)).length;
  if (lignes.length > 0 && nulles / lignes.length > PART_NULLE_MAX) erreurs.push(`${nulles} lignes entièrement nulles sur ${lignes.length}`);
  return erreurs;
}
```

- [ ] **Step 4: Lancer les tests**

Run: `cd scraper && npx vitest run tests/conseillerLignes.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add scraper/src/conseiller/lignes.ts scraper/tests/conseillerLignes.test.ts
git commit -m "feat(conseiller): lignes de facteurs (tiers, effectifs) et contrôle du lot"
```

---

### Task 3: Runner `conseiller [--ecrire]`

**Files:**
- Create: `scraper/src/conseiller/runConseiller.ts`
- Modify: `scraper/src/index.ts`, sur le modèle des cases `conseiller:*` existantes
  et de `monitored`, utilisé par les autres commandes cron (par exemple `liquidity`)
- Modify: `scraper/package.json`, script `"conseiller": "tsx --env-file-if-exists=.env.local src/index.ts conseiller"`

- [ ] **Step 1: Écrire le runner**

```ts
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { chargerHistorique } from './historique.js';
import { indiceEquipondere } from './indice.js';
import { scoresFamilles } from './facteurs.js';
import { classeA } from './liquiditeGlissante.js';
import { lignesFacteurs, verifierEcriture, type LigneFacteurs } from './lignes.js';

/**
 * Positions par famille de facteurs pour la dernière séance (spec §12).
 * Sans `ecrire` : calcul et contrôle à blanc, rien n'est écrit.
 * Avec `ecrire` : upsert idempotent sur (date_marche, code), relecture, puis contrôle
 * sur la donnée RELUE. Une anomalie LÈVE : le run passe au rouge.
 */
export async function runConseiller(ecrire: boolean): Promise<{ date: string; lignes: number }> {
  const { donnees: d } = await chargerHistorique();
  const date = d.calendrier.at(-1);
  if (!date) throw new Error('aucune séance en base');
  const ind = indiceEquipondere(d);
  const scores = scoresFamilles(d, ind, date);
  const classes = new Map([...scores.keys()].map((c) => [c, classeA(d.series.get(c)!, d.calendrier, date)]));
  const lignes = lignesFacteurs(date, scores, classes);
  const nbCotees = scores.size;

  const aBlanc = verifierEcriture(lignes, date, nbCotees);
  if (aBlanc.length) throw new Error(`conseiller : lot invalide avant écriture — ${aBlanc.join(' ; ')}`);
  if (!ecrire) {
    logger.info({ date, lignes: lignes.length }, 'conseiller : calcul à blanc conforme (rien écrit)');
    return { date, lignes: lignes.length };
  }

  const sb = getSupabase();
  const { error } = await sb.from('conseiller_facteurs').upsert(lignes, { onConflict: 'date_marche,code' });
  if (error) throw new Error(`conseiller : écriture refusée — ${error.message}`);

  const { data: relues, error: eRelue } = await sb.from('conseiller_facteurs').select('*').eq('date_marche', date);
  if (eRelue) throw new Error(`conseiller : relecture impossible — ${eRelue.message}`);
  const anomalies = verifierEcriture((relues ?? []) as LigneFacteurs[], date, nbCotees);
  if (anomalies.length) throw new Error(`conseiller : contrôle sur la donnée relue — ${anomalies.join(' ; ')}`);
  logger.info({ date, lignes: relues?.length }, 'conseiller : positions écrites et vérifiées');
  return { date, lignes: relues?.length ?? 0 };
}
```

- [ ] **Step 2: Brancher la commande**

Dans `scraper/src/index.ts`, ajoute `case 'conseiller':` à côté des cases
`conseiller:*`. Enveloppe-la de la même façon que les autres commandes cron :
`monitored({ code: 'conseiller', label: 'Positions du Conseiller (facteurs)' }, …)`.
Lis la case `liquidity` et reproduis-la. La commande lit
`process.argv.includes('--ecrire')`.

- [ ] **Step 3: Typecheck, tests, puis calcul à blanc réel**

Run: `cd scraper && npm run typecheck && npx vitest run tests/conseiller && npm run conseiller`
Expected : typecheck et tests au vert, puis le log `conseiller : calcul à blanc conforme`
avec la date de la dernière séance et le nombre de lignes. Rien n'est écrit en base.

- [ ] **Step 4: Commit**

```bash
git add scraper/src/conseiller/runConseiller.ts scraper/src/index.ts scraper/package.json
git commit -m "feat(conseiller): job quotidien des positions par famille, contrôlé sur la donnée relue"
```

---

### Task 4: Étape dans `.github/workflows/score.yml`

**Files:**
- Modify: `.github/workflows/score.yml`

- [ ] **Step 1: Lire le workflow**

Lis le fichier en entier. Repère le job ou l'étape `liquidity`, et la manière
dont les secrets Supabase sont transmis (`SUPABASE_URL` et
`SUPABASE_SERVICE_ROLE_KEY`, ou leurs équivalents).

- [ ] **Step 2: Ajouter l'étape**

Place-la APRÈS l'étape `liquidity` : dans le même job, ou dans un job qui en
dépend avec `needs:`. Reprends les mêmes variables d'environnement et le même
répertoire de travail :

```yaml
      - name: Conseiller — positions par famille de facteurs
        working-directory: scraper
        run: npx tsx src/index.ts conseiller --ecrire
```

Adapte `working-directory`, `env:` et l'installation aux conventions du fichier.
N'ajoute AUCUN nouveau secret.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/score.yml
git commit -m "ci(conseiller): positions par famille calculées après la liquidité"
```

---

### Task 5: Fraîcheur dans la tour de contrôle

**Files:**
- Modify: `frontend/lib/controle/donnees.ts` et `frontend/lib/controle/lectureDonnees.ts`
- Test: `frontend/lib/controle/donnees.test.ts`

- [ ] **Step 1: Lire le modèle existant**

Lis comment `liquidite` est déclaré : la table `liquidity_daily`, l'appel
`fluxSeance({ id: 'liquidite', … heure: H_SIGNAUX … })`, et la manière dont
`lectureDonnees.ts` lit son `max(date_marche)`.

- [ ] **Step 2: Test qui échoue**

Dans `donnees.test.ts`, ajoute un cas sur le modèle de celui de la liquidité :
une date `conseiller` en retard de 2 séances doit produire un signal `alerte`
d'id `conseiller`.

- [ ] **Step 3: Implémenter**

- Ajoute un champ `conseiller` (dernière `date_marche` de `conseiller_facteurs`)
  à la structure lue.
- Lis-le dans `lectureDonnees.ts` avec la même requête que pour la liquidité.
  Une erreur de lecture LÈVE, comme ailleurs.
- Ajoute :
  `fluxSeance({ id: 'conseiller', titre: 'Positions du Conseiller', table: 'conseiller_facteurs', derniere: d.conseiller, heure: H_SIGNAUX, attention: 1, alerte: 2 }, maintenant, f)`.

- [ ] **Step 4: Tests et typecheck frontend**

Run: `cd frontend && npx vitest run lib/controle && npx tsc --noEmit -p .`
Expected: PASS, aucune erreur.

Si `frontend/node_modules` manque dans le worktree, crée une jonction vers
`C:\Users\adego\OneDrive\Documents\brvm-analyst-pro\frontend\node_modules` (PowerShell
`New-Item -ItemType Junction`).

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/controle/donnees.ts frontend/lib/controle/lectureDonnees.ts frontend/lib/controle/donnees.test.ts
git commit -m "feat(controle): fraîcheur des positions du Conseiller"
```

---

### Task 6 (contrôleur) : application et vérification

- [ ] Appliquer la migration : `npx supabase db query --linked -f supabase/migrations/0200_conseiller_facteurs.sql`, en l'annonçant à l'exploitant.
- [ ] Lancer `npm run conseiller -- --ecrire` en local depuis `scraper` (écriture réelle, contrôlée).
- [ ] Vérifier avec la clé anon :
  - `GET /rest/v1/conseiller_facteurs?select=code&limit=1` répond 200 ;
  - un `POST` répond 401 ou 403.
- [ ] Pousser la branche, ouvrir la PR 1, attendre les contrôles et demander la fusion.
