# Comparateur de SGI — audit avant refonte (prompt 1)

Date : 2026-11-04. Aucune modification de code dans cette étape.
Référence visuelle : maquettes « Fintech Premium » (vue d'ensemble desktop +
mobile, puis Trouver ma SGI, Simuler mes frais, Comparer les SGI, Annuaire).

## A. Architecture actuelle

- **Next.js 14.2.35, App Router, React 18**, Tailwind, jetons CSS
  (`--color-*`, clair et sombre). framer-motion 12 déjà installé ; animations
  CSS globales (révélation au défilement `reveal-in`, survol des liens-panneaux).
- **Une seule route** `/comparateur-sgi` (`app/comparateur-sgi/page.tsx`, ISR
  3600 s), rendue dans `PublicShell` (`SiteHeader` + `main max-w-6xl py-8`).
  Publique : préfixe dans `PUBLIC_PREFIXES` (`lib/supabase/middleware.ts`),
  présente dans `ConditionalShell` et le sitemap.
- **Données** (`lib/sgi-frais/queries.ts`, server-only, repli sur les fichiers TS) :
  `sgi_directory` (40 lignes : pays, type, groupe, logo, site, téléphone, e-mail,
  fiche BRVM, `verifie_le`) et `sgi_frais` (37 barèmes, 34 homologués dont 29
  reliés au PDF de leur décision, `courtage_paliers` / `garde_paliers`).
  **Jointure par le NOM** (`sgi_directory.nom` = `sgi_frais.sgi_nom`).
- **Moteurs purs et testés** : `calculateur.ts` (coût par poste, paliers,
  montant par ordre, barèmes incomplets classés après), `moteur.ts` (score
  explicable en 5 critères, 4 profils de priorité), `presentation.ts`
  (décomposition, barres). 40+ tests.

## B. Cartographie des composants

| Fichier | Lignes | Rôle |
|---|---|---|
| `app/comparateur-sgi/page.tsx` | 47 | lit les données, empile Matchmaker + Comparator |
| `components/comparateur-sgi/SgiMatchmaker.tsx` | 330 | questionnaire 5 étapes + résultats |
| `components/landing/SgiComparator.tsx` | 457 | en-tête, rôle de la SGI, **calculateur**, **annuaire**, méthode, FAQ, lien budget |
| `components/comparateur-sgi/CalculateurCout.tsx` | 379 | simulateur (refondu le 2026-11-04, PR #155) |
| `CarteRecommandee`, `ClassementCout`, `TableauResultatCout`, `ChiffreAnime` | 49-218 | résultat, classement animé, tableau détaillé, chiffres animés |
| `components/icons.tsx` | — | 7 icônes seulement (tendances, chevrons) |

Aucun composant de comparaison côte à côte, aucune fiche individuelle de SGI,
aucun en-tête « hero » ni navigation secondaire.

## C. Cartographie des fonctionnalités

| Module | Existe | Incomplet | À créer |
|---|---|---|---|
| Trouver ma SGI | 5 questions (pays, capital, fréquence, autonomie, priorité), score explicable, liens site / fiche BRVM | priorité unique ; capital en 4 tranches seulement ; pas de passage du profil vers le simulateur | écran d'intro, progression animée, retour arrière conservé, actions croisées |
| Simuler mes frais | tout le calcul, décomposition, classement animé, seuil aller-retour | frais achat / vente non séparés à l'affichage ; pas d'« économie vs moyenne » | mise en page 2 colonnes de la maquette, scénario partageable par URL |
| Comparer les SGI | — | — | sélection jusqu'à 3, colonnes, meilleur coût, constats tirés des données, version mobile |
| Annuaire | cartes par pays, recherche, filtre pays | pas de filtre dépôt / courtage / barème / type ; pas de tri ; pas de coût estimé | fiche individuelle par SGI |

## D. Blocages visuels et techniques

| # | Fichier | Problème | Cause | Correction | Risque |
|---|---|---|---|---|---|
| 1 | `components/public/PublicShell.tsx` | le hero pleine largeur de la maquette est impossible | `main` impose `max-w-6xl` et `py-8` à toute page | layout propre à `/comparateur-sgi/*` (hero hors du conteneur, contenu à 1280 px) | faible : le shell des autres pages ne change pas |
| 2 | `SgiComparator.tsx` | une page de 4 modules empilés, très longue | un composant de 457 lignes porte calculateur, annuaire, méthode et FAQ | découper en routes et composants par module | moyen : le SEO de `/comparateur-sgi` doit être conservé (contenu, FAQ) |
| 3 | `SgiComparator.tsx` (drapeaux) | **requêtes vers un tiers** (`flagcdn.com`) à chaque affichage | drapeaux chargés à distance | 7 drapeaux SVG servis par le site | nul ; aligne sur la promesse « aucun traceur » |
| 4 | `components/icons.tsx` | la maquette utilise ~25 icônes, il en existe 7 | pas de jeu d'icônes | `lucide-react` (import par icône, arborescence élaguée) ou SVG maison | faible |
| 5 | `lib/sgi-frais/queries.ts` | une fiche `/annuaire/[slug]` n'a pas d'identifiant stable | jointure et identité par le nom ; SOGEBOURSE a été renommée aujourd'hui | colonne `slug` unique dans `sgi_directory` | moyen : migration de données ; à tester à la clé publique |
| 6 | `SgiComparator.tsx` | « 8 pays » affiché, mais les SGI référencées couvrent **7 pays** | chiffre écrit en dur | dériver le nombre des données (l'UEMOA compte 8 États, aucune SGI en Guinée-Bissau dans l'annuaire BRVM) | nul |
| 7 | `SiteHeader.tsx` | libellés sans accents (« Marches », « Societes », « A propos ») ; menu différent de la maquette | en-tête global | hors périmètre du comparateur (touche tout le site) — décision séparée | moyen si modifié |
| 8 | modules client | tout le scénario vit dans l'état local | aucun partage entre modules | scénario dans l'URL (`?capital=&duree=&achats=&ventes=`) : partageable, sans donnée personnelle, sans stockage | faible |

Rien d'autre de structurel : pas de hauteur fixe ni de `z-index` en conflit
dans les composants du comparateur ; le survol « premium » global ne vise que
les panneaux qui sont des liens (pas de fausse affordance).

## E. Ce que la maquette montre et que les données ne permettent pas

Règle du projet : aucune donnée inventée. Ces éléments de la maquette ne
peuvent PAS être reproduits tels quels :

1. **« Ordre en ligne ✓ »** (cartes, comparateur, filtres) : aucune donnée
   vérifiée. Le calculateur le dit déjà dans son code. Affichage honnête :
   « Non renseigné », ou collecte manuelle sur le site de chaque SGI.
2. **Puces « Frais compétitifs », « Services adaptés aux particuliers »,
   « Couverture UEMOA »** sous la recommandation : affirmations sans source.
   Remplacées par des constats calculés (coût le plus bas du scénario,
   barème homologué + lien PDF, dépôt minimum compatible).
3. **Bâtiment portant le logo BRVM** dans le hero : marque d'une institution
   tierce, que le site ne doit pas imiter. Remplacé par une illustration
   financière abstraite (SVG/CSS), ou une photo libre de droits fournie.
4. **Valeurs de la maquette** (19 000 FCFA, 0,75 %, dépôts 100 000…) :
   illustratives. Tout chiffre affiché sortira du moteur et des barèmes.
5. **Guinée-Bissau** parmi les choix de pays : aucune SGI référencée. Elle
   peut figurer comme pays de RÉSIDENCE de l'investisseur (il peut ouvrir
   ailleurs dans l'UEMOA), jamais comme pays de SGI.
6. **« Économie −27 % vs moyenne »** : calculable (écart au coût moyen des
   barèmes complets du scénario) — à conserver, avec sa définition.

## F. Architecture cible

```
/comparateur-sgi                 Vue d'ensemble (hero, 4 portes, recommandation,
                                 classement top 5, annuaire en aperçu, FAQ)
/comparateur-sgi/trouver         Trouver ma SGI (questionnaire + résultats)
/comparateur-sgi/simuler         Simuler mes frais
/comparateur-sgi/comparer        Comparer (jusqu'à 3, ?sgi=a,b,c)
/comparateur-sgi/annuaire        Annuaire (recherche, filtres, tri)
/comparateur-sgi/annuaire/[slug] Fiche SGI (notFound si inconnue)
/comparateur-sgi/methodologie    Méthode, sources, limites (HT, paliers…)
```

- `app/comparateur-sgi/layout.tsx` : hero + navigation secondaire (onglets
  desktop, barre basse ou menu compact mobile). Aucun `loading.tsx` au-dessus
  de `[slug]` (règle soft-404).
- Données lues une fois par le layout serveur, une seule source par SGI
  (identifiant = `slug`). Le scénario circule par l'URL.
- Moteurs inchangés ; ajouts purs et testés : `economieVsMoyenne`,
  `constatsComparaison` (chaque constat porte sa donnée), scoring
  multi-priorités (combinaison des poids existants).
- Mouvement : framer-motion (`MotionConfig reducedMotion="user"`), aucun
  contenu rendu à `opacity: 0` côté serveur, aucune animation permanente.

## G. Plan d'implémentation (une PR par étape, Preview Vercel validé avant la suivante)

| # | Étape | Contenu | Migration |
|---|---|---|---|
| 1 | Fondations | layout, hero, navigation secondaire, routes vides, drapeaux locaux, icônes, scénario dans l'URL | non |
| 2 | Simuler mes frais | page 2 colonnes, achat/vente séparés, économie vs moyenne | non |
| 3 | Trouver ma SGI | intro, progression, multi-priorités, résultats et actions croisées | non |
| 4 | Annuaire + fiche | filtres combinés, tri, coût estimé, fiche `[slug]` | oui : `slug` (+ adresse BRVM) |
| 5 | Comparer | sélection ≤ 3, colonnes, constats, mobile | non |
| 6 | Vue d'ensemble + méthodologie | portes, aperçus, FAQ conservée | non |
| 7 | Audit visuel final | captures 1440 / 1280 / 768 / 390 / 360, écarts corrigés | non |

Contraintes de travail : branche par étape, jamais de fusion automatique,
pas de `npm run build` local (CI + Preview Vercel), tests unitaires et
contrôle des types à chaque étape.

## Décisions à prendre par l'exploitant

1. Pages séparées sous `/comparateur-sgi/*` (recommandé) ou onglets d'une page.
2. Colonne `slug` (+ adresse officielle BRVM) dans `sgi_directory`.
3. « Ordre en ligne » : « Non renseigné » partout, ou collecte manuelle.
4. Visuel du hero : illustration abstraite (recommandé) ou photo fournie.
5. Ajout de `lucide-react` pour les icônes.
6. En-tête global du site (libellés, menu) : chantier séparé ou non.
