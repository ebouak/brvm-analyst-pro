import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assertNoForeignNumber, assertNoCausalClaim } from '@/lib/hebdo/narrative';
import type { DossierValeur } from './build';
import type { Narratif } from './narratif';

/**
 * Prose du dossier — squelette PUR, puis version polie sous garde-fou.
 *
 * SANS CHIFFRE PAR CONSTRUCTION. Les panneaux portent les chiffres, vérifiés
 * ligne à ligne. Si la prose en portait aussi, la version polie le samedi
 * serait contredite dès lundi par les panneaux vivants — et le garde-fou
 * l'écarterait à raison, la rendant visible un jour sur sept. La prose ne dit
 * donc que le sens et renvoie aux panneaux ; la seule valeur numérique admise
 * est l'année de l'exercice.
 *
 * EMPREINTE. La prose polie est issue d'un squelette précis. Si les faits
 * qualitatifs changent — une force apparaît, un risque disparaît — le
 * squelette change, son empreinte aussi, et la prose enregistrée est écartée à
 * la lecture. Elle décrirait un dossier qui n'existe plus.
 *
 * Ce module ne parle jamais à un modèle de langage : `polirProse` (route cron)
 * s'en charge, et repasse par `validerProse` ici avant d'écrire quoi que ce
 * soit. La page repasse ENCORE par `validerProse` en lisant. Deux contrôles
 * pour une même règle : aucun chemin n'affiche un texte non vérifié.
 */

export interface SectionProse {
  titre: string;
  texte: string;
}

export interface Squelette {
  sections: SectionProse[];
  /** Valeurs numériques que la prose a le droit de contenir. */
  chiffres: number[];
  /** sha-256 des sections, pour invalider une prose devenue étrangère. */
  empreinte: string;
}

export const TITRE_LECTURE = "Lecture d'ensemble";
export const TITRE_SCENARIOS = 'Scénarios de cours';

/* ── Squelette ───────────────────────────────────────────────────────────── */

function enumerer(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0]!;
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
}

export function construireSquelette(d: DossierValeur, n: Narratif): Squelette {
  const nom = d.identite.designation ?? d.identite.code;
  const exercice = d.chiffres_cles.exercice;
  /* `fait` est la forme sans chiffre de chaque appréciation, écrite à la
     source (narratif.ts) : on n'essaie pas de gommer des chiffres après coup. */
  const forces = n.forces.map((a) => a.fait);
  const risques = n.risques.map((a) => a.fait);

  const phrases: string[] = [];
  phrases.push(
    exercice
      ? `Ce dossier lit ${nom} sur l'exercice ${exercice} et les séances récentes.`
      : `Ce dossier lit ${nom} sur les séances récentes ; aucun exercice comptable complet n'est en base.`,
  );
  if (forces.length > 0) {
    phrases.push(`Du côté des points d'appui, le dossier relève : ${enumerer(forces)} (panneau 10).`);
  } else {
    phrases.push("Aucun point d'appui mesurable ne ressort des données disponibles (panneau 10).");
  }
  if (risques.length > 0) {
    phrases.push(`En regard, les points de vigilance sont : ${enumerer(risques)} (panneau 11).`);
  } else {
    phrases.push("Aucun point de vigilance mesurable ne ressort des données disponibles — ce qui n'est pas une absence de risque (panneau 11).");
  }
  if (d.lacunes.length > 0) {
    phrases.push(
      `Ce que le dossier ne peut pas établir est listé au panneau 12 ; ces réserves font partie de la lecture, pas de sa marge.`,
    );
  }
  phrases.push('Les chiffres qui fondent chaque point figurent dans les panneaux correspondants.');

  const lecture = phrases.join(' ');

  const lv = d.niveaux;
  const scenarios = lv
    ? [
        'Le canal des vingt dernières séances borne le cours entre un support et une résistance, tous deux lus dans les clôtures réelles.',
        lv.cassureHaut
          ? 'La dernière clôture se situe au-dessus de la résistance : le canal est rompu par le haut.'
          : lv.cassureBas
            ? 'La dernière clôture se situe sous le support : le canal est rompu par le bas.'
            : 'La dernière clôture se situe à l’intérieur du canal.',
        'Au-dessus de la résistance, les extensions haussières prolongent l’amplitude du canal ; sous le support, l’invalidation puis les extensions baissières font de même.',
        'Ces niveaux décrivent la géométrie du canal, pas une prévision : ils disent où le mouvement porterait s’il se prolongeait, rien de plus.',
        'Les valeurs correspondantes sont dans le tableau ci-dessous.',
      ].join(' ')
    : 'Moins de vingt-deux séances cotées sont disponibles : aucun canal ne peut être établi, donc aucun scénario de cours.';

  const sections: SectionProse[] = [
    { titre: TITRE_LECTURE, texte: lecture },
    { titre: TITRE_SCENARIOS, texte: scenarios },
  ];

  /* Liste blanche = exactement les nombres que le squelette contient déjà :
     numéros de panneaux, année d'exercice, et un éventuel chiffre dans la
     raison sociale. Rien d'autre — cours, rendement, volume restent aux
     panneaux. Extraite du texte plutôt qu'énumérée à la main, pour que le
     squelette passe toujours son propre contrôle. */
  const chiffres = extraireNombres(sections.map((s) => s.texte).join(' '));

  return { sections, chiffres, empreinte: empreinteDe(sections) };
}

/** Même extraction que `assertNoForeignNumber` (milliers recollés, virgule décimale). */
export function extraireNombres(texte: string): number[] {
  const normalise = texte.replace(/(\d)[\s  ](?=\d{3}(?!\d))/g, '$1');
  const trouves = (normalise.match(/\d+(?:[.,]\d+)?/g) ?? []).map((x) => parseFloat(x.replace(',', '.')));
  return Array.from(new Set(trouves));
}

export function empreinteDe(sections: SectionProse[]): string {
  const h = createHash('sha256');
  for (const s of sections) h.update(`${s.titre}\n${s.texte}\n`);
  return h.digest('hex');
}

/* ── Validation ──────────────────────────────────────────────────────────── */

/**
 * Une prose est acceptée si, et seulement si : mêmes titres, dans le même
 * ordre ; aucun chiffre hors liste blanche ; aucune affirmation causale ;
 * aucune section vide. Sinon `null` — et l'appelant retombe sur le squelette.
 */
export function validerProse(candidate: unknown, squelette: Squelette): SectionProse[] | null {
  if (!Array.isArray(candidate) || candidate.length !== squelette.sections.length) return null;
  const out: SectionProse[] = [];
  for (let i = 0; i < candidate.length; i++) {
    const c = candidate[i] as { titre?: unknown; texte?: unknown };
    const attendu = squelette.sections[i]!;
    if (typeof c?.titre !== 'string' || typeof c?.texte !== 'string') return null;
    if (c.titre.trim() !== attendu.titre) return null;
    const texte = c.texte.trim();
    if (texte.length < 40) return null;
    if (!assertNoForeignNumber(texte, squelette.chiffres)) return null;
    if (!assertNoCausalClaim(texte)) return null;
    out.push({ titre: attendu.titre, texte });
  }
  return out;
}

/* ── Lecture en base ─────────────────────────────────────────────────────── */

export interface ProseChargee {
  sections: SectionProse[];
  /** `polie` si la version enregistrée a passé tous les contrôles, sinon `squelette`. */
  source: 'polie' | 'squelette';
  genere_le: string | null;
}

/**
 * Lit la dernière prose enregistrée et ne la rend QUE si elle correspond au
 * squelette vivant (empreinte) et repasse la validation. Toute autre issue
 * rend le squelette : la page ne dépend jamais de la table.
 */
export async function chargerProse(sb: SupabaseClient, code: string, squelette: Squelette): Promise<ProseChargee> {
  const repli: ProseChargee = { sections: squelette.sections, source: 'squelette', genere_le: null };
  try {
    const { data } = await sb
      .from('dossier_narratifs')
      .select('genere_le, sections, empreinte')
      .eq('code', code)
      .order('genere_le', { ascending: false })
      .limit(1)
      .maybeSingle();
    const row = data as { genere_le?: string; sections?: unknown; empreinte?: string } | null;
    if (!row || row.empreinte !== squelette.empreinte) return repli;
    const valides = validerProse(row.sections, squelette);
    if (!valides) return repli;
    return { sections: valides, source: 'polie', genere_le: row.genere_le ?? null };
  } catch {
    return repli;
  }
}
