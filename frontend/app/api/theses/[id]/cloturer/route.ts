import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Clôture une thèse active : fige le dernier cours en base, enregistre verdict
 * et bilan. Le cours de clôture n'est jamais saisi — c'est un vrai prix de marché.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    verdict?: string; bilan?: string;
  } | null;
  if (!body?.verdict || !['jouee', 'invalidee', 'abandonnee'].includes(body.verdict)) {
    return NextResponse.json({ error: 'verdict invalide' }, { status: 400 });
  }

  // RLS garantit déjà l'appartenance ; on lit la thèse pour vérifier l'état et
  // récupérer le code.
  const { data: these } = await sb
    .from('investment_theses')
    .select('id, code, statut')
    .eq('id', params.id).eq('user_id', user.id)
    .maybeSingle();
  if (!these) return NextResponse.json({ error: 'Thèse introuvable' }, { status: 404 });
  if (these.statut === 'cloturee') {
    return NextResponse.json({ error: 'Thèse déjà clôturée' }, { status: 409 });
  }

  // Dernier cours en base pour figer l'écart réel.
  const { data: px } = await sb
    .from('brvm_actions_daily')
    .select('cours_jour')
    .eq('code', these.code).not('cours_jour', 'is', null)
    .order('date_marche', { ascending: false }).limit(1).maybeSingle();
  const coursCloture = (px?.cours_jour as number | null) ?? null;
  if (coursCloture == null) {
    return NextResponse.json(
      { error: 'Aucun cours disponible pour ce titre : clôture impossible sans prix de référence.' },
      { status: 422 },
    );
  }

  const { error } = await sb.from('investment_theses').update({
    statut: 'cloturee',
    verdict: body.verdict,
    bilan: (body.bilan ?? '').slice(0, 2000),
    cours_cloture: coursCloture,
    cloturee_le: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', these.id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, coursCloture });
}
