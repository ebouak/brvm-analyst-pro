/**
 * Relevé mensuel du portefeuille — calcul PUR (aucune entrée-sortie).
 *
 * Tout chiffre du relevé sort d'ici, de données passées en argument. Une donnée
 * absente est DÉCLARÉE (ligne exclue et nommée, total `null`), jamais remplacée
 * par zéro ni estimée.
 *
 * Deux règles de fond :
 *  - un relevé est RÉEL (`portfolios_positions`) OU SIMULÉ (`paper_trading_*`),
 *    jamais un mélange : l'appelant choisit, cette fonction ne reçoit qu'une
 *    liste de positions et un `type` ;
 *  - la variation est une variation de COURS : elle n'inclut pas les dividendes,
 *    présentés à part.
 */
import type {
  BaseFiscale, DividendeReleve, LigneExclue, LigneReleve, PublicationReleve,
  ReleveJson, RendezVousReleve, TotalDividendes, TypeReleve,
} from './types.js';

export interface PositionEntree {
  code: string;
  quantite: number;
  prix_entree: number | null;
  /** null = détenue avant le mois (date inconnue). */
  date_entree: string | null;
  /** Simulateur : position clôturée. */
  date_sortie?: string | null;
  prix_sortie?: number | null;
}
export interface PointCours { date: string; cours: number }
export interface CoursEntree {
  /** Dernière clôture connue à la fin du mois. */
  fin: PointCours | null;
  /** Dernière clôture strictement avant le début du mois. */
  precedent: PointCours | null;
}
export interface DividendeEntree {
  code: string;
  exercice: number | null;
  montant: number;
  ex_date: string | null;
  payment_date: string | null;
  base_fiscale: string | null;
  source: string | null;
}
export interface PublicationEntree { date: string; code: string; titre: string; type: string | null }
export interface AssembleeEntree { code: string | null; date_ag: string; nature: string }
export interface InstrumentEntree { designation: string | null; secteur: string | null }

export interface EntreeReleve {
  mois: string;
  type: TypeReleve;
  genereLe: string;
  positions: PositionEntree[];
  cours: Record<string, CoursEntree>;
  instruments: Record<string, InstrumentEntree>;
  dividendes: DividendeEntree[];
  publications: PublicationEntree[];
  assemblees: AssembleeEntree[];
}

/** Au plus ce nombre de publications est listé ; le reste est compté, pas caché. */
export const MAX_PUBLICATIONS = 30;

// ── Calendrier ──────────────────────────────────────────────────────────────

const RE_MOIS = /^\d{4}-(0[1-9]|1[0-2])$/;
export const moisValide = (m: string): boolean => RE_MOIS.test(m);

function utc(a: number, m: number, j: number): Date {
  return new Date(Date.UTC(a, m, j));
}
function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Bornes d'un mois et du suivant : `debut`/`fin` inclus. */
export function bornesMois(mois: string): { debut: string; fin: string; suivantDebut: string; suivantFin: string; suivant: string } {
  if (!moisValide(mois)) throw new Error(`mois invalide : ${mois}`);
  const a = Number(mois.slice(0, 4));
  const m = Number(mois.slice(5, 7)) - 1;
  const suivant = utc(a, m + 1, 1);
  return {
    debut: iso(utc(a, m, 1)),
    fin: iso(utc(a, m + 1, 0)),
    suivantDebut: iso(suivant),
    suivantFin: iso(utc(a, m + 2, 0)),
    suivant: iso(suivant).slice(0, 7),
  };
}

/** Mois précédent (AAAA-MM) d'une date. */
export function moisPrecedent(d: Date): string {
  const p = utc(d.getUTCFullYear(), d.getUTCMonth() - 1, 1);
  return iso(p).slice(0, 7);
}

// ── Utilitaires ─────────────────────────────────────────────────────────────

const arrondi = (v: number, d: number): number => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};
const dansMois = (date: string | null, debut: string, fin: string): boolean => date != null && date >= debut && date <= fin;

function baseFiscale(v: string | null): BaseFiscale {
  return v === 'net' || v === 'brut' ? v : 'inconnu';
}

/** Préséance des sources pour dédoublonner un même exercice (voir SOURCES_REFERENCE de runDividends). */
function rangSource(s: string | null): number {
  if (!s) return 0;
  if (s.startsWith('brvm-calendrier')) return 3;
  if (s.startsWith('boc') || s.startsWith('brvm-boc')) return 2;
  return 1;
}

/**
 * Une ligne par (code, exercice) : plusieurs sources écrivent le même dividende
 * (arrondi sikafinance, valeur exacte du calendrier). On garde la source la
 * plus fiable, puis la ligne qui porte une date de paiement. Un acompte et un
 * solde d'un même exercice sont rares ; en cas de doute on sous-compte, on ne
 * compte jamais deux fois.
 */
function dedoublonner(lignes: DividendeEntree[]): DividendeEntree[] {
  const retenues = new Map<string, DividendeEntree>();
  for (const d of lignes) {
    if (!(d.montant > 0)) continue; // un montant nul est un trou de collecte, pas un dividende
    const cle = `${d.code}|${d.exercice ?? 'sans-exercice'}`;
    const actuel = retenues.get(cle);
    const meilleur =
      !actuel ||
      rangSource(d.source) > rangSource(actuel.source) ||
      (rangSource(d.source) === rangSource(actuel.source) && actuel.payment_date == null && d.payment_date != null);
    if (meilleur) retenues.set(cle, d);
  }
  return [...retenues.values()];
}

function totaliser(lignes: DividendeReleve[]): TotalDividendes {
  if (lignes.length === 0) return { montant: null, base: null, nb: 0 };
  const bases = new Set(lignes.map((l) => l.base_fiscale));
  const avecMontant = lignes.filter((l) => l.montant_total != null);
  if (bases.size !== 1 || avecMontant.length !== lignes.length) return { montant: null, base: null, nb: lignes.length };
  return {
    montant: arrondi(lignes.reduce((s, l) => s + (l.montant_total as number), 0), 2),
    base: [...bases][0] as BaseFiscale,
    nb: lignes.length,
  };
}

// ── Construction ────────────────────────────────────────────────────────────

/**
 * @returns null quand aucune position n'est détenue pendant le mois : il n'y a
 *          alors pas de relevé à produire (l'appelant le compte comme ignoré).
 */
export function construireReleve(e: EntreeReleve): ReleveJson | null {
  const { debut, fin, suivantDebut, suivantFin } = bornesMois(e.mois);
  const reel = e.type === 'reel';
  const nom = (code: string) => e.instruments[code]?.designation ?? code;

  // Positions détenues à un moment du mois.
  const detenues = e.positions.filter((p) => {
    if (!(p.quantite > 0)) return false;
    if (p.date_entree != null && p.date_entree > fin) return false;
    if (p.date_sortie != null && p.date_sortie < debut) return false;
    return true;
  });
  if (detenues.length === 0) return null;

  // ── Valorisation, position par position puis regroupée par code ─────────
  interface Brut { depart: number | null; fin: number | null; quantite: number; ouverte: boolean; soldee: boolean; motif: string | null }
  const parCode = new Map<string, Brut>();
  for (const p of detenues) {
    const c = e.cours[p.code];
    const ouverte = p.date_entree != null && p.date_entree >= debut;
    const soldee = p.date_sortie != null && p.date_sortie >= debut && p.date_sortie <= fin;

    let motif: string | null = null;
    let depart: number | null = null;
    let valFin: number | null = null;

    if (ouverte) {
      if (p.prix_entree != null && p.prix_entree > 0) depart = p.quantite * p.prix_entree;
      else motif = 'prix d’entrée non renseigné';
    } else if (c?.precedent) {
      depart = p.quantite * c.precedent.cours;
    } else {
      motif = 'cours du mois précédent indisponible';
    }

    if (soldee) {
      if (p.prix_sortie != null && p.prix_sortie > 0) valFin = p.quantite * p.prix_sortie;
      else motif ??= 'prix de sortie non renseigné';
    } else if (c?.fin) {
      valFin = p.quantite * c.fin.cours;
    } else {
      motif = 'cours indisponible';
    }

    const brut = parCode.get(p.code) ?? { depart: 0, fin: 0, quantite: 0, ouverte: false, soldee: false, motif: null };
    brut.quantite += p.quantite;
    brut.ouverte ||= ouverte;
    brut.soldee ||= soldee;
    if (motif) brut.motif ??= motif;
    brut.depart = brut.depart == null || depart == null ? null : brut.depart + depart;
    brut.fin = brut.fin == null || valFin == null ? null : brut.fin + valFin;
    parCode.set(p.code, brut);
  }

  const exclues: LigneExclue[] = [];
  const retenues: { code: string; brut: Brut }[] = [];
  for (const [code, brut] of [...parCode.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (brut.depart == null || brut.fin == null) {
      exclues.push({ code, designation: nom(code), motif: brut.motif ?? 'cours indisponible' });
    } else {
      retenues.push({ code, brut });
    }
  }

  const totalDepart = retenues.reduce((s, r) => s + (r.brut.depart as number), 0);
  const totalFin = retenues.reduce((s, r) => s + (r.brut.fin as number), 0);
  const variationTotale = totalFin - totalDepart;

  const lignes: LigneReleve[] = retenues
    .map(({ code, brut }): LigneReleve => {
      const c = e.cours[code]!;
      const vDepart = brut.depart as number;
      const vFin = brut.fin as number;
      const variation = vFin - vDepart;
      return {
        code,
        designation: nom(code),
        secteur: e.instruments[code]?.secteur ?? null,
        quantite: brut.quantite,
        cours_depart: brut.ouverte ? null : (c.precedent?.cours ?? null),
        cours_fin: (c.fin as PointCours).cours,
        date_cours: (c.fin as PointCours).date,
        valeur_depart: arrondi(vDepart, 2),
        valeur_fin: arrondi(vFin, 2),
        variation: arrondi(variation, 2),
        variation_pct: vDepart > 0 ? arrondi((variation / vDepart) * 100, 4) : null,
        contribution_pts: totalDepart > 0 ? arrondi((variation / totalDepart) * 100, 4) : null,
        poids_pct: totalFin > 0 ? arrondi((vFin / totalFin) * 100, 4) : null,
        ouverte_dans_mois: brut.ouverte,
        soldee_dans_mois: brut.soldee,
      };
    })
    .sort((a, b) => b.valeur_fin - a.valeur_fin || a.code.localeCompare(b.code));

  const derniereSeance = lignes.reduce<string | null>((m, l) => (m == null || l.date_cours > m ? l.date_cours : m), null);

  // ── Concentration ───────────────────────────────────────────────────────
  const premiere = lignes[0] ?? null;
  const parSecteur = new Map<string, number>();
  let sansSecteur = 0;
  for (const l of lignes) {
    if (l.secteur) parSecteur.set(l.secteur, (parSecteur.get(l.secteur) ?? 0) + l.valeur_fin);
    else sansSecteur += l.valeur_fin;
  }
  const premierSecteur = [...parSecteur.entries()].sort(([sa, a], [sb, b]) => b - a || sa.localeCompare(sb))[0] ?? null;

  // ── Quantité détenue à une date (droit au dividende) ────────────────────
  /** Détenue AVANT la date : la veille au soir suffit, acheter le jour du détachement ne donne pas droit. */
  const quantiteAvant = (code: string, date: string): number =>
    detenues
      .filter((p) => p.code === code)
      .filter((p) => (p.date_entree == null || p.date_entree < date) && (p.date_sortie == null || p.date_sortie >= date))
      .reduce((s, p) => s + p.quantite, 0);
  /** Détenue à la fin du mois (base des rendez-vous du mois suivant). */
  const quantiteFinMois = (code: string): number =>
    detenues.filter((p) => p.code === code && !(p.date_sortie != null && p.date_sortie <= fin)).reduce((s, p) => s + p.quantite, 0);

  const codesDetenus = new Set(detenues.map((p) => p.code));
  const divs = dedoublonner(e.dividendes.filter((d) => codesDetenus.has(d.code)));

  const enLigne = (d: DividendeEntree, quantite: number): DividendeReleve => ({
    code: d.code,
    designation: nom(d.code),
    exercice: d.exercice,
    ex_date: d.ex_date,
    payment_date: d.payment_date,
    montant_par_action: d.montant,
    quantite,
    montant_total: reel ? arrondi(d.montant * quantite, 2) : null,
    base_fiscale: baseFiscale(d.base_fiscale),
  });
  const droit = (d: DividendeEntree): number => {
    const repere = d.ex_date ?? d.payment_date;
    return repere ? quantiteAvant(d.code, repere) : 0;
  };

  let dividendes: ReleveJson['dividendes'] = null;
  if (reel) {
    const detaches = divs
      .filter((d) => dansMois(d.ex_date, debut, fin))
      .map((d) => ({ d, q: droit(d) }))
      .filter(({ q }) => q > 0)
      .map(({ d, q }) => enLigne(d, q))
      .sort((a, b) => (a.ex_date ?? '').localeCompare(b.ex_date ?? '') || a.code.localeCompare(b.code));
    const encaisses = divs
      .filter((d) => dansMois(d.payment_date, debut, fin))
      .map((d) => ({ d, q: droit(d) }))
      .filter(({ q }) => q > 0)
      .map(({ d, q }) => enLigne(d, q))
      .sort((a, b) => (a.payment_date ?? '').localeCompare(b.payment_date ?? '') || a.code.localeCompare(b.code));
    dividendes = { detaches, encaisses, total_detaches: totaliser(detaches), total_encaisses: totaliser(encaisses) };
  }

  // ── Publications du mois (sociétés détenues) ────────────────────────────
  const toutes: PublicationReleve[] = e.publications
    .filter((p) => codesDetenus.has(p.code) && dansMois(p.date, debut, fin))
    .map((p) => ({ date: p.date, code: p.code, designation: nom(p.code), titre: p.titre, type: p.type }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.code.localeCompare(b.code) || a.titre.localeCompare(b.titre));
  const liste = toutes.slice(0, MAX_PUBLICATIONS);

  // ── Rendez-vous du mois suivant ─────────────────────────────────────────
  const rdv: RendezVousReleve[] = [];
  for (const d of divs) {
    const q = quantiteFinMois(d.code);
    if (q <= 0) continue;
    const base = baseFiscale(d.base_fiscale);
    const total = reel ? arrondi(d.montant * q, 2) : null;
    if (dansMois(d.ex_date, suivantDebut, suivantFin)) {
      rdv.push({
        type: 'detachement', date: d.ex_date as string, code: d.code, designation: nom(d.code),
        libelle: 'Détachement du dividende', montant_par_action: d.montant, montant_total: total, base_fiscale: base,
      });
    }
    if (dansMois(d.payment_date, suivantDebut, suivantFin)) {
      rdv.push({
        type: 'paiement', date: d.payment_date as string, code: d.code, designation: nom(d.code),
        libelle: 'Paiement du dividende', montant_par_action: d.montant, montant_total: total, base_fiscale: base,
      });
    }
  }
  for (const a of e.assemblees) {
    if (a.code && codesDetenus.has(a.code) && quantiteFinMois(a.code) > 0 && dansMois(a.date_ag, suivantDebut, suivantFin)) {
      rdv.push({
        type: 'assemblee', date: a.date_ag, code: a.code, designation: nom(a.code),
        libelle: `Assemblée générale ${a.nature.toLowerCase()}`.trim(), montant_par_action: null, montant_total: null, base_fiscale: null,
      });
    }
  }
  rdv.sort((a, b) => a.date.localeCompare(b.date) || a.code.localeCompare(b.code) || a.type.localeCompare(b.type));

  return {
    version: 2,
    type: e.type,
    titre: reel ? 'Relevé du portefeuille' : 'Relevé du portefeuille simulé',
    mois: e.mois,
    genere_le: e.genereLe,
    debut,
    fin,
    derniere_seance: derniereSeance,
    resume: {
      valeur_depart: lignes.length ? arrondi(totalDepart, 2) : null,
      valeur_fin: lignes.length ? arrondi(totalFin, 2) : null,
      variation: lignes.length ? arrondi(variationTotale, 2) : null,
      variation_pct: lignes.length && totalDepart > 0 ? arrondi((variationTotale / totalDepart) * 100, 4) : null,
      nb_lignes: lignes.length,
      nb_exclues: exclues.length,
    },
    lignes,
    exclues,
    dividendes,
    publications: { liste, non_listees: toutes.length - liste.length },
    concentration: {
      premiere_ligne: premiere && premiere.poids_pct != null
        ? { code: premiere.code, designation: premiere.designation, poids_pct: premiere.poids_pct }
        : null,
      premier_secteur: premierSecteur && totalFin > 0
        ? { secteur: premierSecteur[0], poids_pct: arrondi((premierSecteur[1] / totalFin) * 100, 4) }
        : null,
      sans_secteur_pct: totalFin > 0 && sansSecteur > 0 ? arrondi((sansSecteur / totalFin) * 100, 4) : null,
    },
    rendez_vous: rdv,
  };
}
