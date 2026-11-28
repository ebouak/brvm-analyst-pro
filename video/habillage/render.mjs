// Rendu de l'habillage WESTBOURSE (video/habillage/index.html).
//   node render.mjs stills <intro|outro|signature> [t…]   images de contrôle + planche
//   node render.mjs rythme <intro|outro|signature>        carte rythmique MESURÉE sur l'audio rendu
//   node render.mjs full   <intro|outro|signature> [--sans-musique]
//   node render.mjs assemble <lecon.mp4> <sortie.mp4>     intro + leçon + outro, encodage web
// Auteur (outro, facultatif) : video/habillage/auteur.json
//   { "photo": "auteur.jpg", "prenom": "…", "nom": "…", "role": "…" }  (photo à côté du JSON)
// Sorties : video/out/habillage/ (ignoré par git).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(ICI, '../out/habillage');
const PAGE = pathToFileURL(path.join(ICI, 'index.html')).href;
const FPS = 60, SUB = 3;
fs.mkdirSync(OUT, { recursive: true });

function config(seq, sansMusique) {
  const c = { sequence: seq, audio: { musique: !sansMusique } };
  const fa = path.join(ICI, 'auteur.json');
  if (seq === 'outro' && fs.existsSync(fa)) c.auteur = JSON.parse(fs.readFileSync(fa, 'utf8'));
  return c;
}

async function ouvrir(browser, cfg) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(String(e)));
  await page.addInitScript(`window.__CONFIG = ${JSON.stringify(cfg)};`);
  await page.goto(PAGE);
  await page.waitForFunction(() => window.__ready === true || window.__erreur, null, { timeout: 60000 });
  const err = await page.evaluate(() => window.__erreur);
  if (err || erreurs.length) throw new Error(`page en erreur : ${err || erreurs.join('\n')}`);
  return page;
}
function ffmpeg(args) {
  const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['pipe', 'inherit', 'inherit'] });
  const fin = new Promise((ok, ko) => p.on('close', (c) => (c === 0 ? ok() : ko(new Error(`ffmpeg ${c}`)))));
  return { p, fin };
}

const TEMOINS = {
  intro: [0.55, 1.0, 2.1, 2.55, 3.5, 4.3, 4.75, 5.55, 5.9, 6.9, 7.25],
  outro: [0.15, 1.0, 2.35, 3.25, 3.7, 4.3, 'carte+0.4', 'carte+1.6', 'fin-0.1'],
  signature: [0.4, 0.85, 1.25, 1.95],
};

async function stills(seq, times) {
  const browser = await chromium.launch();
  const page = await ouvrir(browser, config(seq));
  const tl = await page.evaluate(() => window.__timeline);
  if (!times.length) {
    times = TEMOINS[seq].map((x) => (typeof x === 'number' ? x : x.startsWith('fin') ? tl.DURATION + Number(x.slice(3)) : tl.T.carte + Number(x.slice(5))));
    if (seq === 'outro' && tl.T.auteur < tl.T.carte) times.push(tl.T.auteur + 0.9);
    times.sort((a, b) => a - b);
  }
  const dir = path.join(OUT, `stills-${seq}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  let i = 0;
  for (const t of times) {
    await page.evaluate((x) => window.seek(x), t);
    await page.screenshot({ path: path.join(dir, `seq_${String(i++).padStart(3, '0')}.png`) });
  }
  await browser.close();
  fs.writeFileSync(path.join(dir, 'temps.txt'), times.map((t, k) => `${k}\t${t.toFixed(2)}`).join('\n'));
  await ffmpeg(['-i', path.join(dir, 'seq_%03d.png'), '-vf', `scale=640:-1,tile=4x${Math.ceil(times.length / 4)}:padding=6:color=0x333333`, '-frames:v', '1', path.join(OUT, `planche-${seq}.png`)]).fin;
  console.log(`${times.length} images · durée ${tl.DURATION.toFixed(2)} s → ${path.join(OUT, `planche-${seq}.png`)}`);
}

async function audio(seq, sansMusique, browser) {
  const page = await ouvrir(browser, config(seq, sansMusique));
  const b64 = await page.evaluate(() => window.renderAudio());
  const tl = await page.evaluate(() => window.__timeline);
  await page.close();
  const wav = path.join(OUT, `${seq}${sansMusique ? '-sans-musique' : ''}.wav`);
  fs.writeFileSync(wav, Buffer.from(b64, 'base64'));
  return { wav, tl };
}

// Attaques mesurées dans le signal : énergie des différences (accentue les
// transitoires) sur des fenêtres de 5 ms, pic local nettement au-dessus du
// niveau des 100 ms précédentes.
function attaques(wav) {
  const b = fs.readFileSync(wav);
  const n = (b.length - 44) / 4, SR = 48000, H = 240;
  const e = [];
  let prev = 0;
  for (let f = 0; f * H < n; f++) {
    let s = 0;
    for (let i = f * H; i < Math.min(n, (f + 1) * H); i++) {
      const x = (b.readInt16LE(44 + i * 4) + b.readInt16LE(46 + i * 4)) / 65536;
      s += Math.abs(x - prev); prev = x;
    }
    e.push(s);
  }
  const out = [];
  for (let f = 20; f < e.length - 1; f++) {
    let m = 0; for (let k = f - 20; k < f; k++) m += e[k]; m /= 20;
    if (e[f] > 2.2 * m + 0.4 && e[f] >= e[f - 1] && e[f] >= e[f + 1]) {
      const t = (f * H) / SR;
      if (!out.length || t - out[out.length - 1] > 0.06) out.push(t);
    }
  }
  return out;
}

async function rythme(seq) {
  const browser = await chromium.launch();
  const { wav, tl } = await audio(seq, false, browser);
  await browser.close();
  const att = attaques(wav);
  const lignes = tl.PREVUS.map(([type, t]) => {
    const proche = att.reduce((a, x) => (Math.abs(x - t) < Math.abs(a - t) ? x : a), Infinity);
    const ok = Number.isFinite(proche);
    return `| ${type} | ${t.toFixed(3)} | ${ok ? proche.toFixed(3) : '—'} | ${ok ? (Math.abs(proche - t) * 1000).toFixed(0) + ' ms' : '—'} | ${(t * 2).toFixed(2)} |`;
  });
  const md = [
    `# Carte rythmique — ${seq} (${tl.DURATION.toFixed(2)} s, 120 bpm, 1 temps = 0,5 s)`,
    '',
    'Mesurée sur la bande-son rendue (attaques détectées dans le signal), pas déduite du plan.',
    '',
    '| Événement | Prévu (s) | Mesuré (s) | Écart | Temps n° |',
    '|---|---|---|---|---|',
    ...lignes,
    '',
    `Attaques détectées : ${att.length} — ${att.map((x) => x.toFixed(2)).join(' · ')}`,
  ].join('\n');
  fs.writeFileSync(path.join(OUT, `rythme-${seq}.md`), md);
  console.log(md);
}

async function full(seq, sansMusique) {
  const browser = await chromium.launch();
  const { wav, tl } = await audio(seq, sansMusique, browser);
  const total = Math.round(tl.DURATION * FPS);
  const WK = 3, per = Math.ceil(total / WK);
  const segs = await Promise.all(Array.from({ length: WK }, async (_, k) => {
    const page = await ouvrir(browser, config(seq, sansMusique));
    const seg = path.join(OUT, `seg_${seq}_${k}.mp4`);
    const { p, fin } = ffmpeg(['-f', 'image2pipe', '-framerate', String(FPS * SUB), '-c:v', 'mjpeg', '-i', '-',
      '-vf', `tmix=frames=${SUB},select=eq(mod(n\\,${SUB})\\,${SUB - 1}),setpts=N/${FPS}/TB`,
      '-r', String(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', seg]);
    for (let f = k * per; f < Math.min(total, (k + 1) * per); f++) {
      for (let s = 0; s < SUB; s++) {
        await page.evaluate((x) => window.seek(x), f / FPS + s / (FPS * SUB));
        const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
        if (!p.stdin.write(buf)) await new Promise((r) => p.stdin.once('drain', r));
      }
    }
    p.stdin.end(); await fin; await page.close();
    return seg;
  }));
  await browser.close();
  const liste = path.join(OUT, `segments-${seq}.txt`);
  fs.writeFileSync(liste, segs.map((s) => `file '${s.replace(/\\/g, '/')}'`).join('\n'));
  const final = path.join(OUT, `${seq}${sansMusique ? '-sans-musique' : ''}.mp4`);
  await ffmpeg(['-f', 'concat', '-safe', '0', '-i', liste, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', final]).fin;
  segs.forEach((s) => fs.rmSync(s));
  console.log(`MP4 → ${final}`);
}

// Intro + leçon + outro, réencodés ensemble pour le web (bucket limité à 50 Mo).
async function assemble(lecon, sortie) {
  const intro = path.join(OUT, 'intro.mp4'), outro = path.join(OUT, 'outro.mp4');
  for (const f of [intro, lecon, outro]) if (!fs.existsSync(f)) throw new Error(`absent : ${f}`);
  let durSec = 0;
  try {
    const { execFileSync } = await import('node:child_process');
    durSec = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', lecon]).toString().trim()) || 0;
  } catch { /* fallback */ }
  const longFormat = durSec > 300;
  const outFps = longFormat ? 30 : 60;
  const crf = longFormat ? '25' : '23';
  const preset = longFormat ? 'medium' : 'slow';
  const aBitrate = longFormat ? '128k' : '160k';
  const filtre = `[0:v]fps=${outFps},format=yuv420p[v0];[1:v]fps=${outFps},format=yuv420p[v1];[2:v]fps=${outFps},format=yuv420p[v2];`
    + '[0:a]aresample=48000,aformat=channel_layouts=stereo[a0];[1:a]aresample=48000,aformat=channel_layouts=stereo[a1];[2:a]aresample=48000,aformat=channel_layouts=stereo[a2];'
    + '[v0][a0][v1][a1][v2][a2]concat=n=3:v=1:a=1[v][a]';
  await ffmpeg(['-i', intro, '-i', lecon, '-i', outro, '-filter_complex', filtre, '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-preset', preset, '-crf', crf, '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', aBitrate, '-movflags', '+faststart', sortie]).fin;
  console.log(`assemblé → ${sortie} (${(fs.statSync(sortie).size / 1e6).toFixed(1)} Mo · ${outFps} fps)`);
}

const [mode, a1, ...rest] = process.argv.slice(2);
if (mode === 'stills') await stills(a1, rest.map(Number));
else if (mode === 'rythme') await rythme(a1);
else if (mode === 'full') await full(a1, rest.includes('--sans-musique'));
else if (mode === 'assemble') await assemble(path.resolve(a1), path.resolve(rest[0]));
else { console.error('usage : node render.mjs stills|rythme|full <intro|outro|signature> | assemble <lecon.mp4> <sortie.mp4>'); process.exit(1); }
