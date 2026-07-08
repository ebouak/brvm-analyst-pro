/**
 * POST /api/admin/forum/[id]/pin
 * Admin endpoint to pin/unpin a forum post.
 * Requires 'forum.manage' permission. Returns updated post on success.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/server/rbac';

export const dynamic = 'force-dynamic';

/**
 * Request body schema for pinning a post.
 */
const pinSchema = z.object({
  is_pinned: z.boolean({
    errorMap: () => ({
      message: 'is_pinned doit être un booléen',
    }),
  }),
});

type PinInput = z.infer<typeof pinSchema>;

interface RouteParams {
  id: string;
}

export async function POST(
  req: Request,
  { params }: { params: RouteParams }
) {
  const postId = params.id;

  // Admin permission check
  let ctx;
  try {
    ctx = await requirePermission('forum.manage');
  } catch {
    return NextResponse.json(
      { error: 'Accès administrateur requis.' },
      { status: 403 }
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

  const validationResult = pinSchema.safeParse(body);
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

  const { is_pinned } = validationResult.data as PinInput;

  // Get Supabase client for updates
  const sb = createClient();

  // Verify post exists
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

  // Update post: set is_pinned and pinned_at
  const { data: updatedPost, error } = await sb
    .from('forum_posts')
    .update({
      is_pinned,
      pinned_at: is_pinned ? new Date().toISOString() : null,
    })
    .eq('id', postId)
    .select('*')
    .single();

  if (error) {
    console.error('Error updating forum post pin status:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du statut épinglé.' },
      { status: 500 }
    );
  }

  return NextResponse.json(
    updatedPost,
    { status: 200 }
  );
}
