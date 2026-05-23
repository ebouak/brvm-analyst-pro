import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseActions } from '../src/parsers/actions.js';
import { parseObligations } from '../src/parsers/obligations.js';
import { parseIndices } from '../src/parsers/indices.js';
import { parseFrNumber, parseFrInt } from '../src/utils/parseNumber.js';
import { parseFrDate } from '../src/utils/dates.js';
import {
  extractAspNetState,
  buildPostback,
  looksLikeLoginPage,
} from '../src/client/aspnet.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(
  join(__dirname, 'fixtures', 'activites_marche.sample.html'),
  'utf8',
);

describe('parseFrNumber', () => {
  it('gère les séparateurs FR', () => {
    expect(parseFrNumber('12 345,67')).toBe(12345.67);
    expect(parseFrNumber('1 234')).toBe(1234);
    expect(parseFrNumber('+3,1 %')).toBe(3.1);
    expect(parseFrNumber('-2,50%')).toBe(-2.5);
  });
  it('renvoie null sur valeurs vides/tirets', () => {
    expect(parseFrNumber('')).toBeNull();
    expect(parseFrNumber('-')).toBeNull();
    expect(parseFrNumber('—')).toBeNull();
    expect(parseFrNumber('N/A')).toBeNull();
  });
  it('parseFrInt arrondit', () => {
    expect(parseFrInt('250 000')).toBe(250000);
  });
});

describe('parseFrDate', () => {
  it('convertit jj/mm/aaaa -> ISO', () => {
    expect(parseFrDate('31/12/2025')).toBe('2025-12-31');
    expect(parseFrDate('30/06/2027')).toBe('2027-06-30');
  });
  it('accepte déjà ISO', () => {
    expect(parseFrDate('2025-05-20')).toBe('2025-05-20');
  });
  it('null sur invalide', () => {
    expect(parseFrDate('')).toBeNull();
    expect(parseFrDate('xx')).toBeNull();
  });
});

describe('parseActions', () => {
  const actions = parseActions(html);
  it('extrait les 3 actions (exclut la ligne Total)', () => {
    expect(actions).toHaveLength(3);
  });
  it('mappe correctement Sonatel', () => {
    const snts = actions.find((a) => a.code === 'SNTS');
    expect(snts).toBeDefined();
    expect(snts!.designation).toBe('SONATEL');
    expect(snts!.pays).toBe('SN');
    expect(snts!.cours_precedent).toBe(14500);
    expect(snts!.cours_jour).toBe(14800);
    expect(snts!.variation_pct).toBe(2.07);
    expect(snts!.volume).toBe(1240);
    expect(snts!.nb_transactions).toBe(25);
    expect(snts!.valeur_echangee).toBe(18352000);
  });
  it('gère les variations négatives', () => {
    const sgbc = actions.find((a) => a.code === 'SGBC');
    expect(sgbc!.variation_pct).toBe(-0.83);
  });
});

describe('parseObligations', () => {
  const obls = parseObligations(html);
  it('extrait 2 obligations', () => {
    expect(obls).toHaveLength(2);
  });
  it('mappe taux et maturité', () => {
    const tpci = obls.find((o) => o.code === 'CI0000000001');
    expect(tpci!.taux_pct).toBe(6.25);
    expect(tpci!.maturite).toBe('2025-12-31');
    expect(tpci!.cours_jour).toBe(10075);
    expect(tpci!.emetteur).toContain('Côte');
  });
});

describe('parseIndices', () => {
  const idx = parseIndices(html);
  it('extrait BRVM30 et BRVMC', () => {
    const codes = idx.map((i) => i.code).sort();
    expect(codes).toContain('BRVM30');
    expect(codes).toContain('BRVMC');
  });
  it('valeurs correctes', () => {
    const b30 = idx.find((i) => i.code === 'BRVM30');
    expect(b30!.valeur).toBe(168.42);
    expect(b30!.variation_pct).toBe(0.79);
  });
});

describe('ASP.NET helpers', () => {
  it('extrait __VIEWSTATE et __EVENTVALIDATION', () => {
    const state = extractAspNetState(html);
    expect(state.hidden['__VIEWSTATE']).toBeTruthy();
    expect(state.hidden['__EVENTVALIDATION']).toBeTruthy();
    expect(state.hidden['__VIEWSTATEGENERATOR']).toBe('CA0B0334');
  });
  it('buildPostback conserve les hidden et ajoute la cible', () => {
    const state = extractAspNetState(html);
    const form = buildPostback(state, 'btn$X', '', { foo: 'bar' });
    expect(form['__VIEWSTATE']).toBe(state.hidden['__VIEWSTATE']);
    expect(form['__EVENTTARGET']).toBe('btn$X');
    expect(form['foo']).toBe('bar');
  });
  it('looksLikeLoginPage = false sur la page marché', () => {
    expect(looksLikeLoginPage(html)).toBe(false);
  });
  it('looksLikeLoginPage = true sur un formulaire de connexion', () => {
    const loginHtml =
      '<html><body><form>Connexion<input type="password" name="pw"/>' +
      '<label>Mot de passe</label></form></body></html>';
    expect(looksLikeLoginPage(loginHtml)).toBe(true);
  });
});
