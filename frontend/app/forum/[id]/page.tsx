import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getTopic, getPostVotes } from '@/lib/forum/server';
import { ForumThread } from '@/components/forum/ForumThread';

// Les votes dépendent de l'utilisateur → rendu dynamique.
export const dynamic = 'force-dynamic';

export default async function ForumTopicPage({ params }: { params: { id: string } }) {
  const data = await getTopic(params.id);
  if (!data) notFound();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { counts, mine } = await getPostVotes(data.posts.map((p) => p.id), user?.id ?? null);
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <ForumThread
        topic={data.topic} posts={data.posts} authors={data.authors} canPost={!!user}
        voteCounts={counts} myVotes={mine}
      />
    </div>
  );
}
