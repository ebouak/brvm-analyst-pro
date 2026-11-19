import { describe, expect, it } from 'vitest';
import { evaluerAppelsVocaux, type LigneAppelVocal } from './voix';

const T = new Date('2026-11-19T12:00:00Z');
const il = (h: number) => new Date(T.getTime() - h * 3_600_000).toISOString();
const ligne = (p: Partial<LigneAppelVocal>): LigneAppelVocal => ({
  id: 'a', motif: 'rappel_contact', source_id: '00000000-0000-0000-0000-000000000001', statut: 'termine', erreur: null, cree_le: il(1), ...p,
});

describe('evaluerAppelsVocaux', () => {
  it('non applicable sans appel', () => expect(evaluerAppelsVocaux([], T)[0].niveau).toBe('na'));
  it('ok quand tout a une issue', () => expect(evaluerAppelsVocaux([ligne({})], T)[0].niveau).toBe('ok'));
  it('alerte sur une ligne non terminale de plus de 24 h', () => {
    const s = evaluerAppelsVocaux([ligne({ statut: 'peut_etre_parti', cree_le: il(25) })], T)[0];
    expect(s.niveau).toBe('alerte');
    expect(s.actions?.[0]?.href).toContain('/admin/contact/');
  });
  it("pas d'alerte sous 24 h", () => expect(evaluerAppelsVocaux([ligne({ statut: 'en_cours', cree_le: il(23) })], T)[0].niveau).toBe('ok'));
  it('attention sur une transcription absente', () => {
    expect(evaluerAppelsVocaux([ligne({ erreur: 'transcription absente' })], T)[0].niveau).toBe('attention');
  });
});
