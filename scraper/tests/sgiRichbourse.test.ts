import { describe, it, expect } from 'vitest';
import {
  parseSgiListRows,
  parseSgiContactFiche,
  paysToIso,
  normalizeSgiName,
  planDirectoryMerge,
  type ScrapedSgi,
  type ExistingSgiRow,
} from '../src/scrapers/sgiRichbourse.js';

// Fixtures calquées sur la structure documentée de RichBourse (table liste +
// fiche clé-valeur). À recalibrer si le markup réel diffère.
const LIST_HTML = `
<table>
  <thead><tr><th>Noms des SGI</th><th>Pays</th><th>Note</th></tr></thead>
  <tbody>
    <tr>
      <td><a href="/common/apprendre/details-sgi/bsic-capital-sa">BSIC Capital SA</a></td>
      <td>Côte d'Ivoire</td>
      <td>★★★★</td>
    </tr>
    <tr>
      <td><a href="/common/apprendre/details-sgi/sgi-cgf-bourse">CGF Bourse</a></td>
      <td>Sénégal</td>
      <td></td>
    </tr>
    <tr>
      <td><a href="/common/apprendre/details-sgi/coris-bourse">Coris Bourse S.A</a></td>
      <td>Burkina Faso</td>
      <td>★★</td>
    </tr>
  </tbody>
</table>`;

const FICHE_HTML = `
<div class="fiche">
  <div><span>Téléphone</span><a href="tel:+2252031711">+225 20 31 71 11</a></div>
  <div><span>Site Web</span><a href="http://www.bsiccapital.com/">http://www.bsiccapital.com/</a></div>
  <div><span>Pays</span><span>Côte d'Ivoire</span></div>
  <div><span>Adresse</span><span>Immeuble BSIC 3ème étage, Plateau</span></div>
  <div><span>Dépôt minimum</span><span>500 000 FCFA</span></div>
  <a href="/common/apprendre/afficher-tarifs-sgi/3255_bsic-capital-sa">Consulter les tarifs</a>
  <a href="https://www.richbourse.com/accueil">Retour</a>
</div>`;

describe('paysToIso', () => {
  it('mappe les libellés UEMOA vers ISO2 (accents/casse tolérés)', () => {
    expect(paysToIso("Côte d'Ivoire")).toBe('CI');
    expect(paysToIso('SÉNÉGAL')).toBe('SN');
    expect(paysToIso('Burkina Faso')).toBe('BF');
    expect(paysToIso('Bénin')).toBe('BJ');
  });
  it('renvoie null pour un pays inconnu ou vide', () => {
    expect(paysToIso('France')).toBeNull();
    expect(paysToIso(null)).toBeNull();
    expect(paysToIso('')).toBeNull();
  });
});

describe('parseSgiListRows', () => {
  it('extrait nom, pays ISO et slug de chaque ligne', () => {
    const rows = parseSgiListRows(LIST_HTML);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ nom: 'BSIC Capital SA', paysIso: 'CI', slug: 'bsic-capital-sa' });
    expect(rows[1]).toMatchObject({ nom: 'CGF Bourse', paysIso: 'SN', slug: 'sgi-cgf-bourse' });
    expect(rows[2]!.paysIso).toBe('BF');
  });

  it('déduplique les slugs répétés', () => {
    const dup = LIST_HTML + LIST_HTML;
    expect(parseSgiListRows(dup)).toHaveLength(3);
  });

  it('ignore les liens non-détail', () => {
    const rows = parseSgiListRows('<a href="/autre/page">Lien</a>');
    expect(rows).toHaveLength(0);
  });
});

describe('parseSgiContactFiche', () => {
  it('extrait téléphone, site web, pays, adresse, dépôt min et lien tarifs', () => {
    const f = parseSgiContactFiche(FICHE_HTML);
    expect(f.telephone).toBe('+225 20 31 71 11');
    expect(f.siteWeb).toBe('http://www.bsiccapital.com/');
    expect(f.paysIso).toBe('CI');
    expect(f.depotMin).toContain('500 000');
    expect(f.tarifsUrl).toBe('/common/apprendre/afficher-tarifs-sgi/3255_bsic-capital-sa');
  });

  it('ne confond pas le lien richbourse interne avec le site officiel', () => {
    const f = parseSgiContactFiche(FICHE_HTML);
    expect(f.siteWeb).not.toContain('richbourse.com');
  });

  it('renvoie null sur une fiche sans info (jamais de valeur inventée)', () => {
    const f = parseSgiContactFiche('<div>Rien</div>');
    expect(f.telephone).toBeNull();
    expect(f.tarifsUrl).toBeNull();
  });
});

describe('normalizeSgiName', () => {
  it('retire les suffixes juridiques et le préfixe SGI', () => {
    expect(normalizeSgiName('Coris Bourse S.A')).toBe(normalizeSgiName('Coris Bourse'));
    expect(normalizeSgiName('SGI CGF Bourse')).toBe(normalizeSgiName('CGF Bourse'));
  });
  it('distingue deux SGI réellement différentes', () => {
    expect(normalizeSgiName('Matha Securities')).not.toBe(normalizeSgiName('Matha Capital'));
  });
});

describe('planDirectoryMerge', () => {
  const scraped: ScrapedSgi[] = [
    { nom: 'Coris Bourse S.A', paysIso: 'BF', depotMin: '100 000 FCFA', siteWeb: 'https://coris-bourse.com', telephone: '+226 25 30', tarifsUrl: null, slug: 'coris-bourse' },
    { nom: 'Nouvelle SGI XYZ', paysIso: 'CI', depotMin: null, siteWeb: 'https://xyz.ci', telephone: '+225 00', tarifsUrl: null, slug: 'xyz' },
  ];
  const existing: ExistingSgiRow[] = [
    { nom: 'Coris Bourse', telephone: null, site_web: 'https://coris-bourse.com', email: null },
  ];

  it('enrichit une SGI existante sans écraser un contact déjà présent', () => {
    const plan = planDirectoryMerge(scraped, existing, '2026-07-02');
    const enr = plan.enrichments.find((e) => e.nom === 'Coris Bourse');
    expect(enr).toBeDefined();
    expect(enr!.patch.telephone).toBe('+226 25 30'); // téléphone manquant → complété
    expect(enr!.patch.site_web).toBeUndefined(); // site déjà présent → non écrasé
  });

  it('insère une SGI nouvelle avec des valeurs honnêtes (type/groupe non devinés)', () => {
    const plan = planDirectoryMerge(scraped, existing, '2026-07-02');
    const ins = plan.inserts.find((i) => i.nom === 'Nouvelle SGI XYZ');
    expect(ins).toBeDefined();
    expect(ins!.type).toBe('Non déterminé');
    expect(ins!.groupe).toBe('Non renseigné');
    expect(ins!.depot_min).toBe('Non renseigné'); // dépôt absent → jamais inventé
    expect(ins!.depot_min_source).toBe('inconnu');
    expect(ins!.source).toBe('richbourse');
  });

  it("n'insère pas une SGI qui matche une existante (pas de doublon)", () => {
    const plan = planDirectoryMerge(scraped, existing, '2026-07-02');
    expect(plan.inserts.some((i) => i.nom === 'Coris Bourse S.A')).toBe(false);
  });
});
