#!/usr/bin/env node
// Mesure des figures de chandeliers sur les séances RÉELLES de la BRVM, pour
// la leçon 2 du niveau 3. Lit un export de brvm_actions_daily (JSON des
// lignes {code, date, o, h, b, c, v}) et écrit
// lib/academy/contenus/niveau3/sources/bougies-brvm-2026-11-24.json.
//
//   node --no-warnings scripts/academy-lecon2-stats.mjs <export.json> <faits_marche.json>
//
// Le repérage est celui de lib/academy/figuresBougies.ts, chargé tel quel
// (types effacés par Node) : la leçon, le simulateur et la mesure appliquent
// exactement les mêmes règles.
//
// Ce que mesure ce script, et rien d’autre : combien de fois chaque figure
// apparaît, et la part des cas où la clôture était plus haute 5 séances plus
// tard, comparée à la même part sur TOUTES les séances lisibles. Un intervalle
// de Wilson à 95 % accompagne chaque part : quand il contient la part de
// toutes les séances, l’écart n’est pas établi. Ce n’est pas un test de
// stratégie (pas de frais, cas proches dans le temps non dédoublonnés).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const { repererFigures, bougieExploitable, FIGURES } = await import(pathToFileURL(path.join(ICI, '..', 'lib', 'academy', 'figuresBougies.ts')).href);

const [EXPORT, FAITS] = process.argv.slice(2);
const lignes = JSON.parse(fs.readFileSync(EXPORT, 'utf8')).rows;
const faits = JSON.parse(fs.readFileSync(FAITS, 'utf8'));
const HORIZON = 5;

const parCode = new Map();
for (const r of lignes) {
  if (!parCode.has(r.code)) parCode.set(r.code, []);
  parCode.get(r.code).push({ date: r.date, ouverture: r.o, haut: r.h, bas: r.b, cloture: r.c, volume: r.v });
}

// Wilson, 95 %.
function wilson(k, n) {
  if (n === 0) return [null, null];
  const z = 1.96;
  const p = k / n;
  const den = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / den;
  const marge = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / den;
  return [centre - marge, centre + marge];
}

const MIN_CAS = 30;
const stats = new Map(Object.keys(FIGURES).map((f) => [f, { n: 0, mesurables: 0, hausses: 0, baisses: 0, sommeVar: 0 }]));
let lisibles = 0;
let baseMesurables = 0;
let baseHausses = 0;
let baseBaisses = 0;
let baseSommeVar = 0;
const valeurs = [];
for (const [code, s] of [...parCode.entries()].sort()) {
  s.sort((a, b) => a.date.localeCompare(b.date));
  const ok = s.map(bougieExploitable);
  const nLisibles = ok.filter(Boolean).length;
  lisibles += nLisibles;
  valeurs.push({ code, seances: s.length, lisibles: nLisibles, premiere: s[0]?.date ?? null });
  for (let i = 0; i + HORIZON < s.length; i += 1) {
    if (!ok[i]) continue;
    baseMesurables += 1;
    const v = s[i + HORIZON].cloture / s[i].cloture - 1;
    baseSommeVar += v;
    if (v > 0) baseHausses += 1;
    if (v < 0) baseBaisses += 1;
  }
  for (const f of repererFigures(s)) {
    const st = stats.get(f.figure);
    st.n += 1;
    if (f.fin + HORIZON < s.length) {
      const v = s[f.fin + HORIZON].cloture / s[f.fin].cloture - 1;
      st.mesurables += 1;
      st.sommeVar += v;
      if (v > 0) st.hausses += 1;
      if (v < 0) st.baisses += 1;
    }
  }
}

const base = {
  mesurables: baseMesurables,
  part_hausse_pct: (baseHausses / baseMesurables) * 100,
  part_baisse_pct: (baseBaisses / baseMesurables) * 100,
  part_inchange_pct: ((baseMesurables - baseHausses - baseBaisses) / baseMesurables) * 100,
  variation_moyenne_pct: (baseSommeVar / baseMesurables) * 100,
};
// Chaque figure est comparée dans le sens de sa lecture courante : la part de
// hausses pour une figure haussière, la part de baisses pour une baissière, la
// part de hausses sinon (indécision, ralentissement). Un écart n’est déclaré
// établi qu’à partir de MIN_CAS cas mesurables et si l’intervalle à 95 %
// exclut la même part sur toutes les séances.
const figures = [...stats.entries()].map(([f, st]) => {
  const sens = FIGURES[f].lecture === 'baissiere' ? 'baisse' : 'hausse';
  const k = sens === 'baisse' ? st.baisses : st.hausses;
  const ref = sens === 'baisse' ? base.part_baisse_pct : base.part_hausse_pct;
  const [bas, haut] = wilson(k, st.mesurables);
  const part = st.mesurables ? (k / st.mesurables) * 100 : null;
  const assez = st.mesurables >= MIN_CAS;
  const etabli = assez && bas != null && (bas * 100 > ref || haut * 100 < ref);
  return {
    figure: f,
    libelle: FIGURES[f].libelle,
    nb_bougies: FIGURES[f].nb,
    lecture_courante: FIGURES[f].lecture,
    occurrences: st.n,
    mesurables: st.mesurables,
    sens_compare: sens,
    part_pct: part,
    part_base_pct: ref,
    part_hausse_pct: st.mesurables ? (st.hausses / st.mesurables) * 100 : null,
    part_baisse_pct: st.mesurables ? (st.baisses / st.mesurables) * 100 : null,
    ic95_pct: bas == null ? null : [bas * 100, haut * 100],
    variation_moyenne_pct: st.mesurables ? (st.sommeVar / st.mesurables) * 100 : null,
    assez_de_cas: assez,
    ecart_etabli: etabli,
    ecart_sens: !etabli ? null : bas * 100 > ref ? 'plus_frequent' : 'moins_frequent',
  };
});

const sortie = {
  _lisez_moi: 'Figures de chandeliers repérées par lib/academy/figuresBougies.ts sur les séances réelles (brvm_actions_daily, base WESTBOURSE, lue le 2026-11-24) des dix actions les plus échangées du 24/08 au 23/11/2026, de 2021 au 23/11/2026. « mesurables » : cas suivis d’au moins 5 séances. part_hausse_pct : part des cas où la clôture était plus haute 5 séances plus tard ; ic95_pct : intervalle de Wilson à 95 % ; ecart_etabli : l’intervalle exclut la part de toutes les séances lisibles (base). Pas un test de stratégie : ni frais, ni dédoublonnage des cas proches. Généré par scripts/academy-lecon2-stats.mjs.',
  periode: { debut: '2021-01-01', fin: '2026-11-23' },
  horizon_seances: HORIZON,
  min_cas: MIN_CAS,
  comparaisons: Object.keys(FIGURES).length,
  valeurs,
  seances: lignes.length,
  seances_lisibles: lisibles,
  marche: faits,
  base,
  figures,
};
const cible = path.join(ICI, '..', 'lib', 'academy', 'contenus', 'niveau3', 'sources', 'bougies-brvm-2026-11-24.json');
fs.writeFileSync(cible, `${JSON.stringify(sortie, null, 1)}\n`, 'utf8');
console.log(`séances ${lignes.length}, lisibles ${lisibles}, base : ${base.part_hausse_pct.toFixed(1)} % hausses, ${base.part_baisse_pct.toFixed(1)} % baisses, ${base.part_inchange_pct.toFixed(1)} % inchangés à ${HORIZON} séances (${baseMesurables} cas)`);
for (const f of figures) {
  console.log(`${f.libelle.padEnd(22)} ${String(f.mesurables).padStart(4)} cas, ${f.sens_compare} ${f.part_pct == null ? '—' : f.part_pct.toFixed(1)} % (toutes séances ${f.part_base_pct.toFixed(1)} %) [${f.ic95_pct ? f.ic95_pct.map((x) => x.toFixed(1)).join(' ; ') : '—'}] ${!f.assez_de_cas ? 'trop peu de cas' : f.ecart_etabli ? `ÉCART ÉTABLI (${f.ecart_sens})` : 'non établi'}`);
}
