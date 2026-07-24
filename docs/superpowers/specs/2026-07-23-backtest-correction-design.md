# Backtest — correction de l'algorithme et de la fraîcheur des données

**Date** : 2026-07-23
**Statut** : approuvé, prêt pour plan d'implémentation
**Nature** : correction de défauts, pas nouvelle fonctionnalité

## 1. Ce qui ne va pas

Audit de `frontend/lib/backtest.ts` (246 lignes) et de `frontend/app/backtest/page.tsx`.
Six défauts, dont trois faussent les chiffres de façon significative — tous dans
le même sens : à la hausse.

### 1.1 Biais de look-ahead (grave)

`lib/backtest.ts:110-139`. Le signal du jour `i` est calculé à partir de la
clôture du jour `i`. La position s'ouvre à la ligne 111, puis la ligne 138 crédite
le rendement `i-1 → i` — celui-là même qui a déclenché le signal.

La stratégie encaisse une journée qu'elle ne pouvait pas trader. Le défaut est
symétrique à la vente : `inPosition` passe à `false` **avant** le calcul du
rendement, donc la baisse du jour de vente est esquivée. Entrée et sortie sont
toutes deux avantagées.

### 1.2 Les frais n'atteignent jamais la courbe d'equity (grave)

`entryPrice` et `exitPrice` intègrent frais et slippage, et `Trade.returnPct` est
net. Mais l'equity progresse sur `(closes[i] - closes[i-1]) / closes[i-1]`, brut.

Conséquence : `totalReturn`, `annualizedReturn`, `sharpeRatio`, `sortinoRatio`,
`calmarRatio` et `maxDrawdown` **ignorent les frais saisis par l'utilisateur**,
tandis que `winRate` et `avgWinPct` les intègrent. Deux moitiés du même résultat
se contredisent.

### 1.3 Troncature silencieuse à 1000 séances (grave)

`app/backtest/page.tsx:128-155`. Aucune des trois requêtes n'utilise `.range()`.
PostgREST plafonne toute réponse à 1000 lignes : un backtest sur plusieurs années
porte en réalité sur les 1000 premières séances, sans le signaler.

C'est la même classe de défaut que celui corrigé dans le moteur de liquidité
(pagination absente, troncature invisible).

### 1.4 Signaux réels et synthétiques mélangés

`signalMap.get(d) ?? fallback[i]` complète les trous par un signal technique de
repli, et `hasRealSignals` vaut `true` dès qu'**une seule** date porte un signal
réel. L'interface annonce « signaux réels » sur une série pouvant être
majoritairement synthétique.

### 1.5 Annualisation en 252 séances

`Math.pow(finalEquity / 100, 252 / n)` où `n` est le nombre de points de données,
pas le temps écoulé. Sur la BRVM, un titre peut coter 40 fois dans l'année : la
formule est alors sans rapport avec la réalité. Même défaut sur la volatilité
(`× √252`).

### 1.6 Dénominateurs incohérents

`winRate = winningTrades / closedTrades` exclut la position encore ouverte en fin
de période, alors que `avgWinPct`, `bestTradePct` et `worstTradePct` se calculent
sur `trades[]`, qui l'inclut.

### 1.7 Duplication du moteur

`scraper/src/backtesting/runBacktest.ts` est une seconde copie du moteur. Les deux
ont **divergé** : le scraper protège la division par zéro (`prev !== 0`), le
frontend non ; le frontend applique les frais, le scraper pas du tout. Chaque
copie porte des défauts que l'autre n'a pas — illustration du coût de la copie.

Les autres modules ne sont **pas** des moteurs : `backtest-adapter.ts` et
`backtest-formatters.ts` font de la présentation, `premium/backtesting.ts` et
`signals/backtest.ts` chargent des données et ne recalculent aucune performance.

## 2. Décisions de cadrage

| Question | Décision |
|---|---|
| Périmètre | Les 6 défauts **et** l'unification |
| Unification | **Supprimer** le moteur scraper et sa commande CLI |
| Exécution des ordres | **Au fixing suivant** : signal au jour `i`, exécution au jour `i+1` |
| Titres illiquides | Annualisation calendaire + **avertissement** sous 60 séances, ratios affichés |

Justification de la suppression : la commande CLI `backtest <CODE>` n'est appelée
par **aucun workflow cron**, duplique une fonctionnalité d'exploration
interactive, et sa copie est plus fausse encore (aucun frais). `backtest-signals`
est une chose différente — statistiques de signaux — et reste intact.

Justification du fixing suivant : on ne peut pas acheter à un cours qui est
lui-même l'entrée de la décision. La BRVM ne publiant pas d'ouverture
(`CLAUDE.md` §9), « acheter à l'ouverture du lendemain » est impossible ; le
fixing suivant est la convention réaliste.

## 3. Le moteur corrigé

La boucle est restructurée en trois temps, dans cet ordre strict :

```
pour chaque séance i :
  a) rendement du jour, selon la position détenue DEPUIS LA VEILLE
     equity *= (1 + dayReturn)

  b) exécution de l'ordre décidé la veille, à la clôture d'aujourd'hui
     equity *= (1 − frais − slippage)

  c) le signal d'aujourd'hui devient l'ordre de demain
```

Un `ordreEnAttente: 'BUY' | 'SELL' | null` porte le délai d'exécution d'une
séance. L'ordre des trois temps corrige à lui seul 1.1 et 1.2 : le rendement du
jour ne dépend que d'une position ouverte **avant** ce jour, et les frais,
appliqués multiplicativement à l'exécution, entrent dans toutes les métriques
dérivées de l'equity.

### Cas limites du délai d'exécution

Deux situations que le délai d'une séance rend possibles, tranchées ici pour
qu'elles ne le soient pas au hasard :

- **Signal sur la dernière séance** : l'ordre ne peut jamais s'exécuter. Il est
  simplement abandonné — aucun trade n'est ouvert ni fermé. Un backtest ne doit
  pas inventer une exécution qui n'aurait pas eu lieu.
- **Signal contraire avant exécution** : ce cas est **inatteignable par
  construction**, ce que la rédaction initiale de cette spec affirmait à tort.
  L'exécution (étape b) précède l'enregistrement du signal du jour (étape c),
  donc tout ordre en attente s'exécute — ou est abandonné — dès la séance
  suivante, avant qu'un signal contraire puisse le remplacer. Un ordre ne survit
  jamais plus d'une séance. Constaté à l'implémentation par un test qui échouait
  sur une attente fausse ; le test conserve cette propriété structurelle.

### Annualisation calendaire

```ts
const joursEcoules = (Date.parse(derniereDate) - Date.parse(premiereDate)) / 86_400_000;
const annees = Math.max(joursEcoules / 365.25, 1 / 365.25);   // borne : jamais 0
const annualizedReturn = Math.pow(finalEquity / 100, 1 / annees) - 1;
const seancesParAn = n / annees;
const vol = stddev(dailyReturns) * Math.sqrt(seancesParAn);
```

Sans `dates` fournies, on retombe sur l'ancienne convention 252 — documentée comme
telle dans le résultat via un champ `annualisationCalendaire: boolean`, pour que
l'interface ne présente jamais une approximation comme une mesure.

### Dénominateurs

`winRate`, `avgWinPct`, `bestTradePct` et `worstTradePct` se calculent tous sur le
même tableau `trades`, position latente incluse. `numTrades` devient
`trades.length` — une seule notion de « trade ».

### Division par zéro

Un cours à zéro ou nul dans la série rend `(closes[i] - closes[i-1]) / closes[i-1]`
infini. Le rendement du jour vaut 0 lorsque le cours précédent est nul ou absent —
protection que le moteur scraper avait et que le frontend n'a pas.

## 4. Données et fraîcheur

- **Pagination** par `.range()` sur les trois requêtes (cours, signaux, indice),
  par lots de 1000 jusqu'à épuisement.
- **Fraîcheur affichée** : dernière séance utilisée, nombre de séances, période
  calendaire réellement couverte.
- **Proportion de signaux réels** : `hasRealSignals` (booléen) est remplacé par
  `nbSignauxReels` / `nbSeances`, affiché en clair — « 143 séances sur 512 portent
  un signal réel ; le reste utilise un signal technique de repli ».
- **Avertissement d'illiquidité** sous 60 séances sur la période.

## 5. Suppression du moteur scraper

Retirer :

- `scraper/src/backtesting/runBacktest.ts` et le dossier `scraper/src/backtesting/`
- l'import et le `case 'backtest'` dans `scraper/src/index.ts`
- la mention `backtest` dans la liste des commandes de l'aide

Conserver : `scraper/src/scoring/backtestSignals.ts` et `runBacktestSignals.ts`,
ainsi que la commande `backtest-signals`, qui relèvent d'un autre sujet.

## 6. Tests

Module pur, testable sans base. Le test décisif :

**Look-ahead** — une série où le signal `BUY` tombe le jour d'une hausse de +10 %.
Avec le moteur actuel la stratégie encaisse ces +10 % ; avec le moteur corrigé,
non. **Ce test échoue sur le code d'aujourd'hui** : c'est ce qui prouve que la
correction est réelle et non cosmétique.

Autres cas :

- frais reflétés dans `totalReturn` (aujourd'hui identique avec et sans frais)
- symétrie à la vente : la baisse du jour de vente n'est plus esquivée
- annualisation calendaire sur une série trouée (10 séances sur 2 ans)
- `winRate` et `avgWinPct` sur le même dénominateur, position latente incluse
- cours nul en série : rendement 0, jamais `Infinity`
- série de moins de 2 points : résultat vide, pas d'exception

## 7. Conséquence assumée

**Tous les backtests afficheront des performances plus basses.** C'est le but :
les chiffres actuels sont surévalués par construction — biais de look-ahead à
l'entrée comme à la sortie, et frais absents des métriques principales.

Aucun résultat n'est stocké en base (le backtest est calculé à la volée), donc la
correction ne nécessite aucune migration ni reprise de données.

## 8. Hors périmètre

- Backtest de portefeuille multi-titres (le moteur est mono-titre)
- Positions courtes, effet de levier, dimensionnement de position
- Backtest planifié côté serveur — reconstructible plus tard sur le moteur
  corrigé, comme décision délibérée
- `/backtests/demo` et `/premium/backtesting` : pages distinctes non alimentées
  par ce moteur, inchangées
