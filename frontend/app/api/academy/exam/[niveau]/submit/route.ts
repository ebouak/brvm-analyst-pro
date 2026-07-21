import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { canAccess } from '@/lib/server/featureAccess';
import { gradeExam } from '@/lib/academy/exam';
import { loadBank, isNiveau } from '@/lib/academy/examServer';

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

  const gate = await canAccess('formations');
  if (!gate.allowed) return NextResponse.json({ error: 'premium' }, { status: 403 });

  const body = (await req.json()) as SubmitBody;
  if (!Array.isArray(body.answers) || body.answers.length === 0) {
    return NextResponse.json({ error: 'Réponses manquantes' }, { status: 400 });
  }

  const bank = await loadBank(niveau);
  const grade = gradeExam(bank, body.answers);

  await db.from('academy_exam_attempts').insert({
    user_id: user.id,
    niveau,
    question_ids: body.answers.map((a) => a.id),
    score: grade.score,
    passed: grade.passed,
  });

  return NextResponse.json({ score: grade.score, passed: grade.passed, corrige: grade.corrige });
}
