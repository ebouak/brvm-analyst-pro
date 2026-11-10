/**
 * Faits mensuels de saisonnalité → `saisonnalite_mensuelle` (CLI `saisonnalite`).
 * Sans `--ecrire` : calcul et contrôles à blanc, rien n'est écrit.
 * Avec `--ecrire` : upsert idempotent sur (code, annee, mois), puis relecture.
 *
 * Chargement : chargerHistorique() du Conseiller — série nettoyée, ex-dates
 * reconstituées, ruptures. Rien n'est recopié.
 */
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { chargerHistorique } from '../conseiller/historique.js';
import { anneesDifficiles, faitsMensuels, rdtMarche, type FaitMensuel } from './mensuel.js';

const log = logger.child({ module: 'saisonnalite' });
const LOT = 500;

export interface ResultatSaisonnalite {
  lignes: number;
  valeurs: number;
  detachements: number;
  controles: { nom: string; ok: boolean; detail: string }[];
}

/** Contrôles par la donnée (plan, T6). Un échec fait sortir la commande en erreur. */
export function controler(faits: FaitMensuel[], dividendesDates: number): ResultatSaisonnalite['controles'] {
  const totalSousPrix = faits.filter((f) => f.rdt_total != null && f.rdt_prix != null && f.rdt_total < f.rdt_prix - 1e-9).length;
  const detaches = faits.reduce((n, f) => n + f.evenements.length, 0);
  const dec = faits.filter((f) => f.mois === 12 && f.complet && f.rdt_marche != null);
  const parAnnee = new Map(dec.map((f) => [f.annee, f.rdt_marche!]));
  const moyDec = parAnnee.size ? [...parAnnee.values()].reduce((a, b) => a + b, 0) / parAnnee.size : NaN;
  const incomplets = faits.filter((f) => !f.complet).length;
  const valeurs = new Set(faits.map((f) => f.code)).size;
  return [
    { nom: 'volume', ok: faits.length >= 5000, detail: `${faits.length} lignes (≈ 9 000 attendues)` },
    { nom: 'total ≥ prix', ok: totalSousPrix === 0, detail: `${totalSousPrix} ligne(s) avec rdt_total < rdt_prix` },
    { nom: 'détachements', ok: detaches >= Math.min(100, dividendesDates), detail: `${detaches} retrouvés sur ${dividendesDates} dividendes datés` },
    { nom: 'décembre du marché', ok: Number.isFinite(moyDec) && moyDec > 0, detail: `moyenne ${(moyDec * 100).toFixed(2)} % sur ${parAnnee.size} ans (≈ +3,5 % attendu)` },
    { nom: 'mois en cours', ok: incomplets > 0 && incomplets <= valeurs, detail: `${incomplets} ligne(s) incomplète(s) pour ${valeurs} valeurs` },
  ];
}

export async function runSaisonnalite(ecrire: boolean, asOf = new Date().toISOString().slice(0, 10)): Promise<ResultatSaisonnalite> {
  const { donnees } = await chargerHistorique();
  const faits: FaitMensuel[] = [];
  for (const [code, serie] of donnees.series) {
    const dividendes = donnees.dividendes.filter((d) => d.code === code);
    const comptes = donnees.comptes.filter((c) => c.code === code);
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

  const dates = donnees.dividendes.filter((d) => d.exDate != null && d.exDate <= asOf).length;
  const controles = controler(faits, dates);
  const r: ResultatSaisonnalite = {
    lignes: faits.length,
    valeurs: new Set(faits.map((f) => f.code)).size,
    detachements: faits.reduce((n, f) => n + f.evenements.length, 0),
    controles,
  };
  for (const c of controles) {
    if (c.ok) log.info({ controle: c.nom, detail: c.detail }, 'contrôle OK');
    else log.error({ controle: c.nom, detail: c.detail }, 'contrôle ÉCHOUÉ');
  }
  if (controles.some((c) => !c.ok)) throw new Error(`contrôles échoués : ${controles.filter((c) => !c.ok).map((c) => c.nom).join(', ')}`);

  if (!ecrire) {
    log.info({ lignes: r.lignes, valeurs: r.valeurs }, 'à blanc : rien écrit (relancer avec --ecrire)');
    return r;
  }
  const sb = getSupabase();
  const maj = new Date().toISOString();
  for (let i = 0; i < faits.length; i += LOT) {
    const lot = faits.slice(i, i + LOT).map((f) => ({ ...f, maj }));
    const { error } = await sb.from('saisonnalite_mensuelle').upsert(lot, { onConflict: 'code,annee,mois' });
    if (error) throw new Error(`upsert saisonnalite_mensuelle (lot ${i}) : ${error.message}`);
  }
  // Relecture : la table doit compter au moins les lignes écrites.
  const { count, error } = await sb.from('saisonnalite_mensuelle').select('code', { count: 'exact', head: true });
  if (error) throw new Error(`relecture : ${error.message}`);
  if ((count ?? 0) < faits.length) throw new Error(`relecture : ${count} lignes en base pour ${faits.length} écrites`);
  log.info({ lignes: faits.length, enBase: count }, 'saisonnalité écrite');
  return r;
}
