# Cours quasi temps réel (intraday) — Design

**Date :** 2026-06-09
**Statut :** validé en brainstorming.

## Problème

Les cours en base s'arrêtent à la dernière clôture officielle (source BDFIN, post-séance, lancée manuellement). Pas de rafraîchissement en cours de séance. Les identifiants BDFIN sont absents. Objectif : rafraîchir les cours toutes les ~15 min pendant la séance, gratuitement.

## Décisions (validées)

| Axe | Décision |
|---|---|
| Source | **brvm.org public** `https://www.brvm.org/fr/cours-actions/0` (tableau « Activités du marché ») — testé, sans login |
| Cible | **Upsert dans `brvm_actions_daily`** sur `(code, date_marche)` du jour |
| Planificateur | **GitHub Actions** cron, lun-ven 09:00–15:30 UTC, toutes les 15 min |
| Localisation | Dans **scraper/** (le frontend ne lit que Supabase) |

## Source — structure vérifiée

Le tableau « Activités du marché » de brvm.org expose les colonnes :
`Symbole | Nom | Volume | Cours veille (FCFA) | Cours Ouverture (FCFA) | Cours Clôture (FCFA) | Variation (%)`.
Un horodatage « mise à jour : … » est présent. Les ~47 actions y figurent. Tickers dans des `<td>` (ex. `<td>PALC</td>`).

## Architecture

1. **Parser brvm.org** (`scraper/src/scrapers/brvmPublic.ts`) : fetch la page, parse le tableau « Activités du marché » par **libellé de colonne** (jamais par index), renvoie un `MarketSnapshot` (actions seulement ; obligations/indices vides).
2. **Runner** (`scraper/src/scrapers/runIntraday.ts`) : appelle le parser puis `upsertActions(snapshot)` (persistence existante). En mode `--mock`, lit une fixture HTML locale.
3. **Commande CLI** : `intraday` dans `scraper/src/index.ts` + scripts `npm run intraday[:mock]`.
4. **GitHub Actions** (`.github/workflows/intraday.yml`) : cron, installe les deps de `scraper/`, lance `npm run intraday` avec secrets `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.

### Mapping colonnes → `ActionRow`

| brvm.org | ActionRow |
|---|---|
| Symbole | `code` |
| Nom | `designation` |
| Cours veille | `cours_precedent` |
| Cours Clôture | `cours_jour` (= dernier cours en séance) |
| Variation (%) | `variation_pct` |
| Volume | `volume` |
| — | `pays`, `secteur`, `nb_transactions`, `valeur_echangee` = null |

`date_marche` = date du jour (timezone `Africa/Abidjan`). À chaque run intraday, la ligne du jour est écrasée par le dernier cours → à la clôture, dernière valeur = clôture officielle. Historique : 1 ligne/jour.

## Robustesse

- Si la page est indisponible (HTTP ≠ 200) ou aucune ligne parsée → **no-op**, log d'erreur, pas d'écriture. Sortie non-zéro pour visibilité GitHub Actions.
- Parsing tolérant : nombres FR via `utils/parseNumber` existant (espaces insécables, virgule décimale).
- `is_mock` / `hash_source` renseignés comme les autres snapshots.
- Idempotent : relancer dans la même minute réécrit la même ligne (clé `code,date_marche`).

## Tests

- **Pur (vitest scraper)** : le parser sur une **fixture HTML** brvm.org (extrait réel) → vérifie que ≥ 40 actions sont extraites, qu'un ticker connu (PALC) a un `cours_jour` numérique, mapping veille/clôture/variation/volume correct.
- **Mock run** : `npm run intraday:mock` produit un snapshot non vide sans réseau.

## Hors périmètre (YAGNI)

- Granularité tick (courbe intraday) — on n'écrit qu'1 ligne/jour.
- Obligations/indices intraday.
- Détection fine de l'ouverture/fermeture de séance côté code (le cron GitHub la borne déjà).
