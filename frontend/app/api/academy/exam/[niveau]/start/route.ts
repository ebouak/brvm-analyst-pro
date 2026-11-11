import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { peutSuivreNiveau } from '@/lib/server/academyAccess';
import { assembleExam } from '@/lib/academy/exam';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { loadBank, niveauLessonsDone, isNiveau } from '@/lib/academy/examServer';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, props: { params: Promise<{ niveau: string }> }) {
  const params = await props.params;
  const niveau = params.niveau;
  if (!isNiveau(niveau)) return NextResponse.json({ error: 'Niveau inconnu' }, { status: 404 });

  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Connexion requise' }, { status: 401 });

  // Abonnement premium OU niveau acheté à l'unité (Chariow).
  const gate = await peutSuivreNiveau(niveau);
  if (!gate.allowed) {
    return NextResponse.json({ error: 'premium', required: gate.acces.abonnement.required }, { status: 403 });
  }

  const done = await niveauLessonsDone(niveau);
  if (!done.ok) return NextResponse.json({ error: 'Terminez les leçons de ce niveau avant l’examen.' }, { status: 409 });

  // Au plus 10 démarrages par heure et par compte (chaque démarrage émet un examen).
  const { allowed } = await checkRateLimit({
    route: 'academy-exam-start', ip: `user:${user.id}`, maxHits: 10, windowSeconds: 3600,
  });
  if (!allowed) return NextResponse.json({ error: 'Trop de tentatives. Réessayez dans une heure.' }, { status: 429 });

  const bank = await loadBank(niveau);
  if (bank.length < 5) return NextResponse.json({ error: 'Banque de questions indisponible.' }, { status: 503 });

  const seed = `${user.id}:${niveau}:${Date.now()}:${Math.random()}`;
  const exam = assembleExam(bank, seed);

  // L'examen ÉMIS est mémorisé côté serveur : la correction se fera sur CETTE
  // liste, à usage unique (migration 0184).
  const { data: session, error } = await getServiceClient()
    .from('academy_exam_sessions')
    .insert({ user_id: user.id, niveau, question_ids: exam.question_ids })
    .select('id')
    .single();
  if (error || !session) return NextResponse.json({ error: 'Impossible de démarrer l’examen.' }, { status: 500 });

  return NextResponse.json({ niveau, session_id: session.id, questions: exam.questions });
}
