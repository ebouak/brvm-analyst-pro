import assert from 'node:assert';
import { fetchAllRows } from './paginate.ts';

// Simule une table de `total` lignes servie par lots de 1000 via .range(from,to).
function fausseTable(total) {
  const toutes = Array.from({ length: total }, (_, i) => ({ i }));
  const appels = [];
  const construire = (from, to) => {
    appels.push([from, to]);
    return Promise.resolve({ data: toutes.slice(from, to + 1) });
  };
  return { construire, appels };
}

// Moins de 1000 : un seul appel, on s'arrête car le lot est incomplet.
const petit = fausseTable(42);
assert.equal((await fetchAllRows(petit.construire)).length, 42);
assert.equal(petit.appels.length, 1);

// Exactement 1000 : PIÈGE. Le premier lot est plein -> il FAUT un second appel
// pour découvrir qu'il n'y a plus rien. S'arrêter à 1000 raterait ce cas.
const pile = fausseTable(1000);
const rPile = await fetchAllRows(pile.construire);
assert.equal(rPile.length, 1000);
assert.equal(pile.appels.length, 2, 'un lot plein oblige à re-demander');

// 2500 : trois lots (1000 + 1000 + 500).
const gros = fausseTable(2500);
const rGros = await fetchAllRows(gros.construire);
assert.equal(rGros.length, 2500);
assert.equal(gros.appels.length, 3);
assert.deepEqual(gros.appels, [[0, 999], [1000, 1999], [2000, 2999]]);
// Aucune ligne perdue ni dupliquée.
assert.deepEqual(rGros.map((r) => r.i), Array.from({ length: 2500 }, (_, i) => i));

// Table vide.
const vide = fausseTable(0);
assert.deepEqual(await fetchAllRows(vide.construire), []);
assert.equal(vide.appels.length, 1);

console.log('✓ supabase/paginate OK');
