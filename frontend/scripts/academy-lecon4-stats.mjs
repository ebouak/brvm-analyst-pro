#!/usr/bin/env node
// Mesure du RSI sur les clôtures RÉELLES de la BRVM, pour la leçon 4 du
// niveau 3 et son « Focus BRVM ». Lit trois exports de la base et écrit
// lib/academy/contenus/niveau3/sources/rsi-brvm-2026-11-24.json.
//
//   node --no-warnings scripts/academy-lecon4-stats.mjs <export.json> <detachements.json> <classes.json>
//
//   export.json       : lignes {code, date, c (clôture), v (titres), x (valeur échangée)}
//   detachements.json : lignes {code, ex_date, exercice, montant, source} (table dividends)
//   classes.json      : lignes {code, classe, score} (liquidity_daily, dernière séance)
//
// Le RSI est celui de lib/indicators.ts (rsiSeries, lissage de Wilder), chargé
// tel quel : la leçon, le simulateur et la mesure calculent le même RSI.
//
// Ce que mesure ce script, et rien d'autre :
//  - la part des séances en zone extrême, toutes valeurs et par classe de liquidité ;
//  - les seuils qui rendraient une zone aussi rare, dans chaque classe, que 70 et 30
//    en classe A ;
//  - à l'ENTRÉE en survente (passage sous 30) ou en surachat (passage au-dessus de
//    70) : le cours 20 séances plus tard, comparé à une séance quelconque (Wilson
//    95 %, au moins 30 cas), au total, selon la tendance (cours face à sa moyenne
//    50 séances) et par classe ; et combien de séances la zone a duré ;
//  - le RSI des valeurs sans échange ; sa variation le jour d'un détachement de
//    dividende daté ; la valeur échangée moyenne par mois (2023-2025, seules années
//    où elle est renseignée sur toutes les lignes).
// La classe de liquidité est celle d'aujourd'hui, appliquée à tout l'historique :
// la table n'existe que depuis juillet 2026. Ce n'est pas un test de stratégie.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const { rsiSeries, smaSeries } = await import(pathToFileURL(path.join(ICI, '..', 'lib', 'indicators.ts')).href);

const [EXPORT, DETACH, FICHIER_CLASSES] = process.argv.slice(2);
const lire = (f) => JSON.parse(fs.readFileSync(f, 'utf8')).rows;
// Dernière séance COMPLÈTE au moment de l'export : celle du 24/11/2026 était en
// cours (cours intraday, pas des clôtures). Rien n'est lu au-delà.
const FIN = '2026-11-23';
const lignes = lire(EXPORT).filter((r) => r.date <= FIN);
const detachements = lire(DETACH);
const classes = new Map(lire(FICHIER_CLASSES).map((r) => [r.code, r.classe]));

const PERIODE = 14;
const HORIZON = 20;
const MIN_CAS = 30;
const DEBUT = '2021-01-01';
const CLASSES = ['A', 'B', 'C', 'D'];
const CAS_20_NOV = ['SCRC', 'CBIBF', 'SAFC', 'NSBC', 'BBGC'];

const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
const mediane = (xs) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const quantile = (xs, q) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))];
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

const parCode = new Map();
for (const r of lignes) {
  if (!parCode.has(r.code)) parCode.set(r.code, []);
  parCode.get(r.code).push({ date: r.date, c: Number(r.c), v: Number(r.v), x: Number(r.x) });
}
const series = new Map();
for (const [code, s] of parCode) {
  s.sort((a, b) => a.date.localeCompare(b.date));
  const c = s.map((p) => p.c);
  series.set(code, { s, c, rsi: rsiSeries(c, PERIODE), ma50: smaSeries(c, 50), classe: classes.get(code) ?? null });
}
const toutesDates = [...new Set(lignes.map((r) => r.date))].sort();
const derniereSeance = toutesDates.at(-1);

// ── 1. Zones : part des séances, et seuils équivalents ──────────────────────
const zones = { tout: { n: 0, h70: 0, b30: 0, h80: 0, b20: 0 } };
const valeursRsi = { tout: [] };
for (const k of CLASSES) { zones[k] = { n: 0, h70: 0, b30: 0, h80: 0, b20: 0 }; valeursRsi[k] = []; }
for (const { s, rsi, classe } of series.values()) {
  for (let i = 0; i < s.length; i++) {
    if (s[i].date < DEBUT || rsi[i] == null) continue;
    for (const g of ['tout', classe].filter(Boolean)) {
      const z = zones[g];
      z.n++;
      if (rsi[i] >= 70) z.h70++;
      if (rsi[i] <= 30) z.b30++;
      if (rsi[i] >= 80) z.h80++;
      if (rsi[i] <= 20) z.b20++;
      valeursRsi[g].push(rsi[i]);
    }
  }
}
const partZone = (z) => ({
  seances: z.n,
  surachat_70_pct: r1((z.h70 / z.n) * 100),
  survente_30_pct: r1((z.b30 / z.n) * 100),
  surachat_80_pct: r1((z.h80 / z.n) * 100),
  survente_20_pct: r1((z.b20 / z.n) * 100),
});
// Séances EN zone (pas seulement les entrées), selon la position du cours face à sa moyenne 50.
const zonesPosition = { survente: { 'au-dessus': 0, sous: 0 }, surachat: { 'au-dessus': 0, sous: 0 } };
for (const { s, c, rsi, ma50 } of series.values()) {
  for (let i = 0; i < s.length; i++) {
    if (s[i].date < DEBUT || rsi[i] == null || ma50[i] == null) continue;
    const pos = c[i] > ma50[i] ? 'au-dessus' : 'sous';
    if (rsi[i] < 30) zonesPosition.survente[pos]++;
    if (rsi[i] > 70) zonesPosition.surachat[pos]++;
  }
}
const refHaut = zones.A.h70 / zones.A.n;
const refBas = zones.A.b30 / zones.A.n;
const seuilsEquivalents = Object.fromEntries(CLASSES.map((k) => [k, {
  haut: Math.round(quantile(valeursRsi[k], 1 - refHaut)),
  bas: Math.round(quantile(valeursRsi[k], refBas)),
}]));

// ── 2. Entrées en zone : ce qui a suivi ─────────────────────────────────────
const nouveau = () => ({ k: 0, n: 0, vars: [] });
const base = { tout: { n: 0, h: 0, b: 0 } };
for (const k of CLASSES) base[k] = { n: 0, h: 0, b: 0 };
for (const { s, c, rsi, classe } of series.values()) {
  for (let i = 0; i + HORIZON < c.length; i++) {
    if (s[i].date < DEBUT || rsi[i] == null) continue;
    for (const g of ['tout', classe].filter(Boolean)) {
      base[g].n++;
      if (c[i + HORIZON] > c[i]) base[g].h++;
      else if (c[i + HORIZON] < c[i]) base[g].b++;
    }
  }
}
const ev = {
  survente: { tout: nouveau(), 'au-dessus': nouveau(), sous: nouveau(), A: nouveau(), B: nouveau(), C: nouveau(), D: nouveau() },
  surachat: { tout: nouveau(), 'au-dessus': nouveau(), sous: nouveau(), A: nouveau(), B: nouveau(), C: nouveau(), D: nouveau() },
};
const durees = { survente: [], surachat: [] };
const entrees = { survente: 0, surachat: 0 };
for (const { s, c, rsi, ma50, classe } of series.values()) {
  for (let i = 1; i < c.length; i++) {
    if (s[i].date < DEBUT || rsi[i] == null || rsi[i - 1] == null) continue;
    const zone = rsi[i] < 30 && rsi[i - 1] >= 30 ? 'survente' : rsi[i] > 70 && rsi[i - 1] <= 70 ? 'surachat' : null;
    if (!zone) continue;
    entrees[zone]++;
    let j = i;
    while (j < c.length && rsi[j] != null && (zone === 'survente' ? rsi[j] < 30 : rsi[j] > 70)) j++;
    if (j < c.length) durees[zone].push(j - i);
    if (i + HORIZON >= c.length) continue;
    const v = (c[i + HORIZON] / c[i] - 1) * 100;
    const attendu = zone === 'survente' ? v > 0 : v < 0; // lecture courante : rebond après survente, repli après surachat
    const groupes = ['tout', classe];
    if (ma50[i] != null) groupes.push(c[i] > ma50[i] ? 'au-dessus' : 'sous');
    for (const g of groupes.filter(Boolean)) {
      const x = ev[zone][g];
      x.n++;
      x.vars.push(v);
      if (attendu) x.k++;
    }
  }
}
function apres(x, zone, g) {
  const b = base[CLASSES.includes(g) ? g : 'tout'];
  const partBase = ((zone === 'survente' ? b.h : b.b) / b.n) * 100;
  const [lo, hi] = wilson(x.k, x.n);
  const assez = x.n >= MIN_CAS;
  const etabli = assez && (lo * 100 > partBase || hi * 100 < partBase);
  return {
    cas: x.n,
    part_pct: x.n ? r1((x.k / x.n) * 100) : null,
    part_base_pct: r1(partBase),
    ic95_pct: x.n ? [r1(lo * 100), r1(hi * 100)] : null,
    variation_mediane_pct: x.vars.length ? r1(mediane(x.vars)) : null,
    assez_de_cas: assez,
    ecart_etabli: etabli,
    ecart_sens: etabli ? (lo * 100 > partBase ? 'plus' : 'moins') : null,
  };
}
const resultats = Object.fromEntries(['survente', 'surachat'].map((z) => [z, Object.fromEntries(Object.entries(ev[z]).map(([g, x]) => [g, apres(x, z, g)]))]));

// ── 3. RSI figé : les valeurs sans échange ──────────────────────────────────
const figes = [];
for (const [code, { s, rsi }] of series) {
  const fin = s.length - 1;
  let k = fin;
  while (k > 0 && s[k].c === s[k - 1].c) k--;
  const seancesFigees = fin - k;
  if (seancesFigees < PERIODE) continue;
  let dernierEchange = null;
  for (let i = fin; i >= 0; i--) if (s[i].v > 0) { dernierEchange = s[i].date; break; }
  figes.push({ code, cours: s[fin].c, seances_sans_variation: seancesFigees, depuis: s[k].date, rsi_au_debut: r1(rsi[k]), rsi_aujourdhui: r1(rsi[fin]), dernier_echange: dernierEchange });
}

// ── 4. Détachements de dividende datés ──────────────────────────────────────
const det = [];
for (const d of detachements) {
  const se = series.get(d.code);
  if (!se) continue;
  const i = se.s.findIndex((p) => p.date === d.ex_date);
  if (i < 1 || se.rsi[i] == null || se.rsi[i - 1] == null) continue;
  det.push({
    code: d.code, date: d.ex_date, montant: d.montant,
    rendement_pct: r1((d.montant / se.c[i - 1]) * 100),
    variation_cours_pct: r1((se.c[i] / se.c[i - 1] - 1) * 100),
    rsi_veille: r1(se.rsi[i - 1]), rsi_jour: r1(se.rsi[i]),
    ecart_rsi: r1(se.rsi[i] - se.rsi[i - 1]),
  });
}
const autresJours = [];
for (const { s, rsi } of series.values()) {
  for (let i = 1; i < s.length; i++) if (s[i].date >= '2026-01-01' && rsi[i] != null && rsi[i - 1] != null) autresJours.push(rsi[i] - rsi[i - 1]);
}

// ── 5. Valeur échangée par mois, 2023-2025 ──────────────────────────────────
const parJour = new Map();
for (const r of lignes) if (r.date >= '2023-01-01' && r.date < '2026-01-01') parJour.set(r.date, (parJour.get(r.date) ?? 0) + Number(r.x));
const parMois = Array.from({ length: 12 }, () => ({ somme: 0, seances: 0, jours: [] }));
for (const [d, x] of parJour) { const m = Number(d.slice(5, 7)) - 1; parMois[m].somme += x; parMois[m].seances++; parMois[m].jours.push(x); }
const moyenneJour = [...parJour.values()].reduce((t, x) => t + x, 0) / parJour.size;
const medianeJour = mediane([...parJour.values()]);
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
// Moyenne ET médiane : quelques séances de blocs (cessions de gros paquets) tirent la moyenne.
const calendrier = parMois.map((m, i) => ({
  mois: MOIS[i],
  seances: m.seances,
  valeur_par_seance_md: r1(m.somme / m.seances / 1e9),
  indice: Math.round(((m.somme / m.seances) / moyenneJour) * 100),
  mediane_md: r1(mediane(m.jours) / 1e9),
  indice_mediane: Math.round((mediane(m.jours) / medianeJour) * 100),
}));

// ── 5 bis. Variation du cours depuis la première séance de 2021 ─────────────
// (la fréquence des zones dépend aussi de la tendance de chaque valeur).
const performances = [];
for (const [code, { s }] of series) {
  const d = s.find((p) => p.date >= DEBUT);
  if (!d || d.date > '2021-01-31') continue;
  performances.push({ code, classe: classes.get(code) ?? null, depuis: d.date, variation_pct: r1((s.at(-1).c / d.c - 1) * 100) });
}
const performance2021 = {
  mediane_pct: r1(mediane(performances.map((p) => p.variation_pct))),
  valeurs: performances.length,
  classe_A: performances.filter((p) => p.classe === 'A').sort((a, b) => b.variation_pct - a.variation_pct),
};

// ── 6. Les cinq valeurs citées par la relecture, au 20 novembre 2026 ─────────
const cas20 = CAS_20_NOV.map((code) => {
  const se = series.get(code);
  const i = se.s.findIndex((p) => p.date === '2026-11-20');
  const i14 = Math.max(0, i - 13);
  return {
    code, classe: se.classe, cours: se.c[i], rsi: r1(se.rsi[i]),
    moyenne_50: se.ma50[i] == null ? null : Math.round(se.ma50[i]),
    position_50: se.ma50[i] == null ? null : se.c[i] > se.ma50[i] ? 'au-dessus' : 'sous',
    seances_echangees_14: se.s.slice(i14, i + 1).filter((p) => p.v > 0).length,
    seances_cotees: i + 1,
  };
});

const sortie = {
  genere_le: '2026-11-24',
  periode: { debut: toutesDates.find((d) => d >= DEBUT), fin: derniereSeance },
  valeurs: series.size,
  parametres: { periode: PERIODE, horizon: HORIZON, min_cas: MIN_CAS, methode: 'Wilder (lib/indicators.ts, rsiSeries)' },
  classes_au: '2026-11-23',
  valeurs_par_classe: Object.fromEntries(CLASSES.map((k) => [k, [...series.entries()].filter(([, x]) => x.classe === k).map(([c]) => c)])),
  zones: Object.fromEntries(Object.entries(zones).map(([g, z]) => [g, partZone(z)])),
  seuils_equivalents: seuilsEquivalents,
  seances_en_zone_selon_moyenne_50: zonesPosition,
  base_20: Object.fromEntries(Object.entries(base).map(([g, b]) => [g, { cas: b.n, part_hausse_pct: r1((b.h / b.n) * 100), part_baisse_pct: r1((b.b / b.n) * 100) }])),
  entrees,
  duree_mediane_seances: { survente: mediane(durees.survente), surachat: mediane(durees.surachat) },
  part_zone_plus_de_10_seances_pct: {
    survente: r1((durees.survente.filter((x) => x > 10).length / durees.survente.length) * 100),
    surachat: r1((durees.surachat.filter((x) => x > 10).length / durees.surachat.length) * 100),
  },
  apres_20: resultats,
  figes,
  detachements: {
    cas: det.length,
    ecart_rsi_median: r1(mediane(det.map((d) => d.ecart_rsi))),
    ecart_rsi_median_autres_jours_2026: r1(mediane(autresJours)),
    variation_cours_mediane_pct: r1(mediane(det.map((d) => d.variation_cours_pct))),
    rendement_median_pct: r1(mediane(det.map((d) => d.rendement_pct))),
    baisse_de_10_points_ou_plus: det.filter((d) => d.ecart_rsi <= -10).length,
    passages_sous_30: det.filter((d) => d.rsi_jour < 30 && d.rsi_veille >= 30).length,
    plus_fortes: [...det].sort((a, b) => a.ecart_rsi - b.ecart_rsi).slice(0, 5),
    par_mois: Object.fromEntries(Object.entries(det.reduce((m, d) => ({ ...m, [d.date.slice(0, 7)]: (m[d.date.slice(0, 7)] ?? 0) + 1 }), {})).sort()),
  },
  calendrier_2023_2025: calendrier,
  performance_depuis_2021: performance2021,
  cas_20_novembre: cas20,
};

const DEST = path.join(ICI, '..', 'lib', 'academy', 'contenus', 'niveau3', 'sources', 'rsi-brvm-2026-11-24.json');
fs.writeFileSync(DEST, `${JSON.stringify(sortie, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(sortie, null, 1));
