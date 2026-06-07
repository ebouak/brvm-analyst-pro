import { resolveApiKey } from '@/lib/server/apiKeys';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supa = createClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return Response.json({ error: 'Non authentifié' }, { status: 401 });

  const [deepseek, mistral, xai] = await Promise.all([
    resolveApiKey('deepseek'),
    resolveApiKey('mistral'),
    resolveApiKey('xai'),
  ]);

  return Response.json({
    deepseek: !!deepseek,
    mistral: !!mistral,
    xai: !!xai,
    active: deepseek ? 'deepseek' : mistral ? 'mistral' : xai ? 'xai' : null,
  });
}
