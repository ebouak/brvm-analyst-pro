# Refonte de la page d'accueil de WESTBOURSE

À coller dans Claude Code (VS Code), à la racine du dépôt `ebouak/brvm-analyst-pro`.
Fichier joint à placer d'abord dans le dépôt : `docs/maquettes/maquette-accueil-westbourse.html`.

---

## 0. Ta mission

Reconstruire la page d'accueil publique (`frontend/app/page.tsx` et `frontend/components/landing/`) d'après la maquette jointe, avec des données réelles lues en base, et la rendre nettement plus animée que l'actuelle. La maquette fixe l'ordre des sections, la hiérarchie, le ton et le mouvement. Elle ne fixe pas le code : elle est écrite dans un format de maquette, tu la réécris en composants React du dépôt.

### Avant de coder

1. Lis `CLAUDE.md`, `DESIGN.md`, `frontend/app/page.tsx`, tout `frontend/components/landing/bis/`, `frontend/app/globals.css`, `frontend/tailwind.config.ts`, `frontend/lib/navRegistre.ts`.
2. Ouvre `docs/maquettes/maquette-accueil-westbourse.html` et lis-la en entier : balisage, bloc `<style>`, et la classe `Component` en bas de fichier, qui contient toute la logique d'animation et d'interaction.
3. Fais l'inventaire de ce que la page actuelle charge déjà (requêtes Supabase, composants serveur, cache) : tu réutilises ces lectures, tu n'en dupliques aucune.
4. Rends-moi un plan en dix lignes au plus : composants créés, composants supprimés, données lues, risques. Attends mon accord avant d'écrire du code.

### Règles qui ne se négocient pas

- **Aucun chiffre en dur.** Tous les nombres de la maquette (517,17, 210 membres, 48 valeurs, scores, rendements) sont ceux du 11/11/2026 : ce sont des exemples. Chaque nombre vient d'une lecture en base ou d'un calcul testé. Une donnée absente s'affiche « non disponible ».
- **Conformité.** Aucune recommandation d'achat ou de vente, aucune prévision, aucune cause affirmée. Les mots « achat », « vente », « acheter », « vendre », « opportunité », « objectif de cours », « BUY », « SELL » n'apparaissent pas sur la page. On écrit « haussier, neutre, baissier ». Chaque note, signal ou simulation porte « Pas un conseil en investissement ».
- **Chaque chiffre de marché porte sa source et son heure** : « Source BRVM · relevé le JJ/MM à HH:MM UTC ».
- **Composants serveur par défaut.** Seuls les blocs interactifs ou animés sont des composants client, les plus petits possibles.
- **Tout fonctionne sans animation** : avec `prefers-reduced-motion`, chaque élément s'affiche dans son état final.
- **Français soigné**, nombres à la française via `lib/format` (virgule, espace fine, signe moins typographique, espace avant % et FCFA).
- Tu n'envoies aucun e-mail ni message réel, tu ne déploies rien, tu ne fusionnes rien : tu ouvres des PR.

---

## 1. Identité visuelle

Référence : la charte graphique (https://claude.ai/artifact/EdFPy5CBx2PE84N6Uk8px2). En cas de doute, la charte prime sur la maquette, et `DESIGN.md` prime sur la charte pour les jetons existants.

### Polices
- Remplace Supreme et Bespoke Serif (chargées depuis Fontshare dans `app/layout.tsx`) par **Geist**, **Instrument Serif** (italique) et **Geist Mono**, via `next/font/google`, avec `display: 'swap'` et les sous-ensembles latins.
- Branche-les sur les variables existantes : `--font-sans` → Geist, `--font-display` → Geist pour les titres, nouvelle variable `--font-accent` → Instrument Serif italique, `--font-mono` → Geist Mono. Retire le `<link>` Fontshare et le `<link>` JetBrains Mono.
- **Périmètre : la page d'accueil seulement dans cette PR.** Mets le changement derrière une classe sur la racine de la page (`.vitrine`) pour ne pas modifier le reste du site. La bascule globale fera l'objet d'une PR séparée, après mon accord.
- Un titre contient au plus un groupe de mots en Instrument Serif italique, en fin de titre.

### Couleurs
- La maquette utilise un noir pur `#000000`, un gris clair `#F5F5F7` et des gris de carte `#101214`. **Ne les reprends pas** : utilise les jetons du site (`bg`, `surface`, `elevated`, `border`, `nuit`, `ivory`, `muted`, `faint`, `accent`, `accent-ink`, `up`, `down`).
- Les sections « claires » de la maquette utilisent le thème clair du site (`data-theme="light"` posé sur la section), les sections sombres le thème sombre. La page alterne les deux quel que soit le thème choisi par l'utilisateur.
- Le logo garde ses couleurs (`#0C1D2E`, blanc, `#16B6A4`). Réutilise `components/brand/AnimatedLogo`.

### Formes
- Boutons et champs en pilule, grandes cartes à 28 px de rayon, cases de mosaïque à 12 px. Pas d'ombre sur les cartes, pas de dégradé, pas de flou.

---

## 2. Système de mouvement

`framer-motion` est déjà dans les dépendances : utilise-le pour les entrées au défilement, les séquences et les ressorts. Les boucles simples (bandeau de mots, point qui pulse) restent en CSS.

Crée `frontend/components/vitrine/mouvement/` avec ces briques, toutes testées et toutes neutres sous `prefers-reduced-motion` :

| Brique | Rôle | Réglages |
|---|---|---|
| `Apparition` | Entrée d'un bloc au défilement, une seule fois | montée de 26 px et fondu, 0,9 s, `cubic-bezier(.2,.7,0,1)`, seuil 15 % |
| `TitreMots` | Titre révélé mot par mot | ressort, 0,07 s de décalage, chaque mot masqué par son conteneur |
| `Compteur` | Chiffre qui défile jusqu'à sa valeur | 1,5 s, frein fort, chiffres tabulaires, valeur finale rendue côté serveur |
| `TraceCourbe` | Courbe SVG qui se trace | 2 à 3 s, `pathLength` |
| `Vague` | Entrée décalée d'une liste d'éléments | 20 ms par élément, ressort |
| `BarreQuiPousse` | Barre horizontale ou verticale | 1,1 s, `transform: scale`, jamais `width` |
| `Bandeau` | Texte défilant en boucle | CSS, 38 à 46 s par boucle, pause au survol |
| `Sequence` | Enchaînement de scènes minutées avec pause | voir « Film de séance » |

Règles : on anime uniquement `transform` et `opacity` ; aucune animation ne décale la mise en page ; une entrée ne se rejoue pas ; rien ne démarre hors écran ; toute boucle a un moyen d'arrêt ou s'arrête à la première interaction.

---

## 3. La page, section par section

Dans l'ordre de la maquette. Pour chaque section : crée un composant dans `frontend/components/vitrine/`, branche-le sur des données réelles, supprime le composant `landing/bis` qu'il remplace quand il n'est plus importé nulle part.

### 3.1 En-tête
Logo animé une fois, cinq liens de rubrique, recherche, « Connexion », bouton « Créer un compte ». Si le lot « barre de cote » (autre prompt) est déjà livré, utilise ce composant à la place.

### 3.2 Ouverture
- Pastille d'état : « Séance du … · marché ouvert / fermé », depuis la logique d'horaires existante.
- Titre mot par mot : « Toute la BRVM. *Au chiffre près.* »
- Sous-titre, puis **champ e-mail + « Créer mon compte gratuit »**. `app/login/SignInClient.tsx` propose déjà `signInWithOtp` : le champ lance ce parcours (lien magique), avec les mêmes validations et le même message de confirmation que la page de connexion. Ajoute « Continuer avec Google » en lien secondaire.
- Ligne de réassurance : « Sans carte bancaire · N membres inscrits · désabonnement en un clic ». Le nombre de membres vient de la même source que la page actuelle.
- Deux pastilles « sans compte » : chaîne WhatsApp et canal Telegram. Les adresses sont dans `remotion/canaux.json` : sors-les dans une constante partagée (`lib/canaux.ts`) et utilise-la partout.

### 3.3 Scène de l'indice
- Grand chiffre du BRVM Composite, variation du jour, courbe des 60 dernières séances.
- À l'ouverture, la courbe se rejoue en 3 s et le chiffre suit les valeurs réelles. Au survol ou au doigt, on remonte séance par séance, avec **la vraie date** de chaque séance (la maquette n'affiche que « il y a N séances » faute de dates).
- Barre de lecture : bouton rejouer, piste cliquable, « Séance 60 / 60 ».
- Barre hausses / stables / baisses qui pousse.
- Accessible : la courbe a une description textuelle, et un tableau des valeurs est disponible pour les lecteurs d'écran.

### 3.4 Bandeau de mots
Deux lignes qui défilent en sens opposés, composées avec les chiffres de la séance (indice, variation, hausses, baisses, capitaux, plus forte hausse et baisse). Décoratif : `aria-hidden`, puisque tout y est déjà dit ailleurs.

### 3.5 Mosaïque « 48 valeurs. Une séance. »
- Une case par action cotée, triée de la plus forte hausse à la plus forte baisse, entrée en vague.
- Hausse ou baisse d'au moins 1 % : case pleine, texte presque noir. En dessous : case teintée, texte coloré. Stable : gris.
- Survol, focus ou toucher : la case grossit et une ligne lue par les lecteurs d'écran affiche code, cours et variation. Clic : fiche de la société.
- Sous la mosaïque, une carte d'incitation : « Suivez ces 48 valeurs depuis votre liste » + bouton d'inscription.

### 3.6 Film de séance
- Cadre 16:9, 20 secondes, cinq scènes : date ; indice (chiffres qui roulent comme un compteur, courbe qui se trace) ; quatre plus fortes variations en barres ; hausses, stables, baisses ; appel à s'abonner.
- Bouton pause, barre de progression, lecture seulement quand le cadre est à l'écran.
- Écris-le avec la brique `Sequence` et des unités relatives au cadre (`cqw`). **N'embarque pas le lecteur Remotion** sur la page d'accueil : il pèse trop lourd. Le dossier `remotion/` reste réservé aux vidéos exportées.
- Sous le film : « Le film de la séance, chaque soir, sans compte » + boutons WhatsApp et Telegram.

### 3.7 Rail « Découvrir Westbourse »
Cinq grandes cartes à faire défiler : Notes A–F (lettre qui roule jusqu'à la meilleure note du jour), Dossier valeur (trois feuilles en éventail), Événements (réaction mesurée après une publication), Dividendes (barres par exercice), Comparateur SGI (nombre de SGI agréées). Chaque carte prend un exemple réel du jour et mène à la page concernée.

### 3.8 Explorateur « Quatorze outils. Un seul compte. » (nouveau, prioritaire)
Ces fonctions clés ne sont pas mises en avant aujourd'hui. Une rangée de quatorze pastilles et un grand panneau : choisir une pastille affiche l'outil, avec une petite démonstration animée sur les chiffres de la séance. Le panneau avance seul toutes les 6 s tant que la section est à l'écran, et s'arrête définitivement à la première interaction.

| # | Outil | Route | Démonstration (données réelles) |
|---|---|---|---|
| 1 | Screener multi-critères | `/screener` | Trois filtres actionnables (dividende > 3 %, liquidité A ou B, RSI < 45) sur les 20 premières valeurs par score ; le compte et la liste se mettent à jour |
| 2 | Scanner technique | `/scanner` | Critères combinables (RSI, moyennes mobiles, MACD, volume), et RSI et MACD d'une valeur du jour |
| 3 | Signaux | `/signaux` | Répartition haussier / neutre / baissier de la séance ; si aucun signal haussier, le dire : « le moteur s'abstient » |
| 4 | Saisonnalité | `/saisonnalite` | Grille des douze mois d'un titre : variation habituelle et part des années où elle s'est vérifiée |
| 5 | Combined Alpha | `/analyse/combined-alpha` | Meilleur score du classement et ses cinq piliers en barres |
| 6 | Backtest | `/backtest` | Choix de période et courbe rejouée |
| 7 | Liquidité du marché | `/liquidite` | Les cinq meilleurs scores et leur classe |
| 8 | Dividendes | `/dividendes` | Les cinq meilleurs rendements du dernier exercice |
| 9 | Fiscalité (IRVM) | `/fiscalite` | Choix du pays → retenue et net pour 100 000 FCFA bruts, depuis la table des taux vérifiés ; « non confirmé » reste « non confirmé » |
| 10 | Et si vous aviez investi ? | `/simulateur` | Un résultat réel du simulateur, dividendes inclus |
| 11 | Portefeuille virtuel | `/premium/paper-trading` | Capital fictif, cours réels, classement sous alias |
| 12 | Valorisation (Pro) | `/premium/valorisation` | Nombre de sociétés valorisables et multiples d'une valeur |
| 13 | Diagnostic (Pro) | `/premium/diagnostic` | Les étapes de contrôle, et la date du dernier diagnostic généré |
| 14 | Poser une question (Pro) | `/assistant` | Trois modèles de question réels, et l'avertissement « vous échangez avec une IA » |

- Libellés d'accès (« Accès libre », « Compte gratuit », « Premium ») : lis-les dans `navRegistre.ts` et le middleware, ne les suppose pas. La maquette en a supposé certains.
- Chaque panneau a un lien vers sa page. Une seule route d'API mise en cache (`/api/vitrine/outils`, 5 min) fournit les données des quatorze démonstrations ; le premier panneau est rendu côté serveur.
- Sémantique : la rangée est une liste d'onglets (`role="tablist"`), flèches gauche et droite pour changer, le panneau est annoncé.
- Dans la démonstration « Valorisation », n'affiche ni « potentiel », ni pourcentage de décote : seulement les multiples et la mention « estimation, pas un objectif de cours ».

### 3.9 Méthode en sept étapes
Reprend `DataToDecision` : sept étapes, un trait lumineux qui parcourt la ligne, chaque étape s'allume à son tour. Deux tours puis arrêt. Conserve le « fait du jour » réel de chaque étape, déjà calculé par la page actuelle.

### 3.10 Tuiles de séance
Trois tuiles : secteurs en barres de part et d'autre du zéro, échanges (capitaux, titres, transactions, avec compteurs), communauté (nombre de membres, bouton d'inscription).

### 3.11 Encart publicitaire
Un seul emplacement, étiqueté « PUBLICITÉ », après les tuiles de séance. Reprends le composant et la source des campagnes actuels (`Billboard` / `HeroCarousel`) ; si plusieurs campagnes sont actives, elles alternent à chaque chargement, sans carrousel animé. L'encart ne s'anime pas.

### 3.12 Provenance
« Chaque chiffre a une source, une date, une heure. » : quatre cartes (la source, un chiffre du jour, l'heure de collecte, ce qui manque). Reprend `PreuveDonneeBis`.

### 3.13 Canaux « La BRVM vient à vous. »
Trois cartes : WhatsApp (échange d'exemple produit par le vrai code des commandes, quota gratuit lu dans la configuration), Telegram (les cinq lignes du brief du jour, bulle par bulle), e-mail (formulaire branché sur `NewsletterForm`). Messages de confirmation réels, pas ceux de la maquette.

### 3.14 Bas de page (à conserver tel qu'il est aujourd'hui)
- « Commencez par explorer. Gratuitement. » : cinq points cochés un à un, bouton d'inscription.
- Les deux offres, Gratuit et Premium, avec les prix lus dans la configuration de facturation. Dans l'offre Premium, écris « Signaux quotidiens », pas « Signaux BUY / HOLD / SELL ».
- Le bloc sombre « Votre première analyse peut commencer maintenant. » avec ses quatre piliers.
- **Le pied de page actuel, inchangé** : mêmes colonnes, mêmes liens, cadenas, sources officielles, avertissement complet.

### 3.15 Bandeau flottant
En bas d'écran, apparaît quand le champ d'inscription de l'ouverture sort de l'écran, disparaît près du bloc final. Bouton d'inscription, lien WhatsApp, bouton pour le masquer (choix mémorisé pour la session). Jamais affiché à un utilisateur connecté.

### Sections retirées de l'accueil
« Quatre façons de travailler le marché » (remplacée par l'explorateur), le carrousel publicitaire en deuxième position, la recherche en langage naturel et « Nos articles » : déplace ces deux dernières vers `/societes` et `/analyses` si elles n'y sont pas déjà, ne supprime pas leurs composants sans vérifier.

---

## 4. Incitations à l'inscription : mesure

- Sept points d'inscription sur la page : en-tête, ouverture, sous la mosaïque, sous l'explorateur, tuile communauté, bloc final, bandeau flottant. Trois points d'abonnement aux canaux : ouverture, sous le film, section canaux.
- Envoie un événement d'analyse par clic avec l'emplacement (`vitrine_inscription_clic { emplacement }`, `vitrine_canal_clic { canal, emplacement }`), via l'outil d'analyse déjà installé. Aucune donnée personnelle dans l'événement.
- Un utilisateur connecté ne voit aucune incitation à s'inscrire : les boutons deviennent « Mon tableau de bord ».

---

## 5. Performance, accessibilité, référencement

- Plus grand élément visible en moins de 2,5 s sur mobile milieu de gamme ; aucun décalage de mise en page (CLS < 0,05) ; moins de 170 ko de JavaScript propre à la page, compressé.
- Le titre, le sous-titre et le chiffre de l'indice sont dans le HTML initial. Les blocs sous la ligne de flottaison se chargent à l'approche (`dynamic` + observateur).
- Contrastes AA dans les deux thèmes, parcours complet au clavier, cibles de 44 px, focus visible. Vérifie avec axe et à la main.
- Conserve les métadonnées, données structurées et balises existantes de la page ; mets à jour le titre et la description si le texte d'ouverture change.
- Mobile d'abord : vérifie à 390, 768, 1024 et 1440 px. Aucun défilement horizontal en dehors du rail.

---

## 6. Défauts repérés sur les pages d'outils (PR séparée, après l'accueil)

Constatés le 12/11/2026 en production. Vérifie chacun avant de corriger.

- `/signaux` : les compteurs s'intitulent « Signaux Achat », « Signaux Vente », alors que les filtres disent « Haussier », « Baissier ». Aligner sur haussier, neutre, baissier. Le libellé « 48 signals » est en anglais.
- `/backtest` : le texte d'en-tête écrit « = achat », « = vente ».
- `/premium/valorisation` : « potentiel > +15 % », « +630 % » se lisent comme des objectifs de cours. Reformuler en écart entre cours et valeur estimée, avec la réserve.
- `/screener` : variations au format anglais (« +2.94% ») ; même défaut sur `/liquidite` (« 2.47 % »).
- `/saisonnalite` : la liste propose 331 titres, dont des obligations échues depuis 2017. Limiter aux titres cotés, actions d'abord.
- `/analyse/combined-alpha` : « 49 titres » alors que le reste du site annonce 48 valeurs. Expliquer ou corriger l'écart.
- `/premium/paper-trading` : la page reste sur « Vérification du compte… » dans le HTML initial ; prévoir un état de chargement propre.

---

## 7. Livraison

1. **PR 1** : briques de mouvement, polices sur `.vitrine`, sections 3.1 à 3.6. Captures à 390 et 1440 px, thème clair et sombre, plus un enregistrement d'écran de 20 s. Attends mon accord.
2. **PR 2** : sections 3.7 à 3.11, dont l'explorateur.
3. **PR 3** : sections 3.12 à 3.15, événements d'analyse, nettoyage des composants `landing/bis` devenus orphelins, mise à jour de `DESIGN.md` et de `navRegistre` si des libellés changent.
4. **PR 4** : défauts du paragraphe 6.

À chaque PR : `npm run typecheck`, `npm run lint`, `npm test` dans `frontend/`, un test par brique de mouvement et par calcul, et un test qui échoue si un mot interdit apparaît dans `components/vitrine/`. Dis-moi ce que tu as vérifié, comment, et ce que tu n'as pas pu vérifier.
