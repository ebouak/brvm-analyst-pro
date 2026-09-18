import { describe, it, expect } from 'vitest';
import { evaluerFraicheurIntraday, enSeance, SEUIL_PERIME_MIN } from '../src/monitoring/fraicheurIntraday.js';

// Jeudi 17/09/2026 — un jour de séance ordinaire.
const JEUDI = (hhmm: string) => new Date(`2026-09-17T${hhmm}:00Z`);
const ilYa = (d: Date, min: number) => new Date(d.getTime() - min * 60000).toISOString();

describe('enSeance', () => {
  it('reconnaît la séance en semaine entre 09:35 et 16:10 UTC', () => {
    expect(enSeance(JEUDI('09:35'))).toBe(true);
    expect(enSeance(JEUDI('12:00'))).toBe(true);
    expect(enSeance(JEUDI('16:10'))).toBe(true);
  });
  it('exclut le matin tôt, le soir et le week-end', () => {
    expect(enSeance(JEUDI('09:34'))).toBe(false);
    expect(enSeance(JEUDI('16:11'))).toBe(false);
    expect(enSeance(new Date('2026-09-19T12:00:00Z'))).toBe(false); // samedi
    expect(enSeance(new Date('2026-09-20T12:00:00Z'))).toBe(false); // dimanche
  });
});

describe('evaluerFraicheurIntraday', () => {
  it('fraîche : collecte récente en séance', () => {
    const now = JEUDI('11:00');
    const r = evaluerFraicheurIntraday({ derniereCollecte: ilYa(now, 12), maintenant: now, jourFerie: false });
    expect(r.verdict).toBe('fraiche');
    expect(r.ageMinutes).toBe(12);
  });

  it('périmée : au-delà du seuil en séance — le cas du 12/09 que l’ancien watchdog ne voyait pas', () => {
    const now = JEUDI('11:00');
    const r = evaluerFraicheurIntraday({ derniereCollecte: ilYa(now, 95), maintenant: now, jourFerie: false });
    expect(r.verdict).toBe('perimee');
    expect(r.ageMinutes).toBe(95);
  });

  it('la frontière : exactement le seuil reste fraîche, une minute de plus devient périmée', () => {
    const now = JEUDI('11:00');
    expect(evaluerFraicheurIntraday({ derniereCollecte: ilYa(now, SEUIL_PERIME_MIN), maintenant: now, jourFerie: false }).verdict).toBe('fraiche');
    expect(evaluerFraicheurIntraday({ derniereCollecte: ilYa(now, SEUIL_PERIME_MIN + 1), maintenant: now, jourFerie: false }).verdict).toBe('perimee');
  });

  it('en séance, l’absence totale de collecte est une anomalie, pas un état neutre', () => {
    const r = evaluerFraicheurIntraday({ derniereCollecte: null, maintenant: JEUDI('11:00'), jourFerie: false });
    expect(r.verdict).toBe('perimee');
    expect(r.ageMinutes).toBeNull();
  });

  it('hors séance, même une collecte vieille de plusieurs heures n’est pas une anomalie', () => {
    const now = JEUDI('20:00');
    expect(evaluerFraicheurIntraday({ derniereCollecte: ilYa(now, 300), maintenant: now, jourFerie: false }).verdict).toBe('hors-seance');
  });

  it('un jour férié ne déclenche jamais d’alerte, même en pleine journée', () => {
    const now = JEUDI('11:00');
    expect(evaluerFraicheurIntraday({ derniereCollecte: ilYa(now, 600), maintenant: now, jourFerie: true }).verdict).toBe('ferie');
  });
});
