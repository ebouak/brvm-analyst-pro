/**
 * Brief de clôture WESTBOURSE — le gabarit de l'envoi quotidien.
 *
 * ── CE QUE CE FICHIER EST, ET CE QU'IL N'EST PAS ──
 * C'est un EMAIL, pas une page React. Pas de composants, pas de flexbox
 * fiable, pas de police web garantie : des tableaux, du style en ligne, et
 * une largeur de 600 px. Les blocs d'une maquette web sont atteignables ; sa
 * mécanique ne l'est pas. Le contraste éditorial vient donc de Georgia (serif,
 * présente partout) contre la pile sans-serif du système — pas d'une fonte
 * chargée, qu'un client de messagerie sur deux ignorerait.
 *
 * ── LA RÈGLE QUI GOUVERNE CHAQUE BLOC ──
 * Tout vient de `seance.json`, c'est-à-dire de la MÊME lecture que les images
 * et la voix de la vidéo. Rien n'est recalculé, rien n'est complété par une
 * seconde requête : une seconde source serait une seconde chance de se
 * contredire — la régression qui a fait annoncer 31 hausses à la voix quand
 * l'écran en montrait 18.
 *
 * Trois interdits, et ils ont chacun coûté quelque chose :
 *
 *  1. AUCUNE CAUSALITÉ. Une maquette proposait « La BRVM termine en hausse,
 *     PORTÉE PAR LES VALEURS BANCAIRES ». Rien dans nos données ne permet
 *     d'affirmer qu'un secteur a causé un mouvement d'indice. Ce qu'on peut
 *     dire, et qu'on dit : « Services financiers — 16 valeurs, 14 en hausse,
 *     47,9 % des capitaux ». Une mesure, pas une explication.
 *
 *  2. AUCUN BLOC INVENTÉ. Sans actualité en base, la section « Information
 *     phare » ne fabrique pas d'article : elle bascule sur « À retenir
 *     aujourd'hui », nourri des seuls chiffres de la séance. Sans historique
 *     d'indice, pas de courbe. Sans transactions publiées, pas de compteur.
 *     Une donnée absente reste absente — le bloc disparaît.
 *
 *  3. AUCUN TRACEUR. Pas de pixel d'ouverture, pas d'URL de redirection qui
 *     compte les clics. Le site promet « aucun traceur » ; un email qui
 *     rapporte qui l'a ouvert contredirait cette promesse au premier envoi.
 *     Le taux d'ouverture est perdu, et c'est assumé.
 *
 * ── POURQUOI PAS DE GRAPHE INTRADAY ──
 * `brvm_intraday_snapshots` ne contient que des ACTIONS (47 codes le
 * 24/09/2026, aucun indice). Une courbe « 09h → 16h » du Composite serait donc
 * inventée de bout en bout. On trace les 20 dernières SÉANCES, qui existent —
 * en cellules de tableau, parce que le SVG est retiré par plusieurs clients de
 * messagerie.
 */

/* ───────────────────────── Direction artistique ───────────────────────── */

const C = {
  nuit: '#071B33',
  nuitClair: '#0E2A4A',
  turquoise: '#00AFC1',
  creme: '#F7F5F0',
  blanc: '#FFFFFF',
  or: '#C9A45C',
  texte: '#1A2433',
  second: '#667085',
  faible: '#98A2B3',
  trait: '#E4E7EC',
  hausse: '#0F7B5F',
  baisse: '#B4392C',
  hausseFond: '#D9F0E7',
  baisseFond: '#FADFDB',
};

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const SITE = 'https://www.westbourse.com';

/* ───────────────────────── Mise en forme ───────────────────────── */

const fr = (x, d = 2) =>
  Number(x).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const sg = (x, d = 2) => `${x >= 0 ? '+' : '−'}${fr(Math.abs(x), d)}`;
const ent = (x) => Number(x).toLocaleString('fr-FR');
const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Montant lisible : « 3,30 Md FCFA » plutôt que 3 296 412 885. */
const fcfa = (v) => {
  const a = Math.abs(Number(v) || 0);
  if (a >= 1e9) return `${fr(v / 1e9)} Md FCFA`;
  if (a >= 1e6) return `${fr(v / 1e6, 1)} M FCFA`;
  return `${ent(Math.round(v))} FCFA`;
};

/* ───────────────────────── L'objet ───────────────────────── */

export function sujet(m) {
  return m.composite
    ? `BRVM Composite ${sg(m.composite.variation_pct)} % — séance du ${m.date_fr}`
    : `BRVM — séance du ${m.date_fr}`;
}

/* ───────────────────────── Les faits, sans prose ─────────────────────────
   Chaque entrée porte SON chiffre. « À retenir » n'est pas un commentaire :
   c'est la séance réduite à ce qu'on peut affirmer. */

function faits(m) {
  const f = [];
  if (m.composite) {
    f.push(`Le BRVM Composite termine à ${fr(m.composite.valeur)} points, ${sg(m.composite.variation_pct)} % sur la séance.`);
  }
  f.push(`${m.hausses} valeurs progressent contre ${m.baisses} en baisse et ${m.stables} inchangées, sur ${m.valeurs} cotées.`);
  f.push(`${m.capitaux_estimes ? 'Environ ' : ''}${fcfa(m.capitaux_fcfa)} ont changé de mains.`);
  if (m.ligne_lourde && typeof m.ligne_lourde.part_pct === 'number') {
    f.push(`${m.ligne_lourde.code} concentre à elle seule ${fr(m.ligne_lourde.part_pct, 1)} % des capitaux traités.`);
  }
  return f;
}

/**
 * La lecture de la séance. Elle DÉCRIT, elle n'explique pas : la seule
 * affirmation sectorielle autorisée est une mesure (combien de valeurs,
 * combien en hausse, quelle part des capitaux).
 */
function lecture(m) {
  const p = [];
  const sens = m.composite
    ? m.composite.variation_pct >= 0 ? 'en hausse' : 'en baisse'
    : m.hausses >= m.baisses ? 'majoritairement en hausse' : 'majoritairement en baisse';
  p.push(
    m.composite
      ? `Le marché termine ${sens} de ${fr(Math.abs(m.composite.variation_pct))} %, avec ${m.hausses} valeurs en progression sur ${m.valeurs} cotées.`
      : `Le marché termine ${sens}, avec ${m.hausses} valeurs en progression sur ${m.valeurs} cotées.`,
  );

  const s0 = (m.secteurs ?? [])[0];
  if (s0 && s0.secteur !== 'Non classé' && s0.part_pct >= 20) {
    p.push(
      `Le secteur « ${s0.secteur} » pèse ${fr(s0.part_pct, 1)} % des capitaux échangés : ${s0.hausses} de ses ${s0.valeurs} valeurs terminent en hausse.`,
    );
  }
  p.push(
    `L'activité représente ${fcfa(m.capitaux_fcfa)}${m.transactions ? `, pour ${ent(m.transactions)} transactions` : ''}.`,
  );
  p.push("Ces constats décrivent la séance. Ils n'en expliquent pas les causes.");
  return p;
}

/* ───────────────────────── Version texte ─────────────────────────
   Ce n'est pas un repli négligeable : une part des lecteurs ne verra que
   celle-ci, et plusieurs filtres anti-spam la comparent au HTML. */

export function texte(m) {
  const l = [sujet(m), '', 'À RETENIR', ''];
  faits(m).forEach((f, i) => l.push(`${String(i + 1).padStart(2, '0')}. ${f}`));

  const h = m.meilleures5 ?? m.meilleures ?? [];
  const b = m.pires5 ?? m.pires ?? [];
  if (h.length) {
    l.push('', 'PLUS FORTES HAUSSES', '');
    h.forEach((v) => l.push(`  ${v.code} ${v.cours ? `· ${ent(v.cours)} FCFA ` : ''}· ${sg(v.variation_pct)} %`));
  }
  if (b.length) {
    l.push('', 'PLUS FORTES BAISSES', '');
    b.forEach((v) => l.push(`  ${v.code} ${v.cours ? `· ${ent(v.cours)} FCFA ` : ''}· ${sg(v.variation_pct)} %`));
  }

  l.push('', 'LECTURE DE LA SÉANCE', '', ...lecture(m).map((x) => x));

  const phare = m.actualites?.phare;
  if (phare) {
    l.push('', 'INFORMATION DU JOUR', '', phare.titre);
    if (phare.resume) l.push(String(phare.resume).slice(0, 320));
    if (phare.source_url) l.push(phare.source_url);
  }

  l.push(
    '',
    `Vidéo de la séance : ${SITE}/#seance-${m.seance}`,
    `Analyse complète : ${SITE}`,
    '',
    'Chiffres issus de la séance officielle de la BRVM.',
  );
  if (m.capitaux_estimes) l.push("Capitaux estimés par cours × titres : la valeur officielle n'est pas publiée.");
  l.push('Information de marché. Ce brief ne constitue pas un conseil en investissement.');
  return l.join('\n');
}

/* ───────────────────────── Briques HTML ───────────────────────── */

const section = (titre, corps, { fond = C.blanc, or = false } = {}) => `
<tr><td style="padding:0 0 1px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${fond}">
    <tr><td style="padding:26px 28px 0">
      <p style="margin:0 0 16px;font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${or ? C.or : C.turquoise}">${esc(titre)}</p>
    </td></tr>
    <tr><td style="padding:0 28px 26px">${corps}</td></tr>
  </table>
</td></tr>`;

/** Une ligne de palmarès : code, nom, cours, variation, et une barre d'amplitude. */
function ligneMouvement(v, max, hausse) {
  const largeur = max > 0 ? Math.max(8, Math.round((Math.abs(v.variation_pct) / max) * 100)) : 0;
  const teinte = hausse ? C.hausse : C.baisse;
  const fond = hausse ? C.hausseFond : C.baisseFond;
  return `
  <tr>
    <td style="padding:9px 0;border-bottom:1px solid ${C.trait};font-family:${SANS};font-size:13px;color:${C.texte};font-weight:600">${esc(v.code)}<span style="display:block;font-weight:400;font-size:11px;color:${C.faible};padding-top:2px">${esc((v.designation ?? '').slice(0, 26))}</span></td>
    <td style="padding:9px 0;border-bottom:1px solid ${C.trait};font-family:${SANS};font-size:12.5px;color:${C.second};text-align:right;white-space:nowrap">${v.cours != null ? ent(v.cours) : '—'}</td>
    <td style="padding:9px 0 9px 12px;border-bottom:1px solid ${C.trait};font-family:${SANS};font-size:13px;font-weight:600;color:${teinte};text-align:right;white-space:nowrap">${esc(sg(v.variation_pct))} %</td>
    <td style="padding:9px 0 9px 10px;border-bottom:1px solid ${C.trait};width:62px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:62px"><tr>
        <td style="height:5px;width:${largeur}%;background:${teinte};font-size:0;line-height:0">&nbsp;</td>
        <td style="height:5px;background:${fond};font-size:0;line-height:0">&nbsp;</td>
      </tr></table>
    </td>
  </tr>`;
}

/** Courbe de l'indice en cellules de tableau — le SVG est retiré par plusieurs clients. */
function courbeIndice(m) {
  const h = m.historique_indice ?? [];
  if (h.length < 5) return '';
  const vals = h.map((p) => p.valeur);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const amp = max - min || 1;
  const barres = h
    .map((p) => {
      const haut = 6 + Math.round(((p.valeur - min) / amp) * 40);
      return `<td valign="bottom" style="padding:0 1px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%"><tr><td style="height:${haut}px;background:${C.turquoise};font-size:0;line-height:0">&nbsp;</td></tr></table></td>`;
    })
    .join('');
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr style="height:48px">${barres}</tr>
    <tr><td colspan="${h.length}" style="padding-top:7px;font-family:${SANS};font-size:10.5px;color:${C.faible}">
      ${h.length} dernières séances · de ${esc(fr(min))} à ${esc(fr(max))} points
    </td></tr>
  </table>`;
}

/* ───────────────────────── Le corps HTML ───────────────────────── */

export function html(m) {
  const hausses = m.meilleures5 ?? m.meilleures ?? [];
  const baisses = m.pires5 ?? m.pires ?? [];
  const maxH = Math.max(...hausses.map((v) => Math.abs(v.variation_pct)), 0);
  const maxB = Math.max(...baisses.map((v) => Math.abs(v.variation_pct)), 0);
  const phare = m.actualites?.phare ?? null;
  const autres = m.actualites?.autres ?? [];
  const vert = !m.composite || m.composite.variation_pct >= 0;
  const teinteHero = vert ? C.turquoise : '#FF8A7A';

  /* ── KPI ── */
  const kpis = [
    m.composite ? ['Clôture', `${fr(m.composite.valeur)} pts`] : null,
    ['Hausses', String(m.hausses)],
    ['Baisses', String(m.baisses)],
    ['Stables', String(m.stables)],
    ['Capitaux', fcfa(m.capitaux_fcfa)],
    ['Valeurs traitées', String(m.valeurs)],
  ].filter(Boolean);

  const celluleKpi = ([k, v]) => `
    <td width="33%" style="padding:13px 10px;border-right:1px solid ${C.trait};border-bottom:1px solid ${C.trait}">
      <p style="margin:0;font-family:${SANS};font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:${C.faible}">${esc(k)}</p>
      <p style="margin:4px 0 0;font-family:${SANS};font-size:16px;font-weight:600;color:${C.texte}">${esc(v)}</p>
    </td>`;
  const lignesKpi = [];
  for (let i = 0; i < kpis.length; i += 3) {
    lignesKpi.push(`<tr>${kpis.slice(i, i + 3).map(celluleKpi).join('')}</tr>`);
  }

  /* ── Information phare : article réel, ou repli factuel ── */
  const blocPhare = phare
    ? section(
        'Information du jour',
        `
      ${phare.secteur ? `<p style="margin:0 0 9px"><span style="display:inline-block;padding:3px 9px;background:${C.creme};border:1px solid ${C.trait};font-family:${SANS};font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:${C.second}">${esc(phare.secteur)}</span></p>` : ''}
      <p style="margin:0 0 9px;font-family:${SERIF};font-size:19px;line-height:1.35;font-weight:700;color:${C.nuit}">${esc(phare.titre)}</p>
      ${phare.resume ? `<p style="margin:0 0 14px;font-family:${SANS};font-size:13.5px;line-height:1.65;color:${C.second}">${esc(String(phare.resume).slice(0, 300))}</p>` : ''}
      ${phare.source_url ? `<p style="margin:0"><a href="${esc(phare.source_url)}" style="font-family:${SANS};font-size:13px;font-weight:600;color:${C.nuit};text-decoration:none;border-bottom:2px solid ${C.turquoise};padding-bottom:1px">Lire l'article →</a></p>` : ''}`,
      )
    : /* AUCUN ARTICLE FABRIQUÉ. Sans actualité en base, on ne raconte pas
         d'histoire : on donne les faits de la séance, et on le dit. */
      section(
        'À retenir aujourd’hui',
        `<p style="margin:0 0 12px;font-family:${SANS};font-size:12.5px;line-height:1.6;color:${C.faible}">Aucune actualité éditoriale n’est disponible pour cette séance. Voici ce que disent les chiffres.</p>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
         ${faits(m)
           .map(
             (f, i) => `<tr>
             <td width="34" valign="top" style="padding:7px 0;font-family:${SERIF};font-size:15px;font-weight:700;color:${C.or}">${String(i + 1).padStart(2, '0')}</td>
             <td style="padding:7px 0;font-family:${SANS};font-size:13.5px;line-height:1.6;color:${C.texte}">${esc(f)}</td></tr>`,
           )
           .join('')}
       </table>`,
      );

  /* ── À retenir (quand la phare est un article, les faits gardent leur place) ── */
  const blocRetenir = phare
    ? section(
        'À retenir',
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${faits(m)
          .map(
            (f, i) => `<tr>
            <td width="34" valign="top" style="padding:7px 0;font-family:${SERIF};font-size:15px;font-weight:700;color:${C.or}">${String(i + 1).padStart(2, '0')}</td>
            <td style="padding:7px 0;font-family:${SANS};font-size:13.5px;line-height:1.6;color:${C.texte}">${esc(f)}</td></tr>`,
          )
          .join('')}
      </table>`,
        { fond: C.creme },
      )
    : '';

  /* ── Palmarès ── */
  const tableauMouvements = (liste, max, hausse) =>
    liste.length
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${liste
          .map((v) => ligneMouvement(v, max, hausse))
          .join('')}</table>`
      : `<p style="margin:0;font-family:${SANS};font-size:12.5px;color:${C.faible}">Aucune valeur dans ce sens sur la séance.</p>`;

  /* ── Activité : uniquement ce qui existe ── */
  const activite = [
    ['Capitaux échangés', fcfa(m.capitaux_fcfa)],
    ['Valeurs traitées', String(m.valeurs)],
    m.transactions != null ? ['Transactions', ent(m.transactions)] : null,
    m.ligne_lourde ? ['Valeur la plus échangée', `${m.ligne_lourde.code} · ${fr(m.ligne_lourde.part_pct, 1)} %`] : null,
  ].filter(Boolean);

  /* ── Secteurs : une MESURE, jamais une explication ── */
  const secteurs = (m.secteurs ?? []).filter((s) => s.part_pct >= 1).slice(0, 4);
  const blocSecteurs = secteurs.length
    ? section(
        'Où se sont traités les capitaux',
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${secteurs
          .map(
            (s) => `<tr>
          <td style="padding:8px 0;border-bottom:1px solid ${C.trait};font-family:${SANS};font-size:13px;color:${C.texte}">${esc(s.secteur)}<span style="display:block;font-size:11px;color:${C.faible};padding-top:2px">${s.hausses} de ${s.valeurs} valeurs en hausse</span></td>
          <td style="padding:8px 0;border-bottom:1px solid ${C.trait};font-family:${SANS};font-size:14px;font-weight:600;color:${C.nuit};text-align:right;white-space:nowrap">${esc(fr(s.part_pct, 1))} %</td>
        </tr>`,
          )
          .join('')}
      </table>
      <p style="margin:12px 0 0;font-family:${SANS};font-size:11.5px;line-height:1.6;color:${C.faible}">Part de chaque secteur dans les capitaux échangés. Cette répartition décrit où l’argent s’est traité ; elle n’explique pas le mouvement de l’indice.</p>`,
      )
    : '';

  /* ── Autres actualités : masquées si la base n'en a pas ── */
  const blocAutres = autres.length
    ? section(
        'Autres actualités',
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${autres
          .map(
            (n) => `<tr><td style="padding:11px 0;border-bottom:1px solid ${C.trait}">
            ${n.secteur ? `<p style="margin:0 0 4px;font-family:${SANS};font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:${C.faible}">${esc(n.secteur)}</p>` : ''}
            <p style="margin:0;font-family:${SANS};font-size:13.5px;line-height:1.5;color:${C.texte}">${n.source_url ? `<a href="${esc(n.source_url)}" style="color:${C.texte};text-decoration:none">${esc(n.titre)}</a>` : esc(n.titre)}</p>
          </td></tr>`,
          )
          .join('')}
      </table>`,
        { fond: C.creme },
      )
    : '';

  return `
<div style="margin:0;padding:0;background:${C.creme}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(faits(m)[0] ?? '')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.creme};padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:${C.blanc};border:1px solid ${C.trait}">

  <!-- ══ En-tête ══ -->
  <tr><td style="padding:22px 28px 18px;border-bottom:3px solid ${C.nuit}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="font-family:${SERIF};font-size:21px;font-weight:700;letter-spacing:.04em;color:${C.nuit}">WESTBOURSE</td>
      <td style="text-align:right;font-family:${SANS};font-size:9.5px;line-height:1.5;letter-spacing:.12em;text-transform:uppercase;color:${C.faible}">La référence<br>sur les marchés africains</td>
    </tr></table>
  </td></tr>

  <!-- ══ Hero ══ -->
  <tr><td style="padding:26px 28px 24px;background:${C.nuit}">
    <p style="margin:0 0 4px;font-family:${SANS};font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${C.or}">Brief de clôture</p>
    <p style="margin:0 0 18px;font-family:${SERIF};font-size:26px;line-height:1.25;font-weight:700;color:${C.blanc}">Séance du ${esc(m.date_fr)}</p>
    ${
      m.composite
        ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td valign="bottom" style="padding-right:16px;font-family:${SANS};font-size:40px;line-height:1;font-weight:700;color:${teinteHero}">${esc(sg(m.composite.variation_pct))} %</td>
        <td valign="bottom" style="padding-bottom:4px;font-family:${SANS};font-size:13px;line-height:1.5;color:#9FB3C8">BRVM Composite<br><span style="color:${C.blanc};font-weight:600">${esc(fr(m.composite.valeur))} points</span></td>
      </tr></table>
      <p style="margin:16px 0 0;font-family:${SANS};font-size:13.5px;line-height:1.6;color:#B9C7D6">Le BRVM Composite termine la séance ${m.composite.variation_pct >= 0 ? 'en hausse' : 'en baisse'} de ${esc(fr(Math.abs(m.composite.variation_pct)))} %, à ${esc(fr(m.composite.valeur))} points.</p>`
        : `<p style="margin:0;font-family:${SANS};font-size:13.5px;line-height:1.6;color:#B9C7D6">L’indice BRVM Composite n’est pas disponible pour cette séance. Les chiffres ci-dessous portent sur les valeurs cotées.</p>`
    }
  </td></tr>

  <!-- ══ KPI ══ -->
  <tr><td style="padding:0 28px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${C.trait}">${lignesKpi.join('')}</table>
  </td></tr>

  ${blocPhare}
  ${blocRetenir}

  <!-- ══ Palmarès ══ -->
  ${section(
    'Les plus fortes hausses',
    tableauMouvements(hausses, maxH, true),
  )}
  ${section('Les plus fortes baisses', tableauMouvements(baisses, maxB, false), { fond: C.creme })}

  <!-- ══ Activité ══ -->
  ${section(
    'Activité du marché',
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${activite
        .map(
          ([k, v]) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid ${C.trait};font-family:${SANS};font-size:13px;color:${C.second}">${esc(k)}</td>
        <td style="padding:8px 0;border-bottom:1px solid ${C.trait};font-family:${SANS};font-size:14px;font-weight:600;color:${C.texte};text-align:right;white-space:nowrap">${esc(v)}</td>
      </tr>`,
        )
        .join('')}
    </table>
    ${courbeIndice(m)}`,
  )}

  ${blocSecteurs}

  <!-- ══ Lecture ══ -->
  ${section(
    'Lecture de la séance',
    lecture(m)
      .map(
        (p, i) =>
          `<p style="margin:0 0 ${i === lecture(m).length - 1 ? '0' : '9px'};font-family:${SANS};font-size:13.5px;line-height:1.7;color:${i === lecture(m).length - 1 ? C.faible : C.texte}">${esc(p)}</p>`,
      )
      .join(''),
    { fond: C.creme, or: true },
  )}

  ${blocAutres}

  <!-- ══ Vidéo ══ -->
  <tr><td style="padding:26px 28px;text-align:center;border-top:1px solid ${C.trait}">
    <a href="${SITE}/#seance-${esc(m.seance)}" style="display:inline-block;padding:13px 28px;background:${C.nuit};color:${C.blanc};font-family:${SANS};font-size:14px;font-weight:600;text-decoration:none">Voir la vidéo de la séance →</a>
    <p style="margin:11px 0 0;font-family:${SANS};font-size:12px;color:${C.faible}">Une trentaine de secondes, les mêmes chiffres, commentés.</p>
  </td></tr>

  <!-- ══ Pied ══ -->
  <tr><td style="padding:22px 28px;background:${C.nuit}">
    <p style="margin:0 0 3px;font-family:${SERIF};font-size:15px;font-weight:700;letter-spacing:.04em;color:${C.blanc}">WESTBOURSE</p>
    <p style="margin:0 0 14px;font-family:${SANS};font-size:12px;color:#8FA3B8">L’actualité et l’analyse des marchés africains</p>
    <p style="margin:0 0 14px;font-family:${SANS};font-size:12px">
      <a href="${SITE}/societes" style="color:${C.turquoise};text-decoration:none">Sociétés</a>
      <span style="color:#3E5875"> · </span><a href="${SITE}/actualites" style="color:${C.turquoise};text-decoration:none">Actualités</a>
      <span style="color:#3E5875"> · </span><a href="${SITE}/analyses/hebdo" style="color:${C.turquoise};text-decoration:none">Analyses</a>
      <span style="color:#3E5875"> · </span><a href="${SITE}/parametres/alertes" style="color:${C.turquoise};text-decoration:none">Mes préférences</a>
    </p>
    <p style="margin:0 0 4px;font-family:${SANS};font-size:11px;line-height:1.6;color:#6F869E">Chiffres issus de la séance officielle de la BRVM.${m.capitaux_estimes ? ' Capitaux estimés par cours × titres : la valeur officielle n’est pas publiée.' : ''}</p>
    <p style="margin:0;font-family:${SANS};font-size:11px;line-height:1.6;color:#6F869E">Information de marché. <strong style="color:#8FA3B8">Ceci n’est pas un conseil en investissement.</strong></p>
  </td></tr>

</table>
</td></tr>
</table>
</div>`;
}
