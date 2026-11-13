// POST /api/cron/controle-boc — contrôle quotidien des écarts avec le Bulletin
// Officiel de la Cote (BRVM).
//
// Recalcule le PER et le rendement du site au cours de référence du bulletin,
// avec les MÊMES règles que la fiche société (pickBestFundamental,
// dividendePourRendement), et alerte l'exploitant au-delà de 3 % d'écart.
// Rien n'est corrigé : un écart se vérifie sur les états financiers.
//
// Auth : bearer CRON_SECRET, comparé à temps constant (lib/server/cronAuth).
// Aucune panne silencieuse : base illisible ou bulletin périmé ⇒ 500 + alerte.
import { NextResponse } from 'next/server';
import { cronAutorise } from '@/lib/server/cronAuth';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { alerterExploitant } from '@/lib/server/alerteExploitant';
import { controleBoc } from '@/lib/boc/charger';
import { resumer, messageAlerte } from '@/lib/boc/ecarts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Au-delà, le bulletin n'a pas été collecté : quatre jours couvrent un week-end prolongé. */
const FRAICHEUR_MAX_JOURS = 4;

export async function GET() {
  return NextResponse.json({ error: 'Méthode non autorisée' }, { status: 405, headers: { Allow: 'POST' } });
}

export async function POST(req: Request) {
  if (!cronAutorise(req)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  let controles;
  try {
    controles = await controleBoc(getServiceClient());
  } catch (e) {
    console.error('[controle-boc] lecture impossible :', (e as Error).message);
    await alerterExploitant('Contrôle BOC : données illisibles, contrôle NON exécuté.', '⚠️ BOC');
    return NextResponse.json({ erreur: 'lecture' }, { status: 500 });
  }

  if (!controles.length) {
    await alerterExploitant('Contrôle BOC : aucune cote officielle en base (collecte boc:cote jamais passée ?).', '⚠️ BOC');
    return NextResponse.json({ erreur: 'vide' }, { status: 500 });
  }

  const resume = resumer(controles);
  const age = resume.dateSeance ? (Date.now() - Date.parse(resume.dateSeance)) / 86_400_000 : Infinity;
  if (age > FRAICHEUR_MAX_JOURS) {
    await alerterExploitant(`Contrôle BOC : dernier bulletin collecté le ${resume.dateSeance}, collecte en retard.`, '⚠️ BOC');
    return NextResponse.json({ erreur: 'perime', resume }, { status: 500 });
  }

  const message = messageAlerte(resume, controles);
  const alerte = message ? await alerterExploitant(message, '🔎 BOC') : false;
  return NextResponse.json({ resume, alerte });
}
