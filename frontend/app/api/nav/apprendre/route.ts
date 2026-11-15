// Colonne « Apprendre » de la barre de cote pour une personne CONNECTÉE : la
// leçon en cours de l'Academy (même règle que le hub, `resumeTarget`) puis la
// prochaine formation en direct. Lue avec la session de l'appelant (progression
// en RLS owner) ; jamais mise en cache partagé. Appelée au premier survol ou
// focus de la cellule, jamais au chargement. Visiteur : /api/nav/apercu?r=apprendre.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { resumeTarget, type ProgressRowFull } from '@/lib/academy/progressCalc';
import { apercuApprendre, type LeconEnCours } from '@/lib/barreDeCote';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRIVE = { 'Cache-Control': 'private, no-store' };

type Cours = { id: string; slug: string; titre: string; content: { lessons?: unknown[] } | null };

export async function GET() {
  try {
    const db = createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return NextResponse.json({ erreur: 'non connecté' }, { status: 401, headers: PRIVE });

    const [{ data: prog }, { data: formations }] = await Promise.all([
      db.from('academy_progress').select('course_id, lesson_idx, completed, updated_at').eq('user_id', user.id),
      db
        .from('formations')
        .select('titre, date_evenement')
        .eq('published', true)
        .gte('date_evenement', new Date().toISOString())
        .order('date_evenement', { ascending: true })
        .limit(1),
    ]);
    const rows = (prog ?? []) as ProgressRowFull[];

    let lecon: LeconEnCours | null = null;
    const ids = [...new Set(rows.map((r) => r.course_id))];
    if (ids.length > 0) {
      // Contenu des cours : illisible avec la clé publique (0146), lu côté serveur
      // pour les SEULS cours déjà commencés. Seuls le titre, le slug et le numéro
      // de leçon quittent le serveur.
      const { data: cours } = await getServiceClient()
        .from('academy_courses')
        .select('id, slug, titre, content')
        .eq('published', true)
        .in('id', ids);
      const liste = (cours ?? []) as Cours[];
      const cible = resumeTarget(
        liste.map((c) => ({ id: c.id, slug: c.slug, lessonsCount: c.content?.lessons?.length ?? 0 })),
        rows,
      );
      const c = cible ? liste.find((x) => x.slug === cible.slug) : undefined;
      if (cible && c) lecon = { slug: c.slug, titreCours: c.titre, lessonIdx: cible.lessonIdx };
    }

    const f = formations?.[0] as { titre: string; date_evenement: string } | undefined;
    return NextResponse.json(
      { apercu: apercuApprendre(f ? { titre: f.titre, date_evenement: f.date_evenement.slice(0, 10) } : null, lecon) },
      { headers: PRIVE },
    );
  } catch {
    return NextResponse.json({ erreur: 'indisponible' }, { status: 503, headers: PRIVE });
  }
}
