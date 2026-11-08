import { describe, it, expect } from 'vitest';
import { capitalisationFcfa } from './capitalisation';

describe('capitalisationFcfa', () => {
  it('la valorisation de la séance l\'emporte', () => {
    expect(capitalisationFcfa({ valorisation: 33_712_000_000, cours: 1000, titres: 10 })).toBe(33_712_000_000);
  });
  it('sans valorisation, cours × titres', () => {
    expect(capitalisationFcfa({ valorisation: null, cours: 1000, titres: 10 })).toBe(10_000);
    expect(capitalisationFcfa({ valorisation: 0, cours: 1000, titres: 10 })).toBe(10_000);
  });
  it('rien d\'exploitable : null', () => {
    expect(capitalisationFcfa({ valorisation: null, cours: null, titres: 10 })).toBeNull();
    expect(capitalisationFcfa({ valorisation: null, cours: 1000, titres: 0 })).toBeNull();
  });
});
