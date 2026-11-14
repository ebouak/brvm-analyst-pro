# Charte graphique Westbourse

12 novembre 2026. Source : charte rédigée par l'exploitant (artefact « Charte graphique Westbourse »).
`DESIGN.md` prime sur cette charte pour les jetons existants.

> **Exception écrite (décision du 12/11/2026)** : la règle « pas de photo » (§1) s'applique au site
> et à la page d'accueil. Les **documents imprimables** (Dossier valeur, Revue, Relevé) portent une
> photo d'ACTIVITÉ en couverture et sur la page « L'essentiel » (`lib/document/activite.ts`) :
> photo du métier, jamais de la société, sans marque lisible, crédit du photographe affiché.

## 1. Principes

Westbourse doit se lire comme une cote de bourse relue le soir : exacte, posée, ouest-africaine.

1. **Le chiffre est le visuel.** Pas de photo, pas d'illustration décorative (voir l'exception ci-dessus). Un grand nombre, une courbe ou une lettre de note occupent la place qu'une image prendrait ailleurs.
2. **Un seul accent.** Le cyan signale ce qui est interactif ou mis en avant. Le vert et le rouge signifient hausse et baisse, et rien d'autre.
3. **Aucun chiffre sans source.** Toute donnée affichée porte sa source, sa date et son heure. Une donnée absente se dit, elle ne se remplace pas.
4. **Le mouvement explique.** Une animation montre une donnée qui se construit ou attire l'œil sur une action. Elle ne décore jamais et s'arrête pour qui a désactivé les animations.

## 2. Logo

W blanc dont le dernier trait devient une flèche verte montante, sur un carré bleu nuit arrondi. Référence : `frontend/public/icon.svg`.

| Élément | Valeur |
| --- | --- |
| Fond du symbole | Bleu nuit `#0C1D2E`, rayon de 17 % du côté |
| Lettre W | Blanc `#FFFFFF`, trait de 12 unités, extrémités arrondies |
| Flèche | Vert sarcelle `#16B6A4`, même épaisseur, pointe pleine |
| Mot-symbole | WESTBOURSE en capitales, graisse 600, interlettrage 0,28 em |
| Taille minimale | Symbole seul : 24 px. Symbole et mot : 120 px de large |
| Zone de protection | Une demi-hauteur de symbole, libre sur les quatre côtés |

Versions : symbole et mot (en-tête, pied, documents) ; symbole seul (icône, favicon, avatars). Sur fond clair, le symbole garde son carré ; le mot passe en `#201C17`.
Animation : W tracé en 0,6 s, flèche en 0,4 s, pointe en 0,3 s, une fois, jamais en boucle.
Interdits : changer les couleurs du symbole, étirer, incliner, ombre, contour, symbole sans carré sur fond chargé, « WESTBOURSE » en capitales dans un texte courant.

## 3. Couleurs

Deux thèmes, mêmes noms de jetons. Jamais de couleur en dur dans un composant.

| Jeton | Sombre | Clair | Rôle |
| --- | --- | --- | --- |
| `bg` | `#030303` | `#FAF8F4` | Fond de page |
| `surface` | `#0A1417` | `#FFFFFF` | Cartes, panneaux, en-tête |
| `elevated` | `#112B33` | `#FFFFFF` | Survol, pastilles neutres |
| `border` | `#1B2A30` | `#ECE6DA` | Filet standard, 1 px |
| `nuit` | `#102B35` | `#102B35` | Aplats sombres, identiques dans les deux thèmes |
| `ivory` | `#FCFCFC` | `#201C17` | Texte principal, titres |
| `muted` | `#B5B5B5` | `#574E40` | Texte secondaire |
| `faint` | `#7A8A90` | `#6E6556` | Unités, notes, sources |
| `accent` | `#56D7FD` | `#09758F` | Aplats, filets, courbes, bouton principal |
| `accent-ink` | `#56D7FD` | `#076880` | Tout texte cyan |
| `up` | `#3FE18B` | `#0A7844` | Hausse |
| `down` | `#FF6B6B` | `#B3261E` | Baisse |
| `warn` | `#F0B23A` | `#8A5A10` | Attente, avertissement |

Règles : cyan ≤ 10 % d'un écran, un seul bouton plein cyan par écran ; vert/rouge jamais « succès/erreur » génériques ; une variation se lit sans la couleur (▲/▼ et signe) ; texte presque noir (`#03140B`, `#1C0505`) sur case pleine verte/rouge, couleur vive sur case teintée à 14 % ; sections alternées sombre/clair ; aucun dégradé, aucun halo.

## 4. Typographie

Geist (lire), Instrument Serif italique (souligner, un groupe de mots en fin de titre au plus), Geist Mono (compter). Graisses 400-600, jamais 700+.

| Niveau | Taille | Graisse | Interlignage | Interlettrage |
| --- | --- | --- | --- | --- |
| Titre d'ouverture | 48 à 132 px | 600 | 0,96 | −0,055 em |
| Titre de section | 34 à 72 px | 600 | 1,02 | −0,045 em |
| Titre de carte | 27 px | 600 | 1,1 | −0,03 em |
| Chiffre géant | 64 à 160 px | 600 | 0,95 | −0,06 em |
| Accroche | 18 à 24 px | 400 | 1,4 | 0 |
| Texte courant | 15 à 17 px | 400 | 1,5 | 0 |
| Étiquette | 12 à 14 px | 500 | 1,4 | 0 |
| Sur-titre capitales | 11 px | 600 | 1,2 | +0,14 em |

Chiffres à la française (virgule, espace fine, espace avant % et FCFA, moins typographique), chiffres tabulaires en colonne, trois tailles au plus par carte, corps minimal 12 px écran / 9 pt papier.

## 5. Mise en page

Colonne de 1 152 px, grille 12 colonnes (gouttière 20 px), marges 24 px sous 768 px, 56 px au-delà ; espaces entre sections 72 à 150 px ; pas de 4 px.
Rayons : pilule (999 px) boutons/champs/pastilles, 28 px grandes cartes, 24 px cartes secondaires, 12 px cases, 6 px feuille A4 à l'écran.
Une section = un titre, une phrase, un élément fort. Une carte domine dans une rangée. Pas d'ombre (sauf bandeau flottant). Aucun tableau ne déborde à 390 px. Cibles de 44 px.

## 6. Composants

Bouton principal (pilule `accent`, texte `#00141A`, 48-52 px, un par écran) ; bouton secondaire (pilule à filet) ; lien d'action (`accent-ink` + ›) ; pastille de canal ; pastille d'état (point 8 px) ; carte de fonction 300 × 520 ; tuile de chiffre ; case de valeur 86 × 74 ; champ e-mail pilule 48 px ; cadenas 11 px ; bandeau flottant.
Encart publicitaire : étiqueté « PUBLICITÉ » hors de l'encart, carte deux moitiés 600 × 240, fond clair neutre, jamais nos accents, aucune animation, un seul par page, jamais au-dessus de notre premier contenu.
Icônes : trait 2 px, grille 24 px, pas d'émoji, toujours avec libellé (sauf loupe et fermeture).

## 7. Données et graphiques

Chiffre = étiquette, valeur Geist Mono, unité plus petite, ligne de source (« Source BRVM · relevé le 11/11 à 17:04 UTC »). Variation nulle « 0,00 % » grise ; absente « non disponible » ; montants en M / Md avec deux décimales.
Courbe : un trait `accent` 1,5-2,5 px, comparaisons grises, pas de quadrillage/cadre/légende, deux repères pointillés au plus, pastille sur le dernier point. Barres : valeur écrite, barre mise en avant `accent`, hausse/baisse de part et d'autre d'un axe central. Note A-F : lettre géante `accent` + « note indicative, pas un conseil en investissement ».
Documents A4 : fond blanc, encre `#12161C`, accent `#0E6F86`, SVG identiques écran/papier, société + page + mention légale sur chaque page.

## 8. Mouvement

| Animation | Durée | Courbe |
| --- | --- | --- |
| Entrée d'un bloc (montée 26 px + fondu) | 0,9 s | `cubic-bezier(.2,.7,0,1)` |
| Titre mot par mot | 0,9 s/mot, décalage 0,07 s | ressort |
| Tracé de courbe | 2 à 3 s | accélération puis frein |
| Compteur | 1,5 s | frein fort |
| Vague de cases | 0,55 s/case, 20 ms | ressort |
| Barres | 1,1 s | frein |
| Survol carte / bouton | 0,5 s / 0,3 s | frein / ressort |
| Bandeau de mots | 38 à 46 s/boucle | linéaire |
| Film de séance | 20 s, 5 scènes | coupes franches |

Courbes : frein `cubic-bezier(.2,.7,0,1)`, ressort `cubic-bezier(.34,1.56,.64,1)`, rideau `cubic-bezier(.76,0,.24,1)`.
Une entrée ne se rejoue pas ; trois boucles seulement (point de l'indice, bandeau, film avec pause) ; rien avant 100 ms ni après 3 s (hors film/bandeau) ; on anime position, échelle, opacité, jamais largeur/hauteur ; `prefers-reduced-motion` = état final partout ; ni encarts ni formulaires animés.

## 9. Ton et rédaction

Westbourse constate, mesure, cite. Ni prédiction, ni conseil, ni enthousiasme. Phrases courtes au présent ; titres en deux temps (constat, puis précision en italique) ; vouvoiement ; ni point d'exclamation, ni émoji, ni superlatif.
Mots proscrits dans un rapport ou une page publique : acheter, vendre, opportunité, objectif de cours, recommandation, garanti, sans risque (et BUY, HOLD, SELL : on écrit haussier, neutre, baissier).
Sigles expliqués à la première occurrence (SGI, IRVM, PER).
Mentions : « Source BRVM · relevé le JJ/MM à HH:MM UTC » sous tout chiffre de marché ; « Pas un conseil en investissement. » sous toute note, signal, simulation ; « Les performances passées ne préjugent pas des performances futures. » sous toute performance passée ; avertissement complet en pied de page.

## 10. Accessibilité et points tranchés

Contraste 4,5 (3 pour les titres > 24 px), tout au clavier avec focus visible 2 px, graphiques décrits (tendance et bornes), champs libellés, boutons à icône nommés, variation lisible sans couleur.

| Sujet | Décision |
| --- | --- |
| Deux couleurs d'accent | Le vert sarcelle `#16B6A4` reste réservé au logo |
| Fonds de la maquette | Jetons du site (`#030303`, `#FAF8F4`), pas `#000000` / `#F5F5F7` |
| Polices | Geist et Instrument Serif, d'abord sur l'accueil (`.vitrine`) |
| Inscription | Champ e-mail branché sur le lien magique existant, Google en lien secondaire |
| Signaux | « haussier, neutre, baissier » partout |
| Boucles | Méthode et explorateur s'arrêtent après deux tours ou au premier survol |
