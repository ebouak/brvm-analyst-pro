/**
 * Indice de nervosité BRVM-V côté scraper : copie du module, préparation des
 * entrées (rendements du marché large), rang sans valeur future, écriture
 * idempotente.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  construireSerie, rendementsParSeance, MIN_TITRES, MIN_HISTORIQUE_RANG, FENETRE_RANG, type CoursLigne,
} from '../src/nervosite/construire.js';
import { ecrireNervosite, lignesMock, runNervosite, TABLE_NERVOSITE } from '../src/nervosite/runNervosite.js';
import { serieNervosite, rendementsLog, rendementMarche, rangsGlissants } from '../src/nervosite/pure/nervosite.js';

const RACINE = join(__dirname, '..', '..');

describe('nervosité : copie frontend / scraper', () => {
  it('pure/nervosite.ts est identique au module du frontend', () => {
    const front = readFileSync(join(RACINE, 'frontend', 'lib', 'nervosite', 'nervosite.ts'), 'utf8').replace(/\r\n/g, '\n');
    const copie = readFileSync(join(RACINE, 'scraper', 'src', 'nervosite', 'pure', 'nervosite.ts'), 'utf8').replace(/\r\n/g, '\n');
    expect(copie.startsWith('// COPIE de frontend/lib/nervosite/nervosite.ts')).toBe(true);
    expect(copie.replace(/^(\/\/.*\n)+/, '')).toBe(front);
  });
});

/** n séances de `codes` titres, cours générés par `pas(jour, titre)`. */
function fabrique(n: number, codes: number, pas: (j: number, k: number) => number, debut = '2020-01-01'): CoursLigne[] {
  const out: CoursLigne[] = [];
  const cours = Array.from({ length: codes }, () => 1000);
  const t0 = Date.parse(`${debut}T00:00:00Z`);
  for (let j = 0; j < n; j++) {
    const d = new Date(t0 + j * 86_400_000).toISOString().slice(0, 10);
    for (let k = 0; k < codes; k++) {
      if (j > 0) cours[k] = cours[k]! * Math.exp(pas(j, k));
      out.push({ code: `T${k}`, date_marche: d, cours_jour: cours[k]! });
    }
  }
  return out;
}

describe('rendements du marché large', () => {
  it('moyenne simple des rendements log des titres cotés ce jour-là', () => {
    const lignes: CoursLigne[] = [];
    for (const [code, a, b] of [['A', 100, 102], ['B', 200, 196], ['C', 50, 50], ['D', 10, 10.1], ['E', 80, 80]] as const) {
      lignes.push({ code, date_marche: '2020-01-01', cours_jour: a }, { code, date_marche: '2020-01-02', cours_jour: b });
    }
    const [s] = rendementsParSeance(lignes, '2020-01-01');
    const attendu = rendementMarche([Math.log(1.02), Math.log(0.98), 0, Math.log(1.01), 0]);
    expect(s!.date_marche).toBe('2020-01-02');
    expect(s!.n_titres).toBe(5);
    expect(s!.rendement).toBeCloseTo(attendu, 12);
  });

  it(`une séance de moins de ${MIN_TITRES} titres est écartée, pas comptée comme calme`, () => {
    const lignes: CoursLigne[] = [
      { code: 'A', date_marche: '2020-01-01', cours_jour: 100 },
      { code: 'A', date_marche: '2020-01-02', cours_jour: 101 },
    ];
    expect(rendementsParSeance(lignes, '2020-01-01')).toEqual([]);
  });

  it('un fractionnement (−90 % en une séance, SNTS le 26/10/2026) est neutralisé', () => {
    const lignes = fabrique(3, 5, () => 0.001);
    const snts = lignes.filter((l) => l.code === 'T0');
    snts[2]!.cours_jour = snts[1]!.cours_jour! / 10;
    const s = rendementsParSeance(lignes, '2020-01-01');
    // Le titre fractionné compte pour un rendement nul ce jour-là, les autres pour 0,1 %.
    expect(s[1]!.rendement).toBeCloseTo((4 * 0.001) / 5, 12);
    expect(rendementsLog([100, 10])[0]).toBe(0);
  });

  it('cours nul ou absent : trou de collecte, le rendement suivant part de la cotation d’avant', () => {
    const lignes = fabrique(3, 6, () => 0);
    const t0 = lignes.filter((l) => l.code === 'T0');
    t0[1]!.cours_jour = null;
    t0[2]!.cours_jour = 1010;
    const s = rendementsParSeance(lignes, '2020-01-01');
    expect(s[0]!.n_titres).toBe(5); // T0 n'a pas de rendement le 02/01
    expect(s[1]!.n_titres).toBe(6);
    expect(s[1]!.rendement).toBeCloseTo(Math.log(1.01) / 6, 12);
  });

  it('ignore les séances antérieures au début de série', () => {
    const lignes = fabrique(10, 5, () => 0.002, '2006-12-25');
    const s = rendementsParSeance(lignes);
    expect(s.every((x) => x.date_marche >= '2007-01-01')).toBe(true);
  });
});

describe('série BRVM-V', () => {
  const lignes = fabrique(700, 8, (j, k) => Math.sin(j * 1.7 + k * 0.9) * (j < 600 ? 0.004 : 0.012));
  const serie = construireSerie(lignes, '2020-01-01');

  it('reprend exactement la formule fournie, sans retouche', () => {
    const attendu = serieNervosite(rendementsParSeance(lignes, '2020-01-01').map((s) => s.rendement));
    expect(serie.length).toBe(attendu.length);
    expect(serie.at(-1)!.valeur).toBeCloseTo(attendu.at(-1)!.valeur!, 3);
    expect(serie.at(-1)!.lente).toBeCloseTo(attendu.at(-1)!.lente!, 3);
  });

  it('pas de valeur avant 250 séances, pas de rang ni de régime avant un an de valeurs', () => {
    expect(serie[247]!.valeur).toBeNull();
    expect(serie[249]!.valeur).not.toBeNull();
    const premierRang = serie.findIndex((l) => l.rang !== null);
    expect(premierRang).toBe(249 + MIN_HISTORIQUE_RANG - 1);
    for (const l of serie) expect(l.rang === null).toBe(l.regime === null);
  });

  it('le rang ne dépend que du passé : ajouter des séances ne change pas les lignes anciennes', () => {
    const courte = construireSerie(lignes.filter((l) => l.date_marche <= serie[620]!.date_marche), '2020-01-01');
    expect(courte.at(-1)).toEqual(serie[620]);
  });

  it('le rang est calculé sur les 1 250 dernières valeurs au plus', () => {
    expect(FENETRE_RANG).toBe(1250);
    const longues = fabrique(1700, 8, (j, k) => Math.sin(j * 1.7 + k * 0.9) * (j < 400 ? 0.02 : 0.004));
    const s = construireSerie(longues, '2020-01-01');
    const valeurs = s.map((l) => l.valeur);
    const brutes = serieNervosite(rendementsParSeance(longues, '2020-01-01').map((x) => x.rendement)).map((p) => p.valeur);
    const attendus = rangsGlissants(brutes, FENETRE_RANG, MIN_HISTORIQUE_RANG);
    s.forEach((l, i) => {
      const a = attendus[i];
      expect(l.rang).toBe(a === null || a === undefined ? null : Math.round(a * 100) / 100);
    });
    expect(valeurs.filter((v) => v !== null).length).toBeGreaterThan(FENETRE_RANG + 100);
    // Les 400 premières séances, agitées, sont sorties de la fenêtre à la fin :
    // sur tout l'historique, la dernière séance paraîtrait plus calme qu'elle n'est.
    const surTout = rangsGlissants(brutes, Infinity, MIN_HISTORIQUE_RANG).at(-1)!;
    expect(attendus.at(-1)!).toBeGreaterThan(surTout);
  });

  it('la volatilité triple à la fin : la valeur monte et le régime finit tendu', () => {
    const fin = serie.at(-1)!;
    expect(fin.valeur!).toBeGreaterThan(serie[590]!.valeur! * 1.5);
    expect(fin.regime).toBe('tendu');
  });
});

describe('écriture idempotente', () => {
  function fauxClient() {
    const appels: { table: string; lignes: unknown[]; onConflict?: string }[] = [];
    const sb = {
      from: (table: string) => ({
        upsert: async (lignes: unknown[], o?: { onConflict?: string }) => {
          appels.push({ table, lignes, onConflict: o?.onConflict });
          return { error: null };
        },
      }),
    };
    return { sb: sb as never, appels };
  }

  it('upsert par lots sur date_marche ; deux passages écrivent les mêmes lignes', async () => {
    const serie = construireSerie(lignesMock(), '2025-01-01');
    const a = fauxClient();
    const b = fauxClient();
    const maintenant = '2026-11-16T16:00:00.000Z';
    expect(await ecrireNervosite(a.sb, serie, { taille: 100, maintenant })).toBe(serie.length);
    await ecrireNervosite(b.sb, construireSerie(lignesMock(), '2025-01-01'), { taille: 100, maintenant });
    expect(a.appels.length).toBe(Math.ceil(serie.length / 100));
    expect(a.appels.every((x) => x.table === TABLE_NERVOSITE && x.onConflict === 'date_marche')).toBe(true);
    expect(b.appels).toEqual(a.appels);
    const dates = a.appels.flatMap((x) => x.lignes as { date_marche: string }[]).map((l) => l.date_marche);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('une erreur d’écriture lève : jamais de succès silencieux', async () => {
    const sb = { from: () => ({ upsert: async () => ({ error: { message: 'permission denied' } }) }) };
    await expect(ecrireNervosite(sb as never, construireSerie(lignesMock(), '2025-01-01'))).rejects.toThrow(/permission denied/);
  });
});

describe('runNervosite --mock', () => {
  it('calcule sans écrire ni lire la base', async () => {
    const r = await runNervosite({ mock: true });
    expect(r.status).toBe('mock');
    expect(r.nb_ecrites).toBe(0);
    expect(r.valeur).not.toBeNull();
  });
});
