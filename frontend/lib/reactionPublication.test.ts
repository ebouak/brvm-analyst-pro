import { describe, expect, it } from 'vitest';
import type { DatedClose } from './eventStudy';
import { RESERVE_REACTION, reactionPublication, reactionsPublications } from './reactionPublication';

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

// Lundi 2026-09-07 = séance 0. J0 = séance 2, J+5 = séance 7.
const titreBase = (i: number) => (i <= 2 ? 100 : 100 + ((i - 2) / 5) * 10); // +10 % entre J0 et J+5
const indiceBase = (i: number) => (i <= 2 ? 200 : 200 + ((i - 2) / 5) * 4); // +2 %

describe('reactionPublication', () => {
  it('mesure titre +10 % moins indice +2 % = +8, fenêtre close', () => {
    const t = seances('2026-09-07', 12, titreBase);
    const idx = seances('2026-09-07', 12, indiceBase);
    const r = reactionPublication(t, idx, t[2]!.date);
    expect(r.ecartIndicePct).toBeCloseTo(8, 6);
    expect(r.enCours).toBe(false);
    expect(r.seancesObservees).toBe(5);
  });

  it('fenêtre non close : enCours true', () => {
    const t = seances('2026-09-07', 6, titreBase);
    const idx = seances('2026-09-07', 6, indiceBase);
    const r = reactionPublication(t, idx, t[2]!.date);
    expect(r.enCours).toBe(true);
    expect(r.seancesObservees).toBe(3);
  });

  it('publication après la dernière séance : en cours, non mesurée', () => {
    const t = seances('2026-09-07', 6, titreBase);
    const r = reactionPublication(t, t, '2030-01-01');
    expect(r.enCours).toBe(true);
    expect(r.ecartIndicePct).toBeNull();
  });

  it('indice manquant : null, jamais 0', () => {
    const t = seances('2026-09-07', 12, titreBase);
    const r = reactionPublication(t, [], t[2]!.date);
    expect(r.ecartIndicePct).toBeNull();
    expect(r.enCours).toBe(false);
  });

  it('samedi : renvoyé à la séance suivante (lundi)', () => {
    const t = seances('2026-09-07', 12, titreBase);
    const idx = seances('2026-09-07', 12, indiceBase);
    const lundi = t[5]!.date;
    expect(lundi).toBe('2026-09-14');
    expect(reactionPublication(t, idx, '2026-09-12')).toEqual(reactionPublication(t, idx, lundi));
  });
});

describe('reactionsPublications', () => {
  // Indice plat ; le titre gagne `gains[k] %` entre J0 (séance dates[k]) et J+5.
  const dates = [2, 12, 22, 32];
  function titreAvecGains(gains: number[]): DatedClose[] {
    return seances('2026-01-05', 50, (i) => {
      for (let k = 0; k < gains.length; k++) {
        const j0 = dates[k]!;
        if (i > j0 && i <= j0 + 5) return 100 * (1 + gains[k]! / 100);
      }
      return 100;
    });
  }
  // J+5 vaut le gain ; mais les séances intermédiaires aussi : on mesure J0 -> J+5 = gain exact.
  const plat = (t: DatedClose[]) => t.map((s) => ({ date: s.date, close: 500 }));

  it('médiane impaire (3 réactions)', () => {
    const t = titreAvecGains([1, 5, 2]);
    const r = reactionsPublications(t, plat(t), dates.slice(0, 3).map((d) => t[d]!.date));
    expect(r.nMesurees).toBe(3);
    expect(r.mediane).toBeCloseTo(2, 6);
  });

  it('médiane paire (4 réactions)', () => {
    const t = titreAvecGains([1, 2, 4, 10]);
    const r = reactionsPublications(t, plat(t), dates.map((d) => t[d]!.date));
    expect(r.nMesurees).toBe(4);
    expect(r.mediane).toBeCloseTo(3, 6);
  });

  it('moins de 3 réactions mesurées : médiane null', () => {
    const t = titreAvecGains([1, 2]);
    const r = reactionsPublications(t, plat(t), dates.slice(0, 2).map((d) => t[d]!.date));
    expect(r.nMesurees).toBe(2);
    expect(r.mediane).toBeNull();
  });

  it('les réactions en cours sont exclues de la médiane', () => {
    const t = titreAvecGains([1, 2, 3]);
    const ds = [...dates.slice(0, 3).map((d) => t[d]!.date), t[48]!.date];
    const r = reactionsPublications(t, plat(t), ds);
    expect(r.lignes[3]!.enCours).toBe(true);
    expect(r.nMesurees).toBe(3);
  });

  it('expose la phrase de réserve', () => {
    expect(RESERVE_REACTION).toBe('Mesuré autour de la date de publication, non attribué à la publication.');
  });
});
