import { describe, it, expect } from 'vitest';
import { cleSemaine, selectionnerLignes, PLAFOND_EMAIL, FRAICHEUR_MS } from '../src/dossiers/selection.js';

const J = 24 * 3600 * 1000;
const maintenant = new Date('2026-09-19T11:30:00Z'); // un samedi

function ligne(code: string, quantite: number, cours: number | null, majIlYaJours: number | null, designation = code) {
  return {
    code,
    designation,
    quantite,
    cours,
    pdf_updated_at: majIlYaJours == null ? null : new Date(maintenant.getTime() - majIlYaJours * J).toISOString(),
  };
}

describe('cleSemaine', () => {
  it('renvoie le lundi ISO de la semaine, en date UTC', () => {
    expect(cleSemaine(new Date('2026-09-19T11:30:00Z'))).toBe('2026-09-14'); // samedi → lundi
    expect(cleSemaine(new Date('2026-09-14T00:10:00Z'))).toBe('2026-09-14'); // lundi → lui-même
    expect(cleSemaine(new Date('2026-09-20T23:59:00Z'))).toBe('2026-09-14'); // dimanche → lundi précédent
  });
});

describe('selectionnerLignes', () => {
  it('écarte un PDF de plus de 3 jours et le nomme avec sa raison', () => {
    const r = selectionnerLignes([ligne('NEIC', 10, 2750, 0), ligne('SVOC', 5, 1000, 8)], maintenant);
    expect(r.retenues.map((l) => l.code)).toEqual(['NEIC']);
    expect(r.exclues).toEqual([{ code: 'SVOC', designation: 'SVOC', raison: 'dossier de cette semaine non disponible' }]);
  });

  it('écarte un code sans PDF du tout', () => {
    const r = selectionnerLignes([ligne('XXXX', 1, 100, null)], maintenant);
    expect(r.retenues).toEqual([]);
    expect(r.exclues[0]?.code).toBe('XXXX');
  });

  it('trie par valorisation décroissante (quantité × cours), cours inconnu en dernier', () => {
    const r = selectionnerLignes(
      [ligne('A', 10, 100, 0), ligne('B', 1, 5000, 0), ligne('C', 100, null, 0)],
      maintenant,
    );
    expect(r.retenues.map((l) => l.code)).toEqual(['B', 'A', 'C']);
  });

  it('plafonne les pièces jointes email et liste le reste', () => {
    const lignes = Array.from({ length: PLAFOND_EMAIL + 3 }, (_, i) => ligne(`C${i}`, 1, 1000 - i, 0));
    const r = selectionnerLignes(lignes, maintenant);
    expect(r.retenues).toHaveLength(PLAFOND_EMAIL + 3);
    expect(r.pieces_jointes_email).toHaveLength(PLAFOND_EMAIL);
    expect(r.reste_email.map((l) => l.code)).toEqual([`C${PLAFOND_EMAIL}`, `C${PLAFOND_EMAIL + 1}`, `C${PLAFOND_EMAIL + 2}`]);
  });

  it('ignore les quantités nulles ou négatives', () => {
    const r = selectionnerLignes([ligne('A', 0, 100, 0), ligne('B', -3, 100, 0), ligne('C', 2, 100, 0)], maintenant);
    expect(r.retenues.map((l) => l.code)).toEqual(['C']);
    expect(r.exclues).toEqual([]);
  });

  it('la fraîcheur est exactement 3 jours', () => {
    expect(FRAICHEUR_MS).toBe(3 * J);
    const limite = selectionnerLignes([ligne('A', 1, 100, 3.01)], maintenant);
    expect(limite.retenues).toEqual([]);
    const ok = selectionnerLignes([ligne('A', 1, 100, 2.99)], maintenant);
    expect(ok.retenues).toHaveLength(1);
  });
});
