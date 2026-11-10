# Fiche action : structure de note d'analyse — conception (v2)

Date : 2026-11-10. Remplace le découpage de `2026-11-08-fiche-action-chapitres-design.md`
et les cinq rubriques livrées par la PR #201. La v2 intègre la critique de l'exploitant
(« critique, spec v2, ligne éditoriale et vision », 10/11/2026), confrontée au code de
main (d4dd75a0) : là où la critique supposait, le code a tranché (§ 1.3).

## 1. Pourquoi

### 1.1 Diagnostic de la page actuelle

1. **Trois systèmes de titres** : `Chapitre` numéroté, `Eyebrow` (« Cours & Volume »,
   « Liquidité & coût de friction », « Corporate & Dividendes », « Outils ») et `h3`
   libres (« Détail de l'exercice », « Discussions »).
2. **Numérotation sans objet** : un onglet ne porte qu'un chapitre.
3. **Doublons** : « À propos » et « Performance financière » (Vue d'ensemble) répètent
   Profil et Analyse fondamentale ; événements et publications officielles séparés.
4. **Opinion éparpillée** : notation, verdict, IA, signal quantitatif, Combined Alpha
   sur trois onglets, et aucune règle quand ils divergent.
5. **Actionnariat enfoui** (12 sociétés sur 48), absence non signalée.
6. **Ordre** : séance avant société ; dividendes collés aux événements.
7. **Manques d'une note d'analyse** : pas de risques, pas de calendrier, liquidité
   reléguée, multiples sans point de comparaison, chiffres sans date.

### 1.2 Principe directeur

Chaque rubrique répond à **une question du lecteur**, inscrite dans son sous-titre. Un
futur bloc va dans la rubrique dont il sert la question ; s'il n'en sert aucune, il
n'entre pas dans la fiche.

### 1.3 Ce que le code a tranché dans la critique

| Point de la critique | Constat dans le code | Décision |
|---|---|---|
| Ancres non vues du serveur | `FicheStickyNav` les résout déjà au montage (`router.replace`) | Conservé ; on ajoute priorité, défilement et focus (§ 7) |
| Adresse canonique | `generateMetadata` pose déjà `canonical` vers `/societes/{code}` | Inchangé : aucune variante `?rubrique=` n'est indexée en double |
| « Rendement libellé brut » | `dividends.montant` est majoritairement **net** (calendrier BRVM) ; la base est connue par ligne (`base_fiscale`) | Libellé **selon la base** : « net », « brut », « tel que publié ». Jamais « brut » par défaut (cf. double IRVM corrigée le 2026-10-20) |
| Gabarit banque | `famille_comptable` et `components/financials/BankScorecard.tsx` existent | Brancher l'existant, pas un nouveau gabarit |
| Mesures | PostHog en place, derrière le consentement | Événements posés en PR 1, consentement respecté |

## 2. Décisions de l'exploitant (2026-11-10)

- Structure : **note d'analyse**, six rubriques éditoriales + Mon suivi à part.
- Actionnariat : sous-section **toujours visible**, puis **collecte sourcée**.
- Menu mobile : « Conseiller » devient **« Actions » → `/actions`**, sous mesure.
- **Conclusion descriptive, sans sens** : elle décrit ce que disent nos indicateurs,
  elle ne dit pas que le titre est bon ou mauvais. Le banc d'évaluation des signaux
  (`npm run eval:signaux`) n'a prouvé aucun pouvoir prédictif ; un passage à
  « Favorable / Défavorable » exigera un verdict « prouvé » du banc **et** un avis
  juridique (AMF-UMOA).
- Aucun bloc existant n'est supprimé : déplacé, renommé ou résumé avec lien.

## 3. Rubriques

| # | Libellé | `?rubrique=` | Question du lecteur |
|---|---|---|---|
| 1 | Synthèse (défaut) | `synthese` | Que faut-il retenir, et avec quel degré de confiance ? |
| 2 | Société | `societe` | Que fait-elle et qui la contrôle ? |
| 3 | Résultats | `resultats` | Gagne-t-elle de l'argent, et de mieux en mieux ? |
| 4 | Valorisation et dividendes | `valorisation` | Est-ce cher, et que me verse-t-elle ? |
| 5 | Cours et liquidité | `marche` | Puis-je acheter et revendre, à quel coût ? |
| 6 | Actualités et calendrier | `actualites` | Qu'est-ce qui a changé, qu'est-ce qui arrive ? |
| — | Mon suivi | `suivi` | Où en est ma propre thèse ? |

**Mon suivi** est séparé visuellement des six rubriques éditoriales (filet et espace
dans la barre d'onglets) : il est personnel, pas une partie de la note.

`rubriqueDepuis(param)` traduit les anciennes valeurs (`vue-ensemble`→`synthese`,
`aujourdhui`/`titre`→`marche`, `entreprise`→`societe`) ; valeur inconnue → `synthese`.

Ancres héritées (`rubriqueDeAncre`) : `liquidite`, `carnet`, `seance`, `cours`,
`technique`, `saisonnalite` → `marche` ; `profil`, `direction`, `actionnariat` →
`societe` ; `fondamentaux`, `exercice`, `ifrs` → `resultats` ; `valorisation`,
`dividendes` → `valorisation` ; `evenements`, `calendrier`, `actualites-officielles`
→ `actualites` ; `these`, `discussions`, `outils` → `suivi`.

## 4. Titres

- Rubrique : un `h2` (`font-display`) sans numéro + la question en sous-titre.
  `Chapitre` : prop `numero` rendue facultative.
- Sous-section : composant unique `SousSection` (`h3`, `id` = ancre, ligne de
  **date et source** facultative en pied). Français, majuscule initiale seule, ni « & »
  ni anglicisme. Hiérarchie `h1` (société) → `h2` → `h3` sans saut.
- Les `Eyebrow` de la page disparaissent.

## 5. Contenu, dans l'ordre

### 5.1 Synthèse

1. **Fraîcheur** — une ligne : « Cours du {date} · Derniers comptes : exercice
   {année} ». Au-delà de 18 mois pour les comptes : état « Ancien » (§ 6).
2. **Notre lecture** (PR 2) — quatre états, **descriptifs** :
   « Indicateurs concordants à la hausse », « Indicateurs concordants à la baisse »,
   « Indicateurs divergents », « Pas d'avis » (avec motif). Une phrase, la date.
   « Pas d'avis » a son propre visuel, aussi soigné que les autres.
3. **Ce qui fonde cette lecture** — signal quantitatif, Combined Alpha et verdict
   (`VerdictBand`) comme pièces, avec la concordance (« 2 indicateurs sur 2
   concordants » / « divergents »). La **notation A–F** est montrée comme pièce de
   qualité financière ; elle ne compte pas dans le sens (elle ne mesure pas une
   direction).
4. **Ce qui peut faire échouer cette lecture** (PR 2) — trois risques au plus, dérivés
   des vigilances déjà calculées par le dossier valeur (`lib/dossier/narratif.ts`),
   jamais rédigés à la main. Sans vigilance calculée : la sous-section le dit.
5. **L'essentiel** (`Essentiel`) — cinq chiffres au plus, dont **un de liquidité** :
   valeur échangée médiane par séance sur 30 séances, en FCFA.
6. **Prochain rendez-vous** — prochain événement daté connu (détachement, paiement,
   AG, publication), ou « Aucune date annoncée ».
7. **Analyse par IA** (`AnalyseIA`) — étiquetée, datée, repliée par défaut.
8. **Pour aller plus loin** — deux phrases avec lien vers Société et Résultats. Les
   blocs « À propos » et « Performance financière » ne sont **plus rendus** ici.
9. `JaugesPlage` (1 jour, 52 semaines, 2 ans) reste en tête, sous la fraîcheur.

**Règle de lecture** — `lib/fiche/lecture.ts`, fonction pure testée :

- Entrées : signal quantitatif (`BUY`/`HOLD`/`SELL`), classement Combined Alpha
  selon **ses propres catégories existantes** (aucun seuil nouveau), fraîcheur des
  comptes, historique de cours, classe de liquidité.
- « Pas d'avis » si : historique < 20 séances, comptes de plus de 18 mois, ou
  liquidité en classe D (le signal n'y a pas de sens). Le motif est affiché.
- Sinon : deux indicateurs dans le même sens → « concordants à la hausse / à la
  baisse » ; sens opposés ou l'un neutre → « divergents » ; tous neutres →
  « Indicateurs neutres » (variante de « divergents », même visuel).
- Aucun seuil de `scoring/score.ts` ne change (règle du banc).

### 5.2 Société

Présentation · Historique · Métiers · Ce qui fait varier l'activité · Direction ·
**Actionnariat** (+ ligne calculée « Flottant et autres » quand le total publié est
inférieur à 100 %, et date du document sous le tableau) · Identité. `ProfilSociete`
est découpé en sous-sections de la page.

### 5.3 Résultats

Points clés (déplacés du profil) · Comptes publiés · L'exercice {année} en détail ·
Comptes IFRS · Construire un graphique · liens Revue de résultats et États financiers.
Gabarit **banque-assurance** branché sur l'existant (`famille_comptable`,
`BankScorecard`) : un indicateur sans objet prend l'état « Sans objet ». Verrou
`gateFonda` inchangé.

### 5.4 Valorisation et dividendes

Multiples de valorisation (`ValuationPanel`) avec **deux repères** : médiane du
secteur coté (calcul existant de `lib/secteurs/agregat.ts`) et, quand l'historique le
permet, médiane propre du titre sur cinq exercices ; un repère incalculable prend
l'état d'absence adéquat. Dividendes : dernier versement, historique, rendement du
**dernier exercice** (règle de `lib/dividendes/classement.ts`), libellé selon la base
(« net », « brut », « tel que publié ») ; si rien n'a été versé au titre du dernier
exercice : « Aucun dividende au titre de {année} », jamais un rendement nul muet.

### 5.5 Cours et liquidité (`marche`)

Cours et volume · Liquidité et coût d'exécution · Carnet d'ordres · La séance du
{date} · Lecture technique (avertissement « historique insuffisant » en tête) ·
Saisonnalité. Verrous inchangés.

### 5.6 Actualités et calendrier

Calendrier (à venir : détachement, paiement, AG, publications, depuis les tables déjà
lues) · Événements récents · Publications officielles (ancre `actualites-officielles`
conservée).

### 5.7 Mon suivi

Ma thèse (`ThesisPanel` inchangé) · Mes outils · Discussions sur le titre.

## 6. États d'absence de donnée

Composant unique `DonneeAbsente`. Jamais de liste vide, de tiret ni de zéro par défaut.

| État | Texte | Quand |
|---|---|---|
| Non collecté | « Pas encore collecté par WESTBOURSE. » | Aucune recherche tracée |
| Non publié | « Non publié par la société ni par la BRVM à notre connaissance (vérifié le {date}). » | Recherche tracée, infructueuse |
| Sans objet | « Sans objet pour cette société. » | Ex. chiffre d'affaires d'une banque |
| Ancien | « Dernière donnée connue : {date}. » | Au-delà du seuil de fraîcheur |

En PR 1, les 36 sociétés sans actionnariat affichent **« Non collecté »**, pas « Non
publié » : rien n'a encore été cherché.

## 7. Navigation, accessibilité, performance

- Barre d'onglets : `role="tablist"`, flèches du clavier, onglet actif ramené dans le
  champ, défilement horizontal sur mobile avec indice de débordement, Mon suivi séparé.
- Changement de rubrique : focus sur le `h2` de la rubrique.
- Priorité : `?rubrique=` l'emporte toujours ; une ancre héritée ne sert qu'en son
  absence, résolue au montage, `router.replace` sans entrée d'historique, puis
  défilement vers l'ancre.
- Verrous : une rubrique montre toujours au moins une sous-section en clair ; le verrou
  dit ce qu'il cache en une phrase.
- Budget : poids de page et temps d'affichage à 5 % près de l'existant (mesure avant /
  après). Charger seulement la rubrique ouverte reste hors périmètre.

## 8. Menu mobile et mesures

`components/BottomNav.tsx` : `/conseiller` « Conseiller » devient `/actions`
« Actions », actif sur `/actions*`. Conseiller reste dans `lib/nav.ts`.

Événements PostHog (consentement requis, aucune donnée personnelle) :
`fiche_rubrique_vue` (code, rubrique, entrée/suivante), `fiche_verrou_clic`
(rubrique), et suivi de l'usage de `/conseiller` depuis mobile. **Seuil fixé
d'avance** : si les visites mobiles de `/conseiller` baissent de plus de 30 % sur
30 jours par rapport aux 30 jours précédents, « Conseiller » revient dans la barre.

## 9. Données et sécurité

PR 1 et 2 : aucune migration ; données déjà chargées, redistribuées.

PR 3 (collecte d'actionnariat) : `societes_profils.actionnariat` étendu (jsonb, sans
migration de schéma) à `{lignes, date, source, url, page, etat, verifie_le}` où
`etat ∈ {publie, non_publie}`. Règles : document de la société ou de la BRVM de
**moins de 36 mois** ; total entre **50 % et 100,5 %** (sinon rejet nommé) ;
`normaliserProfil` mis à jour en conséquence. Script idempotent, **export des lignes
existantes avant écriture**, journal versionné (société, source, adresse, page, date),
aperçu relu par l'exploitant avant `supabase db query --linked -f`.

## 10. Découpage

| PR | Contenu | Migration |
|---|---|---|
| 1 | Rubriques, titres, ancres, `DonneeAbsente`, Actionnariat « Non collecté », fraîcheur, liquidité en Synthèse, menu mobile, mesures | Non |
| 2 | `lib/fiche/lecture.ts` (lecture descriptive, « Pas d'avis »), risques dérivés, prochain rendez-vous | Non |
| 3 | Collecte d'actionnariat sourcée, flottant | Données seules |
| 4 | Calendrier complet, repères de valorisation, branchement banque | À évaluer |

## 11. Critères d'acceptation

- Aucun composant rendu dans deux rubriques.
- Chaque sous-section chiffrée affiche une date.
- Les 48 fiches affichent une sous-section Actionnariat dans un état du § 6.
- Tous les anciens liens et ancres mènent à la bonne sous-section.
- Tests : `lib/fiche/rubriques.test.ts` (+ priorité paramètre sur ancre),
  `lib/fiche/lecture.test.ts` (chaque état, chaque motif de « Pas d'avis »).
- Captures sur quatre sociétés types : **SNTS** (documentée, liquide), **SGBC**
  (banque), une valeur peu liquide à données lacunaires (choisie sur la classe de
  liquidité D), **BBGC** (cotée récemment) — 7 vues × bureau/mobile × sombre/clair,
  avant/après, aperçu publié avant fusion.
- Contrôle d'accessibilité automatisé sans erreur sur les sept vues.
- Aucun `loading.tsx` ajouté ; `notFound()` inchangé.

## 12. Hors périmètre

- Thèse réfutable au modèle thesis-tracker (piliers, risques, catalyseurs datés,
  journal) : migration, chantier séparé.
- Validation juridique d'une conclusion orientée (préalable à tout « Favorable »).

---

## Annexe A — Ligne éditoriale

**Promesse :** la BRVM expliquée chiffres à l'appui, doutes compris.

**Position :** un analyste indépendant qui écrit pour un épargnant de long terme, ni
courtier ni fil d'alertes.

1. **Le fait avant l'avis.** L'opinion vient après et se signale comme telle.
2. **Pas de chiffre sans date ni source.**
3. **Dire ce qu'on ne sait pas**, en distinguant « non publié » de « pas encore cherché ».
4. **S'abstenir est une position.** « Pas d'avis » vaut mieux qu'un avis faible.
5. **La liquidité est une donnée de premier rang.**
6. **Toujours le risque en face de la lecture.**
7. **Le temps long.** Comptes et dividende avant la séance du jour.
8. **Les erreurs se corrigent en public.** Toute lecture est datée et archivée.

Voix : français clair, phrases courtes, présent ; terme technique expliqué à sa
première apparition ; montants en FCFA écrits en entier ; ni impératif
d'investissement, ni superlatif, ni point d'exclamation.

| À éviter | À écrire |
|---|---|
| « Signal d'achat fort » | « Indicateurs concordants à la hausse : résultats en progression trois ans de suite, valorisation sous la médiane du secteur. » |
| « Données indisponibles » | « Pas encore collecté par WESTBOURSE. » |
| « Rendement 9 % » | « Rendement de 9 %, net : dividende 2025 rapporté au cours du 9 novembre 2026. » |
| « Titre peu liquide » | « Il s'échange en médiane 1,2 million FCFA par séance : un ordre de 5 millions pèse plusieurs séances. » |
| « Notre IA pense que… » | « Analyse générée par IA à partir des comptes publiés, datée du {date}. » |

(Chiffres d'exemple de rédaction, pas des données de marché.)

## Annexe B — Vision (hors périmètre, pour orienter)

- **3 mois** : « Depuis votre dernière visite » ; historique daté des lectures ;
  simulateur d'ordre (montant → séances probables, friction, dividende attendu).
- **12 mois** : chaque chiffre cliquable jusqu'à sa source (`{source, url, page}`) ;
  publications lues dans l'heure avec relecture humaine ; bilan public des lectures ;
  thèse réfutable ; indice de transparence des émetteurs ; calendrier anticipé.
- **3 ans** : interroger la fiche (réponse sourcée ou refus) ; dividende net selon le
  pays du lecteur ; carte de l'actionnariat de la cote ; comparables panafricains ;
  note audio ; données sous licence.

Fil conducteur : une donnée datée, sourcée, avec un état d'absence explicite, et une
lecture qui sait s'abstenir.
