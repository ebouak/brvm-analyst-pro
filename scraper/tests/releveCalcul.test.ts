import { describe, it, expect } from 'vitest';
import { construireReleve, bornesMois, moisPrecedent, type EntreeReleve } from '../src/releve/calcul.js';
import { composerMessageReleve, libelleMois } from '../src/releve/message.js';

const base = (o: Partial<EntreeReleve> = {}): EntreeReleve => ({
  mois: '2026-10',
  type: 'reel',
  genereLe: '2026-11-02T08:00:00.000Z',
  positions: [],
  cours: {},
  instruments: {
    AAAA: { designation: 'Alpha SA', secteur: 'Finances' },
    BBBB: { designation: 'Beta SA', secteur: 'Finances' },
    CCCC: { designation: 'Gamma SA', secteur: 'Industriels' },
  },
  dividendes: [],
  publications: [],
  assemblees: [],
  ...o,
});

const c = (precedent: number | null, fin: number | null, dateFin = '2026-10-30') => ({
  precedent: precedent == null ? null : { date: '2026-09-30', cours: precedent },
  fin: fin == null ? null : { date: dateFin, cours: fin },
});

describe('calendrier', () => {
  it('bornes du mois et du suivant, y compris en décembre', () => {
    expect(bornesMois('2026-02')).toMatchObject({ debut: '2026-02-01', fin: '2026-02-28', suivantDebut: '2026-03-01', suivantFin: '2026-03-31' });
    expect(bornesMois('2026-12')).toMatchObject({ fin: '2026-12-31', suivantDebut: '2027-01-01', suivantFin: '2027-01-31', suivant: '2027-01' });
  });
  it('mois précédent, y compris en janvier', () => {
    expect(moisPrecedent(new Date('2026-11-02T08:00:00Z'))).toBe('2026-10');
    expect(moisPrecedent(new Date('2027-01-02T08:00:00Z'))).toBe('2026-12');
  });
});

describe('valorisation', () => {
  it('somme quantité × cours, contribution de chaque ligne', () => {
    const r = construireReleve(base({
      positions: [
        { code: 'AAAA', quantite: 10, prix_entree: 900, date_entree: '2026-01-05' },
        { code: 'BBBB', quantite: 20, prix_entree: 400, date_entree: null },
      ],
      cours: { AAAA: c(1000, 1100), BBBB: c(500, 450) },
    }))!;
    // départ = 10×1000 + 20×500 = 20 000 ; fin = 10×1100 + 20×450 = 20 000
    expect(r.resume).toMatchObject({ valeur_depart: 20000, valeur_fin: 20000, variation: 0, variation_pct: 0, nb_lignes: 2, nb_exclues: 0 });
    const a = r.lignes.find((l) => l.code === 'AAAA')!;
    expect(a).toMatchObject({ variation: 1000, variation_pct: 10, contribution_pts: 5, ouverte_dans_mois: false });
    const b = r.lignes.find((l) => l.code === 'BBBB')!;
    expect(b).toMatchObject({ variation: -1000, contribution_pts: -5 });
    // somme des contributions = variation du portefeuille en %
    expect(r.lignes.reduce((s, l) => s + (l.contribution_pts ?? 0), 0)).toBeCloseTo(r.resume.variation_pct ?? NaN, 6);
  });

  it('une position ouverte dans le mois part de son prix d’entrée', () => {
    const r = construireReleve(base({
      positions: [{ code: 'AAAA', quantite: 10, prix_entree: 1050, date_entree: '2026-10-12' }],
      cours: { AAAA: c(1000, 1100) },
    }))!;
    expect(r.lignes[0]).toMatchObject({ valeur_depart: 10500, valeur_fin: 11000, ouverte_dans_mois: true, cours_depart: null });
  });

  it('un code sans cours est nommé, exclu des totaux, jamais compté pour zéro', () => {
    const r = construireReleve(base({
      positions: [
        { code: 'AAAA', quantite: 10, prix_entree: 900, date_entree: null },
        { code: 'BBBB', quantite: 5, prix_entree: 400, date_entree: null },
      ],
      cours: { AAAA: c(1000, 1100), BBBB: c(null, null) },
    }))!;
    expect(r.exclues).toEqual([{ code: 'BBBB', designation: 'Beta SA', motif: 'cours indisponible' }]);
    expect(r.resume.valeur_fin).toBe(11000);
    expect(r.resume.nb_exclues).toBe(1);
    expect(r.lignes.map((l) => l.code)).toEqual(['AAAA']);
  });

  it('cours de fin absent : motif « cours indisponible »', () => {
    const r = construireReleve(base({
      positions: [{ code: 'AAAA', quantite: 10, prix_entree: 900, date_entree: null }],
      cours: { AAAA: c(1000, null) },
    }))!;
    expect(r.exclues[0]!.motif).toBe('cours indisponible');
    expect(r.resume.valeur_fin).toBeNull();
    expect(r.resume.variation_pct).toBeNull();
  });

  it('un prix d’entrée nul ou absent sur une position ouverte dans le mois exclut la ligne', () => {
    const r = construireReleve(base({
      positions: [{ code: 'AAAA', quantite: 10, prix_entree: 0, date_entree: '2026-10-05' }],
      cours: { AAAA: c(1000, 1100) },
    }))!;
    expect(r.exclues[0]!.motif).toBe('prix d’entrée non renseigné');
  });

  it('plusieurs lots du même code sont regroupés', () => {
    const r = construireReleve(base({
      positions: [
        { code: 'AAAA', quantite: 10, prix_entree: 900, date_entree: '2026-01-05' },
        { code: 'AAAA', quantite: 5, prix_entree: 1050, date_entree: '2026-10-12' },
      ],
      cours: { AAAA: c(1000, 1100) },
    }))!;
    expect(r.lignes).toHaveLength(1);
    expect(r.lignes[0]).toMatchObject({ quantite: 15, valeur_depart: 10000 + 5250, valeur_fin: 16500 });
  });

  it('une position entrée après la fin du mois n’y figure pas ; aucune position détenue = pas de relevé', () => {
    expect(construireReleve(base({
      positions: [{ code: 'AAAA', quantite: 10, prix_entree: 900, date_entree: '2026-11-03' }],
      cours: { AAAA: c(1000, 1100) },
    }))).toBeNull();
    expect(construireReleve(base({ positions: [] }))).toBeNull();
  });

  it('une valeur sans cotation dans le mois garde son dernier cours, daté', () => {
    const r = construireReleve(base({
      positions: [{ code: 'AAAA', quantite: 10, prix_entree: 900, date_entree: null }],
      cours: { AAAA: { precedent: { date: '2026-09-02', cours: 1000 }, fin: { date: '2026-09-02', cours: 1000 } } },
    }))!;
    expect(r.lignes[0]).toMatchObject({ variation: 0, date_cours: '2026-09-02' });
  });
});

describe('simulé : jamais mélangé au réel', () => {
  it('le titre le dit et les positions de l’autre portefeuille ne sont pas lues', () => {
    // La construction reçoit UNE liste : un relevé simulé ne contient que celle-ci.
    const r = construireReleve(base({
      type: 'simule',
      positions: [{ code: 'CCCC', quantite: 3, prix_entree: 2000, date_entree: '2026-09-01' }],
      cours: { CCCC: c(2000, 2200) },
    }))!;
    expect(r.type).toBe('simule');
    expect(r.titre).toBe('Relevé du portefeuille simulé');
    expect(r.lignes.map((l) => l.code)).toEqual(['CCCC']);
    expect(r.dividendes).toBeNull();
  });

  it('un relevé réel porte le titre sans « simulé »', () => {
    const r = construireReleve(base({ positions: [{ code: 'AAAA', quantite: 1, prix_entree: 1, date_entree: null }], cours: { AAAA: c(1000, 1000) } }))!;
    expect(r.titre).toBe('Relevé du portefeuille');
    expect(JSON.stringify(r)).not.toMatch(/simul/i);
  });

  it('simulé : position clôturée dans le mois valorisée à son prix de sortie, clôturée avant le mois ignorée', () => {
    const r = construireReleve(base({
      type: 'simule',
      positions: [
        { code: 'AAAA', quantite: 10, prix_entree: 900, date_entree: '2026-08-01', date_sortie: '2026-10-10', prix_sortie: 1200 },
        { code: 'BBBB', quantite: 10, prix_entree: 500, date_entree: '2026-05-01', date_sortie: '2026-09-10', prix_sortie: 600 },
      ],
      cours: { AAAA: c(1000, 1100), BBBB: c(500, 500) },
    }))!;
    expect(r.lignes.map((l) => l.code)).toEqual(['AAAA']);
    expect(r.lignes[0]).toMatchObject({ valeur_depart: 10000, valeur_fin: 12000, soldee_dans_mois: true });
  });
});

describe('dividendes', () => {
  const pos = [{ code: 'AAAA', quantite: 10, prix_entree: 900, date_entree: '2026-01-05' }];
  const cours = { AAAA: c(1000, 1100) };

  it('détachés (ex_date) et encaissés (payment_date) dans le mois, montant × quantité', () => {
    const r = construireReleve(base({
      positions: pos, cours,
      dividendes: [
        { code: 'AAAA', exercice: 2025, montant: 50, ex_date: '2026-10-08', payment_date: '2026-10-29', base_fiscale: 'net', source: 'brvm-calendrier' },
        { code: 'AAAA', exercice: 2024, montant: 40, ex_date: '2026-09-10', payment_date: '2026-10-05', base_fiscale: 'net', source: 'brvm-calendrier' },
        { code: 'BBBB', exercice: 2025, montant: 99, ex_date: '2026-10-08', payment_date: null, base_fiscale: 'net', source: null },
      ],
    }))!;
    expect(r.dividendes!.detaches).toHaveLength(1);
    expect(r.dividendes!.detaches[0]).toMatchObject({ code: 'AAAA', montant_total: 500, base_fiscale: 'net' });
    expect(r.dividendes!.encaisses.map((d) => d.montant_total)).toEqual([400, 500]);
    expect(r.dividendes!.total_detaches).toEqual({ montant: 500, base: 'net', nb: 1 });
    expect(r.dividendes!.total_encaisses).toEqual({ montant: 900, base: 'net', nb: 2 });
  });

  it('la base fiscale est rapportée telle quelle, sans retrait d’impôt ; bases mélangées = pas de total', () => {
    const r = construireReleve(base({
      positions: pos, cours,
      dividendes: [
        { code: 'AAAA', exercice: 2025, montant: 50, ex_date: '2026-10-08', payment_date: null, base_fiscale: 'brut', source: null },
        { code: 'AAAA', exercice: 2024, montant: 40, ex_date: '2026-10-20', payment_date: null, base_fiscale: null, source: null },
      ],
    }))!;
    const d = r.dividendes!;
    expect(d.detaches.map((x) => [x.montant_par_action, x.montant_total, x.base_fiscale])).toEqual([[50, 500, 'brut'], [40, 400, 'inconnu']]);
    expect(d.total_detaches).toEqual({ montant: null, base: null, nb: 2 });
  });

  it('pas de droit si la position a été prise le jour du détachement ou après', () => {
    const r = construireReleve(base({
      positions: [{ code: 'AAAA', quantite: 10, prix_entree: 1000, date_entree: '2026-10-08' }],
      cours,
      dividendes: [{ code: 'AAAA', exercice: 2025, montant: 50, ex_date: '2026-10-08', payment_date: null, base_fiscale: 'net', source: null }],
    }))!;
    expect(r.dividendes!.detaches).toHaveLength(0);
  });

  it('un montant nul est écarté et deux sources du même exercice ne comptent qu’une fois', () => {
    const r = construireReleve(base({
      positions: pos, cours,
      dividendes: [
        { code: 'AAAA', exercice: 2025, montant: 0, ex_date: '2026-10-08', payment_date: null, base_fiscale: 'net', source: 'sikafinance' },
        { code: 'AAAA', exercice: 2024, montant: 51, ex_date: '2026-10-09', payment_date: null, base_fiscale: 'net', source: 'sikafinance' },
        { code: 'AAAA', exercice: 2024, montant: 50.48, ex_date: '2026-10-09', payment_date: '2026-10-29', base_fiscale: 'net', source: 'brvm-calendrier' },
      ],
    }))!;
    expect(r.dividendes!.detaches).toHaveLength(1);
    expect(r.dividendes!.detaches[0]!.montant_par_action).toBe(50.48);
  });
});

describe('publications, concentration, rendez-vous', () => {
  const pos = [
    { code: 'AAAA', quantite: 10, prix_entree: 900, date_entree: null },
    { code: 'BBBB', quantite: 10, prix_entree: 400, date_entree: null },
    { code: 'CCCC', quantite: 1, prix_entree: 2000, date_entree: null },
  ];
  const cours = { AAAA: c(1000, 1000), BBBB: c(500, 500), CCCC: c(2000, 2000) };

  it('publications : sociétés détenues, dans le mois, triées ; au-delà du plafond elles sont comptées', () => {
    const pubs = Array.from({ length: 35 }, (_, i) => ({
      date: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`, code: 'AAAA', titre: `Communiqué ${i}`, type: 'communique',
    }));
    const r = construireReleve(base({
      positions: pos, cours,
      publications: [
        ...pubs,
        { date: '2026-10-05', code: 'ZZZZ', titre: 'Autre société', type: null },
        { date: '2026-11-02', code: 'AAAA', titre: 'Hors mois', type: null },
      ],
    }))!;
    expect(r.publications.liste).toHaveLength(30);
    expect(r.publications.non_listees).toBe(5);
    expect(r.publications.liste.every((p) => p.code === 'AAAA' && p.date.startsWith('2026-10'))).toBe(true);
    const dates = r.publications.liste.map((p) => p.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it('concentration : première ligne et premier secteur', () => {
    const r = construireReleve(base({ positions: pos, cours }))!;
    // valeurs : AAAA 10 000, BBBB 5 000, CCCC 2 000 ; total 17 000
    expect(r.concentration.premiere_ligne).toMatchObject({ code: 'AAAA' });
    expect(r.concentration.premiere_ligne!.poids_pct).toBeCloseTo((10000 / 17000) * 100, 3);
    expect(r.concentration.premier_secteur).toMatchObject({ secteur: 'Finances' });
    expect(r.concentration.premier_secteur!.poids_pct).toBeCloseTo((15000 / 17000) * 100, 3);
    expect(r.concentration.sans_secteur_pct).toBeNull();
  });

  it('un secteur non renseigné est déclaré, pas rangé dans un secteur', () => {
    const r = construireReleve(base({
      positions: pos, cours,
      instruments: { AAAA: { designation: 'Alpha', secteur: null }, BBBB: { designation: 'Beta', secteur: 'Finances' }, CCCC: { designation: 'Gamma', secteur: 'Industriels' } },
    }))!;
    expect(r.concentration.premier_secteur).toMatchObject({ secteur: 'Finances' });
    expect(r.concentration.sans_secteur_pct).toBeCloseTo((10000 / 17000) * 100, 3);
  });

  it('rendez-vous du mois suivant : détachement, paiement, assemblée des seules valeurs détenues', () => {
    const r = construireReleve(base({
      positions: pos, cours,
      dividendes: [
        { code: 'AAAA', exercice: 2025, montant: 50, ex_date: '2026-11-12', payment_date: '2026-11-30', base_fiscale: 'net', source: 'brvm-calendrier' },
        { code: 'ZZZZ', exercice: 2025, montant: 70, ex_date: '2026-11-12', payment_date: null, base_fiscale: 'net', source: null },
      ],
      assemblees: [
        { code: 'BBBB', date_ag: '2026-11-20', nature: 'Ordinaire' },
        { code: 'ZZZZ', date_ag: '2026-11-21', nature: 'Ordinaire' },
        { code: 'BBBB', date_ag: '2026-12-02', nature: 'Ordinaire' },
      ],
    }))!;
    expect(r.rendez_vous.map((x) => [x.type, x.date, x.code])).toEqual([
      ['detachement', '2026-11-12', 'AAAA'],
      ['assemblee', '2026-11-20', 'BBBB'],
      ['paiement', '2026-11-30', 'AAAA'],
    ]);
    expect(r.rendez_vous[0]).toMatchObject({ montant_par_action: 50, montant_total: 500 });
    expect(r.rendez_vous[1]).toMatchObject({ libelle: 'Assemblée générale ordinaire', montant_total: null });
  });

  it('simulé : rendez-vous sans montant total (le simulateur ne crédite aucun dividende)', () => {
    const r = construireReleve(base({
      type: 'simule', positions: pos, cours,
      dividendes: [{ code: 'AAAA', exercice: 2025, montant: 50, ex_date: '2026-11-12', payment_date: null, base_fiscale: 'net', source: null }],
    }))!;
    expect(r.rendez_vous[0]!.montant_total).toBeNull();
  });
});

describe('message d’envoi : aucun chiffre hors le mois', () => {
  it.each(['reel', 'simule'] as const)('type %s', (type) => {
    const m = composerMessageReleve('2026-10', type);
    const sansMois = (m.sujet + '\n' + m.corps).replaceAll(libelleMois('2026-10'), '');
    // Les seuls chiffres admis : ceux du mois et de l'année, retirés ci-dessus.
    expect(sansMois).not.toMatch(/\d/);
    expect(m.sujet).toContain('octobre 2026');
    expect(m.corps).toContain('conseil en investissement');
  });
  it('le simulé le dit', () => {
    expect(composerMessageReleve('2026-10', 'simule').sujet).toContain('simulé');
    expect(composerMessageReleve('2026-10', 'reel').sujet).not.toContain('simulé');
  });
});
