import { describe, it, expect } from 'vitest';
import { controler, type Existant } from '../src/saisonnalite/runSaisonnalite.js';
import type { FaitMensuel } from '../src/saisonnalite/mensuel.js';

/** 6 000 faits : 60 valeurs × 100 mois, le dernier mois de chaque valeur incomplet. */
function jeu(opts: { decembre?: number } = {}): FaitMensuel[] {
  const out: FaitMensuel[] = [];
  for (let v = 0; v < 60; v++) {
    for (let k = 0; k < 100; k++) {
      const annee = 2018 + Math.floor(k / 12);
      const mois = (k % 12) + 1;
      const r = mois === 12 && opts.decembre != null ? opts.decembre : 0.01;
      out.push({
        code: `V${v}`, annee, mois, rdt_prix: r, rdt_total: r, rdt_marche: r, dividende: null,
        seances_cotees: 20, seances_marche: 20, valeur_echangee: 0, exclu: null,
        evenements: k % 12 === 4 ? [{ type: 'detachement', date: `${annee}-05-15` }] : [], difficulte: false, complet: k < 99,
      });
    }
  }
  return out;
}
const enBase = (fs: FaitMensuel[]): Existant[] =>
  fs.map((f) => ({ code: f.code, annee: f.annee, mois: f.mois, rdt_prix: f.rdt_prix, rdt_total: f.rdt_total, exclu: f.exclu, complet: f.complet }));
const ok = (cs: ReturnType<typeof controler>) => cs.filter((c) => !c.ok).map((c) => c.nom);
const base = { detachesAttendus: 480, asOf: '2026-04-30', aujourdhui: '2026-05-02', force: false };

describe('controler (saisonnalité)', () => {
  it('tout passe sur un calcul identique à la table', () => {
    const fs = jeu();
    expect(ok(controler(fs, { ...base, existants: enBase(fs) }))).toEqual([]);
  });

  it('un mois de décembre négatif n’est pas une erreur', () => {
    const fs = jeu({ decembre: -0.05 });
    expect(ok(controler(fs, { ...base, existants: enBase(fs) }))).toEqual([]);
  });

  it('première exécution : table vide, aucune dérive mesurable', () => {
    expect(ok(controler(jeu(), { ...base, existants: [] }))).toEqual([]);
  });

  it('dérive : plus de 2 % des mois terminés réécrits → échec, sauf --force', () => {
    const avant = enBase(jeu());
    const apres = jeu().map((f, i) => (i % 20 === 0 ? { ...f, rdt_total: 0.5, rdt_prix: 0.5 } : f));
    expect(ok(controler(apres, { ...base, existants: avant }))).toEqual(['mois terminés stables']);
    expect(ok(controler(apres, { ...base, existants: avant, force: true }))).toEqual([]);
  });

  it('historique tronqué : baisse du nombre de lignes au-delà de 1 % → échec', () => {
    const avant = enBase(jeu());
    const tronque = jeu().slice(0, 5500);
    expect(ok(controler(tronque, { ...base, existants: avant }))).toContain('pas de baisse du nombre de lignes');
  });

  it('cours périmés : dernière séance de plus de 4 jours → échec', () => {
    const fs = jeu();
    expect(ok(controler(fs, { ...base, existants: enBase(fs), aujourdhui: '2026-05-08' }))).toEqual(['fraîcheur des cours']);
  });

  it('table des dividendes vidée : moins de 90 % des détachements → échec', () => {
    const fs = jeu();
    expect(ok(controler(fs, { ...base, existants: enBase(fs), detachesAttendus: 1000 }))).toEqual(['détachements']);
  });
});
