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
import { codeErreur } from '@/lib/audience/posthogQuery';
import { analyseJour, messageJour } from '@/lib/audience/resume';
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
    try {
      const serie = await chargerSerieJours(b.fin, 8);
      const analyse = analyseJour(serie, b.debut.toISOString().slice(0, 10));
      const { titre, texte } = messageJour(analyse);
      const envoye = await alerterExploitant(texte, titre);
      return NextResponse.json({ periode, jour: analyse.jour.jour, personnes: analyse.jour.personnes, baisse: analyse.baisse, notifie: envoye });
    } catch (e) {
      console.error('[cron audience] jour :', codeErreur(e));
      await alerterExploitant('Check d\'audience impossible : PostHog injoignable.', '⚠️ Audience');
      return NextResponse.json({ periode, erreur: codeErreur(e) }, { status: 500 });
    }
  }

  if (periode === 'semaine' || periode === 'mois') {
    const destinataire = process.env.ALERTS_EMAIL_TO;
    if (!destinataire) {
      console.error('[cron audience] ALERTS_EMAIL_TO absent');
      await alerterExploitant(`Rapport d'audience ${periode} NON envoyé : ALERTS_EMAIL_TO non configuré.`, '⚠️ Audience');
      return NextResponse.json({ periode, erreur: 'destinataire_absent' }, { status: 500 });
    }
    const b = bornesPeriode(periode, maintenant);
    const a = await chargerAudience(b);
    // Sans les chiffres généraux, un rapport n'a pas de sens : on échoue plutôt que d'envoyer un rapport vide.
    if (!a.overview.ok) {
      const code = a.overview.erreur;
      console.error('[cron audience] chiffres généraux indisponibles :', code);
      await alerterExploitant(`Rapport d'audience ${periode} NON envoyé : PostHog indisponible (${code}).`, '⚠️ Audience');
      return NextResponse.json({ periode, erreur: code }, { status: 500 });
    }
    const mail = construireEmailRapport({ periode, libelleFenetre: libelleFenetre(b), a, lien: `${SITE}/admin/audience/rapport?periode=${periode}` });
    const r = await sendEmail({ to: destinataire, subject: mail.sujet, html: mail.html, text: mail.text });
    if (!r.ok) {
      console.error('[cron audience] envoi refusé');
      await alerterExploitant(`Rapport d'audience ${periode} : envoi e-mail en échec.`, '⚠️ Audience');
      return NextResponse.json({ periode, erreur: 'envoi' }, { status: 500 });
    }
    return NextResponse.json({ periode, envoye: true, blocsIndisponibles: Object.entries(a).filter(([, v]) => typeof v === 'object' && v !== null && 'ok' in v && !(v as { ok: boolean }).ok).map(([k]) => k) });
  }

  return NextResponse.json({ error: 'periode invalide (jour|semaine|mois)' }, { status: 400 });
}
