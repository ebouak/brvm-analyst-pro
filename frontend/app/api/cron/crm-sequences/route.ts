// POST /api/cron/crm-sequences — relances automatiques du CRM (e-mail uniquement).
//
// Mode (crm_reglages.mode_sequences, réglé dans /admin/crm › Réglages) :
//   off         : ne fait RIEN (défaut, et repli si les réglages sont illisibles) ;
//   simulation  : journalise ce qui PARTIRAIT (statut « simulation »), n'envoie rien ;
//   actif       : envoie.
// Chaque envoi passe par envoyerRelanceEmail (opposition, éligibilité, paiement
// revérifié, anti-doublon, index unique par étape). Séquentiel, plafonné.
//
// Auth : bearer CRON_SECRET, comparé à temps constant (comme dossier-polish).
// Aucune donnée personnelle dans les réponses, les journaux ni l'alerte : des
// comptes seulement.
import { NextResponse } from 'next/server';
import { chargerReglages } from '@/lib/crm/reglagesServeur';
import { chargerDossiers } from '@/lib/crm/charger';
import { selectionnerPassage, cleJournal, PREFIXE_SIMULATION } from '@/lib/crm/sequences';
import { composerRelance } from '@/lib/crm/gabarits';
import { envoyerRelanceEmail } from '@/lib/crm/envoiRelance';
import { autorise, issueVide, resumer, restantAujourdhui, debutJourUtc, type Issue } from '@/lib/crm/passageSequences';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { alerterExploitant } from '@/lib/server/alerteExploitant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Au-delà, on s'arrête proprement : le reste est « reporté » au passage suivant (maxDuration = 300 s). */
const BUDGET_MS = 240_000;

export async function GET() {
  return NextResponse.json({ error: 'Méthode non autorisée' }, { status: 405, headers: { Allow: 'POST' } });
}

/** Étapes déjà traitées aujourd'hui (UTC) pour ce mode ; null si la base ne répond pas. */
async function dejaAujourdhui(simulation: boolean, maintenant: Date): Promise<number | null> {
  try {
    let q = getServiceClient().from('crm_actions').select('id', { count: 'exact', head: true }).gte('created_at', debutJourUtc(maintenant));
    q = simulation
      ? q.like('sequence_cle', `${PREFIXE_SIMULATION}%`)
      : q.not('sequence_cle', 'is', null).not('sequence_cle', 'like', `${PREFIXE_SIMULATION}%`).in('statut', ['envoye', 'envoi', 'echec']);
    const { count, error } = await q;
    return error || count === null ? null : count;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  if (!autorise(process.env.CRON_SECRET, req.headers.get('authorization'))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const reglages = await chargerReglages();
  if (reglages.mode_sequences === 'off') return NextResponse.json({ mode: 'off', traites: 0 });
  const simulation = reglages.mode_sequences === 'simulation';
  const debut = Date.now();

  // Capturé AVANT le chargement : un paiement postérieur doit bloquer l'envoi.
  const chargeLe = new Date().toISOString();
  const maintenant = new Date();
  const parSequence: Record<string, Record<Issue, number>> = {};
  const compter = (sequence: string, issue: Issue, n = 1) => { (parSequence[sequence] ??= issueVide())[issue] += n; };

  // Plafond QUOTIDIEN (le cron peut être relancé à la main) : illisible => rien ne part.
  const deja = await dejaAujourdhui(simulation, maintenant);
  let passage: ReturnType<typeof selectionnerPassage> = [];
  if (deja === null) compter('plafond', 'indisponible');
  else {
    try {
      passage = selectionnerPassage(await chargerDossiers(), { ...reglages, plafond_par_execution: restantAujourdhui(reglages.plafond_par_execution, deja) }, maintenant);
    } catch (e) {
      console.error('[crm-sequences] chargement impossible :', (e as Error).name);
      compter('chargement', 'indisponible');
    }
  }

  for (const { d, etape } of passage) {
    if (Date.now() - debut > BUDGET_MS) { compter(etape.sequence, 'reporte'); continue; }
    let issue: Issue;
    try {
      const { sujet, corps } = composerRelance(etape.templateId, d);
      const r = await envoyerRelanceEmail({
        d, sujet: sujet.replace(/[\r\n]+/g, ' ').trim().slice(0, 150), corps: corps.trim().slice(0, 5000),
        templateId: etape.templateId, inclureOffre: true, auteur: null,
        sequenceCle: cleJournal(etape.cle, simulation), simulation, chargeLe,
      });
      issue = r.statut;
    } catch (e) {
      // Une exception ne doit ni arrêter le passage ni laisser croire à un succès.
      console.error('[crm-sequences] exception sur une étape :', (e as Error).name);
      issue = 'echec';
    }
    compter(etape.sequence, issue);
  }

  const r = resumer(parSequence);
  if (r.alerter) {
    const p = r.parIssue;
    await alerterExploitant(
      `Séquences CRM (${reglages.mode_sequences}, ${maintenant.toISOString().slice(0, 10)}) : ${p.envoye} envoyée(s), ${p.simulation} simulée(s), ${p.echec} en échec, ${p.indisponible} indisponible(s), ${p.refus} refusée(s), ${p.reporte} reportée(s).`,
      r.http === 500 ? '⚠️ CRM' : '✉️ CRM',
    );
  }
  return NextResponse.json({ mode: reglages.mode_sequences, traites: r.total, sequences: parSequence }, { status: r.http });
}
