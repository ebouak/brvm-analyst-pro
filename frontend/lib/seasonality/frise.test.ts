import { describe, it, expect } from 'vitest';
import { habitudes } from './frise';

const ev = (type: string, date: string) => ({ type, date });

describe('habitudes', () => {
  it('mois habituel et fréquence : « en mai 4 années sur 5 »', () => {
    const h = habitudes([
      ev('detachement', '2021-05-10'), ev('detachement', '2022-05-12'), ev('detachement', '2023-06-02'),
      ev('detachement', '2024-05-15'), ev('detachement', '2025-05-20'),
    ]).find((x) => x.type === 'detachement')!;
    expect(h).toMatchObject({ moisHabituel: 5, annees: 4, sur: 5 });
    expect(h.parMois[4]).toBe(4);
    expect(h.parMois[5]).toBe(1);
  });

  it('une année compte une fois par mois, même avec deux publications', () => {
    const h = habitudes([ev('comptes_annuels', '2024-04-02'), ev('comptes_annuels', '2024-04-28'), ev('comptes_annuels', '2025-04-10')])
      .find((x) => x.type === 'comptes_annuels')!;
    expect(h).toMatchObject({ moisHabituel: 4, annees: 2, sur: 2 });
  });

  it('type absent : pas de ligne ; suspension et avertissement ignorés', () => {
    const h = habitudes([ev('suspension', '2011-05-26'), ev('avertissement', '2019-09-02')]);
    expect(h).toEqual([]);
  });

  it('égalité entre deux mois : le plus tôt dans l’année', () => {
    const h = habitudes([ev('convocation_ag', '2024-03-01'), ev('convocation_ag', '2025-04-01')]).find((x) => x.type === 'convocation_ag')!;
    expect(h).toMatchObject({ moisHabituel: 3, annees: 1, sur: 2 });
  });
});
