// POST /api/cron/academy-relances — relances automatiques J+5 de progression Academy.
//
// Mode (variable d'environnement ACADEMY_RELANCES_MODE) :
//   off         : ne fait rien
//   simulation  : sélectionne et journalise dans `academy_reminder_logs` (défaut sûr), n'envoie aucun mail
//   actif       : envoie via Resend et journalise `envoye` / `echec` (refusé si isTestSender())
//
// Auth : Authorization: Bearer $CRON_SECRET uniquement (temps constant).
import { NextResponse } from 'next/server';
import { cronAutorise } from '@/lib/server/cronAuth';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { isTestSender, sendEmail } from '@/lib/server/email';
import { normaliserEmail } from '@/lib/crm/identite';
import type { CourseContent } from '@/lib/academy/types';
import { courseProgress, type ProgressRowFull } from '@/lib/academy/progressCalc';
import {
  COOLDOWN_RELANCE_JOURS,
  FENETRE_MAX_JOURS,
  composerEmailRelanceAcademy,
  selectionnerRelancesAcademy,
  type CandidatRelanceAcademy,
} from '@/lib/academy/relanceProgression';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.westbourse.com';
const BUDGET_MS = 95_000;

type RelanceMode = 'off' | 'simulation' | 'actif';

function lireMode(): RelanceMode {
  const v = (process.env.ACADEMY_RELANCES_MODE ?? 'simulation').trim().toLowerCase();
  if (v === 'off' || v === 'actif' || v === 'simulation') return v;
  return 'simulation';
}

export async function GET() {
  return NextResponse.json({ error: 'Méthode non autorisée' }, { status: 405, headers: { Allow: 'POST' } });
}

export async function POST(req: Request) {
  if (!cronAutorise(req)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const mode = lireMode();
  if (mode === 'off') {
    return NextResponse.json({ ok: true, mode, eligibles: 0, simules: 0, envoyes: 0, echecs: 0 });
  }
  if (mode === 'actif' && isTestSender()) {
    return NextResponse.json(
      { ok: false, mode, bloque: 'test_sender', eligibles: 0, simules: 0, envoyes: 0, echecs: 0 },
      { status: 503 },
    );
  }

  const debut = Date.now();
  const maintenant = new Date();
  const svc = getServiceClient();

  const depuisProgression = new Date(
    maintenant.getTime() - (FENETRE_MAX_JOURS + 5) * 86_400_000,
  ).toISOString();
  const depuisCooldown = new Date(
    maintenant.getTime() - (COOLDOWN_RELANCE_JOURS + 2) * 86_400_000,
  ).toISOString();

  const [coursesRes, progRes, examsRes, logsRes, oppRes] = await Promise.all([
    svc
      .from('academy_courses')
      .select('id, slug, titre, niveau, content')
      .eq('published', true),
    svc
      .from('academy_progress')
      .select('user_id, course_id, lesson_idx, completed, updated_at')
      .eq('completed', true)
      .gte('updated_at', depuisProgression)
      .limit(10000),
    svc
      .from('academy_exam_attempts')
      .select('user_id, niveau')
      .eq('passed', true)
      .limit(10000),
    svc
      .from('academy_reminder_logs')
      .select('user_id, created_at')
      .in('statut', mode === 'simulation' ? ['simulation', 'envoye'] : ['envoye'])
      .gte('created_at', depuisCooldown)
      .limit(5000),
    svc.from('crm_oppositions').select('email_norm').limit(10000),
  ]);

  if (logsRes.error) {
    console.error('[academy-relances] lecture academy_reminder_logs impossible :', logsRes.error.message);
    return NextResponse.json(
      { ok: false, mode, erreur: 'table_academy_reminder_logs_absente' },
      { status: 503 },
    );
  }
  // Fail-closed sur les oppositions : en cas d'erreur de lecture, aucun envoi ne part.
  if (oppRes.error || coursesRes.error || progRes.error || examsRes.error) {
    console.error('[academy-relances] erreur de lecture base :', {
      opp: oppRes.error?.message,
      courses: coursesRes.error?.message,
      prog: progRes.error?.message,
      exams: examsRes.error?.message,
    });
    return NextResponse.json({ ok: false, mode, erreur: 'lecture_base' }, { status: 500 });
  }

  const coursesMap = new Map<
    string,
    { id: string; slug: string; titre: string; niveau: string | null; lessons: { titre?: string }[] }
  >();
  for (const row of (coursesRes.data ?? []) as {
    id: string;
    slug: string;
    titre: string;
    niveau: string | null;
    content: CourseContent | null;
  }[]) {
    coursesMap.set(row.id, {
      id: row.id,
      slug: row.slug,
      titre: row.titre,
      niveau: row.niveau,
      lessons: row.content?.lessons ?? [],
    });
  }

  const passedByUser = new Map<string, Set<string>>();
  for (const e of (examsRes.data ?? []) as { user_id: string; niveau: string }[]) {
    let set = passedByUser.get(e.user_id);
    if (!set) {
      set = new Set<string>();
      passedByUser.set(e.user_id, set);
    }
    set.add(e.niveau);
  }

  const lastLogByUser = new Map<string, string>();
  for (const l of (logsRes.data ?? []) as { user_id: string; created_at: string }[]) {
    const prev = lastLogByUser.get(l.user_id);
    if (!prev || l.created_at > prev) lastLogByUser.set(l.user_id, l.created_at);
  }

  const opposedEmails = new Set(
    ((oppRes.data ?? []) as { email_norm: string }[]).map((o) => normaliserEmail(o.email_norm)),
  );

  // Regrouper la progression par (user_id, course_id).
  const byUserCourse = new Map<string, { userId: string; courseId: string; rows: ProgressRowFull[] }>();
  for (const r of (progRes.data ?? []) as (ProgressRowFull & { user_id: string })[]) {
    if (!coursesMap.has(r.course_id)) continue;
    const key = `${r.user_id}:${r.course_id}`;
    let entry = byUserCourse.get(key);
    if (!entry) {
      entry = { userId: r.user_id, courseId: r.course_id, rows: [] };
      byUserCourse.set(key, entry);
    }
    entry.rows.push(r);
  }

  const userIdsAInterroger = [...new Set([...byUserCourse.values()].map((x) => x.userId))];
  const profileMap = new Map<string, string | null>();
  if (userIdsAInterroger.length > 0) {
    const { data: profs } = await svc
      .from('profiles')
      .select('id, display_name')
      .in('id', userIdsAInterroger);
    for (const p of (profs ?? []) as { id: string; display_name: string | null }[]) {
      profileMap.set(p.id, p.display_name);
    }
  }

  const userEmailMap = new Map<string, string>();
  await Promise.all(
    userIdsAInterroger.map(async (uid) => {
      try {
        const { data } = await svc.auth.admin.getUserById(uid);
        if (data.user?.email) userEmailMap.set(uid, data.user.email);
      } catch {
        // Ignorer un utilisateur introuvable sans interrompre le lot.
      }
    }),
  );

  const candidats: CandidatRelanceAcademy[] = [];
  for (const { userId, courseId, rows } of byUserCourse.values()) {
    const course = coursesMap.get(courseId);
    const email = userEmailMap.get(userId);
    if (!course || !email) continue;

    const p = courseProgress(course.lessons.length, rows);
    const lastActivityAt = rows
      .map((r) => r.updated_at)
      .sort()
      .at(-1);
    if (!lastActivityAt) continue;

    candidats.push({
      userId,
      email,
      displayName: profileMap.get(userId) ?? null,
      courseSlug: course.slug,
      courseTitre: course.titre,
      niveau: course.niveau,
      doneLessons: p.done,
      totalLessons: p.total,
      nextLessonIdx: p.nextIdx,
      nextLessonTitle: course.lessons[p.nextIdx]?.titre ?? null,
      lastActivityAt,
      examPassed: course.niveau ? passedByUser.get(userId)?.has(course.niveau) ?? false : false,
      oppose: opposedEmails.has(normaliserEmail(email)),
      lastReminderAt: lastLogByUser.get(userId) ?? null,
    });
  }

  const selection = selectionnerRelancesAcademy(candidats, maintenant);
  let simules = 0;
  let envoyes = 0;
  let echecs = 0;
  let reportes = 0;

  for (const cible of selection) {
    if (Date.now() - debut > BUDGET_MS) {
      reportes += 1;
      continue;
    }

    if (mode === 'simulation') {
      const { error } = await svc.from('academy_reminder_logs').insert({
        user_id: cible.userId,
        course_slug: cible.courseSlug,
        next_lesson_idx: cible.nextLessonIdx,
        remaining_lessons: cible.remainingLessons,
        mode: 'simulation',
        statut: 'simulation',
      });
      if (error) echecs += 1;
      else simules += 1;
      continue;
    }

    const msg = composerEmailRelanceAcademy(cible, SITE_URL);
    const res = await sendEmail({
      to: cible.email,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      headers: {
        'List-Unsubscribe': `<${SITE_URL.replace(/\/+$/, '')}/parametres>`,
      },
    });

    const statut = res.ok ? 'envoye' : 'echec';
    await svc.from('academy_reminder_logs').insert({
      user_id: cible.userId,
      course_slug: cible.courseSlug,
      next_lesson_idx: cible.nextLessonIdx,
      remaining_lessons: cible.remainingLessons,
      mode: 'actif',
      statut,
      resend_id: res.id ?? null,
    });

    if (res.ok) envoyes += 1;
    else echecs += 1;
  }

  return NextResponse.json({
    ok: echecs === 0,
    mode,
    eligibles: selection.length,
    simules,
    envoyes,
    echecs,
    reportes,
  });
}
