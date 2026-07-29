import { describe, it, expect } from 'vitest';
import { checkThesis } from '../src/theses/pure/status.js';

describe('checkThesis (copie scraper)', () => {
  it('intacte quand cours et signal vont dans le sens de la thèse', () => {
    const r = checkThesis({ stance: 'achat', coursReference: 1000, objectif: 1500, coursActuel: 1100, signalActuel: 'BUY' });
    expect(r.status).toBe('intacte');
    expect(r.perfPct).toBeCloseTo(10);
  });

  it('objectif-atteint quand le cours dépasse la cible (achat)', () => {
    const r = checkThesis({ stance: 'achat', coursReference: 1000, objectif: 1500, coursActuel: 1600, signalActuel: 'HOLD' });
    expect(r.status).toBe('objectif-atteint');
  });

  it('a-revoir quand le signal contredit la thèse', () => {
    const r = checkThesis({ stance: 'achat', coursReference: 1000, objectif: null, coursActuel: 1050, signalActuel: 'SELL' });
    expect(r.status).toBe('a-revoir');
    expect(r.raisons.length).toBeGreaterThan(0);
  });

  it('a-revoir quand le cours décroche fortement contre une thèse d achat', () => {
    const r = checkThesis({ stance: 'achat', coursReference: 1000, objectif: null, coursActuel: 750, signalActuel: 'HOLD' });
    expect(r.status).toBe('a-revoir');
  });

  it('gère les données manquantes (perf null, pas de plantage)', () => {
    const r = checkThesis({ stance: 'conserver', coursReference: null, objectif: null, coursActuel: null, signalActuel: null });
    expect(r.status).toBe('intacte');
    expect(r.perfPct).toBeNull();
  });
});
