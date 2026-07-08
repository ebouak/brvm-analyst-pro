/**
 * POST /api/forum/[id]/like
 * Add or toggle a like from the current user on a post.
 * Uses upsert for idempotence.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface RouteParams {
  id: string;
}

export async function POST(
  req: Request,
  { params }: { params: RouteParams }
) {
  const sb = createClient();
  const postId = params.id;

  // Check authentication
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Authentification requise pour aimer un post.' },
      { status: 401 }
    );
  }

  // Validate post exists
  const { data: post } = await sb
    .from('forum_posts')
    .select('id')
    .eq('id', postId)
    .single();

  if (!post) {
    return NextResponse.json(
      { error: 'Post non trouvé.' },
      { status: 404 }
    );
  }

  // Upsert interaction (like)
  const { error } = await sb
    .from('post_interactions')
    .upsert(
      {
        post_id: postId,
        user_id: user.id,
        interaction_type: 'like',
      },
      {
        onConflict: 'post_id,user_id',
      }
    );

  if (error) {
    console.error('Error upserting like:', error);
    return NextResponse.json(
      { error: 'Erreur lors du like.' },
      { status: 500 }
    );
  }

  // Get updated like count
  const { count } = await sb
    .from('post_interactions')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId)
    .eq('interaction_type', 'like');

  return NextResponse.json({
    liked: true,
    like_count: count ?? 0,
  });
}
