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
import { execFileSync } from 'node:child_process';

const JETON = process.env.TELEGRAM_BOT_TOKEN;
const POSER = process.argv.includes('--secrets');

if (!JETON) {
  console.error(`Jeton absent.

  1. Sur Telegram, ouvrir une conversation avec @BotFather
  2. /newbot  ->  choisir un nom, puis un identifiant finissant par "bot"
  3. BotFather renvoie un jeton de la forme 1234567890:AAE...
  4. Ecrire n'importe quoi au bot cree (Telegram interdit a un bot
     d'ouvrir une conversation : sans ce message, elle n'existe pas)
  5. Relancer, en PowerShell :
       $env:TELEGRAM_BOT_TOKEN = "<jeton>"
       node telegram-init.mjs --secrets
     ou en bash :
       TELEGRAM_BOT_TOKEN=<jeton> node telegram-init.mjs --secrets`);
  process.exit(1);
}

const api = async (methode, corps) => {
  const r = await fetch(`https://api.telegram.org/bot${JETON}/${methode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  moi = await api('getMe');
} catch (e) {
  console.error(`Jeton refuse par Telegram : ${e.message}
  Verifier qu'il a bien ete copie en entier depuis @BotFather,
  de la forme 1234567890:AAE... (aucun espace, aucun retour a la ligne).`);
  process.exit(1);
}
console.log(`Bot reconnu : @${moi.username} (${moi.first_name})`);

const maj = await api('getUpdates', { timeout: 0 });
/* Une conversation n'apparait dans getUpdates que si quelqu'un a ecrit au bot
   au moins une fois : Telegram interdit a un bot d'ouvrir une conversation. */
const salons = new Map();
for (const u of maj) {
  const c = u.message?.chat ?? u.channel_post?.chat;
  if (c) salons.set(String(c.id), c.title ?? c.username ?? c.first_name ?? c.type);
}

if (salons.size === 0) {
  console.error(`
Aucune conversation trouvee.

  Telegram interdit a un bot d'ecrire le premier. Ouvre donc la conversation
  avec @${moi.username}, envoie n'importe quel message (« bonjour » suffit),
  puis relance ce script.`);
  process.exit(1);
}

console.log(`\n${salons.size} conversation(s) :`);
for (const [id, nom] of salons) console.log(`  ${id.padEnd(16)} ${nom}`);

/* On prend la plus recente : c'est celle que l'utilisateur vient d'ouvrir. */
const [salon] = [...salons.keys()].slice(-1);
await api('sendMessage', {
  chat_id: salon,
  text:
    'WESTBOURSE - canal de notification actif.\n' +
    'Tu recevras ici le recapitulatif de la video de seance chaque soir.',
});
console.log(`\nMessage d'essai envoye a ${salon}. Verifie-le dans Telegram.`);

if (POSER) {
  /* Le jeton passe par l'entree standard de gh, jamais par la ligne de
     commande : celle-ci serait visible dans la liste des processus. */
  for (const [nom, valeur] of [
    ['TELEGRAM_BOT_TOKEN', JETON],
    ['TELEGRAM_CHAT_ID', salon],
  ]) {
    execFileSync('gh', ['secret', 'set', nom], {
      input: valeur,
      stdio: ['pipe', 'inherit', 'inherit'],
    });
    console.log(`secret ${nom} pose`);
  }
  console.log('\nTermine. La prochaine execution du cron notifiera sur Telegram.');
} else {
  console.log(`\nPour poser les secrets du depot, relancer avec --secrets, ou :
  gh secret set TELEGRAM_BOT_TOKEN
  gh secret set TELEGRAM_CHAT_ID     (valeur : ${salon})`);
}
