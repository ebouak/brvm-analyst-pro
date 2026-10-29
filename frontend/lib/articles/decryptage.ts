/**
 * Décryptage d'une valeur, au format du skill thesis-tracker et du gabarit
 * « Décryptage » (hero, piliers avec marge de sécurité, comparables, comptes,
 * dividende, séances, risques, invalidation, journal, catalyseurs).
 *
 * PUR et sans modèle de langage. Deux sources, jamais une troisième :
 *  - le dossier valeur (lib/dossier/build.ts), déjà contrôlé ;
 *  - la couche éditoriale sourcée (decryptageEditorial.ts), dont chaque
 *    chiffre figure dans le document cité.
 * Le résultat est un objet de DONNÉES (`DecryptageDonnees`), rangé dans
 * `articles.chiffres.decryptage` et rendu par components/decryptage. Le
 * Markdown (`corps_md`) en est dérivé : diffusion, flux, repli.
 *
 * La thèse est RÉFUTABLE : chaque pilier expose son seuil et la distance qui
 * l'en sépare. Aucun objectif de cours, aucune « conviction », aucune position.
 */
import type { DossierValeur } from '@/lib/dossier/build';
import type { Narratif } from '@/lib/dossier/narratif';
import type { Pilier } from '@/lib/dossier/suivi';
import type { ComptesGroupe, EditorialValeur, RisqueEditorial, Source } from '@/lib/articles/decryptageEditorial';

export interface FaitRecent {
  slug: string;
  titre: string;
  type: string;
  date_fait: string;
}

/** Une séance, de la plus ancienne à la plus récente. */
export interface SeanceRecente {
  date_marche: string;
  cours_jour: number | null;
  variation_pct: number | null;
  volume: number | null;
  valeur_echangee: number | null;
}

export interface OperationRecente {
  date_effet: string;
  type: string;
  ratio: number;
}

export interface ExtrasDecryptage {
  seances?: SeanceRecente[];
  operations?: OperationRecente[];
  /** Historique de notation, le plus récent d'abord (notation_json.history). */
  notations?: { note?: string | null; date_notation?: string | null; perspective?: string | null }[];
  editorial?: EditorialValeur | null;
}

// ── Contrat de données du gabarit ────────────────────────────────────────────

export type Ton = 'up' | 'down' | 'warn' | null;
export type Badge = 'Tenu' | 'Non tenu' | 'Non mesurable' | 'Sans objet' | 'Favorable' | 'Neutre' | 'Défavorable';

export interface Stat {
  label: string;
  valeur: string;
  sous: string | null;
  ton: Ton;
}
export interface LignePilier {
  libelle: string;
  valeur: string;
  seuil: string;
  /** Marge de sécurité, 0 à 100. `null` quand le pilier n'est pas mesurable. */
  jauge: number | null;
  legende: string;
  tendance: string;
  statut: Badge;
}
export interface Barre {
  indicateur: string;
  valeur: number | null;
  mediane: number | null;
}
export interface LigneComparable {
  indicateur: string;
  valeur: string;
  mediane: string;
  lecture: Badge | null;
  precision: string;
}
export interface PointResultat {
  exercice: string;
  /** Milliards de FCFA. */
  ca: number | null;
  rn: number | null;
  /** Marge nette en %. */
  marge: number | null;
}
export interface PointDividende {
  exercice: string;
  montant: number;
  /** Variation annuelle en %. */
  variation: number | null;
}
export interface PointCours {
  date: string;
  cours: number;
  ton: 'neutre' | 'up' | 'down';
  /** Cours antérieur à une opération, ajusté de son ratio. */
  ajuste: boolean;
}
export interface Paragraphe {
  titre: string;
  texte: string;
}
export interface EntreeDatee {
  date: string;
  titre: string;
  texte: string;
  lien: string | null;
  indicatif: boolean;
}
export interface LigneInvalidation {
  indicateur: string;
  aujourdhui: string;
  invalidee_si: string;
  origine: 'Critère de la page' | 'Seuil indicatif';
}

export interface DecryptageDonnees {
  version: 1;
  code: string;
  nom: string;
  date_seance: string | null;
  kicker: string;
  titre: string;
  chapo: string;
  stats: Stat[];
  verdict: { ton: Ton; titre: string; texte: string }[];
  piliers: { intro: string; lignes: LignePilier[]; note: string };
  vigilance: { titre: string; texte: string; chiffre: string } | null;
  comparables: { intro: string; multiples: Barre[]; rentabilite: Barre[]; lignes: LigneComparable[]; note: string | null } | null;
  resultats: { serie: PointResultat[]; kpis: Stat[]; paragraphes: Paragraphe[] } | null;
  dividende: { serie: PointDividende[]; precisions: Paragraphe[]; lien: Source | null } | null;
  cours: { titre: string; intro: string | null; serie: PointCours[]; points: string[]; conclusion: string | null; note: string | null } | null;
  risques: RisqueEditorial[];
  invalidation: { intro: string; lignes: LigneInvalidation[] };
  journal: EntreeDatee[];
  catalyseurs: EntreeDatee[];
  methode: string;
  sources: Source[];
  avertissement: string;
}

export interface ArticleDecryptage {
  slug: string;
  fait: string;
  titre: string;
  chapo: string;
  corps_md: string;
  date_fait: string;
  chiffres: Record<string, unknown>;
  sources: Source[];
}

export const AVERTISSEMENT =
  'Information de marché, pas un conseil en investissement. Les performances passées ne préjugent pas des performances futures. Les seuils d’invalidation indicatifs sont des repères de lecture, pas des recommandations.';

// ── Format ───────────────────────────────────────────────────────────────────

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const dateLongue = (iso: string) => {
  const [a, m, j] = iso.slice(0, 10).split('-').map(Number);
  return `${j === 1 ? '1er' : j} ${MOIS[(m ?? 1) - 1]} ${a}`;
};
const jm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const nb = (x: number, d = 0) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).format(x).replace(/[  ]/g, ' ').replace(/^-/, '−');
/** `x` en fraction (0,083) → « 8,3 % ». */
const pct = (x: number, d = 1) => `${nb(x * 100, d)} %`;
const pctS = (x: number, d = 1) => `${x >= 0 ? '+' : '−'}${pct(Math.abs(x), d)}`;
const fois = (x: number, d = 1) => `${nb(x, d)}x`;
const F = (x: number, d?: number) => `${nb(x, d ?? (Math.abs(x % 1) > 1e-9 ? 1 : 0))} F`;
/** Montant en FCFA → « 413,6 Md ». */
const md = (x: number) => `${nb(x / 1e9, Math.abs(x) >= 1e10 ? 1 : 2)} Md`;
const actions = (n: number) =>
  n >= 1e9 ? `${nb(n / 1e9, n % 1e9 ? 2 : 0)} milliard${n >= 2e9 ? 's' : ''}` : `${nb(n / 1e6, n % 1e6 ? 1 : 0)} millions`;
const evolue = (x: number) => (x >= 0 ? `progresse de ${pct(x)}` : `recule de ${pct(-x)}`);
const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const borne = (x: number) => Math.max(0, Math.min(100, Math.round(x)));
const variation = (a: number | null | undefined, b: number | null | undefined) =>
  a == null || b == null || b === 0 ? null : a / b - 1;
const cellule = (s: string) => s.replace(/\|/g, '/');

const STATUT: Record<Pilier['statut'], Badge> = {
  tenu: 'Tenu',
  non_tenu: 'Non tenu',
  non_mesurable: 'Non mesurable',
  non_applicable: 'Sans objet',
};
const LECTURE: Record<string, Badge> = { favorable: 'Favorable', neutre: 'Neutre', defavorable: 'Défavorable' };

const PILIER_DU_FAIT: Record<string, string> = {
  dividende_annonce: 'dividende',
  detachement_rappel: 'dividende',
  paiement_rappel: 'dividende',
  operation_titres: 'aucun, l’opération ne change pas la valeur',
  seance_hors_norme: 'marché (cours et liquidité)',
};

/**
 * Marge de sécurité d'un pilier tenu, 0 à 100. Échelle PROPRE à chaque
 * critère, écrite dans la note sous le tableau : ce n'est pas un score.
 */
export function jaugePilier(p: Pilier, perMediane: number | null): number | null {
  if (p.statut === 'non_mesurable' || p.statut === 'non_applicable' || p.mesure == null) return null;
  if (p.statut === 'non_tenu') return 0;
  const m = p.mesure;
  switch (p.cle) {
    case 'croissance':
      return borne((m / 0.15) * 100);
    case 'marge':
      return p.precedente == null ? null : borne(((m - p.precedente + 0.01) / 0.02) * 100);
    case 'rentabilite':
      return borne(((m - 0.15) / 0.15) * 100);
    case 'endettement':
      return borne(((0.5 - m) / 0.5) * 100);
    case 'dividende': {
      const v = variation(m, p.precedente);
      return v == null ? null : borne((v / 0.1) * 100);
    }
    case 'valorisation':
      return perMediane ? borne(((perMediane - m) / perMediane) * 100) : null;
  }
}

// ── Composition ──────────────────────────────────────────────────────────────

export function composerDecryptage(
  d: DossierValeur,
  n: Narratif,
  faits: FaitRecent[],
  nom: string,
  aujourdhui: string,
  extras: ExtrasDecryptage = {},
): ArticleDecryptage {
  const donnees = construireDonnees(d, n, faits, nom, aujourdhui, extras);
  const jour = aujourdhui.slice(0, 10);
  const tenus = donnees.piliers.lignes.filter((l) => l.statut === 'Tenu').length;
  const mesurables = donnees.piliers.lignes.filter((l) => l.statut === 'Tenu' || l.statut === 'Non tenu').length;
  return {
    slug: `decryptage-${d.identite.code.toLowerCase()}-${jour}`,
    fait: `decryptage|${d.identite.code}|${jour}`,
    titre: donnees.titre,
    chapo: donnees.chapo,
    corps_md: versMarkdown(donnees),
    date_fait: d.chiffres_cles.date_cours ?? jour,
    chiffres: {
      decryptage: donnees,
      image: { chiffre: mesurables ? `${tenus}/${mesurables}` : '—', legende: 'piliers de thèse tenus' },
      serie: d.technique.serie.filter((s) => s.cours != null).map((s) => [s.date, s.cours]),
      piliers: d.suivi.piliers.map((p) => ({ cle: p.cle, statut: p.statut })),
      liens: faits.slice(0, 3).map((f) => ({ slug: f.slug, titre: f.titre })),
    },
    sources: donnees.sources,
  };
}

export function construireDonnees(
  d: DossierValeur,
  n: Narratif,
  faits: FaitRecent[],
  nom: string,
  aujourdhui: string,
  extras: ExtrasDecryptage = {},
): DecryptageDonnees {
  const code = d.identite.code;
  const c = d.chiffres_cles;
  const cours = c.cours;
  const actionsNb = d.identite.actions;
  const ed = extras.editorial ?? null;
  const comptes: ComptesGroupe | null = ed?.comptes && ed.comptes.exercice === c.exercice ? ed.comptes : null;
  const med = d.suivi.medianes;
  const ligneMed = (libelle: string) => med?.lignes.find((l) => l.libelle === libelle) ?? null;
  const seances = (extras.seances ?? []).filter((s) => s.cours_jour != null);
  const jour = aujourdhui.slice(0, 10);

  // Résultat part du groupe : le PER et le P/B reviennent aux seuls actionnaires de la société.
  const bpaGroupe = comptes && actionsNb ? comptes.resultat_part_groupe / actionsNb : null;
  const fpgAction = comptes && actionsNb ? comptes.fonds_propres_groupe / actionsNb : null;
  const perConso = d.ratios?.per ?? null;
  const perGroupe = cours != null && bpaGroupe ? cours / bpaGroupe : null;
  const perRetenu = perGroupe ?? perConso;
  const perMediane = ligneMed('PER')?.mediane ?? d.suivi.piliers.find((p) => p.cle === 'valorisation')?.precedente ?? null;
  const pbConso = d.ratios?.pb ?? null;
  const pbGroupe = cours != null && fpgAction ? cours / fpgAction : null;
  const pbRetenu = pbGroupe ?? pbConso;
  const pbMediane = ligneMed('Cours / valeur comptable')?.mediane ?? null;

  // Les piliers du dossier, la valorisation recalculée sur le résultat part du groupe.
  const piliers: Pilier[] = d.suivi.piliers.map((p) =>
    p.cle === 'valorisation' && perGroupe != null && perMediane != null
      ? { ...p, mesure: perGroupe, statut: perGroupe <= perMediane ? 'tenu' : 'non_tenu' }
      : p,
  );
  const mesurables = piliers.filter((p) => p.statut === 'tenu' || p.statut === 'non_tenu');
  const tenus = piliers.filter((p) => p.statut === 'tenu');
  const jauges = new Map(piliers.map((p) => [p.cle, jaugePilier(p, perMediane)]));

  const traj = d.trajectoire.filter((t) => t.chiffre_affaires != null && t.resultat_net != null);
  const dernier = traj.at(-1) ?? null;
  const avant = traj.at(-2) ?? null;
  const premier = traj[0] ?? null;
  const ans = premier && dernier ? Number(dernier.exercice) - Number(premier.exercice) : 0;
  const tcam = (a: number | null, b: number | null) => (a && b && ans > 0 ? (a / b) ** (1 / ans) - 1 : null);
  const tcamCA = tcam(dernier?.chiffre_affaires ?? null, premier?.chiffre_affaires ?? null);
  const tcamRN = tcam(dernier?.resultat_net ?? null, premier?.resultat_net ?? null);
  const croissCA = c.croissance_ca_1an;
  const croissRN = variation(dernier?.resultat_net, avant?.resultat_net);
  const margeNette = dernier ? dernier.resultat_net! / dernier.chiffre_affaires! : null;
  const margeNettePrec = avant ? avant.resultat_net! / avant.chiffre_affaires! : null;
  const rapExploit = d.qualite_resultat?.resultat_exploitation ?? null;
  const tauxImpot = comptes && c.resultat_net != null ? comptes.impot_societes / (c.resultat_net + comptes.impot_societes) : null;
  const tauxImpotPrec = comptes ? comptes.impot_societes_prec / comptes.resultat_avant_impot_prec : null;
  const tresoNette = c.tresorerie != null && c.dette != null ? c.tresorerie - c.dette : null;

  const operation =
    (extras.operations ?? [])
      .filter((o) => o.type === 'fractionnement' && o.ratio > 1 && seances.some((s) => s.date_marche >= o.date_effet))
      .at(-1) ?? null;

  // Séances de baisse consécutives en fin de fenêtre, et plus haut de la fenêtre.
  let baisses = 0;
  for (let i = seances.length - 1; i >= 0 && (seances[i].variation_pct ?? 0) < 0; i--) baisses++;
  const pic = seances.reduce<SeanceRecente | null>((m, s) => (m == null || s.cours_jour! > m.cours_jour! ? s : m), null);
  const derniere = seances.at(-1) ?? null;

  // ── En-tête ───────────────────────────────────────────────────────────────
  const etalement = (() => {
    const v = tenus.map((p) => jauges.get(p.cle)).filter((x): x is number => x != null);
    return v.length >= 2 ? Math.max(...v) - Math.min(...v) : 0;
  })();
  const titre =
    mesurables.length === 0
      ? `${nom} : ce que disent les comptes`
      : `${nom} : ${tenus.length} pilier${tenus.length > 1 ? 's' : ''} tenu${tenus.length > 1 ? 's' : ''} sur ${mesurables.length}` +
        (tenus.length === mesurables.length
          ? etalement >= 40 ? ', mais avec des marges de sécurité très inégales' : ''
          : `, ${mesurables.length - tenus.length} sous le seuil`);

  const prefixe =
    operation && baisses >= 2 ? `après un fractionnement par ${nb(operation.ratio)} et ${baisses} séances de baisse, ` : '';
  const prix =
    cours != null && perRetenu != null
      ? `le prix payé : au cours de ${F(cours)}, le PER ${perGroupe != null ? 'sur le résultat part du groupe ' : ''}est de ${fois(perRetenu)}` +
        (perGroupe != null && perConso != null ? ` (${fois(perConso)} sur le résultat consolidé, minoritaires inclus)` : '') +
        (perMediane != null ? `, pour une médiane de ${fois(perMediane)}.` : '.')
      : null;
  const chapo =
    (mesurables.length
      ? tenus.length === mesurables.length
        ? `Les ${mesurables.length} piliers de la thèse sont tenus. `
        : `${tenus.length} pilier${tenus.length > 1 ? 's' : ''} de la thèse sur ${mesurables.length} ${tenus.length > 1 ? 'sont tenus' : 'est tenu'}. `
      : '') + (prix ? majuscule(`${prefixe}reste ${prix}`) : '');

  const stats: Stat[] = [];
  if (cours != null)
    stats.push({
      label: 'Cours',
      valeur: F(cours),
      sous: c.variation_veille_pct != null ? `${pctS(c.variation_veille_pct / 100, 2)} sur la séance` : null,
      ton: c.variation_veille_pct == null ? null : c.variation_veille_pct < 0 ? 'down' : 'up',
    });
  if (c.capitalisation != null)
    stats.push({ label: 'Capitalisation', valeur: `${nb(c.capitalisation / 1e9, 0)} Md FCFA`, sous: actionsNb ? `${actions(actionsNb)} d’actions` : null, ton: null });
  if (perRetenu != null)
    stats.push({ label: perGroupe != null ? 'PER (BPA groupe)' : 'PER', valeur: fois(perRetenu), sous: perMediane != null ? `médiane ${fois(perMediane)}` : null, ton: null });
  if (d.dividende.rendement != null && d.dividende.montant != null) {
    const net = d.dividende.base_fiscale === 'net';
    const brut = comptes?.dividende_brut && cours ? comptes.dividende_brut / cours : null;
    stats.push({
      label: net ? 'Rendement net' : 'Rendement',
      valeur: pct(d.dividende.rendement, 2),
      sous: `${F(d.dividende.montant)}${net ? ' net' : ''}${brut != null ? ` · ${pct(brut, 2)} brut` : ''}`,
      ton: null,
    });
  }

  // ── Lecture en 30 secondes ───────────────────────────────────────────────
  const verdict: DecryptageDonnees['verdict'] = [];
  const pil = (cle: Pilier['cle']) => piliers.find((p) => p.cle === cle);
  const tient: string[] = [];
  const pCA = pil('croissance');
  if (pCA?.statut === 'tenu' && pCA.mesure != null) tient.push(`chiffre d’affaires ${pctS(pCA.mesure)}`);
  const pMarge = pil('marge');
  if (pMarge?.statut === 'tenu' && pMarge.mesure != null)
    tient.push(`marge d’exploitation ${pMarge.tendance === 'hausse' ? 'en hausse' : 'stable'} à ${pct(pMarge.mesure)}`);
  if (tresoNette != null && tresoNette > 0) tient.push(`trésorerie supérieure de ${md(tresoNette)} FCFA aux dettes financières`);
  const pRoe = pil('rentabilite');
  if (pRoe?.statut === 'tenu' && pRoe.mesure != null) tient.push(`rentabilité des capitaux propres de ${pct(pRoe.mesure)}`);
  if (tient.length) verdict.push({ ton: 'up', titre: 'Ce qui tient', texte: `${majuscule(tient.join(', '))}.` });

  const resserre: string[] = [];
  if (croissRN != null && croissCA != null && croissRN < croissCA) {
    resserre.push(
      `Le résultat net progresse moins vite que l’activité (${pctS(croissRN)} contre ${pctS(croissCA)})` +
        (tauxImpot != null && tauxImpotPrec != null && tauxImpot > tauxImpotPrec
          ? `, car l’impôt pèse plus lourd : taux effectif de ${pct(tauxImpot)} contre ${pct(tauxImpotPrec)}.`
          : '.'),
    );
  }
  if (margeNette != null && margeNettePrec != null && margeNette < margeNettePrec)
    resserre.push(`La marge nette recule à ${pct(margeNette)} contre ${pct(margeNettePrec)}.`);
  if (!resserre.length && n.risques[0]) resserre.push(`${n.risques[0].texte}.`);
  if (resserre.length) verdict.push({ ton: 'warn', titre: 'Ce qui se resserre', texte: resserre.join(' ') });

  const change: string[] = [];
  if (pic && derniere && derniere.cours_jour! < pic.cours_jour! * 0.97)
    change.push(`Le titre perd ${pct(1 - derniere.cours_jour! / pic.cours_jour!)} depuis le plus haut du ${dateLongue(pic.date_marche).replace(/ \d{4}$/, '')} (${F(pic.cours_jour!)}).`);
  else if (derniere?.variation_pct != null)
    change.push(`Le titre clôture à ${F(derniere.cours_jour!)} (${pctS(derniere.variation_pct / 100, 2)}).`);
  if (pbRetenu != null && pbMediane != null)
    change.push(
      `Le P/B, à ${fois(pbRetenu, pbGroupe != null ? 2 : 1)}${pbGroupe != null ? ' sur les fonds propres part du groupe' : ''}, est ` +
        (pbRetenu > pbMediane * 1.02 ? 'au-dessus de' : pbRetenu < pbMediane * 0.98 ? 'sous' : 'au niveau de') +
        ` la médiane (${fois(pbMediane)}).`,
    );
  if (change.length) verdict.push({ ton: 'down', titre: 'Ce qui a changé en séance', texte: change.join(' ') });

  // ── Piliers ────────────────────────────────────────────────────────────────
  const hausses = (() => {
    const h = d.dividende.historique.filter((x) => x.montant != null).map((x) => x.montant!);
    let k = 0;
    for (let i = h.length - 1; i > 0 && h[i] > h[i - 1]; i--) k++;
    return k;
  })();
  const roeMed = ligneMed('ROE')?.mediane ?? null;
  const detteNetteEbitda = ligneMed('Dette nette / EBITDA')?.valeur ?? null;
  const LIBELLE: Record<Pilier['cle'], string> = {
    croissance: 'Croissance du chiffre d’affaires',
    marge: 'Marge d’exploitation',
    rentabilite: 'ROE',
    endettement: 'Dette / fonds propres',
    dividende: 'Dividende',
    valorisation: 'PER',
  };
  const lignesPiliers: LignePilier[] = piliers.map((p) => {
    const base = { libelle: LIBELLE[p.cle], statut: STATUT[p.statut], jauge: jauges.get(p.cle) ?? null };
    const m = p.mesure;
    if (m == null) return { ...base, valeur: '—', seuil: p.statut === 'non_applicable' ? 'Sans objet' : '—', legende: p.seuil, tendance: '—' };
    switch (p.cle) {
      case 'croissance':
        return {
          ...base,
          valeur: pctS(m),
          seuil: 'Positive',
          legende: tcamCA != null ? `${pct(tcamCA)} par an en moyenne depuis ${premier!.exercice}` : 'Hausse sur un an',
          tendance: tcamCA != null ? `${premier!.exercice}-${dernier!.exercice.slice(2)} : ${pctS(tcamCA)}/an` : '—',
        };
      case 'marge': {
        const ecart = p.precedente != null ? (m - p.precedente) * 100 : null;
        return {
          ...base,
          valeur: pct(m),
          seuil: 'Stable',
          legende: ecart != null && avant ? `${ecart >= 0 ? '+' : '−'}${nb(Math.abs(ecart), 2)} pt vs ${avant.exercice} (${pct(p.precedente!, 2)})` : p.seuil,
          tendance: p.tendance === 'hausse' ? 'En hausse' : p.tendance === 'baisse' ? 'En baisse' : 'Stable',
        };
      }
      case 'rentabilite':
        return { ...base, valeur: pct(m), seuil: '≥ 15 %', legende: `${nb(m / 0.15, 1)} fois le seuil`, tendance: roeMed != null ? `Médiane : ${nb(roeMed, 1)} %` : '—' };
      case 'endettement':
        return {
          ...base,
          valeur: pct(m),
          seuil: '≤ 50 %',
          legende: m <= 0.5 ? `${nb((0.5 - m) * 100, 0)} points sous le plafond` : `${nb((m - 0.5) * 100, 0)} points au-dessus du plafond`,
          tendance: tresoNette != null ? (tresoNette > 0 ? 'Trésorerie nette' : 'Dette nette') : detteNetteEbitda != null && detteNetteEbitda < 0 ? 'Trésorerie nette' : '—',
        };
      case 'dividende': {
        const v = variation(m, p.precedente);
        const net = d.dividende.base_fiscale === 'net' ? ' net' : '';
        return {
          ...base,
          valeur: `${F(m)}${net}`,
          seuil: 'Pas de baisse',
          legende: v != null ? `${pctS(v)} vs ${F(p.precedente!)}${hausses >= 2 ? `, ${hausses}e hausse d’affilée` : ''}` : p.seuil,
          tendance: p.tendance === 'hausse' ? 'En hausse' : p.tendance === 'baisse' ? 'En baisse' : 'Stable',
        };
      }
      case 'valorisation':
        return {
          ...base,
          valeur: fois(m),
          seuil: perMediane != null ? `≤ médiane (${fois(perMediane)})` : 'Médiane',
          legende: perMediane != null ? `${pct(Math.abs(1 - m / perMediane), 0)} ${m <= perMediane ? 'sous' : 'au-dessus de'} la médiane` : p.seuil,
          tendance: perGroupe != null && perConso != null ? `Résultat consolidé : ${fois(perConso)}` : '—',
        };
    }
  });
  const piliersBloc = {
    intro:
      mesurables.length && tenus.length === mesurables.length
        ? `Les ${mesurables.length} critères sont respectés. Mais un pilier tenu avec une large marge n’a pas la même solidité qu’un autre tenu de justesse. La jauge mesure l’écart au seuil.`
        : `${tenus.length} critère${tenus.length > 1 ? 's' : ''} sur ${mesurables.length} ${tenus.length > 1 ? 'sont respectés' : 'est respecté'}. La jauge mesure l’écart au seuil.`,
    lignes: lignesPiliers,
    note:
      'Plus la barre est longue, plus la marge est large. Échelle propre à chaque critère : croissance, barre pleine à +15 % ; marge, de −1 à +1 point sur un an ; ROE, à deux fois le seuil ; dette et PER, distance relative au plafond ; dividende, barre pleine à +10 %.' +
      (perGroupe != null && perConso != null && comptes && c.resultat_net != null
        ? ` Le PER divise la capitalisation par le résultat part du groupe (${md(comptes.resultat_part_groupe)}), et non par le résultat consolidé (${md(c.resultat_net)}) dont une part revient aux minoritaires : ${fois(perGroupe)} au lieu de ${fois(perConso)}.`
        : ''),
  };

  // ── Vigilance : valorisation sur actif net ──────────────────────────────────
  const vigilance =
    pbRetenu != null && pbMediane != null && pbRetenu >= pbMediane * 0.9 && cours != null
      ? {
          titre: 'Point de vigilance : la valorisation sur actif net',
          chiffre: fois(pbRetenu, 2),
          texte:
            (fpgAction != null
              ? `Le P/B ressort à ${fois(pbRetenu, 2)} (${F(cours)} pour ${F(fpgAction, 1)} de fonds propres part du groupe par action)`
              : `Le P/B ressort à ${fois(pbRetenu, 2)} sur les capitaux propres totaux`) +
            `, contre ${fois(pbMediane)} pour la médiane des ${med?.nbSocietes ?? ''} ${med?.groupe ?? 'sociétés comparables'}. ` +
            (pbRetenu > pbMediane ? 'La valeur n’est pas décotée sur ce critère.' : 'La valeur n’est que peu décotée sur ce critère.') +
            (pbGroupe != null && pbConso != null ? ` Sur les fonds propres totaux, minoritaires compris, il serait de ${fois(pbConso, 2)}.` : ''),
        }
      : null;

  // ── Comparables ────────────────────────────────────────────────────────────
  let comparables: DecryptageDonnees['comparables'] = null;
  if (med && med.lignes.length) {
    const MULTIPLES = new Set(['PER', 'Cours / valeur comptable', 'VE / EBITDA', 'Couverture des intérêts']);
    const NOM: Record<string, string> = {
      'Cours / valeur comptable': 'P/B',
      'Rendement du dividende': 'Rendement',
      'Conversion du résultat en cash': 'Conversion cash',
      'Croissance du BPA (3 ans)': 'Croissance du BPA sur 3 ans',
    };
    const val = (x: number | null, u: '%' | 'x', libelle: string) =>
      x == null ? '—' : u === '%' ? `${nb(x, 1)} %` : MULTIPLES.has(libelle) ? fois(x) : nb(x, 1);
    const precision = (libelle: string, v: number | null): string => {
      switch (libelle) {
        case 'PER':
          return perGroupe != null && c.date_cours ? `${fois(perGroupe)} sur BPA groupe au ${jm(c.date_cours)}` : '';
        case 'Cours / valeur comptable':
          return pbGroupe != null && pbMediane != null
            ? `${fois(pbGroupe, 2)} sur fonds propres part du groupe : ${pbGroupe > pbMediane ? 'plutôt au-dessus' : 'plutôt en dessous'}`
            : '';
        case 'VE / EBITDA':
          return 'Valeur d’entreprise nette de trésorerie';
        case 'Rendement du dividende':
          return d.dividende.rendement != null && cours != null
            ? `${pct(d.dividende.rendement, 2)}${d.dividende.base_fiscale === 'net' ? ' net' : ''} au cours de ${F(cours)}`
            : '';
        case 'Taux de distribution':
          return comptes?.dividende_brut && bpaGroupe ? `${pct(comptes.dividende_brut / bpaGroupe)} brut sur résultat part du groupe` : '';
        case 'Dette nette / EBITDA':
          return v != null && v < 0 ? 'Trésorerie nette' : '';
        case 'Dette / capitaux propres':
          return c.dette != null && c.tresorerie != null ? `Dette brute de ${md(c.dette)} contre ${md(c.tresorerie)} de trésorerie` : '';
        default:
          return '';
      }
    };
    const barre = (indicateur: string, libelle: string): Barre => ({
      indicateur,
      valeur: ligneMed(libelle)?.valeur ?? null,
      mediane: ligneMed(libelle)?.mediane ?? null,
    });
    const liq = d.suivi.liquidite;
    const notation = d.identite.notation;
    const notes: string[] = [];
    if (liq?.classe)
      notes.push(
        `Liquidité du titre : classe ${liq.classe}${liq.score != null ? `, score ${liq.score}/100` : ''}` +
          (liq.spread_pct != null ? `, écart acheteur-vendeur de ${nb(liq.spread_pct, 2)} %${liq.spread_source === 'roll' ? ' (estimé)' : ''}` : '') +
          '.',
      );
    if (notation?.note)
      notes.push(
        `Notation ${notation.agence ?? ''} : ${notation.note} sur l’échelle régionale${notation.date_notation ? ` (${dateLongue(notation.date_notation)})` : ''} ; une note régionale compare les émetteurs de la zone UEMOA entre eux.`,
      );
    comparables = {
      intro: `Médianes calculées sur ${med.nbSocietes} ${med.groupe}. Le tableau vient du calcul comparatif périodique : il peut différer légèrement des chiffres recalculés au ${c.date_cours ? dateLongue(c.date_cours) : 'jour'}.`,
      multiples: [
        { indicateur: 'PER', valeur: perRetenu, mediane: perMediane },
        { indicateur: 'P/B', valeur: pbRetenu, mediane: pbMediane },
        barre('VE/EBITDA', 'VE / EBITDA'),
      ].filter((b) => b.valeur != null && b.mediane != null),
      rentabilite: [barre('ROE', 'ROE'), barre('ROA', 'ROA'), barre('BPA sur 3 ans', 'Croissance du BPA (3 ans)')].filter(
        (b) => b.valeur != null && b.mediane != null,
      ),
      lignes: med.lignes.map((l) => ({
        indicateur: NOM[l.libelle] ?? l.libelle,
        valeur: val(l.valeur, l.unite, l.libelle),
        mediane: val(l.mediane, l.unite, l.libelle),
        lecture: l.lecture ? LECTURE[l.lecture] ?? null : null,
        precision: precision(l.libelle, l.valeur),
      })),
      note: notes.length ? notes.join(' ') : null,
    };
  }

  // ── Résultats ──────────────────────────────────────────────────────────────
  let resultats: DecryptageDonnees['resultats'] = null;
  if (traj.length >= 2 && dernier) {
    const periode = `${premier!.exercice}-${dernier.exercice}`;
    const kpis: Stat[] = [];
    if (tcamCA != null) kpis.push({ label: 'Croissance annuelle moyenne du CA', valeur: pctS(tcamCA), sous: periode, ton: null });
    if (tcamRN != null) kpis.push({ label: 'Croissance annuelle moyenne du résultat net', valeur: pctS(tcamRN), sous: periode, ton: null });
    kpis.push({
      label: `Résultat net ${dernier.exercice}`,
      valeur: md(dernier.resultat_net!),
      sous: comptes ? `dont ${md(comptes.resultat_part_groupe)} part du groupe` : null,
      ton: null,
    });
    if (tauxImpot != null && tauxImpotPrec != null && avant)
      kpis.push({ label: 'Taux d’impôt effectif', valeur: pct(tauxImpot), sous: `${pct(tauxImpotPrec)} en ${avant.exercice}`, ton: null });
    else if (margeNette != null)
      kpis.push({ label: 'Marge nette', valeur: pct(margeNette), sous: margeNettePrec != null && avant ? `${pct(margeNettePrec)} en ${avant.exercice}` : null, ton: null });

    const paragraphes: Paragraphe[] = [];
    if (comptes && rapExploit != null && c.resultat_net != null) {
      const gRE = rapExploit / comptes.resultat_exploitation_prec - 1;
      const rythme =
        croissCA != null && Math.abs(gRE - croissCA) < 0.01
          ? 'au rythme du chiffre d’affaires'
          : croissCA != null && gRE < croissCA
            ? 'moins vite que le chiffre d’affaires'
            : 'plus vite que le chiffre d’affaires';
      if (margeNette != null && margeNettePrec != null && margeNette < margeNettePrec) {
        const ii = comptes.impot_intermediaire;
        paragraphes.push({
          titre: 'Pourquoi la marge nette recule-t-elle ?',
          texte:
            `Le résultat d’exploitation progresse de ${pct(gRE)} (${md(rapExploit)} contre ${md(comptes.resultat_exploitation_prec)}), ${rythme}. ` +
            `L’écart se joue plus bas : l’impôt sur les sociétés passe de ${md(comptes.impot_societes_prec)} à ${md(comptes.impot_societes)} FCFA (${pctS(comptes.impot_societes / comptes.impot_societes_prec - 1)}).` +
            (ii ? ` Au ${ii.libelle}, le taux effectif ${ii.taux < ii.taux_prec ? 'redescend' : 'monte'} à ${pct(ii.taux)} contre ${pct(ii.taux_prec)} un an plus tôt.` : ''),
        });
      }
      const minor = c.resultat_net - comptes.resultat_part_groupe;
      if (minor > 0 && bpaGroupe != null)
        paragraphes.push({
          titre: `Un résultat dont ${pct(minor / c.resultat_net, 0)} échappent aux actionnaires`,
          texte:
            `Sur ${md(c.resultat_net)} FCFA de résultat consolidé, ${md(minor)} reviennent aux actionnaires minoritaires des filiales` +
            (comptes.filiales.length ? ` (${comptes.filiales.map((f) => f.pays).join(', ')})` : '') +
            `. Le résultat part du groupe, soit ${F(bpaGroupe, 0)} par action, ${evolue(comptes.resultat_part_groupe / comptes.resultat_part_groupe_prec - 1)}.`,
        });
      if (comptes.free_cash_flow != null && comptes.capex != null && dernier.chiffre_affaires) {
        const distribue = comptes.dividende_brut && actionsNb ? comptes.dividende_brut * actionsNb : null;
        paragraphes.push({
          titre: 'Trésorerie',
          texte:
            `Free cash flow de ${md(comptes.free_cash_flow)} FCFA pour ${md(comptes.capex)} d’investissements (${pct(comptes.capex / dernier.chiffre_affaires, 0)} du chiffre d’affaires` +
            (comptes.capex_variation != null ? `, ${comptes.capex_variation < 0 ? 'en baisse' : 'en hausse'} de ${pct(Math.abs(comptes.capex_variation))}` : '') +
            ').' +
            (distribue ? ` Il couvre ${nb(comptes.free_cash_flow / distribue, 1)} fois le dividende brut revenant aux actionnaires de ${nom}.` : ''),
        });
      }
    }
    resultats = {
      serie: traj.map((t) => ({
        exercice: t.exercice,
        ca: Math.round(t.chiffre_affaires! / 1e8) / 10,
        rn: Math.round(t.resultat_net! / 1e7) / 100,
        marge: Math.round((t.resultat_net! / t.chiffre_affaires!) * 1000) / 10,
      })),
      kpis,
      paragraphes,
    };
  }

  // ── Dividende ──────────────────────────────────────────────────────────────
  let dividende: DecryptageDonnees['dividende'] = null;
  const hist = d.dividende.historique.filter((h) => h.exercice != null && h.montant != null).slice(-5);
  if (hist.length) {
    const precisions: Paragraphe[] = [];
    const net = d.dividende.montant;
    const brut = comptes?.dividende_brut ?? null;
    if (net != null && brut != null && d.dividende.base_fiscale === 'net' && cours != null)
      precisions.push({
        titre: 'Brut et net',
        texte: `Le dividende de l’exercice ${d.dividende.exercice} est de ${F(brut)} brut, soit ${F(net)} net après ${pct(1 - net / brut, 0)} de retenue (IRVM). Le rendement est de ${pct(net / cours, 2)} net et ${pct(brut / cours, 2)} brut au cours de ${F(cours)}.`,
      });
    const payout = ligneMed('Taux de distribution')?.valeur ?? null;
    if (brut != null && net != null && bpaGroupe)
      precisions.push({
        titre: 'Taux de distribution',
        texte:
          `Rapporté au résultat part du groupe, il est de ${pct(brut / bpaGroupe)} en brut (${pct(net / bpaGroupe)} en net).` +
          (payout != null ? ` Le ${nb(payout, 1)} % du tableau comparatif divise un dividende net par le BPA consolidé, minoritaires inclus : les deux termes ne sont pas sur la même base.` : ''),
      });
    if (operation)
      precisions.push({
        titre: 'Échelle',
        texte: `Montants exprimés après le fractionnement par ${nb(operation.ratio)} : les montants publiés avant l’opération sont divisés par ${nb(operation.ratio)}.`,
      });
    if (d.dividende.ex_date)
      precisions.push({
        titre: 'Calendrier',
        texte: `Détachement le ${dateLongue(d.dividende.ex_date)}${d.dividende.payment_date ? `, paiement le ${dateLongue(d.dividende.payment_date)}` : ''}.`,
      });
    dividende = {
      serie: hist.map((h, i) => ({
        exercice: String(h.exercice),
        montant: h.montant!,
        variation: i > 0 ? Math.round((h.montant! / hist[i - 1].montant! - 1) * 1000) / 10 : null,
      })),
      precisions,
      lien: ed?.sources.find((s) => /dividende/i.test(s.label)) ?? null,
    };
  }

  // ── Séances récentes ───────────────────────────────────────────────────────
  let coursBloc: DecryptageDonnees['cours'] = null;
  if (seances.length >= 3 && derniere) {
    const idxOp = operation ? seances.findIndex((s) => s.date_marche >= operation.date_effet) : -1;
    // Avec une opération : la séance qui la précède (cours ajusté), puis les suivantes.
    const fenetre = idxOp >= 0 ? seances.slice(Math.max(0, idxOp - 1)) : seances.slice(-6);
    const haut52 = d.suivi.performance.haut52;
    const commentees = idxOp >= 0 ? seances.slice(idxOp) : fenetre.filter((s) => Math.abs(s.variation_pct ?? 0) >= 3);
    const points = commentees.map((s, i) => {
      let t = `${jm(s.date_marche)} : ${F(s.cours_jour!)}${s.variation_pct != null ? ` (${pctS(s.variation_pct / 100, 2)})` : ''}`;
      if (haut52 != null && s.cours_jour === haut52) t += ', plus haut sur 52 semaines';
      if (i === commentees.length - 1 && s.volume && s.valeur_echangee)
        t += `. ${nb(s.volume / 1e6, 2)} millions de titres échangés, ${md(s.valeur_echangee)} FCFA`;
      return `${t}.`;
    });
    const avantBaisse = seances[seances.length - 1 - baisses];
    coursBloc = {
      titre: operation ? `Le fractionnement par ${nb(operation.ratio)} et les séances suivantes` : 'Les dernières séances',
      intro:
        operation && actionsNb
          ? `Depuis le ${dateLongue(operation.date_effet)}, le capital est divisé en ${actions(actionsNb)} d’actions (${actions(actionsNb / operation.ratio)} auparavant). Un fractionnement ne change pas la valeur de l’entreprise : seule l’unité de compte change.`
          : null,
      serie: fenetre.map((s) => {
        const ajuste = operation != null && s.date_marche < operation.date_effet;
        return { date: jm(s.date_marche), cours: s.cours_jour!, ajuste, ton: ajuste ? 'neutre' : (s.variation_pct ?? 0) < 0 ? 'down' : 'up' };
      }),
      points,
      conclusion:
        baisses >= 2 && avantBaisse?.cours_jour
          ? `Sur ces ${baisses} séances, la baisse cumulée est de ${pct(1 - derniere.cours_jour! / avantBaisse.cours_jour)}.`
          : null,
      note: idxOp > 0 ? '* Cours de la séance précédant l’opération, ajusté de son ratio.' : null,
    };
  }

  // ── Risques ────────────────────────────────────────────────────────────────
  const risques: RisqueEditorial[] = [];
  const sourcesComptes = comptes ? [comptes.source] : [];
  if (pbRetenu != null && pbMediane != null && pbRetenu >= pbMediane * 0.9) {
    const fortes = seances.filter((s) => Math.abs(s.variation_pct ?? 0) >= 5).length;
    risques.push({
      titre: 'Valorisation',
      texte:
        `P/B de ${fois(pbRetenu, 2)}${pbGroupe != null ? ' sur les fonds propres part du groupe' : ''}, ${pbRetenu > pbMediane ? 'au-dessus de' : 'proche de'} la médiane (${fois(pbMediane)}).` +
        (fortes >= 2 ? ` Le titre a varié de 5 % ou plus sur ${fortes} des ${seances.length} dernières séances.` : ''),
      sources: [],
    });
  }
  if (comptes)
    risques.push({
      titre: 'Pression fiscale',
      texte: `Impôts et taxes d’exploitation : ${md(comptes.impots_taxes_exploitation)} FCFA en ${comptes.exercice} contre ${md(comptes.impots_taxes_exploitation_prec)} (${pctS(comptes.impots_taxes_exploitation / comptes.impots_taxes_exploitation_prec - 1)}). L’impôt sur les sociétés passe de ${md(comptes.impot_societes_prec)} à ${md(comptes.impot_societes)} (${pctS(comptes.impot_societes / comptes.impot_societes_prec - 1)}).`,
      sources: sourcesComptes,
    });
  risques.push(...(ed?.risques ?? []));
  if (comptes && c.resultat_net != null && c.resultat_net > comptes.resultat_part_groupe)
    risques.push({
      titre: 'Fuite vers les minoritaires',
      texte:
        `${pct(1 - comptes.resultat_part_groupe / c.resultat_net, 0)} du résultat net ne revient pas aux actionnaires de ${nom}.` +
        (comptes.filiales.length
          ? ` Le groupe détient ${comptes.filiales.map((f) => `${pct(f.interet, Math.round(f.interet * 10000) % 100 ? 2 : 0)} (${f.pays})`).join(', ')} de ses filiales.`
          : ''),
      sources: sourcesComptes,
    });
  if (comptes?.ecarts_conversion != null && comptes.resultat_global != null && c.resultat_net != null && comptes.ecarts_conversion < 0)
    risques.push({
      titre: 'Change',
      texte: `Écarts de conversion de −${md(Math.abs(comptes.ecarts_conversion))} FCFA en ${comptes.exercice} : le résultat global (${md(comptes.resultat_global)}) est inférieur au résultat net (${md(c.resultat_net)}).`,
      sources: sourcesComptes,
    });
  // Les vigilances du dossier, sauf celle sur la valeur comptable, déjà traitée ci-dessus.
  for (const r of n.risques) if (!/capitaux propres/i.test(r.texte)) risques.push({ titre: 'Point de vigilance', texte: `${r.texte}.`, sources: [] });

  // ── Invalidation ───────────────────────────────────────────────────────────
  const INVALIDE: Record<Pilier['cle'], string> = {
    croissance: 'Baisse sur un an',
    marge: 'Recul de plus d’un point sur un an',
    rentabilite: 'Sous 15 %',
    endettement: 'Au-dessus de 50 %',
    dividende: 'Baisse d’un exercice à l’autre',
    valorisation: 'Au-dessus de la médiane',
  };
  const inval: LigneInvalidation[] = piliers.flatMap((p, i) => {
    if (p.statut !== 'tenu' || p.mesure == null) return [];
    let si = INVALIDE[p.cle];
    if (p.cle === 'valorisation') {
      const bpa = bpaGroupe ?? d.ratios?.bpa ?? null;
      if (perMediane != null && bpa) si += `, soit environ ${F(Math.round((perMediane * bpa) / 10) * 10)} à BPA constant`;
    }
    return [{
      indicateur: p.cle === 'valorisation' && perGroupe != null ? 'PER sur BPA groupe' : lignesPiliers[i].libelle,
      aujourdhui: lignesPiliers[i].valeur,
      invalidee_si: si,
      origine: 'Critère de la page' as const,
    }];
  });
  if (margeNette != null && margeNette > 0.05)
    inval.push({ indicateur: 'Marge nette', aujourdhui: pct(margeNette), invalidee_si: `Sous ${nb(Math.floor(margeNette * 100 - 1.5), 0)} %`, origine: 'Seuil indicatif' });

  // ── Journal et catalyseurs ─────────────────────────────────────────────────
  const journal: (EntreeDatee & { tri: string })[] = [];
  const parDate = new Map(seances.map((s) => [s.date_marche, s]));
  const datesCouvertes = new Set(faits.map((f) => f.date_fait));
  for (const f of faits) {
    const s = parDate.get(f.date_fait);
    const pilier = PILIER_DU_FAIT[f.type] ?? 'non précisé';
    journal.push({
      tri: f.date_fait,
      date: jm(f.date_fait),
      titre: f.titre,
      texte:
        (s?.cours_jour != null ? `Clôture à ${F(s.cours_jour)}${s.variation_pct != null ? ` (${pctS(s.variation_pct / 100, 2)})` : ''}. ` : '') +
        `Pilier concerné : ${pilier}.`,
      lien: `/actualites/${f.slug}`,
      indicatif: false,
    });
  }
  for (const s of seances)
    if (!datesCouvertes.has(s.date_marche) && Math.abs(s.variation_pct ?? 0) >= 4)
      journal.push({
        tri: s.date_marche,
        date: jm(s.date_marche),
        titre: `${s.variation_pct! > 0 ? 'Hausse' : 'Repli'} de ${nb(Math.abs(s.variation_pct!), 2)} %`,
        texte: `Clôture à ${F(s.cours_jour!)}.`,
        lien: null,
        indicatif: false,
      });
  const inter = d.suivi.intermediaire;
  if (inter && inter.revenu != null && inter.resultatNet != null && inter.revenuPrecedent && inter.resultatNetPrecedent) {
    const [an, per] = inter.periode.split('-');
    journal.push({
      tri: `${an}-${String(Math.min(12, inter.mois)).padStart(2, '0')}-28`,
      date: `${per} ${an}`,
      titre: 'Résultats intermédiaires',
      texte: `Chiffre d’affaires de ${md(inter.revenu)} FCFA (${pctS(inter.revenu / inter.revenuPrecedent - 1)}), résultat net de ${md(inter.resultatNet)} (${pctS(inter.resultatNet / inter.resultatNetPrecedent - 1)}) sur le ${inter.libelle}.`,
      lien: null,
      indicatif: false,
    });
  }
  const notes = (extras.notations ?? []).filter((x) => x.note && x.date_notation);
  if (notes[0] && notes[1] && notes[0].note !== notes[1].note) {
    const ordre = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'BBB-', 'BB+', 'BB', 'BB-', 'B+', 'B', 'B-'];
    const releve = ordre.indexOf(notes[0].note!) < ordre.indexOf(notes[1].note!);
    journal.push({
      tri: notes[0].date_notation!,
      date: jm(notes[0].date_notation!),
      titre: `Note ${d.identite.notation?.agence ? `${d.identite.notation.agence} ` : ''}${releve ? 'relevée' : 'abaissée'} à ${notes[0].note}`,
      texte: `Depuis ${notes[1].note}. Échelle régionale${notes[0].perspective ? `, perspective ${notes[0].perspective.toLowerCase()}` : ''}.`,
      lien: null,
      indicatif: false,
    });
  }
  for (const j of ed?.journal ?? [])
    journal.push({ tri: j.tri, date: j.date, titre: j.titre, texte: j.texte, lien: j.source?.url ?? null, indicatif: !!j.indicatif });
  journal.sort((a, b) => b.tri.localeCompare(a.tri));

  const catalyseurs: (EntreeDatee & { tri: string })[] = [
    ...d.suivi.rendez_vous.map((r) => ({ tri: r.date, date: dateLongue(r.date), titre: r.libelle, texte: 'Date publiée.', lien: null, indicatif: false })),
    ...(ed?.catalyseurs ?? [])
      .filter((x) => x.tri >= jour)
      .map((x) => ({ tri: x.tri, date: x.date, titre: x.titre, texte: x.texte + (x.indicatif ? ' Date indicative.' : ''), lien: x.source?.url ?? null, indicatif: !!x.indicatif })),
  ].sort((a, b) => a.tri.localeCompare(b.tri));

  // ── Méthode et sources ─────────────────────────────────────────────────────
  const methode =
    `Données au ${dateLongue(c.date_cours ?? jour)}. ` +
    (cours != null && actionsNb
      ? `Ratios recalculés au cours de ${F(cours)}, avec ${actions(actionsNb)} d’actions` +
        (bpaGroupe != null && fpgAction != null
          ? ` : PER = ${nb(cours)} / ${F(bpaGroupe, 0)} de BPA part du groupe ; P/B = ${nb(cours)} / ${F(fpgAction, 1)} de fonds propres part du groupe par action.`
          : '.')
      : '') +
    (c.dette != null && c.capitaux_propres != null
      ? ` La dette rapportée aux fonds propres totaux (${md(c.dette)} / ${md(c.capitaux_propres)}) est de ${pct(c.dette / c.capitaux_propres)}.`
      : '') +
    (med ? ` Médianes : calcul comparatif périodique sur ${med.nbSocietes} ${med.groupe}.` : '') +
    (ed ? ` Données éditoriales vérifiées sur les documents cités le ${dateLongue(ed.verifie_le)}.` : '');

  const sources: Source[] = [
    ...(ed?.sources ?? []),
    ...faits.slice(0, 3).map((f) => ({ label: `WESTBOURSE, ${f.titre}`, url: `https://www.westbourse.com/actualites/${f.slug}` })),
    { label: 'WESTBOURSE, dossier valeur', url: `https://www.westbourse.com/rapports/dossier/${code}` },
  ];

  return {
    version: 1,
    code,
    nom,
    date_seance: c.date_cours,
    kicker: ['Décryptage', code, d.identite.secteur, c.date_cours ? `Séance du ${dateLongue(c.date_cours)}` : null].filter(Boolean).join(' · '),
    titre,
    chapo,
    stats,
    verdict,
    piliers: piliersBloc,
    vigilance,
    comparables,
    resultats,
    dividende,
    cours: coursBloc,
    risques,
    invalidation: {
      intro: 'Seuils chiffrés. Les critères de la page sont repris tels quels ; les seuils indicatifs sont des repères de lecture, à ajuster au fil des publications.',
      lignes: inval,
    },
    journal: journal.slice(0, 8).map(({ tri: _t, ...j }) => j),
    catalyseurs: catalyseurs.map(({ tri: _t, ...x }) => x),
    methode,
    sources,
    avertissement: AVERTISSEMENT,
  };
}

// ── Markdown dérivé (diffusion, flux, repli) ──────────────────────────────────

export function versMarkdown(x: DecryptageDonnees): string {
  const s: string[] = [];
  const table = (tete: string[], lignes: string[][]) =>
    [`| ${tete.join(' | ')} |`, `|${tete.map(() => '---').join('|')}|`, ...lignes.map((l) => `| ${l.map(cellule).join(' | ')} |`)].join('\n');

  if (x.verdict.length) s.push(`## Lecture en 30 secondes\n\n${x.verdict.map((v) => `- **${v.titre}** : ${v.texte}`).join('\n')}`);
  s.push(
    `## Les piliers de la thèse\n\n${x.piliers.intro}\n\n` +
      table(['Pilier', 'Valeur', 'Seuil', 'Marge de sécurité', 'Tendance', 'Statut'], x.piliers.lignes.map((l) => [l.libelle, l.valeur, l.seuil, l.legende, l.tendance, l.statut])),
  );
  if (x.vigilance) s.push(`**${x.vigilance.titre}.** ${x.vigilance.texte}`);
  if (x.comparables)
    s.push(
      `## Face aux comparables\n\n${x.comparables.intro}\n\n` +
        table(['Indicateur', x.nom, 'Médiane', 'Lecture', 'Précision'], x.comparables.lignes.map((l) => [l.indicateur, l.valeur, l.mediane, l.lecture ?? '—', l.precision])) +
        (x.comparables.note ? `\n\n${x.comparables.note}` : ''),
    );
  if (x.resultats)
    s.push(
      '## Résultats\n\n' +
        table(
          ['Exercice', 'CA (Md FCFA)', 'Résultat net (Md FCFA)', 'Marge nette'],
          x.resultats.serie.map((p) => [p.exercice, p.ca != null ? nb(p.ca, 1) : '—', p.rn != null ? nb(p.rn, 2) : '—', p.marge != null ? `${nb(p.marge, 1)} %` : '—']),
        ) +
        x.resultats.paragraphes.map((p) => `\n\n**${p.titre}** ${p.texte}`).join(''),
    );
  if (x.dividende)
    s.push(
      '## Dividende\n\n' +
        table(
          ['Exercice', 'Dividende', 'Variation'],
          x.dividende.serie.map((p) => [p.exercice, F(p.montant), p.variation != null ? `${p.variation >= 0 ? '+' : '−'}${nb(Math.abs(p.variation), 1)} %` : '—']),
        ) +
        x.dividende.precisions.map((p) => `\n\n**${p.titre}.** ${p.texte}`).join(''),
    );
  if (x.cours)
    s.push(`## ${x.cours.titre}\n\n${[x.cours.intro, x.cours.points.map((p) => `- ${p}`).join('\n'), x.cours.conclusion].filter(Boolean).join('\n\n')}`);
  if (x.risques.length) s.push(`## Ce qui fragilise la thèse\n\n${x.risques.map((r) => `- **${r.titre}** : ${r.texte}`).join('\n')}`);
  if (x.invalidation.lignes.length)
    s.push(
      `## Ce qui invaliderait la thèse\n\n${x.invalidation.intro}\n\n` +
        table(['Indicateur', 'Aujourd’hui', 'Thèse invalidée si', 'Origine'], x.invalidation.lignes.map((l) => [l.indicateur, l.aujourdhui, l.invalidee_si, l.origine])),
    );
  if (x.journal.length)
    s.push(`## Journal récent\n\n${x.journal.map((j) => `- ${j.date} : ${j.lien ? `[${j.titre}](${j.lien})` : `**${j.titre}**`}. ${j.texte}`).join('\n')}`);
  s.push(
    x.catalyseurs.length
      ? `## Catalyseurs à surveiller\n\n${x.catalyseurs.map((j) => `- ${j.date} : **${j.titre}**. ${j.texte}`).join('\n')}`
      : '## Catalyseurs à surveiller\n\nAucun rendez-vous daté connu à ce jour.',
  );
  s.push(`## Méthode\n\n${x.methode}`);
  s.push(`_${x.avertissement}_`);
  return s.join('\n\n');
}
