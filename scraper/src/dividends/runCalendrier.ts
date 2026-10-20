/**
 * Calendrier officiel de paiement des dividendes → table `dividends`.
 * Spec : docs/superpowers/specs/2026-10-20-dividendes-calendrier-design.md
 *
 * À BLANC par défaut : lit, recoupe, classe et imprime. `--ecrire` fait
 * l'upsert sur (code, exercice), source 'brvm-calendrier', que plus aucun
 * autre écrivain n'écrase (runDividends.SOURCES_REFERENCE).
 */
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { sha256 } from '../utils/hash.js';
import { lireCalendrier, type RejetCalendrier } from './calendrier.js';
import { codeDuNom } from './calendrierCodes.js';
import { exerciceDepuisUrlCalendrier } from './esv.js';
import { lirePaiementsEsv, telechargerCalendrier, trouverCalendrier } from './calendrierFetch.js';
import { classer, montantsPourBase, recouperDates, type Cible, type Ecart, type LigneBase } from './rapprochementCalendrier.js';

/** Sous ce nombre de lignes exploitables, la lecture est jugée suspecte : rien n'est fait. */
export const MIN_LIGNES = 20;

export interface LigneRapportCalendrier {
  code: string;
  nom: string;
  recoupee: boolean;
  cible: Cible;
  base: LigneBase | null;
  ecart: Ecart;
}

export interface RapportCalendrier {
  url: string;
  via: 'avis' | 'liste';
  exercice: number;
  lignes: LigneRapportCalendrier[];
  rejets: RejetCalendrier[];
  nonRapproches: string[];
  ecrites: number;
}

const COLONNES = 'code, montant, montant_brut, ex_date, payment_date, avis_brvm, source';
const COLONNES_AVANT_0157 = 'code, montant, ex_date, payment_date, source';

async function lireBase(codes: string[], exercice: number): Promise<{ base: Map<string, LigneBase>; colonnes0157: boolean }> {
  const sb = getSupabase();
  const lire = (cols: string) => sb.from('dividends').select(cols).eq('exercice', exercice).in('code', codes);
  let colonnes0157 = true;
  let { data, error } = await lire(COLONNES);
  if (error?.code === '42703') {
    // Migration 0157 pas encore appliquée : l'exécution À BLANC reste possible.
    colonnes0157 = false;
    logger.warn('dividends : colonnes de la migration 0157 absentes — lecture sans brut ni avis');
    ({ data, error } = await lire(COLONNES_AVANT_0157));
  }
  if (error) throw new Error(`dividends : ${error.message}`);
  const base = new Map<string, LigneBase>();
  for (const r of (data ?? []) as unknown as (Partial<LigneBase> & { code: string })[]) {
    base.set(r.code, {
      montant: r.montant ?? null,
      montant_brut: r.montant_brut ?? null,
      ex_date: r.ex_date ?? null,
      payment_date: r.payment_date ?? null,
      avis_brvm: r.avis_brvm ?? null,
      source: r.source ?? null,
    });
  }
  return { base, colonnes0157 };
}

export async function runCalendrier(opts: { ecrire?: boolean } = {}): Promise<RapportCalendrier> {
  const esv = await lirePaiementsEsv();
  const { url, via } = await trouverCalendrier(esv);
  if (via === 'liste') logger.warn({ url }, 'calendrier trouvé par la page de liste : peut-être périmé');
  const cal = lireCalendrier(await telechargerCalendrier(url));
  const exerciceUrl = exerciceDepuisUrlCalendrier(url);
  if (exerciceUrl !== cal.exercice) {
    throw new Error(`calendrier : exercice ${cal.exercice} dans le document, ${exerciceUrl} dans l'URL — rien n'est fait`);
  }

  const rejets: RejetCalendrier[] = [...cal.rejets];
  const nonRapproches: string[] = [];
  const { retenues, divergences } = recouperDates(cal.lignes, esv);
  for (const d of divergences) {
    rejets.push({
      nom: d.ligne.nom,
      avis: d.ligne.avis,
      motif:
        `dates divergentes : calendrier ex ${d.ligne.ex_date} / paiement ${d.ligne.paiement}, ` +
        `table BRVM ex ${d.esv.ex_date ?? '—'} / paiement ${d.esv.paiement}`,
    });
  }

  const candidats: Omit<LigneRapportCalendrier, 'base' | 'ecart'>[] = [];
  for (const { ligne, recoupee } of retenues) {
    const code = codeDuNom(ligne.nom);
    if (!code) {
      nonRapproches.push(ligne.nom);
      continue;
    }
    const m = montantsPourBase(ligne, cal.tauxPersonnePhysique);
    if (!m) {
      rejets.push({ nom: ligne.nom, avis: ligne.avis, motif: 'dividende brut sans taux lisible dans la note du document' });
      continue;
    }
    candidats.push({
      code,
      nom: ligne.nom,
      recoupee,
      cible: { ...m, ex_date: ligne.ex_date, payment_date: ligne.paiement, avis_brvm: ligne.avis },
    });
  }

  // Deux dividendes d'une même société pour un même exercice ne tiennent pas
  // dans la clé (code, exercice) : non tranché, rejeté et nommé.
  const parCode = new Map<string, number>();
  for (const c of candidats) parCode.set(c.code, (parCode.get(c.code) ?? 0) + 1);
  const uniques = candidats.filter((c) => {
    if ((parCode.get(c.code) ?? 0) === 1) return true;
    rejets.push({ nom: c.nom, avis: c.cible.avis_brvm, motif: `plusieurs dividendes pour ${c.code} dans le calendrier : non tranché` });
    return false;
  });
  if (uniques.length < MIN_LIGNES) {
    throw new Error(`calendrier : ${uniques.length} lignes exploitables dans ${url} — lecture suspecte, rien n'est fait`);
  }

  const { base, colonnes0157 } = await lireBase(uniques.map((c) => c.code), cal.exercice);
  const lignes: LigneRapportCalendrier[] = uniques.map((c) => {
    const b = base.get(c.code) ?? null;
    return { ...c, base: b, ecart: classer(c.cible, b) };
  });

  let ecrites = 0;
  const aEcrire = lignes.filter((l) => l.ecart !== 'concordant');
  if (opts.ecrire && aEcrire.length) {
    if (!colonnes0157) throw new Error('écriture impossible : appliquer d’abord la migration 0157');
    const rows = aEcrire.map((l) => ({
      code: l.code,
      exercice: cal.exercice,
      montant: l.cible.montant,
      montant_brut: l.cible.montant_brut,
      taux_retenue: l.cible.taux_retenue,
      avis_brvm: l.cible.avis_brvm,
      ex_date: l.cible.ex_date,
      payment_date: l.cible.payment_date,
      base_fiscale: 'net',
      devise: 'XOF',
      source: 'brvm-calendrier',
      source_url: url,
      // Même clé que runDividends et runDividendesBoc (code|exercice|montant).
      dedupe_hash: sha256(`${l.code}|${cal.exercice}|${l.cible.montant}`),
    }));
    const { error } = await getSupabase().from('dividends').upsert(rows, { onConflict: 'code,exercice' });
    if (error) throw new Error(`upsert dividends (brvm-calendrier) : ${error.message}`);
    ecrites = rows.length;
  }
  logger.info(
    {
      url,
      via,
      exercice: cal.exercice,
      lignes: lignes.length,
      rejets: rejets.length,
      non_rapproches: nonRapproches.length,
      ecrites,
      ecrire: Boolean(opts.ecrire),
    },
    'calendrier officiel des dividendes',
  );
  return { url, via, exercice: cal.exercice, lignes, rejets, nonRapproches, ecrites };
}
