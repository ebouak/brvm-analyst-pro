import { describe, it, expect } from 'vitest';
import * as q from './requetes';

const f = { debut: new Date('2026-10-01T00:00:00Z'), fin: new Date('2026-11-01T00:00:00Z') };
const toutes = [q.sqlOverview(f), q.sqlContinents(f), q.sqlPaysAfrique(f), q.sqlVillesAfrique(f), q.sqlSessions(f), q.sqlPages(f), q.sqlClics(f), q.sqlAppareils(f), q.sqlTendance(f.fin), q.sqlEntonnoir(f), q.sqlSerieJournaliere(f)];

describe('requêtes HogQL', () => {
  it('toutes sont des SELECT bornés par la fenêtre en UTC', () => {
    for (const s of toutes) {
      expect(s.trim().startsWith('SELECT')).toBe(true);
      expect(s).toContain(`toDateTime('2026-`);
      expect(s).toContain(`'UTC'`);
      expect(s).not.toMatch(/INTERVAL \d+ DAY/);
    }
  });
  it('la fenêtre : début inclus, fin exclue', () => {
    expect(q.sqlOverview(f)).toContain(`timestamp >= toDateTime('2026-10-01 00:00:00', 'UTC') AND timestamp < toDateTime('2026-11-01 00:00:00', 'UTC')`);
  });
  it('la table sessions se borne sur $start_timestamp', () => {
    expect(q.sqlSessions(f)).toContain('FROM sessions WHERE $start_timestamp >=');
  });
  it('l\'Afrique se filtre sur le code continent AF', () => {
    expect(q.sqlPaysAfrique(f)).toContain(`$geoip_continent_code = 'AF'`);
    expect(q.sqlVillesAfrique(f)).toContain(`$geoip_continent_code = 'AF'`);
  });
  it('les pages ne comptent que les $pageview, les clics que les clics', () => {
    expect(q.sqlPages(f)).toContain(`event = '$pageview'`);
    expect(q.sqlClics(f)).toContain(`properties.$event_type = 'click'`);
  });
  it('la tendance couvre 12 semaines avant la fin', () => {
    expect(q.sqlTendance(f.fin)).toContain(`toDateTime('2026-08-09 00:00:00', 'UTC')`);
  });
  it('une borne invalide est refusée plutôt que injectée', () => {
    expect(() => q.sqlOverview({ debut: new Date('nope'), fin: f.fin })).toThrow();
  });
  it('aucune requête ne contient de valeur libre non résolue', () => {
    for (const s of toutes) expect(s).not.toMatch(/undefined|NaN|\$\{/);
  });
});
