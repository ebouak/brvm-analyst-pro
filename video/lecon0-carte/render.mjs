// Rendu de video/lecon0-carte/index.html.
//   python voix.py                    voix off + horodatage des mots (à lancer d'abord)
//   node render.mjs stills            une image par temps fort + planche-contact
//   node render.mjs stills 12.3 45    images aux instants donnés
//   node render.mjs audio             bande-son seule (musique + bruitages + voix)
//   node render.mjs full              60 i/s, 3 sous-images par image fondues par tmix,
//                                     bande-son mixée, MP4 final
// Sorties dans video/out/lecon0-carte/ (ignoré par git).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(ICI, '../out/lecon0-carte');
const VOIX_DIR = path.join(OUT, 'voix');
const PAGE = pathToFileURL(path.join(ICI, 'index.html')).href;
const FPS = 60, SUB = 3, WORKERS = 6;
fs.mkdirSync(OUT, { recursive: true });

// Minutage : chaque scène = respiration, voix, courte pause. Les instants des
// mots deviennent absolus : l'animation se cale sur eux.
const PRE = { hook: 0.6 }, PRE_DEF = 1.25, POST = 0.6, TENUE_FIN = 3.4;
function minutage() {
  const conf = JSON.parse(fs.readFileSync(path.join(ICI, 'voix.json'), 'utf8'));
  const scenes = {};
  let t = 0;
  for (const { id } of conf.segments) {
    const f = path.join(VOIX_DIR, `${id}.json`);
    if (!fs.existsSync(f)) throw new Error(`voix absente : ${f} — lancer d'abord « python voix.py »`);
    const mots = JSON.parse(fs.readFileSync(f, 'utf8'));
    const v = t + (PRE[id] ?? PRE_DEF);
    const fin = v + mots[mots.length - 1].b;
    scenes[id] = { s: +t.toFixed(3), v: +v.toFixed(3), e: +(fin + POST).toFixed(3), mots: mots.map((m) => ({ m: m.m, a: +(v + m.a).toFixed(3), b: +(v + m.b).toFixed(3) })) };
    t = fin + POST;
  }
  return { scenes, duration: +(t + TENUE_FIN).toFixed(3), ordre: conf.segments.map((s) => s.id) };
}
const VX = minutage();

async function ouvrir(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(String(e)));
  await page.addInitScript(`window.__VOIX = ${JSON.stringify(VX)};`);
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

async function stills(times) {
  const browser = await chromium.launch();
  const page = await ouvrir(browser);
  const tl = await page.evaluate(() => ({ BEATS: window.__timeline.BEATS, DURATION: window.__timeline.DURATION }));
  if (!times.length) times = tl.BEATS;
  const dir = path.join(OUT, 'stills');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  let i = 0;
  for (const t of times) {
    await page.evaluate((x) => window.seek(x), t);
    await page.screenshot({ path: path.join(dir, `seq_${String(i++).padStart(3, '0')}.png`) });
  }
  await browser.close();
  fs.writeFileSync(path.join(dir, 'temps.txt'), times.map((t, k) => `${k}\t${t}`).join('\n'));
  await ffmpeg(['-i', path.join(dir, 'seq_%03d.png'), '-vf', `scale=480:-1,tile=5x${Math.ceil(times.length / 5)}:padding=6:color=0x333333`, '-frames:v', '1', path.join(OUT, 'planche.png')]).fin;
  console.log(`${times.length} images → ${dir}\nplanche → ${path.join(OUT, 'planche.png')}\ndurée ${tl.DURATION} s`);
}

// Musique + bruitages (rendus dans la page), puis voix off posée à ses instants.
async function audio(browser) {
  const page = await ouvrir(browser);
  const b64 = await page.evaluate(() => window.renderAudio());
  await page.close();
  const fond = path.join(OUT, 'fond.wav');
  fs.writeFileSync(fond, Buffer.from(b64, 'base64'));
  const ids = VX.ordre;
  const args = ['-i', fond];
  ids.forEach((id) => args.push('-i', path.join(VOIX_DIR, `${id}.mp3`)));
  const fmt = 'aformat=sample_rates=48000:channel_layouts=stereo';
  const voix = ids.map((id, k) => { const ms = Math.round(VX.scenes[id].v * 1000); return `[${k + 1}:a]${fmt},adelay=${ms}|${ms}[v${k}]`; }).join(';');
  const graph = `${voix};${ids.map((_, k) => `[v${k}]`).join('')}amix=inputs=${ids.length}:normalize=0,volume=1.15[vo];[0:a]${fmt},volume=0.8[bg];[bg][vo]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,${fmt}[out]`;
  const mix = path.join(OUT, 'bande-son.wav');
  await ffmpeg([...args, '-filter_complex', graph, '-map', '[out]', '-t', String(VX.duration), '-c:a', 'pcm_s16le', mix]).fin;
  return mix;
}

async function segment(browser, k, f0, f1) {
  const page = await ouvrir(browser);
  const seg = path.join(OUT, `seg_${k}.mp4`);
  const { p, fin } = ffmpeg([
    '-f', 'image2pipe', '-framerate', String(FPS * SUB), '-c:v', 'mjpeg', '-i', '-',
    '-vf', `tmix=frames=${SUB},select=eq(mod(n\\,${SUB})\\,${SUB - 1}),setpts=N/${FPS}/TB`,
    '-r', String(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', seg,
  ]);
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    for (let s = 0; s < SUB; s++) {
      const t = f / FPS + s / (FPS * SUB);
      await page.evaluate((x) => window.seek(x), t);
      const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
      if (!p.stdin.write(buf)) await new Promise((r) => p.stdin.once('drain', r));
    }
    if ((f - f0) % 300 === 0) console.log(`segment ${k} : ${f - f0}/${f1 - f0} images (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  p.stdin.end();
  await fin;
  await page.close();
  return seg;
}

async function full() {
  const browsers = await Promise.all(Array.from({ length: WORKERS }, () => chromium.launch()));
  const total = Math.round(VX.duration * FPS);
  const per = Math.ceil(total / WORKERS);
  const [wav, ...segs] = await Promise.all([
    audio(browsers[0]),
    ...browsers.map((b, k) => segment(b, k, k * per, Math.min(total, (k + 1) * per))),
  ]);
  await Promise.all(browsers.map((b) => b.close()));
  const liste = path.join(OUT, 'segments.txt');
  fs.writeFileSync(liste, segs.map((s) => `file '${s.replace(/\\/g, '/')}'`).join('\n'));
  const final = path.join(OUT, 'lecon0-acteurs-umoa-16x9.mp4');
  await ffmpeg(['-f', 'concat', '-safe', '0', '-i', liste, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', final]).fin;
  segs.forEach((s) => fs.rmSync(s));
  console.log(`MP4 → ${final}`);
}

const [mode, ...rest] = process.argv.slice(2);
if (mode === 'stills') await stills(rest.map(Number));
else if (mode === 'audio') { const b = await chromium.launch(); console.log(await audio(b)); await b.close(); }
else if (mode === 'full') await full();
else { console.error('usage : node render.mjs stills [t…] | audio | full'); process.exit(1); }
