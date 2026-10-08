// Le récit de la vidéo de séance : QUOI dire, dans QUEL ordre, sous QUEL habillage.
//
// PUR. Ne lit rien, n'écrit rien, n'appelle aucun réseau : il reçoit les
// chiffres de la séance (une seule lecture, faite par genere.mjs) et rend une
// suite de « temps » — une phrase lue + la scène qui l'illustre. La voix, les
// images et la légende sont toutes tirées de ce même objet.
//
// TROIS MODÈLES, jamais le même deux séances de suite : « nuit » (terminal
// sombre), « papier » (une de journal claire), « mosaïque » (carte du marché).
// Le modèle tourne sur le RANG OUVRÉ de la séance, pas sur le jour calendaire :
// avec un modulo sur les jours, le vendredi et le lundi (trois jours d'écart)
// tomberaient sur le même habillage une semaine sur une.
//
// L'ANGLE vient de la donnée. On mesure ce que la séance a d'inhabituel (plus
// forte variation de l'indice sur la fenêtre, série, indice et majorité des
// titres en désaccord, une valeur qui domine les échanges, un écart extrême) ;
// le fait le plus marquant ouvre la vidéo et sa scène passe en tête. Aucun
// fait n'est jugé : on dit ce qui s'est passé, jamais ce qu'il faut en penser.
//
// AUCUN CHIFFRE ÉTRANGER. `chiffresEtrangers` relit le texte final et refuse
// tout nombre absent de la liste construite DIRECTEMENT depuis la donnée —
// indépendamment des phrases. Un gabarit fautif ne peut donc pas faire dire à
// la voix un chiffre que la séance n'a pas produit.

export const MODELES = ['nuit', 'papier', 'mosaique'];

/* ── Rotation ─────────────────────────────────────────────────────────── */

/** Rang ouvré d'une date ISO : deux jours ouvrés consécutifs ont deux rangs
 *  consécutifs, week-end compris (vendredi → lundi = +1). */
export function rangOuvre(iso) {
  const j = Math.floor(Date.parse(`${iso}T12:00:00Z`) / 86400000);
  const decale = j + 3; // le 1970-01-01 était un jeudi : lundi = 0
  return Math.floor(decale / 7) * 5 + Math.min(decale % 7, 4);
}

export function choisirModele(iso, force) {
  if (force && MODELES.includes(force)) return force;
  return MODELES[rangOuvre(iso) % MODELES.length];
}

/** Hachage FNV-1a : choix de formulation stable pour une séance donnée. */
function graine(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
const pioche = (liste, cle) => liste[graine(cle) % liste.length];

/* ── Nombres dits ─────────────────────────────────────────────────────── */

/** « 4 virgule 96 » : la virgule écrite en toutes lettres, les zéros de
 *  queue retirés (« 4 virgule 9 », jamais « 4 virgule 90 »). */
export function dit(x, d = 2) {
  return String(Number(Math.abs(x).toFixed(d))).replace('.', ' virgule ');
}
const pct = (x, d = 2) => `${dit(x, d)} pour cent`;

/** Montant parlé : milliards au-dessus du milliard, millions en dessous. */
export function montantDit(fcfa) {
  return fcfa >= 1e9 ? `${dit(fcfa / 1e9, 2)} milliards` : `${dit(fcfa / 1e6, 0)} millions`;
}

const REPERES = [
  { v: 25, de: 'd’un quart', le: 'un quart' },
  { v: 100 / 3, de: 'd’un tiers', le: 'un tiers' },
  { v: 50, de: 'de la moitié', le: 'la moitié' },
  { v: 200 / 3, de: 'des deux tiers', le: 'les deux tiers' },
  { v: 75, de: 'des trois quarts', le: 'les trois quarts' },
];

/** Une proportion dite comme on la dirait : « près de la moitié » pour 47,4 %,
 *  « un peu plus d'un tiers » pour 35,2 %. Hors de ±3 points d'un repère, le
 *  chiffre exact. L'écran, lui, affiche toujours le chiffre exact. */
export function proportionDite(p) {
  for (const r of REPERES) {
    const e = p - r.v;
    if (Math.abs(e) <= 0.6) return `environ ${r.le}`;
    if (e < 0 && e >= -3) return `près ${r.de}`;
    if (e > 0 && e <= 3) return `un peu plus ${r.de}`;
  }
  return pct(p, 1);
}

const ORDINAUX = ['', 'première', 'deuxième', 'troisième', 'quatrième', 'cinquième',
  'sixième', 'septième', 'huitième', 'neuvième', 'dixième'];

/** Accord en nombre : « 1 valeur progresse », « 23 valeurs progressent ». */
const accord = (n, sing, plur) => `${n} ${n > 1 ? plur : sing}`;
const majuscule = (s) => s.replace(/^./, (c) => c.toUpperCase());

/* ── Noms dits ────────────────────────────────────────────────────────── */

const PAYS = ["COTE D'IVOIRE", 'BURKINA FASO', 'GUINEE BISSAU', 'SENEGAL', 'NIGER', 'MALI', 'BENIN', 'TOGO'];
const MOTS = {
  SOCIETE: 'Société', GENERALE: 'Générale', NESTLE: 'Nestlé', TOTALENERGIES: 'TotalEnergies',
  BERNABE: 'Bernabé', SODE: 'Sodeci', SENEGAL: 'Sénégal', BENIN: 'Bénin', COTE: 'Côte',
};
const ACRONYMES = new Set(['CFAO', 'CIE', 'SMB', 'SOGB', 'NSIA', 'BICI', 'NEI', 'CEDA']);
const PETITS = new Set(['DE', 'DU', 'DES', 'LA', 'LE', 'ET', 'POUR', 'OF']);

const normaliser = (s) => String(s ?? '').replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim().toUpperCase();

/** Retire le pays final, sauf s'il fait partie du nom (« … DU BENIN »). */
function tronc(nom) {
  for (const p of PAYS) {
    if (nom.endsWith(` ${p}`)) {
      const reste = nom.slice(0, -p.length - 1);
      return /\b(DU|DE)$|D'$/.test(reste) ? nom : reste;
    }
  }
  return nom;
}

function casse(mot) {
  return mot
    .split('-')
    .map((m) => MOTS[m] ?? (ACRONYMES.has(m) ? m : m.charAt(0) + m.slice(1).toLowerCase()))
    .join('-');
}

function joliNom(nom) {
  return nom
    .split(' ')
    .map((mot, i) => {
      // « L'INDUSTRIE » → « l'Industrie », « D'IVOIRE » → « d'Ivoire »
      const ap = mot.match(/^([LD])'(.+)$/);
      if (ap) return `${i === 0 ? ap[1] : ap[1].toLowerCase()}'${casse(ap[2])}`;
      if (i > 0 && PETITS.has(mot)) return mot.toLowerCase();
      return casse(mot);
    })
    .join(' ');
}

/** Nom tel qu'on le prononce : « Sonatel » plutôt que « SONATEL SENEGAL ».
 *  Le pays reste quand il départage (Bank of Africa Sénégal / Niger, Ecobank
 *  Côte d'Ivoire face au groupe Ecobank Transnational). */
export function nomDit(designation, toutes = []) {
  const nom = normaliser(designation);
  const t = tronc(nom);
  if (t !== nom) {
    const autres = toutes.map(normaliser).filter((x) => x !== nom).map(tronc);
    if (autres.some((x) => x === t || x.startsWith(`${t} `))) return joliNom(nom);
  }
  return joliNom(t);
}

/* ── Secteurs ─────────────────────────────────────────────────────────── */

const SECTEURS = {
  'Services financiers': { nom: 'les services financiers', pl: true },
  'Télécommunications': { nom: 'les télécommunications', pl: true },
  'Consommation de base': { nom: 'la consommation de base', pl: false },
  'Consommation discrétionnaire': { nom: 'la consommation discrétionnaire', pl: false },
  Industriels: { nom: 'les industriels', pl: true },
  Energie: { nom: 'l’énergie', pl: false },
  'Services publics': { nom: 'les services publics', pl: true },
};

/* ── Faits mesurés ────────────────────────────────────────────────────── */

const signe = (x) => (x > 0 ? 1 : x < 0 ? -1 : 0);

/** Ce que l'historique de l'indice permet d'affirmer — et RIEN si la dernière
 *  date n'est pas la séance, ou si son sens contredit la variation publiée. */
export function faitsIndice(historique, seance, variation) {
  const h = (historique ?? []).filter((p) => p.valeur != null);
  if (h.length < 5 || h[h.length - 1].date !== seance || variation == null) return null;
  const ecarts = h.slice(1).map((p, i) => p.valeur - h[i].valeur);
  const jour = ecarts[ecarts.length - 1];
  if (signe(jour) === 0 || signe(jour) !== signe(variation)) return null;

  let serie = 0;
  for (let i = ecarts.length - 1; i >= 0 && signe(ecarts[i]) === signe(jour); i--) serie++;
  const avant = ecarts.slice(0, -1);
  const record = avant.length >= 9 &&
    avant.every((e) => signe(e) !== signe(jour) || Math.abs(e) < Math.abs(jour));
  return {
    sens: signe(jour),
    serie,
    serie_plafonnee: serie === ecarts.length, // toute la fenêtre : la série peut être plus longue
    record,
    fenetre: h.length,
    evolution_pct: h.length >= 10 ? (h[h.length - 1].valeur / h[0].valeur - 1) * 100 : null,
  };
}

/* ── Angles ───────────────────────────────────────────────────────────── */

/** Les faits marquants de la séance, notés. Le premier ouvre la vidéo. */
export function angles(d, faits) {
  const c = d.composite;
  const liste = [];
  const motSens = (s) => (s > 0 ? 'hausse' : 'baisse');
  if (c && faits?.record) {
    liste.push({ id: 'record', scene: 'indice', note: 90,
      accroche: `L’indice signe sa plus forte ${motSens(faits.sens)} des ${faits.fenetre} dernières séances.` });
  }
  if (c && faits && faits.serie >= 3 && faits.serie <= 10 && !faits.serie_plafonnee) {
    liste.push({ id: 'serie', scene: 'indice', note: 60 + faits.serie * 4,
      accroche: `Le BRVM Composite aligne une ${ORDINAUX[faits.serie]} séance de ${motSens(faits.sens)} d’affilée.` });
  }
  if (c && Math.abs(d.hausses - d.baisses) >= 3 &&
      ((c.variation_pct > 0 && d.baisses > d.hausses) || (c.variation_pct < 0 && d.hausses > d.baisses))) {
    liste.push({ id: 'divergence', scene: 'largeur', note: 75,
      accroche: c.variation_pct > 0
        ? 'L’indice monte, mais la majorité des valeurs recule.'
        : 'L’indice recule, alors que la majorité des valeurs monte.' });
  }
  if (d.lourde && d.lourde.part_pct >= 30) {
    liste.push({ id: 'concentration', scene: 'lourde', note: 50 + d.lourde.part_pct / 2,
      accroche: 'Une seule valeur a dominé les échanges.' });
  }
  const extreme = [d.meilleures?.[0], d.pires?.[0]].filter(Boolean)
    .sort((a, b) => Math.abs(b.variation_pct) - Math.abs(a.variation_pct))[0];
  if (extreme && Math.abs(extreme.variation_pct) > 7) {
    liste.push({ id: 'extreme', scene: 'palmares', note: 65,
      accroche: `Une valeur a ${extreme.variation_pct > 0 ? 'bondi' : 'chuté'} de plus de sept pour cent.` });
  }
  if (d.hausses >= 15 && d.hausses >= 2 * Math.max(d.baisses, 1)) {
    liste.push({ id: 'largeur', scene: 'largeur', note: 45, accroche: 'La hausse est très largement partagée.' });
  } else if (d.baisses >= 15 && d.baisses >= 2 * Math.max(d.hausses, 1)) {
    liste.push({ id: 'largeur', scene: 'largeur', note: 45, accroche: 'La baisse touche la grande majorité des valeurs.' });
  }
  return liste.sort((a, b) => b.note - a.note || graine(d.seance + a.id) - graine(d.seance + b.id));
}

/* ── Les phrases de chaque scène ──────────────────────────────────────── */

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août',
  'septembre', 'octobre', 'novembre', 'décembre'];

export function dateDite(iso) {
  const dt = new Date(`${iso}T12:00:00Z`);
  const jour = dt.getUTCDate();
  return `${JOURS[dt.getUTCDay()]} ${jour === 1 ? '1er' : jour} ${MOIS[dt.getUTCMonth()]}`;
}

function phraseIndice(d, faits, k) {
  const c = d.composite;
  if (!c) return null;
  const v = c.variation_pct;
  let p;
  if (Math.abs(v) < 0.005) {
    p = `Le BRVM Composite termine inchangé, à ${dit(c.valeur)} points.`;
  } else {
    const h = v > 0;
    p = pioche([
      `Le BRVM Composite ${h ? 'gagne' : 'perd'} ${pct(v)}, à ${dit(c.valeur)} points.`,
      `Le BRVM Composite termine en ${h ? 'hausse' : 'baisse'} de ${pct(v)}, à ${dit(c.valeur)} points.`,
      `L’indice phare, le BRVM Composite, ${h ? 'progresse' : 'recule'} de ${pct(v)} et clôture à ${dit(c.valeur)} points.`,
    ], k);
  }
  const e = faits?.evolution_pct;
  if (e != null && Math.abs(e) >= 0.005) {
    p += ` Sur ses ${faits.fenetre} dernières séances, il ${e > 0 ? 'gagne' : 'perd'} ${pct(e)}.`;
  }
  return p;
}

function phraseLargeur(d, k) {
  const { hausses: h, baisses: b, stables: s, valeurs: n } = d;
  return majuscule(pioche([
    `${accord(h, 'valeur progresse', 'valeurs progressent')}, ${accord(b, 'recule', 'reculent')}` +
      `${s > 0 ? `, ${accord(s, 'reste stable', 'restent stables')}` : ''}.`,
    `Sur ${n} valeurs cotées, ${accord(h, 'monte', 'montent')} et ${accord(b, 'baisse', 'baissent')}` +
      `${s > 0 ? ` ; ${accord(s, 'ne bouge pas', 'ne bougent pas')}` : ''}.`,
    `${accord(h, 'hausse', 'hausses')}, ${accord(b, 'baisse', 'baisses')}` +
      `${s > 0 ? ` et ${accord(s, 'valeur inchangée', 'valeurs inchangées')}` : ''}.`,
  ], k));
}

function phraseCapitaux(d, k) {
  const m = `${d.estime ? 'environ ' : ''}${montantDit(d.capitaux)} de francs CFA`;
  const prop = proportionDite(d.partB);
  return majuscule(pioche([
    `${m} ont été échangés, dont ${prop} sur des titres en baisse.`,
    `${m} ont changé de mains ; ${prop} de ce montant porte sur des titres en repli.`,
  ], k));
}

function phraseLourde(d, k) {
  const l = d.lourde;
  if (!l) return null;
  const nom = nomDit(l.designation, d.designations);
  const mvt = Math.abs(l.variation_pct) < 0.05
    ? 'à cours quasi inchangé'
    : `et ${l.variation_pct > 0 ? 'gagne' : 'cède'} ${pct(l.variation_pct)}`;
  const part = proportionDite(l.part_pct);
  return pioche([
    `${nom} concentre à elle seule ${part} des capitaux échangés, ${mvt}.`,
    `La valeur la plus échangée est ${nom} : ${part} du montant total, ${mvt}.`,
  ], k);
}

function phrasePalmares(d, k) {
  const hauts = d.meilleures ?? [], bas = d.pires ?? [];
  if (!hauts.length && !bas.length) return null;
  const n = (a) => nomDit(a.designation, d.designations);
  const morceaux = [];
  if (hauts.length) {
    const suite = hauts.length > 1 ? `, devant ${n(hauts[1])}` : ''; // deux noms suffisent à la voix ; l'écran montre les trois
    morceaux.push(pioche([
      `En tête, ${n(hauts[0])}, plus ${pct(hauts[0].variation_pct)}${suite}.`,
      `Plus forte hausse : ${n(hauts[0])}, plus ${pct(hauts[0].variation_pct)}${suite}.`,
    ], `${k}h`));
  }
  if (bas.length) {
    morceaux.push(pioche([
      `En queue de classement, ${n(bas[0])}, moins ${pct(bas[0].variation_pct)}.`,
      `Plus forte baisse : ${n(bas[0])}, moins ${pct(bas[0].variation_pct)}.`,
    ], `${k}b`));
  }
  return morceaux.join(' ');
}

function phraseSecteurs(d) {
  const s = (d.secteurs ?? []).find((x) => SECTEURS[x.secteur]);
  if (!s || s.valeurs < 2 || s.part_pct < 25) return null;
  const { nom, pl } = SECTEURS[s.secteur];
  const leurs = pl ? 'leurs' : 'ses';
  const suite = s.hausses === 0
    ? `aucune de ${leurs} ${s.valeurs} valeurs ne monte`
    : `${s.hausses} de ${leurs} ${s.valeurs} valeurs ${s.hausses > 1 ? 'montent' : 'monte'}`;
  return `Côté secteurs, ${nom} ${pl ? 'pèsent' : 'pèse'} ${proportionDite(s.part_pct)} des capitaux ; ${suite}.`;
}

/* ── Composition ──────────────────────────────────────────────────────── */

/** Ordre de base de chaque modèle. L'angle du jour passe devant. */
const ORDRE = {
  nuit: ['indice', 'largeur', 'capitaux', 'lourde', 'palmares'],
  papier: ['indice', 'palmares', 'secteurs', 'lourde'],
  mosaique: ['largeur', 'indice', 'palmares', 'capitaux'],
};

/**
 * @param d  { seance, composite:{valeur,variation_pct}|null, hausses, baisses,
 *             stables, valeurs, capitaux, estime, partB,
 *             lourde:{code,designation,part_pct,variation_pct},
 *             meilleures:[{code,designation,variation_pct}], pires:[…],
 *             secteurs:[{secteur,valeurs,hausses,part_pct}],
 *             historique:[{date,valeur}] (croissant), designations:[…] }
 * @param options { modele?: forcer un modèle (VIDEO_MODELE) }
 */
export function composerRecit(d, options = {}) {
  const modele = choisirModele(d.seance, options.modele);
  const faits = faitsIndice(d.historique, d.seance, d.composite?.variation_pct);
  const angle = angles(d, faits)[0] ?? null;

  const ordre = [...ORDRE[modele]];
  if (angle) {
    const i = ordre.indexOf(angle.scene);
    if (i >= 0) ordre.splice(i, 1);
    ordre.unshift(angle.scene);
  }

  const k = (type) => `${d.seance}:${modele}:${type}`;
  const date = dateDite(d.seance);
  const ouverture = [
    pioche([`Séance du ${date} à la BRVM.`, `BRVM, séance du ${date}.`,
      `Voici la séance du ${date} à la BRVM.`], k('ouverture')),
    angle ? angle.accroche : 'L’essentiel en moins d’une minute.',
  ].join(' ');

  const PHRASES = {
    indice: () => phraseIndice(d, faits, k('indice')),
    largeur: () => phraseLargeur(d, k('largeur')),
    capitaux: () => phraseCapitaux(d, k('capitaux')),
    lourde: () => phraseLourde(d, k('lourde')),
    palmares: () => phrasePalmares(d, k('palmares')),
    secteurs: () => phraseSecteurs(d),
  };

  const temps = [{ type: 'ouverture', texte: ouverture }];
  for (const type of ordre) {
    const texte = PHRASES[type]();
    if (texte) temps.push({ type, texte });
  }
  temps.push({
    type: 'fin',
    texte: pioche([
      'Le détail de chaque valeur est sur westbourse point com.',
      'Retrouvez l’analyse complète de la séance sur westbourse point com.',
      'Toutes les données de la séance sont sur westbourse point com.',
    ], k('fin')),
  });

  return {
    modele,
    angle: angle?.id ?? null,
    accroche: angle?.accroche ?? null,
    faits,
    temps,
    texte: temps.map((t) => t.texte).join(' '),
  };
}

/* ── Garde-fou : aucun chiffre étranger ───────────────────────────────── */

/** Toutes les formes parlées qu'un nombre de la séance peut prendre — bâties
 *  depuis la DONNÉE, sans regarder les phrases. */
export function chiffresAutorises(d, faits) {
  const ok = new Set();
  const ajoute = (x) => {
    if (x == null || !Number.isFinite(x)) return;
    for (const dec of [0, 1, 2]) ok.add(dit(x, dec));
  };
  const c = d.composite;
  if (c) { ajoute(c.variation_pct); ajoute(c.valeur); }
  [d.hausses, d.baisses, d.stables, d.valeurs].forEach(ajoute);
  ajoute(d.capitaux / 1e9); ajoute(d.capitaux / 1e6); ajoute(d.partB);
  if (d.lourde) { ajoute(d.lourde.part_pct); ajoute(d.lourde.variation_pct); }
  for (const a of [...(d.meilleures ?? []), ...(d.pires ?? [])]) ajoute(a.variation_pct);
  for (const s of d.secteurs ?? []) { ajoute(s.part_pct); ajoute(s.valeurs); ajoute(s.hausses); }
  if (faits) { ajoute(faits.fenetre); ajoute(faits.evolution_pct); }
  ajoute(new Date(`${d.seance}T12:00:00Z`).getUTCDate());
  return ok;
}

/** Les nombres prononcés qui ne viennent pas de la donnée (vide = sain). */
export function chiffresEtrangers(texte, autorises) {
  return (texte.match(/\d+(?: virgule \d+)?/g) ?? []).filter((n) => !autorises.has(n));
}
