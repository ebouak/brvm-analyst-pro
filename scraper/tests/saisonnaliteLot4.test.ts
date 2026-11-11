import { describe, it, expect } from 'vitest';
import { calculerEtat } from '../src/saisonnalite/etat.js';
import { profilDuMois, tenue, realiseDuMois, REGLE_TENUE } from '../src/saisonnalite/bilan.js';
import { saisonADeclencher, messageSaison } from '../src/alerts/saison.js';
import type { FaitMensuel } from '../src/saisonnalite/mensuel.js';
import type { Serie } from '../src/conseiller/types.js';

/** Série quotidienne : chaque année 2011-2026, mois de novembre de 10 séances, cours de base 100. */
function serieNovembres(finalParAnnee: (annee: number) => number, enCours: number): Serie {
  const s: Serie = { dates: [], cours: [], volumes: [], valeurs: [], variations: [], pos: new Map() };
  const push = (d: string, c: number) => { s.pos.set(d, s.dates.length); s.dates.push(d); s.cours.push(c); s.volumes.push(1); s.valeurs.push(c); s.variations.push(null); };
  for (let a = 2011; a <= 2026; a++) {
    push(`${a}-10-31`, 100);
    const fin = a === 2026 ? enCours : finalParAnnee(a);
    const nb = a === 2026 ? 7 : 10;
    for (let k = 1; k <= nb; k++) push(`${a}-11-${String(k + 1).padStart(2, '0')}`, 100 + ((fin - 100) * k) / nb);
  }
  return s;
}
function fait(code: string, annee: number, mois: number, rdt: number | null, extra: Partial<FaitMensuel> = {}): FaitMensuel {
  return {
    code, annee, mois, rdt_prix: rdt, rdt_total: rdt, rdt_marche: null, dividende: null, seances_cotees: 10, seances_marche: 10,
    valeur_echangee: 0, exclu: null, evenements: [], difficulte: false, complet: true, ...extra,
  };
}

describe('calculerEtat', () => {
  // Novembres passés : de +1 % à +15 %, réguliers (verdict au moins indicatif).
  const final = (a: number) => 101 + (a - 2011);
  const faits = Array.from({ length: 15 }, (_, i) => fait('X', 2011 + i, 11, (final(2011 + i) - 100) / 100));

  it('en dessous de la bande large au même rang, verdict calculé sur 10 ans', () => {
    const r = calculerEtat({ code: 'X', serie: serieNovembres(final, 80), faits, asOf: '2026-11-08' });
    expect(r.refus).toBeUndefined();
    expect(r.ligne).toMatchObject({ code: 'X', date_seance: '2026-11-08', annee: 2026, mois: 11, rang: 7, etat: 'en_dessous', etat_large: 'en_dessous' });
    expect(r.ligne!.rdt_en_cours).toBeCloseTo(-0.2);
    expect(r.ligne!.verdict).not.toBe('hasard');
  });

  it('refuse un mois à plus de 50 % (opération sur titres probable) et le nomme', () => {
    const r = calculerEtat({ code: 'X', serie: serieNovembres(final, 20), faits, asOf: '2026-11-08' });
    expect(r.ligne).toBeNull();
    expect(r.refus).toMatch(/X/);
  });
});

describe('bilan figé', () => {
  const faits = [
    ...[2016, 2017, 2018, 2019, 2020, 2021].map((a) => fait('X', a, 12, 0.03)),
    fait('X', 2026, 12, null, { complet: false }),
  ];
  it('profil tiré des seules années antérieures, n ≥ 5', () => {
    const p = profilDuMois(faits, 2026, 12)!;
    expect(p).toMatchObject({ n: 6, regle: REGLE_TENUE });
    expect(p.mediane).toBeCloseTo(0.03);
  });
  it('pas de profil sous 5 années', () => {
    expect(profilDuMois(faits.slice(2), 2026, 12)).toBeNull();
  });
  it('tenue : signe du réalisé = signe de la médiane ; hasard non compté', () => {
    expect(tenue(0.03, 'indicatif', 0.01)).toBe(true);
    expect(tenue(0.03, 'indicatif', -0.01)).toBe(false);
    expect(tenue(0.03, 'hasard', 0.01)).toBeNull();
  });
  it('réalisé : mois complet seulement, saut de plus de 50 % refusé', () => {
    expect(realiseDuMois([fait('X', 2025, 12, 0.02)], 2025, 12)).toEqual({ realise: 0.02 });
    expect(realiseDuMois([fait('X', 2025, 12, 0.02, { complet: false })], 2025, 12)).toEqual({ realise: null });
    expect(realiseDuMois([fait('X', 2025, 12, 0.7)], 2025, 12).refus).toMatch(/50/);
  });
});

describe('saisonADeclencher', () => {
  const etat = { etat_large: 'en_dessous', verdict: 'indicatif', annee: 2026, mois: 11, date_seance: '2026-11-10' };
  const vierge = { dernier_etat_notifie: null, dernier_mois_notifie: null };
  it('déclenche hors bande large, verdict non hasard, état du jour', () => {
    expect(saisonADeclencher(vierge, etat, '2026-11-10').declenche).toBe(true);
  });
  it('état périmé : pas de déclenchement, raison dite', () => {
    expect(saisonADeclencher(vierge, etat, '2026-11-11')).toMatchObject({ declenche: false, raison: 'état périmé' });
  });
  it('une seule fois par sens et par mois', () => {
    const dejaBas = { dernier_etat_notifie: 'en_dessous', dernier_mois_notifie: '2026-11' };
    expect(saisonADeclencher(dejaBas, etat, '2026-11-10').declenche).toBe(false);
    expect(saisonADeclencher(dejaBas, { ...etat, etat_large: 'au_dessus' }, '2026-11-10').declenche).toBe(true);
    expect(saisonADeclencher(dejaBas, { ...etat, mois: 12 }, '2026-11-10').declenche).toBe(true);
  });
  it('verdict hasard ou dans la bande : rien', () => {
    expect(saisonADeclencher(vierge, { ...etat, verdict: 'hasard' }, '2026-11-10').declenche).toBe(false);
    expect(saisonADeclencher(vierge, { ...etat, etat_large: 'dans_la_fourchette' }, '2026-11-10').declenche).toBe(false);
  });
});

describe('messageSaison', () => {
  it('un message pour plusieurs valeurs, sans verbe d’ordre', () => {
    const m = messageSaison([
      { code: 'SNTS', etat_large: 'en_dessous', rdt_en_cours: -0.08, q10: -0.03, q90: 0.04, n: 14, mois: 11, rang: 7 },
      { code: 'SGBC', etat_large: 'au_dessus', rdt_en_cours: 0.09, q10: -0.02, q90: 0.05, n: 12, mois: 11, rang: 7 },
    ]);
    expect(m.subject).toMatch(/2 valeurs/);
    expect(m.body).toMatch(/SNTS/);
    expect(m.body).toMatch(/SGBC/);
    expect(m.body).not.toMatch(/\b(achete[rz]?|vend(s|ez|re)|profite[rz]?|recommand)/i);
  });
});
