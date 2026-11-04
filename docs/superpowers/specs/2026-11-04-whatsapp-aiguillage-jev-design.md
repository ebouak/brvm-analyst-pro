# WhatsApp intelligent : aiguillage des messages libres par Jev — conception

Date : 2026-11-04 · Statut : validée (brainstorming) · Chantier « Jev dans WhatsApp »

## Objectif

Un message WhatsApp libre (« quel est le cours de Sonatel aujourd'hui ? ») reçoit
la **réponse exacte** que donnent déjà les commandes (`COURS`, `DIV`, `PALMARES`),
au lieu d'aller à la console humaine ou à l'agent LLM payant. Jev classe
l'intention et identifie la société ; il n'écrit rien. Tout doute retombe sur
l'aiguillage actuel : on ne perd jamais un message.

**Critère de succès** : sur un jeu figé de messages types, l'aiguillage Jev
donne plus de réponses exactes que l'aiguillage actuel, sans jamais répondre sur
la mauvaise société ni traiter une demande de conseil comme une demande de cours.

## Constat (production, 2026-11-04)

- Aiguillage actuel (`app/api/whatsapp/waha/route.ts`) : appairage → STOP → RECAP
  → commandes figées (≤ 4 mots, mot-clé en tête) → agent si abonné lié → console.
- Une phrase naturelle n'est pas une commande : elle va à la console ou à l'agent.
- Volume : 12 commandes et 20 messages de contact WhatsApp au total. Le gain porte
  sur la qualité de chaque échange et prépare la montée en charge.

## Décisions

| Sujet | Décision |
|---|---|
| Périmètre | **Tous les messages libres** (anonymes et abonnés), après les étapes existantes et avant l'agent / la console. |
| Appel | **Un seul appel Jev mixte** : une question `choice` (intention) + une question `noul` par société cotée (« le message parle-t-il de cette société ? »). |
| Réponses | Commandes existantes via `repondreCommande` (quota et journal inchangés) ; textes **fixes** pour clarification, refus de conseil, salutation. Aucune IA générative ajoutée. |
| Clarification | Sans état : la réponse propose des **commandes prêtes** (« Répondez *COURS SNTS* ou *COURS SGBC* »). |
| Doute | Intention incertaine ⇒ aiguillage actuel (agent si abonné lié, sinon console). |
| Interrupteur | Drapeau `whatsapp_jev` (`feature_flags`, `/admin/features`) : `disabled` ⇒ aiguillage actuel seul. |
| Quota | 30 classements / heure / numéro haché (`checkRateLimit`, route `whatsapp-jev`). |
| Plafond global | Réservation **atomique** dans une table de budget générique `jev_budget (usage, jour)`, usage `whatsapp`, 300 / jour (`WHATSAPP_JEV_PLAFOND_JOUR`). Bloquant en cas de doute. |
| Délai | 6 s, puis aiguillage actuel. |

## Intentions

| Intention | Sens | Action (si décision sûre) |
|---|---|---|
| `cours` | cours, prix, variation du jour d'une société | `COURS <code>` |
| `dividendes` | dividende, rendement, date de paiement | `DIV <code>` |
| `palmares_hausses` / `_baisses` / `_volumes` | meilleures hausses, baisses, volumes de la séance | `PALMARES …` |
| `aide` | que peut faire le service, comment ça marche | `AIDE` |
| `humain` | veut parler à une personne de l'équipe | console |
| `conseil` | demande s'il faut acheter, vendre, conserver ; « quelle action acheter » | **refus fixe** + commandes utiles |
| `analyse` | vraie question d'analyse (pourquoi, comparer, expliquer) | agent si abonné lié, sinon console |
| `salutation` | bonjour, merci, au revoir, sans demande | réponse fixe courte + `AIDE` |
| `autre` | rien de ce qui précède | console |

## Décision (pure, testée)

1. Réponse Jev invalide, intention avec probabilité < 0,85 ou marge < 0,5 ⇒
   **aiguillage actuel**.
2. `cours` / `dividendes` : sociétés de score ≥ 0,8 ;
   - exactement une ⇒ commande sur son code ;
   - deux ou trois ⇒ clarification (commandes prêtes) ;
   - aucune ou plus de trois ⇒ clarification générique (« précisez le code, ex. *COURS SNTS* »).
3. `palmares_*`, `aide` ⇒ commande. `conseil` ⇒ refus fixe. `salutation` ⇒ texte fixe.
4. `humain`, `autre` ⇒ console ; `analyse` ⇒ agent si abonné lié, sinon console.

Seuils exportés et réglables ; la décision ne dépend que de la réponse validée.

## Flux (route WAHA)

Inchangé jusqu'aux commandes figées. Ensuite, pour un texte non vide qui n'est ni
HUMAIN ni STOP :

1. Drapeau `whatsapp_jev` actif ? sinon aiguillage actuel.
2. Texte : 3–500 caractères ; e-mail ou numéro de téléphone détecté ⇒ **jamais
   envoyé** à TypeSafe, aiguillage actuel.
3. Quota du numéro haché, puis réservation de budget ; refus ou erreur ⇒
   aiguillage actuel.
4. Appel Jev (délai 6 s), validation de la réponse ⇒ décision ⇒ action.
5. Journal `whatsapp_aiguillages` : intention retenue, décision, probabilité,
   jamais le texte ni le numéro.

## Contrat Jev

- `state` : `{ message: <texte>, societes: { <CODE>: "<CODE> — <nom>. Secteur : … Pays : …" } }`
  (fiches courtes : identité seulement, pas de chiffres de marché).
- `questions` : `intention` (`choice`, critères = descriptions du tableau) +
  `<CODE>` (`noul`) pour chaque société.
- Réponse validée : intention présente avec distribution de probabilités finies
  dans [0, 1] ; chaque code attendu présent, aucun autre ; sinon aiguillage actuel.
- Client HTTP **générique** `lib/jev/client.ts` (`POST /v1/systemone`), réutilisé
  par la recherche des sociétés (son `classerParJev` devient un adaptateur).

## Données et RGPD

- Migration : `jev_budget (usage text, jour date, appels int, PK (usage, jour))` +
  fonction atomique `jev_reserver_budget(p_usage, p_plafond, p_jour)` ;
  `whatsapp_aiguillages (id, created_at, intention, decision, probabilite)` ;
  drapeau `whatsapp_jev`. RLS activée sans policy, fonctions révoquées pour
  `public, anon, authenticated` ; purge 90 j (aiguillages) et 30 j (budget).
- Envoyé à TypeSafe : **le texte du message seulement**, jamais le numéro ni le
  nom ; rien de stocké chez nous hors journal anonyme.
- `/confidentialite` : la mention TypeSafe couvre aussi les messages WhatsApp ;
  `docs/RGPD.md` complété.
- Journaux d'exploitation : codes d'événement seulement.

## Modules

| Module | Rôle | Pur ? |
|---|---|---|
| `lib/jev/client.ts` | POST `/v1/systemone`, clé en Bearer, erreurs à code seul | non |
| `lib/whatsapp/aiguillage/intentions.ts` | intentions et descriptions | oui |
| `lib/whatsapp/aiguillage/requete.ts` | construction de la requête mixte | oui |
| `lib/whatsapp/aiguillage/valider.ts` | validation de la réponse | oui |
| `lib/whatsapp/aiguillage/decider.ts` | réponse validée → décision | oui |
| `lib/whatsapp/aiguillage/textes.ts` | textes fixes (clarification, refus, salutation) | oui |
| `lib/whatsapp/aiguillage/aiguiller.ts` | flux injectable (drapeau, filtre, quota, budget, Jev, journal) | oui (dépendances injectées) |
| `app/api/whatsapp/waha/route.ts` | branche l'aiguillage avant l'agent / la console | non |

## Tests

- Unitaires : requête (une question par société + intention), validation (code
  inconnu, distribution invalide, réponse incomplète), décision (chaque intention,
  seuils, ambiguïté), textes fixes sans chiffre inventé.
- Invariants : drapeau coupé ⇒ aucun appel ; message avec e-mail/numéro ⇒ aucun
  appel ; quota / plafond / erreur / délai ⇒ aiguillage actuel ; aucun journal ne
  contient le texte ; `conseil` ne déclenche jamais une commande ; une société
  ambiguë ne donne jamais une réponse sur un seul code.
- Budget générique : 20 réservations simultanées, plafond 5 ⇒ 5.

## Évaluation (avant activation)

- Jeu figé `lib/whatsapp/aiguillage/evaluation/jeu.ts` : ~40 messages types
  (phrases naturelles de cours et de dividendes, sociétés par nom, code ou
  périphrase, palmarès, aide, demandes de conseil, salutations, demandes
  humaines, questions d'analyse, hors sujet), chacun avec l'intention et la
  société attendues.
- Mesures, Jev contre aiguillage actuel :
  1. part des messages recevant la réponse exacte attendue ;
  2. **réponses sur la mauvaise société : 0 exigé** ;
  3. **demandes de conseil traitées comme commandes : 0 exigé** ;
  4. part des messages envoyés à la console à tort.
- Règle d'activation : 1 et 4 meilleurs que l'aiguillage actuel, 2 et 3 nuls.
  Sinon le drapeau reste `disabled`.

## Hors périmètre

Mémoire de conversation ; réponses générées ; Telegram (même principe, plus tard) ;
messages vocaux et images.
