import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Formulaire de contact : le support reçoit un message auquel il peut répondre
 * directement, le visiteur reçoit un accusé à texte FIXE, au plus un par
 * adresse et par fenêtre. Doublures en mémoire de l'envoi et de la limite.
 */
const envois: { to: string; subject: string; html: string; replyTo?: string }[] = [];
let supportEnPanne = false;
const compteurs = new Map<string, number>();

vi.mock('@/lib/server/email', () => ({
  sendEmail: vi.fn(async (m: { to: string; subject: string; html: string; replyTo?: string }) => {
    if (supportEnPanne && m.to === 'support@test') return { ok: false, sent: 0, error: 'panne' };
    envois.push(m);
    return { ok: true, sent: 1 };
  }),
}));
vi.mock('@/lib/server/rateLimit', () => ({
  getClientIp: () => '203.0.113.7',
  checkRateLimit: vi.fn(async ({ route, ip, maxHits }: { route: string; ip: string; maxHits: number }) => {
    const k = `${route}|${ip}`;
    const n = compteurs.get(k) ?? 0;
    if (n >= maxHits) return { allowed: false };
    compteurs.set(k, n + 1);
    return { allowed: true };
  }),
}));

const { POST } = await import('@/app/api/contact/route');
const { accuseReception, DELAI_REPONSE } = await import('@/lib/contact/accuse');

const requete = (corps: Record<string, string>) =>
  new NextRequest('http://localhost/api/contact', { method: 'POST', body: JSON.stringify(corps) });

beforeEach(() => {
  envois.length = 0;
  compteurs.clear();
  supportEnPanne = false;
  process.env.CONTACT_EMAIL_TO = 'support@test';
});

describe('formulaire de contact', () => {
  it('le support peut répondre directement au visiteur', async () => {
    const r = await POST(requete({ prenom: 'Awa', email: 'awa@exemple.ci', message: 'Bonjour' }));
    expect(r.status).toBe(200);
    const support = envois.find((m) => m.to === 'support@test')!;
    expect(support.replyTo).toBe('awa@exemple.ci');
  });

  it('le visiteur reçoit un accusé au texte fixe', async () => {
    await POST(requete({ prenom: 'Awa', email: 'awa@exemple.ci', message: 'Bonjour' }));
    const accuse = envois.find((m) => m.to === 'awa@exemple.ci')!;
    expect(accuse).toEqual({ to: 'awa@exemple.ci', ...accuseReception() });
    expect(accuse.html).toContain(DELAI_REPONSE);
  });

  it("l'accusé ne reprend AUCUNE saisie : le formulaire ne relaie rien vers un tiers", async () => {
    const piege = 'https://arnaque.example/gagnez';
    await POST(requete({ prenom: piege, email: 'victime@exemple.sn', message: `Cliquez ${piege}`, page: piege }));
    const accuse = envois.find((m) => m.to === 'victime@exemple.sn')!;
    expect(accuse.html).not.toContain('arnaque');
    expect(accuse.subject).not.toContain('arnaque');
  });

  it('un seul accusé par adresse et par fenêtre, casse comprise', async () => {
    await POST(requete({ email: 'awa@exemple.ci', message: 'un' }));
    await POST(requete({ email: 'AWA@Exemple.CI', message: 'deux' }));
    expect(envois.filter((m) => m.to.toLowerCase() === 'awa@exemple.ci')).toHaveLength(1);
    // Le support, lui, reçoit bien les deux messages.
    expect(envois.filter((m) => m.to === 'support@test')).toHaveLength(2);
  });

  it("la clé de limite n'est pas l'adresse en clair", async () => {
    await POST(requete({ email: 'awa@exemple.ci', message: 'un' }));
    const cles = [...compteurs.keys()].filter((k) => k.startsWith('contact-accuse|'));
    expect(cles).toHaveLength(1);
    expect(cles[0]).not.toContain('awa');
    expect(cles[0]).toMatch(/^contact-accuse\|[0-9a-f]{64}$/);
  });

  it('message perdu chez le support : pas d’accusé, erreur 502', async () => {
    supportEnPanne = true;
    const r = await POST(requete({ email: 'awa@exemple.ci', message: 'Bonjour' }));
    expect(r.status).toBe(502);
    expect(envois).toHaveLength(0);
  });

  it('adresse invalide : rien ne part', async () => {
    const r = await POST(requete({ email: 'pas-une-adresse', message: 'Bonjour' }));
    expect(r.status).toBe(400);
    expect(envois).toHaveLength(0);
  });
});
