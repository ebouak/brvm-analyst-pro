/**
 * POST /api/forum/create
 * Create a new forum post with optional attachments.
 * Returns the created post or error.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Request body schema for creating a forum post.
 */
const createPostSchema = z.object({
  title: z.string().min(5, 'Titre trop court (5 caractères minimum)').max(200, 'Titre trop long (200 caractères maximum)'),
  body: z.string().min(20, 'Message trop court (20 caractères minimum)').max(5000, 'Message trop long (5000 caractères maximum)'),
  instrument_code: z.string().optional().nullable(),
  image_urls: z.array(z.string().url()).max(3, 'Maximum 3 images').optional(),
});

type CreatePostInput = z.infer<typeof createPostSchema>;

export async function POST(req: Request) {
  const sb = createClient();

  // Check authentication
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Authentification requise pour créer un post.' },
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

  const validationResult = createPostSchema.safeParse(body);
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

  const { title, body: postBody, instrument_code, image_urls } = validationResult.data as CreatePostInput;

  // Create forum post
  const { data: post, error } = await sb
    .from('forum_posts')
    .insert({
      author_id: user.id,
      body: postBody,
      image_urls: image_urls || [],
      instrument_code: instrument_code || null,
      hidden: false,
      created_at: new Date().toISOString(),
      edited_at: null,
    })
    .select('*')
    .single();

  if (error) {
    console.error('Error creating forum post:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du post.' },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      status: 201,
      data: post,
    },
    { status: 201 }
  );
}
