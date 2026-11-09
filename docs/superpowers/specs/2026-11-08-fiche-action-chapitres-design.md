# Fiche action en quatre chapitres — spécification

Date : 2026-11-08. Statut : design validé par l'exploitant (« je valide »), maquette
de référence : https://claude.ai/artifact/7JfL1N5m9BdzS3rHB7xSGJ (version 12, exemple STAC).

## 1. But

La fiche `/actions/[code]` empile 20 blocs (9 359 px sur ordinateur, 14 209 px sur
mobile) sans fil conducteur, et plusieurs blocs se contredisent. Elle devient un
parcours en quatre chapitres, sans retirer aucune information, et chaque chiffre y
vient d'une source unique. Les cinq sous-parties (Revue de résultats, États
financiers, Dossier A4, Publications, Fiche Quant) suivent la même discipline.

Critère de réussite : une personne qui ouvre la fiche comprend en un écran ce que
dit la séance, ce que dit le titre et ce que vaut l'entreprise, et aucun chiffre
n'a deux valeurs différentes sur la fiche et ses sous-pages.

## 2. Structure de la fiche

Barre collante : code, cours et variation, puis « L'essentiel · Aujourd'hui · Le
titre · L'entreprise · Mon suivi », puis les documents (Revue de résultats, États
financiers, Dossier A4, Publications, Fiche Quant).

**En-tête**
- Identité : logo, code, nom, pastilles pays / secteur / rendement (avec l'exercice
  du dividende).
- Cours, variation, date de séance, source.
- Actions : Suivre (watchlist), Créer une alerte de prix, Fiche Quant · Combined
  Alpha, Classement complet.
- Graphique de séance : instantanés `brvm_intraday_snapshots` du jour (pas de
  15 min, tracé en escalier, volume cumulé). Absent si aucun instantané.
- Grille des 13 chiffres de séance (ouverture, plus haut, plus bas, clôture
  précédente, volume, volume moyen 20 j, valeur échangée, transactions, bêta,
  capitalisation, titres totaux, flottant avec %, rendement net avec exercice).
- Trois jauges verticales « 1 jour / 52 semaines / 2 ans » (haut, bas, repère du
  cours, dates des extrêmes).
- Bandeau de verdict : **note A–F en grand**, signal (Achat / Attente / Vente via
  `lib/signalLabel.ts`, score à deux décimales, qualité des données), tendance
  20 séances (couleur neutre), plage observée 2 ans.

**L'essentiel** : quatre cartes cliquables (Aujourd'hui, Le titre, L'entreprise,
Négociabilité), chacune un constat chiffré tiré des mêmes données que son chapitre.

**1 · Aujourd'hui** : « Ce que dit la séance » (synthèse en tête, 7 constats et
« ce que ce commentaire ne dit pas » repliés), séance en chiffres, carnet d'ordres,
liquidité (classe, score, part des séances échangées, coût aller-retour et barème,
valeur par séance, fourchette mesurée, flux, Amihud, source, lien SGI).

**2 · Le titre** : graphique cours et volume (composant existant : périodes,
jour/semaine, ligne/bougies, tracé, MA, EMA, Bollinger, Donchian, RSI, MACD,
repères AG/RT avec légende). Puis **une seule lecture technique** qui remplace la
jauge, l'analyse technique, le signal quantitatif et les indicateurs historiques :
échelle du score avec seuils ±0,6, « ce qui soutient / ce qui retient / neutres »,
RSI et MACD historiques, synthèse des 7 indicateurs, tendance court terme,
saisonnalité, détections, votre position, sous-scores et indicateurs utilisés
repliés, lien vers tous les signaux.

**3 · L'entreprise** : alerte de perte si résultat négatif ; CA et résultat net
5 ans (constructeur de graphique replié dessous, il remplace le doublon) ; détail
du dernier exercice (exploitation, hors exploitation, impôt, résultat net,
évolution formulée « perte réduite / aggravée » quand les deux exercices sont en
perte) ; valorisation et solidité (PER ou « non calculable », P/B, P/S, ROE, marge,
dette / fonds propres, BPA, juste-valeur et qualité de l'estimation, Piotroski,
Altman, note de bas sur la source des fondamentaux) ; dividendes (historique
5 exercices, dernier versement, détachement, rendement libellé avec son exercice) ;
événements avec « Lire l'analyse » ; bloc **Westbourse Combined Alpha** (texte
d'explication, score, rang, 5 piliers, pénalité, date de calcul, liens).

**4 · Mon suivi** : thèse, outils (watchlist, alerte, backtest, rapport PDF,
CSV, analyser), questions à l'assistant (les 4 actuelles), discussions.

Mobile : une colonne, chapitres en onglets défilants, note et signal sous le prix.

## 3. Sous-parties

- **Revue de résultats** : phrase de synthèse construite sur 4 chiffres, 4 KPI,
  cascade exploitation → résultat net, tableau N / N-1 avec évolutions en mots,
  5 exercices, dividende, « à suivre ». Supprimer le graphique de dividende à une
  seule barre.
- **États financiers** : tableaux d'abord (compte de résultat, bilan, flux, 5 ans,
  « — » = poste non extrait), puis **vue en flux** (onglets, bascule barres / flux,
  choix de l'exercice) : compte de résultat (ressources → charges et impôt, la
  perte apparaît comme ressource pour équilibrer), bilan (actif → capitaux propres,
  dette, autres passifs), trésorerie (« non disponible » si non extrait). Ratios
  groupés avec leur formule, constructeur de graphique, plage 52 semaines, sources,
  diagnostic Premium.
- **Dossier A4** : format, marges et hauteur des feuilles **inchangés**. Feuille 1 :
  « En une page » et sommaire paginé dans l'espace vide. Corrections par panneau
  (§4).
- **Publications** : trois documents clés, recherche, filtres avec compteurs,
  liste par année, titres harmonisés à l'affichage.
- **Fiche Quant** : bandeau de date de calcul si plus ancienne que la dernière
  séance, décomposition piliers − pénalité = score, barres neutres avec repères 50
  et 65, garde-fous, limites du score, accents restaurés.

## 4. Source unique des chiffres

Un module pur `lib/fiche/donnees.ts` calcule une fois, pour un code et une séance,
tout ce que la fiche et ses sous-pages affichent : plages (1 j, 52 sem., 2 ans),
ratios, lecture technique, dividende courant (montant + exercice), évolution du
résultat. Fiche, revue, états financiers et dossier lisent ce module ; aucun ne
recalcule de son côté. Tests purs sur les cas STAC (perte, dividende ancien,
fonds propres faibles) et sur une valeur bénéficiaire.

Règles :
- Plus bas / plus haut 52 semaines : fenêtre de 365 jours **inclusive**, clôtures
  > 0 (STAC : 925 au 6 nov. 2025, pas 405, qui est le plus bas sur 2 ans).
- PER : « non calculable » si BPA ≤ 0, jamais une valeur négative.
- Taux de distribution : « sans objet » si résultat ≤ 0.
- Part non opérationnelle : afficher le **montant** (résultat avant impôt −
  résultat d'exploitation), jamais un pourcentage quand l'exploitation est en perte.
- Dividende : un rendement affiché porte l'exercice du dividende ; un dividende
  vieux de plus d'un exercice n'est pas un point d'appui.
- Détection « Volume > moyenne » : volume du jour > volume moyen 20 j (le code
  actuel teste `volume > 0`).
- Bandeau : `libelleSignal(signal.signal)` et score `toFixed(2)` (aujourd'hui
  « Signal HOLD · score 0 », `app/actions/[code]/page.tsx:595`).
- Note d'analyse (`/actions/[code]/rapport`) : « CONSERVER » remplacé par le libellé
  de `lib/signalLabel.ts`.

## 5. Écarts de données connus (lot séparé, à trancher par l'exploitant)

- Note B+ (fiche) contre « notation non disponible » (dossier).
- Fiche Quant du 5 oct. 2026 : liquidité 46 contre 34 (fiche).
- Libellé Quant « Risque élevé, éviter » : consigne, pas constat.
- Publications : filtres = 50 documents sur 55.
- Plus bas intraday relevé 1 800 contre plus bas publié 1 830 (séance du 6 nov.).
- Juste-valeur par multiples P/B quand les fonds propres sont quasi nuls.

Aucune de ces données n'est modifiée sans source (règle permanente).

## 6. Hors périmètre

- Le contenu des 7 constats et des 4 réserves de « Ce que dit la séance ».
- Le moteur de signaux et ses seuils (règle du banc d'évaluation).
- Les dimensions du dossier A4.

## 7. Contraintes et vérification

- Aucun `loading.tsx` au-dessus de `/actions/[code]` (soft-404).
- Jetons du design system, `.tabular` pour les chiffres, libellés de signal via
  `lib/signalLabel.ts`, aucun libellé HOLD / BUY / Conserver à l'écran.
- État vide pour chaque bloc (pas d'instantané, pas de comptes, pas de dividende,
  pas de flux).
- Vérification : tsc, tests purs, `eval:visual` sur la fiche et les 5 sous-pages
  (sombre / clair × 1440 / 375), critique `design-critic` ≥ 7/10, puis aperçu
  Vercel avant toute fusion.
