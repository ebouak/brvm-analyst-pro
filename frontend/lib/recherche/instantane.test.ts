import { describe, it, expect } from 'vitest';
import { construireFiche, construireInstantane, type DonneesSociete } from './instantane';

const base: DonneesSociete = {
  code: 'SNTS',
  nom: 'Sonatel',
  secteur: 'Télécommunications',
  activite: null,
  pays: 'SN',
  rendement: { valeur: 6.12, base: 'net' },
  liquidite: 'A',
  perf12m: 8.44,
};

describe('fiche-faits', () => {
  it('écrit chaque fait connu, dans l’ordre, en français', () => {
    const f = construireFiche(base);
    expect(f.texte).toBe(
      'SNTS — Sonatel. Secteur : Télécommunications. Pays : Sénégal. Rendement du dividende : 6,1 % (net). Liquidité : classe A. Performance sur 12 mois : +8,4 %.',
    );
    expect(f.faits.map((x) => x.cle)).toEqual(['secteur', 'pays', 'rendement', 'liquidite', 'perf12m']);
  });

  it('omet un fait absent au lieu de le supposer', () => {
    const f = construireFiche({ ...base, rendement: null, perf12m: null, liquidite: null, secteur: null });
    expect(f.texte).toBe('SNTS — Sonatel. Pays : Sénégal.');
    expect(f.faits.some((x) => x.cle === 'perf12m')).toBe(false);
  });

  it('dit la base fiscale inconnue, signe une baisse, nomme l’activité', () => {
    const f = construireFiche({ ...base, activite: 'banque', rendement: { valeur: 7, base: 'non_precisee' }, perf12m: -3.25 });
    expect(f.texte).toContain('Activité : banque.');
    expect(f.texte).toContain('7,0 % (base fiscale non précisée)');
    expect(f.texte).toContain('−3,3 %');
  });
});

describe('instantané', () => {
  it('mêmes données, même identifiant, quel que soit l’ordre', () => {
    const autre = { ...base, code: 'ORAC', nom: 'Orange CI', pays: 'CI' };
    expect(construireInstantane([base, autre], '2026-11-04').snapshotId).toBe(construireInstantane([autre, base], '2026-11-04').snapshotId);
  });

  it('un fait qui change ou une nouvelle séance change l’identifiant', () => {
    const a = construireInstantane([base], '2026-11-04');
    expect(construireInstantane([{ ...base, perf12m: 9 }], '2026-11-04').snapshotId).not.toBe(a.snapshotId);
    expect(construireInstantane([base], '2026-11-05').snapshotId).not.toBe(a.snapshotId);
    expect(a.snapshotId).toMatch(/^2026-11-04\.[0-9a-f]{12}$/);
    expect(a.actualiseLe).toBe('2026-11-04');
  });
});
