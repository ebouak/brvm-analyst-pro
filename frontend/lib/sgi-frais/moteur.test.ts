import { describe, it, expect } from 'vitest';
import { poidsPour, scorerSgi, type ProfilInvestisseur } from './moteur';
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

  it('coût annuel : le capital est réparti sur les achats de l’année, pas échangé à chaque ordre', () => {
    // 12 ordres/an = 6 achats + 6 ventes de 1 000 000 / 6 chacun.
    const res = scorerSgi([sgi({ nom: 'Test SGI' })], [frais({})], profil({ capital: 1_000_000, ordresParAn: 12 }));
    // courtage 12 × 166 667 × 1 % = 20 000 ; BRVM 12 × 166 667 × 0,3 % = 6 000 ; garde 0,5 % = 5 000.
    expect(res[0].coutAnnuel).toBeCloseTo(31_000, 0);
  });

  it('barème incomplet → score de coût neutre, même s’il paraît moins cher', () => {
    const dir = [sgi({ nom: 'Complète' }), sgi({ nom: 'Sans tenue' })];
    const res = scorerSgi(
      dir,
      [frais({ sgiNom: 'Complète', tenueCompteMontant: 20_000 }), frais({ sgiNom: 'Sans tenue', tenueCompteMontant: null })],
      profil(),
    );
    const incomplete = res.find((m) => m.sgi.nom === 'Sans tenue')!;
    const critCout = incomplete.criteres.find((c) => c.cle === 'cout')!;
    expect(critCout.points).toBeCloseTo(critCout.max * 0.35, 5);
    expect(critCout.detail).toContain('incomplet');
    const complete = res.find((m) => m.sgi.nom === 'Complète')!;
    expect(complete.criteres.find((c) => c.cle === 'cout')!.points).toBeCloseTo(complete.criteres.find((c) => c.cle === 'cout')!.max, 5);
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

describe('priorités multiples et Guinée-Bissau', () => {
  const somme = (p: Record<string, number>) => Object.values(p).reduce((a, b) => a + b, 0);

  it('une priorité seule garde exactement l’ancienne pondération', () => {
    expect(poidsPour({ priorite: 'cout' })).toEqual({ cout: 55, depot: 15, pays: 10, autonomie: 10, solidite: 10 });
    expect(poidsPour({ priorite: 'cout', priorites: [] })).toEqual(poidsPour({ priorite: 'cout' }));
  });

  it('plusieurs priorités : pondérations moyennées, total toujours 100', () => {
    const p = poidsPour({ priorite: 'cout', priorites: ['cout', 'solidite'] });
    expect(p.cout).toBe(40);
    expect(p.solidite).toBe(22.5);
    expect(somme(p)).toBe(100);
    expect(somme(poidsPour({ priorite: 'cout', priorites: ['cout', 'solidite', 'proximite', 'cout'] }))).toBeCloseTo(100);
  });

  it('résident en Guinée-Bissau : aucune SGI n’y a son siège, aucune proximité maximale', () => {
    const res = scorerSgi([sgi({ nom: 'A', pays: 'CI' }), sgi({ nom: 'B', pays: 'SN' })], [], profil({ pays: 'GW' }));
    for (const m of res) {
      const prox = m.criteres.find((c) => c.cle === 'pays')!;
      expect(prox.points).toBeLessThan(prox.max);
    }
  });
});
