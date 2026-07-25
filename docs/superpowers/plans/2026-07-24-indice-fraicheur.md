# Indice de fraîcheur des cours — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher, à côté des cours, un badge de fraîcheur (frais / récent / périmé / inconnu) dérivé de la dernière collecte intraday et de la dernière séance en base.

**Architecture:** Un module pur `lib/freshness.ts` calcule l'état à partir de trois entrées injectées (dernière collecte, dernière séance, instant courant). Une vue Supabase minimale expose la seule ligne intraday de `scraper_sources`. Un composant `FreshnessBadge` rend l'état sur le ticker et la fiche action.

**Tech Stack:** Next.js 14 App Router, Supabase (RLS), TypeScript strict, tests purs `.test.mjs` via `npx tsx --test`.

---

## Contraintes d'environnement

- **Ne JAMAIS lancer `npm run build`** (part en arrière-plan, bloque la tâche).
- Garde-fou : `npx tsc --noEmit` depuis `frontend/`, ~5 min → timeout 540000 ms.
- Tests purs : `npx tsx --test <chemin>` depuis `frontend/`.
- Migrations : écrites dans `supabase/migrations/` **et** appliquées via MCP Supabase (connecté).
- Branche `main`, pas de worktree.

## Faits vérifiés avant rédaction

- `scraper_sources` colonnes : `id, code, label, is_active, last_success_at, created_at`. Ligne `code = 'intraday'` porte l'horodatage voulu. Table en RLS **service-role only** (aucune policy de lecture).
- Cron intraday : `'3,18,33,48 9-15 * * 1-5'` et `'10,25,40,55 9-15 * * 1-5'` → **lundi-vendredi, 09-15 GMT**. Il NE tourne PAS le week-end : `last_success_at` reste figé à vendredi tout le week-end. C'est pourquoi l'âge de collecte seul ne peut pas décider « périmé ».
- Ticker : `frontend/components/dashboard/DashboardTicker.tsx`. Fiche action : `frontend/app/actions/[code]/page.tsx`.

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `supabase/migrations/0122_fraicheur_cours.sql` | Vue `v_fraicheur_cours` + policy RLS restreinte |
| `frontend/lib/freshness.ts` | **Pur** : `computeFreshness` + helpers séance/jour ouvré |
| `frontend/lib/freshness.test.mjs` | Tests du module pur |
| `frontend/lib/freshness/queries.ts` | Charge collecte + dernière séance |
| `frontend/components/FreshnessBadge.tsx` | Badge d'affichage |
| `frontend/components/dashboard/DashboardTicker.tsx` | Branche le badge |
| `frontend/app/actions/[code]/page.tsx` | Branche le badge dans l'en-tête |

---

### Task 1 : Migration — vue et policy

**Files:**
- Create: `supabase/migrations/0122_fraicheur_cours.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- 0122 — Indice de fraicheur des cours : exposer la derniere collecte intraday.
--
-- scraper_sources est en RLS service-role only. Plutot que d'ouvrir toute la
-- table (qui revelerait les codes des autres sources), on ajoute une policy de
-- lecture RESTREINTE a la ligne intraday, et une vue security_invoker qui
-- n'expose que son horodatage.
--
-- Piege anticipe (rencontre sur le passeport) : une vue security_invoker
-- N'ECHAPPE PAS a la RLS de la table sous-jacente. Sans la policy ci-dessous,
-- la vue renverrait zero ligne a anon/authenticated.

drop policy if exists "fraicheur intraday lisible" on public.scraper_sources;
create policy "fraicheur intraday lisible" on public.scraper_sources
  for select using (code = 'intraday');

create or replace view public.v_fraicheur_cours
  with (security_invoker = true) as
select last_success_at as derniere_collecte_intraday
from public.scraper_sources
where code = 'intraday';

grant select on public.v_fraicheur_cours to anon, authenticated;
```

- [ ] **Step 2 : Appliquer via MCP**

Appliquer avec `mcp__supabase__apply_migration` (name: `0122_fraicheur_cours`, project_id `vozwivhmjfmnnnjbbkpt`).

- [ ] **Step 3 : Sonde RLS — SEULE la ligne intraday doit fuir**

Exécuter via `mcp__supabase__execute_sql` :

```sql
set local role anon;
select
  (select count(*) from public.v_fraicheur_cours) as vue_lisible,
  (select count(*) from public.scraper_sources) as sources_visibles,
  (select count(*) from public.scraper_sources where code <> 'intraday') as autres_sources_visibles;
```

Expected : `vue_lisible = 1`, `sources_visibles = 1`, `autres_sources_visibles = 0`.
Si `autres_sources_visibles > 0`, STOP — la policy fuit et doit être corrigée avant de continuer.

- [ ] **Step 4 : Commit**

```bash
git add supabase/migrations/0122_fraicheur_cours.sql
git commit -m "feat(fraicheur): vue v_fraicheur_cours + policy RLS restreinte a intraday"
```

---

### Task 2 : Module pur `freshness.ts` (TDD)

**Files:**
- Create: `frontend/lib/freshness.ts`
- Test: `frontend/lib/freshness.test.mjs`

- [ ] **Step 1 : Écrire les tests qui échouent**

Créer `frontend/lib/freshness.test.mjs` :

```js
import assert from 'node:assert';
import { computeFreshness, estEnSeance, dernierJourOuvreAttendu } from './freshness.ts';

// Toutes les dates en UTC (la BRVM cote en GMT = UTC, Abidjan est à UTC+0).

// --- estEnSeance : lun-ven 09-16 GMT ---
assert.equal(estEnSeance(new Date('2026-07-21T10:00:00Z')), true, 'mardi 10h = en séance');
assert.equal(estEnSeance(new Date('2026-07-21T08:00:00Z')), false, 'mardi 8h = avant ouverture');
assert.equal(estEnSeance(new Date('2026-07-21T17:00:00Z')), false, 'mardi 17h = après clôture');
assert.equal(estEnSeance(new Date('2026-07-19T10:00:00Z')), false, 'dimanche = jamais en séance');
assert.equal(estEnSeance(new Date('2026-07-18T10:00:00Z')), false, 'samedi = jamais en séance');

// --- dernierJourOuvreAttendu : dernier jour de semaine <= la date ---
assert.equal(dernierJourOuvreAttendu(new Date('2026-07-19T10:00:00Z')), '2026-07-17', 'dimanche -> vendredi');
assert.equal(dernierJourOuvreAttendu(new Date('2026-07-18T10:00:00Z')), '2026-07-17', 'samedi -> vendredi');
assert.equal(dernierJourOuvreAttendu(new Date('2026-07-21T10:00:00Z')), '2026-07-21', 'mardi -> mardi');

// --- computeFreshness ---
const mardi10h = new Date('2026-07-21T10:00:00Z');

// Séance du jour à jour, collecte il y a 8 min → frais (heartbeat en séance).
let f = computeFreshness('2026-07-21T09:52:00Z', '2026-07-21', mardi10h);
assert.equal(f.etat, 'frais');
assert.ok(f.ageMinutes >= 7 && f.ageMinutes <= 9);

// Mardi 14h, collecte il y a 3h (180 min) EN SÉANCE → décrochage → perime,
// même si la séance du jour est déjà en base.
const mardi14h = new Date('2026-07-21T14:00:00Z');
f = computeFreshness('2026-07-21T11:00:00Z', '2026-07-21', mardi14h);
assert.equal(f.etat, 'perime', 'stall en séance prime sur date_marche à jour');

// Dimanche, dernière séance = vendredi, collecte vendredi 17h → frais
// (pas d'alarme le week-end : la base a bien la dernière séance attendue).
const dimanche = new Date('2026-07-19T12:00:00Z');
f = computeFreshness('2026-07-17T17:00:00Z', '2026-07-17', dimanche);
assert.equal(f.etat, 'frais', 'week-end avec la clôture de vendredi = frais');

// Mardi 8h (avant ouverture), dernière séance = lundi, collecte lundi 15h →
// recent (la séance du jour n'existe pas encore, normal).
const mardi8h = new Date('2026-07-21T08:00:00Z');
f = computeFreshness('2026-07-20T15:00:00Z', '2026-07-20', mardi8h);
assert.equal(f.etat, 'recent', 'avant ouverture, séance de la veille = recent, pas d’alarme');

// Aucune collecte tracée → inconnu.
f = computeFreshness(null, '2026-07-21', mardi10h);
assert.equal(f.etat, 'inconnu');
assert.equal(f.ageMinutes, null);

// Collecte présente mais dernière séance absente → l'état se calcule quand même.
f = computeFreshness('2026-07-21T09:52:00Z', null, mardi10h);
assert.equal(f.etat, 'frais', 'heartbeat en séance suffit sans date_marche');

console.log('✓ freshness OK');
```

- [ ] **Step 2 : Lancer pour voir échouer**

Run: `cd frontend && npx tsx --test lib/freshness.test.mjs`
Expected: FAIL — « Cannot find module './freshness.ts' ».

- [ ] **Step 3 : Écrire le module**

Créer `frontend/lib/freshness.ts` :

```ts
/**
 * Indice de fraîcheur des cours — calcul PUR.
 *
 * Trois entrées injectées, aucune horloge implicite ni requête : la page charge,
 * ce module décide. `maintenant` est un paramètre pour rendre les seuils testables.
 *
 * Le cron intraday tourne lundi-vendredi 09-15 GMT UNIQUEMENT (vérifié dans
 * intraday.yml). L'âge de collecte seul ne peut donc pas décider « périmé » :
 * le week-end il vaut légitimement ~48 h. On combine deux signaux, dans cet ordre.
 *
 * Voir docs/superpowers/specs/2026-07-24-indice-fraicheur-design.md
 */

export type EtatFraicheur = 'frais' | 'recent' | 'perime' | 'inconnu';

export interface Fraicheur {
  etat: EtatFraicheur;
  derniereSeance: string | null;    // date_marche max (YYYY-MM-DD)
  derniereCollecte: string | null;  // last_success_at intraday (ISO)
  ageMinutes: number | null;        // maintenant - derniereCollecte
}

const SEUIL_HEARTBEAT_MIN = 45;   // en séance, au-delà = plus « live »
const SEUIL_DECROCHAGE_MIN = 120; // en séance, au-delà = collecte vraiment arrêtée

/** La BRVM cote lundi-vendredi ~09-15 GMT. On tolère jusqu'à 16 h (fixing/retards). */
export function estEnSeance(maintenant: Date): boolean {
  const jour = maintenant.getUTCDay();     // 0=dim, 6=sam
  const heure = maintenant.getUTCHours();
  return jour >= 1 && jour <= 5 && heure >= 9 && heure < 16;
}

/** Dernier jour de semaine (lun-ven) à la date de `maintenant` ou avant. */
export function dernierJourOuvreAttendu(maintenant: Date): string {
  const d = new Date(Date.UTC(
    maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate(),
  ));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d.toISOString().slice(0, 10);
}

export function computeFreshness(
  derniereCollecte: string | null,
  derniereSeance: string | null,
  maintenant: Date,
): Fraicheur {
  if (!derniereCollecte) {
    return { etat: 'inconnu', derniereSeance, derniereCollecte: null, ageMinutes: null };
  }

  const ageMinutes = Math.round((maintenant.getTime() - Date.parse(derniereCollecte)) / 60000);
  const enSeance = estEnSeance(maintenant);
  const seanceAJour = derniereSeance != null && derniereSeance >= dernierJourOuvreAttendu(maintenant);

  // Ordre de priorité (voir spec §5) :
  // 1. décrochage en séance — prime sur tout, même si la séance du jour est en base.
  // 2. heartbeat en séance OU base à jour de la dernière séance attendue.
  // 3. sinon, récent.
  let etat: EtatFraicheur;
  if (enSeance && ageMinutes > SEUIL_DECROCHAGE_MIN) {
    etat = 'perime';
  } else if ((enSeance && ageMinutes <= SEUIL_HEARTBEAT_MIN) || seanceAJour) {
    etat = 'frais';
  } else {
    etat = 'recent';
  }

  return { etat, derniereSeance, derniereCollecte, ageMinutes };
}
```

- [ ] **Step 4 : Lancer pour voir passer**

Run: `cd frontend && npx tsx --test lib/freshness.test.mjs`
Expected: `✓ freshness OK`, `pass 1` / `fail 0`.

- [ ] **Step 5 : Commit**

```bash
git add frontend/lib/freshness.ts frontend/lib/freshness.test.mjs
git commit -m "feat(fraicheur): module pur computeFreshness (heartbeat en seance + base a jour)"
```

---

### Task 3 : Chargement des deux signaux

**Files:**
- Create: `frontend/lib/freshness/queries.ts`

- [ ] **Step 1 : Écrire le module de requête**

Créer `frontend/lib/freshness/queries.ts` :

```ts
import { createPublicClient } from '@/lib/supabase/public';

/**
 * Charge les deux entrées du calcul de fraîcheur, en lecture publique :
 *  - la dernière collecte intraday (vue v_fraicheur_cours) ;
 *  - la dernière séance présente (date_marche max de brvm_actions_daily).
 */
export async function loadFreshnessInputs(): Promise<{
  derniereCollecte: string | null;
  derniereSeance: string | null;
}> {
  const supabase = createPublicClient();
  const [collecteRes, seanceRes] = await Promise.all([
    supabase.from('v_fraicheur_cours').select('derniere_collecte_intraday').maybeSingle(),
    supabase.from('brvm_actions_daily').select('date_marche')
      .order('date_marche', { ascending: false }).limit(1).maybeSingle(),
  ]);
  return {
    derniereCollecte: (collecteRes.data?.derniere_collecte_intraday as string | null) ?? null,
    derniereSeance: (seanceRes.data?.date_marche as string | null) ?? null,
  };
}
```

- [ ] **Step 2 : Typecheck**

Run: `cd frontend && npx tsc --noEmit` (timeout 540000)
Expected: aucune sortie.

- [ ] **Step 3 : Commit**

```bash
git add frontend/lib/freshness/queries.ts
git commit -m "feat(fraicheur): chargement collecte intraday + derniere seance"
```

---

### Task 4 : Composant `FreshnessBadge`

**Files:**
- Create: `frontend/components/FreshnessBadge.tsx`

- [ ] **Step 1 : Écrire le composant**

Créer `frontend/components/FreshnessBadge.tsx` :

```tsx
import type { Fraicheur } from '@/lib/freshness';

/**
 * Badge de fraîcheur des cours. Non premium : la fraîcheur est un argument de
 * confiance, pas un produit. L'état 'inconnu' est affiché, jamais masqué.
 */

const STYLE: Record<Fraicheur['etat'], { point: string; texte: string }> = {
  frais:   { point: 'bg-up',    texte: 'text-up' },
  recent:  { point: 'bg-muted', texte: 'text-muted' },
  perime:  { point: 'bg-down',  texte: 'text-down' },
  inconnu: { point: 'bg-faint', texte: 'text-faint' },
};

function ageTexte(f: Fraicheur): string {
  if (f.etat === 'inconnu' || f.ageMinutes == null) return 'Fraîcheur inconnue';
  if (f.etat === 'perime') {
    const h = Math.floor(f.ageMinutes / 60);
    return h >= 1 ? `Données figées depuis ${h} h` : 'Collecte interrompue';
  }
  if (f.ageMinutes < 60) return `À jour · il y a ${Math.max(1, f.ageMinutes)} min`;
  const h = Math.floor(f.ageMinutes / 60);
  if (h < 24) return `À jour · il y a ${h} h`;
  return `Dernière séance : ${f.derniereSeance ?? '—'}`;
}

export default function FreshnessBadge({ fraicheur }: { fraicheur: Fraicheur }) {
  const s = STYLE[fraicheur.etat];
  const titre = [
    fraicheur.derniereSeance ? `Dernière séance : ${fraicheur.derniereSeance}` : null,
    fraicheur.derniereCollecte ? `Dernière collecte : ${new Date(fraicheur.derniereCollecte).toLocaleString('fr-FR')}` : null,
  ].filter(Boolean).join('\n');

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] ${s.texte}`}
      title={titre || 'Fraîcheur des cours'}
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${s.point}`} aria-hidden />
      {ageTexte(fraicheur)}
    </span>
  );
}
```

- [ ] **Step 2 : Typecheck**

Run: `cd frontend && npx tsc --noEmit` (timeout 540000)
Expected: aucune sortie.

- [ ] **Step 3 : Commit**

```bash
git add frontend/components/FreshnessBadge.tsx
git commit -m "feat(fraicheur): composant FreshnessBadge"
```

---

### Task 5 : Brancher sur la fiche action

**Files:**
- Modify: `frontend/app/actions/[code]/page.tsx`

- [ ] **Step 1 : Imports**

En tête de `frontend/app/actions/[code]/page.tsx`, après les imports existants :

```ts
import FreshnessBadge from '@/components/FreshnessBadge';
import { computeFreshness } from '@/lib/freshness';
import { loadFreshnessInputs } from '@/lib/freshness/queries';
```

- [ ] **Step 2 : Calculer la fraîcheur**

Après le garde `if (!instrument) notFound();` (ou l'équivalent qui garantit que la page rend), ajouter :

```ts
  const fInputs = await loadFreshnessInputs();
  const fraicheur = computeFreshness(fInputs.derniereCollecte, fInputs.derniereSeance, new Date());
```

- [ ] **Step 3 : Afficher le badge dans l'en-tête**

Repérer le bloc d'en-tête qui affiche le cours du jour (chercher `cours_jour` dans le JSX de l'en-tête). Juste sous le cours, insérer :

```tsx
        <FreshnessBadge fraicheur={fraicheur} />
```

- [ ] **Step 4 : Typecheck**

Run: `cd frontend && npx tsc --noEmit` (timeout 540000)
Expected: aucune sortie.

- [ ] **Step 5 : Commit**

```bash
git add "frontend/app/actions/[code]/page.tsx"
git commit -m "feat(fraicheur): badge sur l'en-tete de la fiche action"
```

---

### Task 6 : Brancher sur le ticker du dashboard

**Files:**
- Modify: `frontend/components/dashboard/DashboardTicker.tsx`

- [ ] **Step 1 : Inspecter le composant**

Lire `frontend/components/dashboard/DashboardTicker.tsx` pour repérer :
- s'il est client (`'use client'`) ou serveur ;
- où placer le badge (à côté du libellé du ticker, pas dans la bande défilante).

- [ ] **Step 2 : Passer la fraîcheur en prop**

**Si `DashboardTicker` est un composant SERVEUR** (pas de `'use client'` en tête) :
calculer la fraîcheur directement dans le composant et rendre le badge, sans
threading de prop. Ajouter en tête :

```tsx
import FreshnessBadge from '@/components/FreshnessBadge';
import { computeFreshness } from '@/lib/freshness';
import { loadFreshnessInputs } from '@/lib/freshness/queries';
```

puis, dans le corps async, avant le `return` :

```tsx
  const fIn = await loadFreshnessInputs();
  const fraicheurCours = computeFreshness(fIn.derniereCollecte, fIn.derniereSeance, new Date());
```

et rendre `<FreshnessBadge fraicheur={fraicheurCours} />` à côté du titre. Passer
alors directement au **Step 3** (ignorer le reste de ce step).

**Si `DashboardTicker` est un composant CLIENT** (`'use client'` en tête) :
ajouter une prop `fraicheur?: Fraicheur` et l'afficher via `FreshnessBadge` à côté
du titre. Modifier son appelant (la page dashboard) pour calculer `computeFreshness`
côté serveur et la passer :

Dans `frontend/app/dashboard/page.tsx`, après le chargement des données, ajouter :

```ts
  const fIn = await loadFreshnessInputs();
  const fraicheurCours = computeFreshness(fIn.derniereCollecte, fIn.derniereSeance, new Date());
```

et passer `fraicheur={fraicheurCours}` au `<DashboardTicker .../>`.

Dans `DashboardTicker.tsx`, ajouter en tête :

```tsx
import FreshnessBadge from '@/components/FreshnessBadge';
import type { Fraicheur } from '@/lib/freshness';
```

étendre les props avec `fraicheur?: Fraicheur`, et rendre, à côté du titre du ticker :

```tsx
        {fraicheur && <FreshnessBadge fraicheur={fraicheur} />}
```

- [ ] **Step 3 : Typecheck**

Run: `cd frontend && npx tsc --noEmit` (timeout 540000)
Expected: aucune sortie. Si `loadFreshnessInputs`/`computeFreshness` manquent dans `dashboard/page.tsx`, ajouter leurs imports (mêmes chemins qu'en Task 5, Step 1).

- [ ] **Step 4 : Commit**

```bash
git add frontend/components/dashboard/DashboardTicker.tsx frontend/app/dashboard/page.tsx
git commit -m "feat(fraicheur): badge sur le ticker du dashboard"
```

---

### Task 7 : Vérification finale

- [ ] **Step 1 : Tests purs**

Run: `cd frontend && npx tsx --test lib/freshness.test.mjs`
Expected: `pass 1` / `fail 0`.

- [ ] **Step 2 : Typecheck complet**

Run: `cd frontend && npx tsc --noEmit` (timeout 540000)
Expected: aucune sortie.

- [ ] **Step 3 : Sonde de fraîcheur en prod**

Via `mcp__supabase__execute_sql`, confirmer que la vue renvoie une valeur exploitable :

```sql
select derniere_collecte_intraday,
       (now() - derniere_collecte_intraday) as age
from public.v_fraicheur_cours;
```

Reporter l'âge observé et l'état qu'il produirait (utile pour vérifier qu'on n'affiche pas « périmé » à tort si la sonde tombe un week-end).

- [ ] **Step 4 : Rapport**

Indiquer : le résultat de la sonde RLS (Task 1 Step 3), l'âge de collecte observé, et le rappel que le badge apparaîtra au prochain déploiement Vercel sur le ticker et la fiche action.
