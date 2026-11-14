/**
 * Publications du dossier valeur — modules PURS et testés (publications.test.ts).
 *
 *  1. `historiquePublications` : les dates de publication des trois dernières
 *     années, par type de document. Présenté comme un HISTORIQUE (ce qui a eu
 *     lieu), jamais comme un calendrier : la cadence passée ne dit pas la date
 *     de la prochaine publication, et aucune date à venir n'est estimée.
 *  2. `publicationsDeResultats` : les N dernières publications de résultats d'une
 *     société, une ligne par publication (rapport d'activités, attestation des
 *     commissaires et états financiers d'une même période comptent pour UNE),
 *     par le regroupement commun de la liste des événements.
 *  3. `resumeReactions` : la médiane des réactions mesurées. Même règle que
 *     `reactionsPublications` (lib/reactionPublication.ts), dont la réaction par
 *     publication reste LA SEULE façon de mesurer : ici on ne recalcule aucun
 *     écart à l'indice, on ne fait que résumer ceux que `chargerReactions` a
 *     rendus.
 */
import { regrouperEvenements, type EvenementBrut } from '@/lib/evenements/regroupement';

// ── 1. Historique par type de document ──────────────────────────────────────

export interface PublicationBrute {
  date_publication: string | null;
  type_publication: string | null;
}

export interface FamilleDocument {
  cle: 'etats' | 'rapports' | 'ag' | 'notations' | 'communiques';
  libelle: string;
}

const FAMILLES: FamilleDocument[] = [
  { cle: 'etats', libelle: 'États financiers' },
  { cle: 'rapports', libelle: 'Rapports d’activités' },
  { cle: 'ag', libelle: 'Assemblées générales' },
  { cle: 'notations', libelle: 'Notations financières' },
  { cle: 'communiques', libelle: 'Communiqués et avis' },
];

/** Famille d'un type de publication tel que stocké (`publications.type_publication`). */
export function familleDocument(type: string | null): FamilleDocument {
  const t = (type ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const cle: FamilleDocument['cle'] =
    t === 'bilan' || t.startsWith('etats') ? 'etats'
    : t === 'rapport' ? 'rapports'
    : t === 'ag' ? 'ag'
    : t === 'notation' ? 'notations'
    : 'communiques';
  return FAMILLES.find((f) => f.cle === cle)!;
}

export interface HistoriqueFamille {
  famille: FamilleDocument;
  /** Dates distinctes, de la plus récente à la plus ancienne, plafonnées à `max`. */
  dates: string[];
  /** Nombre de dates sur la période, avant plafonnement. */
  total: number;
}

const moinsAnnees = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - n);
  return d.toISOString().slice(0, 10);
};

export function historiquePublications(
  lignes: PublicationBrute[],
  aujourdhui: string,
  options: { annees?: number; max?: number } = {},
): HistoriqueFamille[] {
  const debut = moinsAnnees(aujourdhui, options.annees ?? 3);
  const max = options.max ?? 12;
  const parFamille = new Map<FamilleDocument['cle'], Set<string>>();
  for (const l of lignes) {
    const d = l.date_publication;
    if (!d || d < debut || d > aujourdhui) continue; // pas de date future : l'historique ne prédit rien
    const f = familleDocument(l.type_publication);
    const s = parFamille.get(f.cle) ?? new Set<string>();
    s.add(d);
    parFamille.set(f.cle, s);
  }
  return FAMILLES.filter((f) => parFamille.has(f.cle)).map((famille) => {
    const toutes = [...parFamille.get(famille.cle)!].sort((a, b) => b.localeCompare(a));
    return { famille, dates: toutes.slice(0, max), total: toutes.length };
  });
}

// ── 2. Dernières publications de résultats ──────────────────────────────────

export interface PublicationResultats {
  date: string;
  titre: string;
  periode: string | null;
}

/** `evts` : événements `resultats` de UNE société, dans n'importe quel ordre. */
export function publicationsDeResultats(evts: EvenementBrut[], nombre = 8): PublicationResultats[] {
  /* Une publication par DATE en plus du regroupement par période : un document dont
     le titre ne dit pas sa période (« Etats financiers 2025 et attestation des
     CAC ») reste seul dans le regroupement, alors qu'il tombe le même jour que le
     rapport. La réaction se mesure autour d'une date : la compter deux fois
     pèserait deux fois dans la médiane. */
  const vues = new Set<string>();
  const out: PublicationResultats[] = [];
  for (const g of regrouperEvenements(evts.filter((e) => e.event_type === 'resultats'))) {
    if (vues.has(g.date)) continue;
    vues.add(g.date);
    out.push({ date: g.date, titre: g.titre, periode: g.periode });
    if (out.length === nombre) break;
  }
  return out;
}

/**
 * Libellé lisible d'une publication de résultats : sa période si le titre la
 * dit (« T3-2026 » → « 3e trimestre 2026 »), sinon le titre lui-même, abrégé.
 */
export function libellePublication(periode: string | null, titre: string, max = 64): string {
  const m = periode ? /^(T|S|9M|A)(\d?)-(\d{4})$/.exec(periode) : null;
  if (m) {
    const [, genre, rang, annee] = m;
    if (genre === 'T') return `${rang === '1' ? '1er' : `${rang}e`} trimestre ${annee}`;
    if (genre === 'S') return `${rang === '1' ? '1er' : `${rang}e`} semestre ${annee}`;
    if (genre === '9M') return `9 premiers mois ${annee}`;
    return `Exercice ${annee}`;
  }
  const net = titre.replace(/\s+-\s+[A-ZÉ][A-ZÉ .'-]+$/, '').trim(); // retire le suffixe « - NOM DE LA SOCIÉTÉ »
  return net.length > max ? `${net.slice(0, max - 1).trimEnd()}…` : net;
}

// ── 3. Médiane des réactions ────────────────────────────────────────────────

export interface LigneReaction {
  date: string;
  titre: string;
  periode: string | null;
  /** Écart titre − indice sur 5 séances, en points de pourcentage ; null si non mesurable. */
  ecartIndicePct: number | null;
  enCours: boolean;
}

export interface ResumeReactions {
  /** Réactions mesurées ET closes. */
  nMesurees: number;
  /** Médiane des réactions mesurées et closes ; null sous 3 mesures (une médiane de 1 ou 2 valeurs n'en est pas une). */
  mediane: number | null;
  /** Publications dont la fenêtre n'est pas close. */
  nEnCours: number;
  /** Publications ni en cours ni mesurables (indice ou cours absents). */
  nNonMesurables: number;
}

export const MESURES_MIN_MEDIANE = 3;

export function resumeReactions(lignes: LigneReaction[]): ResumeReactions {
  const valeurs = lignes
    .filter((l) => !l.enCours && l.ecartIndicePct != null)
    .map((l) => l.ecartIndicePct as number)
    .sort((a, b) => a - b);
  const n = valeurs.length;
  let mediane: number | null = null;
  if (n >= MESURES_MIN_MEDIANE) mediane = n % 2 === 1 ? valeurs[(n - 1) / 2]! : (valeurs[n / 2 - 1]! + valeurs[n / 2]!) / 2;
  return {
    nMesurees: n,
    mediane,
    nEnCours: lignes.filter((l) => l.enCours).length,
    nNonMesurables: lignes.filter((l) => !l.enCours && l.ecartIndicePct == null).length,
  };
}
