import { describe, it, expect } from 'vitest';
import { fmtPctAbs, fmtPctSigne, fmtFcfaSigne, fmtNumber, fmtFcfa } from './format';

describe('fmtPctSigne', () => {
  it('signe après arrondi, moins typographique', () => {
    expect(fmtPctSigne(1.954)).toBe(`+${fmtNumber(1.95, 2)} %`);
    expect(fmtPctSigne(-0.26)).toBe(`−${fmtNumber(0.26, 2)} %`);
  });
  it('jamais « +0,00 » ni « −0,00 »', () => {
    expect(fmtPctSigne(0.004)).toBe(`${fmtNumber(0, 2)} %`);
    expect(fmtPctSigne(-0.004)).toBe(`${fmtNumber(0, 2)} %`);
  });
  it('précision paramétrable', () => {
    expect(fmtPctSigne(-1.25, 1)).toBe(`−${fmtNumber(1.25, 1)} %`);
  });
});

describe('fmtPctAbs', () => {
  it('valeur absolue', () => {
    expect(fmtPctAbs(-0.26)).toBe(`${fmtNumber(0.26, 2)} %`);
  });
});

describe('fmtFcfaSigne', () => {
  it('signe et magnitude de fmtFcfa', () => {
    expect(fmtFcfaSigne(1_250_000)).toBe(`+${fmtFcfa(1_250_000)}`);
    expect(fmtFcfaSigne(-450_000)).toBe(`−${fmtFcfa(450_000)}`);
  });
  it('zéro et quasi-zéro sans signe', () => {
    expect(fmtFcfaSigne(0)).toBe(fmtFcfa(0));
    expect(fmtFcfaSigne(-0.3)).toBe(fmtFcfa(0.3));
  });
});

describe('valeurs non finies', () => {
  it('jamais « NaN » à l écran', () => {
    expect(fmtFcfaSigne(NaN)).toBe('—');
    expect(fmtPctSigne(Infinity)).toBe('—');
  });
  it('un montant sous le franc garde son signe', () => {
    expect(fmtFcfaSigne(0.7)).toBe('+' + fmtFcfa(0.7));
  });
});
