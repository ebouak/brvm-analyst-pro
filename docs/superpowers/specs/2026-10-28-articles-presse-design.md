# Articles de presse générés depuis la donnée BRVM

Date : 2026-10-28. Demande : « génération automatique d'articles de presse à
partir de thèmes tendance et surtout d'articles issus de la BRVM (dividendes et
autres) ». Décisions : **publication mixte** (types factuels automatiques, le
reste validé à la main), **images construites depuis la donnée** (pas d'IA).

## Principe

Un fait détecté en base devient un article. Chaque article fige ses chiffres
(`chiffres`), est rédigé par un squelette déterministe, reformulé par la
cascade LLM sous le garde-fou de l'analyse hebdo (`assertNoForeignNumber`,
`assertNoCausalClaim`), puis passe des verrous. Un verrou qui échoue laisse
l'article en brouillon avec sa raison ; rien n'est publié à moitié.

## Périmètre

| Lot | Types | Publication |
|---|---|---|
| 1 | `dividende_annonce`, `detachement_rappel` (J-3 ouvrés), `paiement_rappel` (J-1), `operation_titres`, `seance_hors_norme` | automatique |
| 2 | `resultats`, `notation` | validation |
| 3 | `theme_tendance` (brvm_news + veille, sources citées, seuls nos chiffres) | validation |

Ce document détaille le lot 1 ; les lots 2 et 3 réutilisent la même chaîne.

## Détecteurs (lot 1)

- **dividende_annonce** : ligne `dividends` créée depuis moins de 3 jours, montant > 0,
  exercice connu, source officielle (`brvm-calendrier`, `brvm-boc`) ou Richbourse.
  Rendement = montant / dernier cours.
- **detachement_rappel** : `ex_date` dans 1 à 3 séances ouvrées.
- **paiement_rappel** : `payment_date` = demain ouvré.
- **operation_titres** : ligne `operations_titres` dont `date_effet` est dans les
  5 jours (avant ou après).
- **seance_hors_norme** : sur la dernière séance, |variation| ≥ 5 % ET volume
  ≥ 2 × la moyenne des 30 séances précédentes, OU cours = plus-haut / plus-bas
  52 semaines avec volume ≥ 2 × moyenne. Au plus 2 par séance, rangées par
  |variation| × (volume / moyenne). Si un détachement a eu lieu à la séance
  ou la veille, l'article le **juxtapose** (jamais « à cause de »).

Clé de dédoublonnage `fait` : `type|code|clé` (exercice, date d'effet, séance).
Un même fait ne produit jamais deux articles.

## Données — migration 0167

Table `articles` : `id`, `slug` unique, `type`, `code` (nullable, fk
`brvm_instruments`), `fait` unique, `statut` (`brouillon` | `a_valider` |
`publie` | `rejete`), `titre`, `chapo`, `corps_md`, `chiffres` jsonb (snapshot,
alimente l'image), `sources` jsonb, `raison_blocage`, `date_fait`, `publie_le`,
`diffuse` jsonb, `created_at`, `updated_at`. RLS : lecture anonyme des seuls
`publie` ; écriture `service_role`. Aucune donnée personnelle.

## Verrous

`fraicheur` (fait ≤ 3 jours), `plausible` (|variation| ≤ 50 %, voir
`cloture/plausibilite.ts`), `chiffres_verifies` (titre + chapô + corps sans
chiffre étranger), `source_citee`, `avertissement` (mention « information,
pas un conseil en investissement »). Types automatiques : verrous verts →
`publie`. Types validés : → `a_valider`.

## Images

Route Edge `/api/articles/[slug]/image?format=paysage|carre` (`next/og`) :
logo (PNG/JPEG uniquement, sinon initiales), chiffre clé, courbe du cours
1 an tirée de `chiffres.serie`, date, source. Rendue depuis `chiffres` : elle
ne peut pas montrer autre chose que l'article.

## Publication et diffusion

- `/actualites/[slug]` public (préfixe ajouté au middleware ; pas de
  `loading.tsx` au-dessus — `notFound()` doit rendre un vrai 404), JSON-LD
  `NewsArticle`, sitemap. `/actualites` liste nos articles au-dessus des
  actualités existantes.
- Diffusion Chaîne WhatsApp + canal Telegram, **plafond 3 par jour** ; au-delà,
  un seul post « Les faits du jour ». Journal dans `diffuse` : une relance ne
  rediffuse rien.
- Cron `articles.yml` 17:00 UTC (après `score.yml` et `range52`), lundi-vendredi,
  instrumenté par `withMonitoring`.

## Administration

`/admin/articles` (`content.publish`) : file « à valider » avec aperçu texte
et image, Publier / Rejeter / Dépublier, brouillons bloqués avec leur raison.

## Tests

Détecteurs sur fixtures (dont SDSC 2025, SNTS 2026), squelettes sans chiffre
étranger, un test par verrou, idempotence (une relance ne crée rien).
