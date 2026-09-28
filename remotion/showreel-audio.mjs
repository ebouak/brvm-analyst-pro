// Bande-son du showreel WestBourse — synthétisée ici, sans échantillon ni
// banque de sons : aucune licence à gérer, et le rythme colle au montage.
//
// 120 BPM : un temps = 0,5 s = 15 images à 30 i/s ; une mesure = 2 s = 60
// images. Toutes les coupes du montage (showreel.tsx) tombent sur une mesure.
//
// La voix off (public/voix/*.wav, produite par showreel-voix.mjs) est mixée
// ici, et la musique s'efface sous elle (ducking) : on entend la phrase, pas
// une lutte entre les deux.
//
// Usage : node showreel-audio.mjs  →  public/showreel-audio.wav

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const plan = JSON.parse(readFileSync(new URL('./showreel-plan.json', import.meta.url), 'utf8'));
const FPS = 30;
const DEBUT = {};
let cumulImages = 0;
for (const s of plan.scenes) { DEBUT[s.id] = cumulImages / FPS; cumulImages += s.duree; }

const SR = 44100;
const DUREE = cumulImages / FPS;
const N = SR * DUREE;
const L = new Float32Array(N);
const R = new Float32Array(N);
const BPM = 120;
const TEMPS = 60 / BPM;
const MESURE = TEMPS * 4;

// Coupes du montage, en secondes — dérivées du plan, jamais saisies ici.
const COUPES = { probleme: DEBUT.probleme, solution: DEBUT.solution, fonctions: DEBUT.fonctions, ambition: DEBUT.ambition, fin: DEBUT.fin };
const PANNEAU = plan.scenes.find((s) => s.id === 'fonctions').duree / 4 / FPS;
const PANNEAUX = [1, 2, 3].map((k) => COUPES.fonctions + k * PANNEAU);

let graine = 7;
const alea = () => { graine = (graine * 1664525 + 1013904223) >>> 0; return graine / 4294967296; };
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

function ajoute(t0, echantillons, gain = 1, pan = 0) {
  const i0 = Math.round(t0 * SR);
  const gl = gain * Math.min(1, 1 - pan), gr = gain * Math.min(1, 1 + pan);
  for (let i = 0; i < echantillons.length; i++) {
    const k = i0 + i;
    if (k < 0 || k >= N) continue;
    L[k] += echantillons[i] * gl;
    R[k] += echantillons[i] * gr;
  }
}

// ── Instruments ─────────────────────────────────────────────────────────────
function kick(force = 1) {
  const n = Math.round(0.45 * SR), out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 45 + 110 * Math.exp(-t * 28);
    ph += (2 * Math.PI * f) / SR;
    out[i] = Math.sin(ph) * Math.exp(-t * 7) * force + (i < 200 ? (alea() - 0.5) * 0.3 * (1 - i / 200) : 0);
  }
  return out;
}

function bruit(duree, decl, passeHaut = 0.9) {
  const n = Math.round(duree * SR), out = new Float32Array(n);
  let prec = 0;
  for (let i = 0; i < n; i++) {
    const b = alea() * 2 - 1;
    const h = b - prec * passeHaut; prec = b;
    out[i] = h * Math.exp(-(i / SR) * decl);
  }
  return out;
}

function clap() {
  const a = bruit(0.22, 18, 0.6);
  for (let i = 0; i < a.length; i++) {
    const t = i / SR;
    a[i] *= t < 0.03 ? 1 + 0.6 * Math.sin(t * 900) : 1;
  }
  return a;
}

/** Voix de synthé : dents de scie désaccordées + passe-bas à un pôle. */
function voix(notes, duree, { attaque = 0.01, decl = 0, coupure = 0.2, desacc = 0.006, relache = 0.05, onde = 'scie' } = {}) {
  const n = Math.round(duree * SR), out = new Float32Array(n);
  const phases = notes.flatMap(() => [0, 0.33, 0.66]);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let s = 0;
    notes.forEach((m, j) => {
      [-1, 0, 1].forEach((d, k) => {
        const idx = j * 3 + k;
        phases[idx] = (phases[idx] + (hz(m) * (1 + d * desacc)) / SR) % 1;
        const p = phases[idx];
        s += onde === 'carre' ? (p < 0.5 ? 1 : -1) : onde === 'sinus' ? Math.sin(2 * Math.PI * p) : 2 * p - 1;
      });
    });
    s /= notes.length * 3;
    lp += coupure * (s - lp);
    let env = Math.min(1, t / attaque);
    if (decl) env *= Math.exp(-t * decl);
    const fin = duree - t;
    if (fin < relache) env *= fin / relache;
    out[i] = lp * env;
  }
  return out;
}

function whoosh(duree = 0.9, montee = true) {
  const n = Math.round(duree * SR), out = new Float32Array(n);
  let lp = 0, bp = 0;
  for (let i = 0; i < n; i++) {
    const x = i / n;
    const c = montee ? 0.02 + 0.5 * x ** 2 : 0.5 - 0.48 * x;
    const b = alea() * 2 - 1;
    lp += c * (b - lp);
    bp += 0.3 * (lp - bp);
    out[i] = (lp - bp) * Math.sin(Math.PI * x) ** 1.5 * 2.2;
  }
  return out;
}

function impact() {
  const k = kick(1.4), q = bruit(1.4, 3, 0.2), out = new Float32Array(Math.round(1.6 * SR));
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    out[i] = (k[i] || 0) + (q[i] || 0) * 0.25 + Math.sin(2 * Math.PI * 38 * t) * Math.exp(-t * 2.2) * 0.6;
  }
  return out;
}

function clic() {
  const n = Math.round(0.05 * SR), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = Math.sin(2 * Math.PI * 2400 * t) * Math.exp(-t * 180) + (alea() - 0.5) * Math.exp(-t * 400) * 0.4;
  }
  return out;
}

function bip(f0 = 1400, f1 = 2100) {
  const n = Math.round(0.09 * SR), out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const x = i / n;
    ph += (2 * Math.PI * (f0 + (f1 - f0) * x)) / SR;
    out[i] = Math.sin(ph) * Math.sin(Math.PI * x) * 0.7;
  }
  return out;
}

function montee(duree) {
  const n = Math.round(duree * SR), out = new Float32Array(n);
  let lp = 0, ph = 0;
  for (let i = 0; i < n; i++) {
    const x = i / n;
    lp += (0.01 + 0.3 * x * x) * ((alea() * 2 - 1) - lp);
    ph += (2 * Math.PI * (200 + 1400 * x * x)) / SR;
    out[i] = (lp * 0.9 + Math.sin(ph) * 0.15) * x ** 2;
  }
  return out;
}

// ── Harmonie : la mineur, i – VI – III – VII (Am F C G), une mesure chacun ──
const ACCORDS = [
  { basse: 45, notes: [57, 60, 64] }, // Am
  { basse: 41, notes: [53, 57, 60] }, // F
  { basse: 48, notes: [55, 60, 64] }, // C
  { basse: 43, notes: [55, 59, 62] }, // G
];
const accordA = (t) => ACCORDS[Math.floor(t / MESURE) % 4];

// Intensité par section : [pad, basse, arpège, kick, charley, clap]
function section(t) {
  if (t < COUPES.probleme) return [0.9, 0, t > 4 ? 0.35 : 0, 0, 0, 0];
  if (t < COUPES.solution) return [0.7, 0.45, 0.4, 0.55, 0.25, 0];
  if (t < COUPES.ambition) return [0.55, 0.8, 0.6, 1, 0.6, 0.7];
  if (t < COUPES.fin) return [0.75, 0.9, 0.85, 1, 0.8, 0.8];
  return [1, 0.5, 0.4, t < COUPES.fin + 4 ? 0.8 : 0, 0.3, 0];
}

// Pad : une nappe par mesure
for (let m = 0; m * MESURE < DUREE; m++) {
  const t = m * MESURE;
  const [pad] = section(t);
  const a = accordA(t);
  ajoute(t, voix([...a.notes, a.notes[0] + 12], MESURE + 0.3, { attaque: 0.4, coupure: 0.05, relache: 0.4 }), 0.55 * pad, -0.15);
  ajoute(t, voix([a.notes[1] + 12], MESURE + 0.3, { attaque: 0.6, coupure: 0.03, relache: 0.4, onde: 'sinus' }), 0.25 * pad, 0.2);
}

// Pas de double croche : basse, arpège, batterie
const DOUBLE = TEMPS / 4;
for (let k = 0; k * DOUBLE < DUREE; k++) {
  const t = k * DOUBLE;
  const [, basse, arp, kk, hh, cl] = section(t);
  const a = accordA(t);
  const pos = k % 16;

  if (basse && pos % 2 === 0) {
    const note = pos % 8 === 6 ? a.basse + 12 : a.basse;
    ajoute(t, voix([note], DOUBLE * 1.8, { coupure: 0.08, decl: 6, onde: 'scie', desacc: 0.002 }), 0.8 * basse);
    ajoute(t, voix([note - 12], DOUBLE * 1.8, { coupure: 0.2, decl: 5, onde: 'sinus' }), 0.7 * basse);
  }
  if (arp) {
    const motif = [0, 1, 2, 3, 2, 1, 0, 2];
    const tons = [...a.notes, a.notes[0] + 12];
    const note = tons[motif[pos % 8]] + 12;
    ajoute(t, voix([note], DOUBLE * 1.6, { coupure: 0.25, decl: 14, onde: 'carre', desacc: 0.003 }), 0.22 * arp, pos % 2 ? 0.35 : -0.35);
  }
  if (kk && pos % 4 === 0) ajoute(t, kick(), 0.95 * kk);
  if (hh && pos % 2 === 1) ajoute(t, bruit(0.05, 70, 0.95), (pos % 4 === 2 ? 0.2 : 0.12) * hh, 0.25);
  if (cl && (pos === 4 || pos === 12)) ajoute(t, clap(), 0.45 * cl, -0.1);
}

// Roulement de caisse avant l'ambition, puis avant la fin
for (const cible of [COUPES.ambition, COUPES.fin]) {
  for (let i = 0; i < 16; i++) {
    const t = cible - MESURE + i * (MESURE / 16);
    ajoute(t, clap(), 0.12 + 0.35 * (i / 16));
  }
}

// ── Effets synchronisés au montage ──────────────────────────────────────────
ajoute(0, montee(COUPES.probleme - 0.2), 0.35);
ajoute(COUPES.solution - 4, montee(4), 0.45);
for (const c of Object.values(COUPES)) ajoute(c - 0.6, whoosh(1.1), 0.55);
for (const p of PANNEAUX) ajoute(p - 0.45, whoosh(0.8), 0.4);
ajoute(COUPES.solution, impact(), 0.9);
ajoute(COUPES.fin, impact(), 1);
ajoute(COUPES.fonctions, impact(), 0.55);

// Clics d'interface : apparitions du tableau de bord et des panneaux
const S = COUPES.solution, F = COUPES.fonctions;
const clics = [
  ...[0.9, 1.3, 1.5, 1.7, 1.9, 2.8, 3.4].map((d) => S + d),
  ...[0, 1, 2, 3].flatMap((k) => [0.7, 1.3].map((d) => F + k * PANNEAU + d)),
  COUPES.fin + 3.5,
];
clics.forEach((t, i) => ajoute(t, clic(), 0.35, i % 2 ? 0.3 : -0.3));
// Sons de données : bips discrets sur les chiffres
for (let t = 1.5; t < 7.5; t += 0.75) ajoute(t, bip(1200 + alea() * 800, 1800 + alea() * 800), 0.08, alea() - 0.5);
for (let t = F + 1; t < COUPES.ambition - 1; t += 1.5) ajoute(t, bip(1500, 2300), 0.05, alea() - 0.5);

// ── Voix off ────────────────────────────────────────────────────────────────
function litWav(chemin) {
  const b = readFileSync(chemin);
  let o = 12;
  while (o < b.length - 8) {
    const id = b.toString('ascii', o, o + 4), taille = b.readUInt32LE(o + 4);
    if (id === 'data') {
      const n = taille / 2, out = new Float32Array(n);
      for (let i = 0; i < n; i++) out[i] = b.readInt16LE(o + 8 + i * 2) / 32768;
      return out;
    }
    o += 8 + taille + (taille % 2);
  }
  throw new Error(`pas de bloc data dans ${chemin}`);
}

const V = new Float32Array(N);
let voixPresente = 0;
for (const v of plan.voix) {
  const chemin = new URL(`./public/voix/${v.id}.wav`, import.meta.url);
  if (!existsSync(chemin)) continue;
  const e = litWav(chemin);
  let crete = 0;
  for (const x of e) crete = Math.max(crete, Math.abs(x));
  const i0 = Math.round((DEBUT[v.scene] + v.decalage / FPS) * SR);
  for (let i = 0; i < e.length && i0 + i < N; i++) V[i0 + i] += (e[i] / (crete || 1)) * 0.92;
  voixPresente++;
}

// Enveloppe de la voix (attaque 15 ms, relâche 350 ms) → gain de la musique.
const duck = new Float32Array(N);
{
  const att = 1 - Math.exp(-1 / (0.015 * SR)), rel = 1 - Math.exp(-1 / (0.35 * SR));
  let env = 0;
  for (let i = 0; i < N; i++) {
    const x = Math.abs(V[i]);
    env += (x > env ? att : rel) * (x - env);
    duck[i] = 1 - 0.62 * Math.min(1, env * 6);
  }
}

// ── Mastering : normalisation, saturation douce, fondus ─────────────────────
let crete = 0;
for (let i = 0; i < N; i++) crete = Math.max(crete, Math.abs(L[i]), Math.abs(R[i]));
const g = 1.6 / crete;
const MUSIQUE = voixPresente ? 0.62 : 1;
const buf = Buffer.alloc(44 + N * 4);
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const fondu = Math.min(1, t / 0.5, (DUREE - t) / 2.5);
  const ml = Math.tanh(L[i] * g) * MUSIQUE * duck[i], mr = Math.tanh(R[i] * g) * MUSIQUE * duck[i];
  const l = Math.tanh((ml + V[i]) * 1.05) * 0.9 * fondu, r = Math.tanh((mr + V[i]) * 1.05) * 0.9 * fondu;
  buf.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(r * 32767), 46 + i * 4);
}
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8);
buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);

mkdirSync(new URL('./public/', import.meta.url), { recursive: true });
writeFileSync(new URL('./public/showreel-audio.wav', import.meta.url), buf);
console.log(`showreel-audio.wav : ${DUREE} s, ${voixPresente} phrases de voix off, crête musique ${crete.toFixed(2)}`);
