import { describe, it, expect } from 'vitest';
import {
  SIGNAL, SIGNAL_VERSION, construireGrille, eligible, estRevision, etatDe, lignesSignaux, performance, presence, signauxSeance, verifierSignaux,
} from '../src/conseiller/signal.js';
import { CONFIRMATION, ecartsCohortes, lireConfirmation, rendementGrille, resumer, tNeweyWest, type EcartCohorte } from '../src/conseiller/signalEvaluation.js';
import { calendrier, serie, univers } from './conseillerFabrique.js';

/** 24 valeurs de pentes croissantes sur n séances : V00 baisse le plus, V23 monte le plus. */
const pentes = Array.from({ length: 24 }, (_, k) => (k - 11.5) / 100);
const cote = (n = 400) => univers(n, pentes);

describe('construireGrille', () => {
  it('reporte le cours les jours sans ligne et ne compte pas ces jours comme échangés', () => {
    const cal = calendrier(10);
    const d = univers(10, [0]);
    // W : cotée à partir de la 3e séance, absente aux séances 5 et 6, ligne sans volume à la 8e.
    const dates = [2, 3, 4, 7, 8, 9].map((i) => cal[i]!);
    d.series.set('W', serie(dates, [100, 110, 120, 130, 140, 150], [3]));
    const c = construireGrille(d).colonnes.get('W')!;
    expect(c.premier).toBe(2);
    expect(Number.isNaN(c.cours[1]!)).toBe(true);
    expect([...c.cours.slice(2)]).toEqual([100, 110, 120, 120, 120, 130, 140, 150]);
    expect(c.echangees[9]).toBe(5);
    expect(presence(c, 9, 5)).toBeCloseTo(2 / 5, 10);
    expect(presence(c, 3, 5)).toBeNull();
  });
});

describe('performance et éligibilité', () => {
  it('performance sur les séances du calendrier, nulle si rupture, cotation trop récente ou présence insuffisante', () => {
    const d = cote(300);
    const g = construireGrille(d);
    const c = g.colonnes.get('V20')!;
    expect(performance(c, 299, 120)).toBeCloseTo(c.cours[299]! / c.cours[179]! - 1, 12);
    expect(performance(c, 100, 120)).toBeNull();
    d.ruptures.set('V20', new Set([d.calendrier[250]!]));
    const c2 = construireGrille(d).colonnes.get('V20')!;
    expect(performance(c2, 299, 120)).toBeNull();
    expect(performance(c2, 249, 120)).not.toBeNull();
    // Une rupture exactement au début de la fenêtre n'est pas dans ]a ; b].
    expect(performance(c2, 299, 49)).not.toBeNull();
  });

  it('éligible : 250 séances de cotation et 60 % de séances échangées sur 60', () => {
    const cal = calendrier(300);
    const d = univers(300, [0]);
    d.series.set('JEUNE', serie(cal.slice(60), cal.slice(60).map(() => 100)));
    const figees = Array.from({ length: 30 }, (_, k) => 299 - k);
    d.series.set('FIGEE', serie(cal, cal.map(() => 100), figees));
    const g = construireGrille(d);
    expect(eligible(g.colonnes.get('V00')!, 299)).toBe(true);
    expect(eligible(g.colonnes.get('V00')!, 248)).toBe(false);
    expect(eligible(g.colonnes.get('V00')!, 249)).toBe(true);
    expect(eligible(g.colonnes.get('JEUNE')!, 299)).toBe(false);
    expect(eligible(g.colonnes.get('FIGEE')!, 299)).toBe(false);
  });
});

describe('etatDe', () => {
  it('applique les bornes ±1/3 et refuse un état sans éligibilité', () => {
    expect(etatDe(-1 / 3, true)).toBe('a_eviter');
    expect(etatDe(1 / 3, true)).toBe('favorable');
    expect(etatDe(0.2, true)).toBe('neutre');
    expect(etatDe(-0.9, false)).toBe('pas_de_signal');
    expect(etatDe(null, true)).toBe('pas_de_signal');
  });
});

describe('signauxSeance', () => {
  it('classe le tiers le plus faible « à éviter » et le tiers le plus fort « favorable »', () => {
    const g = construireGrille(cote());
    const s = signauxSeance(g, 399);
    expect(s.size).toBe(24);
    expect(s.get('V00')).toMatchObject({ etat: 'a_eviter', score: -1, eligible: true });
    expect(s.get('V23')).toMatchObject({ etat: 'favorable', score: 1 });
    expect(s.get('V11')!.etat).toBe('neutre');
    const compte = (e: string) => [...s.values()].filter((v) => v.etat === e).length;
    expect(compte('a_eviter')).toBe(8);
    expect(compte('favorable')).toBe(8);
  });

  it('ne lit aucune donnée postérieure à la séance', () => {
    const d = cote();
    const avant = JSON.stringify([...signauxSeance(construireGrille(d), 300)]);
    for (const s of d.series.values()) for (let k = 301; k < s.cours.length; k++) s.cours[k] = s.cours[k]! * (1 + (k % 7) / 10);
    expect(JSON.stringify([...signauxSeance(construireGrille(d), 300)])).toBe(avant);
  });

  it('pas de signal pour une valeur trop récente ; pas de ligne pour une valeur sortie de la cote', () => {
    const d = cote();
    const cal = d.calendrier;
    d.series.set('JEUNE', serie(cal.slice(200), cal.slice(200).map((_, i) => 100 + i)));
    d.series.set('RADIEE', serie(cal.slice(0, 100), cal.slice(0, 100).map(() => 100)));
    const s = signauxSeance(construireGrille(d), 399);
    expect(s.get('JEUNE')).toMatchObject({ etat: 'pas_de_signal', eligible: false, score: null });
    expect(s.has('RADIEE')).toBe(false);
  });

  it('sous 6 valeurs classées, aucun rang', () => {
    const s = signauxSeance(construireGrille(univers(400, [-0.2, -0.1, 0, 0.1, 0.2])), 399);
    expect([...s.values()].every((v) => v.etat === 'pas_de_signal' && v.eligible)).toBe(true);
    expect(SIGNAL.effectifMin).toBe(6);
  });
});

describe('estRevision', () => {
  it('vrai à la première séance de chaque mois civil seulement', () => {
    const cal = ['2026-11-27', '2026-11-30', '2026-12-01', '2026-12-02', '2027-01-04'];
    expect(cal.map((_, i) => estRevision(cal, i))).toEqual([true, false, true, false, true]);
  });
});

describe('lignesSignaux et verifierSignaux', () => {
  const g = construireGrille(cote());
  const lignes = lignesSignaux(g, 399);
  it('produit un lot conforme', () => {
    expect(lignes).toHaveLength(24);
    expect(lignes[0]).toMatchObject({ date_marche: g.calendrier[399], effectif: 24, moteur_version: SIGNAL_VERSION });
    expect(verifierSignaux(lignes, g.calendrier[399]!)).toEqual([]);
  });
  it('signale une mauvaise séance, un état incohérent, un univers trop étroit', () => {
    expect(verifierSignaux(lignes, '2030-01-01').join()).toContain('séance écrite différente');
    const faux = lignes.map((l, i) => (i === 0 ? { ...l, etat: 'favorable' as const } : l));
    expect(verifierSignaux(faux, g.calendrier[399]!).join()).toContain('état incohérent');
    expect(verifierSignaux(lignes.slice(0, 10).map((l) => ({ ...l, effectif: 10 })), g.calendrier[399]!).join()).toContain('éligibles seulement');
  });
});

describe('rendementGrille', () => {
  it('ajoute les dividendes détachés dans ]a ; b] et exclut une fenêtre avec rupture ou ex-date inconnue', () => {
    const d = univers(100, [0]);
    const cal = d.calendrier;
    d.dividendes = [{ code: 'V00', exercice: 2019, montant: 50, disponibleLe: '2020-07-31', exDate: cal[10]! }];
    let g = construireGrille(d);
    expect(rendementGrille(g, 'V00', 5, 20)).toBeCloseTo(0.05, 10);
    expect(rendementGrille(g, 'V00', 10, 20)).toBeCloseTo(0, 10);
    expect(rendementGrille(g, 'V00', 5, 100)).toBeNull();
    d.ruptures.set('V00', new Set([cal[15]!]));
    g = construireGrille(d);
    expect(rendementGrille(g, 'V00', 5, 20)).toBeNull();
    expect(rendementGrille(g, 'V00', 15, 20)).not.toBeNull();
    const d2 = univers(160, [0]);
    d2.dividendes = [{ code: 'V00', exercice: 2019, montant: 50, disponibleLe: '2020-01-01', exDate: null }];
    const g2 = construireGrille(d2);
    const mai = d2.calendrier.findIndex((x) => x >= '2020-05-01');
    expect(rendementGrille(g2, 'V00', mai - 5, mai + 5)).toBeNull();
    expect(rendementGrille(g2, 'V00', 5, 20)).toBeCloseTo(0, 10);
  });
});

describe('ecartsCohortes', () => {
  it('compare les valeurs « à éviter » à l’univers éligible, de t+1 à t+1+horizon', () => {
    const d = cote();
    const g = construireGrille(d);
    const etatsA = (i: number) => new Map([...signauxSeance(g, i)].map(([c, v]) => [c, { etat: v.etat, eligible: v.eligible }]));
    const e = ecartsCohortes(g, etatsA, [300, 399], 'a_eviter', 60);
    expect(e).toHaveLength(1); // la fenêtre de 399 n'est pas close
    expect(e[0]).toMatchObject({ date: g.calendrier[300], n: 8, univers: 24 });
    const r = (k: number) => (1 + pentes[k]! / 100) ** 60 - 1;
    const bas = [0, 1, 2, 3, 4, 5, 6, 7].reduce((s, k) => s + r(k), 0) / 8;
    const tous = pentes.reduce((s, _, k) => s + r(k), 0) / 24;
    expect(e[0]!.ecart).toBeCloseTo(bas - tous, 10);
    expect(e[0]!.ecart).toBeLessThan(0);
  });
});

describe('lireConfirmation', () => {
  const serieEcarts = (debut: string, n: number, f: (k: number) => number): EcartCohorte[] => {
    const out: EcartCohorte[] = [];
    const j = new Date(`${debut}T00:00:00Z`);
    for (let k = 0; out.length < n; k++) {
      if (j.getUTCDay() !== 0 && j.getUTCDay() !== 6) out.push({ date: j.toISOString().slice(0, 10), ecart: f(k), n: 8, univers: 24 });
      j.setUTCDate(j.getUTCDate() + 1);
    }
    return out;
  };
  const bruit = (k: number) => Math.sin(k * 12.9898) * 0.03;

  it('ignore les signaux antérieurs ou égaux au 10 novembre 2026', () => {
    const l = lireConfirmation(serieEcarts('2026-11-02', 30, () => -0.02), '2026-12-11');
    expect(l.resume.n).toBe(23);
    expect(CONFIRMATION.apres).toBe('2026-11-10');
  });
  it('reste descriptif tant qu’aucune étape n’est ouverte, même avec un écart très net', () => {
    const l = lireConfirmation(serieEcarts('2026-11-11', 600, (k) => -0.02 + bruit(k)), '2029-03-01');
    expect(l).toMatchObject({ etape: null, verdict: 'descriptif', retrait: false });
    expect(l.borneHaute).toBeLessThan(0);
  });
  it('confirme à l’étape intermédiaire si la borne haute à 99 % est négative, sur les seuls signaux de l’étape', () => {
    const e = serieEcarts('2026-11-11', 1400, (k) => -0.02 + bruit(k));
    const l = lireConfirmation(e, '2032-03-01');
    expect(l).toMatchObject({ etape: 'intermediaire', verdict: 'confirme' });
    expect(l.resume.n).toBe(e.filter((x) => x.date <= '2031-11-10').length);
  });
  it('ne confirme pas un écart nul et déclenche le retrait si l’écart moyen est positif après 750 séances', () => {
    const l = lireConfirmation(serieEcarts('2026-11-11', 1400, (k) => 0.004 + bruit(k)), '2032-03-01');
    expect(l).toMatchObject({ verdict: 'non_confirme', retrait: true });
    expect(lireConfirmation(serieEcarts('2026-11-11', 700, () => 0.01), '2029-08-01').retrait).toBe(false);
  });
  it('passe à l’étape finale quand elle est close', () => {
    expect(lireConfirmation(serieEcarts('2026-11-11', 2700, (k) => -0.02 + bruit(k)), '2037-03-01').etape).toBe('finale');
  });
});

describe('resumer et tNeweyWest', () => {
  it('annualise par 250 / horizon et donne un t fini', () => {
    const r = resumer([{ date: '2027-01-04', ecart: -0.02, n: 5, univers: 20 }, { date: '2028-01-04', ecart: -0.01, n: 5, univers: 20 }], 60);
    expect(r.moyenne).toBeCloseTo(-0.015, 12);
    expect(r.annualise).toBeCloseTo((-0.015 * 250) / 60, 12);
    expect(r.parAnnee.map((a) => a.annee)).toEqual(['2027', '2028']);
    expect(tNeweyWest([1, 2, 3, 2, 1, 2, 3], 2)).toBeGreaterThan(0);
    expect(tNeweyWest([1], 2)).toBeNull();
  });
});
