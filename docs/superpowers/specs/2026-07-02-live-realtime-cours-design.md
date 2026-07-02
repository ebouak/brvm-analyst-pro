# Le live vraiment live — cours BRVM en temps réel (Supabase Realtime)

**Date :** 2026-07-02
**Statut :** approuvé (« go »)
**Piste WAOUH :** 1/5 (temps réel)

## 1. Contexte & objectif

Aujourd'hui les cours affichés (ticker landing, dashboard) sont figés au rendu
SSR/ISR : un onglet ouvert n'affiche la nouvelle donnée qu'après revalidation
(jusqu'à 5 min) ou un F5 manuel. Le cron intraday écrit dans
`brvm_actions_daily` toutes les ~15 min.

**Objectif :** dès qu'une nouvelle donnée arrive en base, la faire apparaître
**instantanément** sur les onglets déjà ouverts (sans reload), avec un flash
vert/rouge bref sur la valeur qui change → sensation « live ».

**Hors scope (décidé) :** un vrai flux tick-by-tick (secondes). La fréquence
des cours reste celle du cron intraday (15 min) ; Realtime ne change QUE la
latence d'affichage (de « jusqu'à 5 min » à « immédiat »), pas la fraîcheur de
la donnée elle-même. Pas de nouvelle source de données.

## 2. Périmètre (décidé)

- **Landing** (`app/page.tsx`, `revalidate=300`) : ticker `TasteTopbar` + carte
  « séance en direct » (movers) + indices.
- **Dashboard** (`app/dashboard/page.tsx`, `force-dynamic`) : `DashboardTicker`
  + indices.
- PAS la fiche société individuelle (`/societes/[code]`) dans cette itération
  (candidate pour une v2).

## 3. Architecture

Le premier rendu reste **inchangé** (SSR/ISR fournit la donnée correcte au
chargement). Realtime est une **surcouche progressive** : si l'abonnement
échoue (websocket coupé, RLS, quota), la page fonctionne exactement comme
aujourd'hui — aucune régression.

### 3.1 Infra Supabase (migration `0066`)
- `brvm_actions_daily` et `brvm_indices_daily` ne sont dans **aucune**
  publication Realtime (vérifié serveur : `supabase_realtime` est vide, Realtime
  inactif partout sur ce projet).
- Migration : `alter publication supabase_realtime add table
  public.brvm_actions_daily, public.brvm_indices_daily;`
- RLS déjà correcte : les deux tables ont une policy `SELECT` publique
  (vérifié) → l'abonnement via la clé anon fonctionne sans changement de policy.
  Realtime respecte la RLS du rôle du client.

### 3.2 Logique de merge (pure, testable)
`frontend/lib/realtime/mergeActions.ts` :
- `mergeActionRow(rows: ActionRow[], change: ActionRow): { rows, changed }` —
  remplace la ligne de même `code` (ou l'ajoute), renvoie le nouveau tableau +
  un flag/direction du changement (`up`/`down`/`none`) dérivé de la comparaison
  de `cours_jour` (ou `variation_pct`) avant/après. Fonction pure → tests vitest.
- Ne fait AUCUN I/O : reçoit un événement déjà parsé, renvoie le nouvel état.

### 3.3 Hook d'abonnement (I/O, mince)
`frontend/lib/realtime/useRealtimeActions.ts` (client) :
- `useRealtimeActions(initialRows, { dateMarche })` → `{ rows, flashes }`.
- S'abonne à un canal `postgres_changes` (`event: '*'`, `schema: 'public'`,
  `table: 'brvm_actions_daily'`, `filter: date_marche=eq.<jour>`).
- À chaque événement : applique `mergeActionRow`, déclenche un flash transitoire
  (Map code→direction, effacé après ~600ms).
- Nettoyage : `supabase.removeChannel` au démontage.
- **Fallback focus** : à `visibilitychange`/`focus` de l'onglet, re-fetch une
  fois la séance courante (les navigateurs coupent les websockets en veille).
- Client Supabase navigateur existant (`lib/supabase/client`).

### 3.4 Présentation
- Composant `FlashValue` (client) : affiche une valeur numérique et joue une
  transition de fond vert/rouge (150–300ms, `transform`/`opacity` + couleur,
  `@media (prefers-reduced-motion: reduce)` → pas d'animation, juste la valeur).
- `TasteTopbar`, carte séance live, `DashboardTicker`, indices : passent de
  props statiques à `initialRows` + hook. Le SSR fournit `initialRows`.

## 4. Composants / fichiers

| Fichier | Rôle |
|---|---|
| `supabase/migrations/0066_realtime_cours.sql` | ajoute les 2 tables à la publication |
| `frontend/lib/realtime/mergeActions.ts` | merge pur + direction du flash (testé) |
| `frontend/lib/realtime/mergeActions.test.ts` | tests vitest du merge |
| `frontend/lib/realtime/useRealtimeActions.ts` | hook d'abonnement (client, I/O) |
| `frontend/components/ui/FlashValue.tsx` | valeur avec flash vert/rouge (reduced-motion OK) |
| `frontend/components/landing/taste/TasteTopbar.tsx` | branché sur le hook |
| `frontend/components/dashboard/DashboardTicker.tsx` | branché sur le hook |
| (landing `app/page.tsx` / dashboard) | passent `initialRows` aux composants |

## 5. Gestion d'erreur & limites (documentées)

- **Fail-safe** : abonnement optionnel — toute erreur Realtime laisse la page
  dans son état SSR (jamais d'écran cassé).
- **Coût** : websockets persistants = connexions simultanées facturées côté
  Supabase. À surveiller si le trafic monte ; acceptable au trafic actuel.
- **Veille d'onglet mobile** : websocket coupé par le navigateur → fallback
  re-fetch au focus (pattern standard).
- **Honnêteté des données** : Realtime ne fabrique aucune donnée — il ne fait
  que retransmettre ce que le cron écrit. Le flash reflète un vrai changement
  de la base, jamais simulé.

## 6. Tests

- `mergeActions.test.ts` : remplacement par code, ajout d'un code absent,
  direction up/down/none selon la variation, immutabilité de l'entrée.
- Vérif manuelle : après build, un `UPDATE` de test sur `brvm_actions_daily`
  (via Management API) doit flasher l'onglet ouvert (test d'acceptation).
- `tsc` + `npm run build` verts ; pages gèrent l'état vide (déjà le cas).

## 7. Séquencement

1. Migration 0066 (publication) — socle.
2. `mergeActions` pur + tests.
3. Hook `useRealtimeActions` + `FlashValue`.
4. Branchement landing (ticker + séance live + indices).
5. Branchement dashboard (ticker + indices).
6. Build + test d'acceptation (UPDATE → flash).
