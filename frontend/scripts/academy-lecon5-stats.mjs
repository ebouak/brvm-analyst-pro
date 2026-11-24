#!/usr/bin/env node
// Mesure des croisements du MACD (12, 26, 9) sur les clôtures RÉELLES des dix
// actions les plus liquides de la BRVM, pour la leçon 5 du niveau 3. Lit
// l'export brvm_actions_daily (JSON {rows: [{code, date, c, v}]}) et reprend
// calendrier/liquidité de moyennes-brvm-2026-11-24.json, puis écrit
// lib/academy/contenus/niveau3/sources/macd-brvm-2026-11-24.json.
//
//   node --no-warnings scripts/academy-lecon5-stats.mjs <export-liquides.json>
//
// Les calculs utilisent lib/indicators.ts (macdSeries, emaSeries) tel quel :
// la leçon, le simulateur, l'atelier et la mesure calculent exactement le même
// MACD. Ce n'est pas un test de stratégie : ni frais ni dividendes, et les cas
// contemporains sur plusieurs valeurs ne sont pas dédoublonnés.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const { macdSeries } = await import(pathToFileURL(path.join(ICI, '..', 'lib', 'indicators.ts')).href);

const EXPORT = process.argv[2] ?? path.join(process.env.TEMP ?? '/tmp', 'liquides.json');
const lignes = JSON.parse(fs.readFileSync(EXPORT, 'utf8')).rows;
const moyPath = path.join(ICI, '..', 'lib', 'academy', 'contenus', 'niveau3', 'sources', 'moyennes-brvm-2026-11-24.json');
const moy = JSON.parse(fs.readFileSync(moyPath, 'utf8'));

const RAPIDE = 12;
const LENTE = 26;
const SIGNAL = 9;
const HORIZON = 20;
const FENETRE_AVANT = 26;
const MIN_CAS = 30;
const DEBUT = '2021-01-01';

const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
const mediane = (xs) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
function wilson(k, n) {
  if (n === 0) return [null, null];
  const z = 1.96;
  const p = k / n;
  const den = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / den;
  const marge = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / den;
  return [r1((centre - marge) * 100), r1((centre + marge) * 100)];
}

const parCode = new Map();
for (const r of lignes) {
  if (!parCode.has(r.code)) parCode.set(r.code, []);
  parCode.get(r.code).push({ date: r.date, c: Number(r.c), v: Number(r.v) });
}
for (const s of parCode.values()) s.sort((a, b) => a.date.localeCompare(b.date));

const toutesDates = [...new Set(lignes.map((r) => r.date))].sort();
const debutReel = toutesDates.find((d) => d >= DEBUT);
const derniereSeance = toutesDates.at(-1);

// 1. Comparabilité en FCFA vs % du cours + premier histogramme BBGC
const etats = {};
for (const [code, s] of parCode) {
  const c = s.map((p) => p.c);
  const m = macdSeries(c, RAPIDE, LENTE, SIGNAL);
  const d = m.at(-1);
  const last = s.at(-1);
  const firstHistIdx = m.findIndex((x) => x.hist != null);
  etats[code] = {
    code,
    seances: s.length,
    premiere_date: s[0].date,
    derniere_date: last.date,
    premier_histogramme_seance: firstHistIdx >= 0 ? firstHistIdx + 1 : null,
    premier_histogramme_date: firstHistIdx >= 0 ? s[firstHistIdx].date : null,
    cours: last.c,
    macd: d.macd != null ? r2(d.macd) : null,
    signal: d.signal != null ? r2(d.signal) : null,
    hist: d.hist != null ? r2(d.hist) : null,
    macd_pct: d.macd != null ? r2((d.macd / last.c) * 100) : null,
  };
}

// 2. Croisements MACD/Signal et passages ligne zéro
function mesurerCroisements(mode) {
  let haussiers = 0;
  let baissiers = 0;
  let annees = 0;
  const ar = { 5: { k: 0, n: 0 }, 10: { k: 0, n: 0 }, 20: { k: 0, n: 0 } };
  const avant = { haussier: [], baissier: [] };
  const apres = { haussier: { k: 0, n: 0, vars: [] }, baissier: { k: 0, n: 0, vars: [] } };
  const p1 = { haussier: { k: 0, n: 0, vars: [] }, baissier: { k: 0, n: 0, vars: [] } };
  const p2 = { haussier: { k: 0, n: 0, vars: [] }, baissier: { k: 0, n: 0, vars: [] } };
  const zoneZero = {
    haussier_sous_zero: { k: 0, n: 0, vars: [] },
    haussier_sur_zero: { k: 0, n: 0, vars: [] },
    baissier_sur_zero: { k: 0, n: 0, vars: [] },
    baissier_sous_zero: { k: 0, n: 0, vars: [] },
  };
  let baseN = 0;
  let baseH = 0;
  let baseB = 0;
  const bp = { p1: { n: 0, h: 0, b: 0 }, p2: { n: 0, h: 0, b: 0 } };

  for (const [, s] of parCode) {
    const closes = s.map((p) => p.c);
    const m = macdSeries(closes, RAPIDE, LENTE, SIGNAL);
    const vals = m.map((x) => (mode === 'signal' ? x.hist : x.macd));

    for (let i = 0; i + HORIZON < s.length; i++) {
      if (vals[i] == null || s[i].date < DEBUT) continue;
      baseN++;
      const g = s[i].date < '2024-01-01' ? bp.p1 : bp.p2;
      g.n++;
      if (closes[i + HORIZON] > closes[i]) { baseH++; g.h++; }
      else if (closes[i + HORIZON] < closes[i]) { baseB++; g.b++; }
    }
    annees += vals.filter((v, i) => v != null && s[i].date >= DEBUT).length / 250;

    // Règle du dernier signe non nul (identique au simulateur et à la leçon 3)
    const cr = [];
    let prec = 0;
    for (let i = 0; i < vals.length; i++) {
      if (vals[i] == null) continue;
      const sg = Math.sign(vals[i]);
      if (sg === 0) continue;
      if (prec !== 0 && sg !== prec) cr.push({ i, sens: sg > 0 ? 'haussier' : 'baissier' });
      prec = sg;
    }

    cr.forEach((x, idx) => {
      if (s[x.i].date < DEBUT) return;
      const { i, sens } = x;
      if (sens === 'haussier') haussiers++;
      else baissiers++;

      const suiv = cr[idx + 1];
      for (const N of [5, 10, 20]) {
        if (suiv && suiv.i - i <= N) { ar[N].k++; ar[N].n++; }
        else if (i + N < s.length) ar[N].n++;
      }

      if (i >= FENETRE_AVANT) {
        const fen = closes.slice(i - FENETRE_AVANT, i + 1);
        avant[sens].push(
          sens === 'haussier'
            ? (closes[i] / Math.min(...fen) - 1) * 100
            : (closes[i] / Math.max(...fen) - 1) * 100,
        );
      }

      if (i + HORIZON < s.length) {
        const v = (closes[i + HORIZON] / closes[i] - 1) * 100;
        const bon = sens === 'haussier' ? v > 0 : v < 0;
        const add = (g) => { g.n++; g.vars.push(v); if (bon) g.k++; };
        add(apres[sens]);
        add((s[i].date < '2024-01-01' ? p1 : p2)[sens]);
        if (mode === 'signal' && m[i].macd != null) {
          if (sens === 'haussier') add(m[i].macd < 0 ? zoneZero.haussier_sous_zero : zoneZero.haussier_sur_zero);
          else add(m[i].macd > 0 ? zoneZero.baissier_sur_zero : zoneZero.baissier_sous_zero);
        }
      }
    });
  }

  const fmt = (g, basePct) => {
    const ic = wilson(g.k, g.n);
    const partPct = g.n ? r1((g.k / g.n) * 100) : null;
    const assez = g.n >= MIN_CAS;
    const etabli = assez && (ic[0] > basePct || ic[1] < basePct);
    return {
      cas: g.n,
      part_pct: partPct,
      part_base_pct: r1(basePct),
      ic95_pct: ic,
      variation_mediane_pct: g.vars.length ? r1(mediane(g.vars)) : null,
      assez_de_cas: assez,
      ecart_etabli: etabli,
      ecart_sens: etabli ? (ic[0] > basePct ? 'plus' : 'moins') : null,
    };
  };
  const bH = (baseH / baseN) * 100;
  const bB = (baseB / baseN) * 100;
  const b1H = (bp.p1.h / bp.p1.n) * 100;
  const b1B = (bp.p1.b / bp.p1.n) * 100;
  const b2H = (bp.p2.h / bp.p2.n) * 100;
  const b2B = (bp.p2.b / bp.p2.n) * 100;

  return {
    croisements: haussiers + baissiers,
    haussiers,
    baissiers,
    par_valeur_et_par_an: r1((haussiers + baissiers) / annees),
    allers_retours: Object.fromEntries(
      Object.entries(ar).map(([k, v]) => [k, { cas: v.n, allers_retours: v.k, part_pct: v.n ? r1((v.k / v.n) * 100) : null }]),
    ),
    avant_26: {
      haussier_mediane_pct: r1(mediane(avant.haussier)),
      baissier_mediane_pct: r1(mediane(avant.baissier)),
      cas_haussiers: avant.haussier.length,
      cas_baissiers: avant.baissier.length,
    },
    base_20: { cas: baseN, part_hausse_pct: r1(bH), part_baisse_pct: r1(bB) },
    apres_20: { haussier: fmt(apres.haussier, bH), baissier: fmt(apres.baissier, bB) },
    robustesse: {
      '2021-2023': { haussier: fmt(p1.haussier, b1H), baissier: fmt(p1.baissier, b1B) },
      '2024-2026': { haussier: fmt(p2.haussier, b2H), baissier: fmt(p2.baissier, b2B) },
      ...(mode === 'signal'
        ? {
            sous_zero: { haussier: fmt(zoneZero.haussier_sous_zero, bH), baissier: fmt(zoneZero.baissier_sous_zero, bB) },
            sur_zero: { haussier: fmt(zoneZero.haussier_sur_zero, bH), baissier: fmt(zoneZero.baissier_sur_zero, bB) },
          }
        : {}),
    },
  };
}

// 3. Ralentissement précoce de l'histogramme : avance médiane vs part démentie avant zéro
let ralentTotal = 0;
let ralentCroise = 0;
let ralentDementi = 0;
const avances = [];
for (const [, s] of parCode) {
  const m = macdSeries(s.map((p) => p.c), RAPIDE, LENTE, SIGNAL);
  for (let i = 2; i < m.length - 1; i++) {
    if (s[i].date < DEBUT) continue;
    const h0 = m[i - 2].hist;
    const h1 = m[i - 1].hist;
    const h2 = m[i].hist;
    if (h0 == null || h1 == null || h2 == null) continue;
    const negTurn = h0 < 0 && h1 < 0 && h2 < 0 && h1 <= h0 && h2 > h1;
    const posTurn = h0 > 0 && h1 > 0 && h2 > 0 && h1 >= h0 && h2 < h1;
    if (!negTurn && !posTurn) continue;
    let issue = null;
    for (let j = i + 1; j < m.length; j++) {
      const hj = m[j].hist;
      if (negTurn) {
        if (hj > 0) { issue = { type: 'croise', delta: j - i }; break; }
        if (hj < h1) { issue = { type: 'dementi' }; break; }
      } else {
        if (hj < 0) { issue = { type: 'croise', delta: j - i }; break; }
        if (hj > h1) { issue = { type: 'dementi' }; break; }
      }
    }
    if (!issue) continue;
    ralentTotal++;
    if (issue.type === 'croise') { ralentCroise++; avances.push(issue.delta); }
    else ralentDementi++;
  }
}

// 4. Cas réels datés : ORAC (oct–nov 2026, cycle complet) & SGBC (oct–nov 2026, allers-retours)
function extraireExemple(code, datesSelection, nbCloturesVerif = 250) {
  const s = parCode.get(code);
  const c = s.map((p) => p.c);
  const m = macdSeries(c, RAPIDE, LENTE, SIGNAL);
  const seances = [];
  for (let i = 0; i < s.length; i++) {
    if (!datesSelection.includes(s[i].date)) continue;
    seances.push({
      date: s[i].date,
      cloture: s[i].c,
      volume: s[i].v,
      macd: r1(m[i].macd),
      signal: r1(m[i].signal),
      hist: r1(m[i].hist),
    });
  }
  return {
    code,
    seances,
    clotures_verif: s.slice(-nbCloturesVerif).map((p) => ({ date: p.date, cloture: p.c })),
  };
}

const orac = extraireExemple('ORAC', [
  '2026-10-28', '2026-10-29', '2026-11-02', '2026-11-04',
  '2026-11-05', '2026-11-09', '2026-11-10', '2026-11-13',
  '2026-11-17', '2026-11-18', '2026-11-20', '2026-11-23',
]);
const sgbc = extraireExemple('SGBC', [
  '2026-10-28', '2026-10-29', '2026-10-30', '2026-11-02',
  '2026-11-05', '2026-11-06', '2026-11-09',
]);

const sortie = {
  genere_le: '2026-11-24',
  periode: { debut: debutReel, fin: derniereSeance },
  valeurs_liquides: parCode.size,
  seances_total: lignes.length,
  parametres: { rapide: RAPIDE, lente: LENTE, signal: SIGNAL, horizon: HORIZON, fenetre_avant: FENETRE_AVANT, min_cas: MIN_CAS },
  seances_par_an: moy.seances_par_an,
  liquidite_figees_50: {
    du: moy.liquidite.du,
    au: moy.liquidite.au,
    fenetre: moy.liquidite.fenetre,
    codes: moy.liquidite.plus_touchees.filter((x) => x.sans_echange === moy.liquidite.fenetre).map((x) => x.code),
  },
  bbgc: etats.BBGC,
  comparabilite_2026_11_23: ['ETIT', 'SGBC', 'ORAC', 'NSBC'].map((code) => etats[code]),
  croisement_signal: mesurerCroisements('signal'),
  croisement_zero: mesurerCroisements('zero'),
  ralentissement_hist: {
    cas: ralentTotal,
    aboutis_en_croisement: ralentCroise,
    dementis: ralentDementi,
    part_dementi_pct: r1((ralentDementi / ralentTotal) * 100),
    avance_mediane_seances: mediane(avances),
  },
  exemples: { orac, sgbc },
};

const DEST = path.join(ICI, '..', 'lib', 'academy', 'contenus', 'niveau3', 'sources', 'macd-brvm-2026-11-24.json');
fs.writeFileSync(DEST, `${JSON.stringify(sortie, null, 2)}\n`, 'utf8');
console.log(`écrit macd-brvm-2026-11-24.json — ${sortie.croisement_signal.croisements} croisements signal, ${sortie.croisement_zero.croisements} passages zéro, ${sortie.ralentissement_hist.cas} ralentissements`);
