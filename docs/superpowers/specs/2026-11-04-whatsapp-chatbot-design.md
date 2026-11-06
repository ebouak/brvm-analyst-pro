# WhatsApp : du répondeur à commandes au vrai chatbot — design

Date : 2026-11-04. Branche `feat/whatsapp-chatbot`. Validé par l'exploitant
(« go pour le reste »), approche A, quotas fixés par lui.

## 0. Constat mesuré (30 derniers jours)

- **0** conversation avec l'agent IA ; **21** messages partis à la console
  (accusé générique) ; **17** commandes.
- Accès à l'agent : compte + WhatsApp lié + case `agent_optin` → **1 compte**.
- Jev (0192) : phrases complètes ≈ 1,0 ; un nom seul hésitait (corrigé en #166).

Le bot n'est pas trop bête : il est **inaccessible**. Tout ce qui n'est pas une
commande finit chez un humain.

## 1. Parcours d'un message (approche A : rapide d'abord, IA ensuite)

Ordre dans `app/api/whatsapp/waha/route.ts`, inchangé jusqu'à l'étape 4 :

1. Code d'appairage · STOP · RECAP · commande figée (`lireCommande`) — inchangés.
2. **Note vocale** (`audio/*`, ≤ 1 Mo) → transcription → le texte reprend au point 1.
   Autre média (image, document) → console, comme aujourd'hui.
3. **EFFACER** (nouvelle commande) → efface l'historique de cette conversation.
4. **HUMAIN** → console (inchangé).
5. **Jev sûr** (`decider` : commande, refus de conseil, salutation) → réponse
   exacte, sans LLM, **sans consommer de quota IA**. La réponse est écrite dans
   l'historique pour que l'agent garde le fil.
6. **Tout le reste → agent IA** (au lieu de la console). Les décisions Jev
   `clarification` et `aiguillage_actuel` vont désormais à l'agent : il a
   l'historique (« et son dividende ? ») et peut demander lui-même la société.
7. **Échec de tous les fournisseurs LLM, plafond global atteint** → console, avec
   un accusé honnête (« un membre de l'équipe vous répondra »). Jamais de perte.

Le drapeau `whatsapp_jev` garde son rôle (étape 5). Nouveau drapeau
**`whatsapp_chatbot`** livré **coupé** : coupé, l'étape 6 retombe sur le chemin
actuel (agent pour les abonnés consentants, sinon console). L'activation reste une
décision de l'exploitant.

## 2. Identité, quotas, budget

| Palier | Qui | Questions IA | Outils |
|---|---|---|---|
| Inconnu | numéro non lié | **1 / jour / conversation** | marché + pédagogie |
| Lié gratuit | `whatsapp_liaisons` | **3 / jour** (flag `whatsapp_agent`, existant) | marché + pédagogie |
| Premium lié | `is_premium` ou admin | **100 / jour** (existant) | + portefeuille, alertes, watchlist |

- Seules les **réponses de l'agent** et les **notes vocales** consomment le quota
  (une note vocale = une question, transcription et réponse comprises). Commandes
  et réponses Jev : illimitées.
- Quota inconnu : `checkRateLimit({ route: 'whatsapp-ia', ip: hacher(chatId),
  maxHits: 1, windowSeconds: 86400 })` — même mécanisme que la recherche.
- **Le consentement `agent_optin` n'est plus exigé** pour les outils de marché :
  un compte lié sans la case passe au palier « lié gratuit ». `agent_optin` reste
  exigé pour les outils **personnels** (portefeuille, alertes) — inchangé.
- **Plafond global journalier** : `jev_reserver_budget('whatsapp_ia', plafond)`
  (table générique 0192), `WHATSAPP_IA_PLAFOND_JOUR` (défaut 300). Réservé AVANT
  l'appel LLM ; refusé → étape 7. Sans clé LLM, rien n'est réservé.
- **Sous-plafond des inconnus** (relecture adverse, Fable indisponible) : créer des
  numéros WhatsApp est facile ; sans sous-plafond, un afflux d'inconnus épuiserait
  le plafond global et priverait les abonnés. Les inconnus réservent EN PLUS
  `jev_reserver_budget('whatsapp_ia_inconnu', WHATSAPP_IA_PLAFOND_INCONNU_JOUR)`
  (défaut 150) : au-delà, réponse fixe « limite du jour atteinte » + commandes.
- Le limiteur `checkRateLimit` est fail-open (base illisible ⇒ autorisé) : le
  plafond global, lui, est fail-closed (erreur ⇒ refus ⇒ console).
- Quota atteint : réponse FIXE (sans IA) qui rappelle ce qui reste illimité
  (COURS, DIV, PALMARES, AIDE) et, selon le palier, invite à créer un compte et lier
  son WhatsApp (`/signup?next=/parametres/alertes`) ou à passer Premium (`/pricing`).

## 3. Outils de l'agent

Existants (lecture seule, `lib/agent/outils.ts`) : `cours_valeur`,
`historique_valeur`, `palmares_seance`, `actualites_valeur`, `liquidite_valeur`,
`dividendes_valeur` ; Premium : `mon_portefeuille`, `mes_alertes`.

Nouveaux, dans un module séparé `lib/agent/outilsChatbot.ts` (le fichier existant
fait 575 lignes) :

| Outil | Renvoie | Source |
|---|---|---|
| `fiche_societe(code)` | nom, secteur, pays, cours et séance, plage 52 s, dernier exercice annuel (chiffre d'affaires, résultat net, en FCFA), faits de la recherche (rendement **avec sa base fiscale**, liquidité, perf. 12 mois) | `brvm_actions_daily`, `income_statements`, instantané de la recherche (#163), `brvm_instruments` |
| `carnet_ordres(code)` | meilleure limite achat/vente, quantités, **date de séance** | `carnet_ordres` (0138) |
| `comparer_valeurs(codes[2..3])` | 2-3 fiches en un appel (évite d'épuiser `MAX_TOURS = 3`) | compose `fiche_societe` |
| `chercher_societes(description)` | jusqu'à 5 sociétés + faits | moteur PR #163 en **mode mots-clés** (pas de second appel Jev) |
| `notion_bourse(sujet)` | ≤ 3 leçons Academy : titre, cours, lien `/formations/academy` | `academy_courses` publiés (titres de leçons), score par mots-clés normalisés, cache 6 h |

Tout chiffre absent renvoie `null` explicite. **Exclus volontairement** : signaux
BUY/HOLD/SELL, scores, notations A-F — sur WhatsApp ce serait une recommandation.
`cours_valeur` renvoie aujourd'hui `signal`/`confiance` : l'exécuteur du chatbot
les **retire** avant de rendre le résultat au modèle.

**BPA, dividende par action et PER exclus de la fiche** : mesuré le 2026-11-04,
`income_statements` porte pour SNTS un BPA de 413,6 et un dividende de 174 alors
que résultat net ÷ actions ≈ 4 136 (ORAC, lui, est cohérent). Un PER calculé
dessus vaudrait ~95 au lieu de ~9,5. Les dividendes passent par
`dividendes_valeur` (table `dividends`, auditée). Défaut de données signalé à
l'exploitant, non corrigé ici.

**`notion_bourse` ne livre pas le contenu des leçons** : l'Academy est payante.
L'outil renvoie titres et lien ; l'agent explique la notion en ses propres mots
(sans chiffre : le verrou des chiffres s'applique) et renvoie à la leçon.

## 4. Garde-fous de réponse

- Prompt : `buildSystemPrompt({ canal: 'whatsapp', outils: true, premium })`,
  source unique avec Telegram (pas de conseil, chiffres des outils seulement).
  Ajouts propres au canal : réponses ≤ 600 caractères, gras `*…*`, une
  suggestion de question suivante, invitation à la fiche du site.
- **Verrou des chiffres** (`lib/whatsapp/chatbot/chiffres.ts`, pur, testé) : tout
  nombre de la réponse doit figurer dans les retours d'outils, dans l'historique
  envoyé, ou dans le message de l'utilisateur. Normalisation : espaces
  insécables, virgule/point, `%`, arrondis (une valeur affichée à ≤ 2 décimales
  qui arrondit un nombre source passe), années 1990-2100, rangs 1-10.
  Échec → **une** régénération avec la liste des chiffres refusés ; second échec →
  réponse FIXE sans chiffre + lien vers `/societes/<CODE>` si une société est
  identifiée, sinon `/actions`. Journalisé (`chiffre_etranger`), jamais le texte.
- **Données personnelles** : email et téléphone détectés
  (`contientDonneePersonnelle`) sont **masqués** avant l'envoi au LLM.

## 5. Mémoire de conversation

Migration **0193** : `whatsapp_conversations` devient la mémoire de TOUTE
conversation.

- `user_id` devient **nullable** ; ajout `chat_hash text` (HMAC-SHA256 du
  `chatId` par `WAHA_WEBHOOK_HMAC_KEY`, préfixe `conversation:` — pseudonyme,
  non réversible sans le secret) ; contrainte `user_id is not null or chat_hash is not null` ; index
  `(chat_hash, created_at desc)`.
- Lecture de l'historique **par `chat_hash`** (10 derniers messages, 72 h max) ;
  `user_id` rempli quand la conversation est liée (export/suppression RGPD).
- Rétention : **30 jours** pour les lignes sans `user_id`, 90 jours sinon
  (inchangé) — dans `purge_rgpd_retention()`.
- **EFFACER** supprime toutes les lignes du `chat_hash` ; réponse fixe de
  confirmation.
- RLS : inchangée (aucune policy, service_role seul).

## 6. Notes vocales

- `lireEvenementWaha` expose `media: { url, mimetype, taille } | null` (le champ
  booléen actuel devient dérivé). Le serveur WAHA n'ayant pas d'URL publique
  configurée, l'URL de fichier est **réécrite** sur l'origine `WAHA_URL` (chemin
  conservé), téléchargée avec l'en-tête `X-Api-Key`. WAHA garde les fichiers
  180 s : téléchargement immédiat.
- Transcription : `lib/server/transcription.ts`, Gemini API native
  (`generateContent`, audio en ligne, modèle `MODELE_LLM.gemini`), consigne
  « transcris mot à mot en français, sans rien ajouter ». Refus si > 1 Mo ou si
  la transcription est vide → réponse fixe « Je n'ai pas compris la note vocale,
  pouvez-vous l'écrire ? ». L'audio n'est **jamais stocké** ; seule la
  transcription entre dans l'historique (préfixée 🎤 dans la console seulement).
- Une note vocale consomme une question IA **avant** la transcription.

## 7. Information et RGPD

- **Premier message IA d'une conversation** (aucune ligne d'historique) : pied
  fixe « Réponses générées par IA à partir des données WESTBOURSE — pas un conseil
  d'investissement. Tapez EFFACER pour effacer cet échange · confidentialité :
  westbourse.com/confidentialite ».
- Base légale : répondre à une demande que la personne nous adresse (mesures
  précontractuelles / intérêt légitime) pour les outils de marché ; consentement
  `agent_optin` conservé pour les outils personnels.
- `/confidentialite` et `docs/RGPD.md` : messages WhatsApp traités par IA
  (DeepSeek, Google Gemini, xAI), notes vocales transcrites par Google Gemini et
  non conservées, historique 30 j (non lié) / 90 j (lié), EFFACER.
- Export `/api/account/export` : inchangé (`whatsapp_conversations` par
  `user_id`). Suppression : cascade.
- Journal : aucun texte ni numéro (codes d'événement seulement).

## 8. Erreurs

Ne lève jamais (comme `repondreAgent`). Tout échec → étape 7 (console) avec
alerte exploitant si c'est une panne (tous fournisseurs LLM, base). Délai LLM
borné par le `maxDuration` de la route. Doublons WAHA : déjà dédupliqués
(`dejaTraite`) avant tout traitement.

## 9. Tests

- Purs : verrou des chiffres (formats FR, arrondis, années, faux positifs
  connus), choix du palier, texte de quota, pied d'information, parseur média WAHA,
  index Academy (`notion_bourse`), réécriture d'URL de fichier.
- Orchestrateur `lib/whatsapp/chatbot/repondre.ts` avec dépendances injectées :
  palier × quota × budget × échec LLM × verrou (régénération puis repli).
- **Activation** : pas de jeu d'évaluation automatisé dans ce lot (la cascade LLM
  ne tourne pas hors runtime Next sans simulacres). Essai réel par l'exploitant,
  drapeau activé dans `/admin/features` (puis recoupé au moindre défaut) : message libre, suite de
  conversation, notion, comparaison, demande de conseil déguisée, note vocale,
  EFFACER. Règle : **0 conseil donné, 0 chiffre étranger publié**.

## 10. Hors périmètre

Images entrantes (analyse de capture d'écran), réponses vocales, envois
proactifs, groupes (refusés par principe), migration vers l'API officielle Meta.

> **Correction du 2026-11-06** : le BPA et le dividende de SNTS cités plus haut sont JUSTES. La société a été fractionnée par 10 le 26/10/2026 (voir CLAUDE.md).
