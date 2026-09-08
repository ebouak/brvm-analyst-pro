/**
 * Mise en service du canal Telegram pour la notification du soir.
 *
 * Trouver l'identifiant de conversation Telegram a la main est fastidieux :
 * il faut ecrire au bot, appeler getUpdates, et lire un JSON. Ce script fait
 * les trois, envoie un message d'essai pour prouver que le canal fonctionne
 * vraiment, puis pose les secrets du depot.
 *
 * PowerShell (le terminal par defaut de ce poste) :
 *   $env:TELEGRAM_BOT_TOKEN = "<jeton>"
 *   node telegram-init.mjs --secrets
 *   Remove-Item Env:TELEGRAM_BOT_TOKEN
 *
 * bash / zsh :
 *   TELEGRAM_BOT_TOKEN=<jeton> node telegram-init.mjs --secrets
 *
 * Le jeton n'est jamais affiche ni ecrit sur le disque.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, "..");

/* Le jeton peut venir de l'environnement ou d'un .env.local, comme partout
   ailleurs dans le projet. Le fichier evite d'avoir a manier la syntaxe
   d'environnement de PowerShell, et surtout de faire transiter un secret par
   un canal de discussion. Les deux chemins sont ignores par git. */
const depuisFichier = (cle) => {
  for (const f of [`${ICI}/.env.local`, `${RACINE}/frontend/.env.local`]) {
    if (!existsSync(f)) continue;
    /* Retirer la marque d'ordre d'octets : `Set-Content -Encoding utf8` sous
       Windows PowerShell 5.1 en ajoute une, et la premiere cle du fichier
       s'appelait alors "﻿TELEGRAM_BOT_TOKEN" — introuvable. Constate le
       2026-09-08 sur un fichier pourtant correctement ecrit. */
    const contenu = readFileSync(f, "utf8").replace(/^﻿/, "");
    const m = contenu.match(new RegExp("^" + cle + "=(.*)$", "m"));
    if (m) return m[1].trim().replace(/^"|"$/g, "");
  }
  return "";
};

const JETON =
  process.env.TELEGRAM_BOT_TOKEN || depuisFichier("TELEGRAM_BOT_TOKEN");
const POSER = process.argv.includes("--secrets");

/* --webhook <url> : declare le webhook du bot pour l'agent conversationnel et
   les alertes personnelles (frontend/app/api/telegram/webhook).

   ⚠️ IRREVERSIBLE POUR CE SCRIPT : Telegram autorise SOIT le long-polling
   (getUpdates), SOIT un webhook — jamais les deux. Une fois le webhook pose,
   la decouverte automatique du chat_id ci-dessous cesse de fonctionner. Elle a
   deja rempli son office (TELEGRAM_CHAT_ID est en secret), et les envois
   sortants — recapitulatif du soir, canal public — n'en dependent pas. Pour la
   retrouver temporairement : --webhook off. */
const iWebhook = process.argv.indexOf("--webhook");
const WEBHOOK = iWebhook >= 0 ? process.argv[iWebhook + 1] : null;

if (!JETON) {
  console.error(`Jeton absent.

  1. Sur Telegram, ouvrir une conversation avec @BotFather
  2. /newbot  ->  choisir un nom, puis un identifiant finissant par "bot"
  3. BotFather renvoie un jeton de la forme 1234567890:AAE...
  4. Ecrire n'importe quoi au bot cree (Telegram interdit a un bot
     d'ouvrir une conversation : sans ce message, elle n'existe pas)
  5. Le plus simple : creer le fichier video/.env.local (ignore par git)
     contenant une seule ligne :
       TELEGRAM_BOT_TOKEN=1234567890:AAE...
     puis relancer :  node telegram-init.mjs --secrets

     Sinon, par l'environnement — PowerShell :
       $env:TELEGRAM_BOT_TOKEN = "<jeton>"
       node telegram-init.mjs --secrets
     bash :
       TELEGRAM_BOT_TOKEN=<jeton> node telegram-init.mjs --secrets`);
  process.exit(1);
}

const api = async (methode, corps) => {
  const r = await fetch(`https://api.telegram.org/bot${JETON}/${methode}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corps ?? {}),
  });
  const rep = await r.json().catch(() => ({}));
  if (!rep.ok) {
    /* Le message d'erreur de Telegram peut contenir l'URL appelee, donc le
       jeton. On ne relaie que la description. */
    throw new Error(`${methode} -> ${rep.description ?? `HTTP ${r.status}`}`);
  }
  return rep.result;
};

/* Un jeton errone est le cas le plus frequent (copie tronquee depuis
   BotFather). Une pile d'appels n'aide personne ici : on dit quoi faire. */
let moi;
try {
  moi = await api("getMe");
} catch (e) {
  console.error(`Jeton refuse par Telegram : ${e.message}
  Verifier qu'il a bien ete copie en entier depuis @BotFather,
  de la forme 1234567890:AAE... (aucun espace, aucun retour a la ligne).`);
  process.exit(1);
}
console.log(`Bot reconnu : @${moi.username} (${moi.first_name})`);

/* Branche webhook : elle remplace entierement le reste du script, la
   decouverte du chat_id devenant impossible une fois le webhook actif. */
if (WEBHOOK) {
  if (WEBHOOK === "off") {
    await api("deleteWebhook", { drop_pending_updates: false });
    console.log("Webhook retire — getUpdates redevient utilisable.");
  } else {
    /* Le secret voyage dans un en-tete a chaque appel entrant : c'est ce que
       la route verifie a temps constant. Sans lui, n'importe qui connaissant
       l'URL pourrait injecter de faux messages. */
    const secret =
      process.env.TELEGRAM_WEBHOOK_SECRET ||
      depuisFichier("TELEGRAM_WEBHOOK_SECRET");
    if (!secret) {
      console.error(`TELEGRAM_WEBHOOK_SECRET absent.

  Generer une valeur aleatoire, la mettre dans video/.env.local ET dans les
  variables d'environnement Vercel du projet frontend (la route la compare) :
    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`);
      process.exit(1);
    }
    const r = await api("setWebhook", {
      url: WEBHOOK,
      secret_token: secret,
      /* On ne demande QUE les messages : sans ce filtre, Telegram enverrait
         aussi les publications du canal, que la route doit de toute facon
         ignorer. Autant ne pas les recevoir. */
      allowed_updates: ["message"],
      drop_pending_updates: true,
    });
    console.log("Webhook pose :", r === true ? WEBHOOK : JSON.stringify(r));
    const info = await api("getWebhookInfo");
    console.log(`  url active        : ${info.url || "(aucune)"}`);
    console.log(`  en attente        : ${info.pending_update_count ?? 0}`);
    if (info.last_error_message)
      console.log(`  derniere erreur   : ${info.last_error_message}`);
    console.log(
      "\n⚠️ getUpdates est desormais inactif : ce script ne peut plus",
    );
    console.log(
      "   decouvrir de chat_id. Utiliser --webhook off pour revenir.",
    );
  }
}

/* Le reste du script (decouverte du chat_id) n'a de sens que hors mode
   webhook. Un `process.exit(0)` ici declencherait une assertion libuv sous
   Windows, affichee APRES le rapport et donnant l'impression d'un echec. */
if (!WEBHOOK) {
  const maj = await api("getUpdates", { timeout: 0 });
  /* Une conversation n'apparait dans getUpdates que si quelqu'un a ecrit au bot
   au moins une fois : Telegram interdit a un bot d'ouvrir une conversation. */
  const salons = new Map();
  for (const u of maj) {
    const c = u.message?.chat ?? u.channel_post?.chat;
    if (c)
      salons.set(String(c.id), c.title ?? c.username ?? c.first_name ?? c.type);
  }

  if (salons.size === 0) {
    /* Deux causes, et la seconde surprend : Telegram JETTE les messages en
     attente au bout de 24 h. Avoir ecrit au bot avant-hier ne suffit donc
     pas — il faut un message recent. Constate le 2026-09-08. */
    console.error(`
Aucune conversation trouvee.

  Ouvre la conversation avec @${moi.username} et envoie-lui un message
  MAINTENANT (« bonjour » suffit), puis relance ce script.

  Deux raisons possibles :
   - tu ne lui as jamais ecrit (Telegram interdit a un bot d'ecrire le premier) ;
   - tu lui as ecrit il y a plus de 24 h : Telegram efface les messages en
     attente passe ce delai. Il en faut un recent.`);
    /* exitCode plutot que process.exit() : une sortie abrupte pendant que des
     requetes reseau se terminent declenche une assertion libuv sous Windows,
     qui masque le message ci-dessus. */
    process.exitCode = 1;
  } else {
    console.log(`\n${salons.size} conversation(s) :`);
    for (const [id, nom] of salons) console.log(`  ${id.padEnd(16)} ${nom}`);

    /* On prend la plus recente : c'est celle que l'utilisateur vient d'ouvrir. */
    const [salon] = [...salons.keys()].slice(-1);
    await api("sendMessage", {
      chat_id: salon,
      text:
        "WESTBOURSE - canal de notification actif.\n" +
        "Tu recevras ici le recapitulatif de la video de seance chaque soir.",
    });
    console.log(
      `\nMessage d'essai envoye a ${salon}. Verifie-le dans Telegram.`,
    );

    if (POSER) {
      /* Le jeton passe par l'entree standard de gh, jamais par la ligne de
       commande : celle-ci serait visible dans la liste des processus. */
      for (const [nom, valeur] of [
        ["TELEGRAM_BOT_TOKEN", JETON],
        ["TELEGRAM_CHAT_ID", salon],
      ]) {
        execFileSync("gh", ["secret", "set", nom], {
          input: valeur,
          stdio: ["pipe", "inherit", "inherit"],
        });
        console.log(`secret ${nom} pose`);
      }
      console.log(
        "\nTermine. La prochaine execution du cron notifiera sur Telegram.",
      );
    } else {
      console.log(`\nPour poser les secrets du depot, relancer avec --secrets, ou :
  gh secret set TELEGRAM_BOT_TOKEN
  gh secret set TELEGRAM_CHAT_ID     (valeur : ${salon})`);
    }
  }
}
