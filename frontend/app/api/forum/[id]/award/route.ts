/**
 * POST /api/forum/[id]/award
 * Award a post with an emoji badge and increment author's reputation.
 * Supports: 💡 (insight), 🔥 (trending), ⭐ (excellent)
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { AWARD_TYPES } from '@/lib/forum/types';

export const dynamic = 'force-dynamic';

/**
 * Request body schema for awarding a post.
 */
const awardPostSchema = z.object({
  award_type: z.enum((AWARD_TYPES as unknown) as [string, ...string[]], {
    errorMap: () => ({ message: `Award type must be one of: ${AWARD_TYPES.join(', ')}` }),
  }),
});

type AwardPostInput = z.infer<typeof awardPostSchema>;

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
      { error: 'Authentification requise pour décerner un prix.' },
      { status: 401 }
    );
  }

  // Parse and validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Requête JSON invalide.' },
      { status: 400 }
    );
  }

  const validationResult = awardPostSchema.safeParse(body);
  if (!validationResult.success) {
    const errors = validationResult.error.flatten().fieldErrors;
    const message = Object.entries(errors)
      .flatMap(([field, msgs]) => msgs.map(m => `${field}: ${m}`))
      .join('; ');
    return NextResponse.json(
      { error: message || 'Validation échouée.' },
      { status: 400 }
    );
  }

  const { award_type } = validationResult.data as AwardPostInput;

  // Get post and author
  const { data: post, error: postError } = await sb
    .from('forum_posts')
    .select('id, author_id')
    .eq('id', postId)
    .single();

  if (postError || !post) {
    return NextResponse.json(
      { error: 'Post non trouvé.' },
      { status: 404 }
    );
  }

  const authorId = post.author_id;
  if (!authorId) {
    return NextResponse.json(
      { error: 'Impossible de récompenser un post anonyme.' },
      { status: 400 }
    );
  }

  // Upsert interaction (award)
  const { error: interactionError } = await sb
    .from('post_interactions')
    .upsert(
      {
        post_id: postId,
        user_id: user.id,
        interaction_type: 'award',
        award_type,
      },
      {
        onConflict: 'post_id,user_id',
      }
    );

  if (interactionError) {
    console.error('Error upserting award:', interactionError);
    return NextResponse.json(
      { error: 'Erreur lors du prix.' },
      { status: 500 }
    );
  }

  // Increment author reputation score
  const { data: profile } = await sb
    .from('author_profiles')
    .select('reputation_score')
    .eq('user_id', authorId)
    .single();

  const currentScore = profile?.reputation_score ?? 0;
  const reputationIncrement = 10; // Standard reputation gain per award

  const { error: updateError } = await sb
    .from('author_profiles')
    .update({
      reputation_score: currentScore + reputationIncrement,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', authorId);

  if (updateError) {
    console.error('Error updating reputation:', updateError);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la réputation.' },
      { status: 500 }
    );
  }

  // Get updated award count for this award type
  const { count } = await sb
    .from('post_interactions')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId)
    .eq('interaction_type', 'award')
    .eq('award_type', award_type);

  return NextResponse.json({
    awarded: true,
    award_type,
    award_count: count ?? 0,
    author_reputation: currentScore + reputationIncrement,
  });
}
