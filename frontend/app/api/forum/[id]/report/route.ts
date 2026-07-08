/**
 * POST /api/forum/[id]/report
 * Report a forum post for spam, inappropriate content, or misleading information.
 * Auth required. Returns { reported: true } on success or error.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Request body schema for reporting a post.
 */
const reportSchema = z.object({
  reason: z.enum(['spam', 'inappropriate', 'misleading'], {
    errorMap: () => ({
      message: 'La raison doit être: spam, inappropriate, ou misleading',
    }),
  }),
});

type ReportInput = z.infer<typeof reportSchema>;

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
      { error: 'Authentification requise pour signaler un post.' },
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

  const validationResult = reportSchema.safeParse(body);
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

  const { reason } = validationResult.data as ReportInput;

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

  // Insert report
  const { error } = await sb
    .from('forum_reports')
    .insert({
      target_id: postId,
      target_type: 'post',
      reporter_id: user.id,
      reason: reason,
      created_at: new Date().toISOString(),
      resolved: false,
    });

  if (error) {
    console.error('Error creating forum report:', error);
    return NextResponse.json(
      { error: 'Erreur lors du signalement du post.' },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { reported: true },
    { status: 201 }
  );
}
