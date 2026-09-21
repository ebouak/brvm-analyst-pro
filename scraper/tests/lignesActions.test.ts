import { describe, it, expect } from 'vitest';
import { lignesActions } from '../src/persistence/repository.js';
import type { MarketSnapshot } from '../src/types.js';

const base = { designation: 'X', pays: 'CI', secteur: 'S', cours_precedent: 100, cours_jour: 101, variation_pct: 1, volume: 10 };
const snap = (actions: MarketSnapshot['actions']): MarketSnapshot =>
  ({ date_marche: '2026-09-18', actions, obligations: [], indices: [], resume: null } as unknown as MarketSnapshot);

describe('lignesActions — une source n’écrase pas ce qu’elle ne collecte pas', () => {
  it('intraday (valeur et transactions absentes partout) : les deux clés ne sont PAS envoyées', () => {
    const rows = lignesActions(snap([
      { code: 'SNTS', ...base, nb_transactions: null, valeur_echangee: null },
      { code: 'ORAC', ...base, nb_transactions: null, valeur_echangee: null },
    ] as unknown as MarketSnapshot['actions']));
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect('valeur_echangee' in r).toBe(false);
      expect('nb_transactions' in r).toBe(false);
      expect(r.volume).toBe(10);
    }
  });
  it('clôture BDFIN (valeurs présentes) : les clés sont envoyées, y compris un zéro réel', () => {
    const rows = lignesActions(snap([
      { code: 'SNTS', ...base, nb_transactions: 12, valeur_echangee: 2_500_000 },
      { code: 'ORAC', ...base, nb_transactions: 0, valeur_echangee: 0 },
    ] as unknown as MarketSnapshot['actions']));
    expect(rows[0]).toMatchObject({ valeur_echangee: 2_500_000, nb_transactions: 12 });
    expect(rows[1]).toMatchObject({ valeur_echangee: 0, nb_transactions: 0 });
  });
  it('source mixte (une seule ligne renseignée) : toutes les lignes portent les clés (charge homogène pour PostgREST)', () => {
    const rows = lignesActions(snap([
      { code: 'SNTS', ...base, nb_transactions: 3, valeur_echangee: 1000 },
      { code: 'ORAC', ...base, nb_transactions: null, valeur_echangee: null },
    ] as unknown as MarketSnapshot['actions']));
    expect(rows.every((r) => 'valeur_echangee' in r && 'nb_transactions' in r)).toBe(true);
  });
});
