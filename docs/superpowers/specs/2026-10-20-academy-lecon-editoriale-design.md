# Academy — leçon éditoriale (refonte de la lecture), pilote : leçon 5 dividendes

Date : 2026-10-20 · Statut : plan court validé par le propriétaire (« colonne de
lecture seule » en clair ; le chantier dividendes passe après).

## 1. Problème

La leçon 5 (« Les dividendes : construire un revenu passif grâce à la BRVM »)
s'affiche comme une suite de longs paragraphes, chacun dans un encadré coloré
semblable au précédent. Cause, constatée dans le code : `LessonContent.tsx`
enferme CHAQUE section dans une boîte à bordure, et le schéma de contenu
(`lib/academy/types.ts`) ne sait porter ni formule, ni schéma de mécanisme, ni
graphique calculé, ni frise horizontale. Le libellé de section `cas` affiche
« Cas réel BRVM » même pour une simulation.

## 2. Décisions

- **Une seule architecture.** On étend le schéma existant par des blocs
  OPTIONNELS et on réécrit le rendu de `LessonContent` ; aucun composant
  parallèle propre à la leçon 5. Les 11 leçons existantes restent valides
  (champs facultatifs ; `z.object` ignore l'inconnu côté ancien code).
- **Le rendu est partagé** : toutes les leçons Academy changent d'aspect ; seule
  la leçon 5 reçoit les nouveaux blocs dans cette livraison.
- **Surface de lecture claire, le reste sombre.** L'article passe sur un papier
  blanc chaud (`.lp`, jetons préfixés, même parti pris que `.dv` du dossier
  valeur) ; en-tête, sommaire et colonne d'outils restent dans le thème du site.
- **Aucun chiffre de marché.** Les graphiques sont CALCULÉS au rendu par des
  fonctions pures à partir d'hypothèses écrites dans le contenu, affichées sous
  le graphique avec la mention « Simulation pédagogique ».

## 3. Direction artistique (`.lp`)

| Jeton | Valeur | Usage |
|---|---|---|
| `--lp-papier` | `#fbf8f3` | fond de l'article (blanc chaud) |
| `--lp-encre` | `#0f1f33` | titres, chiffres clés (bleu nuit) |
| `--lp-texte` | `#2b3a4d` | corps |
| `--lp-doux` | `#5d6b7d` | légendes, notes |
| `--lp-trame` | `#e6dfd3` | filets, axes |
| `--lp-accent` | `#0b7d93` | turquoise WestBourse lisible sur clair (le `#56D7FD` du site manque de contraste sur blanc) |
| `--lp-accent-clair` | `#e3f3f6` | aplats discrets |
| `--lp-alerte` | `#a3401f` | pièges |
| `--lp-retenir` | `#8a6a12` | à retenir |

Titres en `font-display` (serif de la marque), corps en `font-sans`, chiffres en
`tabular`. Largeur de lecture ≈ 68 caractères (`max-width: 42rem`), corps 17 px,
interligne 1,65. Sections séparées par l'espace et un filet, jamais par des
boîtes. Les seuls aplats : la formule, le graphique, le tableau. Pièges et
« à retenir » marqués par un filet gauche coloré, pas par un encadré.

## 4. Extension du schéma (toute optionnelle)

Sur `lessonSchema` :
- `sous_titre` (≤ 160) — sous-titre pédagogique de l'en-tête ;
- `avertissement` (≤ 300) — mention réglementaire en pied d'article.

Sur `sectionSchema` :
- `reel` (bool, défaut false) — une section `cas` ne s'intitule « Cas réel
  BRVM » que si `reel` ; sinon « Exemple ». Corrige l'étiquette mensongère.
- `formules` (≤ 3) : `{ nom ≤ 80, expression ≤ 160, exemple ≤ 200 }`.
- `flux` (0 ou 2 à 5 étapes) : `{ titre ≤ 40, detail ≤ 120, icone }`, `icone` ∈
  `entreprise · benefices · decision · actionnaires · paiement · calendrier ·
  graphique · piece` — pictogrammes SVG dessinés en interne (trait, aucune
  dépendance). Chaîne horizontale sur ordinateur, verticale sur mobile.
- `points` (≤ 8) : `{ titre ≤ 80, detail ≤ 300, verifier ≤ 160 facultatif }` —
  liste éditoriale numérotée (critères, pièges, idées essentielles).
- `etapes_style` : `liste` (défaut, frise verticale actuelle) | `frise`
  (horizontale sur ordinateur, verticale sur mobile).
- `simulation` : union discriminée —
  - `{ type: 'reinvestissement', actions, dpa, cours, croissance_pct, annees (2-10) }` ;
  - `{ type: 'objectif', revenu_cible, rendements_pct (2-5 valeurs) }`.

## 5. Calculs (purs, `lib/academy/simulations.ts`, testés)

**Réinvestissement.** Hypothèses affichées : dividende par action ET cours
progressent de `croissance_pct` par an (rendement constant) ; les dividendes de
l'année t sont réinvestis au cours de l'année t, en actions entières, le
reliquat reste en espèces ; brut, sans frais ni impôt. Deux séries :
« conservés en espèces » (actions constantes) et « réinvestis ». Avec 300
actions, 1 000 FCFA, 10 000 FCFA, 5 % : année 1 → 300 000 et 30 actions
achetées ; année 2 → 330 × 1 050 = 346 500 (l'exemple de la leçon, figé par test).

**Objectif.** Capital = revenu cible ÷ rendement : 600 000 → 10 000 000 à 6 %,
7 500 000 à 8 %. Barres horizontales + tableau ; « rendement hypothétique, non
garanti » sous le graphique.

Recharts (déjà en dépendance, `LessonChart`) pour le réinvestissement ; le
comparatif d'objectif en barres CSS (deux à cinq barres n'exigent pas de
bibliothèque). Axes et unités explicites, `role="img"` + `aria-label`
résumant le résultat, tableau des valeurs juste dessous (accès sans le
graphique).

## 6. Rendu de la leçon (dans l'ordre)

En-tête (catégorie · durée · titre · sous-titre · intro ≤ 4 lignes) → image
d'illustration réduite (le titre doit être lu en premier) → sections →
graphiques hérités (`chart`/`charts`) → exercice → quiz (restylé : choix, puis
explication) → avertissement. La navigation précédente/suivante du shell est
conservée.

## 7. Colonne d'outils

Onglets Notes · Glossaire · Ressources · Discussion conservés : onglet actif
souligné turquoise, `role="tablist"`/`aria-selected`, espacements resserrés,
contenu à hauteur maximale `calc(100vh - 8rem)` avec défilement interne
(fenêtre basse). Sauvegarde des notes inchangée. Mobile : le bouton « Outils »
existant ouvre le panneau sous l'article, pleine largeur.

## 8. Contenu de la leçon 5

Réécrit selon la structure B → I du propriétaire (8 sections) avec ses
chiffres : 300 actions · 1 000 FCFA · 300 000 · 10 000 · 10 % ;
réinvestissement 300 → 330 actions, 346 500 ; objectif 600 000 → 10 M à 6 %,
7,5 M à 8 %. Paragraphes courts, aucun « Cas réel » (tout est pédagogique),
précautions conservées, avertissement : « Ceci n’est pas un conseil en
investissement. Les dividendes ne sont pas garantis. Investir en actions
comporte un risque de perte en capital. » Écrit en base APRÈS déploiement du
nouveau rendu (l'ancien ignorerait les blocs et afficherait une leçon amputée),
sauvegarde complète avant, validation par `lessonSchema` avant écriture.

## 9. Vérifications

- Vitest : calculs (346 500, 10 M, 7,5 M), schéma (anciennes leçons et nouvelle
  leçon 5 acceptées, simulation incohérente rejetée).
- `tsc --noEmit` frontend.
- Visuel : `next dev` local avec session connectée, 1440 px, 768 px, 390 px ;
  aucun défilement horizontal (`scrollWidth <= innerWidth`).
- **Limite** : les aperçus Vercel n'autorisent pas la connexion et la leçon est
  derrière le mur Premium — le critère « prévisualisation Vercel » se vérifie en
  local connecté, puis en production après fusion.

## 10. Hors périmètre

Mode présentation (`SlideDeck`) et vidéos Remotion : ils ignorent les nouveaux
blocs (pas de régression, pas d'enrichissement). Les autres leçons gardent leur
contenu ; elles pourront adopter les blocs au fil de la refonte des cours.
