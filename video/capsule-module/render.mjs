// Rendu générique des capsules vidéo Academy (stills ou full + assemblage habillage officiel).
//   node video/capsule-module/render.mjs stills <id>
//   node video/capsule-module/render.mjs full <id> [--fps 30] [--sub 2]
import { chromium } from 'playwright';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { lirePlan, photosAbsentes } from './auteur.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const VIDEO_ROOT = path.resolve(ICI, '..');

const args = process.argv.slice(2);
const mode = args[0];
const id = args[1];
if (!mode || !id || !/^[a-z0-9-]+$/.test(id)) {
  console.error('Usage : node video/capsule-module/render.mjs <stills|full> <id> [--fps 30] [--sub 2]');
  process.exit(1);
}

const optVal = (flag, def = null) => {
  const idx = args.indexOf(flag);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
};
const optNum = (flag, def) => {
  const v = optVal(flag);
  return v ? Math.max(1, Number(v) || def) : def;
};
const FPS = optNum('--fps', 30);
const SUB = optNum('--sub', 2);
const WORKERS = optNum('--workers', 4);

const PLAN_PATH = path.join(ICI, 'capsules', `${id}.json`);
const OUT = path.join(VIDEO_ROOT, 'out', 'capsule-module', id);
const voixArg = optVal('--voix', null);
const voixDossier = voixArg === 'jye'
  ? 'voix-jye'
  : voixArg === 'amadou'
    ? 'voix-amadou'
    : voixArg === 'edge'
      ? 'voix-edge'
      : fs.existsSync(path.join(OUT, 'voix-jye', 'ordre.json'))
        ? 'voix-jye'
        : fs.existsSync(path.join(OUT, 'voix-amadou', 'ordre.json'))
          ? 'voix-amadou'
          : 'voix-edge';
const VOIX_DIR = path.join(OUT, voixDossier);
const PAGE = pathToFileURL(path.join(ICI, 'index.html')).href;
fs.mkdirSync(OUT, { recursive: true });
console.log(`Source voix : ${VOIX_DIR}`);

// Marqueurs {auteur.*} résolus depuis auteur.json (local, hors dépôt : voir auteur.mjs).
const PLAN = lirePlan(PLAN_PATH);
// Les portraits sont gardés hors du dépôt public : une photo absente donnerait une
// vidéo sans visage, sans la moindre erreur. On refuse de rendre.
const ABSENTES = photosAbsentes(PLAN);
if (ABSENTES.length) {
  console.error(`Photo(s) absente(s) : ${ABSENTES.join(', ')}\nLes portraits ne sont pas versionnés (README, « Hors dépôt ») : copiez-les dans video/capsule-module/.`);
  process.exit(1);
}

function minutage() {
  const ordre = JSON.parse(fs.readFileSync(path.join(VOIX_DIR, 'ordre.json'), 'utf8'));
  const spkFile = path.join(VOIX_DIR, 'speakers.json');
  const speakers = fs.existsSync(spkFile) ? JSON.parse(fs.readFileSync(spkFile, 'utf8')) : {};
  const scenes = {};
  let t = 0;
  for (let i = 0; i < ordre.length; i++) {
    const sid = ordre[i];
    const f = path.join(VOIX_DIR, `${sid}.json`);
    if (!fs.existsSync(f)) throw new Error(`voix absente : ${f}`);
    const mots = JSON.parse(fs.readFileSync(f, 'utf8'));
    const speaker = speakers[sid] || (sid.endsWith('_q') ? 'journaliste' : 'expert');
    const prevWasQuestion = i > 0 && ordre[i - 1].endsWith('_q');
    const pre = sid === 'hook' ? 0.5 : sid === 'fin' ? 2.1 : sid.endsWith('_q') ? 0.45 : prevWasQuestion ? 0.45 : 0.85;
    const post = sid === 'fin' ? 2.0 : sid.endsWith('_q') ? 0.30 : 0.50;
    const v = t + pre;
    const fin = v + mots[mots.length - 1].b;
    scenes[sid] = {
      s: +t.toFixed(3),
      v: +v.toFixed(3),
      e: +(fin + post).toFixed(3),
      speaker,
      mots: mots.map((m) => ({ m: m.m, a: +(v + m.a).toFixed(3), b: +(v + m.b).toFixed(3) })),
    };
    t = fin + post;
  }
  return { scenes, duration: +t.toFixed(3), ordre };
}

const VX = minutage();

async function ouvrir(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(String(e)));
  await page.addInitScript(`window.__PLAN = ${JSON.stringify(PLAN)}; window.__VOIX = ${JSON.stringify(VX)};`);
  await page.goto(PAGE);
  await page.waitForFunction(() => window.__ready === true || window.__erreur, null, { timeout: 60000 });
  const err = await page.evaluate(() => window.__erreur);
  if (err || erreurs.length) throw new Error(`page en erreur : ${err || erreurs.join('\n')}`);
  return page;
}

function ffmpeg(ffArgs) {
  const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...ffArgs], {
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  const fin = new Promise((ok, ko) => p.on('close', (c) => (c === 0 ? ok() : ko(new Error(`ffmpeg ${c}`)))));
  return { p, fin };
}

async function stills() {
  const browser = await chromium.launch();
  const page = await ouvrir(browser);
  const tl = await page.evaluate(() => ({ BEATS: window.__timeline.BEATS, DURATION: window.__timeline.DURATION }));
  const dir = path.join(OUT, 'stills');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  let i = 0;
  for (const t of tl.BEATS) {
    await page.evaluate((x) => window.seek(x), t);
    await page.screenshot({ path: path.join(dir, `seq_${String(i++).padStart(3, '0')}.png`) });
  }
  await browser.close();
  fs.writeFileSync(path.join(dir, 'temps.txt'), tl.BEATS.map((t, k) => `${k}\t${t}`).join('\n'));
  const cols = Math.min(4, Math.max(1, tl.BEATS.length));
  const rows = Math.ceil(tl.BEATS.length / cols);
  await ffmpeg([
    '-i', path.join(dir, 'seq_%03d.png'),
    '-vf', `scale=640:-1,tile=${cols}x${rows}:padding=8:color=0x333333`,
    '-frames:v', '1', path.join(OUT, 'planche.png'),
  ]).fin;
  console.log(`${tl.BEATS.length} images → ${dir}\nplanche → ${path.join(OUT, 'planche.png')}\ndurée corps ${tl.DURATION} s`);
}

function genererFondWav(tl, outWav) {
  const SR = 48000;
  const DURATION = tl.DURATION;
  const N = Math.ceil(SR * DURATION);
  const musL = new Float32Array(N);
  const musR = new Float32Array(N);
  const fxL = new Float32Array(N);
  const fxR = new Float32Array(N);

  let seed = 20261125;
  const rnd = () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  const noise = new Float32Array(SR * 2);
  for (let i = 0; i < noise.length; i++) noise[i] = rnd() * 2 - 1;

  const TWO_PI = Math.PI * 2;
  const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function addOsc(type, f1, at, dur, peak, destL, destR, panVal = 0, f2 = 0, atk = 0.004) {
    const i0 = Math.max(0, Math.floor(at * SR));
    const iAtk = Math.max(1, Math.floor(atk * SR));
    const iDec = Math.max(1, Math.floor(dur * SR));
    const iEnd = Math.min(N, i0 + iAtk + iDec);
    if (i0 >= N) return;
    const gL = Math.cos(((panVal + 1) * Math.PI) / 4);
    const gR = Math.sin(((panVal + 1) * Math.PI) / 4);
    let phase = 0;
    const sweepLen = Math.max(1, Math.floor(dur * 0.8 * SR));
    const ratio = f2 > 0 ? Math.log(f2 / f1) / sweepLen : 0;
    const logPeak = Math.log(peak / 0.0001);
    for (let i = i0; i < iEnd; i++) {
      const k = i - i0;
      const env = k < iAtk
        ? 0.0001 * Math.exp((logPeak * k) / iAtk)
        : peak * Math.exp((-logPeak * (k - iAtk)) / iDec);
      const freq = f2 > 0 && k < sweepLen ? f1 * Math.exp(ratio * k) : f2 > 0 ? f2 : f1;
      phase += (TWO_PI * freq) / SR;
      let s = 0;
      if (type === 'sine') s = Math.sin(phase);
      else if (type === 'triangle') {
        const p = (phase / TWO_PI) % 1;
        s = 4 * Math.abs(p - 0.5) - 1;
      } else s = Math.sin(phase) >= 0 ? 1 : -1;
      const v = s * env;
      destL[i] += v * gL;
      destR[i] += v * gR;
    }
  }

  function addNz(at, dur, peak, mode, fCut, destL, destR) {
    const i0 = Math.max(0, Math.floor(at * SR));
    const atk = Math.min(0.01, dur / 3);
    const iAtk = Math.max(1, Math.floor(atk * SR));
    const iDec = Math.max(1, Math.floor(dur * SR));
    const iEnd = Math.min(N, i0 + iAtk + iDec);
    if (i0 >= N) return;
    const off = Math.floor(rnd() * SR);
    const rc = 1 / (TWO_PI * Math.max(80, fCut));
    const dt = 1 / SR;
    const alphaLP = dt / (rc + dt);
    const alphaHP = rc / (rc + dt);
    let y = 0, prevX = 0;
    const logPeak = Math.log(peak / 0.0001);
    for (let i = i0; i < iEnd; i++) {
      const k = i - i0;
      const env = k < iAtk
        ? 0.0001 * Math.exp((logPeak * k) / iAtk)
        : peak * Math.exp((-logPeak * (k - iAtk)) / iDec);
      const x = noise[(off + k) % noise.length];
      if (mode === 'highpass') { y = alphaHP * (y + x - prevX); prevX = x; }
      else { y = y + alphaLP * (x - y); }
      const v = y * env;
      destL[i] += v;
      destR[i] += v;
    }
  }

  const BEAT = 60 / 104, BAR = BEAT * 4;
  const CHORDS = [[53, 57, 60, 64], [50, 53, 57, 60], [46, 50, 53, 57], [48, 52, 55, 62]];
  const ARP = [0, 1, 2, 3, 2, 1, 2, 3];
  const FIN_MUS = tl.MUSIQUE_FIN;

  for (let bar = 0; bar * BAR < FIN_MUS; bar++) {
    const ch = CHORDS[bar % 4], t0 = bar * BAR;
    [0, 2, 2.5].forEach((bt) => { const at = t0 + bt * BEAT; if (at < FIN_MUS) addOsc('sine', midi(ch[0] - 12), at, 0.42, 0.20, musL, musR, 0); });
    ARP.forEach((k, i) => {
      const at = t0 + (i * BEAT) / 2; if (at >= FIN_MUS) return;
      const f = midi(ch[k] + 12);
      addOsc('triangle', f, at, 0.32, 0.068, musL, musR, i % 2 ? 0.25 : -0.25);
      addOsc('sine', f * 2, at, 0.18, 0.016, musL, musR, 0);
    });
    [0, 2].forEach((bt) => { const at = t0 + bt * BEAT; if (at < FIN_MUS) addOsc('sine', 120, at, 0.2, 0.24, musL, musR, 0, 45); });
    for (let i = 0; i < 4; i++) { const at = t0 + (i + 0.5) * BEAT; if (at < FIN_MUS) addNz(at, 0.035, 0.025, 'highpass', 7500, musL, musR); }
  }
  [53, 57, 60, 64, 69].forEach((m, i) => addOsc('triangle', midi(m + 12), FIN_MUS + 0.02 * i, 2.4, 0.055, musL, musR, 0, 0, 0.02));
  addOsc('sine', midi(41), FIN_MUS, 2.5, 0.22, musL, musR, 0);

  // Enveloppe ducking voix sur la piste musique
  const duck = new Float32Array(N).fill(1);
  const fadeInEnd = Math.min(N, Math.floor(0.5 * SR));
  for (let i = 0; i < fadeInEnd; i++) duck[i] = i / fadeInEnd;
  for (const [a, b] of tl.VOIX) {
    const iStart = Math.max(0, Math.floor((a - 0.22) * SR));
    const iFull = Math.max(0, Math.floor(a * SR));
    const iHold = Math.min(N, Math.floor((b + 0.05) * SR));
    const iRel = Math.min(N, Math.floor((b + 0.38) * SR));
    for (let i = iStart; i < iFull && i < N; i++) {
      const p = (i - iStart) / Math.max(1, iFull - iStart);
      duck[i] = Math.min(duck[i], 1 - 0.72 * p);
    }
    for (let i = iFull; i < iHold; i++) duck[i] = Math.min(duck[i], 0.28);
    for (let i = iHold; i < iRel; i++) {
      const p = (i - iHold) / Math.max(1, iRel - iHold);
      duck[i] = Math.min(duck[i], 0.28 + 0.72 * p);
    }
  }
  const fadeOutStart = Math.max(0, Math.floor((DURATION - 1.2) * SR));
  for (let i = fadeOutStart; i < N; i++) {
    duck[i] *= Math.max(0, 1 - (i - fadeOutStart) / Math.max(1, N - fadeOutStart));
  }

  const NOTE = [72, 74, 76, 79, 81];
  for (const s of tl.SFX) {
    const at = Math.max(0.01, s.t), p = s.pitch || 1;
    switch (s.type) {
      case 'pop': addOsc('sine', 620 * p, at, 0.09, 0.28, fxL, fxR, 0, 240 * p); addNz(at, 0.02, 0.10, 'lowpass', 3800, fxL, fxR); break;
      case 'tick': addOsc('sine', 1500 * p, at, 0.05, 0.08, fxL, fxR, 0, 900 * p); break;
      case 'drop': addNz(at + 0.12, 0.2, 0.26, 'lowpass', 900, fxL, fxR); addOsc('sine', 130, at + 0.16, 0.32, 0.46, fxL, fxR, 0, 42); break;
      case 'type': addNz(at, 0.022, 0.10, 'lowpass', 3000, fxL, fxR); addOsc('square', 195, at, 0.012, 0.02, fxL, fxR, 0); break;
      case 'draw': addNz(at, s.dur || 0.5, 0.055, 'lowpass', 2200, fxL, fxR); break;
      case 'whoosh': addNz(at, (s.dur || 0.85) * 0.75, 0.14, 'lowpass', 1400, fxL, fxR); break;
      case 'zip': addNz(at, s.dur || 0.6, 0.09, 'lowpass', 2600, fxL, fxR); break;
      case 'swoosh': addNz(at, 0.9, 0.22, 'lowpass', 2000, fxL, fxR); break;
      case 'coin': [2637, 3520, 4186].forEach((f, i) => addOsc('sine', f, at + i * 0.004, 0.22 - i * 0.04, 0.045, fxL, fxR, 0)); break;
      case 'paper': addNz(at, 0.12, 0.075, 'highpass', 2500, fxL, fxR); break;
      case 'match': addOsc('sine', 880, at, 0.45, 0.14, fxL, fxR, 0); addOsc('sine', 1318.5, at + 0.09, 0.65, 0.12, fxL, fxR, 0); break;
      case 'stamp': addOsc('sine', 160, at + 0.2, 0.35, 0.58, fxL, fxR, 0, 40); addNz(at + 0.2, 0.12, 0.32, 'lowpass', 1600, fxL, fxR); break;
      case 'thud': addOsc('sine', 110, at, 0.3, 0.38, fxL, fxR, 0, 38); break;
      case 'note': addOsc('triangle', midi(NOTE[s.k % NOTE.length]), at, 0.6, 0.14, fxL, fxR, 0); addOsc('sine', midi(NOTE[s.k % NOTE.length] + 12), at, 0.4, 0.045, fxL, fxR, 0); break;
      case 'end': [65, 69, 72, 76].forEach((m, i) => addOsc('sine', midi(m + 12), at + i * 0.05, 1.6, 0.065, fxL, fxR, 0)); addOsc('sine', 140, at, 0.4, 0.48, fxL, fxR, 0, 40); break;
      default: break;
    }
  }

  const fd = fs.openSync(outWav, 'w');
  const hdr = Buffer.alloc(44);
  hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + N * 4, 4); hdr.write('WAVE', 8); hdr.write('fmt ', 12);
  hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22);
  hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34);
  hdr.write('data', 36); hdr.writeUInt32LE(N * 4, 40);
  fs.writeSync(fd, hdr);

  const BLOCK = 65536;
  const pcm = Buffer.alloc(BLOCK * 4);
  for (let off = 0; off < N; off += BLOCK) {
    const cnt = Math.min(BLOCK, N - off);
    for (let i = 0; i < cnt; i++) {
      const idx = off + i;
      const l = Math.tanh((musL[idx] * duck[idx] + fxL[idx] * 0.76) * 0.85);
      const r = Math.tanh((musR[idx] * duck[idx] + fxR[idx] * 0.76) * 0.85);
      pcm.writeInt16LE(Math.round(l * 32767), i * 4);
      pcm.writeInt16LE(Math.round(r * 32767), i * 4 + 2);
    }
    fs.writeSync(fd, pcm, 0, cnt * 4);
  }
  fs.closeSync(fd);
}

async function audio() {
  const mix = path.join(OUT, 'bande-son.wav');
  if (fs.existsSync(mix) && fs.statSync(mix).size > 1_000_000) {
    console.log(`  bande-son existante réutilisée → ${mix}`);
    return mix;
  }
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] });
  const fond = path.join(OUT, 'fond.wav');
  const page = await ouvrir(browser);
  const tl = await page.evaluate(() => window.__timeline);
  await page.close();
  await browser.close();
  const tAudio = Date.now();
  genererFondWav(tl, fond);
  console.log(`  fond musical généré en ${((Date.now() - tAudio) / 1000).toFixed(1)} s (${(fs.statSync(fond).size / 1e6).toFixed(1)} Mo)`);
  const ids = VX.ordre;
  const ffArgs = ['-i', fond];
  ids.forEach((sid) => ffArgs.push('-i', path.join(VOIX_DIR, `${sid}.mp3`)));
  const fmt = 'aformat=sample_rates=48000:channel_layouts=stereo';
  const voix = ids
    .map((sid, k) => `[${k + 1}:a]${fmt},adelay=${Math.round(VX.scenes[sid].v * 1000)}|${Math.round(VX.scenes[sid].v * 1000)}[v${k}]`)
    .join(';');
  const graph = `${voix};${ids.map((_, k) => `[v${k}]`).join('')}amix=inputs=${ids.length}:normalize=0,volume=1.18[vo];[0:a]${fmt},volume=0.8[bg];[bg][vo]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,${fmt}[out]`;
  await ffmpeg([...ffArgs, '-filter_complex', graph, '-map', '[out]', '-t', String(VX.duration), '-c:a', 'pcm_s16le', mix]).fin;
  console.log(`  bande-son mixée → ${mix}`);
  return mix;
}

async function captureFrame(page, cdp, t) {
  await page.evaluate((x) => window.seek(x), t);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data } = await cdp.send('Page.captureScreenshot', {
        format: 'jpeg',
        quality: 90,
        optimizeForSpeed: true,
      });
      return Buffer.from(data, 'base64');
    } catch (err) {
      if (attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 120));
    }
  }
}

async function segment(browser, k, f0, f1) {
  const seg = path.join(OUT, `seg_${k}.mp4`);
  const page = await ouvrir(browser);
  const cdp = await page.context().newCDPSession(page);
  const vf =
    SUB > 1
      ? `tmix=frames=${SUB},select=eq(mod(n\\,${SUB})\\,${SUB - 1}),setpts=N/${FPS}/TB`
      : `setpts=N/${FPS}/TB`;
  const { p, fin } = ffmpeg([
    '-f', 'image2pipe', '-framerate', String(FPS * SUB), '-c:v', 'mjpeg', '-i', '-',
    '-vf', vf, '-r', String(FPS), '-c:v', 'libx264', '-preset', 'fast', '-crf', '19', '-pix_fmt', 'yuv420p', seg,
  ]);
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    for (let s = 0; s < SUB; s++) {
      const buf = await captureFrame(page, cdp, f / FPS + s / (FPS * SUB));
      if (!p.stdin.write(buf)) await new Promise((r) => p.stdin.once('drain', r));
    }
    if ((f - f0) % 500 === 0 && f > f0) {
      console.log(`  segment ${k} : ${f - f0}/${f1 - f0} frames (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    }
  }
  p.stdin.end();
  await fin;
  await page.close();
  return seg;
}

async function full() {
  const wav = await audio();
  const browsers = await Promise.all(
    Array.from({ length: WORKERS }, () => chromium.launch({ args: ['--disable-dev-shm-usage'] })),
  );
  const total = Math.round(VX.duration * FPS);
  const per = Math.ceil(total / WORKERS);
  console.log(`Capture vidéo : ${total} frames (${FPS} fps, ${WORKERS} navigateurs dédiés)…`);
  const segs = await Promise.all(
    browsers.map((b, k) => segment(b, k, k * per, Math.min(total, (k + 1) * per))),
  );
  await Promise.all(browsers.map((b) => b.close()));

  const liste = path.join(OUT, 'segments.txt');
  fs.writeFileSync(liste, segs.map((s) => `file '${s.replace(/\\/g, '/')}'`).join('\n'));
  const corps = path.join(OUT, `${id}-corps.mp4`);
  await ffmpeg([
    '-f', 'concat', '-safe', '0', '-i', liste, '-i', wav,
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
    '-shortest', '-movflags', '+faststart', corps,
  ]).fin;
  segs.forEach((s) => fs.rmSync(s));

  const finalMp4 = path.join(OUT, `${id}-final.mp4`);
  execFileSync('node', [path.join(VIDEO_ROOT, 'habillage', 'render.mjs'), 'assemble', corps, finalMp4], {
    stdio: 'inherit',
  });

  // Export WebVTT (.vtt) synchronisé façon Coursera, décalé de la durée exacte de intro.mp4
  const fmtVtt = (sec) => {
    const ms = Math.max(0, Math.round(sec * 1000));
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    const s = Math.floor((ms % 60_000) / 1000);
    const r = ms % 1000;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(r).padStart(3, '0')}`;
  };
  const buildVtt = (offsetSec) => {
    const lignes = ['WEBVTT', ''];
    const labelDe = (speaker) => {
      if (PLAN.format !== 'podcast' && PLAN.format !== 'salon') return '';
      const iv = PLAN.intervenants ?? {};
      const qui = speaker === 'journaliste' ? iv.journaliste : iv.expert;
      // Prénom de l'intervenant (« Amina · Journaliste » → « Amina ») : jamais écrit en dur.
      const prenom = qui?.prenom || String(qui?.nom ?? '').split(' · ')[0];
      return prenom ? `[${prenom}] ` : '';
    };
    for (const sid of VX.ordre) {
      const sc = VX.scenes[sid];
      const prefix = labelDe(sc.speaker);
      const mots = sc.mots;
      let chunk = [];
      let len = 0;
      const flush = () => {
        if (!chunk.length) return;
        const a = Math.max(0, chunk[0].a + offsetSec - 0.04);
        const b = chunk[chunk.length - 1].b + offsetSec + 0.14;
        lignes.push(`${fmtVtt(a)} --> ${fmtVtt(b)}`, `${prefix}${chunk.map((w) => w.m).join(' ')}`, '');
        chunk = [];
        len = 0;
      };
      for (const w of mots) {
        if (chunk.length > 0 && (len + w.m.length + 1 > 62 || chunk.length >= 10)) flush();
        chunk.push(w);
        len += w.m.length + 1;
      }
      flush();
    }
    return lignes.join('\n');
  };

  const introPath = path.join(VIDEO_ROOT, 'out', 'habillage', 'intro.mp4');
  const introDur = fs.existsSync(introPath)
    ? Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', introPath]).toString().trim()) || 0
    : 0;
  fs.writeFileSync(path.join(OUT, `${id}-corps.vtt`), buildVtt(0), 'utf8');
  const finalVtt = path.join(OUT, `${id}-final.vtt`);
  fs.writeFileSync(finalVtt, buildVtt(introDur), 'utf8');

  const poster = path.join(OUT, `${id}-poster.jpg`);
  await ffmpeg(['-ss', '10', '-i', finalMp4, '-frames:v', '1', '-q:v', '3', poster]).fin;
  console.log(`FINAL → ${finalMp4} (${(fs.statSync(finalMp4).size / 1e6).toFixed(1)} Mo)`);
  console.log(`VTT   → ${finalVtt} (décalage intro +${introDur.toFixed(2)}s)`);
  console.log(`POSTER → ${poster}`);
}

if (mode === 'stills') await stills();
else if (mode === 'full') await full();
else {
  console.error('Mode invalide (stills | full)');
  process.exit(1);
}
