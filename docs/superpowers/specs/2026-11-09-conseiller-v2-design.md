# Conseiller v2 — moteur à concordance de facteurs, prouvé hors échantillon

Date : 2026-11-09. Statut : conception validée par l'exploitant (approche B),
architecture relue par Fable (consultation 1/3, verdict A), révisée après une
revue critique externe (même jour) : sections B1 à H de cette revue intégrées.

## 1. Pourquoi

Mesure du moteur v1 (`frontend/lib/advisor/recommend.ts`) sur 93 séances
(19/06 → 06/11/2026), 49 valeurs, 4 494 recommandations. Le marché (BRVMC) a
fait +17,6 % sur la période. À 20 séances :

| Reco | Cas | Bon sens absolu | Bon sens vs marché | Écart moyen au marché |
|---|---|---|---|---|
| Acheter | 363 | 50 % | 29 % | −1,1 pt |
| Vendre | 2 093 | 50 % | 63 % | −2,1 pt |
| Conserver | 985 | — | — | −5,0 pt |

**Limite de ce tableau** : 93 séances à horizon 20 ne donnent que 4 cohortes
non chevauchantes. Les pourcentages n'ont donc pas d'intervalle de confiance
et sont qualitatifs. La re-mesure de v1 par le banc corrigé (étape 1) les
remplace. Le constat qualitatif tient pourtant :

- 61 % de « Vendre » en plein marché haussier. Au 06/11, 26 valeurs sur 49
  sont à Vendre.
- Cause : le DCF de criblage (`lib/dcf/ranking.ts`) actualise à environ 18 %
  (rf 6 % + prime action 8,13 % + prime pays 3,9 %, bêta 1). Il applique un
  DCF par flux de trésorerie aux banques et pèse ±30 points pour un seuil de
  ±22 : il décide seul.
- Le « 56 % » de `/conseiller/track-record` porte sur 16 bascules, mesurées
  jusqu'à aujourd'hui, sans comparaison au marché.

**Objectif de l'exploitant** : battre le marché, mesuré honnêtement. La cible
initiale de 90 % de bons appels a été écartée. Le levier légitime est la
sélectivité.

## 2. Protocole de preuve (inscrit dans PREREG.md avant toute mesure)

### 2.1 Unité d'indépendance : la date

À chaque date de rebalancement non chevauchante (toutes les 20 séances), on
calcule UNE statistique transversale. L'intervalle de confiance s'obtient par
bootstrap **sur ces dates**, jamais sur les cas regroupés :

- bootstrap par blocs stationnaire (Politis-Romano) ;
- longueur moyenne des blocs : 3 dates, soit 60 séances ;
- 10 000 tirages, graine fixée à 20261109.

### 2.2 Pas de réglage : paramètres standards, historique entier en validation

Les paramètres sont figés **sans être réglés** : fenêtres 60/120 séances, rang
transversal, seuils ±0,33 / ±0,66, K. Ce sont des choix standards, écrits avant
toute mesure. Il n'y a pas de période de réglage : l'historique disponible
entier est la période de validation, lue une seule fois.

- Facteurs de prix : 1998-2026, soit environ 290 dates indépendantes.
- Facteurs fondamentaux : uniquement les dates couvertes (§3).

**Robustesse** (secondaire, descriptive) : validation glissante. À chaque date
t, on ne retient que les facteurs significatifs sur les données strictement
antérieures à t, et on applique la règle sur t → t+20.

**Repli** : si les facteurs fondamentaux ne passent pas, on réduit au cœur prix
(tendance et risque). Ce repli ne peut pas être décidé après lecture pour
« sauver » un résultat : il est prévu ici, et son résultat est publié tel quel.

### 2.3 Un seul test confirmatoire

- **Test confirmatoire unique** : la règle complète (§5). Statistique : par
  date, rendement moyen des « Acheter » moins rendement moyen des « Vendre »,
  en excès du marché, exécutés à la séance suivante, **coûts déduits**.
- **Test unilatéral** : le sens est pré-spécifié (Acheter > Vendre). Seuil
  α = 5 %. Un seul test, donc pas de correction de Holm.
- **Critère de preuve** : la borne basse de l'IC unilatéral à 95 % dépasse
  zéro, APRÈS déduction d'un coût de **1,5 % aller-retour**.
- **Test de signe** complémentaire : part des dates où l'écart est positif.
- **Analyses secondaires**, descriptives, sans valeur de preuve : chaque
  facteur seul (tiers haut − tiers bas), Acheter − marché, horizon 60 séances,
  facteur « surprise ».

### 2.4 Puissance : effet minimal détectable calculé AVANT lancement

- L'écart-type des écarts par date est estimé sur la première moitié de
  l'historique de prix, **sans regarder le signe** des écarts.
- On en déduit l'effet minimal détectable (EMD) de la règle, annualisé.
- **Si l'EMD dépasse 8 % annualisés**, on ne lance pas. On reformule d'abord
  le critère avec l'exploitant (par exemple horizon 60 séances, ou cœur prix
  seul), puis on recommence le pré-enregistrement.
- L'EMD figure dans PREREG.md, commité avant la lecture.

### 2.5 Exécution réaliste

- Signal à la clôture de t, exécution au cours de t+1.
- **Robustesse** : on exclut les valeurs à la limite de variation (±7,5 %) le
  jour du signal, car elles sont inexécutables.
- **Robustesse liquidité** : le test est recalculé en EXCLUANT les classes C/D
  (pas seulement en les forçant à Conserver).

### 2.6 Abstention décidée d'avance

Si la preuve n'est pas obtenue, v2 ne part pas en production et le Conseiller
affiche qu'il s'abstient. Avec moins de 2 familles de facteurs disponibles à
une date, la règle s'abstient à cette date.

### 2.7 Reproductibilité et traçabilité

Le rapport du banc contient :
- le SHA git de PREREG.md ;
- un hachage SHA-256 de l'extrait de données utilisé ;
- la date d'exécution ;
- la largeur des IC calculés par dates et par cas regroupés, et leur rapport
  (mesure directe de la sur-confiance du banc v1).

**Validation non aveugle** : l'exploitant et l'auteur connaissent la
trajectoire du marché 2022-2026 et le diagnostic v1. Le PREREG le consigne :
la validation est **non retouchée**, pas aveugle.

### 2.8 Banc existant

`scraper/src/signaux/evaluation.ts` regroupe les cas de toutes les valeurs, et
ses IC sont trop étroits. Il est corrigé selon §2.1, et son verdict du
31/10 (« rien de prouvé ») est recalculé.

## 3. Données — étape 0 : audit avant toute mesure

| Source | Historique | Usage |
|---|---|---|
| `brvm_actions_daily` (cours, volume) | 1998 → (5 904 séances) | tendance, risque, liquidité glissante |
| `brvm_indices_daily` BRVMC | mai 2026 seulement | affichage ; le banc reconstruit un indice équipondéré |
| `income_statements` / `balance_sheets` annuels | exercices 2012-2025, ~5 par société | valorisation, résultats, ROE |
| `dividends` (montant, exercice) | `ex_date` depuis 04/2026 | rendement par exercice |
| `publications` | 1998 → (4 779) | dates réelles de publication, d'AG |

L'audit produit `docs/conseiller/audit-donnees.md` et une table d'ajustements
si nécessaire :

1. **Fractionnements et opérations sur titres.** Contrôle du 09/11 : SNTS
   (÷10 le 26/10/2026) apparaît déjà ajustée (≈ 4 200 avant comme après), et
   un seul saut de cours supérieur à ×2,5 ou inférieur à ×0,4 existe sur tout
   l'historique. L'audit recense aussi les sauts de ×0,45 à ×0,55 (division
   par 2) et les compare aux opérations sur titres connues.
2. **Cours figés.** Séances sans échange (volume nul ou cours inchangé) par
   valeur et par année.
3. **Sociétés radiées.** Codes présents dans les cours anciens et absents
   aujourd'hui. **Sens du biais à écrire** : sans les radiées, le banc
   favorise les facteurs de risque (les faillites disparaissent) et pénalise
   « Vendre ».
4. **Dates de disponibilité.** Date réelle de publication des comptes (depuis
   `publications`), 30 juin N+1 en repli. Date d'AG pour les dividendes,
   31 juillet N+1 en repli. Le choix est figé dans le PREREG.
5. **Dividendes et rendements.** Un rendement en cours seuls ampute de son
   dividende une valeur qui détache dans la fenêtre : c'est une erreur de
   l'ordre de l'effet cherché. Traitement retenu, dans cet ordre :
   - (a) ex-date reconstituée par détection d'une baisse de cours proche du
     montant du dividende (±20 %), dans une fenêtre de 60 séances après l'AG ;
   - (b) à défaut, fenêtres de 20 séances chevauchant mai-août exclues pour
     les valeurs à dividende.
   Les rendements du banc sont ensuite des **rendements totaux** (cours +
   dividende réinvesti à l'ex-date). Si (a) et (b) échouent, le facteur
   dividende est retiré et la limite est écrite dans le rapport.
6. **Couverture fondamentale.** Nombre de valeurs couvertes par facteur et par
   année. Une date où moins de 15 valeurs sont couvertes est exclue pour ce
   facteur.

## 4. Facteurs (figés dans PREREG.md)

**Construction** : chaque sous-signal est converti en **rang transversal** à la
date (centile → [−1, +1]). +0,33 correspond au tiers haut, cohérent avec le
test par tiers. Une entrée manquante donne `null`, jamais 0.

**Familles comptables** : banque / général. L'assurance est fusionnée dans
« général » (2 à 3 valeurs). Une médiane n'est calculée qu'avec au moins 5
valeurs dans la famille, sinon `null`.

**Une voix par famille de facteurs** (les sous-signaux corrélés ne votent pas
deux fois) :

| Famille | Sous-signaux (moyenne des rangs) | Sens |
|---|---|---|
| Valorisation | PER et P/B rapportés à la médiane de la famille comptable (PER ignoré si résultat ≤ 0) | moins cher = + |
| Qualité | évolution du résultat net, ROE rapporté à la médiane | plus haut = + |
| Rendement | rendement du dividende de l'exercice connu à la date | plus haut = + |
| Tendance | performance 60 et 120 séances moins l'indice équipondéré | plus haut = + |
| Risque | volatilité 60 séances, plus forte baisse 120 séances | plus faible = + |

- **Tendance et risque** valent `null` si moins de 60 % des séances de la
  fenêtre ont été échangées. Une volatilité nulle de cours figés ne doit
  jamais passer pour « sûre ».
- **Indice équipondéré** : il exclut les valeurs non échangées ce jour-là, et
  une nouvelle cotation n'y entre qu'après 20 séances.
- **Liquidité** : classes recalculées **en fenêtre glissante, avec les seules
  données antérieures à la date** (module `scraper/src/liquidity/`).
- **Hors règle** :
  - « surprise » (réaction du cours dans les 5 séances suivant une
    publication) : analyse secondaire ;
  - détachement à venir, notation, DCF : contexte affiché uniquement.

## 5. Décision

- **Garde-fou de liquidité** : classe C ou D à la date → « Conserver », avec
  la raison affichée.
- **Acheter** : au moins K familles ≥ +0,33 et aucune ≤ −0,66.
- **Vendre** : au moins K familles ≤ −0,33 et aucune ≥ +0,66.
- **Sinon** : Conserver.
- **K = 3** sur 5 familles. Moins de 2 familles disponibles → abstention.
- **Publiés par le banc** :
  - taux d'abstention et de « Conserver » par année ;
  - nombre moyen d'« Acheter » par date.
  Un moteur qui dit « Conserver » plus de 90 % du temps est signalé comme peu
  utile, même s'il est prouvé.
- **Conviction affichée** : « 3 familles sur 5 concordent », plus l'ancienneté
  de la recommandation (séances depuis la dernière bascule).

## 6. Architecture (verdict Fable : A)

- **Une seule fonction** `evaluerSeance(date, donneesDisponibles) →
  Decision[]`, pure, appelée par le banc ET par le job quotidien. Un test
  rejoue une date du banc via le chemin du job et compare le résultat à
  l'octet près.
- `scraper/src/conseiller/` :
  - `facteurs.ts`, `decision.ts`, `evaluerSeance.ts` (purs) ;
  - `historique.ts` : chargement paginé, indice équipondéré, disponibilité ;
  - `audit.ts` (étape 0) ;
  - `banc.ts` ;
  - `runConseiller.ts`.
- **CLI** : `conseiller:audit`, `conseiller:emd`, `conseiller:banc`,
  `conseiller [--ecrire]`.
- **Job quotidien** dans `.github/workflows/score.yml`, après `score` et
  `liquidity`, instrumenté par `monitored`. Il écrit **une ligne par valeur
  cotée**, abstention comprise (`action = 'conserver'`, raison dans
  `facteurs`). Il échoue sous 40 lignes, ce qui reste juste même si v2 s'abstient.
- **Migration** `advisor_history` :
  - `moteur_version text not null default 'v1'` et `facteurs jsonb` (null
    pour v1, pas de rétro-calcul) ;
  - clé primaire `(date_marche, code, moteur_version)` ;
  - index `(moteur_version, date_marche)` ;
  - RLS : lecture publique, écriture service_role ; vérification à la clé anon.
- **Frontend** : il LIT la version donnée par `advisor_moteur_actif` dans
  `feature_flags`, avec repli sur **v1** si le drapeau est absent. Le passage à
  v2 n'a lieu qu'après la porte humaine de l'étape 4. La route
  `api/cron/advisor-snapshot` est retirée après la bascule.

## 7. Track record

- Un appel compte **à partir de sa bascule**, une seule fois, et non à chaque
  séance où il est répété. La page le dit.
- La mesure se fait à 20 séances, en excès de l'indice de marché.
- Affichage : « Bat le marché dans X % des appels (N appels, marge ±Y pts) »,
  écart moyen en excès, taux d'abstention sur la période, lien vers le rapport
  du banc.
- v1 est affiché avec la même méthode, sans l'enjoliver, séparé de v2.
- `computeStats` (frontend, pur, testé) est réécrit selon ces règles.

## 8. Étapes

0. Audit des données (§3) et table d'ajustements si nécessaire.
1. Banc corrigé (unité = date) ; re-mesure de v1 et des signaux §9.
2. Facteurs, décision et `evaluerSeance`, avec tests purs. Calcul de l'EMD.
   **PREREG.md commité** (paramètres, EMD, nombre de tests, traitement des
   dividendes, dates de disponibilité, SHA des données).
3. Lecture unique du banc. Rapport dans `docs/conseiller/`.
4. **Porte humaine** : l'exploitant lit le rapport. Sans preuve, on s'arrête
   et le Conseiller affiche qu'il s'abstient.
5. Si prouvé : migration, job quotidien, frontend en lecture, nouveau track
   record, bascule par drapeau.

## 9. Hors champ

- Apprentissage automatique.
- Toute cible chiffrée de réussite annoncée avant mesure.
- Modification de `scoring/score.ts` (signaux §9).

## 10. RGPD

Aucune donnée personnelle n'est collectée ni traitée : uniquement des données
de marché et des comptes publiés.

## 11. Amendement du 2026-11-09 — après l'audit, AVANT toute mesure de performance

L'audit (`docs/conseiller/audit-donnees.md`) et l'échec du calcul d'EMD ont été
lus. Aucun rendement, aucune moyenne ni aucun signe d'écart n'a été calculé.
Décisions de l'exploitant et règles qui en découlent :

1. **Test confirmatoire = cœur prix.** Les comptes ne couvrent presque aucune
   société avant l'exercice 2020 (≤ 3 valeurs avant 2019, 14 en 2020, 44-47
   ensuite). La règle à 5 familles ne peut donc rien recommander avant mi-2021
   (≈ 65 dates). Le test confirmatoire porte sur la règle **cœur prix**
   (familles tendance et risque, 1998-2026) :
   - Acheter si tendance ≥ +1/3 ET risque ≥ +1/3 ;
   - Vendre si tendance ≤ −1/3 ET risque ≤ −1/3 ;
   - sinon Conserver ;
   - même garde-fou de liquidité ; famille manquante → Conserver (abstention).
   La règle à 5 familles est mesurée **à titre descriptif** à partir du
   2021-07-01, sans valeur de preuve. Le Conseiller affiche les fondamentaux
   comme contexte tant qu'ils ne sont pas prouvés. Réévaluation annuelle.
2. **Erreurs de saisie (allers-retours).** Une séance dont le cours sort de
   [×0,8 ; ×1,25] par rapport à la précédente, et qui revient dans les 5 séances
   suivantes à ±10 % du cours d'avant le saut, est une erreur de saisie. Les
   séances concernées sont retirées de la série et traitées comme non cotées.
   Cas d'origine : ONTBF 2014-2018, SIVC, SLBC, SGBC, PRSC, cas BOAN 2014-2017 (+30 % puis −23 %).
3. **Ruptures non expliquées.** Une variation hors de [×0,8 ; ×1,25] en une
   séance, après nettoyage, dépasse la limite de cotation. Si aucun dividende
   détaché ce jour-là n'en explique la baisse à ±20 %, c'est une **rupture**
   (fractionnement non ajusté ou autre opération sur titres). Tout rendement du
   banc dont la fenêtre ]entrée ; sortie] contient une rupture est exclu
   (`null`). Toute fenêtre de tendance, de volatilité ou de plus forte baisse qui
   en contient une donne `null`. Rien n'est ajusté ni deviné. Cas d'origine :
   PALC le 2017-11-06 (÷2 durable, volume ×17).
4. **Reconstitution des détachements élargie** : recherche du 1er avril au
   31 décembre N+1, au lieu de 60 séances. Cas d'origine : FTSC, dividende de
   l'exercice 2024 (1 726,56 FCFA), détaché le 2025-09-26 (−1 575 FCFA).
5. **Plancher de liquidité du banc** : présence seule (< 50 % → D). Le critère
   « activité nulle » (< 2 M FCFA par séance) est écarté, car il aurait vidé
   l'historique ancien sans viser les cours figés.
6. **Statistique confirmatoire** (décidée sur des comptages de décisions, sans
   aucun rendement lu) : par date, moyenne des rendements des « Acheter » en
   excès de l'indice équipondéré (entrée t+1, sortie t+1+20, rendement total),
   moins 1,5 % de coût aller-retour. Une date sans « Acheter » est sautée et
   comptée. Historique 2007-01-01 → fin (avant 2007, la base ne contient que 2 à
   3 valeurs). Prouvé ⇔ borne basse unilatérale (5e centile du bootstrap
   stationnaire) > 0 avec au moins 30 dates. Raison : la règle cœur prix ne dit
   presque jamais « Vendre » sur une valeur liquide (16 dates seulement avec
   Acheter ET Vendre, toutes en 2023-2026). Acheter − Vendre devient une analyse
   descriptive.

## 12. Résultat du banc et décision de production (2026-11-09)

**Effet minimal détectable : 26,9 % par an** (écart-type 5,82 points par date ;
23 dates sur la première moitié, environ 46 au total depuis 2007). Le seuil
d'arrêt (8 %) est dépassé : le test ne peut rien prouver. Aucune moyenne et aucun
signe de la règle n'ont été lus, et le PREREG n'est pas consommé : le banc pourra
être relancé chaque année.

**Décision de l'exploitant : abstention, facteurs en information.**

- Aucun verdict Acheter / Vendre n'est plus affiché. Le Conseiller dit qu'il
  s'abstient et explique pourquoi.
- Pour chaque valeur, il montre sa position par famille de facteurs (tiers
  haut / milieu / bas) et sa classe de liquidité, sans verdict.
- Le moteur v1 (`lib/advisor/recommend.ts`) est retiré de l'affichage. Son
  historique `advisor_history` est conservé, figé.
- Les notifications de bascule (`notifyFlips`) ne visaient que les canaux de
  l'exploitant, jamais les utilisateurs : aucun client n'est à prévenir.

**Livraison en deux PR** (avis Fable, consultation 2/3) :

1. **PR 1 — données.**
   - Migration `0200_conseiller_facteurs`.
   - Job `conseiller` dans `score.yml`, et le code du banc.
   - Freshness dans la tour de contrôle.
   - La migration est appliquée, le job lancé à la main, puis les lignes sont
     vérifiées à la clé anon.
2. **PR 2 — affichage**, fusionnée seulement une fois la table remplie.
   - `/conseiller`, `MyPortfolioAdvice` et `/api/advisor/portfolio` lisent la
     table.
   - Track record réécrit.
   - Textes de la landing.
   - Suppression du cron `advisor-snapshot` (dans les DEUX `vercel.json`), de la
     route, de `notifyFlips` et du code mort (`ConseillierWidget`,
     `lib/conseiller.ts`).
   - Contrôle qu'aucun autre affichage (agent, dossier, OG) ne montre de verdict
     du Conseiller.

**Table `conseiller_facteurs`.**

- Colonnes :
  - `date_marche date`, `code text` (référence `brvm_instruments`) ;
  - `scores jsonb` : rang par famille dans [−1, +1] ou null ;
  - `tiers jsonb` : `haut` | `milieu` | `bas` | null par famille, calculé par le
    job ;
  - `effectifs jsonb` : nombre de valeurs classées par famille ;
  - `classe_liquidite text` ;
  - `moteur_version text` ;
  - `created_at`.
- Clé primaire `(date_marche, code)`.
- RLS : lecture publique, écriture par service_role.
- Aucune donnée personnelle.
- Le frontend ne recalcule JAMAIS un tiers.

**Contrôle du job, sur la donnée** :

- `date_marche` égale la dernière séance de `brvm_actions_daily` ;
- nombre de lignes ≥ nombre de valeurs cotées ce jour-là, moins 2 ;
- au plus 30 % de lignes dont toutes les familles sont nulles.

Sinon, le job échoue (run rouge et `scraper_errors`).
