// frontend/lib/forum/server.ts
import { createPublicClient } from '@/lib/supabase/public';
import type { ForumTopic, ForumPost, AuthorProfile } from './types';

const PAGE_SIZE = 20;

/** Liste paginée des sujets visibles, plus récents d'abord. */
export async function listTopics(page = 0, instrumentCode?: string): Promise<{ topics: ForumTopic[]; authors: Map<string, AuthorProfile> }> {
  const supabase = createPublicClient();
  let q = supabase
    .from('forum_topics')
    .select('*')
    .eq('hidden', false)
    .order('last_activity_at', { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (instrumentCode) q = q.eq('instrument_code', instrumentCode);
  const { data } = await q;
  const topics = (data ?? []) as ForumTopic[];
  return { topics, authors: await loadAuthors(topics.map((t) => t.author_id)) };
}

/** Un sujet + ses réponses visibles. */
export async function getTopic(id: string): Promise<{ topic: ForumTopic; posts: ForumPost[]; authors: Map<string, AuthorProfile> } | null> {
  const supabase = createPublicClient();
  const { data: topic } = await supabase.from('forum_topics').select('*').eq('id', id).eq('hidden', false).single();
  if (!topic) return null;
  const { data: posts } = await supabase
    .from('forum_posts').select('*').eq('topic_id', id).eq('hidden', false).order('created_at', { ascending: true });
  const list = (posts ?? []) as ForumPost[];
  const authors = await loadAuthors([(topic as ForumTopic).author_id, ...list.map((p) => p.author_id)]);
  return { topic: topic as ForumTopic, posts: list, authors };
}

/** Compteurs de votes par réponse + l'ensemble voté par l'utilisateur courant. */
export async function getPostVotes(
  postIds: string[],
  userId: string | null,
): Promise<{ counts: Map<string, number>; mine: Set<string> }> {
  const counts = new Map<string, number>();
  const mine = new Set<string>();
  if (postIds.length === 0) return { counts, mine };
  const supabase = createPublicClient();
  const { data } = await supabase.from('forum_post_votes').select('post_id, user_id').in('post_id', postIds);
  for (const v of (data ?? []) as { post_id: string; user_id: string }[]) {
    counts.set(v.post_id, (counts.get(v.post_id) ?? 0) + 1);
    if (userId && v.user_id === userId) mine.add(v.post_id);
  }
  return { counts, mine };
}

/** Profils (pseudonymes) des auteurs, indexés par id. */
async function loadAuthors(ids: (string | null)[]): Promise<Map<string, AuthorProfile>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  const map = new Map<string, AuthorProfile>();
  if (unique.length === 0) return map;
  const supabase = createPublicClient();
  const { data } = await supabase.from('profiles').select('id, display_name').in('id', unique);
  for (const p of (data ?? []) as AuthorProfile[]) map.set(p.id, p);
  return map;
}
