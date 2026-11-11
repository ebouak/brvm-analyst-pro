import { describe, expect, it } from 'vitest';
import { agAVenir, agDeLaSociete, dernierBulletin, heureCourte, titreAg, versAgenda, versCalendrier, type BocAssemblee } from './assemblees';

const ag = (p: Partial<BocAssemblee>): BocAssemblee => ({
  code: 'SNTS', societe: 'SONATEL', nature: 'Ordinaire', nature_cle: 'ordinaire',
  date_ag: '2026-12-01', heure: '10:00:00', lieu: 'Dakar',
  premier_bulletin: '2026-09-22', dernier_bulletin: '2026-11-10', ...p,
});

describe('AG du Bulletin officiel', () => {
  it('heure courte', () => {
    expect(heureCourte('15:00:00')).toBe('15 h');
    expect(heureCourte('09:30:00')).toBe('9 h 30');
    expect(heureCourte(null)).toBeNull();
    expect(heureCourte('n/d')).toBeNull();
  });

  it('titre selon la nature', () => {
    expect(titreAg({ nature_cle: 'extraordinaire' })).toBe('Assemblée générale extraordinaire');
    expect(titreAg({ nature_cle: 'autre' })).toBe('Assemblée générale');
  });

  it('dernier bulletin lu', () => {
    expect(dernierBulletin([ag({ dernier_bulletin: '2026-11-07' }), ag({})])).toBe('2026-11-10');
    expect(dernierBulletin([])).toBeNull();
  });

  it('n’annonce pas une AG retirée du dernier bulletin (reportée ou annulée)', () => {
    const rows = [
      ag({ date_ag: '2026-12-03' }),
      ag({ date_ag: '2026-11-20', dernier_bulletin: '2026-11-05' }), // disparue du calendrier
      ag({ date_ag: '2026-11-01' }), // passée
    ];
    expect(agAVenir(rows, '2026-11-11', '2026-11-10').map((r) => r.date_ag)).toEqual(['2026-12-03']);
    expect(agAVenir(rows, '2026-11-11', null)).toEqual([]);
  });

  it('pour l’agenda : date de RÉUNION, source officielle, heure dans le titre', () => {
    expect(versAgenda(ag({ nature_cle: 'extraordinaire', heure: '15:00:00' }))).toEqual({
      code: 'SNTS', date_reunion: '2026-12-01', title: 'Assemblée générale extraordinaire SNTS à 15 h', source: 'brvm-boc',
    });
    expect(versAgenda(ag({ code: null, societe: 'NOUVELLE SA', heure: null })).title).toBe('Assemblée générale ordinaire NOUVELLE SA');
  });

  it('fiche société : à venir, puis passées de la plus récente à la plus ancienne', () => {
    const r = agDeLaSociete(
      [ag({ date_ag: '2026-04-16' }), ag({ date_ag: '2026-12-08' }), ag({ date_ag: '2025-04-10', dernier_bulletin: '2025-12-31' })],
      '2026-11-11', '2026-11-10',
    );
    expect(r.aVenir.map((a) => a.date_ag)).toEqual(['2026-12-08']);
    expect(r.passees.map((a) => a.date_ag)).toEqual(['2026-04-16', '2025-04-10']);
  });
});

describe('AG dans le calendrier', () => {
  it('reprend la date de réunion, l’heure, le lieu, et le nom du référentiel', () => {
    const it = versCalendrier(ag({ heure: '09:30:00' }), { SNTS: { designation: 'SONATEL SENEGAL', secteur: 'Télécoms', pays: 'SN' } });
    expect(it).toMatchObject({
      date: '2026-12-01', kind: 'AG', code: 'SNTS', societe: 'SONATEL SENEGAL', secteur: 'Télécoms',
      detail: 'Assemblée générale ordinaire à 9 h 30 · Dakar', href: '/societes/SNTS',
    });
    expect(versCalendrier(ag({ code: null, societe: 'NOUVELLE SA' }), {})).toMatchObject({ societe: 'NOUVELLE SA', href: undefined });
  });
});
