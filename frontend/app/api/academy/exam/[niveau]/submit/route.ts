import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { peutSuivreNiveau } from '@/lib/server/academyAccess';
import { gradeExam } from '@/lib/academy/exam';
import { loadBank, niveauLessonsDone, isNiveau } from '@/lib/academy/examServer';
import { getServiceClient } from '@/lib/billing/serviceClient';

export const dynamic = 'force-dynamic';

interface SubmitBody {
  answers: { id: string; options: string[]; choix: number }[];
}

export async function POST(req: NextRequest, { params }: { params: { niveau: string } }) {
  const niveau = params.niveau;
  if (!isNiveau(niveau)) return NextResponse.json({ error: 'Niveau inconnu' }, { status: 404 });

  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Connexion requise' }, { status: 401 });

  // Abonnement premium OU niveau acheté à l'unité (Chariow).
  const gate = await peutSuivreNiveau(niveau);
  if (!gate.allowed) return NextResponse.json({ error: 'premium' }, { status: 403 });

  // Même verrou que /start : sans lui, on pouvait soumettre sans avoir suivi le niveau.
  const done = await niveauLessonsDone(niveau);
  if (!done.ok) return NextResponse.json({ error: 'Terminez les leçons de ce niveau avant l’examen.' }, { status: 409 });

  const body = (await req.json().catch(() => null)) as SubmitBody | null;
  if (!body || !Array.isArray(body.answers) || body.answers.length === 0 || body.answers.length > 100) {
    return NextResponse.json({ error: 'Réponses manquantes' }, { status: 400 });
  }

  const bank = await loadBank(niveau);
  const grade = gradeExam(bank, body.answers);

  // Écriture service_role UNIQUEMENT (migration 0181 retire l'INSERT authenticated) :
  // un passage ne peut naître que d'une correction faite ici, jamais d'un client.
  const { error: errInsert } = await getServiceClient().from('academy_exam_attempts').insert({
    user_id: user.id,
    niveau,
    question_ids: body.answers.map((a) => a.id),
    score: grade.score,
    passed: grade.passed,
  });
  if (errInsert) return NextResponse.json({ error: 'Enregistrement du passage impossible' }, { status: 500 });

  return NextResponse.json({ score: grade.score, passed: grade.passed, corrige: grade.corrige });
}
