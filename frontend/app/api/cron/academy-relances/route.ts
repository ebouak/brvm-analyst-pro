// POST /api/cron/academy-relances — relances automatiques J+5 de progression Academy.
//
// Mode (variable d'environnement ACADEMY_RELANCES_MODE) :
//   off         : ne fait rien
//   simulation  : sélectionne et journalise dans `academy_reminder_logs` (défaut sûr), n'envoie aucun mail
//   actif       : envoie via Resend et journalise `envoi` → `envoye` / `echec` (refusé si isTestSender())
//
// Garde-fous (0272) :
//   - retrait : `notification_prefs.academy_relances = false` ou opposition CRM ⇒ jamais relancé ;
//     chaque e-mail porte un lien d'arrêt et l'en-tête « un clic » (RFC 8058) ;
//   - pas de double envoi : la trace `envoi` est écrite AVANT l'appel à Resend ; sans elle, rien ne part ;
//   - toute lecture illisible (opposition, préférences, journal) ARRÊTE le passage : le doute ne vaut
//     jamais « personne ne s'y oppose » ;
//   - `ok: false` dès qu'un envoi échoue ou que son issue n'a pas pu être notée : le workflow passe au rouge.
//
// Auth : Authorization: Bearer $CRON_SECRET uniquement (temps constant).
import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { cronAutorise } from '@/lib/server/cronAuth';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { isTestSender, sendEmail } from '@/lib/server/email';
import { normaliserEmail } from '@/lib/crm/identite';
import { fetchAllRowsOuErreur } from '@/lib/supabase/paginate';
import type { CourseContent } from '@/lib/academy/types';
import { courseProgress, type ProgressRowFull } from '@/lib/academy/progressCalc';
import {
  COOLDOWN_RELANCE_JOURS,
  FENETRE_MAX_JOURS,
  composerEmailRelanceAcademy,
  dansFenetreDeRelance,
  selectionnerRelancesAcademy,
  statutsCooldown,
  type CandidatRelanceAcademy,
} from '@/lib/academy/relanceProgression';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.westbourse.com';
const BUDGET_MS = 95_000;
/** Taille des listes `in (...)` : garde l'URL PostgREST loin de ses limites. */
const LOT_IDS = 200;
/** Appels parallèles à l'API d'administration Auth (adresses e-mail). */
const PARALLELE_AUTH = 8;

type RelanceMode = 'off' | 'simulation' | 'actif';
type Svc = ReturnType<typeof getServiceClient>;

function lireMode(): RelanceMode {
  const v = (process.env.ACADEMY_RELANCES_MODE ?? 'simulation').trim().toLowerCase();
  if (v === 'off' || v === 'actif' || v === 'simulation') return v;
  return 'simulation';
}

function decouper<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

/** Lit par lots d'identifiants, en LEVANT sur la première erreur. */
async function parUtilisateurs<T>(
  ids: string[],
  lire: (lot: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (const lot of decouper(ids, LOT_IDS)) {
    const { data, error } = await lire(lot);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
  }
  return out;
}

async function adresses(svc: Svc, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const lot of decouper(ids, PARALLELE_AUTH)) {
    await Promise.all(
      lot.map(async (uid) => {
        try {
          const { data } = await svc.auth.admin.getUserById(uid);
          if (data.user?.email) out.set(uid, data.user.email);
        } catch {
          // Compte introuvable : écarté sans interrompre le lot.
        }
      }),
    );
  }
  return out;
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
  const depuisProgression = new Date(maintenant.getTime() - (FENETRE_MAX_JOURS + 5) * 86_400_000).toISOString();
  const depuisCooldown = new Date(maintenant.getTime() - (COOLDOWN_RELANCE_JOURS + 2) * 86_400_000).toISOString();

  type CoursRow = { id: string; slug: string; titre: string; niveau: string | null; content: CourseContent | null };
  let coursesRows: CoursRow[];
  let recents: { user_id: string; course_id: string; updated_at: string }[];
  let logs: { user_id: string; created_at: string }[];
  let oppositions: { email_norm: string }[];
  try {
    const coursesRes = await svc.from('academy_courses').select('id, slug, titre, niveau, content').eq('published', true);
    if (coursesRes.error) throw new Error(`academy_courses : ${coursesRes.error.message}`);
    coursesRows = (coursesRes.data ?? []) as CoursRow[];
    [recents, logs, oppositions] = await Promise.all([
      // Activité récente : sert seulement à repérer QUI peut être relancé.
      fetchAllRowsOuErreur<{ user_id: string; course_id: string; updated_at: string }>((a, b) =>
        svc
          .from('academy_progress')
          .select('user_id, course_id, lesson_idx, updated_at')
          .eq('completed', true)
          .gte('updated_at', depuisProgression)
          .order('updated_at', { ascending: true })
          .order('user_id', { ascending: true })
          .order('course_id', { ascending: true })
          .order('lesson_idx', { ascending: true })
          .range(a, b),
      ),
      fetchAllRowsOuErreur<{ user_id: string; created_at: string }>((a, b) =>
        svc
          .from('academy_reminder_logs')
          .select('user_id, created_at')
          .in('statut', statutsCooldown(mode))
          .gte('created_at', depuisCooldown)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
          .range(a, b),
      ),
      fetchAllRowsOuErreur<{ email_norm: string }>((a, b) =>
        svc.from('crm_oppositions').select('email_norm').order('email_norm').range(a, b),
      ),
    ]);
  } catch (e) {
    console.error('[academy-relances] lecture base impossible, rien n’est envoyé :', (e as Error).message);
    return NextResponse.json({ ok: false, mode, erreur: 'lecture_base' }, { status: 500 });
  }

  const coursesMap = new Map<string, { slug: string; titre: string; niveau: string | null; lessons: { titre?: string }[] }>();
  for (const row of coursesRows) {
    coursesMap.set(row.id, { slug: row.slug, titre: row.titre, niveau: row.niveau, lessons: row.content?.lessons ?? [] });
  }

  const lastLogByUser = new Map<string, string>();
  for (const l of logs) {
    const prev = lastLogByUser.get(l.user_id);
    if (!prev || l.created_at > prev) lastLogByUser.set(l.user_id, l.created_at);
  }

  // Dernière activité par (personne, cours) — la plus récente est forcément dans la fenêtre lue.
  const derniereActivite = new Map<string, { userId: string; courseId: string; at: string }>();
  for (const r of recents) {
    if (!coursesMap.has(r.course_id)) continue;
    const cle = `${r.user_id}:${r.course_id}`;
    const prev = derniereActivite.get(cle);
    if (!prev || r.updated_at > prev.at) derniereActivite.set(cle, { userId: r.user_id, courseId: r.course_id, at: r.updated_at });
  }

  // Tri préalable : même règle que la sélection, avant toute lecture d'adresse.
  const enFenetre = [...derniereActivite.values()].filter((x) =>
    dansFenetreDeRelance(x.at, lastLogByUser.get(x.userId) ?? null, maintenant),
  );
  let userIds = [...new Set(enFenetre.map((x) => x.userId))];

  let progression: (ProgressRowFull & { user_id: string })[] = [];
  let examensReussis: { user_id: string; niveau: string }[] = [];
  let profils: { id: string; display_name: string | null }[] = [];
  try {
    // Préférence de retrait : une personne qui a décoché n'est même pas simulée.
    const retires = await parUtilisateurs<{ user_id: string }>(userIds, (lot) =>
      svc.from('notification_prefs').select('user_id').in('user_id', lot).eq('academy_relances', false),
    );
    const setRetires = new Set(retires.map((r) => r.user_id));
    userIds = userIds.filter((id) => !setRetires.has(id));

    // Progression COMPLÈTE des personnes retenues : le compte des leçons faites
    // ne doit pas dépendre de la fenêtre d'activité.
    [progression, examensReussis, profils] = await Promise.all([
      parUtilisateurs<ProgressRowFull & { user_id: string }>(userIds, (lot) =>
        svc
          .from('academy_progress')
          .select('user_id, course_id, lesson_idx, completed, updated_at')
          .eq('completed', true)
          .in('user_id', lot),
      ),
      parUtilisateurs<{ user_id: string; niveau: string }>(userIds, (lot) =>
        svc.from('academy_exam_attempts').select('user_id, niveau').eq('passed', true).in('user_id', lot),
      ),
      parUtilisateurs<{ id: string; display_name: string | null }>(userIds, (lot) =>
        svc.from('profiles').select('id, display_name').in('id', lot),
      ),
    ]);
  } catch (e) {
    console.error('[academy-relances] lecture préférences / progression impossible, rien n’est envoyé :', (e as Error).message);
    return NextResponse.json({ ok: false, mode, erreur: 'lecture_base' }, { status: 500 });
  }

  const retenus = new Set(userIds);
  const passedByUser = new Map<string, Set<string>>();
  for (const e of examensReussis) {
    const set = passedByUser.get(e.user_id) ?? new Set<string>();
    set.add(e.niveau);
    passedByUser.set(e.user_id, set);
  }
  const profileMap = new Map(profils.map((p) => [p.id, p.display_name]));
  const lignesParCle = new Map<string, ProgressRowFull[]>();
  for (const r of progression) {
    const cle = `${r.user_id}:${r.course_id}`;
    const xs = lignesParCle.get(cle) ?? [];
    xs.push(r);
    lignesParCle.set(cle, xs);
  }

  const userEmailMap = await adresses(svc, userIds);
  const opposedEmails = new Set(oppositions.map((o) => normaliserEmail(o.email_norm)));

  const candidats: CandidatRelanceAcademy[] = [];
  for (const { userId, courseId, at } of enFenetre) {
    if (!retenus.has(userId)) continue;
    const course = coursesMap.get(courseId);
    const email = userEmailMap.get(userId);
    if (!course || !email) continue;
    const p = courseProgress(course.lessons.length, lignesParCle.get(`${userId}:${courseId}`) ?? []);
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
      lastActivityAt: at,
      examPassed: course.niveau ? passedByUser.get(userId)?.has(course.niveau) ?? false : false,
      oppose: opposedEmails.has(normaliserEmail(email)),
      lastReminderAt: lastLogByUser.get(userId) ?? null,
    });
  }

  const selection = selectionnerRelancesAcademy(candidats, maintenant);
  let simules = 0;
  let envoyes = 0;
  let echecs = 0;
  let incertains = 0;
  let reportes = 0;

  for (const cible of selection) {
    if (Date.now() - debut > BUDGET_MS) {
      reportes += 1;
      continue;
    }
    const trace = {
      user_id: cible.userId,
      course_slug: cible.courseSlug,
      next_lesson_idx: cible.nextLessonIdx,
      remaining_lessons: cible.remainingLessons,
    };

    if (mode === 'simulation') {
      const { error } = await svc.from('academy_reminder_logs').insert({ ...trace, mode: 'simulation', statut: 'simulation' });
      if (error) echecs += 1;
      else simules += 1;
      continue;
    }

    // 1. Trace AVANT l'envoi : sans elle, rien ne part (sinon un échec d'écriture
    //    après envoi laisserait la personne sans trace, relancée le lendemain).
    const jetonArret = randomBytes(24).toString('hex');
    const { data: ligne, error: errTrace } = await svc
      .from('academy_reminder_logs')
      .insert({ ...trace, mode: 'actif', statut: 'envoi', jeton_arret: jetonArret })
      .select('id')
      .single();
    if (errTrace || !ligne) {
      console.error('[academy-relances] trace impossible, envoi annulé :', errTrace?.message);
      echecs += 1;
      continue;
    }

    // 2. Envoi.
    const msg = composerEmailRelanceAcademy(cible, { jetonArret, siteUrl: SITE_URL });
    const res = await sendEmail({ to: cible.email, subject: msg.subject, html: msg.html, text: msg.text, headers: msg.headers });

    // 3. Issue. Réponse ambiguë de Resend (coupure, délai, 5xx) : le message a PU
    //    partir, la ligne reste `envoi` et compte dans le délai de 14 jours.
    //    Même chose si l'issue ne peut pas être notée : « peut-être parti » ne se renvoie pas.
    if (!res.ok && res.incertain) {
      console.error('[academy-relances] issue de l’envoi inconnue, laissé en « envoi » :', res.error);
      incertains += 1;
      continue;
    }
    const { error: errMaj } = await svc
      .from('academy_reminder_logs')
      .update({ statut: res.ok ? 'envoye' : 'echec', resend_id: res.id ?? null })
      .eq('id', (ligne as { id: string }).id);
    if (errMaj) {
      console.error('[academy-relances] issue de l’envoi non notée :', errMaj.message);
      incertains += 1;
    }
    if (res.ok) envoyes += 1;
    else {
      console.error('[academy-relances] envoi refusé :', res.error);
      echecs += 1;
    }
  }

  return NextResponse.json({
    ok: echecs === 0 && incertains === 0,
    mode,
    eligibles: selection.length,
    simules,
    envoyes,
    echecs,
    incertains,
    reportes,
  });
}
