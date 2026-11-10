# Fiche action : structure de note d'analyse — conception

Date : 2026-11-10. Remplace le découpage de `2026-11-08-fiche-action-chapitres-design.md`
et les cinq rubriques livrées par la PR #201.

## 1. Pourquoi

Lecture de `frontend/app/actions/[code]/page.tsx` (main, d4dd75a0) en analyste :

1. **Trois systèmes de titres** mélangés : `Chapitre` numéroté, `Eyebrow`
   (« Cours & Volume », « Liquidité & coût de friction », « Corporate & Dividendes »,
   « Outils ») et `h3` libres (« Détail de l'exercice », « Discussions »).
2. **Numérotation sans objet** : cinq onglets, Vue d'ensemble sans numéro, les autres
   01 à 04 ; un onglet ne porte qu'un chapitre.
3. **Doublons** : « À propos de… » et « Performance financière » (Vue d'ensemble)
   répètent Profil et Analyse fondamentale (L'entreprise). Les événements sont dans
   L'entreprise, les publications officielles dans Vue d'ensemble.
4. **Opinion éparpillée** : notation, verdict, analyse IA (Vue d'ensemble), signal
   quantitatif (Le titre), Combined Alpha (fin de L'entreprise).
5. **Actionnariat enfoui** dans la colonne droite du profil, présent pour 12 sociétés
   sur 48, et rien ne signale son absence pour les 36 autres.
6. **Ordre** : la séance du jour passe avant la société ; dividendes collés aux
   événements sous un intitulé anglais.

## 2. Décisions de l'exploitant (2026-11-10)

- Structure : **note d'analyse en 7 rubriques**.
- Actionnariat : **sous-section toujours visible**, puis **collecte sourcée** des
  sociétés manquantes (seconde PR).
- Menu mobile : l'onglet « Conseiller » devient **« Actions » → `/actions`**.
- Aucun bloc existant n'est supprimé : il est déplacé, renommé ou résumé avec lien.

## 3. Rubriques

| # | Libellé | `?rubrique=` | Anciennes rubriques |
|---|---|---|---|
| 1 | Synthèse (défaut) | `synthese` | `vue-ensemble` |
| 2 | Société | `societe` | `entreprise` (profil) |
| 3 | Résultats | `resultats` | `entreprise` (fondamentaux) |
| 4 | Valorisation et dividendes | `valorisation` | `entreprise` (valorisation, dividendes) |
| 5 | Marché | `marche` | `aujourdhui`, `titre` |
| 6 | Actualités | `actualites` | événements (`entreprise`), publications (`vue-ensemble`) |
| 7 | Mon suivi | `suivi` | `suivi` |

`rubriqueDepuis(param)` accepte les anciennes valeurs et les traduit
(`vue-ensemble`→`synthese`, `aujourdhui`/`titre`→`marche`, `entreprise`→`societe`) :
un lien partagé ne casse pas. Valeur inconnue → `synthese`.

Ancres héritées (`rubriqueDeAncre`) : `liquidite`, `carnet`, `seance`, `cours`,
`technique`, `saisonnalite` → `marche` ; `profil`, `direction`, `actionnariat` →
`societe` ; `fondamentaux`, `exercice`, `ifrs` → `resultats` ; `valorisation`,
`dividendes` → `valorisation` ; `evenements`, `actualites-officielles` →
`actualites` ; `these`, `discussions`, `outils` → `suivi`.

## 4. Titres

- Rubrique : un titre principal (`h2`, `font-display`), **sans numéro**, et une
  phrase de sous-titre. Composant `Chapitre` sans `numero` (prop rendue facultative).
- Sous-section : un seul composant `SousSection` (`h3`, `id` = ancre), même taille et
  même espacement partout. Français, majuscule initiale seule, ni « & » ni anglicisme.
- Les `Eyebrow` de la page disparaissent.

## 5. Contenu, dans l'ordre

**Synthèse** — Le cours (`JaugesPlage`) · Notre lecture (`VerdictBand`,
`NotationBadge`, signal quantitatif, `CombinedAlphaCarte`) · L'essentiel
(`Essentiel`) · Analyse par IA (`AnalyseIA`) · En bref (`VueEnsemble` réduit :
« À propos » et « Performance financière » gardés, chacun avec un lien vers Société
et Résultats).

**Société** — Présentation · Historique · Métiers · Ce qui fait varier l'activité ·
Direction · **Actionnariat** · Identité. `ProfilSociete` est découpé en sous-sections
de la page ; l'actionnariat sort de la colonne droite. Sans donnée : « Non publié par
la société ni par la BRVM à notre connaissance », jamais une liste vide ni un tiret.

**Résultats** — Points clés (déplacés du profil : calculés sur les comptes) ·
Comptes publiés (`FundamentalsPanel`) · L'exercice {année} en détail · Comptes IFRS
(`ComptesIfrs`) · Construire un graphique (`ChartBuilder`) · liens Revue de résultats
et États financiers complets. Verrou `gateFonda` inchangé (`SectionLock`).

**Valorisation et dividendes** — Multiples de valorisation (`ValuationPanel`,
verrou inchangé) · Dividendes (dernier versement, historique, rendement). Le
rendement suit la règle de `lib/dividendes/classement.ts` : dividende du **dernier
exercice** rapporté au cours, jamais un exercice ancien.

**Marché** — La séance du {date} (`CarnetCommentaire`, verrou inchangé) · Carnet
d'ordres (`CarnetOrdres`) · Liquidité et coût d'exécution (`LiquidityCard`) · Cours et
volume (`PriceChart`, marqueurs) · Lecture technique (`LectureTechnique`, verrou
inchangé) · Saisonnalité (`SeasonalityCard`). L'avertissement « historique
insuffisant pour RSI et MACD » reste en tête de Lecture technique.

**Actualités** — Événements récents · Publications officielles (bloc déplacé de la
Synthèse, ancre `actualites-officielles` conservée).

**Mon suivi** — Ma thèse (`ThesisPanel` inchangé) · Outils · Discussions.

## 6. Menu mobile

`components/BottomNav.tsx` : l'entrée `/conseiller` « Conseiller » devient
`/actions` « Actions », icône de liste de cours, active quand le chemin commence par
`/actions`. Conseiller reste dans `lib/nav.ts` (menu complet, tiroir mobile).

## 7. Données et sécurité

PR 1 : aucune migration, aucune nouvelle requête ; les données déjà chargées par la
page sont redistribuées. Le profil (`societes_profils`, lecture publique) fournit déjà
l'actionnariat.

PR 2 (collecte) : remplir `societes_profils.actionnariat` `{lignes, date, source}`
pour les sociétés manquantes, **uniquement** depuis un document de la société ou de la
BRVM daté de 2023 ou après (rapport annuel, note d'information, document de
référence) ; total ≤ 100,5 % (règle de `normaliserProfil`). Aperçu des lignes et des
sources avant toute écriture ; une société sans source reste vide. Écriture par
`scraper/scripts/seed-profils.mjs` via `supabase db query --linked -f`.

## 8. Tests et vérification

- `lib/fiche/rubriques.test.ts` : 7 rubriques, traduction des anciennes valeurs,
  table des ancres héritées, `hrefRubrique`.
- Rendu : chaque rubrique ne contient que ses sous-sections (captures 7 rubriques ×
  bureau/mobile × sombre/clair, avant/après, aperçu publié avant fusion).
- Garde-fous : aucun `loading.tsx` ajouté ; `notFound()` inchangé.

## 9. Hors périmètre

- Thèse au modèle thesis-tracker (piliers, risques, catalyseurs datés, journal) :
  demande une migration, chantier séparé.
- Chargement des seules données de la rubrique ouverte (performance).
