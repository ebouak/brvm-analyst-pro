import { describe, expect, it } from 'vitest';
import { exportBodySchema, nomFichierSur } from './exportGuard';

describe('exportGuard', () => {
  it('symbole valide ou vide', () => {
    expect(exportBodySchema.safeParse({ texte: 'a', symbole: 'SNTS' }).success).toBe(true);
    expect(exportBodySchema.safeParse({ texte: 'a' }).success).toBe(true);
  });
  it('symbole piégé refusé', () => {
    expect(exportBodySchema.safeParse({ texte: 'a', symbole: 'S"\r\nX' }).success).toBe(false);
    expect(exportBodySchema.safeParse({ texte: 'a', symbole: 'ab' }).success).toBe(false);
  });
  it('texte vide ou > 60 000 refusé', () => {
    expect(exportBodySchema.safeParse({ texte: '' }).success).toBe(false);
    expect(exportBodySchema.safeParse({ texte: 'a'.repeat(60_001) }).success).toBe(false);
  });
  it('nom de fichier assaini', () => {
    expect(nomFichierSur('S"\r\n;x', '2026-11-11', 'pdf')).toBe('BRVM_Analyse_S____x_2026-11-11.pdf');
    expect(nomFichierSur('', '2026-11-11', 'docx')).toBe('BRVM_Analyse_rapport_2026-11-11.docx');
  });
});
