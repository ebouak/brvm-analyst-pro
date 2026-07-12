import { describe, it, expect } from 'vitest';
import {
  selectRecipients,
  formatBriefForWhatsApp,
  briefMarker,
  type WhatsappPref,
} from '../src/brief/runBriefWhatsapp.js';

const pref = (over: Partial<WhatsappPref>): WhatsappPref => ({
  user_id: 'u1',
  whatsapp_phone: '+2250701020304',
  whatsapp_optin: true,
  brief_whatsapp: true,
  ...over,
});

describe('selectRecipients', () => {
  it("ne garde que opt-in + brief actif + téléphone E.164 plausible", () => {
    const prefs: WhatsappPref[] = [
      pref({ user_id: 'ok' }),
      pref({ user_id: 'no-optin', whatsapp_optin: false }),
      pref({ user_id: 'no-brief', brief_whatsapp: false }),
      pref({ user_id: 'no-phone', whatsapp_phone: null }),
      pref({ user_id: 'bad-phone', whatsapp_phone: '0701020304' }), // pas de +
      pref({ user_id: 'short', whatsapp_phone: '+225' }),
      pref({ user_id: 'spaces', whatsapp_phone: ' +2250701020304 ' }), // trim OK
    ];
    const out = selectRecipients(prefs);
    expect(out.map((r) => r.user_id).sort()).toEqual(['ok', 'spaces']);
    expect(out.every((r) => r.phone.startsWith('+'))).toBe(true);
  });
});

describe('formatBriefForWhatsApp', () => {
  it('laisse intact un brief court', () => {
    expect(formatBriefForWhatsApp('Court.')).toBe('Court.');
  });

  it('tronque ≤ maxLen avec ellipse, de préférence en fin de phrase', () => {
    const long = ('Phrase numéro un assez longue pour compter. ').repeat(60);
    const out = formatBriefForWhatsApp(long, 950);
    expect(out.length).toBeLessThanOrEqual(953); // 950 + ' …'
    expect(out.endsWith('…')).toBe(true);
    // Coupe en fin de phrase : le caractère avant l'ellipse est un point.
    expect(out.slice(0, -2).trimEnd().endsWith('.')).toBe(true);
  });

  it('tronque brut si aucune fin de phrase exploitable', () => {
    const out = formatBriefForWhatsApp('x'.repeat(2000), 100);
    expect(out.length).toBeLessThanOrEqual(103);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('briefMarker', () => {
  it('marqueur stable par date (idempotence notifications_log)', () => {
    expect(briefMarker('2026-07-10')).toBe('Brief 2026-07-10 (WhatsApp)');
    expect(briefMarker('2026-07-10')).toBe(briefMarker('2026-07-10'));
  });
});
