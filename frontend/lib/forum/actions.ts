// frontend/lib/forum/actions.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { validateTopicInput, validatePostInput, resolveTopicLink } from './validation';
import { checkPostRate, checkTopicRate } from './rateLimit';

async function requireUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Connexion requise.');
  return { supabase, user };
}

export async function createTopic(input: { title: string; body: string; instrumentCode: string | null; eventId: string | null }) {
  const { supabase, user } = await requireUser();
  const v = validateTopicInput(input);
  if (!v.ok) return { error: v.error };
  const link = resolveTopicLink({ instrumentCode: input.instrumentCode, eventId: input.eventId });
  if (!link.ok) return { error: link.error };

  const { data: recent } = await supabase
    .from('forum_topics').select('created_at').eq('author_id', user.id)
    .gte('created_at', new Date(Date.now() - 3_600_000).toISOString());
  const rate = checkTopicRate((recent ?? []).map((r) => r.created_at as string));
  if (!rate.ok) return { error: rate.error };

  const { data, error } = await supabase.from('forum_topics').insert({
    author_id: user.id, title: v.value.title, body: v.value.body,
    instrument_code: link.value.instrumentCode, event_id: link.value.eventId,
  }).select('id').single();
  if (error) return { error: "Creation impossible." };
  revalidatePath('/forum');
  return { id: data!.id as string };
}

export async function createPost(input: { topicId: string; body: string }) {
  const { supabase, user } = await requireUser();
  const v = validatePostInput(input);
  if (!v.ok) return { error: v.error };

  const { data: last } = await supabase
    .from('forum_posts').select('created_at').eq('author_id', user.id)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  const rate = checkPostRate((last?.created_at as string) ?? null);
  if (!rate.ok) return { error: rate.error };

  const { error } = await supabase.from('forum_posts').insert({ topic_id: input.topicId, author_id: user.id, body: v.value.body });
  if (error) return { error: "Reponse impossible." };
  await supabase.from('forum_topics').update({ last_activity_at: new Date().toISOString() }).eq('id', input.topicId);
  revalidatePath(`/forum/${input.topicId}`);
  return { ok: true };
}

export async function editPost(input: { postId: string; body: string }) {
  const { supabase } = await requireUser();
  const v = validatePostInput(input);
  if (!v.ok) return { error: v.error };
  const { error } = await supabase.from('forum_posts').update({ body: v.value.body, edited_at: new Date().toISOString() }).eq('id', input.postId);
  if (error) return { error: "Modification impossible." };
  return { ok: true };
}

export async function deletePost(postId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('forum_posts').delete().eq('id', postId);
  if (error) return { error: "Suppression impossible." };
  return { ok: true };
}

export async function reportContent(input: { targetType: 'topic' | 'post'; targetId: string; reason: string }) {
  const { supabase, user } = await requireUser();
  const reason = input.reason.trim().slice(0, 500);
  const { error } = await supabase.from('forum_reports').insert({
    reporter_id: user.id, target_type: input.targetType, target_id: input.targetId, reason: reason || null,
  });
  if (error) return { error: "Signalement impossible." };
  return { ok: true };
}
