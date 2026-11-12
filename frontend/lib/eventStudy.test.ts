import { describe, expect, it } from 'vitest';
import { eventStudy, fenetreChargement, detachementsDansFenetre, type DatedClose } from './eventStudy';

/** Séances ouvrées consécutives à partir d'une date, clôture = f(i). */
function seances(debut: string, n: number, f: (i: number) => number): DatedClose[] {
  const out: DatedClose[] = [];
  let t = Date.parse(`${debut}T12:00:00Z`);
  while (out.length < n) {
    const d = new Date(t);
    const j = d.getUTCDay();
    if (j !== 0 && j !== 6) out.push({ date: d.toISOString().slice(0, 10), close: f(out.length) });
    t += 86_400_000;
  }
  return out;
}

describe('eventStudy', () => {
  it('valeur à long historique : J0 trouvé même après 4 000 séances', () => {
    const titre = seances('2007-01-02', 5000, (i) => 1000 + i);
    const ev = titre[4980]!.date;
    const indice = titre.map((s) => ({ date: s.date, close: 200 }));
    const r = eventStudy(titre, titre.map(() => 10), indice, ev, 5);
    expect(r.found).toBe(true);
    expect(r.j0Index).toBe(4980);
    expect(r.fenetreComplete).toBe(true);
    expect(r.seancesObservees).toBe(5);
    expect(r.indexRetPost).toBe(0);
    expect(r.abnormalReturnPost).toBeCloseTo(((5985 - 5980) / 5980) * 100, 6);
  });

  it('valeur récente : historique court avant J0, pas de rendement « avant » inventé', () => {
    const titre = seances('2026-10-26', 12, (i) => 100 + i);
    const r = eventStudy(titre, titre.map(() => 1), titre, titre[2]!.date, 5);
    expect(r.found).toBe(true);
    expect(r.retPre).toBeNull();
    expect(r.fenetreComplete).toBe(true);
  });

  it('moins de 5 séances après J0 : fenêtre incomplète, horizons non atteints à null', () => {
    const titre = seances('2026-10-01', 23, (i) => 100 + i);
    const ev = titre[20]!.date; // deux séances suivent
    const r = eventStudy(titre, titre.map(() => 1), titre.map((s) => ({ date: s.date, close: 50 })), ev, 5);
    expect(r.seancesObservees).toBe(2);
    expect(r.fenetreComplete).toBe(false);
    expect(r.retPost).toBeCloseTo(((122 - 120) / 120) * 100, 6);
    expect(r.horizons['J+1']).not.toBeNull();
    expect(r.horizons['J+3']).toBeNull();
    expect(r.horizons['J+5']).toBeNull();
    expect(r.horizons['J+10']).toBeNull();
  });

  it('événement un jour non coté : J0 = séance suivante', () => {
    const titre = seances('2026-10-26', 20, (i) => 100 + i); // lundi 26/10
    const r = eventStudy(titre, titre.map(() => 1), titre, '2026-10-31', 5); // samedi
    expect(titre[r.j0Index]!.date).toBe('2026-11-02');
  });

  it("indice absent : aucun écart « à l'indice »", () => {
    const titre = seances('2026-10-01', 20, (i) => 100 + i);
    const r = eventStudy(titre, titre.map(() => 1), [], titre[3]!.date, 5);
    expect(r.retPost).not.toBeNull();
    expect(r.abnormalReturnPost).toBeNull();
    expect(r.reaction).toBe('neutral');
  });

  it('événement postérieur à la dernière séance : non trouvé', () => {
    const titre = seances('2026-10-01', 5, () => 100);
    expect(eventStudy(titre, [], titre, '2027-01-01').found).toBe(false);
  });
});

describe('fenetreChargement', () => {
  it('40 jours avant, 30 après', () => {
    expect(fenetreChargement('2026-10-30')).toEqual({ debut: '2026-09-20', fin: '2026-11-29' });
  });
});

describe('detachementsDansFenetre', () => {
  it('ne garde que les ex-dates entre la veille de J0 (exclue) et la fin observée', () => {
    const titre = seances('2026-10-26', 12, () => 100);
    const r = eventStudy(titre, [], titre, '2026-10-28', 5); // J0 mer. 28, fin mer. 04/11
    expect(detachementsDansFenetre(titre, r, ['2026-10-27', '2026-10-29', '2026-11-04', '2026-11-05'])).toEqual(['2026-10-29', '2026-11-04']);
  });
});
