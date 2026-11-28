# Stress Monitor lisible, et mise en valeur sur la landing (Stress Monitor + Academy)

Date : 2026-11-28 · Statut : design validé par l'exploitant (choix A / A / A, maquettes du compagnon visuel).

## Contexte

- `/stress-monitor` est jugée trop technique : la page s'ouvre sur quatre cartes (drawdown,
  volatilité réalisée, rang) et la décomposition pondérée des six composantes, sans une phrase
  qui dise ce qui se passe.
- La landing ne montre ni le Stress Monitor ni la formation (aucune section dédiée).

## Objectifs

1. Comprendre la tension du marché en dix secondes, puis être guidé vers le détail.
2. Une section « thermomètre du marché » sur la landing, juste après l'indice.
3. Une section « Apprendre » sur la landing, après « De la donnée à la décision ».

**Hors champ** : le calcul de l'indice et ses seuils ; les sections existantes de la landing ; un
prix sur la landing (la section « gratuit / Premium » l'affiche déjà) ; toute prévision.

## Règles transverses (non négociables)

- **Aucune phrase écrite à la main** : tout texte qui dépend des données sort d'une fonction pure
  testée (`lib/stress/bulletin.ts`), comme `lib/narrative.ts`. Les composants n'affichent que des
  libellés fixes et ce que renvoie cette fonction.
- **Descriptif, jamais prédictif** : ni « signal », ni « danger », ni conseil. Les observables sont
  affichés « sans verdict ni feu tricolore » (banc d'évaluation 2007-2026 : `non_prouve`) ; le
  verdict décrit le **niveau de tension mesuré**, rien d'autre. Le repère historique porte la mention
  « ce n'est pas une prévision ». L'avertissement réglementaire de la page est conservé.
- **Jauge à une seule teinte** dont l'intensité croît (repères 25 / 50 / 75), jamais vert / rouge :
  elle encode une position, pas un jugement (même règle que `WeekRange52`).
- **Donnée absente = élément absent** : une phrase, une ligne ou une section sans donnée disparaît ;
  jamais de chiffre de remplacement.
- **Landing** : deux sections ajoutées, aucune autre modifiée. Aucun JavaScript client
  supplémentaire (courbe SVG rendue serveur, vidéo native `preload="none"`). Le test
  `lib/vitrine/motsInterdits.test.ts` reste vert : ni « achat », « vente », « opportunité »,
  « recommandation », « garanti », « sans risque », « objectif de cours ».

## 1. Page `/stress-monitor` : le bulletin du marché

### Module pur `lib/stress/bulletin.ts`

`construireBulletin(entree)` → `Bulletin`, avec en entrée la ligne du jour (`StressDailyRow`),
l'historique affiché, et, si l'épisode en cours est connu, la date et la valeur du plus haut du
BRVM Composite et la crise historique la plus proche (libellé + score de ressemblance).

Le « plus haut du Composite » est le **sommet de référence de l'épisode en cours** (seuil −10 %,
moteur des crises). Sans épisode en cours, aucune date n'est citée : la trajectoire se rabat sur
20 séances et la phrase d'ampleur s'écrit sans date.

Sortie :

| Champ | Règle |
| --- | --- |
| `verdict` | Selon `regime` : faible → « Le marché est calme » ; modérée → « Le marché est sous tension modérée » ; élevée → « Le marché est sous tension élevée » ; extrême → « Le marché est sous forte tension ». |
| `reponse` (landing) | extrême « Oui, très. » ; élevée « Oui. » ; modérée « Un peu. » ; faible « Non, plutôt calme. » |
| `note` | `stress_index` arrondi à l'entier pour l'affichage principal (1 décimale dans les détails). |
| `phrases` (≤ 3) | **Trajectoire** : si la date du plus haut du Composite figure dans l'historique, « Depuis le {date}, la tension est passée de {indice ce jour-là} à {indice actuel}. » ; sinon, sur 20 séances : « En 20 séances, la tension a augmenté / baissé de {n} points. » (« est restée stable » si l'écart est inférieur à 2 points). **Ampleur** : « Le BRVM Composite est {n} % sous son plus haut[ du {date}]. » si le drawdown est inférieur à −0,5 %, sinon « Le BRVM Composite est à son plus haut. ». **Étendue** (composante diffusion sectorielle, % de capitalisation en baisse sur 20 séances) : 100 → « La baisse touche tous les secteurs. » ; ≥ 60 → « La baisse touche la plupart des secteurs. » ; ≥ 30 → « Une partie des secteurs recule. » ; sinon « Peu de secteurs reculent. ». Chaque phrase est omise si sa donnée manque. |
| `facteurs` (3) | Les trois composantes de plus forte contribution `score_0_100 × poids_effectif` (composantes nulles ignorées ; à contribution égale, la plus lourde en poids nominal d'abord). Chacune : un **titre neutre** (« Recul depuis le plus haut », « Titres en baisse », « Agitation des cours », « Secteurs en baisse », « Échanges sur titres en baisse », « Tendance des dernières semaines ») et une **mesure chiffrée** tirée de `valeur_brute` (ex. « 6 titres sur 10 en baisse sur 5 séances »). Le titre ne qualifie jamais : c'est la mesure qui dit le fait, y compris en marché calme. |
| `reperes` (≤ 3) | Calculés sur la fenêtre affichée : dernier franchissement à la hausse du seuil 75 (à défaut 50) ; point le plus bas de la fenêtre ; plus haut du Composite s'il est dans la fenêtre. |
| `passe` | La crise la plus proche (libellé, ressemblance /100), ou `null`. |

Nombres au format français (`lib/format`), virgule décimale.

### Composants

- `components/stress/BulletinMarche.tsx` (serveur) : verdict + note + jauge (`role="meter"`,
  `aria-valuenow`), les phrases, « Pourquoi {note} ? » (les trois facteurs, chacun dépliable via
  `<details>` : score /100, poids, définition simple), « Et dans le passé ? » (repère historique,
  « ce n'est pas une prévision », lien vers `/stress-monitor/crises`) et un lien « Comment est
  calculé cet indice » vers la méthodologie.
- `StressHistoriqueChart` (client, existant) : périodes **3 mois / 6 mois / tout** ; repères
  dessinés sur la courbe ; info-bulle en clair (« Tension : 76 / 100, extrême · Composite : 453,57 pts,
  18,35 % sous son plus haut »). L'historique chargé passe de 180 à **750 séances** (≈ 3 ans, une
  seule requête sous le plafond de 1 000 lignes de PostgREST).
- `components/stress/InfoTerme.tsx` : bulle « ⓘ » accessible (bouton + définition) sur les termes
  techniques de la partie détaillée (drawdown, volatilité réalisée, BRVM-V, largeur, diffusion,
  momentum).

### Ordre de la page

En-tête et sous-navigation inchangés → **bulletin** → **graphique** (pleine largeur) → intertitre
« Le détail, pour les initiés » → tout l'existant (cartes, six composantes, épisode en cours,
observables, secteurs, moteurs, méthodologie), avec les bulles « ⓘ ». Sans donnée : l'état vide
actuel.

## 2. Landing : le thermomètre du marché

- `lib/vitrine/thermometre.ts` : `chargerThermometre()`, clé publique (`stress_daily_index` est
  lisible anonymement), les 130 dernières séances en une requête ; `null` sur erreur ou table vide.
  Le texte vient de `construireBulletin` (`reponse`, phrase d'ampleur).
- `components/vitrine/SectionThermometre.tsx` (serveur, conventions vitrine : `v-bloc`,
  `v-colonne`, `v-section` + `vitrine-accent`) : « Le marché est-il nerveux ? {réponse} », note du
  jour, jauge, une phrase, courbe SVG, « Séance du {date} » et source, lien « Comprendre la tension du
  marché » → `/stress-monitor`, mention `PAS_CONSEIL`. Section absente si `null`.
- `app/page.tsx` : insérée juste après `<Indice …/>`.

## 3. Landing : la section « Apprendre »

- `lib/vitrine/apprendre.ts` : nombre de leçons par niveau, lu côté serveur (clé service, jamais
  exposée), mis en cache 24 h (`unstable_cache`) — les contenus pèsent ≈ 745 ko. Ligne masquée si
  indisponible.
- `components/vitrine/SectionApprendre.tsx` (serveur) :
  - titre « Apprendre à investir à la BRVM. {accent : Commencez gratuitement.} » ;
  - vidéo Leçon 0 (`LECON0.video`, affiche `LECON0.affiche`, durée), `<video preload="none" controls>` ;
  - trois entrées gratuites : Leçon 1 (`lienOffre`, Niveau 1), cas Sonatel « avec un compte
    gratuit » (`lienOffre`, Niveau 2), guide « choisir sa SGI » (`GUIDE_SGI`) ;
  - le parcours des quatre niveaux (`NIVEAU_LABEL`) avec le nombre de leçons, et « Un examen et un
    certificat à chaque niveau » ;
  - deux boutons : « Commencer la Leçon 1 » et « Voir le programme » (`/formations/academy`).
- `app/page.tsx` : insérée juste après `<SectionMethode …/>`.

## Tests et vérifications

- `lib/stress/bulletin.test.ts` : quatre régimes (verdict, réponse) ; phrases omises sans donnée ;
  bornes de l'étendue ; choix des trois facteurs (contribution, nulls ignorés, égalités stables) ;
  repères (franchissement, minimum, au plus trois) ; format français.
- `lib/vitrine/motsInterdits.test.ts` vert.
- `e2e/stress-bulletin.spec.ts` (page publique, clé anonyme : exécutable en CI) : verdict, jauge,
  « Pourquoi », graphique, et aucun débordement horizontal à 360 px.
- Captures avant / après : `/stress-monitor` (bureau, 360 px, clair et sombre) et landing.

## Livraison

Deux PR : (1) bulletin de la page Stress Monitor ; (2) les deux sections de la landing.
