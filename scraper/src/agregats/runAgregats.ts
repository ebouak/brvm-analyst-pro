/**
 * Orchestration des agrégats bancaires.
 *
 *   runAgregatsBancaires — cron hebdomadaire (interim.yml) : lit les
 *     publications nouvelles, insère leurs observations, sélectionne, et
 *     alerte l'exploitant si la file de relecture n'est pas vide.
 *   runRepriseAgregats — reprise de l'historique :
 *     * À BLANC par défaut : relit TOUS les documents, n'écrit RIEN en base,
 *       produit un rapport JSON + Markdown ;
 *     * --ecrire --depuis-rapport=<fichier> : insère les observations DU
 *       RAPPORT approuvé (aucune relecture de PDF) puis sélectionne.
 *
 * Les décisions de relecture, elles, s'appliquent IMMÉDIATEMENT depuis
 * /admin/agregats (frontend/lib/admin/rejouerSelection.ts) : le cron les
 * retrouve déjà appliquées.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { sendTelegramText } from '../alerts/channels.js';
import { extraireAgregats } from './runExtraction.js';
import { selectionnerAgregats } from './runSelectionAgregats.js';
import { construireRapport, rapportTexte, type RapportReprise } from './rapport.js';
import { messageFile } from './alerte.js';
import type { ObservationNouvelle } from './normaliser.js';
import type { ObsLue } from './ecritures.js';

const log = logger.child({ module: 'agregats' });

export interface ResultatAgregats {
  documents: number;
  observations: number;
  echecs: number;
  ecrites: number;
  aRelire: number;
  alerteEnvoyee: boolean;
}

async function banques(codes: string[]): Promise<string[]> {
  const { data, error } = await getSupabase().from('brvm_instruments').select('code').eq('type', 'action').eq('famille_comptable', 'banque');
  if (error) throw new Error(`brvm_instruments : ${error.message}`);
  const toutes = (data ?? []).map((r) => r.code as string);
  return codes.length ? toutes.filter((c) => codes.includes(c)) : toutes;
}

async function inserer(obs: ObservationNouvelle[]): Promise<void> {
  const sb = getSupabase();
  for (let i = 0; i < obs.length; i += 200) {
    const { error } = await sb.from('indicateur_source')
      .upsert(obs.slice(i, i + 200), { onConflict: 'code,indicateur,date_arrete,perimetre,document_url', ignoreDuplicates: true });
    if (error) throw new Error(`indicateur_source (insertion) : ${error.message}`);
  }
}

export async function runAgregatsBancaires(opts: { mock: boolean; codes: string[] }): Promise<ResultatAgregats> {
  if (opts.mock) return { documents: 0, observations: 0, echecs: 0, ecrites: 0, aRelire: 0, alerteEnvoyee: false };
  const codes = await banques(opts.codes);
  const ex = await extraireAgregats({ codes, reprise: false });
  await inserer(ex.observations);
  const sel = await selectionnerAgregats({ dryRun: false, codes });

  const { data: ouvertes, error } = await getSupabase().from('indicateur_relecture').select('code').eq('statut', 'ouverte');
  if (error) throw new Error(`indicateur_relecture : ${error.message}`);
  const message = messageFile((ouvertes ?? []) as { code: string }[]);
  let alerteEnvoyee = false;
  if (message) {
    const r = await sendTelegramText({ ...message, operateur: true });
    if (!r || r.status !== 'sent') throw new Error(`alerte Telegram non envoyée : ${r ? r.error ?? r.status : 'TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID absent'}`);
    alerteEnvoyee = true;
  }
  const res = { documents: ex.documents.length, observations: ex.observations.length, echecs: ex.echecs, ecrites: sel.ecrites, aRelire: ouvertes?.length ?? 0, alerteEnvoyee };
  log.info(res, 'agrégats bancaires');
  return res;
}

export async function runRepriseAgregats(opts: { codes: string[]; ecrire: boolean; depuisRapport: string | null; rapport: string; fixtures: string | null }): Promise<{ rapport: RapportReprise | null; echecs: number; ecrites: number }> {
  const codes = await banques(opts.codes);
  if (opts.ecrire) {
    if (!opts.depuisRapport) throw new Error('--ecrire exige --depuis-rapport=<fichier> : on n’écrit que ce que l’exploitant a approuvé');
    const approuve = JSON.parse(readFileSync(opts.depuisRapport, 'utf8')) as RapportReprise;
    if (approuve.version !== 1) throw new Error(`rapport de version ${String(approuve.version)} non pris en charge`);
    if (approuve.avertissements?.length) throw new Error(`rapport produit avec réserves (${approuve.avertissements.join(' ; ')}) : le régénérer avant d’écrire`);
    const obs = approuve.observations.filter((o) => codes.includes(o.code));
    await inserer(obs);
    const sel = await selectionnerAgregats({ dryRun: false, codes });
    log.info({ inserees: obs.length, ecrites: sel.ecrites, aRelire: sel.relecturesOuvertes }, 'reprise écrite depuis le rapport approuvé');
    return { rapport: null, echecs: 0, ecrites: sel.ecrites };
  }

  const ex = await extraireAgregats({ codes, reprise: true, fixtures: opts.fixtures });
  const plan = await selectionnerAgregats({ dryRun: true, codes, enMemoire: ex.observations as unknown as ObsLue[] });
  const { ecrites: _e, relecturesOuvertes: _r, avertissements: avSel, ...planSeul } = plan;
  const avertissements = [...new Set([...ex.avertissements, ...avSel])];
  const rapport = construireRapport(new Date().toISOString(), ex.documents, ex.observations, planSeul, avertissements);
  mkdirSync(dirname(opts.rapport), { recursive: true });
  writeFileSync(opts.rapport, JSON.stringify(rapport, null, 2));
  writeFileSync(opts.rapport.replace(/\.json$/, '.md'), rapportTexte(rapport));
  log.info({ rapport: opts.rapport, ...rapport.totaux }, 'reprise À BLANC — rien n’a été écrit');
  return { rapport, echecs: ex.echecs, ecrites: 0 };
}
