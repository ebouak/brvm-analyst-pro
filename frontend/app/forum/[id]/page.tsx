import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getTopic } from '@/lib/forum/server';
import { ForumThread } from '@/components/forum/ForumThread';

export const revalidate = 30;

export default async function ForumTopicPage({ params }: { params: { id: string } }) {
  const data = await getTopic(params.id);
  if (!data) notFound();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <ForumThread topic={data.topic} posts={data.posts} authors={data.authors} canPost={!!user} />
    </div>
  );
}
