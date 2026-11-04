# Recherche en langage naturel parmi les sociétés (Jev) — conception

Date : 2026-11-04 · Statut : validée (brainstorming) · Chantier 3 de « Jev sur WESTBOURSE »

## Objectif

Un abonné connecté décrit ce qu'il cherche (« une banque qui verse un dividende
élevé », « une valeur liquide des télécoms ») et obtient les sociétés cotées
classées par pertinence, avec les faits qui justifient le classement. Jev
(TypeSafe, `rank`) ordonne ; il n'écrit rien.

## Décisions

| Sujet | Décision |
|---|---|
| Accès | **Comptes connectés seulement.** Anonyme : recherche par mots-clés + invitation à se connecter. |
| Emplacement | Champ en tête de `/societes` (page publique), résultat sous le champ. |
| Candidats | Les ~48 actions actives, une fiche-faits chacune. |
| Quota individuel | 20 recherches Jev / heure / compte (`checkRateLimit`, clé = identifiant de compte haché). |
| Plafond global | 300 appels Jev / jour (variable `RECHERCHE_JEV_PLAFOND_JOUR`). **Bloquant en cas de doute.** |
| Cache | 24 h, clé = empreinte SHA-256 de la requête normalisée. Le texte de la requête n'est jamais stocké. |
| Repli | Mots-clés (déterministe, gratuit) si : anonyme, quota ou plafond atteint, compteur illisible, Jev en erreur ou > 8 s. |

## Fiche-faits d'une société (ce que Jev reçoit)

Texte court, **uniquement des données en base**, recalculé au plus une fois par
jour (cache du chargeur) :

`SNTS — Sonatel. Secteur : Télécommunications. Pays : Sénégal. Rendement du
dividende : 6,1 % (net). Liquidité : classe A. Performance sur 12 mois : +8,4 %.
Note WESTBOURSE : B.`

| Fait | Source | Absent → |
|---|---|---|
| Code, nom, secteur, pays | `brvm_instruments` | ligne omise |
| Rendement du dividende | `dividends` + `computeYield`, base `net`/`brut` dite ; base inconnue → omis (règle « double IRVM ») | ligne omise |
| Liquidité | `liquidity_daily`, dernière séance, classe A–D | ligne omise |
| Perf. 12 mois | `brvm_actions_daily`, même calcul que le simulateur de budget | ligne omise |
| Note A–F | `signals_daily` + `scoreToRating` | ligne omise |

Jamais de valeur supposée : un fait absent n'apparaît pas.

## Flux

1. `POST /api/recherche-societes` (runtime Node), corps `{ q }`.
2. Validation : 3–150 caractères ; refus si e-mail ou numéro de téléphone détecté
   (rien n'est envoyé). Réponse 400 lisible.
3. Session Supabase : absente → réponse `mode: 'mots-cles'`.
4. Empreinte de `normaliser(q)` → lecture du cache (< 24 h) → réponse `mode: 'jev', cache: true`.
5. Quota du compte (`checkRateLimit`) puis plafond du jour (nombre d'entrées de
   cache créées aujourd'hui) ; erreur de lecture ⇒ plafond considéré atteint.
6. Appel Jev `rank` (requête + fiches), délai 8 s ; succès ⇒ écriture du cache
   (empreinte, résultat, `any_relevant`, horodatage).
7. Réponse : `{ mode, resultats: [{ code, nom, pertinence, faits[] }], aucunPertinent, faitsDuJour }`.

## Interface

- Champ + exemples cliquables ; état de chargement ; résultats 5 à 8 lignes
  (barre de pertinence, faits, lien fiche).
- `any_relevant < 0,5` ⇒ « Aucune société ne correspond clairement » (pas de
  résultat imposé).
- Mode mots-clés signalé (« recherche simple ») et pourquoi (connexion, quota).
- Mention fixe : « Classement par pertinence, pas une recommandation
  d'investissement. Données du JJ/MM/AAAA. »

## Données et RGPD

- Nouvelle table `recherche_societes_cache` : `empreinte` (PK), `resultat` jsonb,
  `aucun_pertinent` numeric, `cree_le`. RLS activée **sans policy** (service_role
  seul) ; purge > 24 h à chaque écriture et dans `purge_rgpd_retention()`.
- Aucun texte de requête, aucun identifiant de compte stocké dans le cache.
  Quota : lignes `rate_limit_hits` purgées hors fenêtre (existant).
- TypeSafe = sous-traitant (texte de la requête) : mention dans `/confidentialite`
  et `docs/RGPD.md`.
- Clé `TYPESAFE_API_KEY` : variable serveur Vercel (projet `frontend`), posée par
  l'exploitant ; jamais côté client.

## Modules (frontières)

| Module | Rôle | Pur ? |
|---|---|---|
| `lib/recherche/normaliser.ts` | normalisation, empreinte, détection e-mail/téléphone | oui, testé |
| `lib/recherche/fiches.ts` | données → fiches-faits texte | oui, testé |
| `lib/recherche/motsCles.ts` | repli déterministe (score par recouvrement de termes) | oui, testé |
| `lib/recherche/decision.ts` | choix du mode (session, quota, plafond, erreur) | oui, testé |
| `lib/server/jev.ts` | client HTTP TypeSafe (`rank`), délai, erreurs typées | non |
| `app/api/recherche-societes/route.ts` | orchestration | non |
| `components/societes/RechercheSocietes.tsx` | champ + résultats | client |

## Tests

Unitaires : normalisation stable (accents, casse, espaces), détection e-mail /
téléphone, fiche sans fait absent, repli mots-clés ordonné, décision de mode
(anonyme, quota, plafond atteint, compteur en erreur ⇒ mots-clés). Route : Jev
simulé (succès, délai dépassé, erreur) ⇒ toujours une réponse exploitable.

## Hors périmètre

Recherche dans les articles ou les SGI ; historique des recherches ; suggestions
automatiques. Chantiers suivants : WhatsApp intelligent (routage d'intention),
communiqués BRVM (socle + reclassement), garde-fous des textes IA.
