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
import { timingSafeEqual } from 'node:crypto';
import { chargerReglages } from '@/lib/crm/reglagesServeur';
import { chargerDossiers } from '@/lib/crm/charger';
import { selectionnerPassage, cleJournal } from '@/lib/crm/sequences';
import { composerRelance } from '@/lib/crm/gabarits';
import { envoyerRelanceEmail } from '@/lib/crm/envoiRelance';
import { alerterExploitant } from '@/lib/server/alerteExploitant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function autorise(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!secret || !bearer) return false;
  const a = Buffer.from(secret, 'utf8');
  const b = Buffer.from(bearer, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

type Issue = 'envoye' | 'simulation' | 'echec' | 'refus';
const issueVide = (): Record<Issue, number> => ({ envoye: 0, simulation: 0, echec: 0, refus: 0 });

export async function GET() {
  return NextResponse.json({ error: 'Méthode non autorisée' }, { status: 405, headers: { Allow: 'POST' } });
}

export async function POST(req: Request) {
  if (!autorise(req)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const reglages = await chargerReglages();
  if (reglages.mode_sequences === 'off') return NextResponse.json({ mode: 'off', traites: 0 });
  const simulation = reglages.mode_sequences === 'simulation';

  // Capturé AVANT le chargement : un paiement postérieur doit bloquer l'envoi.
  const chargeLe = new Date().toISOString();
  const maintenant = new Date();
  let passage: ReturnType<typeof selectionnerPassage>;
  try {
    passage = selectionnerPassage(await chargerDossiers(), reglages, maintenant);
  } catch (e) {
    console.error('[crm-sequences] chargement impossible :', (e as Error).name);
    await alerterExploitant('Séquences CRM : chargement des dossiers impossible, rien n\'a été traité.', '⚠️ CRM');
    return NextResponse.json({ mode: reglages.mode_sequences, erreur: 'chargement' }, { status: 500 });
  }

  const parSequence: Record<string, Record<Issue, number>> = {};
  for (const { d, etape } of passage) {
    const c = (parSequence[etape.sequence] ??= issueVide());
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
    c[issue]++;
  }

  const total = Object.values(parSequence).reduce((n, c) => n + c.envoye + c.simulation + c.echec + c.refus, 0);
  const somme = (k: Issue) => Object.values(parSequence).reduce((n, c) => n + c[k], 0);
  const echecs = somme('echec');
  if (somme('envoye') + somme('simulation') + echecs > 0) {
    await alerterExploitant(
      `Séquences CRM (${reglages.mode_sequences}, ${maintenant.toISOString().slice(0, 10)}) : ${somme('envoye')} envoyée(s), ${somme('simulation')} simulée(s), ${echecs} en échec, ${somme('refus')} refusée(s).`,
      echecs > 0 ? '⚠️ CRM' : '✉️ CRM',
    );
  }
  return NextResponse.json({ mode: reglages.mode_sequences, traites: total, sequences: parSequence }, { status: echecs > 0 ? 500 : 200 });
}
