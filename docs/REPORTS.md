# Documentation — Module 6 : Rapports & Événements

Implémente le cahier des charges Module 6 (V1). Découplé du frontend : les
événements sont ingérés par un worker, le frontend ne lit que Supabase (§16).

## 1. Modèle de données (migration 0005_events.sql)

- **market_events** — un événement (communiqué, avis, info permanente,
  rapport, bulletin, publication). `dedupe_hash` (source_type+date+titre+url)
  garantit l'idempotence d'ingestion. `instrument_code` FK vers
  `brvm_instruments`. Lecture publique (RLS).
- **market_event_instruments** — pivot événement ↔ titres (relation_type :
  emetteur | concerne | secteur). Lecture publique.
- **report_snapshots** — rapports favoris/sauvegardés par utilisateur. Privé
  (RLS user_id = auth.uid()).

## 2. Ingestion des événements (scraper/src/events/)

```bash
cd scraper
npm run events:mock   # événements fictifs (dev/CI, sans brvm.org)
npm run events        # ingestion réelle depuis brvm.org
```

Pipeline (`runEvents.ts`) : fetch des pages de listing (communiqués, avis,
informations permanentes) → `parseEventList` (Cheerio) → classification du type
et sentiment heuristiques (`classify.ts`) → résolution des titres liés via le
référentiel (`resolve.ts`) → upsert idempotent events + pivot (`repository.ts`).

> ⚠️ **Calibrage** : les sélecteurs de listing dans `events/parser.ts`
> (`ITEM_SELECTORS`) et les chemins dans `runEvents.ts` (`SOURCES`) sont des
> défauts. La structure réelle des pages brvm.org doit être confirmée par
> inspection, exactement comme pour le scraper BDFIN. Le mode mock permet de
> développer tout le frontend sans cette dépendance.

## 3. Event-study simplifié (frontend/lib/eventStudy.ts, §8)

Pour chaque titre lié à un événement :
- fenêtre pré J-5→J0, jour J0, fenêtre post J0→J+5 ;
- rendement cumulé titre, rendement BRVM Composite, **rendement excédentaire**
  (titre − indice) ;
- volume moyen avant/après et variation ;
- rendements par horizon J+1, J+3, J+5, J+10 ;
- classification de réaction : positive / neutre / négative.

Lecture indicative, non assimilable à une étude académique (précisé dans l'UI).

## 4. Texte analytique automatique (frontend/lib/narrative.ts, §14)

Génère des phrases **dérivées des métriques calculées**, jamais inventées :
- instrument : « Le titre SNTS progresse de 6,2% sur 1 mois, avec un volume
  supérieur à sa moyenne, un RSI à 64 (proche d'une zone de surachat),
  traduisant un momentum positif. »
- événement : « L'événement du 14/05/2026 a été suivi d'une surperformance de
  +3,1% par rapport au BRVM Composite sur 5 séances (SNTS). »

## 5. API (route handlers Next.js)

| Endpoint | Rôle |
|---|---|
| `GET /api/events?type=&source=&code=&from=&to=&importance=` | Listing filtrable |
| `GET /api/events/[id]` | Un événement |
| `GET /api/events/instrument/[code]` | Événements d'un titre |
| `GET /api/reports/instrument/[code]?period=1M` | Rapport instrument (payload §12) |
| `GET /api/reports/event/[id]?window=5` | Rapport événementiel + impact |
| `GET /api/reports/market/daily?date=YYYY-MM-DD` | Rapport marché journalier |

Le payload rapport instrument suit §12 : `instrument`, `period`, `timeseries`,
`technicalIndicators`, `events`, `signals`, `summary`, `explanation`.

## 6. Pages (App Router)

- `/dashboard/reports` — explorer : cartes de rapports + événements récents.
- `/dashboard/reports/instrument/[code]` — graphe cours+MA+volume, RSI,
  timeline événements, signaux, résumé analytique, sélecteur de période.
- `/dashboard/reports/events` — listing filtrable (type/source/code).
- `/dashboard/reports/events/[id]` — fiche événement + EventImpactCard
  (avant/après, excédent vs BRVMC, Δ volume, horizons).
- `/dashboard/reports/market/daily` — snapshot de séance (indices, top movers,
  plus actifs, breadth, événements du jour).

Composants : `EventTimeline`, `EventImpactCard`, `ReportSummaryCard`
(réutilisent `PriceChart` / `IndicatorCharts` du module Actions).

## 7. Fallback (§16)

Toutes les pages gèrent l'absence de données (base vide, aucun événement) avec
un message invitant à lancer l'ingestor. Les données publiques (marché,
événements) sont lisibles sans authentification ; seuls les `report_snapshots`
exigent une session.

## 8. Limites / suite (V2-V3)

- Rapport secteur, comparaison multi-titres avancée, export PDF, rapports
  sauvegardés (report_snapshots est prêt côté base).
- Analyse de sentiment réelle (actuellement heuristique mots-clés).
- Corrélation événements/signaux, alertes intelligentes, narration avancée.

## 9. Module 6 V2 (livré)

- **Rapport secteur** (`/dashboard/reports/sector/[sector]`, API
  `/api/reports/sector/[sector]`) : performance par titre, meilleurs/pires,
  dispersion des rendements, événements sectoriels, graphique comparatif.
  Accès via les chips secteurs sur la page d'accueil des rapports.
- **Export PDF / lien partageable** : `ExportReportButton` utilise
  l'impression navigateur (`window.print`) avec une feuille de style
  d'impression (`@media print` masque sidebar et éléments `.no-print`). Le lien
  de la page est partageable tel quel. Une génération PDF serveur (puppeteer)
  reste une option V3.
- **Rapports sauvegardés** (`report_snapshots`) : bouton ★ Sauvegarder sur le
  rapport instrument (params `{code, period}`), section « Mes rapports » sur la
  page d'accueil (auth requise, RLS par utilisateur).

## 10. Marché obligataire (§5.3)

Page `/obligations` + lib `frontend/lib/bonds.ts` (testée) :

- **YTM** par bisection (robuste, plage 0–100%), **duration de Macaulay** et
  **duration modifiée**, prix théorique.
- **Hypothèses** (documentées car BDFIN ne détaille pas toutes les
  caractéristiques) : valeur nominale 10 000 FCFA, coupon annuel = taux nominal,
  fréquence 1/an, maturité en années = (date maturité − aujourd'hui)/365,25.
  Toutes ajustables dans `BondInputs`.
- **Courbe des taux** (`YieldCurveChart`) : YTM vs maturité, une série par
  émetteur.
- **Comparatif obligation vs rendement dividende actions** : le côté
  obligataire (YTM) est fourni ; le rendement dividende des actions nécessite
  l'ingestion des dividendes (brique future §6.8) — signalé honnêtement dans
  l'UI plutôt qu'inventé.
