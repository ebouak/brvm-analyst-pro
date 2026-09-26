/**
 * Brief de clôture WESTBOURSE — le gabarit de l'envoi quotidien.
 *
 * ── CE QUE CE FICHIER EST, ET CE QU'IL N'EST PAS ──
 * C'est un EMAIL, pas une page React. Pas de composants, pas de flexbox
 * fiable, pas de police web garantie : des tableaux, du style en ligne, et
 * une largeur de 620 px. Les blocs d'une maquette web sont atteignables ; sa
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

/* ═══════════════════════════════════════════════════════════════════════
   L'OSSATURE, et ce qu'elle impose
   ═══════════════════════════════════════════════════════════════════════

   Structure retenue, d'après la maquette validée :

     en-tête clair  →  hero éditorial  →  BANDEAU KPI SOMBRE (la signature)
     →  phare | autres actus  →  hausses | baisses  →  indice | chiffres clés
     →  secteurs  →  lecture  →  barre de pied sombre avec le bouton vidéo

   DEUX COLONNES EN EMAIL. Ni flex ni grid : des `div` en `inline-block` à
   largeur maximale, dans une cellule à `font-size:0` pour tuer l'espace
   inter-blocs. Sous 620 px les colonnes s'empilent d'elles-mêmes, sans
   requête média — donc aussi dans les clients qui les ignorent. Outlook de
   bureau ignore `inline-block` et empile toujours : c'est la dégradation
   choisie, pas un oubli.

   TROIS ÉLÉMENTS DE LA MAQUETTE ABSENTS, ET POURQUOI :

     · La PHOTO du hero (skyline). Aucune image de bandeau dans le dépôt, et
       un hero qui dépend d'une image est un hero souvent vide : les clients
       de messagerie bloquent les images par défaut. Le hero tient sur sa
       typographie.
     · Les VIGNETTES des actualités. `brvm_news.image_url` est vide sur la
       totalité des articles récents (0 sur 6 au 25/09/2026). Mettre une image
       générique à la place reviendrait à illustrer un article avec une photo
       qui ne le concerne pas.
     · La COURBE INTRADAY « 09h → 16h ». `brvm_intraday_snapshots` ne contient
       que des actions, aucun indice : cette courbe serait inventée de bout en
       bout. Elle est remplacée par les 20 dernières séances, réelles.

   Les pastilles rondes dorées du bandeau KPI sont conservées comme ANNEAUX,
   sans glyphe : une icône de messagerie ne se dessine ni en SVG (retiré par
   plusieurs clients) ni en émoji (le projet s'en interdit l'usage décoratif).
   L'anneau porte le rythme visuel sans prétendre illustrer quoi que ce soit.
   ═══════════════════════════════════════════════════════════════════════ */

/** Colonne d'une rangée à deux blocs. `part` vaut 'large' (≈2/3) ou 'egal'. */
const colonne = (contenu, part = 'egal') => {
  const max = part === 'large' ? 356 : part === 'etroit' ? 212 : 284;
  return `<div style="display:inline-block;vertical-align:top;width:100%;max-width:${max}px;font-size:14px">${contenu}</div>`;
};

/** Une rangée : une cellule à font-size 0, des colonnes qui s'empilent seules. */
const rangee = (colonnes, { fond = C.creme, gap = 12 } = {}) => `
<tr><td style="padding:${gap}px ${gap}px 0;background:${fond};font-size:0;line-height:0">
  ${colonnes.join(`<div style="display:inline-block;width:${gap}px;font-size:0">&nbsp;</div>`)}
</td></tr>`;

/** Carte blanche à titre — la brique de toutes les rangées. */
const carte = (titre, corps, { pad = '18px 20px' } = {}) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.blanc};border:1px solid ${C.trait}">
  ${titre ? `<tr><td style="padding:16px 20px 0"><p style="margin:0;font-family:${SERIF};font-size:17px;font-weight:700;color:${C.nuit}">${esc(titre)}</p></td></tr>` : ''}
  <tr><td style="padding:${pad}">${corps}</td></tr>
</table>`;

/** L'anneau doré du bandeau KPI. Aucun glyphe : voir l'en-tête. */
const anneau = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:9px"><tr><td style="width:30px;height:30px;border:1px solid ${C.or};border-radius:15px;background:rgba(201,164,92,.16);font-size:0;line-height:30px">&nbsp;</td></tr></table>`;

/** Une colonne du bandeau KPI sombre. */
const kpiSombre = (label, valeur, { premier = false } = {}) => `
<td valign="top" style="padding:0 14px;${premier ? '' : `border-left:1px solid #1D3A5C;`}">
  ${anneau}
  <p style="margin:0;font-family:${SANS};font-size:9.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#8AA3BF;line-height:1.45">${esc(label)}</p>
  <p style="margin:5px 0 0;font-family:${SERIF};font-size:17px;font-weight:700;color:${C.blanc};line-height:1.25">${esc(valeur)}</p>
</td>`;

/** Une ligne de palmarès : valeur, cours, variation, barre d'amplitude. */
function ligneMouvement(v, max, hausse) {
  const largeur = max > 0 ? Math.max(10, Math.round((Math.abs(v.variation_pct) / max) * 100)) : 0;
  const teinte = hausse ? C.hausse : C.baisse;
  const fond = hausse ? C.hausseFond : C.baisseFond;
  return `
  <tr>
    <td style="padding:8px 0;border-top:1px solid ${C.trait};font-family:${SANS};font-size:12.5px;font-weight:600;color:${C.texte}">${esc(v.code)}</td>
    <td style="padding:8px 0;border-top:1px solid ${C.trait};font-family:${SANS};font-size:12px;color:${C.second};text-align:right;white-space:nowrap">${v.cours != null ? ent(v.cours) : '—'}</td>
    <td style="padding:8px 0 8px 10px;border-top:1px solid ${C.trait};font-family:${SANS};font-size:12.5px;font-weight:600;color:${teinte};text-align:right;white-space:nowrap">${esc(sg(v.variation_pct))} %</td>
    <td style="padding:8px 0 8px 8px;border-top:1px solid ${C.trait};width:48px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:48px"><tr>
        <td style="height:6px;width:${largeur}%;background:${teinte};font-size:0;line-height:0">&nbsp;</td>
        <td style="height:6px;background:${fond};font-size:0;line-height:0">&nbsp;</td>
      </tr></table>
    </td>
  </tr>`;
}

/** Tableau d'un palmarès, en-têtes compris. */
const tableauMouvements = (liste, max, hausse) =>
  liste.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding-bottom:6px;font-family:${SANS};font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:${C.faible}">Valeur</td>
        <td style="padding-bottom:6px;font-family:${SANS};font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:${C.faible};text-align:right">Cours</td>
        <td colspan="2" style="padding-bottom:6px;font-family:${SANS};font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:${C.faible};text-align:right">Variation</td>
      </tr>
      ${liste.map((v) => ligneMouvement(v, max, hausse)).join('')}
    </table>`
    : `<p style="margin:0;font-family:${SANS};font-size:12.5px;color:${C.faible}">Aucune valeur dans ce sens sur la séance.</p>`;

/** Courbe de l'indice en cellules — le SVG est retiré par plusieurs clients. */
function courbeIndice(m) {
  const h = m.historique_indice ?? [];
  if (h.length < 5) {
    return `<p style="margin:0;font-family:${SANS};font-size:12.5px;line-height:1.6;color:${C.faible}">Historique insuffisant pour tracer une évolution.</p>`;
  }
  const vals = h.map((p) => p.valeur);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const amp = max - min || 1;
  const barres = h
    .map(
      (p, i) =>
        `<td valign="bottom" style="padding:0 1px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%"><tr><td style="height:${8 + Math.round(((p.valeur - min) / amp) * 52)}px;background:${i === h.length - 1 ? C.nuit : C.turquoise};font-size:0;line-height:0">&nbsp;</td></tr></table></td>`,
    )
    .join('');
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr style="height:60px">${barres}</tr>
  </table>
  <p style="margin:9px 0 0;font-family:${SANS};font-size:10.5px;line-height:1.55;color:${C.faible}">
    ${h.length} dernières séances, de ${esc(fr(min))} à ${esc(fr(max))} points. La BRVM ne publiant pas d’historique intraday de l’indice, aucune courbe de la journée n’est possible.
  </p>`;
}

/* ───────────────────────── Le corps HTML ───────────────────────── */

/**
 * @param m        la fiche de séance (`seance.json`)
 * @param options  `avertissement` : bandeau placé AVANT le brief, pour un envoi
 *                 qui n'a pas été demandé. Il n'existe que pour l'envoi de
 *                 découverte : un abonné qui a coché la case ne doit jamais
 *                 lire « vous recevez ceci une seule fois » — ce serait faux.
 */
export function html(m, { avertissement = null } = {}) {
  const hausses = m.meilleures5 ?? m.meilleures ?? [];
  const baisses = m.pires5 ?? m.pires ?? [];
  const maxH = Math.max(...hausses.map((v) => Math.abs(v.variation_pct)), 0);
  const maxB = Math.max(...baisses.map((v) => Math.abs(v.variation_pct)), 0);
  const phare = m.actualites?.phare ?? null;
  const autres = m.actualites?.autres ?? [];
  const vert = !m.composite || m.composite.variation_pct >= 0;

  /* ── Bandeau KPI sombre : la signature de l'ossature ── */
  const bandeau = `
  <tr><td style="padding:14px 12px 0;background:${C.creme}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.nuit}">
      <tr><td style="padding:22px 20px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td valign="top" width="188" style="padding-right:16px;border-right:1px solid #1D3A5C">
            <p style="margin:0 0 6px;font-family:${SERIF};font-size:16px;font-weight:700;color:${C.blanc}">BRVM Composite</p>
            ${
              m.composite
                ? `<p style="margin:0;font-family:${SANS};font-size:36px;line-height:1.05;font-weight:700;color:${vert ? C.turquoise : '#FF8A7A'}">${esc(sg(m.composite.variation_pct))} %</p>
                   <p style="margin:5px 0 0;font-family:${SANS};font-size:13px;color:#9FB3C8">à ${esc(fr(m.composite.valeur))} pts</p>`
                : `<p style="margin:0;font-family:${SANS};font-size:13px;line-height:1.6;color:#9FB3C8">Indice non disponible pour cette séance.</p>`
            }
          </td>
          <td valign="top">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              ${m.composite ? kpiSombre('Clôture', `${fr(m.composite.valeur)} pts`, { premier: true }) : ''}
              ${kpiSombre('Hausse / baisse / stable', `${m.hausses} / ${m.baisses} / ${m.stables}`, { premier: !m.composite })}
              ${kpiSombre('Capitaux échangés', fcfa(m.capitaux_fcfa))}
              ${m.ligne_lourde ? kpiSombre('Premier échangé', `${m.ligne_lourde.code} · ${fr(m.ligne_lourde.part_pct, 1)} %`) : ''}
            </tr></table>
          </td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>`;

  /* ── Information phare : article RÉEL, ou repli factuel ── */
  const corpsPhare = phare
    ? `${phare.secteur ? `<p style="margin:0 0 8px"><span style="display:inline-block;padding:3px 9px;background:${C.creme};border:1px solid ${C.trait};font-family:${SANS};font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:${C.second}">${esc(phare.secteur)}</span></p>` : ''}
       <p style="margin:0 0 9px;font-family:${SERIF};font-size:18px;line-height:1.35;font-weight:700;color:${C.nuit}">${esc(phare.titre)}</p>
       ${phare.resume ? `<p style="margin:0 0 13px;font-family:${SANS};font-size:13px;line-height:1.65;color:${C.second}">${esc(String(phare.resume).slice(0, 260))}</p>` : ''}
       ${phare.source_url ? `<p style="margin:0"><a href="${esc(phare.source_url)}" style="font-family:${SANS};font-size:12.5px;font-weight:600;color:${C.nuit};text-decoration:none;border-bottom:2px solid ${C.turquoise};padding-bottom:1px">Lire l’analyse complète →</a></p>` : ''}`
    : /* AUCUN ARTICLE FABRIQUÉ : sans actualité, on donne les faits et on le dit. */
      `<p style="margin:0 0 11px;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.faible}">Aucune actualité éditoriale n’est disponible pour cette séance. Voici ce que disent les chiffres.</p>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
         ${faits(m)
           .map(
             (f, i) =>
               `<tr><td width="30" valign="top" style="padding:6px 0;font-family:${SERIF};font-size:14px;font-weight:700;color:${C.or}">${String(i + 1).padStart(2, '0')}</td>
                <td style="padding:6px 0;font-family:${SANS};font-size:13px;line-height:1.6;color:${C.texte}">${esc(f)}</td></tr>`,
           )
           .join('')}
       </table>`;

  const corpsAutres = autres.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${autres
        .map(
          (n, i) => `<tr><td style="padding:${i === 0 ? '0' : '10px'} 0 10px;${i === 0 ? '' : `border-top:1px solid ${C.trait};`}">
          ${n.secteur ? `<p style="margin:0 0 4px;font-family:${SANS};font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:${C.or}">${esc(n.secteur)}</p>` : ''}
          <p style="margin:0;font-family:${SANS};font-size:12.5px;line-height:1.5;color:${C.texte}">${n.source_url ? `<a href="${esc(n.source_url)}" style="color:${C.texte};text-decoration:none">${esc(n.titre)}</a>` : esc(n.titre)}</p>
        </td></tr>`,
        )
        .join('')}
    </table>`
    : `<p style="margin:0;font-family:${SANS};font-size:12.5px;line-height:1.6;color:${C.faible}">Aucune autre actualité publiée sur la période.</p>`;

  /* ── Chiffres clés : uniquement ce qui existe ── */
  const clés = [
    [fcfa(m.capitaux_fcfa), 'Capitaux échangés'],
    [String(m.valeurs), 'Valeurs traitées'],
    m.transactions != null ? [ent(m.transactions), 'Transactions'] : null,
    m.ligne_lourde ? [`${fr(m.ligne_lourde.part_pct, 1)} %`, `Poids du premier échange (${m.ligne_lourde.code})`] : null,
  ].filter(Boolean);

  const corpsClés = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    ${clés
      .map(
        ([v, k], i) => `<tr><td style="padding:${i === 0 ? '0' : '11px'} 0 11px;${i === 0 ? '' : `border-top:1px solid ${C.trait};`}">
        <p style="margin:0;font-family:${SERIF};font-size:20px;font-weight:700;color:${C.nuit};line-height:1.2">${esc(v)}</p>
        <p style="margin:3px 0 0;font-family:${SANS};font-size:11px;color:${C.faible}">${esc(k)}</p>
      </td></tr>`,
      )
      .join('')}
  </table>`;

  /* ── Secteurs : une MESURE, jamais une explication ── */
  const secteurs = (m.secteurs ?? []).filter((s) => s.part_pct >= 1).slice(0, 4);
  const blocSecteurs = secteurs.length
    ? `<tr><td style="padding:12px 12px 0;background:${C.creme}">${carte(
        'Où se sont traités les capitaux',
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${secteurs
          .map(
            (s, i) => `<tr>
          <td style="padding:7px 0;${i ? `border-top:1px solid ${C.trait};` : ''}font-family:${SANS};font-size:12.5px;color:${C.texte}">${esc(s.secteur)}<span style="color:${C.faible}"> — ${s.hausses} de ${s.valeurs} valeurs en hausse</span></td>
          <td style="padding:7px 0;${i ? `border-top:1px solid ${C.trait};` : ''}font-family:${SANS};font-size:13px;font-weight:600;color:${C.nuit};text-align:right;white-space:nowrap">${esc(fr(s.part_pct, 1))} %</td>
        </tr>`,
          )
          .join('')}
      </table>
      <p style="margin:11px 0 0;font-family:${SANS};font-size:11px;line-height:1.6;color:${C.faible}">Part de chaque secteur dans les capitaux échangés. Cette répartition décrit <em>où</em> l’argent s’est traité ; elle n’explique pas le mouvement de l’indice.</p>`,
      )}</td></tr>`
    : '';

  return `
<div style="margin:0;padding:0;background:${C.creme}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(faits(m)[0] ?? '')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.creme};padding:20px 10px">
<tr><td align="center">
<table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;width:100%;background:${C.creme}">

  ${
    avertissement
      ? `<tr><td style="padding:0 0 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFF8E8;border:1px solid ${C.or}">
      <tr><td style="padding:14px 18px">
        <p style="margin:0;font-family:${SANS};font-size:12.5px;line-height:1.65;color:#6B5424">${avertissement}</p>
      </td></tr>
    </table>
  </td></tr>`
      : ''
  }

  <!-- ══ En-tête ══ -->
  <tr><td style="padding:18px 20px;background:${C.blanc};border:1px solid ${C.trait};border-bottom:none">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="font-family:${SERIF};font-size:22px;font-weight:700;letter-spacing:.04em;color:${C.nuit}">WESTBOURSE<span style="display:block;font-family:${SANS};font-size:8.5px;font-weight:600;letter-spacing:.22em;color:${C.or};padding-top:3px">INFORMER · ANALYSER · ÉCLAIRER</span></td>
      <td style="text-align:right;font-family:${SANS};font-size:9px;line-height:1.6;letter-spacing:.12em;text-transform:uppercase;color:${C.faible};border-left:1px solid ${C.trait};padding-left:16px;width:150px">La référence<br>sur les marchés africains</td>
    </tr></table>
  </td></tr>

  <!-- ══ Hero éditorial ══ -->
  <tr><td style="padding:26px 20px 24px;background:${C.blanc};border:1px solid ${C.trait};border-top:none">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px"><tr>
      <td style="width:26px;height:2px;background:${C.or};font-size:0;line-height:0">&nbsp;</td>
      <td style="padding-left:10px;font-family:${SANS};font-size:10px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:${C.second}">Newsletter quotidienne</td>
    </tr></table>
    <p style="margin:0 0 10px;font-family:${SERIF};font-size:34px;line-height:1.12;font-weight:700;color:${C.nuit}">Séance du<br>${esc(m.date_fr)}</p>
    <p style="margin:0;font-family:${SANS};font-size:13.5px;line-height:1.65;color:${C.second}">Toute l’actualité et les chiffres clés de la BRVM en un coup d’œil.</p>
  </td></tr>

  ${bandeau}

  ${rangee([
    colonne(carte('Information phare du jour', corpsPhare), 'large'),
    colonne(carte('Autres actualités du jour', corpsAutres), 'etroit'),
  ])}

  ${rangee([
    colonne(carte('Les plus fortes hausses', tableauMouvements(hausses, maxH, true))),
    colonne(carte('Les plus fortes baisses', tableauMouvements(baisses, maxB, false))),
  ])}

  ${rangee([
    colonne(carte('Évolution de l’indice BRVM Composite', courbeIndice(m))),
    colonne(carte('Chiffres clés de la séance', corpsClés)),
  ])}

  ${blocSecteurs}

  <!-- ══ Lecture de la séance ══ -->
  <tr><td style="padding:12px 12px 14px;background:${C.creme}">${carte(
    'Lecture de la séance',
    lecture(m)
      .map(
        (p, i, t) =>
          `<p style="margin:0 0 ${i === t.length - 1 ? '0' : '8px'};font-family:${SANS};font-size:13px;line-height:1.7;color:${i === t.length - 1 ? C.faible : C.texte}">${esc(p)}</p>`,
      )
      .join(''),
  )}</td></tr>

  <!-- ══ Barre de pied ══ -->
  <tr><td style="padding:0 12px 20px;background:${C.creme}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.nuit}">
      <tr><td style="padding:20px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td valign="middle" style="font-family:${SERIF};font-size:15px;font-weight:700;letter-spacing:.04em;color:${C.blanc}">WESTBOURSE<span style="display:block;font-family:${SANS};font-size:8px;font-weight:600;letter-spacing:.16em;color:#6F869E;padding-top:3px">L’ACTUALITÉ DES MARCHÉS AFRICAINS</span></td>
          <td valign="middle" align="right">
            <a href="${SITE}/#seance-${esc(m.seance)}" style="display:inline-block;padding:11px 22px;border:1px solid ${C.turquoise};border-radius:22px;font-family:${SANS};font-size:13px;font-weight:600;color:${C.turquoise};text-decoration:none">Voir la vidéo de la séance →</a>
          </td>
        </tr></table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;border-top:1px solid #1D3A5C"><tr><td style="padding-top:13px">
          <p style="margin:0 0 7px;font-family:${SANS};font-size:11px">
            <a href="${SITE}/societes" style="color:${C.turquoise};text-decoration:none">Sociétés</a><span style="color:#3E5875"> · </span><a href="${SITE}/actualites" style="color:${C.turquoise};text-decoration:none">Actualités</a><span style="color:#3E5875"> · </span><a href="${SITE}/analyses/hebdo" style="color:${C.turquoise};text-decoration:none">Analyses</a><span style="color:#3E5875"> · </span><a href="${SITE}/parametres/alertes" style="color:${C.turquoise};text-decoration:none">Mes préférences</a>
          </p>
          <p style="margin:0;font-family:${SANS};font-size:10.5px;line-height:1.6;color:#6F869E">Chiffres issus de la séance officielle de la BRVM.${m.capitaux_estimes ? ' Capitaux estimés par cours × titres.' : ''} Information de marché — <strong style="color:#8FA3B8">ceci n’est pas un conseil en investissement</strong>.</p>
        </td></tr></table>
      </td></tr>
    </table>
  </td></tr>

</table>
</td></tr>
</table>
</div>`;
}
