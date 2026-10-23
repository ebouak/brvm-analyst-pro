# WhatsApp — lot B : Chaîne publique WESTBOURSE

Date : 2026-10-24. Suite de `2026-10-23-whatsapp-lot-a-design.md` (feuille de route §0).

## Ce qui est livré

- **Chaîne** « WESTBOURSE Bourse BRVM », créée par la passerelle WAHA
  (`POST /api/default/channels`) : id `120363411964806044@newsletter`,
  invitation `https://whatsapp.com/channel/0029VbDkKjK5K3zL18MshI0d`.
  WhatsApp a refusé (graphql 400) la création avec description, photo et tiret
  long ; nom seul accepté. Photo et description se règlent depuis l'application.
- **Publication quotidienne** : étape 3b de `video/publie.mjs`, après
  l'hébergement de la vidéo dans le bucket `seance-video` (étape 2), dont elle
  dépend : la passerelle télécharge la vidéo par son URL publique
  (`sendVideo`, `file.url`, `convert: false`), aucun second téléversement.
- **Légende** `legendeWhatsapp` (pure, testée) : composée des nombres de
  `seance.json`, la même lecture que les images, la voix et la légende
  Telegram. Mentions « capitaux estimés » et « pas un conseil ». Appel à écrire
  *AIDE* au +33 (commandes du lot A).
- **Verrou de publiabilité** inchangé : une séance non publiable n'envoie rien,
  nulle part.
- **Doublon** : marqueur `chaine/<séance>.json` créé dans le bucket AVANT
  l'envoi, sans upsert (409 si présent → « déjà publiée », rien n'est envoyé).
  Un envoi raté retire le marqueur pour permettre une relance. JSON et non
  texte : le bucket n'accepte que certains types (`text/plain` → 415, vu à l'essai).
- **Configuration** : `WAHA_URL`, `WAHA_API_KEY` (secrets GitHub déjà posés pour
  `whatsapp-sante`), `WHATSAPP_CHAINE_ID` (variable GitHub). Absente → étape
  ignorée ; configurée et en échec → run rouge + ligne dans le récapitulatif.
- **Site** : lien « Recevoir la vidéo chaque soir sur WhatsApp » dans la section
  vidéo de la landing si `NEXT_PUBLIC_WHATSAPP_CHAINE_URL` ; ligne « Rejoignez
  la Chaîne » sous les réponses aux commandes si `WHATSAPP_CHAINE_URL`.

## Décisions prises sans le conseiller

Fable indisponible (HTTP 429, crédits épuisés). Tranché :

- **Même numéro** pour la Chaîne, le contact et les commandes : un message par
  jour dans sa propre Chaîne est un volume minime, sans écriture à froid.
  Numéro séparé à envisager si l'audience grossit.
- **Taille** : la vidéo du 23/10 (18,9 Mo) a été publiée sans erreur par la
  passerelle. À surveiller si une vidéo dépasse nettement ce poids.

## Vérifié (2026-10-24)

Séance du 23/10 publiée dans la Chaîne avec ce code et le vrai marqueur
(`publie`), relance immédiate → `deja-publie`, aucun doublon.

## Hors périmètre

Post hebdomadaire des dividendes à venir et de l'analyse de la semaine : à
ajouter quand la Chaîne aura des abonnés.
