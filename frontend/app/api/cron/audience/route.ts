// POST /api/cron/audience?periode=jour|semaine|mois — checks et rapports d'audience.
//   jour    : la veille contre la moyenne des 7 jours précédents -> message court à l'exploitant
//             (Telegram/console), tous les jours ; ⚠️ si baisse anormale.
//   semaine / mois : e-mail HTML (ALERTS_EMAIL_TO) avec chiffres clés, Afrique/UEMOA, pages,
//             entonnoir Academy, intérêt formation et lien vers le rapport imprimable.
// Échec PostHog, destinataire absent ou envoi refusé : 500, jamais un succès silencieux.
// Auth : bearer CRON_SECRET, temps constant. Journaux : codes seulement. Agrégats seulement.
import { NextResponse } from 'next/server';
import { autorise } from '@/lib/crm/passageSequences';
import { alerterExploitant } from '@/lib/server/alerteExploitant';
import { sendEmail } from '@/lib/server/email';
import { bornesPeriode, libelleFenetre } from '@/lib/audience/periodes';
import { chargerAudience, chargerSerieJours } from '@/lib/audience/indicateurs';
import { analyseJour, blocsIndisponibles, classeErreur, decisionJour, MESSAGE_SERIE_VIDE, messageJour, serieVide } from '@/lib/audience/resume';
import { construireEmailRapport } from '@/lib/audience/emailRapport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const SITE = 'https://www.westbourse.com';

export async function GET() {
  return NextResponse.json({ error: 'Méthode non autorisée' }, { status: 405, headers: { Allow: 'POST' } });
}

export async function POST(req: Request) {
  if (!autorise(process.env.CRON_SECRET, req.headers.get('authorization'))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const periode = new URL(req.url).searchParams.get('periode');
  const maintenant = new Date();

  if (periode === 'jour') {
    const b = bornesPeriode('jour', maintenant);
    let serie;
    try {
      serie = await chargerSerieJours(b.fin, 8);
    } catch (e) {
      const classe = classeErreur(e);
      console.error('[cron audience] jour :', classe);
      await alerterExploitant(`Check d'audience impossible (erreur ${classe}).`, '⚠️ Audience');
      return NextResponse.json({ periode, erreur: classe }, { status: 500 });
    }
    if (serieVide(serie)) {
      // Aucun événement en 8 jours : l'ingestion est cassée, ce n'est pas « une journée calme ».
      console.error('[cron audience] série vide');
      await alerterExploitant(MESSAGE_SERIE_VIDE, '⚠️ Audience');
      return NextResponse.json({ periode, erreur: 'serie_vide' }, { status: 500 });
    }
    const analyse = analyseJour(serie, b.debut.toISOString().slice(0, 10));
    const { titre, texte } = messageJour(analyse);
    const notifie = await alerterExploitant(texte, titre);
    const d = decisionJour(serie, notifie);
    if (d.http !== 200) console.error('[cron audience] notification non livrée');
    return NextResponse.json({ periode, jour: analyse.jour.jour, personnes: analyse.jour.personnes, baisse: analyse.baisse, notifie, ...(d.erreur ? { erreur: d.erreur } : {}) }, { status: d.http });
  }

  if (periode === 'semaine' || periode === 'mois') {
    const destinataire = process.env.ALERTS_EMAIL_TO;
    if (!destinataire) {
      console.error('[cron audience] ALERTS_EMAIL_TO absent');
      await alerterExploitant(`Rapport d'audience ${periode} NON envoyé : ALERTS_EMAIL_TO non configuré.`, '⚠️ Audience');
      return NextResponse.json({ periode, erreur: 'destinataire_absent' }, { status: 500 });
    }
    try {
      const b = bornesPeriode(periode, maintenant);
      const a = await chargerAudience(b);
      // Sans les chiffres généraux, un rapport n'a pas de sens : on échoue plutôt que d'envoyer un rapport vide.
      if (!a.overview.ok) {
        const code = a.overview.erreur.replace(/_.*/, '');
        console.error('[cron audience] chiffres généraux indisponibles :', a.overview.erreur);
        await alerterExploitant(`Rapport d'audience ${periode} NON envoyé : chiffres généraux indisponibles (erreur ${code}).`, '⚠️ Audience');
        return NextResponse.json({ periode, erreur: a.overview.erreur }, { status: 500 });
      }
      const manquants = blocsIndisponibles(a);
      const mail = construireEmailRapport({ periode, libelleFenetre: libelleFenetre(b), a, lien: `${SITE}/admin/audience/rapport?periode=${periode}` });
      const r = await sendEmail({ to: destinataire, subject: mail.sujet, html: mail.html, text: mail.text });
      if (!r.ok) {
        console.error('[cron audience] envoi refusé');
        await alerterExploitant(`Rapport d'audience ${periode} : envoi e-mail en échec.`, '⚠️ Audience');
        return NextResponse.json({ periode, erreur: 'envoi' }, { status: 500 });
      }
      if (manquants.length > 0) {
        // Le rapport part, mais incomplet : on le dit à l'exploitant au lieu de le laisser croire complet.
        await alerterExploitant(`Rapport d'audience ${periode} envoyé INCOMPLET — blocs indisponibles : ${manquants.join(', ')}.`, '⚠️ Audience');
      }
      return NextResponse.json({ periode, envoye: true, blocsIndisponibles: manquants });
    } catch (e) {
      const classe = classeErreur(e);
      console.error('[cron audience] rapport :', classe);
      await alerterExploitant(`Rapport d'audience ${periode} NON envoyé (erreur ${classe}).`, '⚠️ Audience');
      return NextResponse.json({ periode, erreur: classe }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'periode invalide (jour|semaine|mois)' }, { status: 400 });
}
