/**
 * Faits mensuels de saisonnalité → `saisonnalite_mensuelle` (CLI `saisonnalite`).
 * Sans `--ecrire` : calcul et contrôles à blanc, rien n'est écrit.
 * Avec `--ecrire` : upsert idempotent sur (code, annee, mois), relecture, puis
 * suppression bornée des lignes que le calcul ne produit plus.
 * `--force` : passe outre le contrôle de dérive (correction de masse voulue).
 *
 * Chargement : chargerHistorique() du Conseiller — série nettoyée, ex-dates
 * reconstituées, ruptures. Rien n'est recopié.
 *
 * Conception revue par fable-advisor (2026-11-10) : `asOf` ancré sur la
 * dernière séance chargée (pas l'horloge), aucun contrôle sur un fait de marché,
 * contrôle de dérive contre la table existante, suppression des lignes périmées
 * plafonnée.
 */
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { chargerHistorique } from '../conseiller/historique.js';
import { anneesDifficiles, faitsMensuels, rdtMarche, type FaitMensuel } from './mensuel.js';

const log = logger.child({ module: 'saisonnalite' });
const LOT = 500;
const PAGE = 1000;
/** Au-delà, la suppression des lignes périmées est refusée : c'est le calcul qui a dérapé. */
export const SUPPRESSIONS_MAX = 50;

export interface Existant {
  code: string; annee: number; mois: number;
  rdt_prix: number | null; rdt_total: number | null; exclu: string | null; complet: boolean;
}
export interface Controle { nom: string; ok: boolean; detail: string }

const cle = (x: { code: string; annee: number; mois: number }) => `${x.code}|${x.annee}|${x.mois}`;
const joursEntre = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
const differe = (x: number | null, y: number | null) => (x == null) !== (y == null) || (x != null && y != null && Math.abs(x - y) > 1e-9);

/**
 * Contrôles par la donnée, AVANT toute écriture. Aucun ne porte sur un fait de
 * marché (un mois de décembre négatif est possible) : ils vérifient que le
 * calcul est complet, cohérent et ne réécrit pas le passé en silence.
 */
export function controler(
  faits: FaitMensuel[],
  o: { existants: Existant[]; detachesAttendus: number; asOf: string; aujourdhui: string; force: boolean },
): Controle[] {
  const valeurs = new Set(faits.map((f) => f.code)).size;
  const totalSousPrix = faits.filter((f) => f.rdt_total != null && f.rdt_prix != null && f.rdt_total < f.rdt_prix - 1e-9).length;
  const detaches = faits.reduce((n, f) => n + f.evenements.length, 0);
  const incomplets = faits.filter((f) => !f.complet).length;
  const age = joursEntre(o.asOf, o.aujourdhui);

  // Dérive : un mois terminé ne devrait presque jamais changer d'une exécution à l'autre.
  const parCle = new Map(faits.map((f) => [cle(f), f]));
  const termines = o.existants.filter((e) => e.complet);
  const changes = termines.filter((e) => {
    const f = parCle.get(cle(e));
    return !f || differe(e.rdt_prix, f.rdt_prix) || differe(e.rdt_total, f.rdt_total) || (e.exclu ?? null) !== (f.exclu ?? null);
  }).length;
  const partChangee = termines.length ? changes / termines.length : 0;
  const baisse = o.existants.length ? 1 - faits.length / o.existants.length : 0;
  const pct = (x: number) => `${(x * 100).toFixed(2)} %`;

  return [
    { nom: 'volume', ok: faits.length >= 5000, detail: `${faits.length} lignes` },
    {
      nom: 'pas de baisse du nombre de lignes',
      ok: o.force || baisse <= 0.01,
      detail: `${faits.length} calculées pour ${o.existants.length} en base (baisse ${pct(Math.max(0, baisse))}, plafond 1 %)${o.force ? ', --force' : ''}`,
    },
    {
      nom: 'mois terminés stables',
      ok: o.force || partChangee <= 0.02,
      detail: `${changes} mois terminés sur ${termines.length} changent (${pct(partChangee)}, plafond 2 %)${o.force ? ', --force' : ''}`,
    },
    { nom: 'total ≥ prix', ok: totalSousPrix === 0, detail: `${totalSousPrix} ligne(s) avec rdt_total < rdt_prix` },
    {
      nom: 'détachements',
      ok: detaches >= 0.9 * o.detachesAttendus,
      detail: `${detaches} retrouvés pour ${o.detachesAttendus} dividendes datés dans l’historique des cours (plancher 90 %)`,
    },
    { nom: 'mois en cours', ok: incomplets > 0 && incomplets <= valeurs, detail: `${incomplets} ligne(s) incomplète(s) pour ${valeurs} valeurs` },
    { nom: 'fraîcheur des cours', ok: age >= 0 && age <= 4, detail: `dernière séance ${o.asOf}, ${age} jour(s) avant le ${o.aujourdhui} (plafond 4)` },
  ];
}

async function lireExistants(): Promise<Existant[]> {
  const sb = getSupabase();
  const out: Existant[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('saisonnalite_mensuelle')
      .select('code, annee, mois, rdt_prix, rdt_total, exclu, complet')
      .order('code').order('annee').order('mois')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`lecture saisonnalite_mensuelle : ${error.message}`);
    const lot = (data ?? []) as Existant[];
    for (const r of lot) {
      out.push({ ...r, rdt_prix: r.rdt_prix == null ? null : Number(r.rdt_prix), rdt_total: r.rdt_total == null ? null : Number(r.rdt_total) });
    }
    if (lot.length < PAGE) break;
  }
  return out;
}

export interface ResultatSaisonnalite {
  lignes: number;
  valeurs: number;
  detachements: number;
  supprimees: number;
  asOf: string;
  controles: Controle[];
}

export async function runSaisonnalite(ecrire: boolean, force = false): Promise<ResultatSaisonnalite> {
  const { donnees } = await chargerHistorique();
  // Ancré sur la DERNIÈRE SÉANCE chargée, jamais sur l'horloge : un passage
  // avant la première séance d'un mois ne doit pas croire le mois commencé.
  const asOf = donnees.calendrier[donnees.calendrier.length - 1];
  if (!asOf) throw new Error('aucune séance chargée');

  const faits: FaitMensuel[] = [];
  let detachesAttendus = 0;
  for (const [code, serie] of donnees.series) {
    const dividendes = donnees.dividendes.filter((d) => d.code === code);
    const comptes = donnees.comptes.filter((c) => c.code === code);
    const debut = serie.dates[0];
    if (debut) detachesAttendus += dividendes.filter((d) => d.exDate != null && d.montant > 0 && d.exDate > debut && d.exDate <= asOf).length;
    faits.push(...faitsMensuels({
      code,
      serie,
      calendrier: donnees.calendrier,
      dividendes,
      ruptures: donnees.ruptures.get(code) ?? new Set(),
      anneesDifficiles: anneesDifficiles(comptes, dividendes),
      asOf,
    }));
  }
  const marche = rdtMarche(faits);
  for (const f of faits) f.rdt_marche = marche.get(`${f.annee}-${String(f.mois).padStart(2, '0')}`) ?? null;

  const existants = await lireExistants();
  const controles = controler(faits, { existants, detachesAttendus, asOf, aujourdhui: new Date().toISOString().slice(0, 10), force });
  const r: ResultatSaisonnalite = {
    lignes: faits.length,
    valeurs: new Set(faits.map((f) => f.code)).size,
    detachements: faits.reduce((n, f) => n + f.evenements.length, 0),
    supprimees: 0,
    asOf,
    controles,
  };
  for (const c of controles) {
    if (c.ok) log.info({ controle: c.nom, detail: c.detail }, 'contrôle OK');
    else log.error({ controle: c.nom, detail: c.detail }, 'contrôle ÉCHOUÉ');
  }
  if (controles.some((c) => !c.ok)) throw new Error(`contrôles échoués : ${controles.filter((c) => !c.ok).map((c) => c.nom).join(', ')}`);

  if (!ecrire) {
    log.info({ lignes: r.lignes, valeurs: r.valeurs, asOf }, 'à blanc : rien écrit (relancer avec --ecrire)');
    return r;
  }
  const sb = getSupabase();
  const maj = new Date().toISOString();
  for (let i = 0; i < faits.length; i += LOT) {
    const lot = faits.slice(i, i + LOT).map((f) => ({ ...f, maj }));
    const { error } = await sb.from('saisonnalite_mensuelle').upsert(lot, { onConflict: 'code,annee,mois' });
    if (error) throw new Error(`upsert saisonnalite_mensuelle (lot ${i}) : ${error.message}`);
  }

  // Lignes que le calcul ne produit plus (cours purgé, valeur retirée) : leur
  // `maj` est antérieur à ce passage. Suppression bornée et journalisée.
  const { data: perimees, error: ePer } = await sb.from('saisonnalite_mensuelle').select('code, annee, mois').lt('maj', maj);
  if (ePer) throw new Error(`lecture des lignes périmées : ${ePer.message}`);
  const aSupprimer = (perimees ?? []) as { code: string; annee: number; mois: number }[];
  if (aSupprimer.length > SUPPRESSIONS_MAX) {
    throw new Error(`${aSupprimer.length} lignes périmées (plafond ${SUPPRESSIONS_MAX}) : suppression refusée, calcul à examiner`);
  }
  if (aSupprimer.length > 0) {
    const { error: eDel } = await sb.from('saisonnalite_mensuelle').delete().lt('maj', maj);
    if (eDel) throw new Error(`suppression des lignes périmées : ${eDel.message}`);
    log.warn({ cles: aSupprimer.map(cle) }, 'lignes périmées supprimées');
  }
  r.supprimees = aSupprimer.length;

  // Relecture : la table doit compter exactement les lignes écrites.
  const { count, error } = await sb.from('saisonnalite_mensuelle').select('code', { count: 'exact', head: true });
  if (error) throw new Error(`relecture : ${error.message}`);
  if (count !== faits.length) throw new Error(`relecture : ${count} lignes en base pour ${faits.length} écrites`);
  log.info({ lignes: faits.length, enBase: count, supprimees: r.supprimees, asOf }, 'saisonnalité écrite');
  return r;
}
