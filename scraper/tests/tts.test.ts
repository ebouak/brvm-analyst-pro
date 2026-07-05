import { describe, it, expect } from 'vitest';
import { briefToSpeech } from '../src/brief/tts.js';

describe('briefToSpeech', () => {
  it('retire les URLs et émojis, garde le contenu', () => {
    const out = briefToSpeech('BRVM Composite +1,2% 📈 → détails sur https://westbourse.com', '2026-07-04');
    expect(out).not.toContain('http');
    expect(out).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    expect(out).toContain('1,2%');
  });

  it('lit FCFA et Md en toutes lettres', () => {
    const out = briefToSpeech('Volume 12,5 Md FCFA échangé', '2026-07-04');
    expect(out).toContain('milliards de');
    expect(out).toContain('francs CFA');
  });

  it('ajoute une intro datée en français et une outro', () => {
    const out = briefToSpeech('Séance calme.', '2026-07-04');
    expect(out).toMatch(/^Bonjour, voici le brief WestBourse de la séance du samedi 4 juillet/);
    expect(out).toContain('westbourse point com');
  });

  it('coupe proprement un texte trop long (< 4096 caractères, à une frontière de phrase)', () => {
    const long = 'Phrase test numéro un. '.repeat(300);
    const out = briefToSpeech(long, '2026-07-04');
    expect(out.length).toBeLessThan(4096);
    expect(out.endsWith('.') || out.includes('Retrouvez la suite')).toBe(true);
  });

  it('ne dépasse jamais 4096 caractères (limite tts-1)', () => {
    const veryLong = 'x'.repeat(10_000);
    const out = briefToSpeech(veryLong, '2026-07-04');
    expect(out.length).toBeLessThan(4096);
  });
});
