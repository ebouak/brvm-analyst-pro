import { describe, expect, it } from 'vitest';
import { intervalleMaxAttenduMs } from './cron';

const MIN = 60_000;
const H = 60 * MIN;
const J = 24 * H;
// Mardi 3 novembre 2026, 12:00 UTC.
const MAINTENANT = new Date('2026-11-03T12:00:00Z');

describe('intervalleMaxAttenduMs', () => {
  it('toutes les 15 minutes → 15 min', () => {
    expect(intervalleMaxAttenduMs(['*/15 * * * *'], MAINTENANT)).toBe(15 * MIN);
  });

  it('chaque nuit → 24 h', () => {
    expect(intervalleMaxAttenduMs(['0 3 * * *'], MAINTENANT)).toBe(J);
  });

  it('lundi-vendredi → 72 h (vendredi → lundi)', () => {
    expect(intervalleMaxAttenduMs(['0 18 * * 1-5'], MAINTENANT)).toBe(3 * J);
  });

  it('hebdomadaire → 7 j', () => {
    expect(intervalleMaxAttenduMs(['0 9 * * 6'], MAINTENANT)).toBe(7 * J);
  });

  it('plusieurs crons → écart maximal de la réunion des déclenchements', () => {
    // 07:30 en semaine + 19:00 en semaine : le plus long trou va du vendredi 19:00
    // au lundi 07:30, soit 60 h 30.
    expect(intervalleMaxAttenduMs(['0 19 * * 1-5', '30 7 * * 1-5'], MAINTENANT)).toBe(60 * H + 30 * MIN);
  });

  it('les doublons entre crons ne créent pas d’écart nul trompeur', () => {
    expect(intervalleMaxAttenduMs(['0 3 * * *', '0 3 * * *'], MAINTENANT)).toBe(J);
  });

  it('listes et plages : séance BRVM, 4 fois par heure de 9 h à 15 h en semaine', () => {
    // Dernier tir vendredi 15:55, premier lundi 09:10 → 65 h 15.
    expect(intervalleMaxAttenduMs(['10,25,40,55 9-15 * * 1-5'], MAINTENANT)).toBe(65 * H + 15 * MIN);
  });

  it('plage d’heures : 06-22 chaque jour → 8 h de nuit', () => {
    expect(intervalleMaxAttenduMs(['0 6-22 * * *'], MAINTENANT)).toBe(8 * H);
  });

  it('pas sur une plage (a-b/n)', () => {
    // 0-30/10 → 0, 10, 20, 30 ; trou de 30 à 60 = 30 min.
    expect(intervalleMaxAttenduMs(['0-30/10 * * * *'], MAINTENANT)).toBe(30 * MIN);
  });

  it('pas à partir d’une valeur (a/n)', () => {
    // 5/20 → 5, 25, 45 ; écarts de 20 min.
    expect(intervalleMaxAttenduMs(['5/20 * * * *'], MAINTENANT)).toBe(20 * MIN);
  });

  it('mensuel : l’écart couvre le mois le plus long de la fenêtre', () => {
    // Le 2 de chaque mois : octobre a 31 jours, donc 31 j au maximum.
    expect(intervalleMaxAttenduMs(['0 5 2 * *'], MAINTENANT)).toBe(31 * J);
  });

  it('dimanche noté 0 ou 7 : même résultat', () => {
    expect(intervalleMaxAttenduMs(['0 8 * * 7'], MAINTENANT)).toBe(7 * J);
    expect(intervalleMaxAttenduMs(['0 8 * * 0'], MAINTENANT)).toBe(7 * J);
  });

  it('noms de jours acceptés (MON-FRI)', () => {
    expect(intervalleMaxAttenduMs(['0 18 * * MON-FRI'], MAINTENANT)).toBe(3 * J);
  });

  it('jour du mois ET jour de semaine restreints → OU (règle cron)', () => {
    // Le 1er du mois OU chaque lundi : jamais plus de 7 jours d'écart.
    const ms = intervalleMaxAttenduMs(['0 7 1 * 1'], MAINTENANT);
    expect(ms).not.toBeNull();
    expect(ms!).toBeLessThanOrEqual(7 * J);
  });

  it('ignore les commentaires YAML collés à l’expression', () => {
    expect(intervalleMaxAttenduMs(['0 3 * * *   # chaque nuit'], MAINTENANT)).toBe(J);
  });

  it('expression illisible → null', () => {
    expect(intervalleMaxAttenduMs(['pas un cron'], MAINTENANT)).toBeNull();
    expect(intervalleMaxAttenduMs(['61 * * * *'], MAINTENANT)).toBeNull();
    expect(intervalleMaxAttenduMs(['@daily'], MAINTENANT)).toBeNull();
  });

  it('aucune expression → null', () => {
    expect(intervalleMaxAttenduMs([], MAINTENANT)).toBeNull();
  });

  it('une expression lisible parmi des illisibles suffit', () => {
    expect(intervalleMaxAttenduMs(['n’importe quoi', '0 3 * * *'], MAINTENANT)).toBe(J);
  });

  it('date impossible (30 février) → null, pas un écart inventé', () => {
    expect(intervalleMaxAttenduMs(['0 0 30 2 *'], MAINTENANT)).toBeNull();
  });
});
