import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { peutSuivreNiveau } from '@/lib/server/academyAccess';
import { assembleExam } from '@/lib/academy/exam';
import { loadBank, niveauLessonsDone, isNiveau } from '@/lib/academy/examServer';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: { niveau: string } }) {
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

  const bank = await loadBank(niveau);
  if (bank.length < 5) return NextResponse.json({ error: 'Banque de questions indisponible.' }, { status: 503 });

  const seed = `${user.id}:${niveau}:${Date.now()}:${Math.random()}`;
  const exam = assembleExam(bank, seed);
  return NextResponse.json({ niveau, questions: exam.questions });
}
