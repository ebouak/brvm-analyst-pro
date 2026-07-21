# Liquidité v2 — score reconstitué depuis les échanges

**Date** : 2026-07-19 · **Statut** : approuvé (brainstorming)
**Décisions utilisateur** : usages = les 3 (moteur unifié + affichage enrichi + page dédiée) ; carnet d'ordres = spread implicite maintenant, spike Richbourse en phase 2 séparée ; architecture A validée (moteur pur scraper + table quotidienne).

## 1. Problème

Deux logiques de liquidité coexistent sans se parler :

- `frontend/lib/liquidity.ts` : score 0-100 = présence (50 %) + activité en valeur (50 %). Ignore l'impact prix, le coût d'exécution et le sens des échanges.
- `scraper/src/scoring/score.ts` : pénalité de liquidité à part, basée sur le seul volume moyen 30 j en titres (pas en FCFA), divergente du score frontend.

Données inexploitées : `brvm_intraday_snapshots` (cours + volume cumulé toutes les 15 min en séance, ~11 000 lignes et +500/jour) permet de reconstituer *quand* le volume passe et dans quel sens (achat/vente par tick rule). Le carnet d'ordres BRVM n'est pas publié : la profondeur doit être estimée, jamais inventée.

## 2. Objectif

Un seul moteur de liquidité, calculé chaque séance, qui alimente :
1. la fiche action et le screener (affichage enrichi),
2. la pénalité de liquidité du scoring signaux (unification),
3. une page dédiée `/liquidite` classant tous les titres avec historique.

## 3. Score v2 — définition

**Score 0-100, quatre composantes à 25 % chacune** (classes A ≥ 75, B ≥ 50, C ≥ 25, D sinon — inchangées) :

| Composante | Mesure | Source | Échelle |
|---|---|---|---|
| Présence | % de séances traitées (volume > 0) sur 30 séances de marché | `brvm_actions_daily` | linéaire 0-100 % |
| Activité | valeur moyenne échangée par séance | idem | log 100 k → 100 M FCFA (existant conservé) |
| Impact prix (Amihud) | moyenne de \|variation %\| / valeur échangée (M FCFA), séances traitées | idem | log inversée : impact faible = liquide. Bornes calibrées sur la distribution réelle des 47 titres au premier calcul, figées ensuite dans le code |
| Spread implicite (Roll) | 2·√(−cov(Δp_t, Δp_{t−1})) sur les clôtures 30 j, en % du cours | idem | inversée : spread étroit = liquide. Si cov ≥ 0 (spread non estimable), composante neutre à 0,5 — documenté dans l'explication |

**Règles d'honnêteté** :
- Moins de 10 séances d'historique → score `null` (« données insuffisantes »), jamais de score par défaut.
- Titre jamais traité sur la période → présence 0, activité 0, Amihud au pire, Roll neutre → classe D naturelle.

**Indicateur séparé « flux acheteur/vendeur »** (directionnel, PAS dans le score) :
- Tick rule sur les deltas des snapshots intraday d'une séance : volume passé sur cours en hausse vs dernier fixing = flux acheteur ; en baisse = vendeur ; inchangé = neutre.
- Sortie : `volume_achat`, `volume_vente`, `volume_neutre`, `flux_net_pct` (−100 à +100).
- Pas de snapshots pour la séance → `null` (affiché « — »), pas d'invention.

## 4. Architecture

### 4.1 Migration `0111_liquidity_daily.sql`

```
liquidity_daily (
  code text, date_marche date,            -- PK (code, date_marche), upsert idempotent
  score int null, classe text null,       -- null si données insuffisantes
  presence_pct numeric, activite numeric, amihud numeric null, spread_roll_pct numeric null,
  valeur_moyenne_30j numeric, seances_traitees int, seances_marche int,
  volume_achat bigint null, volume_vente bigint null, volume_neutre bigint null, flux_net_pct numeric null,
  engine_version text, created_at, updated_at
)
```

RLS activée + policy lecture publique (donnée de marché, comme `brvm_actions_daily`) ; insert/update/delete révoqués pour `anon` ET `authenticated` (discipline pentest §11 : test curl anon après application, scan advisors).

### 4.2 Module `scraper/src/liquidity/` (pattern `scoring/`)

- `compute.ts` — **pur, testé** : `computeLiquidityV2(rows30j, opts)` → score + 4 sous-composantes. Contient Amihud, Roll, échelles.
- `flow.ts` — **pur, testé** : `computeSessionFlow(snapshots)` → flux achat/vente par tick rule (deltas de volume ordonnés par `captured_at`).
- `runLiquidity.ts` — orchestration : charge 30 dernières séances (`brvm_actions_daily`) + snapshots de la dernière séance, calcule, upsert `liquidity_daily`. Supporte `--mock`, `DRY_RUN`, instrumenté `withMonitoring` (source `liquidity`).
- CLI : `case 'liquidity'` dans `index.ts` + script npm `liquidity[:mock]`.
- Cron : job ajouté à `.github/workflows/score.yml` (après le scoring, même déclencheur quotidien post-clôture) — pas de nouveau workflow.

### 4.3 Unification scoring signaux

`score.ts` : la pénalité devient `PENALITE_LIQUIDITE_MAX × (1 − score_v2/100)` appliquée seulement si classe C ou D (score < 50). `runScoring` lit `liquidity_daily` du jour ; si la ligne manque (démarrage, panne), **fallback sur l'ancienne règle volume 30 j** — jamais de scoring bloqué. L'explication du signal mentionne la classe (« liquidité C — pénalité appliquée »).

### 4.4 Frontend

- `lib/liquidity.ts` : conserve `classifyLiquidity`/labels/types ; ajoute `loadLiquidity(codes)` qui lit `liquidity_daily` (dernière séance) avec **fallback sur le calcul legacy** (`computeLiquidity`) si la table est vide pour un code — transition sans trou.
- **LiquidityCard v2** (fiche action) : score + classe (existant) + 4 sous-jauges + barre bicolore flux achat/vente du jour + « coût d'aller-retour estimé ≈ X % (Y FCFA sur un ordre de 500 000) » depuis le spread Roll. États vides gérés (« — » si flux/spread indisponibles).
- **Screener** : lit v2 (aucun changement visuel).
- **Page `/liquidite`** (app authentifiée, nav groupe Analyse) : tableau des 47 titres (score, classe, valeur moyenne, spread estimé, flux net du jour), tri + filtre par classe, sparkline du score 30 j (l'historique s'accumule dans la table), encart méthodologie (formules, limites, « pas de carnet d'ordres publié — spread estimé par Roll »). Empty state si table vide.

## 5. Tests

- `compute.test.ts` : Amihud (titre liquide vs illiquide), Roll (série alternante → spread > 0 ; tendance pure cov ≥ 0 → neutre), bornes d'échelle, < 10 séances → null, titre jamais traité → D.
- `flow.test.ts` : tick rule (hausse → achat, baisse → vente, plat → neutre), volume cumulé non monotone (correction séance) → delta clampé à 0, snapshots vides → null.
- Frontend : fallback legacy testé (`.test.mjs`).
- Vérifs habituelles : `npm test` scraper, `tsc`, build, curl anon sur `liquidity_daily` après migration.

## 6. Hors scope (phase 2)

- **Spike carnet Richbourse — CONCLU le 2026-07-21 : NON-GO.** Aucune source
  gratuite ne publie le carnet d'ordres (meilleures limites bid/ask, quantités
  en attente, profondeur). Vérifié sur trois fronts :
  - Richbourse public (`/common/mouvements/index/<code>`, déjà scrapé sans auth)
    → OHLC, volume, valeur, capitalisation. Pas de bid/ask.
  - brvm.org public (`/fr/cours-actions/0`, source de notre cron intraday)
    → symbole, nom, volume, cours veille/ouverture/clôture, variation. Pas de carnet.
  - Le **Carnet d'Ordres Central** de la BRVM est bien diffusé en temps réel,
    mais aux **destinataires agréés** (SGI, terminaux de données payants), pas
    sur une page web librement accessible. Le scraper viserait une donnée
    licenciée → risque CGU/juridique, hors de question.
  - **Conséquence** : l'estimation de la profondeur par Amihud + du coût par
    Roll (approche v2/v3) reste la seule voie honnête. Décision confirmée, pas
    un pis-aller. Rouvrir uniquement si WESTBOURSE devient destinataire agréé
    d'un flux BRVM (partenariat SGI / abonnement data), ce qui relèverait alors
    d'un tout autre projet (feed temps réel, pas scraping).
- `nb_transactions` par titre : non publié par brvm.org ; à récupérer via BDFIN si la source est réactivée.
- Intégration du flux achat/vente dans le Diagnostic IA et le Brief.
