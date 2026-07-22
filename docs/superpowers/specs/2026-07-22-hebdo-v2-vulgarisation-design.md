# Analyse hebdo v2 — vulgarisation, formats prêts-à-poster, contexte

**Date** : 2026-07-22 · **Statut** : approuvé (brainstorming)

Décisions utilisateur : **deux formats** générés (long LinkedIn/Facebook + court WhatsApp,
avec bouton « Copier ») · fondamentaux **seulement si notables** · **émojis de structure**
dans le format court · seuils de notabilité validés (perte, ±30 %, PER hors 5-25,
rendement ≥ 6 %).

## 1. Problème

Le narratif v1 est exact mais illisible pour un non-initié :
« Le RSI(14) s'établit à 36.4, en territoire neutre. Le MACD reste négatif. »
Il n'est ni structuré pour être posté tel quel, ni contextualisé : le lecteur voit que
STAC chute de 6,4 % sans savoir que la société a publié **une perte de 96,6 M FCFA** sur
2025 — un fait disponible en base (`income_statements`) et directement éclairant.

## 2. Principe directeur : traduire d'abord, chiffrer ensuite

Chaque notion technique est énoncée **en langage courant**, le chiffre venant en appui
entre parenthèses — jamais l'inverse.

| v1 | v2 |
|---|---|
| « Le RSI(14) s'établit à 36,4, en territoire neutre » | « Le titre n'est ni suracheté ni survendu : la pression acheteuse reste modérée (indicateur de tension : 36 sur 100). » |
| « Le MACD reste négatif » | « La dynamique de fond reste orientée à la baisse. » |
| « rupture de support » | « Le cours est passé sous son plancher des 20 dernières séances (3 050 FCFA), un seuil que les acheteurs défendaient jusqu'ici. » |
| « volume 4,3× la moyenne » | « Il s'est échangé 4,3 fois plus de titres que d'habitude — le mouvement a mobilisé du monde. » |

La règle d'or v1 reste **inchangée** : aucun chiffre qui ne vienne des données.

## 3. Fondamentaux — `frontend/lib/hebdo/fundamentals.ts` (PUR, testé)

`pickNotableFundamental(rows, cours)` → `{ phrase, chiffres } | null`.
Entrée : lignes `income_statements` du titre (`periode`, `resultat_net`,
`benefice_par_action`, `dividende_par_action`), triées, plus le dernier cours.

**Est notable** (première règle qui matche l'emporte) :

1. `resultat_net < 0` → « La société a publié une perte de {X} sur l'exercice {année}. »
2. `|Δ resultat_net| ≥ 30 %` d'un exercice à l'autre → « Son bénéfice a {progressé|reculé}
   de {X} % sur le dernier exercice ({année}). »
3. PER = `cours / benefice_par_action` **< 5** → « Le titre se paie {X} fois les bénéfices
   de {année}, un niveau bas pour la cote. » ; **> 25** → « …un niveau élevé pour la cote. »
4. Rendement = `dividende_par_action / cours` **≥ 6 %** → « Le dividende versé au titre de
   {année} représente {X} % du cours actuel. »

Sinon → `null`, et la section **n'apparaît pas** (aucun remplissage).
Formatage des montants : `96,6 millions FCFA` / `13,1 milliards FCFA` (lisible, pas de
notation brute). Tous les chiffres produits sont retournés dans `chiffres` et rejoignent la
whitelist du garde-fou.

## 4. Veille — `frontend/lib/hebdo/context.ts` (PUR, testé)

`pickRecentEvent(events, dateEdition, fenetreJours = 14)` → `{ phrase, chiffres } | null`.

**Verrous anti-causalité** (le point le plus sensible de cette évolution) :

- **Fenêtre stricte** : seuls les événements dont `event_date` est dans les 14 jours
  précédant l'édition sont éligibles. Constat réel : les événements disponibles pour les
  valeurs de l'édition du 2026-07-22 datent d'avril-mai — ils seront donc **écartés**,
  et c'est le comportement voulu. Attribuer un mouvement de juillet à une convocation d'AG
  de mai serait une causalité inventée.
- **Gabarit figé, purement factuel** : « À noter : {titre}, publié le {date}. » Le texte
  **juxtapose** un fait daté, il n'explique rien.
- **Garde-fou `assertNoCausalClaim(texte)`** (nouveau, symétrique de
  `assertNoForeignNumber`) : rejette toute sortie contenant un connecteur causal —
  `à cause de`, `en raison de`, `suite à`, `provoqué par`, `expliqué par`, `dû à`,
  `s'explique par`, `sous l'effet de`. En cas de rejet → repli sur le squelette.
- Aucun événement dans la fenêtre → section absente.

## 5. Deux formats — `buildPost(skeleton, format)`

`frontend/lib/hebdo/post.ts` (PUR, testé) produit deux chaînes Markdown depuis le squelette.

**`long`** (LinkedIn/Facebook, ~250 mots) :
```
📉 {CODE} : {accroche en une phrase}

Ce qui s'est passé
{variation + volume, en langage courant}

Ce que ça veut dire
{momentum vulgarisé}

Le contexte            ← seulement si fondamental notable OU événement récent
{phrase fondamentale} {phrase événement}

Les niveaux à surveiller
{support/résistance/paliers, directionnels}

⚠️ Information à but pédagogique, pas un conseil en investissement.
```

**`court`** (WhatsApp/Telegram, ~100 mots), **avec émojis de structure** (choix utilisateur) :
```
📉 {CODE} — {variation} cette semaine
📊 {volume en langage courant}
🔍 {momentum en une phrase}
🎯 {niveau clé}
⚠️ Pédagogique, pas un conseil.
```

L'emoji d'entête suit le sens : `📈` hausse, `📉` baisse.

## 6. Stockage & affichage

- Migration `0114_hebdo_posts.sql` : `alter table hebdo_items add column if not exists
  post_long text not null default ''`, idem `post_court`. Aucune nouvelle table, RLS
  inchangée (héritée de `hebdo_items`).
- Le worker (`scraper/src/hebdo/runHebdo.ts`) charge en plus `income_statements` et
  `market_events` pour les seules valeurs retenues, appelle les deux nouveaux modules purs,
  puis `buildPost` deux fois, et upsert `post_long` / `post_court`.
- Page `/analyses/hebdo/[date]` : sous chaque valeur, deux boutons **« Copier (LinkedIn) »**
  et **« Copier (WhatsApp) »** (composant client `CopyPostButton`, `navigator.clipboard`,
  retour visuel « Copié ✓ »). Le narratif détaillé reste affiché comme aujourd'hui.

## 7. Garde-fous et LLM

`polishNarrative` (scraper) reformule toujours les sections, avec deux contrôles
désormais : `assertNoForeignNumber` (existant, whitelist élargie aux chiffres
fondamentaux) **et** `assertNoCausalClaim` (nouveau). Un échec de l'un ou l'autre →
squelette conservé. Les **posts** (`buildPost`) sont construits **après** la reformulation,
à partir des sections validées : ils héritent donc des mêmes garanties.

## 8. Tests

- `fundamentals.test.mjs` : perte détectée ; variation ≥ 30 % ; PER bas / haut ; rendement
  ≥ 6 % ; cas banal → `null` ; formatage millions/milliards.
- `context.test.mjs` : événement dans la fenêtre retenu ; événement de 60 jours **écarté** ;
  aucun événement → `null` ; la phrase produite ne contient aucun connecteur causal.
- `post.test.mjs` : format long contient les sections attendues et l'avertissement ; format
  court ≤ 700 caractères et commence par l'emoji du bon sens ; section « contexte » absente
  quand ni fondamental ni événement.
- `assertNoCausalClaim` : accepte une juxtaposition datée, **rejette** « le cours a chuté à
  cause de la publication ».
- Non-régression : les 17 tests hebdo existants restent verts.

## 9. Hors scope

- Traduction anglaise des posts.
- Publication automatique vers les réseaux (le bouton « Copier » suffit ; une intégration
  API LinkedIn/WhatsApp serait une feature à part entière).
- Analyse fondamentale approfondie (l'hebdo reste technique, le fondamental n'est qu'un
  éclairage ponctuel quand il est notable).
