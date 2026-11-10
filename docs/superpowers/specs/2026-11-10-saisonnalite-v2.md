# Saisonnalité WESTBOURSE : ce qui tient, ce qui ne tient pas, et la version 2

Date : 10 novembre 2026. Données : cours de clôture BRVM de la base WESTBOURSE, janvier 2008 à novembre 2026, 49 valeurs, 8 703 rendements mensuels ; 145 dates de détachement ; 4 469 publications classées. Scripts joints (`saisonnalite-scripts/`).

## 1. Verdict en cinq lignes

1. Votre intuition est juste : la page calcule une moyenne par mois et s'arrête là. Elle ne dit jamais si la saison s'est vérifiée, ni si le mois en cours la suit.
2. Testée hors échantillon, la saison par valeur ne prédit presque rien. Le « meilleur mois » affiché promet +12,4 % en moyenne ; l'année suivante il rend +3,6 % en moyenne, 0,0 % en médiane, et il n'est en hausse que 49 fois sur 100.
3. Le marché dans son ensemble, lui, a une saison plus solide : décembre, février et juin sont forts, janvier et l'automne sont faibles, et ce profil se retrouve dans les deux moitiés de l'historique.
4. Les événements comptent davantage que le calendrier : les 20 séances qui précèdent un détachement de dividende font +2,4 % de mieux que le marché, et le détachement crée une fausse baisse dans la matrice actuelle.
5. La version 2 doit donc faire trois choses : confronter (au mois en cours et au passé), expliquer (dividendes, publications, difficultés), et dire sa fiabilité cellule par cellule.

![Saison du marché et tenue de la saison par valeur](https://d2z0o16i8xm8ak.cloudfront.net/98a10ba7-9687-47ef-8029-b589d96e22a0/3e8e2347-a9af-409c-a9a3-8ef34ff2484c/saisonnalite-brvm-marche-vs-valeur.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9kMnowbzE2aTh4bThhay5jbG91ZGZyb250Lm5ldC85OGExMGJhNy05Njg3LTQ3ZWYtODAyOS1iNTg5ZDk2ZTIyYTAvM2U4ZTIzNDctYTlhZi00MDljLWE5YTMtOGVmMzRmZjI0ODRjL3NhaXNvbm5hbGl0ZS1icnZtLW1hcmNoZS12cy12YWxldXIucG5nPyoiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTQ5NDg4OTB9fX1dfQ__&Signature=KVzzQDognKRoKxretbqcZ5tzq9nrdfdMc59Ssb7kSWXfJloj7IwlW21KMk4ukU~63zJDiAkDPjPnwkZ4JG-e49kCrtmUtFdNCocuPb26CcAfaocEwaEkmbC8dlaMtP-y8rmwrTKbRwo16wckOJCAZ4baJJ8XHKrHJbZ0OPvh3czKz1Tbra3zVFZgDcqFXDDwt9JYfLhwpTyUkJ50ahZH7zAbKP8tA9TobPbU0O3iIcr~VJ3Clo-k9JXxXyevjy9xTZlQsoM0VPfy2jBlG7DrPEhQPDp1OW9aKu6p4SdlD2Uz8m2psMbbSY0Q7aMmQMvNTmgHR2PxSzQiQ5cHbkxN6Q__&Key-Pair-Id=K1BF7XGXAIMYNX)

## 2. Ce que fait la page aujourd'hui

Code lu : `frontend/lib/seasonality/compute.ts`, `server.ts`, `components/seasonality/SeasonalityMatrix.tsx`, `SeasonalityCard.tsx`, `app/saisonnalite/page.tsx`.

- Rendement d'un mois = dernier cours du mois / dernier cours du mois coté précédent − 1, sur 15 ans au plus, cours bruts.
- Par mois calendaire : moyenne, médiane, écart-type, part de hausses, effectif. Fenêtres 5, 10, 15 ans.
- Meilleur mois, pire mois, biais du mois en cours. Aperçu gratuit : le mois en cours seul.

### Défauts constatés

| # | Défaut | Mesure sur vos données |
|---|---|---|
| D1 | Le mois en cours, inachevé, entre dans la moyenne comme un mois complet | Au 10 novembre, les 7 premières séances de novembre 2026 comptent pour un « novembre » |
| D2 | La moyenne est mise en avant ; meilleur et pire mois sont choisis sur elle, sans seuil d'effectif | Dans 151 cellules sur 528 (29 %), moyenne et médiane sont de signe opposé |
| D3 | Rendement en prix : le coupon détaché apparaît comme une baisse | Coupon médian 6,3 % du cours ; mois de détachement en baisse 59 fois sur 100, contre 44 les autres mois ; 75 détachements sur 145 tombent en avril-mai |
| D4 | Mois sans échange : le rendement de plusieurs mois est imputé au mois de reprise | 353 mois-valeurs sur 9 075 (3,9 %) |
| D5 | Sauts non expliqués (opérations sur titre, erreurs) laissés dans la moyenne | 21 mois-valeurs ; 138 rendements mensuels au-delà de ±40 % depuis 2012, la plupart réels, qui dominent les moyennes |
| D6 | Aucune mesure de fiabilité autre que l'effectif | Voir section 3 |
| D7 | Deux définitions concurrentes sur le site | `/saisonnalite` : rendements mensuels par valeur, 15 ans ; `lib/premium/outils.ts` : variations quotidiennes de tous les titres mélangés, 5 ans |
| D8 | Aucune confrontation au cours de la période, aucun événement | Objet de la version 2 |

## 3. La saison tient-elle ? Résultats des tests

### Par valeur : faible

Protocole : pour chaque valeur et chaque mois, le profil est estimé sur les dix années précédentes (cinq observations au moins), puis comparé au mois réalisé. 5 891 prévisions.

| Mesure | Résultat | Lecture |
|---|---|---|
| Signe prévu = signe réalisé | 50,6 % | Pile ou face |
| Corrélation de rang prévu / réalisé | 0,03 | Quasi nulle |
| Meilleur mois affiché, année suivante | promis +12,4 %, réalisé +3,6 % (médiane 0,0 %, hausse 49 %) | Régression vers la moyenne |
| Pire mois affiché, année suivante | promis −6,1 %, réalisé +0,9 % (baisse 55 %) | Idem |
| Le meilleur mois fait mieux que le pire | 57 % des cas | Léger avantage, pas plus |
| Même meilleur mois en 2008-2016 et 2017-2026 | 6 valeurs sur 32 (hasard : environ 3) | Instable |
| Mois « forts » (70 % de hausses passées), mesurés contre le marché | −0,24 % | La saison d'une valeur est surtout celle du marché |
| Écart entre cinquième haut et cinquième bas du profil | +1,4 % par mois, t = 1,4 | Non significatif |

Sur les 528 cellules affichées en fenêtre 10 ans, 63 dépassent le seuil statistique usuel (t > 2) ; le hasard seul en produit environ 35 (intervalle 25 à 46, par permutation). Il existe donc un peu de structure réelle, mais on ne peut pas dire dans quelles cellules : aucune ne passe la correction pour comparaisons multiples.

### Pour le marché : plus solide

Moyenne équipondérée des valeurs cotées, rendements écrêtés à ±30 %, 2008-2026.

| Mois | Moyenne | Années en hausse |
|---|---|---|
| Décembre | +3,5 % | 14 sur 18 |
| Février | +2,6 % | 13 sur 19 |
| Juin | +2,4 % | 15 sur 19 |
| Janvier | −0,7 % | 8 sur 19 |
| Septembre à novembre | −0,3 % chacun | 9 à 11 sur 19 |

Le test global des douze mois rejette l'égalité (p = 0,03) et le profil mensuel de 2008-2016 se retrouve en 2017-2026 (corrélation de rang 0,66, p = 0,02). Réserve : décembre pris seul a p = 0,012, soit 0,14 après correction pour douze mois ; la hausse de décembre est suivie d'un mois de janvier faible, ce qui évoque un effet de fin d'année, sans que la cause soit établie.

### Autour des événements : c'est là que se trouve l'information

Rendement total, écart au marché, en séances de bourse.

| Événement | Fenêtre | Écart moyen | Positif | t | n |
|---|---|---|---|---|---|
| Détachement du dividende | 20 séances avant | +2,4 % | 62 % | 3,2 | 139 |
| Détachement du dividende | jour même (coupon inclus) | +0,7 % | 69 % | 4,9 | 139 |
| Détachement du dividende | 20 séances après | +0,9 % | 54 % | 0,8 | 139 |
| Avis de dividende | séances 2 à 20 après | −2,3 % | 31 % | −3,5 | 94 |
| Assemblée générale | séances 2 à 20 après | +1,4 % | 51 % | 2,9 | 679 |
| États financiers annuels | 20 séances avant / après | +0,7 % / +0,7 % | 47 % | 1,9 / 1,4 | 822 |
| États semestriels | 20 séances avant / après | +0,3 % / +0,2 % | 48 % / 46 % | < 1 | 840 |

Après un détachement, le cours revient à son niveau de la veille en 20 séances dans 57 % des cas, en 60 séances dans 70 %, et pas dans l'année dans 16 %.

Réserves : les dates de détachement couvrent surtout 2022-2026, une partie est reconstituée à partir de la baisse du cours ; les avis de dividende et les assemblées sont classés par mots-clés du libellé ; la publication des comptes n'a pas d'effet moyen parce que bonnes et mauvaises nouvelles se compensent, ce qui ne dit rien d'une publication donnée.

### Liquidité

La valeur échangée du marché suit une saison nette : décembre à 1,22 fois la normale, janvier 0,70, août 0,75, février 0,78. Utile pour qui veut entrer ou sortir d'une ligne peu liquide.

## 4. Ligne éditoriale de l'outil

Une saison n'est pas une prévision : c'est une habitude du passé, et la plupart des habitudes par valeur ne survivent pas à l'année suivante. L'outil doit donc montrer trois choses ensemble : l'habitude, sa fiabilité mesurée, et ce que fait le cours en ce moment. Formules admises : « dans sa fourchette habituelle », « en dessous de son habitude », « régularité non distinguable du hasard ». Formules exclues : tout verbe d'ordre, « mois favorable pour acheter », « meilleur mois » sans effectif ni fiabilité.

## 5. Fonctions complémentaires proposées

### Priorité 1 : confronter

**F1. La saison à l'épreuve du mois en cours.** Pour la valeur choisie : rendement depuis le début du mois, placé dans la distribution historique du même mois (quartiles), avec trois états : au-dessus de l'habitude, dans la fourchette, en dessous. Un graphique de trajectoire superpose le parcours du mois en cours, séance par séance, au parcours médian et à la bande 25-75 % des années passées. Exemple au 10 novembre 2026 : sur 44 valeurs, 26 sont dans leur fourchette, 11 en dessous, 7 au-dessus ; SCRC est à −29,7 % pour une fourchette habituelle de −11,4 % à −1,0 %.

**F2. La saison a-t-elle tenu ?** Grille années × mois (carte de chaleur) qui montre chaque rendement réel au lieu de la seule moyenne, avec, par mois : nombre d'années où le signe habituel s'est vérifié, et taux de réussite hors échantillon (profil des années précédentes contre réalisé). C'est la confirmation ou l'infirmation que vous demandez, lisible d'un coup d'œil.

**F3. Verdict de fiabilité par cellule.** Trois niveaux calculés, jamais écrits à la main :
- « Régularité établie » : au moins 10 observations, même signe dans les deux moitiés de l'historique, médiane et moyenne de même signe, part de hausses hors de 30-70 %, et seuil statistique corrigé pour 12 mois.
- « Indicative » : une partie des critères.
- « Non distinguable du hasard » : le reste, qui sera la majorité. Ces cellules s'affichent en gris, sans couleur verte ou rouge.

Meilleur et pire mois ne sont nommés que s'ils sont au moins « indicatifs » ; sinon la page écrit « aucun mois ne se détache ».

### Priorité 2 : expliquer par les événements

**F4. Rendement total ou prix.** Bascule « dividende réinvesti / cours seul », rendement total par défaut. Les mois de détachement sont marqués d'un repère avec le montant.

**F5. Calendrier des habitudes de la valeur.** Sous la matrice, une frise de douze mois qui indique pour la valeur : mois habituel de publication des comptes annuels et semestriels, de l'assemblée, du détachement (avec fréquence : « détachement en mai 4 années sur 5 »), et les événements à venir déjà connus dans `/calendrier`.

**F6. Fenêtres d'événement.** Pour la valeur et pour le marché : parcours moyen du cours de 20 séances avant à 40 séances après le détachement, l'assemblée, la publication annuelle ; délai de retour au cours d'avant détachement. Les chiffres du marché figurent en section 3 ; par valeur l'effectif est petit (4 à 5 détachements) et doit être affiché comme tel.

**F7. Années de difficulté.** Marquer dans la grille F2 les années à suspension de cotation, avertissement sur résultat, perte nette ou dividende supprimé, et proposer « saison hors années de difficulté ». Répond à votre remarque : une saison calculée en mélangeant une année de crise et des années normales décrit mal l'une et les autres. La base ne compte aujourd'hui que 9 publications repérables par mots-clés ; il faut s'appuyer sur `market_events` (type `suspension`), les comptes (résultat net négatif) et la table des dividendes.

### Priorité 3 : élargir

**F8. Saison du marché et écart propre.** Une vue « Marché » en tête de page (le résultat le plus solide), et pour chaque valeur la décomposition : part du marché, part propre à la valeur. Les cellules se lisent alors « +3,1 % dont +2,6 % de marché ».

**F9. Saison de la liquidité.** Par mois : valeur échangée relative à la normale et part de séances avec échange, pour le marché et par valeur.

**F10. Tableau du mois.** Une page « Ce mois-ci » qui liste, pour toutes les valeurs, l'état F1 et le verdict F3 ; filtres : régularité établie seulement, écart à l'habitude. Remplace le bloc saisonnalité de `/premium/outils`.

**F11. Bilan public et mémoire.** Le premier jour de bourse de chaque mois, écrire en base le profil tel qu'il était connu ; à la fin du mois, écrire le réalisé. Au bout d'un an, la page affiche un bilan non réécrit : « sur 12 mois, la saison établie s'est vérifiée n fois ». Même discipline que le protocole du Conseiller.

**F12. Alertes.** Dans la liste de suivi : « valeur sortie de sa fourchette saisonnière », « détachement dans 20 séances », au format des alertes existantes.

### Ce qu'il ne faut pas faire

- Ne pas faire entrer la saison par valeur dans le signal du Conseiller : elle ne passe pas le test.
- Ne pas afficher d'état F1 avant la cinquième séance du mois, ni sur une cellule de moins de 5 observations.

## 6. Spécification

### Principe

Le calcul quitte le frontend. Un job du `scraper` produit les faits mensuels avec la chaîne de nettoyage et de dividendes déjà testée du Conseiller (`scraper/src/conseiller/nettoyage.ts`, `historique.ts`, `dividendes.ts`) ; le frontend lit et met en forme. Logique pure séparée des I/O, tests vitest, upserts idempotents, job sous `monitored`.

### Lot 1 : corriger le calcul (sans nouvelle table)

Fichier `frontend/lib/seasonality/compute.ts` :

- `monthlyReturnsFromPrices(prices, { asOf })` : exclure le mois de `asOf` s'il n'est pas terminé (D1) ; renvoyer `gapMonths` (nombre de mois sautés avant ce rendement) et écarter des statistiques les rendements avec `gapMonths > 0` (D4).
- `aggregateSeasonality` : médiane en valeur principale, moyenne en second ; écart-type d'échantillon ; `bestMonth` / `worstMonth` sur la médiane et seulement si `n >= 5` ; nouveau champ `verdict` (F3) calculé par `verdictCellule(xs: {year, ret}[])`.
- `verdictCellule` : `etabli` si n ≥ 10, signe de la médiane identique sur les deux moitiés chronologiques, signe moyenne = signe médiane, part de hausses ≤ 30 % ou ≥ 70 %, et |t| ≥ 3,1 (seuil bilatéral 5 % corrigé pour 12 mois à n ≈ 10-19) ; `indicatif` si n ≥ 5 et au moins trois de ces quatre critères avec |t| ≥ 2 ; sinon `hasard`.
- Tests : mois partiel exclu ; mois sauté écarté ; cellule à moyenne positive et médiane négative classée `hasard` ; série aléatoire de 15 ans → au plus une cellule `etabli` sur 1 000 tirages × 12.
- Affichage : cellules `hasard` en gris ; libellé du verdict dans chaque cellule ; texte de bas de page réécrit.
- `lib/premium/outils.ts` : supprimer le calcul concurrent (D7) et réutiliser `aggregateSeasonality` sur la moyenne du marché.

### Lot 2 : faits mensuels en base, rendement total, confrontation

Migration `0204_saisonnalite_mensuelle.sql` :

```sql
create table public.saisonnalite_mensuelle (
  code text not null references public.brvm_instruments(code) on update cascade,
  annee int not null,
  mois int not null check (mois between 1 and 12),
  rdt_prix numeric,            -- null si mois sans échange ou saut non expliqué
  rdt_total numeric,           -- dividende détaché réintégré
  rdt_marche numeric,          -- moyenne équipondérée écrêtée ±30 % des valeurs cotées
  dividende numeric,           -- montant détaché dans le mois, sinon null
  seances_cotees int not null,
  seances_marche int not null,
  valeur_echangee numeric,
  exclu text,                  -- null | 'sans_echange' | 'saut' | 'reprise'
  evenements jsonb not null default '[]',  -- [{type, date}] : detachement, comptes_annuels, comptes_semestriels, assemblee, suspension, avertissement
  difficulte boolean not null default false,
  complet boolean not null,    -- false pour le mois en cours
  maj timestamptz not null default now(),
  primary key (code, annee, mois)
);
alter table public.saisonnalite_mensuelle enable row level security;
create policy saisonnalite_mensuelle_lecture on public.saisonnalite_mensuelle for select using (true);
```

Lecture publique assumée : la donnée dérive de cours déjà publics, l'accès Premium reste porté par le drapeau `saisonnalite` côté page, comme aujourd'hui. Test à la clé anon : lecture permise, écriture refusée.

Scraper, dossier `scraper/src/saisonnalite/` :

- `mensuel.ts` (pur) : `faitsMensuels(seancesNettoyees, dividendes, evenements, asOf)` → lignes de la table. `difficulte` = suspension ou avertissement dans l'année, ou résultat net négatif de l'exercice, ou dividende supprimé après une année payée.
- `trajectoire.ts` (pur) : `trajectoireMois(seances, annee, mois)` → rendement cumulé par rang de séance ; `bandeHistorique(trajectoires)` → médiane, q25, q75 par rang.
- `confrontation.ts` (pur) : `etatMois({ rdtEnCours, rangSeance, historique })` → `{ etat: 'au_dessus' | 'dans_la_fourchette' | 'en_dessous' | 'trop_tot' | 'historique_insuffisant', q25, mediane, q75, n }`, la fourchette étant prise au même rang de séance ; `trop_tot` avant la cinquième séance, `historique_insuffisant` sous 5 années.
- `horsEchantillon.ts` (pur) : `bilanHorsEchantillon(faits, fenetreAnnees = 10)` → par valeur et par mois, nombre de fois où le signe du profil passé s'est vérifié.
- `runSaisonnalite.ts` : lecture paginée, calcul, upsert `onConflict: 'code,annee,mois'`, sous `monitored`. Commande `npm run saisonnalite`, étape ajoutée à `score.yml` après le Conseiller.
- Contrôle par la donnée après la première exécution : nombre de lignes ≈ 9 000 ; aucun `rdt_total < rdt_prix` ; les 145 détachements retrouvés ; `rdt_marche` de décembre moyen proche de +3,5 %.

Frontend :

- `lib/seasonality/server.ts` : lire `saisonnalite_mensuelle` ; les cours quotidiens ne sont lus que pour la trajectoire du mois en cours et des mêmes mois passés.
- Composants : `ConfrontationMois.tsx` (F1, graphique de trajectoire avec bande), `GrilleAnnees.tsx` (F2, années de difficulté marquées, option « hors années de difficulté »), bascule rendement total / prix (F4), repères de détachement.
- Aperçu gratuit : l'état F1 du mois en cours en une phrase ; le reste en Premium.

### Lot 3 : événements

- `scraper/src/saisonnalite/fenetres.ts` (pur) : `fenetreEvenement(rdtValeur, rdtMarche, dates, avant = 20, apres = 40)` → parcours moyen, médian, part de positifs, effectif ; `delaiRetourCoupon`.
- Table `saisonnalite_fenetres (code | 'MARCHE', type_evenement, rang, moyenne, mediane, part_positifs, n)`, même régime RLS.
- Composants : `FriseEvenements.tsx` (F5), `FenetreEvenement.tsx` (F6). Affichage par valeur seulement si n ≥ 4, sinon renvoi aux chiffres du marché.
- Liens : chaque repère renvoie à `/calendrier` et `/dividendes`.

### Lot 4 : marché, liquidité, tableau du mois, bilan

- Vue Marché et décomposition (F8), liquidité (F9), page `/saisonnalite/ce-mois-ci` (F10).
- Table `saisonnalite_bilans (code, annee, mois, profil_mediane, profil_q25, profil_q75, verdict, n, ecrit_le, realise, realise_le)` : première écriture fait foi (`ignoreDuplicates`), même règle que `conseiller_signaux` (F11).
- Alertes (F12) branchées sur le module existant.

### Critères d'acceptation

- Le mois en cours ne modifie plus aucune moyenne.
- En rendement total, la part de mois de détachement en baisse revient au niveau des autres mois.
- Une série aléatoire ne produit pas de cellule « établie ».
- Chaque chiffre affiché porte son effectif ; aucune cellule « hasard » n'est colorée.
- Typecheck et tests verts dans `scraper/` et `frontend/` ; contrôle par la donnée consigné dans la PR.

## 7. Bloc à coller dans Claude Code

```text
Contexte : refonte de l'outil Saisonnalité. La spécification est dans
docs/superpowers/specs/2026-11-10-saisonnalite-v2.md (PR de documentation ouverte par Perplexity ;
récupère la branche ou lis le fichier). Lis-la en entier avant d'écrire du code, ainsi que
CLAUDE.md, frontend/lib/seasonality/*, components/seasonality/*, app/saisonnalite/page.tsx,
lib/premium/outils.ts, scraper/src/conseiller/{nettoyage,historique,dividendes}.ts.

Travaille lot par lot, une PR par lot, en brouillon, sans rien fusionner ni appliquer de
migration en production sans mon accord.

Lot 1 (maintenant) : corrections du calcul dans frontend/lib/seasonality/compute.ts, sans
nouvelle table :
1. exclure le mois en cours inachevé des statistiques ;
2. écarter les rendements qui enjambent un mois sans échange ;
3. médiane en valeur principale, écart-type d'échantillon ;
4. verdictCellule (etabli / indicatif / hasard) selon les règles de la spec, section 6 ;
5. meilleur et pire mois seulement si verdict au moins indicatif, sinon « aucun mois ne se détache » ;
6. cellules « hasard » en gris, verdict et effectif visibles, texte de bas de page réécrit ;
7. remplacer le calcul concurrent de lib/premium/outils.ts.
Tests vitest d'abord (cas listés dans la spec), puis npx tsc --noEmit et npm test dans frontend/.

Avant de coder le lot 2, rédige le plan dans docs/superpowers/plans/ et arrête-toi pour me le
montrer. Le lot 2 crée la migration 0204_saisonnalite_mensuelle.sql (RLS + policy de lecture,
test à la clé anon), le dossier scraper/src/saisonnalite/ (fonctions pures + runSaisonnalite sous
monitored, upsert idempotent), l'étape dans score.yml, puis les composants ConfrontationMois et
GrilleAnnees. Réutilise la chaîne de nettoyage et de dividendes du Conseiller, ne la recopie pas.

Règles : prose française, aucun verbe d'ordre dans les textes affichés, aucun chiffre sans
effectif, le frontend ne recalcule pas ce que le scraper produit. À la fin de chaque lot,
donne-moi le contrôle par la donnée (nombre de lignes, détachements retrouvés, moyenne de
décembre du marché) et les points douteux.
```

## 8. Limites de cette analyse

- 19 années, soit 19 observations par mois au mieux : la puissance statistique est faible, y compris pour le marché.
- Moyenne équipondérée : les petites valeurs pèsent autant que Sonatel. Une pondération par capitalisation reste à faire.
- Une seule valeur radiée dans la base : léger biais de survie.
- Dates de détachement concentrées sur 2022-2026.
- Les frais et la fourchette de cotation ne sont pas déduits ; aucun des écarts mesurés ici n'est présenté comme exploitable.
