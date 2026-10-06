import { describe, it, expect } from 'vitest';
import { avecFormatFr, CONSIGNE_FORMAT_FR, LecteurSse } from './redaction';

const ligne = (texte: string) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content: texte } }] })}\n`;

describe('avecFormatFr', () => {
  it('complète le message système existant', () => {
    const m = avecFormatFr([
      { role: 'system', content: 'Tu es analyste.' },
      { role: 'user', content: 'Q' },
    ]);
    expect(m).toHaveLength(2);
    expect(m[0].content).toBe(`Tu es analyste.\n\n${CONSIGNE_FORMAT_FR}`);
    expect(m[1].content).toBe('Q');
  });

  it("crée un message système s'il n'y en a pas", () => {
    const m = avecFormatFr([{ role: 'user', content: 'Q' }]);
    expect(m[0]).toEqual({ role: 'system', content: CONSIGNE_FORMAT_FR });
    expect(m[1].content).toBe('Q');
  });
});

describe('LecteurSse', () => {
  it('lit les fragments et s’arrête à [DONE]', () => {
    const l = new LecteurSse();
    const sortie = l.lire(ligne('Bon') + ligne('jour') + 'data: [DONE]\n' + ligne('ignoré'));
    expect(sortie).toEqual(['Bon', 'jour']);
    expect(l.fini).toBe(true);
    expect(l.lire(ligne('après'))).toEqual([]);
  });

  it('recolle une ligne coupée entre deux morceaux réseau', () => {
    const l = new LecteurSse();
    const complet = ligne('marge nette de 18,2 %');
    const coupe = 20;
    expect(l.lire(complet.slice(0, coupe))).toEqual([]);
    expect(l.lire(complet.slice(coupe))).toEqual(['marge nette de 18,2 %']);
  });

  it('rend la dernière ligne sans saut final à la clôture', () => {
    const l = new LecteurSse();
    expect(l.lire(ligne('a') + ligne('b').trimEnd())).toEqual(['a']);
    expect(l.terminer()).toEqual(['b']);
  });

  it('ignore les commentaires SSE, les lignes vides et le JSON illisible', () => {
    const l = new LecteurSse();
    expect(l.lire(': keep-alive\n\ndata: {pas du json\n' + ligne('ok'))).toEqual(['ok']);
  });
});

describe('avecCharte', () => {
  it('ajoute la charte au système existant, sans écraser la consigne', async () => {
    const { avecCharte, CHARTE_REDACTION } = await import('./redaction');
    const m = avecCharte([{ role: 'system', content: 'Tu es analyste.' }, { role: 'user', content: 'Q' }]);
    expect(m[0].content).toBe(`Tu es analyste.\n\n${CHARTE_REDACTION}`);
    expect(CHARTE_REDACTION).toContain('vouvoiement');
  });
});
