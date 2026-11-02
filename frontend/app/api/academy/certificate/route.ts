import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { isNiveau, niveauLessonsDone } from '@/lib/academy/examServer';
import { peutSuivreNiveau } from '@/lib/server/academyAccess';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Connexion requise' }, { status: 401 });

  const body = (await req.json()) as { niveau?: string; display_name?: string; consent?: boolean };
  if (!body.niveau || !isNiveau(body.niveau)) return NextResponse.json({ error: 'Niveau inconnu' }, { status: 400 });
  const name = (body.display_name ?? '').trim();
  if (name.length < 2 || name.length > 80) return NextResponse.json({ error: 'Nom invalide' }, { status: 400 });
  if (body.consent !== true) return NextResponse.json({ error: 'Consentement requis' }, { status: 400 });

  // Le niveau doit être accessible (abonnement ou achat) ET ses leçons terminées :
  // l'examen seul ne suffit pas à délivrer un certificat.
  const gate = await peutSuivreNiveau(body.niveau);
  if (!gate.allowed) return NextResponse.json({ error: 'premium' }, { status: 403 });
  const done = await niveauLessonsDone(body.niveau);
  if (!done.ok) return NextResponse.json({ error: 'Terminez les leçons de ce niveau.' }, { status: 409 });

  // Exiger un examen réussi pour ce niveau, lu via service_role (les passages ne
  // sont écrits que par la route de correction), borné à l'utilisateur de la session.
  const svc = getServiceClient();
  const { data: pass } = await svc
    .from('academy_exam_attempts')
    .select('id')
    .eq('user_id', user.id)
    .eq('niveau', body.niveau)
    .eq('passed', true)
    .limit(1);
  if (!pass || pass.length === 0) return NextResponse.json({ error: 'Examen non validé' }, { status: 403 });

  // Écriture via service_role (pas de policy d'écriture authenticated) ; user_id fixé ici.
  const { data, error } = await svc
    .from('academy_certificates')
    .upsert(
      { user_id: user.id, niveau: body.niveau, display_name: name, consent_at: new Date().toISOString(), revoked: false },
      { onConflict: 'user_id,niveau' },
    )
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: 'Échec de génération' }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
