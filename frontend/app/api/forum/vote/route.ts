// POST /api/forum/vote { postId } — bascule le vote (upvote) de l'utilisateur
// courant sur une réponse. Renvoie le nouvel état + le total.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Connectez-vous pour voter.' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { postId?: string } | null;
  const postId = body?.postId;
  if (!postId) return NextResponse.json({ error: 'postId requis' }, { status: 400 });

  const { data: existing } = await sb
    .from('forum_post_votes').select('post_id').eq('post_id', postId).eq('user_id', user.id).maybeSingle();

  let voted: boolean;
  if (existing) {
    const { error } = await sb.from('forum_post_votes').delete().eq('post_id', postId).eq('user_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    voted = false;
  } else {
    const { error } = await sb.from('forum_post_votes').insert({ post_id: postId, user_id: user.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    voted = true;
  }

  const { count } = await sb
    .from('forum_post_votes').select('*', { count: 'exact', head: true }).eq('post_id', postId);
  return NextResponse.json({ voted, count: count ?? 0 });
}
