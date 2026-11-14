/**
 * Génération des relevés mensuels — entrées/sorties. Toute la décision (quoi
 * afficher, comment valoriser, quoi exclure) est dans `calcul.ts`, pur et testé.
 *
 * DONNÉES PRIVÉES. Ce module lit `portfolios_positions` et `paper_trading_*`
 * (service_role) et n'écrit que `monthly_reports.report_json`. Il ne journalise
 * jamais une position, un montant ni une adresse : seulement des comptes.
 *
 * Aucun appel de modèle de langage : le relevé est entièrement dérivé des données.
 *
 * Idempotent sur (user_id, month) :
 *  - relevé déjà ENVOYÉ → intact (ni report_json, ni report_url, ni sent_at) ;
 *  - relevé non envoyé → report_json recalculé ; `report_url` est remis à null
 *    car l'éventuel PDF ne correspond plus au contenu (video/releves.mjs le
 *    réimprime).
 */
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import {
  bornesMois, construireReleve, moisPrecedent, moisValide,
  type AssembleeEntree, type CoursEntree, type DividendeEntree, type InstrumentEntree,
  type PositionEntree, type PublicationEntree,
} from './calcul.js';
import type { TypeReleve } from './types.js';

export interface RelevesRunOptions { month?: string; dryRun?: boolean }
export interface RelevesRunResult {
  status: 'success' | 'partial' | 'failed';
  month: string;
  comptes: number;
  generes: number;
  ignores: number;
  dejaEnvoyes: number;
  erreurs: number;
  message: string;
}

type Supa = ReturnType<typeof getSupabase>;
const TRANCHE = 1000; // PostgREST tronque à 1000 lignes EN SILENCE

async function lireTout<T>(
  requete: (de: number, a: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  nom: string,
): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; ; de += TRANCHE) {
    const { data, error } = await requete(de, de + TRANCHE - 1);
    if (error) throw new Error(`Lecture ${nom} impossible : ${error.message}`);
    const lot = data ?? [];
    out.push(...lot);
    if (lot.length < TRANCHE) break;
  }
  return out;
}

function jourMoins(dateIso: string, jours: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - jours);
  return d.toISOString().slice(0, 10);
}

/** Dernière clôture ≤ fin de mois, et dernière clôture < début de mois, par code. */
async function chargerCours(sb: Supa, codes: string[], debut: string, fin: string): Promise<Record<string, CoursEntree>> {
  const out: Record<string, CoursEntree> = {};
  if (codes.length === 0) return out;
  // 120 jours de recul : au-delà, un « dernier cours » serait trop ancien pour valoriser un départ de mois.
  const depuis = jourMoins(debut, 120);
  const lignes = await lireTout<{ code: string; date_marche: string; cours_jour: number | null }>(
    (de, a) =>
      sb.from('brvm_actions_daily')
        .select('code, date_marche, cours_jour')
        .in('code', codes)
        .gte('date_marche', depuis)
        .lte('date_marche', fin)
        .order('code').order('date_marche')
        .range(de, a),
    'brvm_actions_daily',
  );
  for (const code of codes) out[code] = { fin: null, precedent: null };
  for (const l of lignes) {
    const cours = Number(l.cours_jour);
    if (!(cours > 0)) continue; // un zéro en base est un trou de collecte, pas un cours
    const c = out[l.code]!;
    c.fin = { date: l.date_marche, cours }; // ordre croissant : la dernière écrase
    if (l.date_marche < debut) c.precedent = { date: l.date_marche, cours };
  }
  return out;
}

/** Premium seulement : la bibliothèque /premium/reports est réservée à cet abonnement. */
async function comptesPremium(sb: Supa): Promise<string[]> {
  const lignes = await lireTout<{ id: string }>(
    (de, a) => sb.from('profiles').select('id').eq('is_premium', true).order('id').range(de, a),
    'profiles',
  );
  return lignes.map((l) => l.id);
}

/** `.in()` sur de longues listes : l'URL PostgREST a une taille limitée. */
function morceaux<T>(liste: T[], taille: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < liste.length; i += taille) out.push(liste.slice(i, i + taille));
  return out;
}

export async function runReleves(opts: RelevesRunOptions = {}): Promise<RelevesRunResult> {
  const sb = getSupabase();
  const month = opts.month ?? moisPrecedent(new Date());
  if (!moisValide(month)) throw new Error(`mois invalide : ${month} (attendu AAAA-MM)`);
  const { debut, fin, suivantDebut, suivantFin } = bornesMois(month);
  const res: RelevesRunResult = { status: 'success', month, comptes: 0, generes: 0, ignores: 0, dejaEnvoyes: 0, erreurs: 0, message: '' };
  const genereLe = new Date().toISOString();

  const users = await comptesPremium(sb);
  res.comptes = users.length;
  if (users.length === 0) {
    res.message = 'aucun compte Premium';
    logger.info(res, 'relevés mensuels : rien à faire');
    return res;
  }

  // ── Positions : réelles d'abord ; simulées seulement pour un compte sans position réelle ──
  const reelles: { user_id: string; code: string; quantite: number; prix_entree: number | null; date_entree: string | null }[] = [];
  for (const lot of morceaux(users, 100)) {
    reelles.push(...await lireTout<{ user_id: string; code: string; quantite: number; prix_entree: number | null; date_entree: string | null }>(
      (de, a) =>
        sb.from('portfolios_positions').select('user_id, code, quantite, prix_entree, date_entree')
          .in('user_id', lot).order('user_id').order('id').range(de, a),
      'portfolios_positions',
    ));
  }
  const posReelles = new Map<string, PositionEntree[]>();
  for (const r of reelles) {
    const l = posReelles.get(r.user_id) ?? [];
    l.push({ code: r.code, quantite: Number(r.quantite), prix_entree: r.prix_entree == null ? null : Number(r.prix_entree), date_entree: r.date_entree });
    posReelles.set(r.user_id, l);
  }
  const sansReel = users.filter((u) => !posReelles.has(u));
  const posSimulees = new Map<string, PositionEntree[]>();
  for (const lot of morceaux(sansReel, 100)) {
    const sim = await lireTout<{ user_id: string; code: string; num_shares: number; entry_price: number | null; entry_date: string | null; exit_price: number | null; exit_date: string | null }>(
      (de, a) =>
        sb.from('paper_trading_positions').select('user_id, code, num_shares, entry_price, entry_date, exit_price, exit_date')
          .in('user_id', lot).order('user_id').order('id').range(de, a),
      'paper_trading_positions',
    );
    for (const r of sim) {
      const l = posSimulees.get(r.user_id) ?? [];
      l.push({
        code: r.code, quantite: Number(r.num_shares), prix_entree: r.entry_price == null ? null : Number(r.entry_price),
        date_entree: r.entry_date, date_sortie: r.exit_date, prix_sortie: r.exit_price == null ? null : Number(r.exit_price),
      });
      posSimulees.set(r.user_id, l);
    }
  }

  const codes = [...new Set([...reelles.map((r) => r.code), ...[...posSimulees.values()].flat().map((p) => p.code)])].sort();
  if (codes.length === 0) {
    res.ignores = users.length;
    res.message = 'aucune position';
    logger.info(res, 'relevés mensuels : aucune position');
    return res;
  }

  // ── Données de marché (publiques), chargées une fois pour tous les comptes ──
  const [cours, instrRows, divRows, pubRows, agRows, existants] = await Promise.all([
    chargerCours(sb, codes, debut, fin),
    lireTout<{ code: string; designation: string | null; secteur: string | null }>(
      (de, a) => sb.from('brvm_instruments').select('code, designation, secteur').in('code', codes).order('code').range(de, a),
      'brvm_instruments',
    ),
    lireTout<{ code: string; exercice: number | null; montant: number; ex_date: string | null; payment_date: string | null; base_fiscale: string | null; source: string | null }>(
      (de, a) =>
        sb.from('dividends').select('code, exercice, montant, ex_date, payment_date, base_fiscale, source')
          .in('code', codes)
          .or(`and(ex_date.gte.${debut},ex_date.lte.${suivantFin}),and(payment_date.gte.${debut},payment_date.lte.${suivantFin})`)
          .order('code').order('id').range(de, a),
      'dividends',
    ),
    lireTout<{ date_publication: string; code: string; libelle: string; type_publication: string | null }>(
      (de, a) =>
        sb.from('publications').select('date_publication, code, libelle, type_publication')
          .in('code', codes).gte('date_publication', debut).lte('date_publication', fin)
          .order('date_publication').order('id').range(de, a),
      'publications',
    ),
    lireTout<{ code: string | null; date_ag: string; nature: string }>(
      (de, a) =>
        sb.from('boc_assemblees').select('code, date_ag, nature')
          .in('code', codes).gte('date_ag', suivantDebut).lte('date_ag', suivantFin)
          .order('date_ag').order('cle').range(de, a),
      'boc_assemblees',
    ),
    lireTout<{ id: string; user_id: string; sent_at: string | null }>(
      (de, a) => sb.from('monthly_reports').select('id, user_id, sent_at').eq('month', month).order('id').range(de, a),
      'monthly_reports',
    ),
  ]);

  const instruments: Record<string, InstrumentEntree> = {};
  for (const i of instrRows) instruments[i.code] = { designation: i.designation, secteur: i.secteur };
  const dividendes: DividendeEntree[] = divRows.map((d) => ({ ...d, montant: Number(d.montant) }));
  const publications: PublicationEntree[] = pubRows.map((p) => ({ date: p.date_publication, code: p.code, titre: p.libelle, type: p.type_publication }));
  const assemblees: AssembleeEntree[] = agRows;
  const existantPar = new Map(existants.map((e) => [e.user_id, e]));

  for (const userId of users) {
    try {
      const reel = posReelles.get(userId);
      const type: TypeReleve = reel ? 'reel' : 'simule';
      const positions = reel ?? posSimulees.get(userId) ?? [];
      if (positions.length === 0) { res.ignores += 1; continue; }

      const existant = existantPar.get(userId);
      if (existant?.sent_at) { res.dejaEnvoyes += 1; continue; }

      const releve = construireReleve({ mois: month, type, genereLe, positions, cours, instruments, dividendes, publications, assemblees });
      if (!releve) { res.ignores += 1; continue; }
      if (opts.dryRun) { res.generes += 1; continue; }

      if (existant) {
        const { error } = await sb.from('monthly_reports')
          .update({ report_json: releve, report_url: null, rendu_jeton_hash: null, rendu_jeton_expire: null })
          .eq('id', existant.id).is('sent_at', null);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await sb.from('monthly_reports').insert({ user_id: userId, month, report_json: releve });
        if (error) throw new Error(error.message);
      }
      res.generes += 1;
    } catch (err) {
      res.erreurs += 1;
      // Jamais de position ni de montant dans le journal : l'identifiant du compte suffit à investiguer.
      logger.error({ userId, err: err instanceof Error ? err.message : String(err) }, 'relevé mensuel : échec');
    }
  }

  res.status = res.erreurs === 0 ? 'success' : res.generes > 0 ? 'partial' : 'failed';
  res.message = `${res.generes} relevé(s) généré(s), ${res.ignores} ignoré(s), ${res.dejaEnvoyes} déjà envoyé(s), ${res.erreurs} en échec`;
  logger.info(res, 'relevés mensuels terminés');
  return res;
}
