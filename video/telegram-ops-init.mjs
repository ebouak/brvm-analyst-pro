/**
 * Mise en service du Bot Telegram Ops WESTBOURSE (orchestrateur admin).
 *
 * Usage (depuis video/) :
 *   1. Créer un bot dédié via @BotFather (/newbot) et poser dans video/.env.local :
 *        TELEGRAM_OPS_BOT_TOKEN=123456:ABC...
 *        # (TELEGRAM_OPS_WEBHOOK_SECRET est déjà posé automatiquement si généré)
 *   2. Écrire "bonjour" au bot créé sur Telegram, puis lancer :
 *        node telegram-ops-init.mjs --discover
 *   3. Pousser les variables sur Vercel Production et enregistrer le webhook + menu :
 *        node telegram-ops-init.mjs --vercel --webhook
 *   4. Pour retirer le webhook temporairement :
 *        node telegram-ops-init.mjs --webhook off
 *
 * Aucun secret n'est jamais affiché ni journalisé.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, '..');
const DEFAULT_WEBHOOK_URL = 'https://www.westbourse.com/api/telegram/ops/webhook';

const depuisFichier = (cle) => {
  for (const f of [`${ICI}/.env.local`, `${RACINE}/frontend/.env.local`]) {
    if (!existsSync(f)) continue;
    const contenu = readFileSync(f, 'utf8').replace(/^\uFEFF/, '');
    const m = contenu.match(new RegExp(`^${cle}=(.*)$`, 'm'));
    if (m) return m[1].trim().replace(/^"|"$/g, '');
  }
  return '';
};

const lireVar = (cle) => process.env[cle]?.trim() || depuisFichier(cle);

const JETON = lireVar('TELEGRAM_OPS_BOT_TOKEN');
const DISCOVER = process.argv.includes('--discover');
const COMMANDS_ONLY = process.argv.includes('--commands');
const PUSH_VERCEL = process.argv.includes('--vercel');
const iWebhook = process.argv.indexOf('--webhook');
const HAS_WEBHOOK_FLAG = iWebhook >= 0;
const WEBHOOK_ARG = HAS_WEBHOOK_FLAG ? process.argv[iWebhook + 1] : null;
const WEBHOOK_URL =
  !HAS_WEBHOOK_FLAG
    ? null
    : !WEBHOOK_ARG || WEBHOOK_ARG.startsWith('--')
      ? DEFAULT_WEBHOOK_URL
      : WEBHOOK_ARG;

const OPS_COMMANDS = [
  { command: 'tour', description: 'État complet de la Tour de contrôle' },
  { command: 'cloture', description: 'Contrôle chaîne post-séance' },
  { command: 'matin', description: 'Briefing fondateur (KPIs 24h)' },
  { command: 'boc', description: 'Écarts PER / Rendement vs BOC' },
  { command: 'coherence', description: 'Anomalies de cohérence ouvertes' },
  { command: 'pulse', description: 'Carte exécutive PNG (KPIs + workflows)' },
  { command: 'audit', description: 'Audit flash d’une valeur (/audit SNTS)' },
  { command: 'llm', description: 'Sonde live LLM, WhatsApp, Resend, Bland' },
  { command: 'relancer', description: 'Déclencher un workflow GitHub Actions' },
  { command: 'paiements', description: 'Valider les paiements en attente' },
  { command: 'agregats', description: 'Relire les agrégats bancaires' },
  { command: 'contact', description: 'Répondre aux messages support' },
  { command: 'crm', description: 'Top 5 prospects proches du Premium' },
  { command: 'posts', description: 'Publications sociales à valider' },
  { command: 'incidents', description: 'Incidents critiques ouverts' },
  { command: 'ferie', description: 'Déclarer un jour férié BRVM' },
  { command: 'kill', description: 'Couper une fonctionnalité en urgence' },
  { command: 'revive', description: 'Réactiver une fonctionnalité' },
  { command: 'help', description: 'Afficher l’aide et les commandes' },
];

if (!JETON) {
  console.error(`TELEGRAM_OPS_BOT_TOKEN absent.

  1. Ouvrir @BotFather sur Telegram -> /newbot -> copier le jeton
  2. Ajouter dans video/.env.local :
       TELEGRAM_OPS_BOT_TOKEN=123456:AAE...
  3. Écrire "bonjour" au bot sur Telegram puis lancer :
       node telegram-ops-init.mjs --discover
       node telegram-ops-init.mjs --vercel --webhook`);
  process.exitCode = 1;
} else {
  const api = async (methode, corps) => {
    const r = await fetch(`https://api.telegram.org/bot${JETON}/${methode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps ?? {}),
    });
    const rep = await r.json().catch(() => ({}));
    if (!rep.ok) {
      throw new Error(`${methode} -> ${rep.description ?? `HTTP ${r.status}`}`);
    }
    return rep.result;
  };

  let moi;
  try {
    moi = await api('getMe');
    console.log(`Bot Ops reconnu : @${moi.username} (${moi.first_name})`);
  } catch (e) {
    console.error(`Jeton refusé par Telegram : ${e.message}`);
    process.exitCode = 1;
  }

  if (moi) {
    if (PUSH_VERCEL) {
      const vercelBin = process.platform === 'win32' ? 'vercel.cmd' : 'vercel';
      const vars = [
        ['TELEGRAM_OPS_BOT_TOKEN', JETON],
        ['TELEGRAM_OPS_WEBHOOK_SECRET', lireVar('TELEGRAM_OPS_WEBHOOK_SECRET')],
        ['TELEGRAM_OPS_ADMIN_CHAT_IDS', lireVar('TELEGRAM_OPS_ADMIN_CHAT_IDS')],
        ['GITHUB_OPS_TOKEN', lireVar('GITHUB_OPS_TOKEN')],
        ['GROQ_API_KEY', lireVar('GROQ_API_KEY')],
      ].filter(([, v]) => Boolean(v));

      for (const [nom, valeur] of vars) {
        try {
          execFileSync(
            vercelBin,
            ['env', 'add', nom, 'production', '--sensitive', '--force', '--cwd', resolve(RACINE, 'frontend'), '--non-interactive'],
            { input: valeur, stdio: ['pipe', 'pipe', 'pipe'], shell: process.platform === 'win32' },
          );
          console.log(`Vercel Production : ${nom} configurée.`);
        } catch (err) {
          console.error(`Vercel Production : échec pour ${nom} (${err.message}).`);
          process.exitCode = 1;
        }
      }
    }

    if (DISCOVER) {
      const maj = await api('getUpdates', { timeout: 0 });
      const salons = new Map();
      for (const u of maj) {
        const c = u.message?.chat;
        if (c && c.type === 'private') {
          salons.set(String(c.id), c.username ?? c.first_name ?? 'privé');
        }
      }
      if (salons.size === 0) {
        console.error(`Aucune conversation privée trouvée sur @${moi.username}. Envoyez-lui "bonjour" puis relancez.`);
        process.exitCode = 1;
      } else {
        console.log(`${salons.size} conversation(s) trouvée(s) :`);
        for (const [id, nom] of salons) console.log(`  ${id.padEnd(16)} ${nom}`);
        const [dernier] = [...salons.keys()].slice(-1);
        await api('sendMessage', {
          chat_id: dernier,
          text: 'WESTBOURSE Ops Bot connecté. Utilisez /help ou /tour dès que le webhook est posé.',
        });
        console.log(`Message d'essai envoyé au chat_id ${dernier}.`);
        console.log(`Optionnel : ajoutez TELEGRAM_OPS_ADMIN_CHAT_IDS=${dernier} dans video/.env.local avant --vercel.`);
      }
    }

    if (COMMANDS_ONLY || (WEBHOOK_URL && WEBHOOK_URL !== 'off')) {
      await api('setMyCommands', { commands: OPS_COMMANDS });
      console.log(`Menu Telegram enregistré (${OPS_COMMANDS.length} commandes).`);
    }

    if (WEBHOOK_URL === 'off') {
      await api('deleteWebhook', { drop_pending_updates: false });
      console.log('Webhook Ops retiré — getUpdates redevient utilisable.');
    } else if (WEBHOOK_URL) {
      const secret = lireVar('TELEGRAM_OPS_WEBHOOK_SECRET');
      if (!secret) {
        console.error('TELEGRAM_OPS_WEBHOOK_SECRET absent (env ou video/.env.local).');
        process.exitCode = 1;
      } else {
        const sonde = await fetch(WEBHOOK_URL, {
          method: 'POST',
          redirect: 'manual',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ update_id: 0 }),
        });
        if (sonde.status >= 300 && sonde.status < 400) {
          console.error(`URL redirige (HTTP ${sonde.status}) vers ${sonde.headers.get('location') ?? '?'} — Telegram refuse les redirections.`);
          process.exitCode = 1;
        } else {
          console.log(`Sonde webhook : HTTP ${sonde.status}${sonde.status === 401 ? ' (attendu sans secret)' : ''}`);
          const ok = await api('setWebhook', {
            url: WEBHOOK_URL,
            secret_token: secret,
            allowed_updates: ['message', 'callback_query'],
            drop_pending_updates: true,
          });
          console.log('setWebhook :', ok === true ? WEBHOOK_URL : JSON.stringify(ok));
          const info = await api('getWebhookInfo');
          console.log(`  url active   : ${info.url || '(aucune)'}`);
          console.log(`  en attente   : ${info.pending_update_count ?? 0}`);
          if (info.last_error_message) console.log(`  dernière err : ${info.last_error_message}`);
        }
      }
    }
  }
}
