import { describe, it, expect } from 'vitest';
import { evaluerSessionWhatsapp } from '../src/whatsapp/sante.js';

describe('surveillance de la session WhatsApp (passerelle non officielle)', () => {
  it('saine : joignable et WORKING', () => {
    expect(evaluerSessionWhatsapp({ joignable: true, statut: 'WORKING' }).niveau).toBe('ok');
  });
  it('panne : passerelle injoignable (serveur ou WAHA arrêté)', () => {
    const v = evaluerSessionWhatsapp({ joignable: false, statut: null });
    expect(v.niveau).toBe('panne');
    expect(v.message).toMatch(/injoignable/);
  });
  it('panne : session déconnectée, échouée ou arrêtée', () => {
    for (const statut of ['SCAN_QR_CODE', 'FAILED', 'STOPPED', 'ABSENTE']) {
      const v = evaluerSessionWhatsapp({ joignable: true, statut });
      expect(v.niveau).toBe('panne');
      expect(v.message).toContain(statut);
    }
  });
  it('STARTING n’est pas une panne (redémarrage en cours)', () => {
    expect(evaluerSessionWhatsapp({ joignable: true, statut: 'STARTING' }).niveau).toBe('ok');
  });
  it('le message ne contient ni numéro ni identifiant de compte', () => {
    const v = evaluerSessionWhatsapp({ joignable: true, statut: 'FAILED' });
    expect(v.message).not.toMatch(/\d{8,}|@c\.us/);
  });
});
