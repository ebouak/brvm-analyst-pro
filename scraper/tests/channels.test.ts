/**
 * Résolution du destinataire email. Régression : `runHebdo` publie puis notifie
 * avec `to: null` (pas d'utilisateur cible) ; sans repli sur ALERTS_EMAIL_TO
 * l'alerte du cron samedi partait dans un console.log du runner GitHub.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { dispatch, sendEmail } from '../src/alerts/channels.js';

const ENV_KEYS = [
  'RESEND_API_KEY',
  'ALERTS_EMAIL_FROM',
  'ALERTS_EMAIL_TO',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
  'WHATSAPP_TOKEN',
  'WHATSAPP_PHONE_ID',
  'WHATSAPP_TO',
] as const;

let saved: Record<string, string | undefined>;

/** Capture le corps JSON envoyé à Resend sans toucher au réseau. */
function stubFetch(): { bodies: Record<string, unknown>[] } {
  const bodies: Record<string, unknown>[] = [];
  vi.stubGlobal('fetch', async (_url: string, init?: { body?: string }) => {
    bodies.push(JSON.parse(init?.body ?? '{}'));
    return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
  });
  return { bodies };
}

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  process.env.RESEND_API_KEY = 'test-key';
  process.env.ALERTS_EMAIL_FROM = 'alertes@westbourse.com';
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const notif = (to: string | null) => ({ subject: 'Sujet', body: 'Corps', code: null, to });

describe('dispatch — destinataire email', () => {
  it('sans destinataire explicite, replie sur ALERTS_EMAIL_TO', async () => {
    process.env.ALERTS_EMAIL_TO = 'exploitation@westbourse.com';
    const { bodies } = stubFetch();

    const res = await dispatch(notif(null));

    expect(bodies).toHaveLength(1);
    expect(bodies[0]!.to).toBe('exploitation@westbourse.com');
    expect(res).toContainEqual({ channel: 'email', status: 'sent' });
  });

  it('le destinataire explicite prime sur ALERTS_EMAIL_TO', async () => {
    process.env.ALERTS_EMAIL_TO = 'exploitation@westbourse.com';
    const { bodies } = stubFetch();

    await dispatch(notif('utilisateur@example.com'));

    expect(bodies[0]!.to).toBe('utilisateur@example.com');
  });

  it('sans aucun destinataire, aucun envoi et repli console', async () => {
    const { bodies } = stubFetch();

    const res = await dispatch(notif(null));

    expect(bodies).toHaveLength(0);
    expect(res).toEqual([{ channel: 'console', status: 'sent' }]);
  });
});

describe('sendEmail — canal direct, sans diffusion globale', () => {
  it('envoie uniquement l\'email, sans toucher Telegram ni WhatsApp', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'tok';
    process.env.TELEGRAM_CHAT_ID = 'chat';
    process.env.WHATSAPP_TO = '+225000000';
    const { bodies } = stubFetch();

    const res = await sendEmail({ to: 'utilisateur@example.com', subject: 'Sujet', body: 'Corps', code: 'SNTS' });

    expect(res).toEqual({ channel: 'email', status: 'sent' });
    // Un seul appel fetch (Resend) : la preuve que sendEmail() appelée seule
    // ne déclenche jamais dispatch() ni donc les canaux globaux de
    // l'exploitant (Telegram/WhatsApp) — c'est la correction centrale du
    // design #15 (voir spec §2).
    expect(bodies).toHaveLength(1);
    expect(bodies[0]!.to).toBe('utilisateur@example.com');
  });
});
