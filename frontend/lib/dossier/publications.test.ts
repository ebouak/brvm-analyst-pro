import { describe, expect, it } from 'vitest';
import type { DatedClose } from '@/lib/eventStudy';
import { reactionsPublications } from '@/lib/reactionPublication';
import {
  familleDocument,
  historiquePublications,
  libellePublication,
  publicationsDeResultats,
  resumeReactions,
  type LigneReaction,
} from './publications';

describe('familleDocument', () => {
  it('regroupe les types stockés en cinq familles', () => {
    expect(familleDocument('bilan').cle).toBe('etats');
    expect(familleDocument('etats_financiers').cle).toBe('etats');
    expect(familleDocument('états-financiers-annuels').cle).toBe('etats');
    expect(familleDocument('rapport').cle).toBe('rapports');
    expect(familleDocument('ag').cle).toBe('ag');
    expect(familleDocument('notation').cle).toBe('notations');
    expect(familleDocument('avis').cle).toBe('communiques');
    expect(familleDocument('autre').cle).toBe('communiques');
    expect(familleDocument(null).cle).toBe('communiques');
  });
});

describe('historiquePublications', () => {
  const lignes = [
    { date_publication: '2026-10-30', type_publication: 'rapport' },
    { date_publication: '2026-10-30', type_publication: 'rapport' }, // doublon de date
    { date_publication: '2026-07-24', type_publication: 'rapport' },
    { date_publication: '2026-02-16', type_publication: 'etats_financiers' },
    { date_publication: '2023-01-10', type_publication: 'ag' }, // hors des trois ans
    { date_publication: '2024-05-02', type_publication: 'ag' },
    { date_publication: '2027-01-05', type_publication: 'rapport' }, // date future : écartée
    { date_publication: null, type_publication: 'rapport' },
  ];

  it('trois dernières années, dates distinctes, du plus récent au plus ancien, par famille', () => {
    const h = historiquePublications(lignes, '2026-11-13');
    expect(h.map((x) => x.famille.cle)).toEqual(['etats', 'rapports', 'ag']);
    expect(h.find((x) => x.famille.cle === 'rapports')!.dates).toEqual(['2026-10-30', '2026-07-24']);
    expect(h.find((x) => x.famille.cle === 'ag')!.dates).toEqual(['2024-05-02']);
  });

  it('n’affiche aucune date à venir : un historique ne prédit rien', () => {
    const h = historiquePublications(lignes, '2026-11-13');
    expect(h.flatMap((x) => x.dates).every((d) => d <= '2026-11-13')).toBe(true);
  });

  it('plafonne les dates mais garde le total', () => {
    const beaucoup = Array.from({ length: 20 }, (_, i) => ({
      date_publication: `2026-${String((i % 9) + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
      type_publication: 'autre',
    }));
    const h = historiquePublications(beaucoup, '2026-11-13', { max: 5 });
    expect(h[0]!.dates).toHaveLength(5);
    expect(h[0]!.total).toBe(20);
  });

  it('société sans publication : liste vide', () => {
    expect(historiquePublications([], '2026-11-13')).toEqual([]);
  });
});

describe('publicationsDeResultats', () => {
  const ev = (id: string, date: string, titre: string, type = 'resultats') => ({
    id, event_date: date, title: titre, event_type: type, instrument_code: 'SNTS', source_url: null,
  });

  it('une publication regroupée vaut UNE ligne ; les autres types sont ignorés ; plafond respecté', () => {
    const evts = [
      ev('1', '2026-10-30', "Rapport d'activités - 3e trimestre 2026 - SONATEL SN"),
      ev('2', '2026-02-16', 'Etats financiers 2025 et attestation des CAC - SONATEL SN'),
      ev('3', '2026-02-16', "Rapport d'activités annuel - Exercice 2025 - SONATEL SN"),
      ev('4', '2026-02-20', 'Attestation des commissaires aux comptes - Exercice 2025 - SONATEL SN'),
      ev('5', '2026-09-01', 'Convocation assemblée', 'assemblee'),
    ];
    const r = publicationsDeResultats(evts, 8);
    expect(r.map((p) => p.date)).toEqual(['2026-10-30', '2026-02-16']);
    expect(publicationsDeResultats(evts, 1)).toHaveLength(1);
  });

  it('deux pièces du même jour dont une sans période reconnaissable : une seule publication (J0 identique)', () => {
    const evts = [
      ev('a', '2026-02-16', 'Etats financiers 2025 et attestation des CAC - SONATEL SN'),
      ev('b', '2026-02-16', "Rapport d'activités annuel - Exercice 2025 - SONATEL SN"),
    ];
    expect(publicationsDeResultats(evts)).toHaveLength(1);
  });
});

describe('resumeReactions', () => {
  const l = (ecart: number | null, enCours = false): LigneReaction => ({ date: '2026-01-01', titre: 't', periode: null, ecartIndicePct: ecart, enCours });

  it('moins de trois mesures closes : pas de médiane', () => {
    const r = resumeReactions([l(1), l(2)]);
    expect(r.mediane).toBeNull();
    expect(r.nMesurees).toBe(2);
  });

  it('médiane des seules réactions mesurées ET closes', () => {
    const r = resumeReactions([l(5), l(-3), l(1), l(99, true), l(null)]);
    expect(r.mediane).toBe(1);
    expect(r.nMesurees).toBe(3);
    expect(r.nEnCours).toBe(1);
    expect(r.nNonMesurables).toBe(1);
  });

  it('nombre pair de mesures : moyenne des deux valeurs centrales', () => {
    expect(resumeReactions([l(1), l(2), l(3), l(10)]).mediane).toBe(2.5);
  });

  it('même médiane que le contrat commun (reactionsPublications) sur les mêmes cours', () => {
    const seances = (f: (i: number) => number): DatedClose[] => {
      const out: DatedClose[] = [];
      let t = Date.parse('2026-01-05T12:00:00Z');
      while (out.length < 80) {
        const d = new Date(t);
        if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) out.push({ date: d.toISOString().slice(0, 10), close: f(out.length) });
        t += 86_400_000;
      }
      return out;
    };
    const titre = seances((i) => 100 + i * 0.7 + (i % 7));
    const indice = seances((i) => 400 + i * 0.2);
    const dates = [titre[5]!.date, titre[20]!.date, titre[35]!.date, titre[50]!.date, titre[78]!.date];
    const contrat = reactionsPublications(titre, indice, dates);
    const mien = resumeReactions(contrat.lignes.map((x) => ({ date: x.date, titre: 't', periode: null, ecartIndicePct: x.ecartIndicePct, enCours: x.enCours })));
    expect(mien.mediane).toBe(contrat.mediane);
    expect(mien.nMesurees).toBe(contrat.nMesurees);
  });
});

describe('libellePublication', () => {
  it('met la période en clair, avec les accords (1er, 3e)', () => {
    expect(libellePublication('T1-2026', 'x')).toBe('1er trimestre 2026');
    expect(libellePublication('T3-2026', 'x')).toBe('3e trimestre 2026');
    expect(libellePublication('S1-2025', 'x')).toBe('1er semestre 2025');
    expect(libellePublication('9M-2026', 'x')).toBe('9 premiers mois 2026');
    expect(libellePublication('A-2025', 'x')).toBe('Exercice 2025');
  });
  it('sans période : le titre, privé du suffixe société et abrégé', () => {
    expect(libellePublication(null, 'Etats financiers 2025 et attestation des CAC - SONATEL SN')).toBe('Etats financiers 2025 et attestation des CAC');
    const long = libellePublication(null, 'x'.repeat(100), 20);
    expect(long.length).toBe(20);
    expect(long.endsWith('…')).toBe(true);
  });
});
