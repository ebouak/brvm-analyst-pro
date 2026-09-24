# Lecture de séance : verrou premium, contrôleur de cohérence, événements mesurés

Date : 2026-09-24 · Statut : approuvé · Lot 1 de 2

## 1. Point de départ

`lib/carnet/commentaire.ts` produit « Ce que dit la séance » : quatre lectures
(bruit, carnet, technique, comptes) juxtaposées, une synthèse, des limites.
Il est rendu sur `/actions/[code]` et `/dashboard`, gratuitement, depuis le
commit `098c696`.

Quatre demandes ont été formulées. L'exploration de la base en a validé trois
et invalidé une, et a révélé trois défauts de données qui n'étaient pas dans
la demande initiale.

### Ce que la base contient réellement

| Sujet | Constat mesuré le 2026-09-24 |
|---|---|
| Contrôle d'accès | `feature_flags` (code, acces) piloté depuis `/admin/features`. `canAccess()` échoue **fermé** : une fonctionnalité non déclarée est traitée comme premium. |
| Sous-scores du moteur | `signals_daily` porte `score_variation`, `score_volume`, `score_rsi`, `score_macd`, `bonus_tendance`, `explication`. |
| Événements | `market_events` : **4 730** lignes, toutes rattachées à un code. 2 552 `resultats`, 1 161 `autre`, 879 `assemblee`, 117 `dividende`. 264 depuis janvier 2026. PALC 113, ETIT 251. |
| Sentiment des événements | **Inexploitable** : 4 605 / 4 730 valent `neutral`, une seule `negative`. |
| Event-study | `lib/eventStudy.ts` calcule déjà rendement excédentaire vs BRVM Composite, variation de volume, horizons J+1/3/5/10. |
| Fondamentaux 2026 | **0 ligne.** 2023 : 47 · 2024 : 46 · 2025 : 43 · 2026 : 0. |
| Publications 2026 | 23 libellés « 1er semestre 2026 », 38 « trimestre 2026 » — en PDF, non extraits. |
| Notation financière | 16 valeurs sur 48 à jour (2026), **21 restées en 2025**, 1 en 2024, 10 sans notation. Source câblée : richbourse. La BRVM publie elle-même 23 notations en 2026 pour 18 codes. |

### Les trois défauts révélés

1. **Notation périmée affichée sans le dire.** PALC : `notation_json.date_notation
   = 2025-07-01`, alors que la fiche liste juste en dessous un PDF Bloomfield du
   2026-08-26 (« validité juillet 2026 – juin 2027 »). La page se contredit
   elle-même à l'écran.

2. **Publications rattachées à la mauvaise société** (trois cas vérifiés un par
   un, le total réel est inconnu) :

   | Rattaché à | Document | Appartient à |
   |---|---|---|
   | PALC (PALMCI) | Notation Financière – SAFCA CI (03/03/2026) | SAFC |
   | SNTS (SONATEL) | États Financiers certifiés – AFRICA GLOBAL LOGISTICS CI | pas SONATEL |
   | CFAC (CFAO Motors CI) | États financiers – TRACTAFRIC MOTORS CI (5 documents) | pas CFAO |

   Un détecteur naïf en signalait 11, dont **8 faux positifs** (« SOCIETE
   GENERALE CI » *est* SGBCI ; « BOA NG » *est* BOA Niger). Toute règle
   automatique doit donc refuser l'ambiguïté — c'est la leçon déjà payée sur
   les dividendes sikafinance (`CLAUDE.md`, 2026-09-08).

3. **Étiquette technique contredite par son propre sous-score.** SNTS :
   `explication` annonce « RSI 70 (neutre) » quand `score_rsi = −0,9871`.

**Écarté après vérification** : l'hypothèse que ces mauvais rattachements aient
contaminé `fundamentals`. `CFAC.source_file` est `null` ; aucune ligne ne pointe
vers le PDF d'une autre société. Le risque reste ouvert pour toute extraction
future keyée sur `publications.code`.

## 2. Périmètre

**Dans le lot** : verrou premium, contrôleur de cohérence, événements mesurés.

**Hors lot, délibérément** :

- **Chiffres 2026 / trimestriels / semestriels.** `fundamentals` a pour clé
  `(code, year)`, sans notion de période. Y verser un semestre sous la même clé
  fausserait le PER d'un facteur deux sur toutes les pages qui le lisent. Ce
  chantier exige une migration, une réextraction et une règle d'annualisation :
  c'est le lot 2.
- **Réparer** la notation et les rattachements. Ce lot les *révèle* et les
  compte ; les corriger suppose de connaître l'ampleur.
- **Corriger `score.ts`.** Changer l'étiquette « neutre » modifie les signaux
  des 48 valeurs : décision produit distincte.

## 3. Verrou premium

### Décision

Nouveau drapeau `lecture_seance` (`acces = 'premium'`, label « Lecture
commentée de la séance »). **Pas de réutilisation de `signaux`** : le
commentaire agrège carnet, technique et comptes ; l'accrocher à `signaux` le
couperait pour un abonné qui n'a que les signaux. Le niveau vivant en base,
l'ouvrir gratuitement pour une opération marketing reste une case à cocher
dans `/admin/features`.

### Comportement

Sur `/actions/[code]`, `/dashboard` et `/societes/[code]` : si
`canAccess('lecture_seance')` refuse, `<CarnetCommentaire>` **n'est pas rendu**
— aucune phrase, aucun chiffre dans le HTML. À sa place, `SectionLock`, comme
le fait déjà le bloc Fondamentaux.

Le masquage CSS est proscrit : il laisserait l'analyse dans la source, et
`/societes/[code]` est la page indexée par Google.

Aucune aguiche : ni premier constat, ni synthèse en clair. Donner la synthèse
reviendrait à offrir la conclusion et facturer les preuves — l'inverse de ce
que le produit défend.

## 4. Contrôleur de cohérence

### Principe

Un module pur `lib/coherence/`, une fonction par règle, rendant une anomalie ou
`null`. **Une seule logique, deux usages** : la fiche l'appelle au rendu avec ce
qu'elle a déjà chargé (zéro requête supplémentaire, jamais périmé) ; un
balayage hebdomadaire exécute les mêmes fonctions sur les 48 valeurs et écrit
dans `coherence_anomalies`, ce qui alimente `/admin/coherence`.

Un détecteur qui vit uniquement en base deviendrait lui-même une source
d'incohérence : une notation corrigée lundi resterait signalée « périmée »
jusqu'au balayage suivant.

### Les quatre règles

| Règle | Déclencheur | Gravité |
|---|---|---|
| `notation_perimee` | une publication dont le libellé contient « Notation » est postérieure à `notation_json.date_notation` | `trompeuse` |
| `etiquette_contredite` | `explication` qualifie un facteur de « neutre » alors que son sous-score dépasse ±0,6 en valeur absolue | `a_surveiller` |
| `publication_mal_attribuee` | le libellé nomme **sans ambiguïté** une autre société cotée **et** ne nomme jamais la société rattachée | `trompeuse` |
| `comptes_perimes` | le dernier exercice en base est antérieur à une publication d'états financiers disponible | `a_surveiller` |

### Refus de l'ambiguïté (règle 3)

Une anomalie n'est émise que si **toutes** ces conditions tiennent :

1. le libellé ne contient aucun mot distinctif (≥ 4 caractères) de la
   désignation de la société rattachée ;
2. il contient un mot distinctif d'**exactement une** autre société cotée ;
3. ce mot n'est pas un terme générique du secteur (`SOCIETE`, `BANK`,
   `BANQUE`, `AFRICA`, `NATIONALE`, `GENERALE`, `IVOIRIENNE`, `CI`, `SN`,
   `BN`, `NG`, `BF`, `TG`, `ML`, `NE`).

Si deux sociétés correspondent, ou si aucune ne correspond nettement : **aucune
anomalie**. Un trou déclaré vaut mieux qu'une accusation fausse.

### Sortie

```ts
interface Anomalie {
  regle: 'notation_perimee' | 'etiquette_contredite'
       | 'publication_mal_attribuee' | 'comptes_perimes';
  gravite: 'trompeuse' | 'a_surveiller';
  /** Phrase destinée au lecteur, portant la preuve chiffrée ou datée. */
  message: string;
  /** Les champs qui ont déclenché la règle, pour l'audit admin. */
  preuve: Record<string, string | number | null>;
}
```

Seules les anomalies `trompeuse` sont dites au lecteur, en une ligne ajoutée
aux `limites` du commentaire :

> « La notation affichée date de juillet 2025 ; une notation plus récente a été
> publiée le 26 août 2026 et n'est pas encore reprise. »

Les `a_surveiller` ne vont qu'à l'admin. Une page qui affiche une donnée
périmée sans le dire est pire qu'une page qui l'avoue.

### Table `coherence_anomalies` (migration 0140)

`code`, `regle`, `gravite`, `message`, `preuve jsonb`, `detectee_le`,
`resolue_le`. Clé naturelle `(code, regle, detectee_le)` pour l'idempotence du
balayage. RLS activée, **aucune policy de lecture pour `anon` ni
`authenticated`** : la table ne contient pas de donnée personnelle, mais elle
liste nos propres défauts — elle n'a rien à faire dans une réponse publique.
Écriture service_role uniquement.

## 5. Événements de marché et ce qui a suivi

### Sélection

Parmi les `market_events` de la société dont `event_date <= aujourd'hui`, les
**3 plus récents**, triés par priorité de type puis par date :

`resultats` (1) · `dividende` (1) · `autre` (2) · `assemblee` (3)

879 des 4 730 lignes sont des convocations d'assemblée : du bruit
administratif, relégué en dernier sans être supprimé.

### Mesure

Pour chaque événement retenu, `eventStudy(series, volumes, indexSeries,
event_date, 5)` contre le BRVM Composite (`brvm_indices_daily`).

> **17 sept. 2026 — États financiers certifiés.** Dans les 5 séances qui ont
> suivi, le titre a fait **+3,2 %** de mieux que le BRVM Composite, sur un
> volume **2,1 fois** l'ordinaire.

### Garde-fous

- Événement de moins de 5 séances : la fenêtre est déclarée incomplète,
  **aucun chiffre partiel** n'est publié.
- `found === false` ou `abnormalReturnPost === null` : l'événement est listé
  **sans mesure**, jamais avec une mesure devinée.
- L'étiquette `reaction` n'est **pas** affichée : une étiquette se retient
  mieux que sa nuance, et « réaction négative » se lirait « mauvaise
  nouvelle ».
- Le champ `sentiment` n'est **pas** utilisé (2,6 % de lignes exploitables).
- Une limite est ajoutée : « Ces mesures décrivent ce qui a suivi la date, pas
  ce que l'événement a produit. »

## 6. Les interdits, inchangés

Le module reste gouverné par les trois règles déjà sous test :

1. aucun chiffre qui ne vienne d'un champ reçu ou d'un calcul explicite ;
2. aucun lien de cause entre les lectures ;
3. aucune recommandation.

L'ajout des événements est le point où la causalité est la plus tentante. La
formulation « dans les N séances qui ont suivi » est imposée par les tests :
une mesure de succession, jamais une explication.

## 7. Tests

Vitest pur, par règle, sur les cas réels relevés le 2026-09-24 :

- `notation_perimee` : PALC (2025-07-01 vs publication du 2026-08-26) → anomalie.
- `etiquette_contredite` : SNTS (« RSI 70 (neutre) » vs −0,9871) → anomalie.
- `publication_mal_attribuee` : SAFCA→PALC, AGL→SNTS, Tractafric→CFAC → anomalie.
- **Cas négatifs obligatoires** : « Rapport d'activités — 1er semestre 2026 —
  SOCIETE GENERALE CI » sur SGBC → **aucune** anomalie ; « … BOA NG » sur BOAN
  → **aucune** anomalie. Ces deux tests protègent contre la répétition du
  défaut de correspondance floue des dividendes.
- Événements : fenêtre incomplète → aucun chiffre ; `abnormalReturnPost` nul →
  événement listé sans mesure ; aucune formulation causale dans la sortie.
- Verrou : accès refusé → le composant ne rend rien du tout.

## 8. Ce que ce lot ne prouve pas

Il compte les incohérences, il ne les corrige pas. À l'issue du premier
balayage on saura combien de publications sont mal rattachées et combien de
notations sont périmées — deux nombres aujourd'hui inconnus, et qui
conditionnent le lot suivant.
