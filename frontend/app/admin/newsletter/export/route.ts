import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/server/rbac';
import { loadNewsletter } from '@/lib/admin/newsletter';

export const dynamic = 'force-dynamic';

export async function GET() {
  await requirePermission('content.read');
  const { subscribers } = await loadNewsletter();
  const header = 'email,confirmed,source,subscribed_at,confirmed_at';
  const rows = subscribers.map((s) =>
    [s.email, s.confirmed, s.source, s.subscribed_at ?? '', s.confirmed_at ?? '']
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(','),
  );
  const csv = [header, ...rows].join('\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="newsletter-subscribers.csv"',
    },
  });
}
