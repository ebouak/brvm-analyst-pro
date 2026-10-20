import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import type { ItemPdf } from '../src/dividends/boc.js';
import { lireCalendrier, dateFr, type Calendrier } from '../src/dividends/calendrier.js';

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
