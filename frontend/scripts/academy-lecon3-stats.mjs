#!/usr/bin/env node
// Mesure des croisements de moyennes mobiles sur les clôtures RÉELLES de la
// BRVM, pour la leçon 3 du niveau 3. Lit un export de brvm_actions_daily (JSON
// des lignes {code, date, c, v}) et un fichier de faits datés (dividendes lus
// en base), écrit lib/academy/contenus/niveau3/sources/moyennes-brvm-2026-11-24.json.
//
//   node --no-warnings scripts/academy-lecon3-stats.mjs <export.json> <faits.json>
//
// Les moyennes sont celles de lib/indicators.ts (smaSeries, emaSeries), chargé
// tel quel : la leçon, le simulateur et la mesure calculent les mêmes moyennes.
// Le croisement suit la règle de dernierCroisementMoyennes (simTechnique.ts) :
// seul compte le dernier signe NON NUL de l'écart entre les deux moyennes.
//
// Ce que mesure ce script, et rien d'autre :
//  - combien de croisements 20/50 séances, et combien se défont en 10 ou 20 séances ;
//  - de combien le cours avait déjà bougé au croisement (depuis son extrême des
//    50 séances précédentes) : le retard, chiffré ;
//  - la part des cas où, 20 séances après, le cours était dans le sens du
//    croisement, comparée à la même part sur TOUTES les séances (Wilson 95 %,
//    au moins 30 cas) ;
//  - les allers-retours quand la moyenne longue est plate, et quand elle ne l'est pas ;
//  - de combien de séances la moyenne exponentielle croise plus tôt ;
//  - combien de valeurs ont des séances sans échange dans leurs 50 dernières.
// Ce n'est pas un test de stratégie : ni frais, ni dividendes réinvestis, et des
// cas proches dans le temps ne sont pas dédoublonnés.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const { smaSeries, emaSeries } = await import(pathToFileURL(path.join(ICI, '..', 'lib', 'indicators.ts')).href);

const [EXPORT, FAITS] = process.argv.slice(2);
// Dernière séance COMPLÈTE au moment de l'export : celle du 24/11/2026 était en
// cours, ses « clôtures » n'étaient que des cours intraday (constaté sur CBIBF :
// 23 970 à l'export, 24 000 ensuite). Rien n'est lu au-delà.
const FIN = '2026-11-23';
const lignes = JSON.parse(fs.readFileSync(EXPORT, 'utf8')).rows.filter((r) => r.date <= FIN);
const faits = JSON.parse(fs.readFileSync(FAITS, 'utf8'));

const COURTE = 20;
const LONGUE = 50;
const HORIZON = 20;
const FENETRE_AVANT = 50;
const PENTE_SEANCES = 10;
const SEUIL_PENTE = 1; // % en 10 séances, comme SEUIL_PENTE_PCT du simulateur
const DECALAGE_MAX = 30;
const MIN_CAS = 30;
const DEBUT = '2021-01-01';
const FENETRE_LIQUIDITE = 50;

const r1 = (x) => Math.round(x * 10) / 10;
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
  return [centre - marge, centre + marge];
}
/** Règle de dernierCroisementMoyennes : dernier signe non nul. */
function croisements(courte, longue) {
  const out = [];
  let prec = 0;
  for (let i = 0; i < courte.length; i++) {
    const a = courte[i];
    const b = longue[i];
    if (a == null || b == null) continue;
    const s = Math.sign(a - b);
    if (s === 0) continue;
    if (prec !== 0 && s !== prec) out.push({ i, sens: s > 0 ? 'haussier' : 'baissier' });
    prec = s;
  }
  return out;
}

const parCode = new Map();
for (const r of lignes) {
  if (!parCode.has(r.code)) parCode.set(r.code, []);
  parCode.get(r.code).push({ date: r.date, c: Number(r.c), v: Number(r.v) });
}
for (const s of parCode.values()) s.sort((a, b) => a.date.localeCompare(b.date));

const toutesDates = [...new Set(lignes.map((r) => r.date))].sort();
const derniereSeance = toutesDates.at(-1);
const seancesParAn = {};
for (const d of toutesDates) if (d >= DEBUT) seancesParAn[d.slice(0, 4)] = (seancesParAn[d.slice(0, 4)] ?? 0) + 1;

function mesurer(methode) {
  const calc = methode === 'simple' ? smaSeries : emaSeries;
  const m = {
    haussiers: 0, baissiers: 0, anneesObservees: 0,
    ar: { 10: { k: 0, n: 0 }, 20: { k: 0, n: 0 } },
    pente: { plate: { k: 0, n: 0 }, orientee: { k: 0, n: 0 } },
    apres: { haussier: { k: 0, n: 0, vars: [] }, baissier: { k: 0, n: 0, vars: [] } },
    // Robustesse : croisements isolés (aucun autre dans les 20 séances avant) et deux sous-périodes.
    isoles: { haussier: { k: 0, n: 0, vars: [] }, baissier: { k: 0, n: 0, vars: [] } },
    p1: { haussier: { k: 0, n: 0, vars: [] }, baissier: { k: 0, n: 0, vars: [] } },
    p2: { haussier: { k: 0, n: 0, vars: [] }, baissier: { k: 0, n: 0, vars: [] } },
    avant: { haussier: [], baissier: [] },
    parCode: new Map(),
  };
  for (const [code, s] of parCode) {
    const c = s.map((p) => p.c);
    const mc = calc(c, COURTE);
    const ml = calc(c, LONGUE);
    const cr = croisements(mc, ml);
    m.parCode.set(code, cr);
    m.anneesObservees += s.filter((p, i) => p.date >= DEBUT && ml[i] != null).length / 250;
    cr.forEach((x, k) => {
      if (s[x.i].date < DEBUT) return;
      const { i, sens } = x;
      m[sens === 'haussier' ? 'haussiers' : 'baissiers']++;
      const suivant = cr[k + 1];
      for (const N of [10, 20]) {
        if (suivant && suivant.i - i <= N) { m.ar[N].k++; m.ar[N].n++; }
        else if (i + N <= c.length - 1) m.ar[N].n++;
      }
      if (i - PENTE_SEANCES >= 0 && ml[i - PENTE_SEANCES] != null) {
        const pente = (ml[i] / ml[i - PENTE_SEANCES] - 1) * 100;
        const g = Math.abs(pente) <= SEUIL_PENTE ? 'plate' : 'orientee';
        if (suivant && suivant.i - i <= 20) { m.pente[g].k++; m.pente[g].n++; }
        else if (i + 20 <= c.length - 1) m.pente[g].n++;
      }
      if (i - FENETRE_AVANT >= 0) {
        const fen = c.slice(i - FENETRE_AVANT, i + 1);
        m.avant[sens].push(sens === 'haussier' ? (c[i] / Math.min(...fen) - 1) * 100 : (c[i] / Math.max(...fen) - 1) * 100);
      }
      if (i + HORIZON <= c.length - 1) {
        const v = (c[i + HORIZON] / c[i] - 1) * 100;
        const bon = sens === 'haussier' ? v > 0 : v < 0;
        const compter = (g) => { g[sens].n++; g[sens].vars.push(v); if (bon) g[sens].k++; };
        compter(m.apres);
        const precedent = cr[k - 1];
        if (!precedent || i - precedent.i > 20) compter(m.isoles);
        compter(s[i].date < '2024-01-01' ? m.p1 : m.p2);
      }
    });
  }
  return m;
}

// Taux de base : toutes les séances où la moyenne longue existe et où l'on voit 20 séances plus loin.
let baseN = 0;
let baseH = 0;
let baseB = 0;
const basePeriode = { p1: { n: 0, h: 0, b: 0 }, p2: { n: 0, h: 0, b: 0 } };
for (const s of parCode.values()) {
  const c = s.map((p) => p.c);
  for (let i = LONGUE - 1; i + HORIZON < c.length; i++) {
    if (s[i].date < DEBUT) continue;
    const bp = basePeriode[s[i].date < '2024-01-01' ? 'p1' : 'p2'];
    baseN++;
    bp.n++;
    if (c[i + HORIZON] > c[i]) { baseH++; bp.h++; }
    else if (c[i + HORIZON] < c[i]) { baseB++; bp.b++; }
  }
}
const partBaseH = (baseH / baseN) * 100;
const partBaseB = (baseB / baseN) * 100;
const baseDe = (cle) => cle == null
  ? { haussier: partBaseH, baissier: partBaseB }
  : { haussier: (basePeriode[cle].h / basePeriode[cle].n) * 100, baissier: (basePeriode[cle].b / basePeriode[cle].n) * 100 };

function apres(a, sens, cle = null) {
  const base = baseDe(cle)[sens];
  const [lo, hi] = wilson(a.k, a.n);
  const assez = a.n >= MIN_CAS;
  const etabli = assez && (lo * 100 > base || hi * 100 < base);
  return {
    cas: a.n,
    part_pct: a.n ? r1((a.k / a.n) * 100) : null,
    part_base_pct: r1(base),
    ic95_pct: a.n ? [r1(lo * 100), r1(hi * 100)] : null,
    variation_mediane_pct: a.vars.length ? r1(mediane(a.vars)) : null,
    assez_de_cas: assez,
    ecart_etabli: etabli,
    ecart_sens: etabli ? (lo * 100 > base ? 'plus' : 'moins') : null,
  };
}
const part = (x) => ({ cas: x.n, allers_retours: x.k, part_pct: x.n ? r1((x.k / x.n) * 100) : null });

function resume(m) {
  return {
    croisements: m.haussiers + m.baissiers,
    haussiers: m.haussiers,
    baissiers: m.baissiers,
    par_valeur_et_par_an: r1((m.haussiers + m.baissiers) / m.anneesObservees),
    allers_retours_10: part(m.ar[10]),
    allers_retours_20: part(m.ar[20]),
    selon_pente: { plate: part(m.pente.plate), orientee: part(m.pente.orientee) },
    avant: {
      haussier_mediane_pct: r1(mediane(m.avant.haussier)),
      baissier_mediane_pct: r1(mediane(m.avant.baissier)),
      cas_haussiers: m.avant.haussier.length,
      cas_baissiers: m.avant.baissier.length,
    },
    apres_20: { haussier: apres(m.apres.haussier, 'haussier'), baissier: apres(m.apres.baissier, 'baissier') },
    robustesse: {
      isoles: { haussier: apres(m.isoles.haussier, 'haussier'), baissier: apres(m.isoles.baissier, 'baissier') },
      '2021-2023': { haussier: apres(m.p1.haussier, 'haussier', 'p1'), baissier: apres(m.p1.baissier, 'baissier', 'p1') },
      '2024-2026': { haussier: apres(m.p2.haussier, 'haussier', 'p2'), baissier: apres(m.p2.baissier, 'baissier', 'p2') },
    },
  };
}

const simple = mesurer('simple');
const expo = mesurer('exponentielle');

// Décalage : pour chaque croisement simple, le dernier croisement exponentiel
// de même sens, au plus 30 séances avant, sans croisement contraire entre les deux.
const decalages = { haussier: [], baissier: [] };
let sansEquivalent = 0;
for (const [code, cs] of simple.parCode) {
  const s = parCode.get(code);
  const ce = expo.parCode.get(code);
  for (const x of cs) {
    if (s[x.i].date < DEBUT) continue;
    const avant = ce.filter((e) => e.i <= x.i);
    const dernier = avant.at(-1);
    if (dernier && dernier.sens === x.sens && x.i - dernier.i <= DECALAGE_MAX) decalages[x.sens].push(x.i - dernier.i);
    else sansEquivalent++;
  }
}

// Liquidité : les 50 dernières séances du marché, valeur par valeur.
const dernieres = toutesDates.slice(-FENETRE_LIQUIDITE);
const premiereFenetre = dernieres[0];
const sansEchange = [];
for (const [code, s] of parCode) {
  const fen = s.filter((p) => p.date >= premiereFenetre);
  if (fen.length < FENETRE_LIQUIDITE) continue;
  sansEchange.push({ code, sans_echange: fen.filter((p) => !(p.v > 0)).length });
}
sansEchange.sort((a, b) => b.sans_echange - a.sans_echange);

// Exemple 1 : CBIBF, novembre 2026 (deux croisements en trois séances).
function exemple(code, nbSeances) {
  const s = parCode.get(code);
  const c = s.map((p) => p.c);
  const mc = smaSeries(c, COURTE);
  const ml = smaSeries(c, LONGUE);
  const debut = s.length - nbSeances;
  return {
    code,
    seances: s.slice(debut).map((p, k) => ({
      date: p.date, cloture: p.c, volume: p.v,
      moyenne_20: r1(mc[debut + k]), moyenne_50: r1(ml[debut + k]),
    })),
    croisements: simple.parCode.get(code).filter((x) => x.i >= debut).map((x) => ({ date: s[x.i].date, sens: x.sens })),
  };
}
const cbibf = exemple('CBIBF', 12);
// Les 70 dernières clôtures, pour que le test recalcule moyennes et croisements.
cbibf.clotures_70 = parCode.get('CBIBF').slice(-70).map((p) => ({ date: p.date, cloture: p.c }));

// Exemple 2 : FTSC, détachement d'un dividende en septembre 2025.
const ftscS = parCode.get('FTSC');
const iDet = ftscS.findIndex((p) => p.date === '2025-09-26');
const ftscC = ftscS.map((p) => p.c);
const ftscMc = smaSeries(ftscC, COURTE);
const ftscMl = smaSeries(ftscC, LONGUE);
const ftscCroisements = simple.parCode.get('FTSC').filter((x) => x.i >= iDet && x.i <= iDet + 30).map((x) => ({ date: ftscS[x.i].date, sens: x.sens, seances_apres: x.i - iDet }));
const ftsc = {
  code: 'FTSC',
  veille: { date: ftscS[iDet - 1].date, cloture: ftscC[iDet - 1] },
  seance: { date: ftscS[iDet].date, cloture: ftscC[iDet] },
  baisse_fcfa: ftscC[iDet - 1] - ftscC[iDet],
  baisse_pct: r1((ftscC[iDet] / ftscC[iDet - 1] - 1) * 100),
  moyennes_veille: { moyenne_20: r1(ftscMc[iDet - 1]), moyenne_50: r1(ftscMl[iDet - 1]) },
  moyennes_seance: {
    moyenne_20: r1(ftscMc[iDet]),
    moyenne_50: r1(ftscMl[iDet]),
    ecart_20_pct: r1((ftscC[iDet] / ftscMc[iDet] - 1) * 100),
    ecart_50_pct: r1((ftscC[iDet] / ftscMl[iDet] - 1) * 100),
  },
  dividende: faits.dividendes.FTSC,
  croisements_30_seances: ftscCroisements,
};

const sortie = {
  genere_le: '2026-11-24',
  periode: { debut: toutesDates.find((d) => d >= DEBUT), fin: derniereSeance },
  valeurs: parCode.size,
  parametres: { courte: COURTE, longue: LONGUE, horizon: HORIZON, fenetre_avant: FENETRE_AVANT, seuil_pente_pct: SEUIL_PENTE, min_cas: MIN_CAS },
  seances_par_an: seancesParAn,
  base_20: {
    cas: baseN, part_hausse_pct: r1(partBaseH), part_baisse_pct: r1(partBaseB), part_inchange_pct: r1(100 - partBaseH - partBaseB),
    '2021-2023': { cas: basePeriode.p1.n, part_hausse_pct: r1(baseDe('p1').haussier), part_baisse_pct: r1(baseDe('p1').baissier) },
    '2024-2026': { cas: basePeriode.p2.n, part_hausse_pct: r1(baseDe('p2').haussier), part_baisse_pct: r1(baseDe('p2').baissier) },
  },
  simple: resume(simple),
  exponentielle: resume(expo),
  decalage_exponentielle: {
    haussier_mediane_seances: mediane(decalages.haussier),
    baissier_mediane_seances: mediane(decalages.baissier),
    cas_haussiers: decalages.haussier.length,
    cas_baissiers: decalages.baissier.length,
    sans_equivalent: sansEquivalent,
  },
  liquidite: {
    fenetre: FENETRE_LIQUIDITE,
    du: premiereFenetre,
    au: derniereSeance,
    valeurs_mesurees: sansEchange.length,
    valeurs_10_plus: sansEchange.filter((x) => x.sans_echange >= 10).length,
    valeurs_25_plus: sansEchange.filter((x) => x.sans_echange >= 25).length,
    plus_touchees: sansEchange.slice(0, 5),
  },
  exemples: { cbibf, ftsc },
  dividendes_lus_le: faits.lu_le,
};

const DEST = path.join(ICI, '..', 'lib', 'academy', 'contenus', 'niveau3', 'sources', 'moyennes-brvm-2026-11-24.json');
fs.writeFileSync(DEST, `${JSON.stringify(sortie, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ...sortie, exemples: { cbibf: { croisements: cbibf.croisements }, ftsc: { ...ftsc } } }, null, 1));
