# Documentation — Algorithme de scoring (§9 & §6.7)

Code : `scraper/src/scoring/` — `indicators.ts`, `score.ts`, `runScoring.ts`.
Tests : `scraper/tests/scoring.test.ts`.

## 1. Formule

```
score = 0.3 · variation_norm
      + 0.4 · volume_signal
      + 0.3 · rsi_signal
      + bonus_tendance
      − penalite_liquidite
```

Le score est plafonné dans **[-1, 1]**. Décision :

| Condition | Signal |
|---|---|
| score > 0.6  | **BUY** |
| score < -0.6 | **SELL** |
| sinon         | **HOLD** |

Tous les paramètres sont centralisés dans `SCORING_PARAMS` (`score.ts`) pour un
calibrage simple.

## 2. Sous-scores (chacun borné [-1, 1])

**variation_norm** — momentum du jour, plafonné pour neutraliser les outliers :
`clamp(variation_pct / VAR_CAP_PCT, -1, 1)` avec `VAR_CAP_PCT = 5 %`.

**volume_signal** — confirmation directionnelle, lissée :
on calcule `volume_ratio = volume / moyenne_30j`, on le lisse via
`tanh(ln(ratio))` (écrase les pics), puis on lui applique le **signe de la
variation** du jour. Un volume élevé renforce le sens du mouvement ; un volume
faible le tempère. Volume nul/inconnu ⇒ sous-score absent (compte 0).

**rsi_signal** — logique de **retour à la moyenne** (mean reversion) :
`clamp((50 − RSI) / RSI_BAND, -1, 1)` avec `RSI_BAND = 20`. Survente
(RSI bas) ⇒ contribution acheteuse ; surachat (RSI haut) ⇒ vendeuse. RSI de
Wilder sur 14 périodes.

## 3. Ajustements (améliorations §9)

- **Bonus tendance** : `+0.1` si `MA20 > MA50` (tendance haussière confirmée).
- **Pénalité de liquidité** : si la moyenne de volume 30j est sous
  `MIN_LIQUIDITY_AVG_VOLUME` (défaut 100), pénalité proportionnelle au déficit,
  plafonnée à `PENALITE_LIQUIDITE_MAX` (0.25).
- **Plafonnement des outliers** : via les `clamp` ci-dessus.
- **Lissage du volume** : transformation logarithmique + tanh.
- **Neutralisation** : si l'historique < `MIN_HISTORY` (15 séances), ou si la
  variation ou le RSI manquent, le signal est forcé à **HOLD** avec une
  confiance ≤ 0.3.

## 4. Explicabilité (§6.7)

`computeScore` renvoie un objet complet, persisté dans `signals_daily` :

- `score_total` et les **sous-scores** (`score_variation`, `score_volume`,
  `score_rsi`), `bonus_tendance`, `penalite_liquidite` ;
- `confiance` ∈ [0, 1] = 0.5·complétude des entrées + 0.3·richesse de
  l'historique + 0.2·netteté du score ;
- `explication` : texte lisible (« Opportunité acheteuse. Facteurs : RSI 28
  (survente, signal acheteur) ; volume 5.0x la moyenne (activité anormale) ;
  tendance haussière (MA20 > MA50). ») ;
- `inputs` (jsonb) : valeurs brutes ayant produit le signal (RSI, MA20, MA50,
  volume_ratio, longueur d'historique…), pour audit et affichage « Pourquoi ce
  signal ? ».

## 5. Exécution

```bash
cd scraper
npm run score           # signaux de la dernière séance -> signals_daily
npm run score:mock      # démonstration hors-ligne (séries synthétiques)
npm run score -- 2025-05-20   # date précise (voir limite ci-dessous)
```

Pipeline (`runScoring.ts`) : lit `mv_signal_inputs` (volume moyen 30j joint à la
séance), récupère jusqu'à 120 clôtures par titre, calcule, puis upsert
idempotent dans `signals_daily` par `(code, date_marche)`.

## 6. Limites connues / pistes

- `mv_signal_inputs` ne matérialise que **la dernière séance**. Le scoring d'une
  **date passée** précise utilise donc la moyenne de volume courante ; pour un
  backfill historique fidèle des signaux, requêter `brvm_actions_daily`
  directement et recalculer la moyenne 30j à la date cible.
- MACD n'est pas encore intégré au score (RSI + MA seulement) ; l'ajouter comme
  sous-score supplémentaire est trivial (pondérations dans `SCORING_PARAMS`).
- Les seuils (0.6 / -0.6) et pondérations sont des valeurs initiales du cahier
  des charges : à calibrer/back-tester sur l'historique réel BRVM.
