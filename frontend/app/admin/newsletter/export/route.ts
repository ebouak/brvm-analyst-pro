import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/server/rbac';
import { loadNewsletter } from '@/lib/admin/newsletter';

export const dynamic = 'force-dynamic';

/**
 * Sérialise une cellule CSV : neutralise l'injection de formule (Excel/LibreOffice
 * exécutent une cellule commençant par = + - @ \t \r) en la préfixant d'une
 * apostrophe, puis applique le quoting RFC 4180.
 */
function csvCell(value: unknown): string {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET() {
  await requirePermission('content.read');
  const { subscribers } = await loadNewsletter();
  const header = 'email,confirmed,source,subscribed_at,confirmed_at';
  const rows = subscribers.map((s) =>
    [s.email, s.confirmed, s.source, s.subscribed_at ?? '', s.confirmed_at ?? '']
      .map(csvCell)
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
