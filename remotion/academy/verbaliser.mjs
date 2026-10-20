// Texte affiché → texte LU par la voix off. La synthèse lit mal les chiffres
// français (« 18 488 », « 6,50 % », « 9h45 », « 2024-2031 ») : on les écrit en
// toutes lettres, comme dans le script fait main de la leçon 1. Pur, sans I/O.
// Contrôle : node academy/verbaliser.mjs --test

const UNITES = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
const DIZAINES = { 2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante' };

function moinsDeCent(n) {
  if (n <= 16) return UNITES[n];
  if (n < 20) return `dix-${UNITES[n - 10]}`;
  const d = Math.floor(n / 10), u = n % 10;
  if (d === 7) return n === 71 ? 'soixante et onze' : `soixante-${moinsDeCent(n - 60)}`;
  if (d === 8) return u === 0 ? 'quatre-vingts' : `quatre-vingt-${UNITES[u]}`;
  if (d === 9) return `quatre-vingt-${moinsDeCent(n - 80)}`;
  if (u === 0) return DIZAINES[d];
  if (u === 1) return `${DIZAINES[d]} et un`;
  return `${DIZAINES[d]}-${UNITES[u]}`;
}

function moinsDeMille(n) {
  const c = Math.floor(n / 100), r = n % 100;
  if (c === 0) return moinsDeCent(r);
  const cent = c === 1 ? 'cent' : `${UNITES[c]} cent${r === 0 ? 's' : ''}`;
  return r === 0 ? cent : `${cent} ${moinsDeCent(r)}`;
}

/** Entier positif en toutes lettres (jusqu'aux milliards). */
export function enLettres(n) {
  if (!Number.isFinite(n) || n < 0) return String(n);
  n = Math.round(n);
  if (n < 1000) return moinsDeMille(n);
  const parts = [];
  for (const [v, mot] of [[1e9, 'milliard'], [1e6, 'million']]) {
    const q = Math.floor(n / v);
    if (q) { parts.push(`${enLettres(q)} ${mot}${q > 1 ? 's' : ''}`); n %= v; }
  }
  const m = Math.floor(n / 1000);
  if (m) { parts.push(m === 1 ? 'mille' : `${moinsDeMille(m).replace(/s$/, '')} mille`); n %= 1000; }
  if (n) parts.push(moinsDeMille(n));
  return parts.join(' ');
}

/** « 6,50 » → « six virgule cinquante » ; « 0,05 » → « zéro virgule zéro cinq ». */
function decimal(entier, frac) {
  const zeros = frac.match(/^0+/)?.[0].length ?? 0;
  const reste = frac.slice(zeros);
  return `${enLettres(Number(entier))} virgule ${'zéro '.repeat(zeros)}${reste ? enLettres(Number(reste)) : ''}`.trim();
}

const NOMBRE = String.raw`\d{1,3}(?:[   ]\d{3})+|\d+`;

/** Remplace chiffres, unités et symboles par leur lecture. */
export function verbaliser(texte) {
  let t = String(texte ?? '');
  t = t
    .replace(/[✓✔✗✘•▪◆★]/g, '')
    .replace(/\s*→\s*/g, ', ').replace(/\s+\/\s+/g, ' sur ')
    .replace(/\bMme\b/g, 'Madame').replace(/\bM\.\s(?=[A-ZÉ])/g, 'Monsieur ')
    .replace(/\b1er\b/g, 'premier').replace(/\b1re\b/g, 'première')
    .replace(/\bJ\+(\d+)/g, (_, n) => `J plus ${enLettres(Number(n))}`)
    .replace(/\b(\d{1,2})h(\d{2})\b/g, (_, h, m) => `${enLettres(Number(h))} heure${Number(h) > 1 ? 's' : ''}${m === '00' ? '' : ' ' + enLettres(Number(m))}`)
    .replace(/\b(\d{4})\s*[-–]\s*(\d{4})\b/g, '$1 à $2')
    .replace(/×\s*(\d)/g, 'fois $1')
    // Formules des leçons (2026-10-20) : « Nombre d’actions × Dividende », « ÷ », « = ».
    .replace(/\s*×\s*/g, ' fois ')
    .replace(/\s*÷\s*/g, ' divisé par ')
    .replace(/\s*=\s*/g, ' égale ')
    .replace(/(^|[\s(])[+]\s*(?=\d)/g, '$1plus ')
    .replace(/(^|[\s(])[−-]\s*(?=\d)/g, '$1moins ');
  t = t.replace(new RegExp(String.raw`(${NOMBRE}),(\d+)`, 'g'), (_, e, f) => decimal(e.replace(/\D/g, ''), f));
  t = t.replace(new RegExp(NOMBRE, 'g'), (n) => enLettres(Number(n.replace(/\D/g, ''))));
  return t
    .replace(/\s*%/g, ' pour cent')
    .replace(/\bMds?\b/g, 'milliards').replace(/\b(FCFA|XOF)\b/g, 'francs CFA')
    .replace(/\bpts\b/g, 'points')
    .replace(/\s{2,}/g, ' ').trim();
}

if (process.argv[1]?.endsWith('verbaliser.mjs') && process.argv.includes('--test')) {
  const cas = [
    ['18 488 Md FCFA', 'dix-huit mille quatre cent quatre-vingt-huit milliards francs CFA'],
    ['+94 % en 6 ans', 'plus quatre-vingt-quatorze pour cent en six ans'],
    ['6,50% 2024-2031', 'six virgule cinquante pour cent deux mille vingt-quatre à deux mille trente et un'],
    ['9h45 → 14h55', 'neuf heures quarante-cinq, quatorze heures cinquante-cinq'],
    ['0,2 %', 'zéro virgule deux pour cent'],
    ['×22 en 28 ans', 'fois vingt-deux en vingt-huit ans'],
    ['478,53 pts', 'quatre cent soixante-dix-huit virgule cinquante-trois points'],
    ['1998', 'mille neuf cent quatre-vingt-dix-huit'],
    ['80 et 200 et 71 et 1 000 000', 'quatre-vingts et deux cents et soixante et onze et un million'],
    ['J+3', 'J plus trois'],
    ['Mme Ouédraogo', 'Madame Ouédraogo'],
    ['1 000 ÷ 10 000 × 100 = 10 %', 'mille divisé par dix mille fois cent égale dix pour cent'],
    ['Nombre d’actions × Dividende par action', 'Nombre d’actions fois Dividende par action'],
  ];
  let ko = 0;
  for (const [a, b] of cas) { const r = verbaliser(a); if (r !== b) { ko++; console.log(`✗ ${a}\n   obtenu  : ${r}\n   attendu : ${b}`); } }
  console.log(ko ? `${ko} échec(s)` : `${cas.length} cas OK`);
  process.exit(ko ? 1 : 0);
}
