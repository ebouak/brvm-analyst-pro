import { describe, it, expect } from 'vitest';
import { scorerSgi, type ProfilInvestisseur } from './moteur';
import type { Sgi } from './directory';
import type { SgiFrais } from './types';

const sgi = (over: Partial<Sgi>): Sgi => ({
  nom: 'Test SGI',
  pays: 'CI',
  type: 'Banque',
  groupe: 'Groupe Test',
  depotMin: '1 000 000 FCFA',
  depotMinSource: 'relevé',
  ...over,
});

const frais = (over: Partial<SgiFrais>): SgiFrais => ({
  sgiNom: 'Test SGI',
  courtagePctMin: null, courtagePctMax: 1.0, minimumPerception: null,
  droitsGardePctMin: null, droitsGardePctMax: 0.5, droitsGardeFrequence: 'annuel',
  droitsGardeMinimum: null, tenueCompteMontant: 0, tenueCompteFrequence: 'annuel',
  fraisVirement: null, depotMinimum: null,
  gestionSousMandatPctMin: null, gestionSousMandatPctMax: null,
  confiance: 'homologue_crepmf', sourceUrl: null, sourceLabel: null,
  verifieLe: null, notes: null,
  ...over,
});

const profil = (over: Partial<ProfilInvestisseur> = {}): ProfilInvestisseur => ({
  pays: 'CI', capital: 1_000_000, ordresParAn: 12, autonomie: 'en_ligne', priorite: 'equilibre',
  ...over,
});

describe('scorerSgi', () => {
  it('classe la SGI la moins chère devant à profil égal (priorité coût)', () => {
    const dir = [sgi({ nom: 'Chère', siteWeb: 'https://a.ci' }), sgi({ nom: 'Abordable', siteWeb: 'https://b.ci' })];
    const fr = [
      frais({ sgiNom: 'Chère', courtagePctMax: 1.0, droitsGardePctMax: 0.5 }),
      frais({ sgiNom: 'Abordable', courtagePctMax: 0.65, droitsGardePctMax: 0.2 }),
    ];
    const res = scorerSgi(dir, fr, profil({ priorite: 'cout' }));
    expect(res[0].sgi.nom).toBe('Abordable');
    expect(res[0].coutAnnuel).not.toBeNull();
    expect(res[0].coutAnnuel!).toBeLessThan(res[1].coutAnnuel!);
  });

  it('barème non publié → score de coût neutre libellé, jamais un coût inventé', () => {
    const dir = [sgi({ nom: 'SansBarème' })];
    const res = scorerSgi(dir, [], profil());
    expect(res[0].coutAnnuel).toBeNull();
    const critCout = res[0].criteres.find((c) => c.cle === 'cout')!;
    expect(critCout.detail).toContain('non publié');
    expect(critCout.points).toBeCloseTo(critCout.max * 0.35, 5);
  });

  it('capital sous le dépôt minimum → alerte et 0 point dépôt', () => {
    const dir = [sgi({ nom: 'Exigeante' })];
    const fr = [frais({ sgiNom: 'Exigeante', depotMinimum: 5_000_000 })];
    const res = scorerSgi(dir, fr, profil({ capital: 1_000_000 }));
    expect(res[0].alerteDepotMin).toBe(true);
    expect(res[0].criteres.find((c) => c.cle === 'depot')!.points).toBe(0);
  });

  it('diaspora : la présence web pèse sur le critère distance', () => {
    const dir = [
      sgi({ nom: 'AvecSite', siteWeb: 'https://x.ci' }),
      sgi({ nom: 'SansSite', siteWeb: undefined }),
    ];
    const res = scorerSgi(dir, [], profil({ pays: 'DIASPORA', priorite: 'proximite' }));
    expect(res[0].sgi.nom).toBe('AvecSite');
    const pAvec = res.find((m) => m.sgi.nom === 'AvecSite')!.criteres.find((c) => c.cle === 'pays')!;
    const pSans = res.find((m) => m.sgi.nom === 'SansSite')!.criteres.find((c) => c.cle === 'pays')!;
    expect(pAvec.points).toBeGreaterThan(pSans.points);
  });

  it('somme des points = score, borné à 100', () => {
    const dir = [sgi({ nom: 'Full', siteWeb: 'https://x.ci', telephone: '+225 01' })];
    const fr = [frais({ sgiNom: 'Full' })];
    const res = scorerSgi(dir, fr, profil());
    expect(res[0].score).toBeLessThanOrEqual(100);
    const somme = res[0].criteres.reduce((a, c) => a + c.points, 0);
    expect(res[0].score).toBe(Math.round(somme));
  });
});
