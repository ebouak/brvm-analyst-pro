import { describe, it, expect } from 'vitest';
import { comparer, controlerValeur, resumer, messageAlerte, badgeRatio, type CoteBocLigne } from './ecarts';

const boc = (p: Partial<CoteBocLigne>): CoteBocLigne => ({
  code: 'X', date_marche: '2026-11-09', statut: 'cote', cours_cloture: 1000, cours_reference: 1000,
  per: 10, rendement_net_pct: 5, dividende_net: 50, dividende_date: '2026-06-01', ...p,
});

describe('comparer', () => {
  it('concordant sous 3 %', () => expect(comparer(10.2, 10).etat).toBe('concordant'));
  it('écart au-delà de 3 %, signé', () => {
    const c = comparer(24.1, 18.82);
    expect(c.etat).toBe('ecart');
    expect(c.ecart!).toBeCloseTo(0.2806, 3);
  });
  it('absent d’un côté ou des deux', () => {
    expect(comparer(null, 17.56).etat).toBe('absent_site');
    expect(comparer(12, null).etat).toBe('absent_boc');
    expect(comparer(null, null).etat).toBe('non_comparable');
  });
});

describe('controlerValeur : même cours des deux côtés', () => {
  it('SDCC : BPA 518 au cours BOC 12 300 → PER 23,7 contre 18,82 publié', () => {
    const c = controlerValeur(
      { code: 'SDCC', resultatNet: 4.662e9, titres: 9e6, dividende: 462 },
      boc({ code: 'SDCC', cours_reference: 12300, per: 18.82, rendement_net_pct: 3.76 }),
    );
    expect(c.per.site!).toBeCloseTo(23.74, 1);
    expect(c.per.etat).toBe('ecart');
    expect(c.rendement.etat).toBe('concordant');
  });
  it('valeur sans fondamentaux (BBGC) : PER manquant côté site', () => {
    const c = controlerValeur(null, boc({ code: 'BBGC', per: 17.56, rendement_net_pct: null }));
    expect(c.per.etat).toBe('absent_site');
    expect(c.rendement.etat).toBe('non_comparable');
  });
  it('valeur suspendue : statut reporté, cours de référence utilisé', () => {
    const c = controlerValeur(
      { code: 'SEMC', resultatNet: 45e6, titres: 25.19e6, dividende: null },
      boc({ code: 'SEMC', statut: 'suspendu', cours_cloture: null, cours_reference: 1495, per: 37.21 }),
    );
    expect(c.statut).toBe('suspendu');
    expect(c.per.site).not.toBeNull();
  });
});

describe('resumer et messageAlerte', () => {
  const controles = [
    controlerValeur({ code: 'A', resultatNet: 1e9, titres: 1e7, dividende: 50 }, boc({ code: 'A', per: 10 })),
    controlerValeur({ code: 'B', resultatNet: 1e9, titres: 1e7, dividende: 50 }, boc({ code: 'B', per: 15 })),
    controlerValeur(null, boc({ code: 'C', statut: 'suspendu', cours_cloture: null, per: 12 })),
  ];
  it('classe les écarts, les suspendues et les PER manquants', () => {
    expect(resumer(controles)).toMatchObject({ valeurs: 3, ecartsPer: ['B'], suspendues: ['C'], perManquants: ['C'] });
  });
  it('message sans écart = pas d’alerte', () => {
    expect(messageAlerte(resumer([controles[0]!]), [controles[0]!])).toBeNull();
  });
  it('message avec écart : codes et chiffres', () => {
    const m = messageAlerte(resumer(controles), controles)!;
    expect(m).toContain('B site 10,00× / BOC 15,00×');
    expect(m).toContain('Suspendues (SP) : C');
  });
});

describe('badgeRatio', () => {
  const base = { exercice: 2025, dateBoc: '2026-11-09', unite: '×', decimales: 2 };
  it('calculé et concordant', () => {
    const b = badgeRatio({ ...base, valeurSite: 10.2, motifSite: null, comparaison: comparer(10.2, 10) });
    expect(b).toMatchObject({ source: 'calcule', libelle: 'Calculé', ecart: false });
    expect(b.detail.replace(/ | /g, ' ')).toBe('Calculé sur les comptes 2025. BOC du 09/11/2026 : 10,00×');
  });
  it('calculé en écart', () => {
    const b = badgeRatio({ ...base, valeurSite: 24.1, motifSite: null, comparaison: comparer(24.1, 18.82) });
    expect(b.ecart).toBe(true);
    expect(b.detail).toContain('écart à vérifier');
  });
  it('repli sur le bulletin quand le site n’a rien', () => {
    expect(badgeRatio({ ...base, valeurSite: null, motifSite: 'non disponible', comparaison: comparer(null, 17.56) }).source).toBe('boc');
  });
  it('non significatif', () => {
    expect(badgeRatio({ ...base, valeurSite: null, motifSite: 'n.s., bénéfice très faible', comparaison: null }).libelle).toBe('n.s.');
  });
  it('manquant', () => {
    expect(badgeRatio({ ...base, valeurSite: null, motifSite: 'non disponible', comparaison: null, dateBoc: null }).source).toBe('manquant');
  });
});
