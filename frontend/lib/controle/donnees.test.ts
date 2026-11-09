import { describe, expect, it } from 'vitest';
import { evaluerDonnees, type DonneesFraicheur } from './donnees';
import type { Signal } from './types';

// Repères : 2026-10-29 jeudi, 10-30 vendredi, 10-31 samedi, 11-01 dimanche,
// 11-02 lundi, 11-03 mardi.
const t = (iso: string) => new Date(iso);

/** Tout est frais un mardi soir, après toutes les heures de disponibilité. */
function frais(sur: Partial<DonneesFraicheur> = {}): DonneesFraicheur {
  return {
    coursCloture: '2026-11-03',
    indices: '2026-11-03',
    collecteIntraday: '2026-11-03T15:50:00Z',
    signaux: '2026-11-03',
    liquidite: '2026-11-03',
    conseiller: '2026-11-03',
    carnet: '2026-11-03',
    video: '2026-11-03',
    calendrierDividendes: { lignes: 34, exercice: 2025, dateDocument: '2026-10-09' },
    testsE2e: '2026-11-03T03:40:00Z',
    feries: [],
    consolidationCloture: '2026-11-03T16:20:00Z',
    ...sur,
  };
}
const SOIR = t('2026-11-03T21:00:00Z');

describe('dates postérieures à la séance attendue (relecture du 2026-11-03)', () => {
  const MARDI_MIDI = t('2026-11-03T12:00:00Z'); // séance attendue : lundi 2 nov.

  it('ligne du jour en séance : à jour, mais déclarée PROVISOIRE (intrajournalière)', () => {
    const x = sig(evaluerDonnees(frais({ coursCloture: '2026-11-03' }), MARDI_MIDI), 'donnees:cours');
    expect(x.niveau).toBe('ok');
    expect(x.detail).toMatch(/provisoire/);
  });

  it('date postérieure qui n’est pas aujourd’hui : anomalie à vérifier, jamais « à jour »', () => {
    const x = sig(evaluerDonnees(frais({ indices: '2026-11-05' }), MARDI_MIDI), 'donnees:indices');
    expect(x.niveau).toBe('attention');
    expect(x.detail).toMatch(/postérieure/);
  });

  it('chaque flux nomme son horodatage et propose ses actions', () => {
    const s = evaluerDonnees(frais(), SOIR);
    expect(sig(s, 'donnees:cours').reperes?.[0]).toMatchObject({ libelle: 'Dernière séance en base', nature: 'periode' });
    expect(sig(s, 'donnees:tests-e2e').actions?.[0].href).toBe('/admin/qualite');
  });

  it('calendrier des dividendes : preuve PARTIELLE (dernier passage non mesurable)', () => {
    expect(sig(evaluerDonnees(frais(), SOIR), 'donnees:dividendes-calendrier').preuve).toBe('partielle');
  });
});

describe('clôture consolidée (preuve par la commande daily, pas par la ligne intraday)', () => {
  const MERCREDI_MIDI = t('2026-11-04T12:00:00Z');

  it('consolidation de la séance attendue : ok', () => {
    expect(sig(evaluerDonnees(frais(), MERCREDI_MIDI), 'donnees:cloture').niveau).toBe('ok');
  });

  it('run retardé par GitHub après minuit : compte pour la séance de la veille', () => {
    const s = evaluerDonnees(frais({ consolidationCloture: '2026-11-04T00:10:00Z' }), MERCREDI_MIDI);
    expect(sig(s, 'donnees:cloture').niveau).toBe('ok');
  });

  it('ligne du jour présente (intraday) mais consolidation de la veille seulement : attention', () => {
    const s = evaluerDonnees(frais({ consolidationCloture: '2026-11-02T23:39:00Z' }), MERCREDI_MIDI);
    const x = sig(s, 'donnees:cloture');
    expect(x.niveau).toBe('attention');
    expect(x.detail).toMatch(/consolidation/i);
  });

  it('deux séances sans consolidation : alerte', () => {
    const s = evaluerDonnees(frais({ consolidationCloture: '2026-10-30T16:20:00Z' }), MERCREDI_MIDI);
    expect(sig(s, 'donnees:cloture').niveau).toBe('alerte');
  });

  it('le passage du matin (09:15) ne prouve pas la clôture du jour', () => {
    const s = evaluerDonnees(frais({ consolidationCloture: '2026-11-03T09:20:00Z' }), MERCREDI_MIDI);
    expect(sig(s, 'donnees:cloture').niveau).not.toBe('ok');
  });

  it('jamais de consolidation connue : alerte', () => {
    expect(sig(evaluerDonnees(frais({ consolidationCloture: null }), MERCREDI_MIDI), 'donnees:cloture').niveau).toBe('alerte');
  });

  it('le soir même, avant 23:30 UTC, la consolidation retardée par GitHub n’est pas encore exigée', () => {
    const s = evaluerDonnees(frais({ consolidationCloture: '2026-11-02T23:39:00Z' }), t('2026-11-03T21:00:00Z'));
    expect(sig(s, 'donnees:cloture').niveau).toBe('ok');
  });
});

function sig(s: Signal[], id: string): Signal {
  const x = s.find((v) => v.id === id);
  if (!x) throw new Error(`signal ${id} absent`);
  return x;
}

describe('evaluerDonnees — ensemble', () => {
  it('un signal par flux, tous du domaine données, tous ok quand tout est frais', () => {
    const s = evaluerDonnees(frais(), SOIR);
    expect(s.map((x) => x.id).sort()).toEqual(
      [
        'donnees:carnet',
        'donnees:cloture',
        'donnees:conseiller',
        'donnees:cours',
        'donnees:dividendes-calendrier',
        'donnees:indices',
        'donnees:intraday',
        'donnees:liquidite',
        'donnees:signaux',
        'donnees:tests-e2e',
        'donnees:video',
      ].sort(),
    );
    expect(s.every((x) => x.domaine === 'donnees')).toBe(true);
    expect(s.filter((x) => x.niveau !== 'ok').map((x) => `${x.id}: ${x.detail}`)).toEqual([]);
  });

  it('aucune phrase ne double le point d’une abréviation de mois (« nov.. »)', () => {
    const cas = [frais(), frais({ coursCloture: null, video: null, carnet: '2026-10-29' })];
    for (const d of cas) for (const x of evaluerDonnees(d, SOIR)) expect(x.detail, x.id).not.toContain('..');
  });

  it('flux sans aucune donnée → alerte « aucune donnée »', () => {
    const s = evaluerDonnees(
      frais({ coursCloture: null, indices: null, signaux: null, liquidite: null, carnet: null, testsE2e: null }),
      SOIR,
    );
    for (const id of ['cours', 'indices', 'signaux', 'liquidite', 'carnet', 'tests-e2e']) {
      const x = sig(s, `donnees:${id}`);
      expect(x.niveau, id).toBe('alerte');
      expect(x.detail.toLowerCase(), id).toContain('aucune donnée');
      expect(x.dernierSucces ?? null, id).toBeNull();
    }
  });
});

describe('cours de clôture (séances)', () => {
  it('week-end : la donnée du vendredi suffit', () => {
    const s = evaluerDonnees(frais({ coursCloture: '2026-10-30' }), t('2026-11-01T12:00:00Z'));
    expect(sig(s, 'donnees:cours').niveau).toBe('ok');
  });

  it('lundi matin avant disponibilité : vendredi attendu, ok', () => {
    const s = evaluerDonnees(frais({ coursCloture: '2026-10-30' }), t('2026-11-02T08:00:00Z'));
    const c = sig(s, 'donnees:cours');
    expect(c.niveau).toBe('ok');
    expect(c.detail).toContain('vendredi 30 oct.');
    expect(c.dernierSucces).toBe('2026-10-30');
  });

  it('une séance de retard → attention, avec le détail factuel', () => {
    const c = sig(evaluerDonnees(frais({ coursCloture: '2026-11-02' }), SOIR), 'donnees:cours');
    expect(c.niveau).toBe('attention');
    expect(c.detail).toContain('dernière séance en base : lundi 2 nov.');
    expect(c.detail).toContain('attendue : mardi 3 nov.');
  });

  it('deux séances de retard (week-end exclu) → alerte', () => {
    const c = sig(evaluerDonnees(frais({ coursCloture: '2026-10-30' }), SOIR), 'donnees:cours');
    expect(c.niveau).toBe('alerte');
    expect(c.detail).toContain('2 séances');
  });

  it('un jour férié connu n’est pas un retard', () => {
    const c = sig(evaluerDonnees(frais({ coursCloture: '2026-11-02', feries: ['2026-11-03'] }), SOIR), 'donnees:cours');
    expect(c.niveau).toBe('ok');
  });

  it('la même règle vaut pour indices, signaux et liquidité', () => {
    const s = evaluerDonnees(frais({ indices: '2026-11-02', signaux: '2026-10-30', liquidite: '2026-11-02' }), SOIR);
    expect(sig(s, 'donnees:indices').niveau).toBe('attention');
    expect(sig(s, 'donnees:signaux').niveau).toBe('alerte');
    expect(sig(s, 'donnees:liquidite').niveau).toBe('attention');
  });
});

describe('positions du Conseiller', () => {
  it('une date en retard de 2 séances donne une alerte', () => {
    const s = evaluerDonnees(frais({ conseiller: '2026-10-30' }), SOIR);
    expect(sig(s, 'donnees:conseiller').niveau).toBe('alerte');
  });
  it('à jour → ok ; sans donnée → alerte', () => {
    expect(sig(evaluerDonnees(frais(), SOIR), 'donnees:conseiller').niveau).toBe('ok');
    expect(sig(evaluerDonnees(frais({ conseiller: null }), SOIR), 'donnees:conseiller').niveau).toBe('alerte');
  });
});

describe('cours en séance (intraday)', () => {
  const MIDI = t('2026-11-03T11:00:00Z');

  it('pendant la séance, collecte récente → ok', () => {
    expect(sig(evaluerDonnees(frais({ collecteIntraday: '2026-11-03T10:30:00Z' }), MIDI), 'donnees:intraday').niveau).toBe('ok');
  });

  it('pendant la séance, plus de 45 min → attention', () => {
    const x = sig(evaluerDonnees(frais({ collecteIntraday: '2026-11-03T10:00:00Z' }), MIDI), 'donnees:intraday');
    expect(x.niveau).toBe('attention');
    expect(x.detail).toContain('60 min');
  });

  it('pendant la séance, plus de 2 h → alerte', () => {
    expect(sig(evaluerDonnees(frais({ collecteIntraday: '2026-11-03T08:30:00Z' }), MIDI), 'donnees:intraday').niveau).toBe('alerte');
  });

  it('pendant la séance, aucune collecte connue → alerte', () => {
    const x = sig(evaluerDonnees(frais({ collecteIntraday: null }), MIDI), 'donnees:intraday');
    expect(x.niveau).toBe('alerte');
    expect(x.detail.toLowerCase()).toContain('aucune donnée');
  });

  it('hors séance (soir) → ok, avec l’heure de la dernière collecte', () => {
    const x = sig(evaluerDonnees(frais({ collecteIntraday: '2026-11-03T15:50:00Z' }), SOIR), 'donnees:intraday');
    expect(x.niveau).toBe('ok');
    expect(x.detail).toContain('15:50 UTC');
    expect(x.dernierSucces).toBe('2026-11-03T15:50:00Z');
  });

  it('hors séance (matin avant ouverture) : la collecte de la veille suffit', () => {
    expect(
      sig(evaluerDonnees(frais({ collecteIntraday: '2026-11-02T15:50:00Z' }), t('2026-11-03T08:00:00Z')), 'donnees:intraday').niveau,
    ).toBe('ok');
  });

  it('hors séance, mais aucune collecte pendant la dernière séance → attention', () => {
    expect(sig(evaluerDonnees(frais({ collecteIntraday: '2026-11-02T15:50:00Z' }), SOIR), 'donnees:intraday').niveau).toBe(
      'attention',
    );
  });

  it('jour férié connu, en pleine journée → ok', () => {
    const x = sig(
      evaluerDonnees(frais({ collecteIntraday: '2026-11-02T15:50:00Z', feries: ['2026-11-03'] }), MIDI),
      'donnees:intraday',
    );
    expect(x.niveau).toBe('ok');
    expect(x.detail.toLowerCase()).toContain('férié');
  });
});

describe('carnet d’ordres (tolérance : le bulletin paraît parfois le lendemain)', () => {
  it('une séance de retard → ok', () => {
    expect(sig(evaluerDonnees(frais({ carnet: '2026-11-02' }), SOIR), 'donnees:carnet').niveau).toBe('ok');
  });
  it('deux séances de retard → attention', () => {
    expect(sig(evaluerDonnees(frais({ carnet: '2026-10-30' }), SOIR), 'donnees:carnet').niveau).toBe('attention');
  });
  it('trois séances de retard → alerte', () => {
    expect(sig(evaluerDonnees(frais({ carnet: '2026-10-29' }), SOIR), 'donnees:carnet').niveau).toBe('alerte');
  });
});

describe('vidéo de séance', () => {
  it('vidéo absente → attention', () => {
    const v = sig(evaluerDonnees(frais({ video: null }), SOIR), 'donnees:video');
    expect(v.niveau).toBe('attention');
    expect(v.detail.toLowerCase()).toContain('aucune vidéo');
  });

  it('une séance de retard sur la base → attention', () => {
    expect(sig(evaluerDonnees(frais({ video: '2026-11-02' }), SOIR), 'donnees:video').niveau).toBe('attention');
  });

  it('deux séances de retard → alerte', () => {
    expect(sig(evaluerDonnees(frais({ video: '2026-10-30' }), SOIR), 'donnees:video').niveau).toBe('alerte');
  });

  it('en pleine séance, la ligne du jour (intraday) n’exige pas déjà la vidéo du jour', () => {
    const v = sig(evaluerDonnees(frais({ video: '2026-11-02' }), t('2026-11-03T11:00:00Z')), 'donnees:video');
    expect(v.niveau).toBe('ok');
  });

  it('si la base elle-même est en retard, la vidéo est jugée contre la base', () => {
    const v = sig(evaluerDonnees(frais({ coursCloture: '2026-11-02', video: '2026-11-02' }), SOIR), 'donnees:video');
    expect(v.niveau).toBe('ok');
  });
});

describe('calendrier officiel des dividendes', () => {
  it('aucune ligne → alerte « aucune donnée »', () => {
    const c = sig(
      evaluerDonnees(frais({ calendrierDividendes: { lignes: 0, exercice: null, dateDocument: null } }), SOIR),
      'donnees:dividendes-calendrier',
    );
    expect(c.niveau).toBe('alerte');
    expect(c.detail.toLowerCase()).toContain('aucune donnée');
  });

  it('moins de 20 lignes datées (seuil de verify-data) → attention', () => {
    const c = sig(
      evaluerDonnees(frais({ calendrierDividendes: { lignes: 12, exercice: 2025, dateDocument: '2026-10-09' } }), SOIR),
      'donnees:dividendes-calendrier',
    );
    expect(c.niveau).toBe('attention');
  });

  it('assez de lignes → ok, avec la date du document source', () => {
    const c = sig(evaluerDonnees(frais(), SOIR), 'donnees:dividendes-calendrier');
    expect(c.niveau).toBe('ok');
    expect(c.detail).toContain('34');
    expect(c.detail).toContain('9 oct.');
    expect(c.dernierSucces).toBe('2026-10-09');
  });
});

describe('tests de bout en bout (nocturne 03:00 UTC)', () => {
  const fin = '2026-11-03T03:40:00Z';
  it('moins de 30 h → ok', () => {
    expect(sig(evaluerDonnees(frais({ testsE2e: fin }), t('2026-11-04T09:00:00Z')), 'donnees:tests-e2e').niveau).toBe('ok');
  });
  it('plus de 30 h → attention', () => {
    expect(sig(evaluerDonnees(frais({ testsE2e: fin }), t('2026-11-04T10:00:00Z')), 'donnees:tests-e2e').niveau).toBe('attention');
  });
  it('plus de 72 h → alerte', () => {
    expect(sig(evaluerDonnees(frais({ testsE2e: fin }), t('2026-11-06T04:00:00Z')), 'donnees:tests-e2e').niveau).toBe('alerte');
  });
});
