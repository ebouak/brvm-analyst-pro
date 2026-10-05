import { redacteursDisponibles } from '@/lib/server/redacteur';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supa = createClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return Response.json({ error: 'Non authentifié' }, { status: 401 });

  // Même liste, même ordre que la cascade réellement utilisée par l'assistant.
  const dispo = new Set((await redacteursDisponibles()).map((r) => r.fournisseur));
  return Response.json({
    deepseek: dispo.has('deepseek'),
    gemini: dispo.has('gemini'),
    xai: dispo.has('xai'),
    active: dispo.has('deepseek') ? 'deepseek' : dispo.has('gemini') ? 'gemini' : dispo.has('xai') ? 'xai' : null,
  });
}
