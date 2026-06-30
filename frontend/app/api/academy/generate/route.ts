import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { generateCourse } from '@/lib/academy/generate';
import { renderCourseHtml } from '@/lib/academy/template';
import { upsertCourse, getExistingCover } from '@/lib/academy/server';
import { NIVEAUX, slugify, type Niveau } from '@/lib/academy/types';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

/**
 * POST /api/academy/generate
 * Génère un cours via LLM, le rend en HTML charté, le stocke (brouillon).
 * Réservé aux porteurs de la permission content.write.
 */
export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await requirePermission('content.write');
  } catch {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | { sujet?: string; niveau?: string; nbLessons?: number }
    | null;

  const sujet = (body?.sujet ?? '').trim();
  if (!sujet) return NextResponse.json({ error: 'Sujet requis.' }, { status: 400 });

  const niveau: Niveau = (NIVEAUX as readonly string[]).includes(body?.niveau ?? '')
    ? (body!.niveau as Niveau)
    : 'debutant';
  const nbLessons = Math.min(12, Math.max(1, Math.round(Number(body?.nbLessons) || 5)));

  try {
    const { content, provider } = await generateCourse({ sujet, niveau, nbLessons });
    const slug = slugify(content.titre) || slugify(sujet) || `cours-${Date.now()}`;

    // Préserver la couverture existante si on régénère un cours déjà couvert.
    const existingCover = await getExistingCover(slug);
    if (existingCover) content.coverUrl = existingCover;
    const html = renderCourseHtml(content);

    const res = await upsertCourse({
      slug,
      titre: content.titre,
      niveau: content.niveau,
      resume: content.intro.slice(0, 280),
      content,
      html,
      createdBy: ctx.userId,
    });
    if (!res.ok) return NextResponse.json({ error: res.message ?? 'Échec stockage' }, { status: 500 });

    await recordAudit(ctx, {
      action: 'academy.generate',
      resourceType: 'academy_course',
      resourceId: slug,
      severity: 'info',
    });

    return NextResponse.json({
      ok: true,
      slug,
      titre: content.titre,
      lessons: content.lessons.length,
      provider,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur génération' },
      { status: 502 },
    );
  }
}
