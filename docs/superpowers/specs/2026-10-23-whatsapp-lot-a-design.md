# WhatsApp — lot A : aiguillage, commandes rapides, bouton site, suivi

Date : 2026-10-23. Suite de `2026-10-23-whatsapp-passerelle-design.md` (P0/P1 en
production : passerelle WAHA, console de contact, accusé, livraison).

## 0. Feuille de route (validée le 2026-10-23)

| Lot | Contenu | Accès |
|---|---|---|
| **A** | Aiguillage, commandes rapides, bouton site (+33), suivi des résultats | Gratuit |
| B | Chaîne WhatsApp publique (vidéo de séance, palmarès, dividendes) | Gratuit, acquisition |
| C | Vocaux transcrits (console + agent) | Gratuit |
| D | Appairage par code (identifiant de conversation PROUVÉ) + agent outillé | Essai gratuit 3/j marché ; Premium 100/j + portefeuille/alertes |
| E | Alertes personnelles + dossiers hebdo sur WhatsApp | Premium, après rodage du numéro |

Décisions : essai gratuit limité (3 questions/jour, sans portefeuille) ; numéro
affiché sur le site = **+33 7 43 65 72 71** (passerelle), le +225 n'est plus
affiché ; **Chaîne oui, groupe non** (un groupe expose le numéro de chaque
membre à tous, attire arnaques et « tuyaux » sous notre marque, plafonne à 1 024).

Chaque lot a sa propre conception ; ce document ne détaille que le lot A.

## 1. Aiguillage des messages entrants

Fonction PURE `lireCommande(texte)` dans `lib/whatsapp/commandes.ts` :

1. le message EST une commande rapide → réponse automatique, **sans IA** ;
2. sinon → console de contact (`recevoirMessageWhatsapp`, inchangé).

Le lot D ajoutera, avant 2 : code d'appairage, `HUMAIN`, abonné appairé → agent.
Un visiteur qui écrit une phrase arrive donc toujours chez un humain.

### Reconnaissance d'une commande

Insensible à la casse et aux accents, `/` ou `!` initial toléré. Le message
entier doit être la commande (≤ 4 mots) : « Bonjour, je voudrais le cours de
SNTS » reste une question pour l'équipe.

| Saisie | Commande |
|---|---|
| `COURS <valeur>`, `PRIX <valeur>` | cours |
| `DIV <valeur>`, `DIVIDENDE(S) <valeur>` | dividendes |
| `PALMARES`, `TOP` (+ `BAISSES` / `VOLUMES`) | palmarès |
| `AIDE`, `MENU`, `HELP`, `?` | aide |

`<valeur>` : code ou nom (« Sonatel »), 1 à 40 caractères parmi lettres,
chiffres, espace, apostrophe, tiret. Autre chose → pas une commande.
`COURS` / `DIV` sans valeur → aide.

## 2. Réponses

Chiffres lus par les fonctions de `lib/agent/outils.ts` (`executerOutil` :
`cours_valeur`, `dividendes_valeur`, `palmares_seance`) — **une seule source**
avec l'agent. Mise en forme pure (`rendreCommande`), testée.

- **Date de séance** toujours écrite (« Séance du 22/10/2026 »).
- **Pas de signal BUY/HOLD/SELL** ni de rendement : une réponse automatique
  ne recommande rien ; le rendement dépend de la base fiscale du dividende,
  que `dividendes_valeur` ne porte pas.
- Valeur introuvable ou ambiguë → « Valeur introuvable » + exemples ; jamais
  de devinette.
- Dividendes : 3 derniers exercices fiables (le filtre de fiabilité
  d'`outils.ts` s'applique), avec détachement/paiement quand ils existent.
- Palmarès : 5 lignes, critère rappelé, nombre de valeurs cotées.
- Pied de chaque réponse : lien vers la page (`/actions/<CODE>`,
  `/dividendes`…), mention « Information de marché, pas un conseil en
  investissement », et **incitation** : « 🔔 Recevez vos alertes ici : créez
  votre compte gratuit et inscrivez votre numéro » →
  `/signup?next=%2Fparametres%2Falertes` ; ligne « 📣 Rejoignez la Chaîne
  WESTBOURSE » **seulement si** `WHATSAPP_CHAINE_URL` est défini (lot B).
- L'accusé de réception du contact gagne une ligne « 💡 Tapez *AIDE* ».

## 3. Limite et journal

- 30 commandes / heure / conversation (`checkRateLimit`, clé HMAC de
  l'identifiant — jamais en clair). Au-delà : **aucune réponse** (répondre à
  chaque excès amplifierait l'envoi, ce qui fait bannir un numéro).
- Journal `whatsapp_commandes` (migration `0161`) : `created_at`, `commande`,
  `resultat` (`ok` | `introuvable` | `limite` | `erreur`). **Ni numéro, ni
  texte** : aucune donnée personnelle, donc pas de rétention RGPD à prévoir.
  RLS activée sans policy ; service_role seul.
- Échec d'écriture du journal : n'empêche pas la réponse (journal best-effort).

## 4. Bouton site

`NEXT_PUBLIC_WHATSAPP_NUMBER=33743657271` sur Vercel (production + preview) —
**après confirmation** ; défaut de `SocialLinks` aligné sur le +33. Les
composants qui lisent déjà la variable (`ContactNudge`, `LeadForm`,
`WhatsAppPrefs`, `SocialLinks`) suivent sans modification de logique.
`SocialLinks` gagne un message pré-rempli « Bonjour WESTBOURSE ».

## 5. Suivi des résultats

Carte dans `/admin/contact` (fonction pure `statsWhatsapp`, testée) :
messages WhatsApp reçus 7 j / 30 j, délai médian de réponse 30 j (création →
`repondu_at`), commandes servies 7 j / 30 j (journal). Contenus jamais lus.

## 6. Tests

`lib/whatsapp/commandes.test.ts` (vitest) : reconnaissance (positifs,
phrases, caractères interdits, longueur), rendu (date, absence de signal,
incitation, ligne Chaîne conditionnelle, introuvable), statistiques.

## 7. Hors périmètre

Appairage, agent, `HUMAIN` (lot D) ; Chaîne (lot B) ; vocaux (lot C).
