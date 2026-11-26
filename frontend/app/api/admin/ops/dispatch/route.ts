import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/server/adminApi';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { declencherWorkflowGithub } from '@/lib/opsAgent/githubDispatch';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const g = await requireAdminApi('scraping.retry');
  if ('error' in g) return g.error;

  const corps = (await req.json().catch(() => null)) as { workflow?: string } | null;
  const workflow = corps?.workflow?.trim();
  if (!workflow) {
    return NextResponse.json({ error: 'Paramètre workflow requis.' }, { status: 400 });
  }

  const res = await declencherWorkflowGithub(getServiceClient(), {
    aliasOuFichier: workflow,
    chatId: 0,
    source: 'admin_ui',
    actorUserId: g.ctx.userId,
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: res.erreur ?? 'Déclenchement impossible.' },
      { status: res.dejaEnCours ? 409 : 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    correlationId: res.correlationId,
    workflow: res.workflow?.fichier,
  });
}
