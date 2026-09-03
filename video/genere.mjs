/**
 * Video de seance WESTBOURSE : graphiques, logo, et logos des societes cotees.
 *
 * Pourquoi ce script existe : la premiere version, faite avec
 * MoneyPrinterTurbo, posait un propos unique sur des plans d'archive
 * generiques - des gratte-ciels sans rapport avec Abidjan ni avec la BRVM.
 * N'importe qui peut en faire autant. Ce que WESTBOURSE possede en propre, ce
 * sont les chiffres, les logos des societes, et la maniere de montrer les deux
 * ensemble.
 *
 * TOUT DERIVE DE LA MEME LECTURE. Les images et le texte lu sont composes des
 * memes variables, issues d'une seule interrogation de la base. C'est delibere :
 * la premiere version dynamique gardait un audio fige, et la voix a annonce
 * 31 hausses pendant que l'ecran en montrait 18. Un chiffre change desormais
 * partout a la fois, ou nulle part.
 *
 * AUCUN CHIFFRE INVENTE, AUCUN LOGO INVENTE : une societe sans fichier dans
 * frontend/public/logos/ s'affiche avec son code, jamais avec le logo d'une
 * autre.
 *
 *   node genere.mjs
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

/* Chemins deduits du fichier lui-meme : le script doit tourner aussi bien sur
   le poste de l'auteur que sur un runner GitHub, ou aucun chemin Windows
   n'existe. */
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOGOS = `${RACINE}/frontend/public/logos`;
const OUT = process.env.VIDEO_OUT || `${RACINE}/gan-harness/video`;
mkdirSync(OUT, { recursive: true });

/* ------------------------------------------------------------ 1. donnees */

/* L'environnement prime ; .env.local ne sert que de repli en local. Sur un
   runner ce fichier n'existe pas, et le lire aveuglement ferait echouer le
   cron avant meme la premiere requete. */
const dotenv = `${RACINE}/frontend/.env.local`;
const env = existsSync(dotenv) ? readFileSync(dotenv, 'utf8') : '';
const lire = (...cles) => {
  for (const k of cles) {
    if (process.env[k]) return process.env[k].trim();
    const m = env.match(new RegExp('^' + k + '=(.*)$', 'm'));
    if (m) return m[1].trim().replace(/^"|"$/g, '');
  }
  return '';
};
const URL_SB = lire('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
/* Les tables de marche sont en lecture publique : la cle anon suffit. On
   accepte la service_role parce que c'est celle dont les crons disposent deja,
   et ce script ne tourne que cote serveur. */
const KEY = lire('SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY');
if (!URL_SB || !KEY) {
  console.error('SUPABASE_URL et une cle Supabase sont requis (environnement ou frontend/.env.local).');
  process.exit(1);
}

const api = async (chemin) => {
  const r = await fetch(`${URL_SB}/rest/v1/${chemin}`, { headers: { apikey: KEY } });
  if (!r.ok) throw new Error(`${chemin} -> ${r.status}`);
  return r.json();
};

const [{ date_marche: seance }] = await api(
  'brvm_actions_daily?select=date_marche&order=date_marche.desc&limit=1',
);
const actions = await api(
  `brvm_actions_daily?select=code,designation,cours_jour,variation_pct,volume,valeur_echangee&date_marche=eq.${seance}`,
);
const indices = await api(
  `brvm_indices_daily?select=code,valeur,variation_pct&date_marche=eq.${seance}`,
);

/* La valeur echangee n'est pas toujours publiee par la source intraday. On
   estime alors par cours x volume - comme le fait le produit ailleurs - et on
   l'ANNONCE, a l'ecran comme a la voix. Une estimation etiquetee vaut mieux
   qu'un zero muet. */
const cap = (a) =>
  a.valeur_echangee ?? (a.cours_jour != null && a.volume != null ? a.cours_jour * a.volume : 0);
const estime = actions.every((a) => a.valeur_echangee == null);

const cotes = actions.filter((a) => a.variation_pct != null);
const hausses = cotes.filter((a) => a.variation_pct > 0);
const baisses = cotes.filter((a) => a.variation_pct < 0);
const stables = cotes.length - hausses.length - baisses.length;
const T = cotes.reduce((s, a) => s + cap(a), 0);
const partB = (baisses.reduce((s, a) => s + cap(a), 0) / (T || 1)) * 100;
const lourde = cotes.reduce((m, a) => (cap(a) > cap(m) ? a : m), cotes[0]);
const trie = [...cotes].sort((a, b) => b.variation_pct - a.variation_pct);
const haut = trie[0];
const bas = trie[trie.length - 1];
const composite = indices.find((i) => i.code === 'BRVMC');
const partLourde = (cap(lourde) / (T || 1)) * 100;

const fr = (x, d = 2) => x.toFixed(d).replace('.', ',');
const sg = (x, d = 2) => `${x >= 0 ? '+' : '−'}${fr(Math.abs(x), d)}`;
const dateFr = new Date(`${seance}T12:00:00Z`).toLocaleDateString('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/* Un logo n'est utilise que s'il existe : jamais celui d'une autre societe. */
const logo = (code) => {
  for (const ext of ['jpg', 'png', 'jpeg', 'gif']) {
    const f = `${LOGOS}/${code}.${ext}`;
    if (existsSync(f)) {
      return `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${readFileSync(f).toString('base64')}`;
    }
  }
  return null;
};
const vignette = (code, t = 96) => {
  const src = logo(code);
  return src
    ? `<img class="lg" src="${src}" alt="" style="width:${t}px;height:${t}px">`
    : `<span class="lg vide" style="width:${t}px;height:${t}px;font-size:${Math.round(t * 0.26)}px">${code}</span>`;
};

console.log(
  `seance ${seance} · ${cotes.length} valeurs · ${hausses.length}/${baisses.length}/${stables} · ` +
    `capitaux ${(T / 1e9).toFixed(2)} Md${estime ? ' (estimes)' : ''}`,
);

/* --------------------------------------------------------------- 2. voix */

/* Le texte lu est compose des MEMES variables que les images. */
const dit = (x, d = 2) => fr(Math.abs(x), d).replace(',', ' virgule ');
const TEXTE = [
  `Séance du ${dateFr} à la BRVM.`,
  composite
    ? `Le BRVM Composite ${composite.variation_pct >= 0 ? 'gagne' : 'perd'} ${dit(composite.variation_pct)} pour cent, à ${dit(composite.valeur)} points.`
    : '',
  `${hausses.length} valeurs montent, ${baisses.length} reculent, ${stables} restent stables.`,
  `${estime ? 'Environ ' : ''}${dit(T / 1e9)} milliards de francs CFA ont changé de mains.`,
  `${dit(partB, 1)} pour cent de ces capitaux se sont traités sur des titres en repli.`,
  `${lourde.designation ?? lourde.code} pèse à elle seule ${dit(partLourde, 1)} pour cent du montant échangé, et ${lourde.variation_pct >= 0 ? 'gagne' : 'cède'} ${dit(lourde.variation_pct)} pour cent.`,
  `La plus forte hausse : ${haut.designation ?? haut.code}, plus ${dit(haut.variation_pct)} pour cent.`,
  `La plus forte baisse : ${bas.designation ?? bas.code}, moins ${dit(bas.variation_pct)} pour cent.`,
  'Tous ces chiffres viennent de la séance officielle. L’analyse complète est sur WESTBOURSE.',
]
  .filter(Boolean)
  .join(' ');

writeFileSync(`${OUT}/texte.txt`, TEXTE, 'utf8');
/* Appele par son module Python : l'executable edge-tts n'est pas forcement
   dans le PATH selon l'installation de pip. */
execFileSync(
  'python',
  ['-m', 'edge_tts', '--voice', 'fr-FR-DeniseNeural', '--text', TEXTE,
   '--write-media', `${OUT}/voix.mp3`],
  { stdio: 'pipe' },
);
const dureeVoix = parseFloat(
  execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1',
    `${OUT}/voix.mp3`,
  ]).toString().trim(),
);
console.log(`voix generee : ${dureeVoix.toFixed(1)} s`);

/* ------------------------------------------------------------- 3. scenes */

const CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;height:1920px;background:#030303;color:#FCFCFC;overflow:hidden;
 font-family:'Segoe UI',system-ui,sans-serif;font-variant-numeric:tabular-nums}
.s{position:absolute;inset:0;padding:110px 80px;display:flex;flex-direction:column;justify-content:center}
.grid{position:absolute;inset:0;background-image:repeating-linear-gradient(to right,
 rgba(255,255,255,.03) 0 1px,transparent 1px 120px)}
.k{font-family:ui-monospace,Consolas,monospace;font-size:26px;letter-spacing:.28em;
 text-transform:uppercase;color:#8CA3AA;margin-bottom:34px}
.big{font-family:ui-monospace,Consolas,monospace;font-size:200px;line-height:.9;letter-spacing:-.04em}
.mid{font-family:ui-monospace,Consolas,monospace;font-size:104px;line-height:1;letter-spacing:-.03em}
.lbl{font-size:40px;color:#A9BFC5;margin-top:28px;line-height:1.4}
.up{color:#3fe18b}.down{color:#ff6b6b}.cy{color:#56D7FD}
.bar{display:flex;height:74px;width:100%;margin:56px 0 20px;overflow:hidden}
.bar div{display:flex;align-items:center;justify-content:center;
 font-family:ui-monospace,Consolas,monospace;font-size:34px;font-weight:700;color:#030303}
.mark{position:absolute;top:96px;left:80px;display:flex;align-items:center;gap:22px}
.mark b{font-family:ui-monospace,Consolas,monospace;font-size:30px;letter-spacing:.34em;font-weight:600}
.foot{position:absolute;bottom:120px;left:80px;right:80px;font-family:ui-monospace,Consolas,monospace;
 font-size:24px;letter-spacing:.14em;color:#8CA3AA;border-top:1px solid rgba(255,255,255,.13);padding-top:26px}
.row{display:flex;align-items:center;justify-content:space-between;
 border-bottom:1px solid rgba(255,255,255,.09);padding:30px 0;gap:26px}
.row .id{display:flex;align-items:center;gap:26px;min-width:0}
.row .c{font-family:ui-monospace,Consolas,monospace;font-size:50px}
.row .n{font-size:27px;color:#8CA3AA;display:block;margin-top:6px}
.row .p{font-family:ui-monospace,Consolas,monospace;font-size:58px;font-weight:600;white-space:nowrap}
/* Les logos sont des images de marque : fond blanc, jamais teintes ni recadres,
   pour rester fideles a ce que les societes publient. */
.lg{background:#fff;object-fit:contain;padding:9px;border-radius:8px;flex:0 0 auto;display:block}
.lg.vide{background:#0e191d;border:1px solid rgba(255,255,255,.16);color:#8CA3AA;
 display:flex;align-items:center;justify-content:center;font-family:ui-monospace,Consolas,monospace}
`;

const LOGO_W = (t) => `<svg viewBox="0 0 512 512" style="width:${t}px;height:${t}px">
<rect width="512" height="512" rx="96" fill="#0c1d2e"/>
<g transform="translate(76 146) scale(2.77)"><path d="M16 24 L40 82 L58 48 L76 82" fill="none"
stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;
const MARQUE = `<div class="mark">${LOGO_W(64)}<b>WESTBOURSE</b></div>`;
const pied = (t) => `<div class="foot">${t}</div>`;

/* Frise des huit plus lourdes : les societes qui ont reellement porte les
   echanges, pas une selection editoriale. */
const frise = [...cotes]
  .sort((a, b) => cap(b) - cap(a))
  .slice(0, 8)
  .map((a) => vignette(a.code, 92))
  .join('');

/* Parts du temps de parole, normalisees sur la duree reelle de la voix : les
   scenes suivent le propos au lieu de le devancer. */
const PARTS = [0.062, 0.112, 0.138, 0.198, 0.17, 0.188, 0.132];
const SCENES = [
  `<div class="s" style="justify-content:center;align-items:center;text-align:center">
    <div style="margin-bottom:50px">${LOGO_W(190)}</div>
    <div style="font-family:ui-monospace,Consolas,monospace;font-size:52px;letter-spacing:.36em">WESTBOURSE</div>
    <div class="lbl" style="font-size:46px;margin-top:40px">Séance BRVM du ${dateFr}</div>
    <div style="display:flex;gap:16px;flex-wrap:wrap;justify-content:center;max-width:840px;margin-top:64px">${frise}</div></div>`,

  `${MARQUE}<div class="s"><div class="k">BRVM Composite</div>
    <div class="big ${composite && composite.variation_pct >= 0 ? 'up' : 'down'}">${composite ? sg(composite.variation_pct) : '—'}<span style="font-size:.4em"> %</span></div>
    <div class="mid" style="margin-top:40px;color:#D6E2E5">${composite ? fr(composite.valeur) : '—'}</div>
    <div class="lbl">points à la clôture</div></div>${pied('Source · séance officielle BRVM')}`,

  `${MARQUE}<div class="s"><div class="k">Largeur du marché</div>
    <div class="bar">
      <div style="width:${((baisses.length / cotes.length) * 100).toFixed(1)}%;background:#ff6b6b">${baisses.length}</div>
      <div style="width:${((stables / cotes.length) * 100).toFixed(1)}%;background:#5b6f75;color:#fff">${stables}</div>
      <div style="width:${((hausses.length / cotes.length) * 100).toFixed(1)}%;background:#3fe18b">${hausses.length}</div>
    </div>
    <div class="lbl"><b class="up">${hausses.length} hausses</b> · <b class="down">${baisses.length} baisses</b> · ${stables} stables<br>
    sur ${cotes.length} valeurs cotées</div></div>${pied(`${cotes.length} valeurs · séance officielle`)}`,

  `${MARQUE}<div class="s"><div class="k">Capitaux échangés${estime ? ' (estimés)' : ''}</div>
    <div class="big">${estime ? '≈ ' : ''}${fr(T / 1e9)}<span style="font-size:.32em"> Md</span></div>
    <div class="lbl">francs CFA ont changé de mains</div>
    <div class="bar" style="height:56px;margin-top:64px">
      <div style="width:${partB.toFixed(1)}%;background:#ff6b6b;font-size:26px">${fr(partB, 1)} %</div>
      <div style="width:${(100 - partB).toFixed(1)}%;background:#3fe18b;font-size:26px">${fr(100 - partB, 1)} %</div>
    </div>
    <div class="lbl" style="font-size:36px"><b class="down">${fr(partB, 1)} %</b> des capitaux
    se sont traités sur des titres en repli.</div></div>${pied(estime ? 'Estimé : cours × titres — valeur officielle non publiée' : 'Part baissière de la valeur échangée')}`,

  `${MARQUE}<div class="s"><div class="k">La ligne qui fait la séance</div>
    <div style="display:flex;align-items:center;gap:34px;margin-bottom:12px">${vignette(lourde.code, 150)}
      <div><div class="mid" style="font-size:66px">${lourde.designation ?? lourde.code}</div>
      <div class="lbl" style="font-size:30px;margin-top:10px">${lourde.code}</div></div></div>
    <div class="big cy" style="font-size:160px;margin-top:26px">${fr(partLourde, 1)}<span style="font-size:.35em"> %</span></div>
    <div class="lbl">du montant total échangé, à elle seule</div>
    <div class="lbl" style="font-size:42px;margin-top:24px">et ${lourde.variation_pct >= 0 ? 'gagne' : 'cède'}
      <b class="${lourde.variation_pct >= 0 ? 'up' : 'down'}">${sg(lourde.variation_pct)} %</b></div></div>${pied(lourde.code)}`,

  `${MARQUE}<div class="s"><div class="k">Extrêmes de la séance</div>
    <div class="row"><span class="id">${vignette(haut.code, 96)}
      <span><span class="c">${haut.code}</span><span class="n">${haut.designation ?? ''}</span></span></span>
      <span class="p up">${sg(haut.variation_pct)} %</span></div>
    <div class="row"><span class="id">${vignette(bas.code, 96)}
      <span><span class="c">${bas.code}</span><span class="n">${bas.designation ?? ''}</span></span></span>
      <span class="p down">${sg(bas.variation_pct)} %</span></div>
    <div class="lbl" style="font-size:32px;margin-top:44px">Plus forte hausse et plus forte baisse
    parmi les ${cotes.length} valeurs cotées.</div></div>${pied(`Séance du ${dateFr}`)}`,

  `<div class="s" style="justify-content:center;align-items:center;text-align:center">
    <div style="margin-bottom:46px">${LOGO_W(160)}</div>
    <div style="font-family:ui-monospace,Consolas,monospace;font-size:50px;letter-spacing:.36em">WESTBOURSE</div>
    <div class="lbl" style="font-size:40px;margin-top:36px">L’analyse complète de la séance</div>
    <div class="lbl cy" style="font-size:46px;margin-top:24px;font-family:ui-monospace,Consolas,monospace">westbourse.com</div>
    <div class="lbl" style="font-size:25px;color:#8CA3AA;margin-top:64px;max-width:780px">
    Tous les chiffres proviennent de la séance officielle de la BRVM.<br>
    ${estime ? 'Les capitaux sont estimés par cours × titres, la valeur officielle n’étant pas publiée.' : 'Aucune valeur n’est estimée.'}</div></div>`,
];

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
for (let i = 0; i < SCENES.length; i++) {
  await p.setContent(`<style>${CSS}</style><div class="grid"></div>${SCENES[i]}`);
  await p.waitForTimeout(220);
  await p.screenshot({ path: `${OUT}/s${String(i).padStart(2, '0')}.png` });
}
await b.close();
console.log(`${SCENES.length} scenes capturees`);

/* ------------------------------------------------------------ 4. montage */

const dernier = String(SCENES.length - 1).padStart(2, '0');
writeFileSync(
  `${OUT}/liste.txt`,
  SCENES.map(
    (_, i) => `file 's${String(i).padStart(2, '0')}.png'\nduration ${(PARTS[i] * dureeVoix).toFixed(3)}`,
  ).join('\n') + `\nfile 's${dernier}.png'\n`,
  'utf8',
);

const sortie = `${OUT}/westbourse-seance.mp4`;
execFileSync(
  'ffmpeg',
  [
    '-y', '-f', 'concat', '-safe', '0', '-i', 'liste.txt',
    '-i', `${OUT}/voix.mp3`,
    /* Pas de sous-titres incrustes : le montage ne porte que l'image et la voix. */
    '-vf', 'fps=30,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-c:a', 'aac', '-b:a', '160k', '-shortest', sortie,
  ],
  { cwd: OUT, stdio: 'pipe' },
);

console.log('video montee :', sortie);

/* ------------------------------------------------------- 5. fiche seance */

/* Ecrite pour l'etape de publication, qui compose sa legende a partir de ces
   memes nombres. Le principe vaut jusqu'au bout de la chaine : une legende ne
   peut pas annoncer autre chose que ce que la video montre.

   REFUS PLUTOT QUE PUBLICATION DOUTEUSE. Un cron publie sans relecture. Le
   jour ou la source ne renvoie rien d'exploitable, le pire resultat serait un
   post public affichant zero. On enonce donc ici ce qui rend une seance
   publiable, et publie.mjs s'arrete si l'un des points manque. */
const AGE_MAX = Number(process.env.VIDEO_AGE_MAX_JOURS || 5);
const ageJours = Math.floor((Date.now() - Date.parse(`${seance}T12:00:00Z`)) / 86400000);
const controles = {
  seance_recente: ageJours <= AGE_MAX,
  assez_de_valeurs: cotes.length >= 20,
  composite_present: !!composite,
  capitaux_non_nuls: T > 0,
  variations_non_plates: hausses.length + baisses.length > 0,
};
const publiable = Object.values(controles).every(Boolean);

writeFileSync(
  `${OUT}/seance.json`,
  JSON.stringify(
    {
      seance,
      date_fr: dateFr,
      age_jours: ageJours,
      valeurs: cotes.length,
      hausses: hausses.length,
      baisses: baisses.length,
      stables,
      capitaux_fcfa: T,
      capitaux_estimes: estime,
      composite: composite
        ? { valeur: composite.valeur, variation_pct: composite.variation_pct }
        : null,
      ligne_lourde: { code: lourde.code, part_pct: partLourde, variation_pct: lourde.variation_pct },
      plus_forte_hausse: { code: haut.code, variation_pct: haut.variation_pct },
      plus_forte_baisse: { code: bas.code, variation_pct: bas.variation_pct },
      duree_s: dureeVoix,
      fichier: sortie,
      controles,
      publiable,
    },
    null,
    2,
  ),
  'utf8',
);
console.log(
  publiable
    ? 'seance publiable'
    : 'SEANCE NON PUBLIABLE : ' +
        Object.entries(controles)
          .filter(([, v]) => !v)
          .map(([k]) => k)
          .join(', '),
);
