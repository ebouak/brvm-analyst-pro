import { describe, expect, it } from 'vitest';
import { classifyEventType } from '../src/events/classify.js';
import { resolveCodes } from '../src/events/resolve.js';
import type { MarketEvent } from '../src/events/types.js';

// Libellés réels de market_events (12/11/2026).
describe('classifyEventType', () => {
  it.each([
    ['Notation financière - SAFCA CI', 'notation'],
    ['Notation Financière (version anglaise) - CIE CI', 'notation'],
    ['Bilan semestriel du contrat de liquidité - 2ème semestre 2025 - BIIC BN', 'liquidite'],
    ['PMT DVD - SONATEL SN', 'dividende'],
    ['Avis de paiement de dividende - ORANGE CI', 'dividende'],
    ['Changement important dans la Direction - SGB CI', 'gouvernance'],
    ["Rapport d'activités - 3e trimestre 2026 - SONATEL SN", 'autre'], // le type de publication décide (« rapport » → résultats)
    ['Etats financiers - Exercice 2025 - TRACTAFRIC MOTORS CI', 'autre'],
    ['Résultats annuels 2025 - ECOBANK CI', 'resultats'],
    ['Avis de convocation - Assemblée Générale Ordinaire - BIIC BN', 'assemblee'],
    ['Communiqué - engagement de la société', 'autre'], // « age » d'engagement n'est pas une AGE
  ])('%s → %s', (titre, attendu) => expect(classifyEventType(titre)).toBe(attendu));
});

const refs = [
  { code: 'BICC', designation: 'BICICI' },
  { code: 'BICB', designation: 'BANQUE INTERNATIONALE POUR L’INDUSTRIE ET LE COMMERCE DU BENIN' },
  { code: 'SNTS', designation: 'SONATEL' },
];
const ev = (title: string, instrument_code: string | null): MarketEvent => ({
  event_date: '2026-09-21', event_datetime: null, source: 'bdfin', source_url: null, source_type: 'publication',
  title, summary: null, event_type: 'resultats', issuer_name: null, instrument_code, sector: null, country_code: null,
  importance_level: 3, sentiment: null, tags: null, related_codes: instrument_code ? [instrument_code] : [],
});

describe('resolveCodes', () => {
  it('« BIIC BN » ne se rattache pas à BICC', () => {
    expect(resolveCodes(ev("Rapport d'activités et Etats financiers IFRS - 1er semestre 2026 - BIIC BN", 'BICB'), refs)).toEqual(['BICB']);
  });
  it('le nom d’émetteur reconnu ajoute son code', () => {
    expect(resolveCodes(ev('Rapport annuel 2025 - SONATEL SN', null), refs)).toEqual(['SNTS']);
  });
});
