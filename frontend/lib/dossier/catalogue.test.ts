import { describe, expect, it } from 'vitest';
import { composerCatalogueDossiers } from './catalogue';

const NOW = new Date('2026-11-18T22:00:00Z');

describe('composerCatalogueDossiers', () => {
  const instruments = [
    { code: 'SNTS', designation: 'SONATEL', secteur: 'Télécommunications', type: 'action', actif: true },
    { code: 'PALC', designation: 'PALM CI', secteur: 'Agro-industrie', type: 'action', actif: true },
    { code: 'CABC', designation: 'SICABLE CI', secteur: 'Industrie', type: 'action', actif: true },
    { code: 'BRVMC', designation: 'BRVM Composite', secteur: null, type: 'indice', actif: true },
  ];
  const cours = [
    { code: 'SNTS', date_marche: '2026-11-18', cours_jour: 25000, variation_pct: 1.2 },
    { code: 'PALC', date_marche: '2026-11-18', cours_jour: 8500, variation_pct: -0.5 },
  ];

  it('rend achetable un dossier frais avec une cotation, sinon seulement consultable', () => {
    const items = composerCatalogueDossiers(
      instruments,
      cours,
      [
        { code: 'SNTS', updated_at: '2026-11-17T08:00:00Z' },
        { code: 'PALC', updated_at: '2026-11-10T08:00:00Z' },
      ],
      NOW,
    );
    expect(items.find((item) => item.code === 'SNTS')).toMatchObject({ statut: 'a_jour', achetable: true });
    expect(items.find((item) => item.code === 'PALC')).toMatchObject({ statut: 'actualisation', achetable: false });
    expect(items.find((item) => item.code === 'CABC')).toMatchObject({ statut: 'indisponible', achetable: false });
    expect(items.some((item) => item.code === 'BRVMC')).toBe(false);
  });

  it('prend la cotation la plus récente et trie les dossiers achetables en premier', () => {
    const items = composerCatalogueDossiers(
      instruments,
      [
        ...cours,
        { code: 'SNTS', date_marche: '2026-11-17', cours_jour: 24000, variation_pct: -1 },
        { code: 'CABC', date_marche: '2026-11-18', cours_jour: 500, variation_pct: 0 },
      ],
      [
        { code: 'SNTS', updated_at: '2026-11-17T08:00:00Z' },
        { code: 'CABC', updated_at: null },
        { code: 'PALC', updated_at: '2026-11-16T08:00:00Z' },
      ],
      NOW,
    );
    expect(items[0]).toMatchObject({ code: 'SNTS', cours: 25000 });
    expect(items.find((item) => item.code === 'PALC')?.designation).toBe('PALM CI');
  });
});
