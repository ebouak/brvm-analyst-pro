import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { requireAdmin } from '@/lib/server/rbac';

export async function GET(req: Request) {
  try {
    await requireAdmin('admin.tools');

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );

    const url = new URL(req.url);
    const limit = Math.min(
      parseInt(url.searchParams.get('limit') || '20', 10),
      100
    );
    const includeAcknowledged =
      url.searchParams.get('includeAcknowledged') === 'true';

    let query = supabase
      .from('brvm_veille_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!includeAcknowledged) {
      query = query.is('acknowledged_at', null);
    }

    const { data, error } = await query;

    if (error) {
      return Response.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return Response.json({ data: data || [] });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unauthorized',
      },
      { status: error instanceof Error && error.message.includes('Unauthorized') ? 403 : 500 }
    );
  }
}
