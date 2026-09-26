import { describe, expect, it } from 'vitest';
import { phraseEvenement, selectionnerEvenements, type EvenementMarche, type MesureEvenement } from './evenements';

const E = (o: Partial<EvenementMarche> = {}): EvenementMarche => ({
  event_date: '2026-06-01', event_type: 'resultats', title: 'États financiers certifiés', ...o,
});

const M = (o: Partial<MesureEvenement> = {}): MesureEvenement => ({
  evenement: E(), surperformancePct: null, volumeRatio: null, fenetreComplete: true, ...o,
});

describe('selectionnerEvenements', () => {
  it('fait passer un résultat ANCIEN avant une assemblée RÉCENTE (la priorité de type prime sur la date)', () => {
    const resultatAncien = E({ event_date: '2026-01-05', event_type: 'resultats', title: 'Résultats annuels' });
    const assembleeRecente = E({ event_date: '2026-09-20', event_type: 'assemblee', title: 'AGO 2026' });
    const out = selectionnerEvenements([assembleeRecente, resultatAncien], '2026-09-24');
    expect(out).toEqual([resultatAncien, assembleeRecente]);
  });

  it('exclut les événements dont la date est strictement postérieure à aujourd’hui', () => {
    const futur = E({ event_date: '2026-12-25', title: 'Futur' });
    const passe = E({ event_date: '2026-01-01', title: 'Passé' });
    expect(selectionnerEvenements([futur, passe], '2026-09-24')).toEqual([passe]);
  });

  it('inclut un événement daté du jour même (pas « strictement » postérieur)', () => {
    const duJour = E({ event_date: '2026-09-24' });
    expect(selectionnerEvenements([duJour], '2026-09-24')).toEqual([duJour]);
  });

  it('plafonne à 3 par défaut', () => {
    const evts = Array.from({ length: 8 }, (_, i) => E({ event_date: `2026-01-${String(i + 1).padStart(2, '0')}` }));
    expect(selectionnerEvenements(evts, '2026-09-24')).toHaveLength(3);
  });

  it('respecte un plafond explicite', () => {
    const evts = Array.from({ length: 5 }, (_, i) => E({ event_date: `2026-01-${String(i + 1).padStart(2, '0')}` }));
    expect(selectionnerEvenements(evts, '2026-09-24', 2)).toHaveLength(2);
  });

  it('rend un tableau vide sur une liste vide', () => {
    expect(selectionnerEvenements([], '2026-09-24')).toEqual([]);
  });

  it('trie par date décroissante à priorité de type égale', () => {
    const ancien = E({ event_date: '2026-01-01', event_type: 'autre', title: 'Ancien' });
    const recent = E({ event_date: '2026-06-01', event_type: 'autre', title: 'Récent' });
    expect(selectionnerEvenements([ancien, recent], '2026-09-24')).toEqual([recent, ancien]);
  });

  it('relègue un type inconnu ou `null` au même rang que « autre », avant « assemblee »', () => {
    const inconnu = E({ event_date: '2026-01-01', event_type: 'mystere' });
    const nul = E({ event_date: '2026-01-02', event_type: null });
    const autre = E({ event_date: '2026-01-03', event_type: 'autre' });
    const assemblee = E({ event_date: '2026-01-04', event_type: 'assemblee' });
    const out = selectionnerEvenements([assemblee, inconnu, nul, autre], '2026-09-24', 4);
    // Les trois premiers partagent le rang 2 (« autre ») : triés par date décroissante entre eux.
    expect(out.slice(0, 3)).toEqual([autre, nul, inconnu]);
    expect(out[3]).toEqual(assemblee);
  });

  it('ne mute pas le tableau reçu en entrée', () => {
    const evts = [E({ event_date: '2026-01-01' }), E({ event_date: '2026-06-01' })];
    const copie = [...evts];
    selectionnerEvenements(evts, '2026-09-24');
    expect(evts).toEqual(copie);
  });
});

describe('phraseEvenement — le fait', () => {
  it('donne la date en toutes lettres et le titre du document', () => {
    const { fait } = phraseEvenement(M({ evenement: E({ event_date: '2026-09-17', title: 'États financiers certifiés' }) }));
    expect(fait).toBe('17 septembre 2026 — États financiers certifiés.');
  });
});

describe('phraseEvenement — la portée', () => {
  it('fenêtre incomplète : le dit, et ne contient AUCUN signe « % »', () => {
    const { portee } = phraseEvenement(M({ fenetreComplete: false, surperformancePct: 3.2, volumeRatio: 2 }));
    expect(portee).toContain("n'est pas encore complète");
    expect(portee).not.toContain('%');
  });

  it('fenêtre complète mais mesure nulle : PAS de portée — on liste sans inventer', () => {
    const { portee } = phraseEvenement(M({ fenetreComplete: true, surperformancePct: null, volumeRatio: 3 }));
    expect(portee).toBeUndefined();
  });

  it('surperformance positive : « de mieux »', () => {
    const { portee } = phraseEvenement(M({ fenetreComplete: true, surperformancePct: 4.5 }));
    expect(portee).toContain('4,50 %');
    expect(portee).toContain('de mieux');
    expect(portee).not.toContain('de moins bien');
  });

  it('surperformance NÉGATIVE : « de moins bien », jamais un signe mal placé', () => {
    const { portee } = phraseEvenement(M({ fenetreComplete: true, surperformancePct: -2.1 }));
    expect(portee).toContain('2,10 %');
    expect(portee).toContain('de moins bien');
    expect(portee).not.toContain('-2,10');
    expect(portee).not.toContain('−2,10');
  });

  it('ajoute le volume quand il est mesurable', () => {
    const { portee } = phraseEvenement(M({ fenetreComplete: true, surperformancePct: 1.5, volumeRatio: 2.3 }));
    expect(portee).toContain('2,3 fois');
    expect(portee).toContain("l'ordinaire");
  });

  it('omet le volume quand il n’est pas mesurable', () => {
    const { portee } = phraseEvenement(M({ fenetreComplete: true, surperformancePct: 1.5, volumeRatio: null }));
    expect(portee).not.toContain('fois');
  });

  it('reprend la formulation imposée « dans les 5 séances qui ont suivi », comparée au BRVM Composite', () => {
    const { portee } = phraseEvenement(M({ fenetreComplete: true, surperformancePct: 1 }));
    expect(portee).toContain('Dans les 5 séances qui ont suivi');
    expect(portee).toContain('BRVM Composite');
  });
});

describe('phraseEvenement — les interdits du module tiennent', () => {
  // Le cas construit pour tenter le module : un avertissement sur résultats
  // suivi d'une forte baisse et de volumes nourris — la tentation causale
  // maximale, et pourtant rien n'a le droit d'affirmer un lien.
  const avertissementSuiviDuneBaisse = () => phraseEvenement(M({
    evenement: E({ event_date: '2026-03-10', event_type: 'resultats', title: 'Avertissement sur résultats' }),
    fenetreComplete: true,
    surperformancePct: -12.4,
    volumeRatio: 3.8,
  }));

  it("n'emploie AUCUN verbe de causalité", () => {
    const { fait, portee } = avertissementSuiviDuneBaisse();
    const t = `${fait} ${portee ?? ''}`.toLowerCase();
    for (const interdit of [
      'parce que', 'en raison de', 'à cause de', 'explique la baisse', 'provoqué',
      'entraîne', 'sous l’effet', 'a fait chuter', 'a fait baisser', 'suite à',
    ]) {
      expect(t).not.toContain(interdit);
    }
  });

  it('ne recommande RIEN', () => {
    const { fait, portee } = avertissementSuiviDuneBaisse();
    const t = `${fait} ${portee ?? ''}`.toLowerCase();
    for (const interdit of ['opportunité', 'à acheter', 'à vendre', 'à surveiller', 'conseill', 'profiter', 'bon moment', 'devrait']) {
      expect(t).not.toContain(interdit);
    }
  });
});

describe('défauts relevés sur les données réelles du 2026-09-24', () => {
  const ev = (event_date: string, title: string, event_type: string | null = 'resultats') =>
    ({ event_date, title, event_type });

  it('ne garde QU’UNE entrée par séance : deux dépôts le même jour, une seule mesure', () => {
    // ETIT a deux documents au 29 juillet 2026, SNTS deux au 17 septembre :
    // la fenêtre partant de la même date, la mesure était répétée à l'identique.
    const retenus = selectionnerEvenements([
      ev('2026-07-29', "Rapport d'activités - 1er semestre 2026 - ETI TG"),
      ev('2026-07-29', 'Rapport d’examen limité - 1er semestre 2026 - ETI TG'),
      ev('2026-04-29', "Rapport d'activités - 1er trimestre 2026 - ETI TG"),
    ], '2026-09-24');
    expect(retenus).toHaveLength(2);
    expect(new Set(retenus.map((e) => e.event_date)).size).toBe(2);
  });

  it('garde l’événement le PLUS PRIORITAIRE quand deux partagent la séance', () => {
    const retenus = selectionnerEvenements([
      ev('2026-07-29', 'Avis de convocation', 'assemblee'),
      ev('2026-07-29', 'Rapport d’activités', 'resultats'),
    ], '2026-09-24');
    expect(retenus).toHaveLength(1);
    expect(retenus[0]!.event_type).toBe('resultats');
  });

  it('REFUSE d’annoncer une direction sur un écart d’un centième de point', () => {
    // PALC affichait « 0,00 % de mieux », ETIT « 0,01 % de moins bien » :
    // du bruit habillé en constat.
    for (const ecart of [0, 0.004, -0.01, 0.09]) {
      const { portee } = phraseEvenement({
        evenement: ev('2026-04-29', 'Rapport trimestriel'),
        surperformancePct: ecart, volumeRatio: null, fenetreComplete: true,
      });
      expect(portee).toContain("ne s'est pas écarté du BRVM Composite");
      expect(portee).not.toContain('de mieux');
      expect(portee).not.toContain('de moins bien');
      expect(portee).not.toMatch(/\d+,\d+ %/);
    }
  });

  it('énonce bien la direction dès que l’écart est réel', () => {
    const { portee } = phraseEvenement({
      evenement: ev('2026-03-23', 'États financiers'),
      surperformancePct: -14.36, volumeRatio: 0.8, fenetreComplete: true,
    });
    expect(portee).toContain('de moins bien');
    expect(portee).toContain('14,36 %');
    expect(portee).toContain("0,8 fois l'ordinaire");
  });
});
