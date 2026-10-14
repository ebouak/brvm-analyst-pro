import { describe, it, expect } from 'vitest';
import { construireAgenda, type DividendeSource } from './agenda';

const div = (p: Partial<DividendeSource> & { code: string }): DividendeSource => ({
  montant: 100, ex_date: null, payment_date: null, base_fiscale: null, source: 'richbourse', ...p,
});

const base = {
  aujourdhui: '2026-10-14',
  dividendes: [
    div({ code: 'PRSC', montant: 183.92, ex_date: '2026-10-22', payment_date: '2026-10-23' }),
    div({ code: 'SDSC', montant: 92, ex_date: '2026-10-26', payment_date: '2026-10-27', base_fiscale: 'net' }),
    div({ code: 'SNTS', montant: 1740, payment_date: '2026-05-26', source: 'brvm-boc' }), // passé : exclu
    div({ code: 'XXXX', montant: 50, payment_date: '2026-12-31' }), // hors 30 jours : exclu
  ],
  assemblees: [{ code: 'ETIT', date_reunion: '2026-10-30', title: 'Assemblée générale ordinaire - ETI TG', source: 'bdfin' }],
  fermetures: [{ date: '2026-11-03', holiday_name: 'Jour férié', is_trading_day: false }],
  positions: [{ code: 'SDSC', quantite: 100 }],
};

describe('construireAgenda', () => {
  it('fenêtre de 30 jours, passé et lointain exclus', () => {
    const codes = construireAgenda(base).map((i) => i.code);
    expect(codes).not.toContain('SNTS');
    expect(codes).not.toContain('XXXX');
  });

  it('mes valeurs d abord, puis l ordre chronologique', () => {
    const a = construireAgenda(base);
    expect(a[0]!.code).toBe('SDSC');
    expect(a[1]!.code).toBe('SDSC');
    expect(a.slice(2).map((i) => i.date)).toEqual(['2026-10-22', '2026-10-23', '2026-10-30', '2026-11-03']);
  });

  it('dividende par action et total indicatif distincts ; base fiscale reprise telle quelle', () => {
    const sdsc = construireAgenda(base).find((i) => i.code === 'SDSC' && i.type === 'paiement')!;
    expect(sdsc.parAction).toBe(92);
    expect(sdsc.totalIndicatif).toBe(9200);
    expect(sdsc.baseFiscale).toBe('net');
    const prsc = construireAgenda(base).find((i) => i.code === 'PRSC' && i.type === 'paiement')!;
    expect(prsc.totalIndicatif).toBeNull(); // pas détenue
    expect(prsc.baseFiscale).toBe('inconnue');
  });

  it('statuts : détachement toujours annoncé ; paiement officiel seulement au Bulletin ; AG BDFIN officielle', () => {
    const a = construireAgenda({
      ...base,
      dividendes: [div({ code: 'SGBC', montant: 2298.75, ex_date: '2026-10-20', payment_date: '2026-10-25', source: 'brvm-boc' })],
    });
    expect(a.find((i) => i.type === 'detachement')!.statut).toBe('annonce');
    expect(a.find((i) => i.type === 'paiement')!.statut).toBe('officiel');
    expect(a.find((i) => i.type === 'assemblee')!.statut).toBe('officiel');
    expect(a.find((i) => i.type === 'fermeture')!.statut).toBe('fermeture');
  });

  it('dividende sans montant positif : ignoré (jamais 0)', () => {
    const a = construireAgenda({ ...base, dividendes: [div({ code: 'ZZZ', montant: 0, payment_date: '2026-10-20' })] });
    expect(a.map((i) => i.code)).not.toContain('ZZZ');
  });

  it('quantités additionnées sur plusieurs portefeuilles ; quantité nulle ou NaN non détenue', () => {
    const a = construireAgenda({
      ...base,
      positions: [
        { code: 'SDSC', quantite: 100 },
        { code: 'SDSC', quantite: 50 },
        { code: 'PRSC', quantite: 0 },
        { code: 'PRSC', quantite: NaN },
      ],
    });
    const sdsc = a.find((i) => i.code === 'SDSC' && i.type === 'paiement')!;
    expect(sdsc.totalIndicatif).toBe(13800);
    const prsc = a.filter((i) => i.code === 'PRSC');
    expect(prsc).toHaveLength(2);
    expect(prsc.every((i) => i.mienne === false)).toBe(true);
  });

  it('montant non fini : ignoré', () => {
    const a = construireAgenda({
      ...base,
      dividendes: [
        div({ code: 'NANN', montant: NaN, payment_date: '2026-10-20' }),
        div({ code: 'INFF', montant: Infinity, payment_date: '2026-10-20' }),
      ],
    });
    const codes = a.map((i) => i.code);
    expect(codes).not.toContain('NANN');
    expect(codes).not.toContain('INFF');
  });

  it('doublon de sources : une seule échéance, l officielle gagne', () => {
    const a = construireAgenda({
      ...base,
      dividendes: [
        div({ code: 'SGBC', montant: 2298.75, ex_date: '2026-10-20', payment_date: '2026-10-25', source: 'richbourse' }),
        div({ code: 'SGBC', montant: 2298.75, ex_date: '2026-10-20', payment_date: '2026-10-25', source: 'brvm-boc' }),
      ],
    });
    const paiements = a.filter((i) => i.code === 'SGBC' && i.type === 'paiement');
    expect(paiements).toHaveLength(1);
    expect(paiements[0]!.statut).toBe('officiel');
    expect(paiements[0]!.source).toBe('brvm-boc');
    expect(a.filter((i) => i.code === 'SGBC' && i.type === 'detachement')).toHaveLength(1);
  });

  it('bornes de la fenêtre', () => {
    const a = construireAgenda({
      ...base,
      dividendes: [
        div({ code: 'AAAA', payment_date: '2026-10-14' }),
        div({ code: 'BBBB', payment_date: '2026-11-13' }),
        div({ code: 'CCCC', payment_date: '2026-11-14' }),
      ],
    });
    const codes = a.map((i) => i.code);
    expect(codes).toContain('AAAA');
    expect(codes).toContain('BBBB');
    expect(codes).not.toContain('CCCC');
  });

  it('acompte et solde le même jour : deux paiements distincts', () => {
    const a = construireAgenda({
      ...base,
      dividendes: [
        div({ code: 'AAAA', montant: 100, payment_date: '2026-10-20' }),
        div({ code: 'AAAA', montant: 250, payment_date: '2026-10-20' }),
      ],
    });
    expect(a.filter((i) => i.code === 'AAAA' && i.type === 'paiement')).toHaveLength(2);
  });

  it('doublons arrondis au franc : un seul, officiel, montant exact', () => {
    const a = construireAgenda({
      ...base,
      dividendes: [
        div({ code: 'ABJC', montant: 202, payment_date: '2026-10-20', source: 'richbourse' }),
        div({ code: 'ABJC', montant: 201.52, payment_date: '2026-10-20', source: 'brvm-boc' }),
      ],
    });
    const p = a.filter((i) => i.code === 'ABJC' && i.type === 'paiement');
    expect(p).toHaveLength(1);
    expect(p[0]!.statut).toBe('officiel');
    expect(p[0]!.parAction).toBe(201.52);
  });

  it('départage déterministe à statut égal, quel que soit l ordre', () => {
    const r = div({ code: 'DDDD', montant: 100, payment_date: '2026-10-20', source: 'richbourse' });
    const s = div({ code: 'DDDD', montant: 100, payment_date: '2026-10-20', source: 'sikafinance' });
    for (const dividendes of [[s, r], [r, s]]) {
      const a = construireAgenda({ ...base, dividendes });
      const p = a.filter((i) => i.code === 'DDDD' && i.type === 'paiement');
      expect(p).toHaveLength(1);
      expect(p[0]!.source).toBe('richbourse');
    }
  });

  it('dates mal formées exclues ; aujourdhui mal formée : vide', () => {
    const a = construireAgenda({
      ...base,
      dividendes: [
        div({ code: 'EEEE', payment_date: '14/10/2026' }),
        div({ code: 'FFFF', payment_date: '2026-11-13T00:00:00' }),
      ],
    });
    const codes = a.map((i) => i.code);
    expect(codes).not.toContain('EEEE');
    expect(codes).not.toContain('FFFF');
    expect(construireAgenda({ ...base, aujourdhui: '2026-10-14T08:00:00Z' })).toEqual([]);
  });

  it('code de position en minuscules : valeur détenue', () => {
    const a = construireAgenda({ ...base, positions: [{ code: ' sdsc ', quantite: 100 }] });
    const p = a.find((i) => i.code === 'SDSC' && i.type === 'paiement')!;
    expect(p.mienne).toBe(true);
    expect(p.totalIndicatif).toBe(9200);
  });

  it('total flottant arrondi au centime', () => {
    const a = construireAgenda({
      ...base,
      dividendes: [div({ code: 'GGGG', montant: 183.92, payment_date: '2026-10-20' })],
      positions: [{ code: 'GGGG', quantite: 3 }],
    });
    expect(a.find((i) => i.code === 'GGGG')!.totalIndicatif).toBe(551.76);
  });

  it('deux AG sans code le même jour, titres différents : deux éléments', () => {
    const a = construireAgenda({
      ...base,
      assemblees: [
        { code: null, date_reunion: '2026-10-30', title: 'AG A', source: 'bdfin' },
        { code: null, date_reunion: '2026-10-30', title: 'AG B', source: 'bdfin' },
      ],
    });
    expect(a.filter((i) => i.type === 'assemblee')).toHaveLength(2);
  });

  it('bornes de la fenêtre pour détachements et assemblées', () => {
    const a = construireAgenda({
      ...base,
      dividendes: [
        div({ code: 'H1', ex_date: '2026-10-14' }),
        div({ code: 'H2', ex_date: '2026-11-13' }),
        div({ code: 'H3', ex_date: '2026-11-14' }),
      ],
      assemblees: [
        { code: 'A1', date_reunion: '2026-10-14', title: 't1', source: 'bdfin' },
        { code: 'A2', date_reunion: '2026-11-13', title: 't2', source: 'bdfin' },
        { code: 'A3', date_reunion: '2026-11-14', title: 't3', source: 'bdfin' },
      ],
    });
    const codes = a.map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['H1', 'H2', 'A1', 'A2']));
    expect(codes).not.toContain('H3');
    expect(codes).not.toContain('A3');
  });

  it('fermeture sans libellé', () => {
    const a = construireAgenda({ ...base, fermetures: [{ date: '2026-11-03', holiday_name: null, is_trading_day: false }] });
    expect(a.find((i) => i.type === 'fermeture')!.titre).toBe('Bourse fermée');
  });

  it('jour ouvré dans le calendrier : jamais une fermeture', () => {
    const a = construireAgenda({ ...base, fermetures: [{ date: '2026-11-03', holiday_name: null, is_trading_day: true }] });
    expect(a.filter((i) => i.type === 'fermeture')).toHaveLength(0);
  });

  it('assemblée : source BRVM officielle, source tierce annoncée', () => {
    const a = construireAgenda({
      ...base,
      assemblees: [
        { code: 'AAA', date_reunion: '2026-10-30', title: 'AG A', source: 'BRVM' },
        { code: 'BBB', date_reunion: '2026-10-30', title: 'AG B', source: 'richbourse' },
      ],
    });
    expect(a.find((i) => i.code === 'AAA')!.statut).toBe('officiel');
    expect(a.find((i) => i.code === 'BBB')!.statut).toBe('annonce');
  });
});
