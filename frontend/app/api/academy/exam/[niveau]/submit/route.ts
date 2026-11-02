import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { peutSuivreNiveau } from '@/lib/server/academyAccess';
import { gradeExam, validateAnswers } from '@/lib/academy/exam';
import { loadBank, niveauLessonsDone, isNiveau } from '@/lib/academy/examServer';
import { getServiceClient } from '@/lib/billing/serviceClient';

export const dynamic = 'force-dynamic';

interface SubmitBody {
  session_id: string;
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
  if (!body || typeof body.session_id !== 'string' || !Array.isArray(body.answers) || body.answers.length === 0 || body.answers.length > 100) {
    return NextResponse.json({ error: 'Réponses manquantes' }, { status: 400 });
  }
  if (!/^[0-9a-f-]{36}$/i.test(body.session_id)) {
    return NextResponse.json({ error: 'Session d’examen invalide' }, { status: 400 });
  }

  // Consommation ATOMIQUE de la session (propriétaire, niveau, non expirée, non
  // consommée) AVANT toute correction : un rejeu ou deux soumissions parallèles
  // ne passent qu'une fois. Une soumission invalide brûle la session — il faut
  // redémarrer l'examen (limité à 10/h).
  const svc = getServiceClient();
  const { data: session } = await svc
    .from('academy_exam_sessions')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', body.session_id)
    .eq('user_id', user.id)
    .eq('niveau', niveau)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('question_ids')
    .maybeSingle();
  if (!session) {
    return NextResponse.json({ error: 'Session d’examen expirée ou déjà utilisée. Redémarrez l’examen.' }, { status: 409 });
  }
  const issued = session.question_ids as string[];

  const valid = validateAnswers(issued, body.answers);
  if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 400 });

  const bank = await loadBank(niveau);
  const grade = gradeExam(bank, body.answers, issued);

  // Écriture service_role UNIQUEMENT (migration 0181 retire l'INSERT authenticated).
  const { error: errInsert } = await svc.from('academy_exam_attempts').insert({
    user_id: user.id,
    niveau,
    question_ids: issued,
    score: grade.score,
    passed: grade.passed,
  });
  if (errInsert) return NextResponse.json({ error: 'Enregistrement du passage impossible' }, { status: 500 });

  // Le corrigé n'est rendu qu'APRÈS l'écriture du passage.
  return NextResponse.json({ score: grade.score, passed: grade.passed, corrige: grade.corrige });
}
