import { describe, expect, it } from 'vitest';
import { ancienneteComptesMois, chiffresDeLecture, construireNarratif } from './narratif';

/** Dossier minimal : rien ne doit être affirmé tant qu'aucune donnée n'est fournie. */
function dossier(sur: Record<string, unknown> = {}) {
  const base = {
    genere_le: '2026-11-13',
    identite: { code: 'TEST', designation: 'TEST SA', secteur: null, pays: null, taux_irvm: null, actions: null, flottant: null, notation: null },
    chiffres_cles: {
      exercice: null, cours: null, date_cours: null, variation_veille_pct: null, capitalisation: null,
      chiffre_affaires: null, resultat_net: null, capitaux_propres: null, dette: null, dette_perimetre: null, tresorerie: null,
      croissance_ca_1an: null, croissance_ca_2ans: null, variation_capitaux_propres_1an: null,
    },
    trajectoire: [],
    dividende: { montant: null, base_fiscale: null, source: null, exercice: null, ex_date: null, payment_date: null, rendement: null, payout: null, historique: [], exercices_sans_dividende: 0 },
    detachement: null,
    technique: { date_signal: null, signal: null, score_total: null, confiance: null, explication: null, rsi: null, ma20: null, ma50: null, macd_line: null, macd_signal: null, serie: [] },
    ratios: null,
    qualite_resultat: null,
    rentabilite_actif: null,
    niveaux: null,
    lacunes: [],
    suivi: {
      famille: 'general', intermediaire: null,
      performance: { var_1m: null, var_ytd: null, position_52s: null, haut52: null, bas52: null },
      liquidite: null, medianes: null, piliers: [], rendez_vous: [], ex_date_controle: null, comparables_nommes: [],
    },
  };
  const m = { ...base, ...sur } as typeof base;
  return m as unknown as Parameters<typeof construireNarratif>[0];
}

const avecPerf = (perf: Record<string, unknown>, sur: Record<string, unknown> = {}) =>
  dossier({
    suivi: { famille: 'general', intermediaire: null, performance: { var_1m: null, var_ytd: null, position_52s: null, haut52: null, bas52: null, ...perf }, liquidite: null, medianes: null, piliers: [], rendez_vous: [], ex_date_controle: null, comparables_nommes: [] },
    ...sur,
  });

const risque = (d: ReturnType<typeof dossier>, motif: RegExp) => construireNarratif(d).risques.find((r) => motif.test(r.texte));

describe('constats de vigilance mesurables', () => {
  it('dossier vide : aucun nouveau constat', () => {
    const n = construireNarratif(dossier());
    expect(n.risques).toEqual([]);
  });

  describe('hausse du cours supérieure à celle du bénéfice', () => {
    const traj = (a: number, b: number) => [
      { exercice: '2024', chiffre_affaires: null, resultat_net: a },
      { exercice: '2025', chiffre_affaires: null, resultat_net: b },
    ];
    it('+60,4 % de cours contre +10 % de résultat : signalé, avec les deux chiffres et la réserve de période', () => {
      const r = risque(avecPerf({ var_ytd: 0.604 }, { trajectoire: traj(100, 110) }), /davantage monté/)!;
      expect(r).toBeDefined();
      expect(r.texte).toMatch(/\+60,4 %/);
      expect(r.texte).toMatch(/\+10,0 %/);
      expect(r.texte).toMatch(/périodes différentes/);
      expect(r.fait).not.toMatch(/\d/);
    });
    it('écart inférieur à dix points : du bruit, pas un constat', () => {
      expect(risque(avecPerf({ var_ytd: 0.15 }, { trajectoire: traj(100, 110) }), /davantage monté/)).toBeUndefined();
    });
    it('cours en baisse, ou bénéfice précédent nul ou négatif : pas de constat', () => {
      expect(risque(avecPerf({ var_ytd: -0.2 }, { trajectoire: traj(100, 110) }), /davantage monté/)).toBeUndefined();
      expect(risque(avecPerf({ var_ytd: 0.6 }, { trajectoire: traj(-5, 110) }), /davantage monté/)).toBeUndefined();
      expect(risque(avecPerf({ var_ytd: 0.6 }, { trajectoire: traj(0, 110) }), /davantage monté/)).toBeUndefined();
    });
    it('un seul exercice connu : pas de constat', () => {
      expect(risque(avecPerf({ var_ytd: 0.9 }, { trajectoire: [{ exercice: '2025', chiffre_affaires: null, resultat_net: 100 }] }), /davantage monté/)).toBeUndefined();
    });
  });

  describe('cours dans le quart haut de la plage 52 semaines', () => {
    it('à 75 % et au-delà : signalé avec la position et les bornes', () => {
      const r = risque(avecPerf({ position_52s: 0.82, bas52: 2000, haut52: 4500 }), /plage sur 52 semaines/)!;
      expect(r.texte).toMatch(/82 %/);
      expect(r.texte).toMatch(/2\D?000 à 4\D?500 FCFA/);
      expect(r.fait).not.toMatch(/\d/);
    });
    it('sous 75 % : rien', () => {
      expect(risque(avecPerf({ position_52s: 0.74 }), /plage sur 52 semaines/)).toBeUndefined();
    });
    it('position inconnue : rien', () => {
      expect(risque(avecPerf({ position_52s: null }), /plage sur 52 semaines/)).toBeUndefined();
    });
  });

  describe('flottant inférieur à 25 %', () => {
    const id = (flottant: number | null, actions: number | null) => ({ code: 'T', designation: null, secteur: null, pays: null, taux_irvm: null, actions, flottant, notation: null });
    it('12,5 % du capital : signalé', () => {
      const r = risque(dossier({ identite: id(125, 1000) }), /Flottant de/)!;
      expect(r.texte).toMatch(/12,5 %/);
      expect(r.fait).not.toMatch(/\d/);
    });
    it('exactement 25 % : pas inférieur, rien ; flottant inconnu : rien', () => {
      expect(risque(dossier({ identite: id(250, 1000) }), /Flottant de/)).toBeUndefined();
      expect(risque(dossier({ identite: id(null, 1000) }), /Flottant de/)).toBeUndefined();
      expect(risque(dossier({ identite: id(100, null) }), /Flottant de/)).toBeUndefined();
    });
  });

  describe('date de détachement non confirmée', () => {
    const det = { ex_date: '2026-05-15', ex_date_officielle: '2026-05-14', dividende: 1750, cours_veille: 26_000, cours_ex: 25_950, baisse_fcfa: 50, part_expliquee: 0.03, recul_hors_dividende: 0.06 };
    const d = dossier({
      detachement: det,
      suivi: { famille: 'general', intermediaire: null, performance: { var_1m: null, var_ytd: null, position_52s: null, haut52: null, bas52: null }, liquidite: null, medianes: null, piliers: [], rendez_vous: [], ex_date_controle: 'a_verifier', comparables_nommes: [] },
    });
    it('signalée avec la date, la baisse et le dividende ; remplace l’ancien constat « n’explique que »', () => {
      const n = construireNarratif(d);
      const r = n.risques.find((x) => /n'est pas confirmée/.test(x.texte))!;
      expect(r.texte).toMatch(/14\/05\/2026|14 mai 2026/);
      expect(r.texte).toMatch(/50 FCFA/);
      expect(r.texte).toMatch(/1\D?750/);
      expect(n.risques.some((x) => /n'explique que/.test(x.texte))).toBe(false);
    });
    it('date cohérente : pas de ce constat', () => {
      const ok = dossier({ detachement: { ...det, baisse_fcfa: 1750, part_expliquee: 1 }, suivi: { ...d.suivi, ex_date_controle: 'coherente' } });
      expect(risque(ok, /n'est pas confirmée/)).toBeUndefined();
    });
  });

  describe('comptes de plus de 18 mois', () => {
    const inter = (periode: string) => ({ periode, libelle: '', mois: 3, revenu: null, resultatNet: null, periodePrecedente: '', libellePrecedent: '', revenuPrecedent: null, resultatNetPrecedent: null, glissant: null });
    const c = (exercice: string) => ({ exercice, cours: null, date_cours: null, variation_veille_pct: null, capitalisation: null, chiffre_affaires: null, resultat_net: null, capitaux_propres: null, dette: null, dette_perimetre: null, tresorerie: null, croissance_ca_1an: null, croissance_ca_2ans: null, variation_capitaux_propres_1an: null });
    it('exercice 2024 clos le 31/12/2024, édition du 13/11/2026 : 22 mois, signalé', () => {
      const r = risque(dossier({ chiffres_cles: c('2024') }), /derniers comptes publiés datent/)!;
      expect(r.texte).toMatch(/22 mois/);
      expect(r.fait).not.toMatch(/\d/);
    });
    it('exercice 2025 : 10 mois, rien', () => {
      expect(risque(dossier({ chiffres_cles: c('2025') }), /derniers comptes/)).toBeUndefined();
    });
    it('une publication intermédiaire récente rajeunit les comptes', () => {
      const d = dossier({
        chiffres_cles: c('2024'),
        suivi: { famille: 'general', intermediaire: inter('2026-T3'), performance: { var_1m: null, var_ytd: null, position_52s: null, haut52: null, bas52: null }, liquidite: null, medianes: null, piliers: [], rendez_vous: [], ex_date_controle: null, comparables_nommes: [] },
      });
      expect(risque(d, /derniers comptes/)).toBeUndefined();
    });
  });
});

describe('ancienneteComptesMois', () => {
  it('mois pleins entre la clôture et la date d’édition', () => {
    expect(ancienneteComptesMois('2024', null, '2026-11-13')).toBe(22);
    expect(ancienneteComptesMois('2025', null, '2026-12-30')).toBe(11);
    expect(ancienneteComptesMois('2025', null, '2026-12-31')).toBe(12);
  });
  it('période intermédiaire : fin de la période (T1 = 31 mars, S1 = 30 juin, T3 = 30 septembre)', () => {
    expect(ancienneteComptesMois('2025', '2026-S1', '2026-11-13')).toBe(4);
    expect(ancienneteComptesMois('2025', '2026-T3', '2026-11-13')).toBe(1);
    expect(ancienneteComptesMois('2025', '2026-T1', '2026-06-30')).toBe(2);
  });
  it('aucune période exploitable : null', () => {
    expect(ancienneteComptesMois(null, null, '2026-11-13')).toBeNull();
    expect(ancienneteComptesMois('2026-T1', null, '2026-11-13')).toBeNull();
  });
});

describe('chiffresDeLecture', () => {
  it('reprend, chiffre compris, les premières forces et les premiers risques', () => {
    const n = {
      forces: ['a', 'b', 'c', 'd'].map((t) => ({ texte: `Force ${t} : 12 %`, fait: 'f', mesure: 1 })),
      risques: [{ texte: 'Risque : 3 mois', fait: 'r', mesure: 1 }],
      incomplet: false,
    };
    const c = chiffresDeLecture(n, 3);
    expect(c.forces).toHaveLength(3);
    expect(c.forces[0]).toBe('Force a : 12 %');
    expect(c.risques).toEqual(['Risque : 3 mois']);
  });
});
