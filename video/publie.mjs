/**
 * Publication de la video de seance sur Facebook et TikTok.
 *
 * La legende est composee a partir de seance.json, c'est-a-dire des memes
 * nombres que la voix et les images. Rien ici ne reformule le marche : si un
 * chiffre change, il change dans la video et dans la legende ensemble.
 *
 * DEUX REFUS DELIBERES :
 *  - une seance jugee non publiable par genere.mjs n'est jamais envoyee ;
 *  - une plateforme non configuree est ignoree sans faire echouer le cron.
 *    Seul l'echec d'une plateforme reellement configuree est rouge.
 *
 *   node publie.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.VIDEO_OUT || `${RACINE}/gan-harness/video`;
const FICHE = `${OUT}/seance.json`;

if (!existsSync(FICHE)) {
  console.error(`seance.json introuvable dans ${OUT} — lancer genere.mjs d'abord.`);
  process.exit(1);
}
const m = JSON.parse(readFileSync(FICHE, 'utf8'));
const VIDEO = m.fichier;
if (!existsSync(VIDEO)) {
  console.error(`video introuvable : ${VIDEO}`);
  process.exit(1);
}

if (!m.publiable) {
  const manque = Object.entries(m.controles)
    .filter(([, v]) => !v)
    .map(([k]) => k)
    .join(', ');
  console.log(`PUBLICATION ANNULEE — la seance ne passe pas les controles : ${manque}`);
  console.log("Aucun envoi. Mieux vaut un jour sans video qu'un post public faux.");
  process.exit(0);
}

/* ----------------------------------------------------------- 1. legende */

const fr = (x, d = 2) => x.toFixed(d).replace('.', ',');
const sg = (x, d = 2) => `${x >= 0 ? '+' : '−'}${fr(Math.abs(x), d)}`;

const LEGENDE = [
  `BRVM — seance du ${m.date_fr}.`,
  m.composite
    ? `BRVM Composite ${sg(m.composite.variation_pct)} % a ${fr(m.composite.valeur)} points.`
    : '',
  `${m.hausses} hausses, ${m.baisses} baisses, ${m.stables} stables sur ${m.valeurs} valeurs.`,
  `${m.capitaux_estimes ? 'Environ ' : ''}${fr(m.capitaux_fcfa / 1e9)} Md FCFA echanges.`,
  `Plus forte hausse ${m.plus_forte_hausse.code} ${sg(m.plus_forte_hausse.variation_pct)} %, ` +
    `plus forte baisse ${m.plus_forte_baisse.code} ${sg(m.plus_forte_baisse.variation_pct)} %.`,
  'Chiffres issus de la seance officielle de la BRVM.',
  m.capitaux_estimes
    ? "Capitaux estimes par cours x titres, la valeur officielle n'etant pas publiee."
    : '',
  'Information de marche, pas un conseil en investissement.',
  'Analyse complete : westbourse.com',
  '#BRVM #Bourse #UEMOA #Abidjan #CoteDIvoire #Finance #Investissement #WESTBOURSE',
]
  .filter(Boolean)
  .join('\n');

const TITRE = `BRVM — seance du ${m.date_fr}`;
const octets = readFileSync(VIDEO);
console.log(`${TITRE} · ${(octets.length / 1e6).toFixed(2)} Mo · ${m.duree_s.toFixed(1)} s`);

const echecs = [];
let envois = 0;
/* Ce qui sera repris dans la notification du soir : une ligne par destination,
   redigee pour un humain qui ne lira pas les journaux du runner. */
const journal = [];

/* -------------------------------------------------- 2. landing page --- */

/* La vidéo est hebergee dans le bucket public `seance-video` et lue par la
   landing. Cette etape passe AVANT les reseaux sociaux : le site doit etre
   servi meme quand aucune plateforme n'est configuree.

   Le fichier porte la date de la seance, jamais un nom fixe : chaque journee a
   son URL propre, donc aucun cache de CDN ne peut servir la video d'hier sous
   les chiffres d'aujourd'hui. Seul `derniere.json`, minuscule, est reecrit — et
   avec un cache court. */
const dotenv = `${RACINE}/frontend/.env.local`;
const envLocal = existsSync(dotenv) ? readFileSync(dotenv, 'utf8') : '';
const lire = (...cles) => {
  for (const k of cles) {
    if (process.env[k]) return process.env[k].trim();
    /* pas de variable nommee m ici : m est la fiche de seance, plus haut. */
    const trouve = envLocal.match(new RegExp('^' + k + '=(.*)$', 'm'));
    if (trouve) return trouve[1].trim().replace(/^"|"$/g, '');
  }
  return '';
};
const URL_SB = lire('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
const SERVICE = lire('SUPABASE_SERVICE_ROLE_KEY');
const BUCKET = 'seance-video';

if (URL_SB && SERVICE) {
  try {
    const envoyer = async (chemin, corps, type, cache) => {
      const r = await fetch(`${URL_SB}/storage/v1/object/${BUCKET}/${chemin}`, {
        method: 'POST',
        headers: {
          apikey: SERVICE,
          Authorization: `Bearer ${SERVICE}`,
          'Content-Type': type,
          /* Constate le 2026-09-03 : ce service renvoie `no-cache` quoi qu'on
             envoie — teste en en-tete ET en champ multipart. L'en-tete reste
             la, correct, pour le jour ou il sera honore. Sans consequence sur
             la justesse : le chemin porte la date, donc un cache perime ne
             peut jamais afficher la video d'hier sous les chiffres du jour. */
          'cache-control': `max-age=${cache}`,
          /* upsert : relancer la meme seance remplace le fichier au lieu
             d'echouer sur un doublon. */
          'x-upsert': 'true',
        },
        body: corps,
      });
      if (!r.ok) throw new Error(`${chemin} → ${r.status} ${(await r.text()).slice(0, 200)}`);
    };
    const publique = (chemin) => `${URL_SB}/storage/v1/object/public/${BUCKET}/${chemin}`;

    const cheminVideo = `seance/${m.seance}.mp4`;
    await envoyer(cheminVideo, octets, 'video/mp4', 31536000);

    /* L'affiche est facultative : une vidéo sans vignette reste lisible, mais
       l'absence du fichier ne doit pas empecher la publication. */
    let affiche = null;
    const fAffiche = `${OUT}/affiche.jpg`;
    if (existsSync(fAffiche)) {
      const cheminAffiche = `seance/${m.seance}.jpg`;
      await envoyer(cheminAffiche, readFileSync(fAffiche), 'image/jpeg', 31536000);
      affiche = publique(cheminAffiche);
    }

    const url = publique(cheminVideo);
    /* `fichier` est un chemin local sans interet pour le site, et qui trahirait
       l'arborescence de la machine de build. On le remplace par l'URL. */
    const { fichier, ...reste } = m;
    await envoyer(
      'derniere.json',
      JSON.stringify({ ...reste, url, affiche }, null, 2),
      'application/json',
      60,
    );
    console.log(`Landing : hebergee (${url})`);
    journal.push(`Site : en ligne sur westbourse.com`);
    envois++;
  } catch (e) {
    console.error(`Landing : ECHEC — ${e.message}`);
    journal.push(`Site : ECHEC — ${e.message}`);
    echecs.push('landing');
  }
} else {
  console.log('Landing : ignore (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY absents)');
}

/* ---------------------------------------------------------- 3. Facebook */

/* Video de Page via l'API Graph. L'hote graph-video est celui prevu pour les
   televersements ; graph tout court fonctionne mais n'est pas garanti sur les
   fichiers volumineux. */
const FB_PAGE = process.env.FB_PAGE_ID;
const FB_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
const FB_V = process.env.FB_API_VERSION || 'v21.0';

if (FB_PAGE && FB_TOKEN) {
  try {
    const brouillon = process.env.FB_BROUILLON === 'true';
    const form = new FormData();
    form.set('access_token', FB_TOKEN);
    form.set('title', TITRE);
    form.set('description', LEGENDE);
    /* FB_BROUILLON=true depose sur la Page sans publier. */
    form.set('published', brouillon ? 'false' : 'true');
    form.set('source', new Blob([octets], { type: 'video/mp4' }), 'westbourse-seance.mp4');

    const r = await fetch(`https://graph-video.facebook.com/${FB_V}/${FB_PAGE}/videos`, {
      method: 'POST',
      body: form,
    });
    const rep = await r.json().catch(() => ({}));
    if (!r.ok || rep.error) {
      throw new Error(`${r.status} ${rep.error?.message ?? JSON.stringify(rep).slice(0, 300)}`);
    }
    console.log(`Facebook : ${brouillon ? 'depose' : 'publie'} (id ${rep.id})`);
    journal.push(`Facebook : ${brouillon ? 'brouillon depose' : 'publie'}`);
    envois++;
  } catch (e) {
    console.error(`Facebook : ECHEC — ${e.message}`);
    journal.push(`Facebook : ECHEC — ${e.message}`);
    echecs.push('facebook');
  }
} else {
  console.log('Facebook : ignore (FB_PAGE_ID / FB_PAGE_ACCESS_TOKEN absents)');
}

/* ------------------------------------------------------------ 4. TikTok */

/* Deux chemins selon l'etat de l'application developpeur :
   - inbox  : depose un brouillon dans l'appli, l'utilisateur finit la
              publication. Fonctionne avec la portee video.upload, sans audit.
   - direct : publie reellement. Exige la portee video.publish ET une
              application auditee par TikTok.
   Le defaut est inbox parce que c'est le seul qui fonctionne sans audit :
   mieux vaut un chemin qui marche qu'un chemin rouge tous les jours. */
const TT_MODE = process.env.TIKTOK_MODE || 'inbox';
const TT_PRIVACITE = process.env.TIKTOK_PRIVACY || 'PUBLIC_TO_EVERYONE';

/* Un jeton d'acces TikTok expire en 24 heures. Fige dans un secret, il rendrait
   le cron rouge des le deuxieme jour. On echange donc le jeton de
   rafraichissement a chaque execution, quand il est fourni ; TIKTOK_ACCESS_TOKEN
   ne sert plus qu'aux essais manuels a chaud. */
const rafraichirTikTok = async () => {
  const cle = process.env.TIKTOK_CLIENT_KEY;
  const secret = process.env.TIKTOK_CLIENT_SECRET;
  const refresh = process.env.TIKTOK_REFRESH_TOKEN;
  if (!cle || !secret || !refresh) return process.env.TIKTOK_ACCESS_TOKEN || null;

  const r = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: cle,
      client_secret: secret,
      grant_type: 'refresh_token',
      refresh_token: refresh,
    }),
  });
  const rep = await r.json().catch(() => ({}));
  if (!r.ok || !rep.access_token) {
    throw new Error(
      `rafraichissement → ${r.status} ${rep.error_description ?? rep.error ?? JSON.stringify(rep).slice(0, 200)}`,
    );
  }
  /* TikTok fait tourner le jeton de rafraichissement. S'il change et que le
     secret n'est pas mis a jour, la chaine casse silencieusement dans un an
     ou dans un jour. On le dit fort plutot que de le decouvrir en panne. */
  if (rep.refresh_token && rep.refresh_token !== refresh) {
    console.warn(
      'TikTok : le jeton de rafraichissement a change. Mettre a jour le secret ' +
        'TIKTOK_REFRESH_TOKEN, sinon la prochaine execution echouera.',
    );
  }
  return rep.access_token;
};

let TT_TOKEN = null;
try {
  TT_TOKEN = await rafraichirTikTok();
} catch (e) {
  console.error(`TikTok : ECHEC — ${e.message}`);
  echecs.push('tiktok');
}

const tt = async (chemin, corps) => {
  const r = await fetch(`https://open.tiktokapis.com/v2${chemin}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TT_TOKEN}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(corps),
  });
  const rep = await r.json().catch(() => ({}));
  const code = rep.error?.code;
  if (!r.ok || (code && code !== 'ok')) {
    throw new Error(
      `${chemin} → ${r.status} ${rep.error?.message ?? JSON.stringify(rep).slice(0, 300)}`,
    );
  }
  return rep.data ?? {};
};

if (TT_TOKEN) {
  try {
    const taille = octets.length;
    /* Un seul morceau : la video pese quelques Mo, tres en dessous du seuil
       a partir duquel TikTok impose un decoupage. */
    const source_info = {
      source: 'FILE_UPLOAD',
      video_size: taille,
      chunk_size: taille,
      total_chunk_count: 1,
    };
    const corps =
      TT_MODE === 'direct'
        ? {
            post_info: {
              title: LEGENDE.slice(0, 2200),
              privacy_level: TT_PRIVACITE,
              disable_comment: false,
              disable_duet: false,
              disable_stitch: false,
            },
            source_info,
          }
        : { source_info };

    const init = await tt(
      TT_MODE === 'direct' ? '/post/publish/video/init/' : '/post/publish/inbox/video/init/',
      corps,
    );

    const up = await fetch(init.upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Range': `bytes 0-${taille - 1}/${taille}`,
      },
      body: octets,
    });
    if (!up.ok) {
      throw new Error(`televersement → ${up.status} ${(await up.text()).slice(0, 300)}`);
    }

    const etat = await tt('/post/publish/status/fetch/', { publish_id: init.publish_id });
    console.log(
      `TikTok : ${TT_MODE === 'direct' ? 'publie' : 'depose en brouillon'} ` +
        `(${init.publish_id}, statut ${etat.status ?? 'inconnu'})`,
    );
    if (TT_MODE !== 'direct') {
      console.log("  → a valider depuis la boite de reception de l'appli TikTok.");
    }
    journal.push(
      TT_MODE === 'direct'
        ? 'TikTok : publie'
        : "TikTok : brouillon depose — A VALIDER dans l'appli (boite de reception)",
    );
    envois++;
  } catch (e) {
    console.error(`TikTok : ECHEC — ${e.message}`);
    journal.push(`TikTok : ECHEC — ${e.message}`);
    echecs.push('tiktok');
  }
} else if (!echecs.includes('tiktok')) {
  console.log('TikTok : ignore (ni TIKTOK_REFRESH_TOKEN ni TIKTOK_ACCESS_TOKEN)');
}

/* ------------------------------------------------- 5. notification du soir */

/* Pourquoi cette etape existe. TikTok en mode `inbox` depose un BROUILLON : la
   video n'est publiee que si quelqu'un ouvre l'appli et valide. Un cron muet
   rendrait donc ce mode inutilisable — personne ne se souvient d'un geste
   quotidien dont rien ne l'avertit. La notification est ce qui rend le choix
   du brouillon tenable, plutot que theorique.
   Meme canaux que le reste du projet ; sans configuration, on se tait. */
const notifier = async (texte) => {
  const jeton = process.env.TELEGRAM_BOT_TOKEN;
  const salon = process.env.TELEGRAM_CHAT_ID;
  if (jeton && salon) {
    try {
      await fetch(`https://api.telegram.org/bot${jeton}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: salon, text: texte, disable_web_page_preview: true }),
      });
    } catch (e) {
      console.error(`Telegram : ${e.message}`);
    }
  }
  const resend = process.env.RESEND_API_KEY;
  const de = process.env.ALERTS_EMAIL_FROM;
  const a = process.env.ALERTS_EMAIL_TO;
  if (resend && de && a) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resend}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: de,
          to: a.split(',').map((x) => x.trim()),
          subject: `Vidéo BRVM — séance du ${m.date_fr}`,
          text: texte,
        }),
      });
    } catch (e) {
      console.error(`Resend : ${e.message}`);
    }
  }
};

const resume = [
  `Vidéo de la séance du ${m.date_fr}`,
  `${m.hausses} hausses · ${m.baisses} baisses · ${m.stables} stables sur ${m.valeurs} valeurs`,
  '',
  ...(journal.length ? journal : ['Aucune destination configurée.']),
].join('\n');

await notifier(resume);

/* ------------------------------------------------------------- 6. bilan */

if (echecs.length) {
  console.error(`Echec de publication : ${echecs.join(', ')}`);
  process.exit(1);
}
if (envois === 0) {
  console.log('Aucune plateforme configuree — video generee, rien envoye.');
}
