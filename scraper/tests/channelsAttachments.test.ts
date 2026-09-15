import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendEmail, sendTelegramDocument } from '../src/alerts/channels.js';

const ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ENV };
  vi.restoreAllMocks();
});

describe('sendEmail avec pièces jointes', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.ALERTS_EMAIL_FROM = 'noreply@example.test';
  });

  it('transmet filename + contenu encodé en base64 dans le corps Resend', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    const pdf = Buffer.from('%PDF-1.4 essai');
    const r = await sendEmail({
      to: 'client@example.test',
      subject: 'S',
      body: 'B',
      attachments: [{ filename: 'westbourse-dossier-NEIC.pdf', content: pdf }],
    });
    expect(r?.status).toBe('sent');
    const corps = JSON.parse(String(fetchMock.mock.calls[0]![1]!.body));
    expect(corps.attachments).toEqual([
      { filename: 'westbourse-dossier-NEIC.pdf', content: pdf.toString('base64') },
    ]);
  });

  it('sans pièce jointe, la clé `attachments` est absente du corps', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    await sendEmail({ to: 'client@example.test', subject: 'S', body: 'B' });
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body))).not.toHaveProperty('attachments');
  });

  it('un tableau vide ne pose pas la clé non plus', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    await sendEmail({ to: 'c@example.test', subject: 'S', body: 'B', attachments: [] });
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body))).not.toHaveProperty('attachments');
  });
});

describe('sendTelegramDocument', () => {
  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = '123:abc';
  });

  it('poste en multipart sur sendDocument, avec chat_id, document nommé et légende', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    const r = await sendTelegramDocument(4242, Buffer.from('%PDF'), 'westbourse-dossier-NEIC.pdf', 'NEIC — NEI CEDA CI');
    expect(r).toEqual({ channel: 'telegram', status: 'sent' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://api.telegram.org/bot123:abc/sendDocument');
    const form = init!.body as FormData;
    expect(form.get('chat_id')).toBe('4242');
    expect(form.get('caption')).toBe('NEIC — NEI CEDA CI');
    expect((form.get('document') as File).name).toBe('westbourse-dossier-NEIC.pdf');
  });

  it('sans jeton, n’appelle rien et rend null', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    expect(await sendTelegramDocument(1, Buffer.from('x'), 'a.pdf', 'a')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  /**
   * L'URL appelée contient le jeton du bot. Un message d'erreur qui la
   * relaierait le ferait fuir dans les journaux : on ne remonte que la
   * `description` fournie par Telegram.
   */
  it('relaie la description de Telegram, jamais l’URL qui porte le jeton', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"ok":false,"description":"Bad Request: chat not found"}', { status: 400 }),
    );
    const r = await sendTelegramDocument(1, Buffer.from('x'), 'a.pdf', 'a');
    expect(r).toEqual({ channel: 'telegram', status: 'failed', error: 'Bad Request: chat not found' });
    expect(JSON.stringify(r)).not.toContain('123:abc');
  });

  it('une légende trop longue est tronquée au plafond Telegram de 1024', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    await sendTelegramDocument(1, Buffer.from('x'), 'a.pdf', 'z'.repeat(2000));
    const form = fetchMock.mock.calls[0]![1]!.body as FormData;
    expect(String(form.get('caption')).length).toBe(1024);
  });
});
