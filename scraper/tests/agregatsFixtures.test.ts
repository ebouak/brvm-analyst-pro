import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { schemaLecture } from '../src/agregats/schema.js';
import { normaliser } from '../src/agregats/normaliser.js';
import { controler } from '../src/agregats/controles.js';
import type { PeriodeDoc } from '../src/agregats/periode.js';

/**
 * Réponses Gemini GELÉES de documents réels (capturées par la reprise à blanc,
 * `agregats:reprise … --fixtures=tests/fixtures/agregats`) : toute évolution
 * du schéma, de la normalisation ou des contrôles est rejouée sur elles.
 */
const DOSSIER = new URL('./fixtures/agregats/', import.meta.url);
const fichiers = existsSync(DOSSIER) ? readdirSync(DOSSIER).filter((f) => f.endsWith('.json')).sort() : [];
const charge = (f: string) => JSON.parse(readFileSync(new URL(f, DOSSIER), 'utf8')) as { libelle: string; periode: PeriodeDoc; reponse: unknown };
let n = 0;
const lire = (f: string) => {
  const x = charge(f);
  const lecture = schemaLecture.parse(x.reponse);
  const code = f.split('-')[0]!;
  return normaliser(lecture, { code, url: `fixture:${f}`, libelle: x.libelle, date: null, publication_id: null, periode: x.periode, modele: 'fixture' }, () => `${f}:${++n}`);
};
const SANS_REFERENCE = { totalBilanAnnuel: null, resultatNetBase: null, totalActifsBase: null, fondsPropresBase: null, coefficientBase: null, valeursNm1: {} };

describe('réponses Gemini gelées', () => {
  it('au moins une fixture par banque témoin', () => {
    for (const code of ['SIBC', 'SGBC', 'CBIBF', 'BOAC']) expect(fichiers.some((f) => f.startsWith(`${code}-`))).toBe(true);
  });

  it.each(fichiers)('%s respecte le schéma', (f) => {
    expect(schemaLecture.safeParse(charge(f).reponse).success).toBe(true);
  });

  it.each(fichiers)('%s : aucune valeur de branche islamique n’est publiée', (f) => {
    const publiees = lire(f).filter((o) => o.statut === 'publie');
    expect(publiees.filter((o) => /islam|fen[eê]tre/i.test(`${o.libelle_exact ?? ''} ${o.extrait ?? ''}`))).toEqual([]);
  });

  it.each(fichiers.filter((f) => !f.startsWith('CBIBF')))('%s : PNB publié et égalités comptables tenues', (f) => {
    const obs = controler(lire(f), SANS_REFERENCE);
    expect(obs.some((o) => o.indicateur === 'pnb' && o.statut === 'publie')).toBe(true);
    expect(obs.filter((o) => /RBE|marge d’intérêts/.test(o.controle_motif ?? ''))).toEqual([]);
  });
});
