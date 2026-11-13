/**
 * Contrôle des écarts entre les ratios du site et le Bulletin Officiel de la
 * Cote (BRVM) — fonctions PURES, testées (ecarts.test.ts).
 *
 * POURQUOI. L'audit du 2026-11-13 a trouvé cinq PER en écart avec le bulletin
 * (SEMC, SDCC, CABC, TTLS, ONTBF) et deux valeurs suspendues affichées comme
 * cotées. Rien ne le signalait : les ratios du site sont calculés depuis les
 * états financiers extraits, et une extraction fausse donne un PER faux mais
 * plausible.
 *
 * MÊME COURS DES DEUX CÔTÉS. Le PER et le rendement du site sont recalculés au
 * cours de référence du bulletin : seul le BÉNÉFICE (ou le dividende) peut
 * alors expliquer un écart, pas un décalage d'une séance sur le cours.
 *
 * Un écart se SIGNALE, il ne se corrige pas : le bulletin peut lui-même retenir
 * un autre exercice ou un résultat consolidé différent (CLAUDE.md, 2026-11-06 :
 * « ne rien corriger sans source »).
 */

/** Au-delà de 3 % d'écart relatif, le ratio est signalé. */
export const SEUIL_ECART = 0.03;

export interface CoteBocLigne {
  code: string;
  date_marche: string;
  statut: 'cote' | 'suspendu';
  cours_cloture: number | null;
  cours_reference: number | null;
  per: number | null;
  rendement_net_pct: number | null;
  dividende_net: number | null;
  dividende_date: string | null;
}

export type EtatComparaison = 'concordant' | 'ecart' | 'absent_site' | 'absent_boc' | 'non_comparable';

export interface Comparaison {
  site: number | null;
  boc: number | null;
  /** Écart relatif signé, (site − boc) / |boc|. */
  ecart: number | null;
  etat: EtatComparaison;
}

const fini = (x: number | null | undefined): x is number => x != null && Number.isFinite(x);

export function comparer(site: number | null, boc: number | null, seuil = SEUIL_ECART): Comparaison {
  const s = fini(site) ? site : null;
  const b = fini(boc) ? boc : null;
  if (s == null && b == null) return { site: null, boc: null, ecart: null, etat: 'non_comparable' };
  if (s == null) return { site: null, boc: b, ecart: null, etat: 'absent_site' };
  if (b == null) return { site: s, boc: null, ecart: null, etat: 'absent_boc' };
  if (b === 0) return { site: s, boc: b, ecart: null, etat: s === 0 ? 'concordant' : 'ecart' };
  const ecart = (s - b) / Math.abs(b);
  return { site: s, boc: b, ecart, etat: Math.abs(ecart) > seuil ? 'ecart' : 'concordant' };
}

/** Entrées du site pour une valeur : comptes retenus et dividende retenu. */
export interface DonneesSite {
  code: string;
  resultatNet: number | null;
  titres: number | null;
  dividende: number | null;
}

export interface ControleValeur {
  code: string;
  date_marche: string;
  statut: 'cote' | 'suspendu';
  per: Comparaison;
  rendement: Comparaison;
}

/** PER et rendement du site, recalculés au cours de référence du bulletin. */
export function controlerValeur(site: DonneesSite | null, boc: CoteBocLigne, seuil = SEUIL_ECART): ControleValeur {
  const cours = boc.cours_reference ?? boc.cours_cloture;
  const bpa = site && fini(site.resultatNet) && fini(site.titres) && site.titres > 0 ? site.resultatNet / site.titres : null;
  const perSite = cours != null && bpa != null && bpa !== 0 ? cours / bpa : null;
  const rdtSite = cours != null && cours > 0 && site && fini(site.dividende) && site.dividende > 0 ? (site.dividende / cours) * 100 : null;
  return {
    code: boc.code,
    date_marche: boc.date_marche,
    statut: boc.statut,
    per: comparer(perSite, boc.per, seuil),
    rendement: comparer(rdtSite, boc.rendement_net_pct, seuil),
  };
}

export interface ResumeControle {
  dateSeance: string | null;
  valeurs: number;
  ecartsPer: string[];
  ecartsRendement: string[];
  suspendues: string[];
  /** Le bulletin publie un PER, le site n'en a aucun (BBGC sans fondamentaux). */
  perManquants: string[];
}

export function resumer(controles: ControleValeur[]): ResumeControle {
  const codes = (f: (c: ControleValeur) => boolean) => controles.filter(f).map((c) => c.code).sort();
  return {
    dateSeance: controles[0]?.date_marche ?? null,
    valeurs: controles.length,
    ecartsPer: codes((c) => c.per.etat === 'ecart'),
    ecartsRendement: codes((c) => c.rendement.etat === 'ecart'),
    suspendues: codes((c) => c.statut === 'suspendu'),
    perManquants: codes((c) => c.per.etat === 'absent_site'),
  };
}

const nf = (x: number, d: number) => x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Texte d'alerte exploitant : codes et chiffres de marché seulement, aucune donnée personnelle. */
export function messageAlerte(r: ResumeControle, controles: ControleValeur[]): string | null {
  if (!r.ecartsPer.length && !r.ecartsRendement.length && !r.perManquants.length) return null;
  const ligne = (c: ControleValeur, k: 'per' | 'rendement', u: string) => {
    const m = c[k];
    return `${c.code} site ${m.site != null ? nf(m.site, 2) : '—'}${u} / BOC ${m.boc != null ? nf(m.boc, 2) : '—'}${u}`;
  };
  const parts = [`Contrôle BOC du ${r.dateSeance ?? '?'} : ${r.valeurs} valeurs.`];
  const per = controles.filter((c) => c.per.etat === 'ecart');
  if (per.length) parts.push(`PER en écart > ${nf(SEUIL_ECART * 100, 0)} % (${per.length}) : ${per.map((c) => ligne(c, 'per', '×')).join(' ; ')}`);
  const rdt = controles.filter((c) => c.rendement.etat === 'ecart');
  if (rdt.length) parts.push(`Rendement en écart (${rdt.length}) : ${rdt.map((c) => ligne(c, 'rendement', ' %')).join(' ; ')}`);
  if (r.perManquants.length) parts.push(`PER publié par la BRVM mais absent du site : ${r.perManquants.join(', ')}`);
  if (r.suspendues.length) parts.push(`Suspendues (SP) : ${r.suspendues.join(', ')}`);
  return parts.join('\n');
}

/* ─── Badge de source d'un ratio (fiche société) ─────────────────────────── */

export type SourceRatio = 'calcule' | 'boc' | 'ns' | 'manquant';

export interface BadgeRatio {
  source: SourceRatio;
  /** Texte court du badge : « Calculé », « BOC », « n.s. », « Manquant ». */
  libelle: string;
  /** Précision lisible au survol et sous le chiffre. */
  detail: string;
  /** Le site s'écarte du bulletin au-delà du seuil. */
  ecart: boolean;
}

export function badgeRatio(p: {
  valeurSite: number | null;
  motifSite: string | null;
  exercice: number | null;
  comparaison: Comparaison | null;
  dateBoc: string | null;
  unite: string;
  decimales: number;
}): BadgeRatio {
  const c = p.comparaison;
  const refBoc = c?.boc != null && p.dateBoc ? `BOC du ${dateCourte(p.dateBoc)} : ${nf(c.boc, p.decimales)}${p.unite}` : null;
  if (p.motifSite?.startsWith('n.s.')) {
    return { source: 'ns', libelle: 'n.s.', detail: refBoc ? `Non significatif. ${refBoc}` : 'Non significatif', ecart: false };
  }
  if (p.valeurSite != null) {
    const base = `Calculé${p.exercice != null ? ` sur les comptes ${p.exercice}` : ''}`;
    const ecart = c?.etat === 'ecart';
    return {
      source: 'calcule',
      libelle: 'Calculé',
      detail: refBoc ? `${base}. ${refBoc}${ecart ? ' (écart à vérifier)' : ''}` : base,
      ecart,
    };
  }
  if (c?.boc != null && p.dateBoc) {
    return { source: 'boc', libelle: 'BOC', detail: `Publié par la BRVM au bulletin du ${dateCourte(p.dateBoc)}`, ecart: false };
  }
  return { source: 'manquant', libelle: 'Manquant', detail: p.motifSite ?? 'Donnée non disponible', ecart: false };
}

function dateCourte(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}
