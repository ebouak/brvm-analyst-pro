# Vidéo de séance

Vidéo verticale quotidienne de la séance BRVM : générée depuis Supabase,
publiée sur Facebook et TikTok. Troisième worker du dépôt, à côté de
`scraper/` et `frontend/`.

> À ne pas confondre avec `remotion/`, qui rend la vidéo décorative de fond de
> la landing page. Deux usages distincts, deux paquets distincts.

```bash
cd video
npm install
npx playwright install chromium
python -m pip install edge-tts   # ffmpeg doit être dans le PATH

npm run genere    # vidéo seule
npm run publie    # envoi vers les plateformes configurées
npm run seance    # les deux
```

## Le principe : une seule lecture

Les images, le texte lu, et la légende publiée sont composés des **mêmes
variables**, issues d'une seule interrogation de la base. Ce n'est pas un
détail d'implémentation : une première version gardait un audio figé pendant
que les images suivaient la base, et la voix a annoncé 31 hausses quand
l'écran en montrait 18. Un chiffre change désormais partout à la fois, ou
nulle part.

Même règle pour les logos : une société sans fichier dans
`frontend/public/logos/` s'affiche avec son code, **jamais** avec le logo
d'une autre.

## Le verrou de publiabilité

`genere.mjs` écrit `seance.json`, qui porte cinq contrôles :

| Contrôle | Ce qu'il empêche |
|---|---|
| `seance_recente` | publier une séance vieille de plus de 5 jours (`VIDEO_AGE_MAX_JOURS`) |
| `assez_de_valeurs` | publier sur une collecte partielle (< 20 valeurs cotées) |
| `composite_present` | une vidéo sans son indice de référence |
| `capitaux_non_nuls` | le « 0 FCFA échangé » d'un jour où la source ne renvoie rien |
| `variations_non_plates` | une séance où toutes les variations sont nulles |

Si l'un échoue, `publie.mjs` **s'arrête sans rien envoyer** et sort en succès.
Un cron publie sans relecture humaine : mieux vaut un jour sans vidéo qu'un
post public faux.

## La landing page

`publie.mjs` héberge d'abord la vidéo dans le bucket public **`seance-video`**,
avant de toucher aux réseaux sociaux — le site doit être servi même quand
aucune plateforme n'est configurée. Trois objets :

| Objet | Rôle |
|---|---|
| `seance/<date>.mp4` | la vidéo, à une URL **datée** |
| `seance/<date>.jpg` | l'affiche du lecteur (carte-titre, ~23 Ko) |
| `derniere.json` | la fiche lue par la landing (chiffres, URL, transcription) |

L'URL porte la date, jamais un nom fixe : aucun cache ne peut donc servir la
vidéo d'hier sous les chiffres d'aujourd'hui.

Côté site : `lib/landing/videoSeance.ts` lit `derniere.json` (anonyme, revalidé
toutes les 5 min) et `components/landing/VideoSeance.tsx` l'affiche après la
cartographie. La section **disparaît d'elle-même** tant qu'aucune vidéo n'est
publiée, et **signale « séance précédente »** si la vidéo n'est pas celle de la
dernière séance connue du site.

Le fichier étant servi depuis notre propre stockage, aucun lecteur tiers n'est
embarqué : la promesse « aucun traceur » de la landing tient.

## Configurer Facebook

1. Créer une application sur `developers.facebook.com`, produit **Facebook Login**.
2. Demander les permissions `pages_manage_posts`, `pages_read_engagement`,
   `pages_show_list`.
3. Générer un **jeton de Page longue durée** (Graph API Explorer → choisir la
   Page → échanger le jeton utilisateur court contre un long, puis contre un
   jeton de Page). Un jeton de Page issu d'un jeton utilisateur longue durée
   n'expire pas tant que le mot de passe ne change pas.
4. Secrets du dépôt : `FB_PAGE_ID`, `FB_PAGE_ACCESS_TOKEN`.

Variable facultative `FB_BROUILLON=true` : dépose sur la Page sans publier.

## Configurer TikTok

1. Application sur `developers.tiktok.com`, produit **Content Posting API**.
2. Portée `video.upload` (dépôt en brouillon) ou `video.publish` (publication
   directe — **exige un audit de l'application par TikTok**).
3. Faire le parcours OAuth une fois pour obtenir un `refresh_token`.
4. Secrets du dépôt : `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`,
   `TIKTOK_REFRESH_TOKEN`.

**Le jeton d'accès TikTok expire en 24 heures.** C'est pour cela que le script
échange le jeton de rafraîchissement à chaque exécution au lieu de lire un
`TIKTOK_ACCESS_TOKEN` figé — celui-ci ne sert qu'aux essais manuels à chaud.
TikTok fait tourner le jeton de rafraîchissement : si la sortie affiche
« le jeton de rafraîchissement a changé », mettre à jour le secret, faute de
quoi l'exécution suivante échouera.

Variable `TIKTOK_MODE=direct` pour publier réellement. Le défaut est `inbox`
(brouillon à valider dans l'appli), seul mode qui fonctionne sans audit.

### Décision du 2026-09-06 : on reste en mode brouillon

L'audit TikTok (nécessaire pour `direct`) exige un parcours **Login Kit →
Content Posting API** dans une interface utilisateur, à filmer pour la revue.
Ce parcours n'existe pas dans ce dépôt et n'a pas été construit, délibérément :

- **Ce que l'audit apporte** : supprimer une validation manuelle par jour.
- **Ce qu'il coûte** : un flux OAuth, le stockage permanent de jetons tiers,
  une vidéo de démonstration, et une revue de plusieurs jours pensée pour des
  applications grand public — profil où un cron publiant sur son propre compte
  passe mal.
- **L'alternative gratuite** : Facebook ne demande aucun audit et porte mieux
  ce contenu dans la zone UEMOA. C'est là que l'effort rapporte.

Conséquence assumée : **la notification du soir n'est pas un agrément, c'est
ce qui rend ce choix tenable.** Sans rappel, un geste quotidien s'oublie.

Deux tables `tiktok_accounts` et `tiktok_posts` existent en base (créées hors
dépôt, RLS vérifiée le 2026-09-06 : lecture anonyme vide, écriture refusée
`42501`) mais **ne sont utilisées par aucun code**. Les supprimer si la piste
de l'audit est définitivement abandonnée ; les garder si elle doit être reprise.

## Notification du soir

`publie.mjs` envoie un récapitulatif après chaque publication : date de la
séance, largeur du marché, et une ligne par destination — dont
« TikTok : brouillon déposé — À VALIDER dans l'appli ».

### Mettre Telegram en service

```bash
cd video
# 1. Sur Telegram : @BotFather → /newbot → nom, puis identifiant en "bot"
# 2. Ouvrir la conversation avec le bot créé et lui écrire n'importe quoi.
#    Telegram interdit à un bot d'écrire le premier : sans ce message, sa
#    conversation n'existe pas et son identifiant est introuvable.
# 3. Poser les secrets du dépôt :
TELEGRAM_BOT_TOKEN=<jeton> node telegram-init.mjs --secrets
```

Le script valide le jeton, trouve l'identifiant de conversation, **envoie un
message d'essai** — la seule preuve que le canal fonctionne vraiment — puis
pose `TELEGRAM_BOT_TOKEN` et `TELEGRAM_CHAT_ID`. Sans `--secrets`, il se
contente d'afficher les commandes. Le jeton ne transite jamais par la ligne de
commande de `gh` (visible dans la liste des processus) ni par la sortie.

Canaux : Telegram (`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`) et e-mail
(`RESEND_API_KEY` + `ALERTS_EMAIL_FROM` + `ALERTS_EMAIL_TO`). Sans
configuration, le script se tait sans échouer. **État au 2026-09-06** : les
secrets Resend sont présents dans le dépôt, les secrets Telegram ne le sont
pas — seul l'e-mail part.

## Planification

`.github/workflows/video-seance.yml` — 18:00 UTC du lundi au vendredi. La BRVM
clôture vers 15:00 UTC et le scraper intraday tourne toutes les 15 minutes :
à 18:00 la séance est figée.

La vidéo, `seance.json` et le texte lu sont conservés 14 jours en artefact,
**même si la publication échoue** : une vidéo correcte refusée par une
plateforme reste récupérable et publiable à la main.

## Limites connues

- **Pas de sous-titres incrustés** (retirés à la demande). Sur TikTok, la
  plupart des vues démarrent sans son : à remettre si l'audience le justifie.
- **Polices** : le rendu local utilise Segoe UI et Consolas ; le runner Linux
  retombe sur Liberation et DejaVu. Le rendu CI est donc légèrement différent
  de celui du poste — à vérifier sur le premier artefact.
- **Facebook** : publié via `/videos`, pas via l'API Reels. C'est plus simple et
  plus robuste, mais une vidéo 9:16 aurait davantage de portée en Reel.
