import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import type { ItemPdf } from '../src/dividends/boc.js';
import { lireCalendrier, dateFr, type Calendrier } from '../src/dividends/calendrier.js';
import { cleNom, codeDuNom } from '../src/dividends/calendrierCodes.js';
import { lireTableEsv, urlsCandidatesCalendrier, exerciceDepuisUrlCalendrier } from '../src/dividends/esv.js';
import { montantsPourBase, recouperDates, classer, type Cible } from '../src/dividends/rapprochementCalendrier.js';

const fixture = (nom: string) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${nom}`, import.meta.url), 'utf8')) as ItemPdf[][];
const c1009 = lireCalendrier(fixture('calendrier-dividendes-20261009.json'));
const c1006 = lireCalendrier(fixture('calendrier-dividendes-20261006.json'));
const parAvis = (c: Calendrier, avis: string) => c.lignes.find((l) => l.avis === avis);

describe('calendrier officiel BRVM — lecture par position', () => {
  it('exercice et taux sont lus dans le document, pas supposés', () => {
    expect({ e: c1009.exercice, pp: c1009.tauxPersonnePhysique, pm: c1009.tauxPersonneMorale }).toEqual({
      e: 2025,
      pp: 0.12,
      pm: 0.1,
    });
  });

  it('09/10/2026 : 35 lignes, aucune rejetée', () => {
    expect(c1009.lignes).toHaveLength(35);
    expect(c1009.rejets).toEqual([]);
  });

  it('ligne sans « (*) » : montant tel que publié, déjà net', () => {
    expect(parAvis(c1009, '111-2026 BRVMDG')).toEqual({
      nom: 'SONATEL SENEGAL',
      montant: 1740,
      brut: false,
      avis: '111-2026 BRVMDG',
      publication: '2026-04-23',
      ex_date: '2026-05-22',
      paiement: '2026-05-26',
    });
  });

  it('« (*) » = brut, y compris quand le marqueur est sur la ligne suivante du nom', () => {
    expect(parAvis(c1009, '138-2026 BRVMDG')).toMatchObject({ nom: 'ORANGE CI', montant: 800, brut: true });
    expect(parAvis(c1009, '184-2026 BRVMDG')).toMatchObject({ nom: 'SOCIETE IVOIRIENNE DE BANQUE', montant: 425, brut: true });
    expect(parAvis(c1009, '245-2026 BRVMDG')).toMatchObject({ nom: 'TOTALENERGIES MARKETING CI', brut: true });
  });

  it('la virgule est un séparateur DÉCIMAL ici (pas le piège du carnet)', () => {
    expect(parAvis(c1009, '170-2026 BRVMDG')?.montant).toBe(0.9184);
    expect(parAvis(c1009, '137-2026 BRVMDG')?.montant).toBe(145.3214);
    expect(parAvis(c1009, '102-2026 BRVMDG')?.montant).toBe(594.528);
    expect(parAvis(c1009, '226-2026 BRVMDG')?.montant).toBe(1940);
  });

  it('nom sur deux lignes, recollé ; numéro d’avis sans zéro de tête', () => {
    expect(parAvis(c1009, '170-2026 BRVMDG')?.nom).toBe('Ecobank Transnational Incorporated TG');
    expect(parAvis(c1009, '72-2026 BRVMDG')?.nom).toBe('BOA BURKINA FASO');
  });

  it('06/10/2026 : TRACTAFRIC rejetée (ex-dividende après le paiement), nommée, jamais écrite', () => {
    expect(c1006.lignes).toHaveLength(33);
    expect(c1006.rejets).toHaveLength(1);
    expect(c1006.rejets[0]).toMatchObject({ nom: 'TRACTAFRIC MOTORS CI', avis: '294-2026 BRVMDG' });
    expect(c1006.rejets[0]?.motif).toMatch(/postérieur au paiement/);
  });

  it('dates : format JJ/MM/AAAA strict, date impossible refusée', () => {
    expect(dateFr('06/10/2026')).toBe('2026-10-06');
    expect(dateFr('31/02/2026')).toBeNull();
    expect(dateFr('2026-10-06')).toBeNull();
  });

  it('document sans ligne « ANNEE » : erreur, rien d’inventé', () => {
    expect(() => lireCalendrier([[]])).toThrow(/ANNEE/);
  });
});

describe('correspondance nom → code (table curée, aucun repli flou)', () => {
  it('les 35 lignes du 09/10 sont rapprochées, chacune vers un code distinct', () => {
    const codes = c1009.lignes.map((l) => codeDuNom(l.nom));
    expect(codes.filter((c) => c == null)).toEqual([]);
    expect(new Set(codes).size).toBe(35);
  });

  it('accents, apostrophes et espaces parasites sont neutralisés', () => {
    expect(cleNom('BOA CÔTE D’IVOIRE')).toBe('BOACOTEDIVOIRE');
    expect(codeDuNom('BOA CÔTE D’IVOIRE')).toBe('BOAC');
    expect(codeDuNom('SOCIETE GENERALE C I')).toBe('SGBC');
    expect(codeDuNom('NEI - CEDA CI')).toBe('NEIC');
  });

  it('un nom inconnu ou partiel ne devine rien', () => {
    expect(codeDuNom('BANQUE INCONNUE CI')).toBeNull();
    expect(codeDuNom('ORANGE')).toBeNull();
  });
});

const html = (nom: string) => readFileSync(new URL(`./fixtures/${nom}`, import.meta.url), 'utf8');
const p0 = lireTableEsv(html('brvm-esv-dividendes-p0.html'));
const p1 = lireTableEsv(html('brvm-esv-dividendes-p1.html'));

describe('table HTML des paiements de dividendes (brvm.org/fr/esv)', () => {
  it('dates lues dans les attributs ISO, avis et date de publication tirés du lien', () => {
    expect(p0).toHaveLength(10);
    expect(p0[0]).toEqual({
      emetteur: 'BOLLORE TRANSPORT & LOGISTICS',
      exercice: 2025,
      paiement: '2026-10-27',
      ex_date: '2026-10-26',
      avis: '297-2026 BRVMDG',
      avisUrl: expect.stringContaining('avis_ndeg297_brvmdg'),
      datePublication: '2026-10-09',
    });
  });

  it('les erreurs de la table sont lues telles quelles (le recoupement les tranchera)', () => {
    expect(p1.find((r) => r.avis === '213-2026 BRVMDG')).toMatchObject({ emetteur: 'SOGB', ex_date: '2026-07-05' });
    expect(p1.some((r) => r.avis === '211-2025 BRVMDG')).toBe(true);
  });

  it('candidats : un calendrier par date d’avis, du plus récent, au plus 5, sans doublon', () => {
    const urls = urlsCandidatesCalendrier([...p0, ...p1]);
    expect(urls[0]).toBe(
      'https://www.brvm.org/sites/default/files/20261009_-_calendrier_de_paiement_des_dividendes_-_exercice_2025.pdf',
    );
    expect(urls.length).toBeLessThanOrEqual(5);
    expect(new Set(urls).size).toBe(urls.length);
    expect(exerciceDepuisUrlCalendrier(urls[0]!)).toBe(2025);
  });
});

describe('rapprochement : montants, recoupement, classement', () => {
  const ligne = (avis: string) => parAvis(c1009, avis)!;

  it('brut « (*) » → net = brut × (1 − taux lu), brut et taux conservés', () => {
    expect(montantsPourBase(ligne('138-2026 BRVMDG'), 0.12)).toEqual({ montant: 704, montant_brut: 800, taux_retenue: 0.12 });
    expect(montantsPourBase(ligne('231-2026 BRVMDG'), 0.12)?.montant).toBe(2293.28);
  });

  it('ligne nette : montant tel quel, brut NON reconstitué', () => {
    expect(montantsPourBase(ligne('111-2026 BRVMDG'), 0.12)).toEqual({ montant: 1740, montant_brut: null, taux_retenue: null });
  });

  it('brut sans taux lisible : refusé, jamais calculé avec un taux supposé', () => {
    expect(montantsPourBase(ligne('138-2026 BRVMDG'), null)).toBeNull();
  });

  it('recoupement : SOGB divergente rejetée, TRACTAFRIC concordante, BOA CI absente de la table', () => {
    const { retenues, divergences } = recouperDates(c1009.lignes, [...p0, ...p1]);
    expect(divergences.map((d) => d.ligne.avis)).toEqual(['213-2026 BRVMDG']);
    expect(retenues).toHaveLength(34);
    expect(retenues.filter((r) => r.recoupee)).toHaveLength(16);
    expect(retenues.find((r) => r.ligne.avis === '294-2026 BRVMDG')?.recoupee).toBe(true);
    expect(retenues.find((r) => r.ligne.avis === '102-2026 BRVMDG')?.recoupee).toBe(false);
  });

  const cible: Cible = {
    montant: 704,
    montant_brut: 800,
    taux_retenue: 0.12,
    ex_date: '2026-06-05',
    payment_date: '2026-06-08',
    avis_brvm: '138-2026 BRVMDG',
  };
  const base = {
    montant: 704,
    montant_brut: 800,
    ex_date: '2026-06-05',
    payment_date: '2026-06-08',
    avis_brvm: '138-2026 BRVMDG',
    source: 'brvm-calendrier',
  };

  it('classement', () => {
    expect(classer(cible, null)).toBe('absent');
    expect(classer(cible, { ...base, montant: 800 })).toBe('montant_different');
    expect(classer(cible, { ...base, ex_date: null, source: 'brvm-boc' })).toBe('date_ajoutee');
    expect(classer(cible, base)).toBe('concordant');
  });
});
