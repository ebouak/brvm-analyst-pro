# Corrélation Matières Premières — analyse macro & vraies données

**Date :** 2026-06-13
**Objectif :** remplacer la corrélation fictive par une vraie corrélation entre
les actions agro BRVM et les prix réels des matières premières sous-jacentes,
avec une lecture macro (méthodes d'analyste matières premières) et l'actualité /
les publications des sociétés agro.

## Problèmes constatés

1. **Bug données** : la page lit `cours_cloture` (colonne inexistante ; la vraie
   est `cours_jour`) → écran vide.
2. **Fond malhonnête** : `synthCommodity()` fabrique la série « matière première »
   à partir du cours de l'action (corrélation ~0,65 imposée + bruit). La
   corrélation affichée est circulaire et fictive — contraire à « ne jamais
   inventer ». À supprimer.
3. Aucune table de prix de matières premières en base.

## Décisions (brainstorming)

- Source : **World Bank Pink Sheet** (mensuel, gratuit, sans clé) — référence
  des analystes. Vérifié : téléchargeable, feuille « Monthly Prices ».
- Couche **complète** : corrélation réelle + macro + actualité agro.

## Données source (vérifié)

Fichier `CMO-Historical-Data-Monthly.xlsx`, feuille « Monthly Prices » :
en-têtes ligne 4, unités ligne 5, données dès ligne 6 ; colonne 0 = date
`YYYYMmm`. Colonnes par **libellé** (pas index fixe) :
- Cocoa ($/kg) → CFAC
- Palm oil ($/mt) → PALC, SOGC
- Sugar, world ($/kg) → STAC, SUCR
- Rubber, TSR20 ($/kg) → SAPH, SOGB

## Architecture

```
supabase/migrations/0038_commodity_prices.sql   (table commodity_prices)
scraper/src/commodities/worldBankPinkSheet.ts    (download + parse xlsx)
scraper/src/commodities/runCommodities.ts        (runner + mock)
scraper/src/index.ts                             (commande `commodities`)
scraper (dep) xlsx (SheetJS, lecture seule)
frontend/lib/premium/correlations.ts             (réécriture : vraies données)
frontend/lib/premium/agroMacro.ts                (lecture macro + impact marges)
frontend/lib/premium/*.test.ts                   (vitest : Pearson glissant, macro)
frontend/components/premium/CorrelationsCharts.tsx (affichage enrichi)
frontend/app/premium/correlations/page.tsx       (macro + news agro)
```

### Table `commodity_prices`

```sql
commodity text, date date, price numeric, unit text, source text default 'worldbank_pinksheet'
PRIMARY KEY (commodity, date)
```
RLS : lecture publique (anon SELECT), écriture service_role.

### Parser Pink Sheet (par libellé)
Cherche dans la ligne d'en-têtes les colonnes contenant « cocoa », « palm oil »,
« sugar, world », « rubber, tsr20 ». Convertit `YYYYMmm` → `YYYY-MM-01`. Ignore
les `…`. Renvoie `{ commodity, date, price, unit }`.

### Corrélation réelle (`correlations.ts`)
Mapping action→commodity documenté. Pour chaque filière :
- série mensuelle de l'action (moyenne des clôtures par mois, `cours_jour`) ;
- série mensuelle de la matière (`commodity_prices`) alignée sur les mêmes mois ;
- **Pearson** sur les variations mensuelles (rendements), pas les niveaux
  (best practice : éviter les corrélations fallacieuses de tendance) ;
- **corrélation glissante 12 mois** + coefficient global + **beta** (sensibilité
  du cours de l'action à la matière) ;
- état vide honnête si pas de données matière (pas de série fabriquée).

### Macro (`agroMacro.ts`)
Pour chaque filière : variation du sous-jacent sur 3 / 12 mois, tendance, et
lecture d'impact sur les marges (hausse du prix de la matière → marge favorable
pour le producteur ; à pondérer par le sens de la corrélation observée).

### Actualité agro
Agrégation des `publications` + `market_events` filtrés sur les codes agro
(PALC, SOGC, SAPH, SOGB, STAC, SUCR, CFAC), triés par date récente.

## Flux
Cron mensuel (`commodities`) → `commodity_prices`. Page premium lit Supabase
(actions + commodity_prices + publications/events), calcule au rendu.

## États limites
- Pas de prix matière → filière en « données indisponibles » (jamais fabriquer).
- < 6 mois communs → coefficient non calculé (« historique insuffisant »).

## Tests (vitest)
- Pearson sur rendements (signe et magnitude attendus).
- Corrélation glissante (fenêtre 12).
- Lecture macro (tendance hausse/baisse → message attendu).
