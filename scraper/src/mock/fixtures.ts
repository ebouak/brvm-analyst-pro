/**
 * Donnees mock (cf. ss6.4 / ss11 "prevoir mode mock si source indisponible").
 * Permet de developper le frontend et de tester le pipeline sans BDFIN.
 * Valeurs plausibles inspirees de titres reels de la BRVM (NON officielles).
 *
 * Profils assigns pour couvrir toute la gamme de signaux :
 *   SNTS, NTLC  -> bullish  : serie haussiere -> BUY probable
 *   SGBC, ONTBF -> bearish  : serie baissiere -> SELL probable
 *   ETIT        -> oversold : chute puis rebond
 *   PALC        -> overbought : montee prolongee
 *   SLBC, CIEC  -> neutral  : marche aleatoire stable -> HOLD
 */
import type { MarketSnapshot } from '../types.js';
import { sha256 } from '../utils/hash.js';
import { todayMarketDate } from '../utils/dates.js';

export function buildMockSnapshot(date = todayMarketDate()): MarketSnapshot {
  const actions = [
    mkAction('SNTS',  'Sonatel',               'SN', 'Telecommunications', 14100, 14800, 3200),
    mkAction('SGBC',  'Societe Generale CI',    'CI', 'Finance',            12600, 11900, 1800),
    mkAction('ETIT',  'Ecobank Transnational',  'TG', 'Finance',               13,    15, 280000),
    mkAction('PALC',  'Palm CI',                'CI', 'Agro-industrie',      6200,  6800,    95),
    mkAction('SLBC',  'Solibra',                'CI', 'Industrie',          95000, 95000,    12),
    mkAction('NTLC',  'Nestle CI',              'CI', 'Distribution',        3150,  3250,   920),
    mkAction('ONTBF', 'Onatel Burkina',         'BF', 'Telecommunications',  3180,  3050,   750),
    mkAction('CIEC',  'CIE',                    'CI', 'Services publics',    3800,  3810,    80),
  ];

  const obligations = [
    mkObl('CI0000000001', 'TPCI 6.25% 2025',         'Etat de Cote Ivoire', 6.25, '2025-12-31', 10050, 10075, 1500),
    mkObl('SN0000000002', 'Etat du Senegal 6.50% 2027', 'Etat du Senegal',   6.5,  '2027-06-30',  9980,  9990,  800),
    mkObl('BJ0000000003', 'BOAD 5.90% 2031',          'BOAD',               5.9,  '2031-03-15', 10120, 10110,  300),
  ];

  const indices = [
    { code: 'BRVM30', libelle: 'BRVM 30',        valeur: 168.42, valeur_precedente: 167.10, variation_pct: 0.79 },
    { code: 'BRVMC',  libelle: 'BRVM Composite', valeur: 285.31, valeur_precedente: 283.90, variation_pct: 0.50 },
  ];

  const fakeHtml = JSON.stringify({ date, actions, obligations, indices });
  return {
    date_marche: date,
    actions,
    obligations,
    indices,
    hash_source: sha256(fakeHtml),
    is_mock: true,
  };
}

function mkAction(
  code: string,
  designation: string,
  pays: string,
  secteur: string,
  prev: number,
  jour: number,
  volume: number,
) {
  const variation_pct = round2(((jour - prev) / prev) * 100);
  return {
    code,
    designation,
    pays,
    secteur,
    cours_precedent: prev,
    cours_jour: jour,
    variation_pct,
    volume,
    nb_transactions: Math.max(1, Math.round(volume / 50)),
    valeur_echangee: jour * volume,
  };
}

function mkObl(
  code: string,
  designation: string,
  emetteur: string,
  taux: number,
  maturite: string,
  prev: number,
  jour: number,
  volume: number,
) {
  return {
    code,
    designation,
    emetteur,
    taux_pct: taux,
    maturite,
    cours_precedent: prev,
    cours_jour: jour,
    volume,
    valeur_echangee: jour * volume,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
