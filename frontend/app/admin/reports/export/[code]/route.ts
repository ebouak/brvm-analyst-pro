import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/server/rbac';
import { getServiceClient } from '@/lib/billing/serviceClient';

export const dynamic = 'force-dynamic';

/** Export Markdown du diagnostic d'une action (admin, content.read). */
export async function GET(_req: Request, { params }: { params: { code: string } }) {
  await requirePermission('content.read');
  const { data } = await getServiceClient()
    .from('diagnostic_reports')
    .select('markdown_content')
    .eq('code', params.code)
    .maybeSingle();
  const md = data?.markdown_content as string | undefined;
  if (!md) return new NextResponse('Diagnostic introuvable.', { status: 404 });
  return new NextResponse(md, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="diagnostic-${params.code}.md"`,
    },
  });
}
