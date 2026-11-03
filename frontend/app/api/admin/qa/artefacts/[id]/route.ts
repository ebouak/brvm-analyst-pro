// GET /api/admin/qa/artefacts/[id] — capture, trace, vidéo ou rapport d'un
// test e2e. Réservé à qa.read + 2FA ; redirige vers une URL signée de 5 min
// du bucket PRIVÉ qa-artefacts. Jamais de lien permanent ni public.
import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/server/adminApi';
import { traiterLectureArtefact } from '@/lib/qa/artefacts';
import { depsLectureSupabase } from '@/lib/qa/depsSupabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await requireAdminApi('qa.read');
  if ('error' in g) return g.error;
  try {
    const issue = await traiterLectureArtefact(params.id, depsLectureSupabase());
    if (issue.status === 302) {
      return NextResponse.redirect(issue.url, { status: 302, headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({ error: issue.error }, { status: issue.status, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Stockage indisponible' }, { status: 503 });
  }
}
