import { describe, expect, it, vi } from 'vitest';
import { appelerAlerteVocale, lireReponseAlerte, mentionAppel } from '../src/alerts/alerteExploitant.js';
import { doitAlerterSeanceAbsente } from '../src/alerts/seanceAbsente.js';

const ENV = { VOIX_ALERTE_URL: 'https://exemple.invalid/api/voix/alerte', VOIX_ALERTE_SECRET: 's'.repeat(40) } as NodeJS.ProcessEnv;

function reponse(status: number, corps: unknown): Response {
  return new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('appel vocal d’alerte (scraper)', () => {
  it('non configuré sans URL ni secret : aucun réseau', async () => {
    const f = vi.fn();
    const r = await appelerAlerteVocale('seance_absente', 'x', { fetch: f as never, env: {} as NodeJS.ProcessEnv });
    expect(r.issue).toBe('non_configure');
    expect(f).not.toHaveBeenCalled();
  });

  it('envoie le type et le résumé avec le secret en Bearer', async () => {
    const f = vi.fn(async () => reponse(200, { ok: true, issue: 'appele' }));
    const r = await appelerAlerteVocale('llm_panne_totale', 'plus aucun fournisseur', { fetch: f as never, env: ENV });
    expect(r.issue).toBe('appele');
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(ENV.VOIX_ALERTE_URL);
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${ENV.VOIX_ALERTE_SECRET}`);
    expect(JSON.parse(String(init.body))).toEqual({ type: 'llm_panne_totale', resume: 'plus aucun fournisseur' });
  });

  it('un réseau en panne ne lève pas', async () => {
    const f = vi.fn(async () => {
      throw new Error('ECONNRESET');
    });
    expect((await appelerAlerteVocale('whatsapp_session', 'x', { fetch: f as never, env: ENV })).issue).toBe('echec');
  });

  it('lit les issues de la route', () => {
    expect(lireReponseAlerte(200, { issue: 'deja' }).issue).toBe('deja');
    expect(lireReponseAlerte(429, { issue: 'plafond', message: 'Plafond de 10 appels par jour atteint.' })).toEqual({ issue: 'plafond', detail: 'Plafond de 10 appels par jour atteint.' });
    expect(lireReponseAlerte(401, { error: 'non autorisé' }).issue).toBe('non_configure');
    expect(lireReponseAlerte(500, null).issue).toBe('echec');
  });

  it('mention lisible dans le Telegram', () => {
    expect(mentionAppel({ issue: 'appele', detail: '' })).toContain('lancé');
    expect(mentionAppel({ issue: 'echec', detail: 'réseau' })).toContain('NON passé');
  });
});

describe('séance absente : quand appeler', () => {
  const vide = new Set<string>();
  it('passage de clôture d’un jour de séance', () => {
    expect(doitAlerterSeanceAbsente(new Date('2026-11-19T16:05:00Z'), vide)).toBe(true);
  });
  it('pas le passage du matin', () => {
    expect(doitAlerterSeanceAbsente(new Date('2026-11-19T09:20:00Z'), vide)).toBe(false);
  });
  it('pas le week-end ni un jour férié', () => {
    expect(doitAlerterSeanceAbsente(new Date('2026-11-21T16:05:00Z'), vide)).toBe(false);
    expect(doitAlerterSeanceAbsente(new Date('2026-11-19T16:05:00Z'), new Set(['2026-11-19']))).toBe(false);
  });
});
