import { describe, expect, it } from 'vitest';
import { detachementDepuisSerie, phraseDetachement } from './detachementRevue';

const serie = [
  { date: '2026-05-20', cours: 4300 },
  { date: '2026-05-21', cours: 4250 },
  { date: '2026-05-22', cours: 4210 },
  { date: '2026-05-25', cours: 4200 },
];

describe('detachementDepuisSerie', () => {
  it('veille = séance précédente, jour = première séance à partir de l’ex-date', () => {
    const d = detachementDepuisSerie(serie, '2026-05-22', 174)!;
    expect(d.cours_veille).toBe(4250);
    expect(d.cours_ex).toBe(4210);
    expect(d.baisse_fcfa).toBe(40);
  });
  it('ex-date un jour sans séance : séance suivante', () => {
    expect(detachementDepuisSerie(serie, '2026-05-23', 174)!.ex_date).toBe('2026-05-25');
  });
  it('aucune veille : null', () => {
    expect(detachementDepuisSerie(serie, '2026-05-01', 174)).toBeNull();
  });
});

describe('phraseDetachement', () => {
  it('baisse inférieure au dividende (SNTS) : constat, aucune cause', () => {
    const p = phraseDetachement(detachementDepuisSerie(serie, '2026-05-22', 174)!);
    expect(p).toMatch(/n’a perdu que 40\sFCFA pour un dividende de 174\sFCFA/);
    expect(p).toContain('ne permettent pas de trancher');
    expect(p).not.toMatch(/mécaniquement|suit surtout/);
  });
  it('baisse supérieure au dividende : part du montant détaché', () => {
    const p = phraseDetachement(detachementDepuisSerie([{ date: '2026-05-21', cours: 1000 }, { date: '2026-05-22', cours: 900 }], '2026-05-22', 50)!);
    expect(p).toMatch(/a perdu 100\sFCFA pour un dividende de 50\sFCFA : le montant détaché représente 50\s% de la baisse du jour\./);
  });
});
