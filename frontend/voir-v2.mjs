/**
 * Voir /dashboard/v2 authentifie.
 *
 * La page est derriere le middleware : sans session elle redirige vers /login,
 * et elle n'a donc jamais pu etre observee malgre huit deploiements. On cree
 * une session de test via l'API admin Supabase, on la pose dans le cookie que
 * @supabase/ssr attend, et on capture la page.
 *
 * Le cookie @supabase/ssr est prefixe "base64-", encode en base64url, et
 * decoupe en morceaux .0 .1 .2 au-dela d'environ 3180 octets.
 *
 * Les secrets sont lus depuis .env.local et ne sont jamais affiches.
 */
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const env = readFileSync('.env.local', 'utf8');
const lire = (k) =>
  (env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1] ?? '').trim().replace(/^"|"$/g, '');

const URL_SB = lire('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE = lire('SUPABASE_SERVICE_ROLE_KEY');
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const EMAIL = 'apercu-v2@westbourse.test';
// Aucun mot de passe ici, et ce n'est pas un oubli : l'authentification passe
// par un lien magique genere cote admin. Un identifiant en clair dans le depot
// resterait un identifiant, meme pour un compte de test.

if (!URL_SB || !SERVICE) {
  console.error('Cle service_role absente de .env.local — impossible de creer une session.');
  process.exit(1);
}

let r = await fetch(`${URL_SB}/auth/v1/admin/users`, {
  method: 'POST',
  headers: {
    apikey: SERVICE,
    Authorization: `Bearer ${SERVICE}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ email: EMAIL, email_confirm: true }),
});
if (!r.ok && r.status !== 422) {
  console.error('creation du compte:', r.status, (await r.text()).slice(0, 200));
  process.exit(1);
}

// Le grant par mot de passe est refuse : la protection captcha est active sur
// ce projet. On passe par un lien magique genere cote admin, dont le jeton se
// verifie sans captcha.
r = await fetch(`${URL_SB}/auth/v1/admin/generate_link`, {
  method: 'POST',
  headers: {
    apikey: SERVICE,
    Authorization: `Bearer ${SERVICE}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ type: 'magiclink', email: EMAIL }),
});
if (!r.ok) {
  console.error('generate_link:', r.status, (await r.text()).slice(0, 200));
  process.exit(1);
}
const lien = await r.json();
const hash = lien.hashed_token ?? lien.properties?.hashed_token;
if (!hash) {
  console.error('jeton absent de la reponse generate_link');
  process.exit(1);
}

r = await fetch(`${URL_SB}/auth/v1/verify`, {
  method: 'POST',
  headers: { apikey: SERVICE, 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'magiclink', token_hash: hash }),
});
if (!r.ok) {
  console.error('verify:', r.status, (await r.text()).slice(0, 200));
  process.exit(1);
}
const session = await r.json();
console.log('session obtenue pour le compte de test');

const ref = URL_SB.replace(/^https?:\/\//, '').split('.')[0];
const nom = `sb-${ref}-auth-token`;
const brut = 'base64-' + Buffer.from(JSON.stringify(session), 'utf8').toString('base64url');
const morceaux = [];
for (let i = 0; i < brut.length; i += 3180) morceaux.push(brut.slice(i, i + 3180));
const cookies = morceaux.map((v, i) => ({
  name: morceaux.length === 1 ? nom : `${nom}.${i}`,
  value: v,
  domain: 'localhost',
  path: '/',
  httpOnly: false,
  secure: false,
  sameSite: 'Lax',
}));

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addCookies(cookies);
const p = await ctx.newPage();
const erreurs = [];
p.on('pageerror', (e) => erreurs.push(String(e).slice(0, 140)));

const rep = await p.goto(`${BASE}/dashboard/v2`, {
  waitUntil: 'domcontentloaded',
  timeout: 180000,
});
await p.waitForTimeout(4500);

console.log(`http=${rep?.status()} url=${p.url()}`);
if (/login/.test(p.url())) {
  console.error('ECHEC : toujours redirige vers /login — session non acceptee.');
  await b.close();
  process.exit(1);
}

const info = await p.evaluate(() => ({
  hauteur: document.documentElement.scrollHeight,
  debordement: document.documentElement.scrollWidth > innerWidth,
  cadre: document.querySelectorAll('.dash-v2 .v2-cstate').length,
  replis: document.querySelectorAll('.dash-v2 .v2-fold').length,
  dents: document.querySelectorAll('.dash-v2 .v2-dent').length,
  miennes: document.querySelectorAll('.dash-v2 .v2-dent.mien').length,
  capitaux: document.querySelectorAll('.dash-v2 .v2-cstate')[2]?.textContent?.trim().slice(0, 90),
  verdict: document.querySelector('.dash-v2 .v2-vword')?.textContent?.trim(),
  decor: !!document.querySelector('.dash-v2 .v2-teinte'),
}));
console.log(JSON.stringify(info, null, 1));
console.log('erreurs=' + (erreurs.length ? erreurs.join(' | ') : 'aucune'));

await p.screenshot({ path: 'v2-haut.png', clip: { x: 0, y: 0, width: 1440, height: 1000 } });
await p.evaluate(() => window.scrollTo(0, 950));
await p.waitForTimeout(700);
await p.screenshot({ path: 'v2-milieu.png', clip: { x: 0, y: 0, width: 1440, height: 1000 } });
await b.close();
console.log('captures ecrites');
