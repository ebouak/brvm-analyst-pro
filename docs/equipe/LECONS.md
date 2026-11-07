# Leçons de l'équipe design

Chaque chantier ajoute ici ce qui a failli passer. Une ligne par leçon, avec la page où elle
a été apprise. À relire avant de commencer.

## Données affichées

- **Une variation absente n'est pas zéro.** `variation_pct ?? 0` affichait « +0,00 % » en
  vert et classait la valeur au milieu du tri (/actions, 2026-11-07). Afficher « — », trier
  en fin de liste.
- **Le signe se choisit après l'arrondi.** Une variation de −0,004 % s'affichait « +0,00 % ».
  Passer par `fmtPctSigne` (fiche société, 2026-11-07).
- **Une panne n'est pas une absence.** `.catch(() => [])` faisait afficher « Aucune date
  programmée » quand la base ne répondait pas. Une erreur rend `null` et affiche « — »
  (/formations, 2026-11-07).
- **Chaque cours a sa propre date.** Un cours plus ancien que la séance annoncée en tête
  doit porter sa date, et sortir des décomptes « en hausse aujourd'hui » (/societes, 2026-11-07).
- **Le fuseau horaire des dates.** Une session en soirée tombait au mauvais jour dans le
  fuseau du serveur. Utiliser `timeZone: 'Africa/Abidjan'` (/formations, 2026-11-07).
- **La veille d'un indice se reprend de la clôture précédente**, seulement si elle concorde
  avec la variation publiée (landing, 2026-11-07).

## Textes

- **Un chiffre sans source part, il ne se reformule pas.** « 44 leçons », « Quatre heures »,
  « 8 sections » (le code en définit 6) ont été supprimés (/formations, 2026-11-07).
- **Un badge doit dire vrai.** « Le plus choisi » traduisait `is_recommended`, pas un volume
  de souscriptions (/pricing, 2026-11-07).
- **Les noms d'institutions changent.** Le CREPMF s'appelle AMF-UMOA depuis 2022.
- **« Cours de clôture » est faux pendant la séance** : la ligne du jour vient de la collecte
  intraday (/actions, 2026-11-07).
- **Les pluriels invariables** : « 2 courss ».

## Couleurs et accessibilité

- **Le cyan d'accent est trop pâle sur fond clair** pour du texte ou un bouton (≈ 3,9:1).
  Utiliser `accent-ink` pour le texte, garder les boutons pleins en ivoire ou encre.
- **`bg-elevated` et `bg-surface` sont tous deux blancs en mode clair** : une distinction par
  le fond disparaît. Utiliser un filet (`border-t-2 border-accent`).
- **Vert et rouge veulent dire hausse et baisse.** Une coche verte ou une barre achat/vente
  verte et rouge se lit comme un signal.
- **Aucune couleur en dur** (`#3fe18b`, `#03222b`) : elles cassent le mode clair.

## Méthode

- **Sept agents en parallèle épuisent la limite d'usage** : vagues de 3.
- **Un composant partagé change d'autres pages** : `CarnetOrdres` (aussi /actions/[code]),
  `Sparkline` (aussi /simulateur), `OffresNiveaux` (aussi /account/plan). Les capturer aussi.
- **Un agent sans captures se trompe en silence** : la vue avant « fini » est obligatoire.
