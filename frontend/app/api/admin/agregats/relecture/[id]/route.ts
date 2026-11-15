import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/server/adminApi';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { planAction, uniteCorrection, type ActionRelecture } from '@/lib/admin/relecture';
import { rejouerSelectionBanque } from '@/lib/admin/rejouerSelection';

export const dynamic = 'force-dynamic';

/**
 * Décision de relecture d'un agrégat bancaire : valider, corriger ou rejeter.
 * La décision s'applique IMMÉDIATEMENT (avenant du 2026-11-15) : après le
 * changement d'état des observations et la clôture de l'élément, la sélection
 * est rejouée pour cette banque seule et la valeur retenue est écrite.
 * Si cette application échoue, la réponse est 500 avec le motif : la
 * décision reste enregistrée et le cron hebdomadaire la réappliquera.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireAdminApi('content.write');
  if ('error' in g) return g.error;
  const { id } = await ctx.params;
  const corps = (await req.json().catch(() => null)) as ActionRelecture | null;
  if (!corps || !['valider', 'corriger', 'rejeter'].includes(corps.action)) {
    return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
  }

  const db = getServiceClient();
  const { data: item, error } = await db.from('indicateur_relecture')
    .select('id,code,indicateur,periode,date_arrete,observations,statut').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: `Lecture impossible : ${error.message}` }, { status: 500 });
  if (!item) return NextResponse.json({ error: 'Élément introuvable.' }, { status: 404 });
  if (item.statut !== 'ouverte') return NextResponse.json({ error: 'Élément déjà traité.' }, { status: 409 });

  let plan;
  try {
    plan = planAction({ observations: item.observations as string[] }, corps);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  const maintenant = new Date().toISOString();
  if (plan.correction) {
    const { data: avant, error: eA } = await db.from('indicateur_source').select('texte_original,devise_source').eq('id', plan.correction.observation).maybeSingle();
    if (eA || !avant) return NextResponse.json({ error: 'Observation introuvable.' }, { status: 500 });
    // Unité : % pour un ratio, sinon la devise PUBLIÉE (USD pour ETIT), jamais convertie.
    const unite = uniteCorrection(item.indicateur as string, (avant.devise_source as string | null) ?? null);
    const { error: eC } = await db.from('indicateur_source').update({
      statut: 'publie', valeur: plan.correction.valeur, texte_original: plan.correction.texte, decimales: plan.correction.decimales,
      unite, unite_source: unite === 'pct' ? 'pct' : 'unites', motif: null,
      commentaire: `Lu « ${avant.texte_original ?? '—'} », corrigé en relecture.`,
    }).eq('id', plan.correction.observation);
    if (eC) return NextResponse.json({ error: `Correction impossible : ${eC.message}` }, { status: 500 });
  }
  if (plan.valides.length) {
    const { error: eV } = await db.from('indicateur_source').update({ controle: 'valide', verifie_par: 'relecture-admin', verifie_le: maintenant }).in('id', plan.valides);
    if (eV) return NextResponse.json({ error: `Validation impossible : ${eV.message}` }, { status: 500 });
  }
  if (plan.rejetees.length) {
    const { error: eR } = await db.from('indicateur_source').update({ controle: 'rejete', verifie_par: 'relecture-admin', verifie_le: maintenant }).in('id', plan.rejetees);
    if (eR) return NextResponse.json({ error: `Rejet impossible : ${eR.message}` }, { status: 500 });
  }
  const { error: eI } = await db.from('indicateur_relecture')
    .update({ statut: plan.statut, valeur_corrigee: plan.valeurCorrigee, traite_le: maintenant }).eq('id', id).eq('statut', 'ouverte');
  if (eI) return NextResponse.json({ error: `Clôture impossible : ${eI.message}` }, { status: 500 });

  // Application immédiate : rejouer la sélection pour cette banque.
  let application: { ecrites: number; ouvertes: number } | null = null;
  let echecApplication: string | null = null;
  try {
    application = await rejouerSelectionBanque(db, item.code as string);
  } catch (e) {
    echecApplication = (e as Error).message.slice(0, 300);
  }

  await recordAudit(g.ctx, {
    action: `agregat.relecture.${corps.action}`,
    resourceType: 'indicateur_relecture',
    resourceId: id,
    severity: echecApplication ? 'warning' : 'info',
    metadata: {
      code: item.code, indicateur: item.indicateur, periode: item.periode, date_arrete: item.date_arrete,
      valides: plan.valides, rejetees: plan.rejetees, valeur_corrigee: plan.valeurCorrigee,
      application: application ?? { echec: echecApplication },
    },
  });

  if (echecApplication) {
    return NextResponse.json({
      error: `Décision enregistrée, mais son application a échoué (${echecApplication}). Le prochain passage du cron « Comptes intermédiaires » la réappliquera.`,
    }, { status: 500 });
  }
  return NextResponse.json({ ok: true, statut: plan.statut, ...application });
}
