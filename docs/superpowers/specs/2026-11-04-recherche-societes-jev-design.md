# Recherche en langage naturel parmi les sociétés (Jev) — conception

Date : 2026-11-04 · Statut : v2, relecture intégrée · Chantier 3 de « Jev sur WESTBOURSE »

## Objectif

Un abonné éligible décrit ce qu'il cherche (« une banque qui verse un dividende
élevé », « une valeur liquide des télécoms ») et obtient les sociétés cotées
classées par pertinence, avec les faits qui justifient le classement. Jev
(TypeSafe, `rank`) ordonne ; il n'écrit rien.

**Critère de succès** : démontrer, sur un jeu d'évaluation figé, que Jev améliore
la recherche par rapport au repli — pas seulement qu'il répond (§ Évaluation).

## Décisions

| Sujet | Décision |
|---|---|
| Accès | Compte connecté **et** éligible (`canAccess('recherche_ia')`, `lib/server/featureGate.ts`). Au lancement, toute offre est éligible ; l'éligibilité se resserre sans code. Sinon : mots-clés. |
| Emplacement | Champ en tête de `/societes` (page publique), résultats dessous. |
| Candidats | Les ~48 actions actives, une fiche-faits chacune, figées dans un **instantané**. |
| Quota individuel | 20 appels Jev / heure / compte (`checkRateLimit`, clé = identifiant haché). **Une réponse en cache ne consomme ni quota ni budget.** |
| Plafond global | 300 appels Jev / jour (`RECHERCHE_JEV_PLAFOND_JOUR`), par **réservation atomique** en base. Bloquant en cas de doute. |
| Cache | 24 h, clé = (empreinte de la requête normalisée, instantané). Texte de la requête jamais stocké. |
| Repli | Recherche par mots-clés à dictionnaire métier, déterministe, gratuite (§ Repli). |

## Instantané des faits

- Un **instantané** = les fiches-faits des ~48 sociétés à une date de séance.
  `snapshotId` = date de séance + empreinte SHA-256 des fiches (ex.
  `2026-11-04.3f9a…`). Recalculé au plus une fois par jour (chargeur mis en
  cache).
- Le cache est indexé par instantané : **un nouvel instantané invalide les
  résultats précédents** (ils ne sont plus lus, puis purgés).
- La réponse expose `snapshotId` et `actualiseLe` (date de séance).

### Fiche-faits (ce que Jev reçoit)

Texte court, **uniquement des données en base** :

`SNTS — Sonatel. Secteur : Télécommunications. Pays : Sénégal. Rendement du
dividende : 6,1 % (net). Liquidité : classe A. Performance sur 12 mois : +8,4 %.
Note WESTBOURSE : B.`

| Fait (`FaitSociete.cle`) | Source | Absent → |
|---|---|---|
| `secteur`, `pays` (+ code, nom) | `brvm_instruments` | fait omis |
| `rendement` | `dividends` + `computeYield`, base `net`/`brut` dite ; base inconnue → omis (règle « double IRVM ») | fait omis |
| `liquidite` | `liquidity_daily`, dernière séance, classe A–D | fait omis |
| `perf12m` | `brvm_actions_daily` : cours d'une séance à 365 j ± 12 j ; aucune séance dans la fenêtre → **omis, jamais extrapolé** | fait omis |
| `note` | `signals_daily` + `scoreToRating` ; `NR` → omis | fait omis |

`FaitSociete = { cle, libelle, valeur }` ; l'interface n'affiche **que** des
faits de l'instantané (aucun fait produit ailleurs).

## Contrat de réponse

```ts
type ReponseRecherche = {
  mode: 'jev' | 'mots-cles';
  raison:
    | 'non_connecte' | 'offre_non_eligible' | 'quota_atteint'
    | 'plafond_atteint' | 'compteur_indisponible'
    | 'jev_indisponible' | 'donnees_indisponibles'
    | null;                       // null ⇔ mode 'jev'
  cache: boolean;
  statut: 'correspondance' | 'partielle' | 'aucune';
  resultats: Array<{ code: string; nom: string; score: number; faits: FaitSociete[] }>;
  snapshotId: string | null;
  actualiseLe: string | null;     // AAAA-MM-JJ, date de séance
};
```

- **Statut (mode Jev)** : `aucune` si `pertinence_globale` (le `any_relevant` de
  Jev) < 0,5 ; `partielle` si moins de 3 sociétés ont un score ≥ 0,5 ;
  sinon `correspondance`. Résultats : sociétés de score ≥ 0,5, 8 au plus,
  triées par score puis par code (ordre stable).
- **Statut (mots-clés)** : `aucune` si aucun score > 0 ; `partielle` si 1–2
  résultats ; sinon `correspondance`.
- `donnees_indisponibles` : instantané impossible à construire ⇒ mots-clés sur
  les seuls codes et noms, ou 503 si même cela échoue.

## Flux

1. `POST /api/recherche-societes` (runtime Node), corps `{ q }`.
2. Validation : 3–150 caractères ; e-mail ou téléphone détecté ⇒ 400, rien
   n'est envoyé ni journalisé.
3. Instantané (cache du chargeur) ; échec ⇒ `donnees_indisponibles`.
4. Session ⇒ sinon `non_connecte` ; éligibilité ⇒ sinon `offre_non_eligible`.
   **Contrôlés avant toute lecture du cache** : un compte non éligible ne
   récupère jamais une réponse Jev mise en cache.
5. Cache (empreinte, instantané) : entrée `prete` ⇒ réponse `cache: true`, sans
   quota ni budget.
6. Quota du compte ⇒ sinon `quota_atteint`.
7. **Verrou par requête** : insertion de l'entrée de cache en état `en_cours`
   (clé primaire). Si elle existe déjà `en_cours` (même recherche en cours
   ailleurs) : attente du résultat jusqu'à 8 s par relectures espacées, sinon
   `jev_indisponible`. Un seul appel Jev par (requête, instantané).
8. **Réservation de budget** atomique (`recherche_reserver_budget`) ⇒ refusée :
   `plafond_atteint` ; erreur de lecture : `compteur_indisponible`. Le verrou est
   libéré dans ces deux cas.
9. Appel Jev `rank`, délai 8 s. **Validation de la réponse** : chaque identifiant
   est un code de l'instantané, aucun doublon, chaque score fini dans [0, 1],
   `any_relevant` fini dans [0, 1]. Échec, erreur ou délai ⇒ `jev_indisponible`,
   verrou libéré.
10. Écriture du résultat (`prete`). **Un échec d'écriture ne casse pas la
    réponse** : le résultat Jev est renvoyé, l'échec est journalisé (sans la
    requête), l'entrée `en_cours` expire seule (< 30 s).

## Modèle de données (migration)

- `recherche_societes_cache` : `empreinte` text, `snapshot_id` text (PK
  composite), `etat` (`en_cours` | `prete`), `resultat` jsonb,
  `pertinence_globale` numeric (probabilité qu'au moins une société
  corresponde), `cree_le` timestamptz. Une entrée `en_cours` de plus de 30 s
  est réputée abandonnée et peut être reprise.
- `recherche_societes_budget` : `jour` date (PK), `appels` int.
- `recherche_reserver_budget(p_plafond int) returns boolean` : `insert … on
  conflict (jour) do update set appels = appels + 1 where appels < p_plafond`
  — atomique, sans course entre requêtes simultanées.
- RLS activée **sans policy** sur les deux tables ; fonction `revoke execute …
  from public, anon, authenticated` (règle CLAUDE.md § 11), appelée par le
  service_role seul. Purge > 24 h (cache) et > 30 j (budget) dans
  `purge_rgpd_retention()`.
- Ni texte de requête ni identifiant de compte stockés.

## Repli : recherche simple, modeste et prévisible

Ne cherche pas à imiter Jev. `lib/recherche/motsCles.ts` + dictionnaire
**versionné** `lib/recherche/dictionnaire.ts` (`VERSION` exportée) :

| Expressions | Rapprochement |
|---|---|
| banque, bancaire | secteur « bancaire » |
| télécom, télécommunications, opérateur | secteur « télécommunications » |
| dividende, rendement, distribue | fait `rendement` présent |
| liquide, liquidité, échangée | fait `liquidite` |
| (pays : Côte d'Ivoire, ivoirien, Sénégal, sénégalais…) | fait `pays` |

Règles :
- pondération : code (×5) > nom (×3) > secteur / pays (×2) > autres faits (×1) ;
- mots vides retirés (le, la, des, une, qui, avec, pour…) ;
- **négations** : un terme précédé de « hors », « sauf », « pas de », « sans »,
  « ni » **exclut** les sociétés qui le portent au lieu de les favoriser ;
- aucun résultat de score nul ; égalités départagées par code (ordre stable) ;
- aucun fait financier inventé : le repli n'affiche que les faits de l'instantané.

## Interface

- Champ + exemples cliquables ; chargement ; résultats (barre de score, faits,
  lien fiche) ; `statut: 'aucune'` ⇒ « Aucune société ne correspond clairement ».
- Mode mots-clés signalé (« recherche simple ») avec sa `raison` en clair.
- **Séquencement** : chaque recherche porte un numéro et annule la précédente
  (`AbortController`) ; une réponse ancienne n'écrase jamais une plus récente.
- Mention fixe : « Classement par pertinence, pas une recommandation
  d'investissement. Données de la séance du JJ/MM/AAAA. »

## Confidentialité

- Le texte de la requête n'apparaît dans **aucun** journal, message d'erreur,
  Sentry ou réponse d'erreur : les erreurs ne portent qu'un code.
- TypeSafe = sous-traitant (texte de la requête) : mention dans `/confidentialite`
  et `docs/RGPD.md`.
- `TYPESAFE_API_KEY` : variable serveur Vercel (projet `frontend`), posée par
  l'exploitant ; jamais côté client.

## Modules

| Module | Rôle | Pur ? |
|---|---|---|
| `lib/recherche/normaliser.ts` | normalisation, empreinte, détection e-mail/téléphone | oui |
| `lib/recherche/instantane.ts` | données → fiches-faits + `snapshotId` | oui |
| `lib/recherche/dictionnaire.ts` | rapprochements métier versionnés | oui |
| `lib/recherche/motsCles.ts` | repli (pondération, négations, ordre stable) | oui |
| `lib/recherche/decision.ts` | choix du mode et de la raison ; calcul du statut | oui |
| `lib/recherche/validerJev.ts` | validation de la réponse du fournisseur | oui |
| `lib/server/jev.ts` | client HTTP TypeSafe (`rank`), délai, erreurs typées | non |
| `lib/server/rechercheSocietesStore.ts` | cache, instantané, réservation de budget, verrous | non |
| `app/api/recherche-societes/route.ts` | orchestration seule (mince) | non |
| `components/societes/RechercheSocietes.tsx` | champ, séquencement, résultats | client |

## Tests (avant mise en production)

Unitaires (purs) : normalisation, détection e-mail/téléphone, fiche sans fait
absent, dictionnaire, négations, ordre stable, statut.

Invariants métier et concurrence :

| Domaine | Test |
|---|---|
| Budget | N requêtes simultanées n'obtiennent jamais plus de réservations que le plafond (fonction SQL exercée en parallèle sur base de test) |
| Cache | N recherches identiques simultanées ⇒ un seul appel Jev (verrou) |
| Versionnement | nouvel instantané ⇒ l'ancien résultat n'est plus servi |
| Accès | compte non éligible ⇒ jamais de réponse Jev, même en cache |
| Quota | réponse en cache ⇒ ni quota ni budget consommés |
| Fournisseur | code inconnu, doublon, score hors [0,1] ou NaN ⇒ repli `jev_indisponible` |
| Données | historique < 1 an ⇒ `perf12m` absent, jamais fabriqué |
| Confidentialité | exception provoquée ⇒ aucun journal ne contient la requête |
| Interface | réponse lente d'une recherche ancienne ⇒ ignorée |
| Persistance | échec d'écriture du cache après succès Jev ⇒ réponse correcte renvoyée |

## Évaluation (démontrer l'apport de Jev)

- Jeu **figé** `lib/recherche/evaluation/jeu.ts` : 50 recherches —
  formulations courantes, synonymes, contraintes multiples, négations,
  absence de correspondance, données manquantes, demandes impossibles
  (« action garantie sans risque »).
- Chaque cas porte des **contraintes vérifiables sur les faits** (ex. secteur
  = bancaire ET rendement présent ; pays ≠ Côte d'Ivoire), pas une liste
  d'attendus saisie à la main : la vérité découle de l'instantané.
- Script `npm run eval:recherche` (manuel, jamais en CI : appels payants) qui
  mesure, pour Jev **et** pour le repli :
  1. précision des 3 premiers résultats (part qui satisfait les contraintes) ;
  2. respect des contraintes explicites, négations comprises ;
  3. justesse de l'absence de résultat (cas « aucune » attendus) ;
  4. absence de faits inventés (tout fait affiché ∈ instantané) ;
  5. **écart Jev − repli** sur chaque mesure.
- **Règle de lancement** : la recherche Jev n'est ouverte que si elle bat le
  repli sur les mesures 1 et 2 sans régresser sur 3 et 4. Sinon, on garde le
  repli et on corrige.

## Hors périmètre

Recherche dans les articles ou les SGI ; historique des recherches ;
suggestions automatiques. Chantiers suivants : WhatsApp intelligent (routage
d'intention), communiqués BRVM (socle + reclassement), garde-fous des textes IA.
