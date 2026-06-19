import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { listTopics } from '@/lib/forum/server';
import { ForumTopicList } from '@/components/forum/ForumTopicList';
import { SectionHeader } from '@/components/ui/premium';

export const metadata = { title: 'Forum — WESTBOURSE' };
export const revalidate = 60;

export default async function ForumPage() {
  const { topics, authors } = await listTopics(0);
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <SectionHeader kicker="Communauté" title="Forum"
        subtitle="Échangez sur les actions, obligations et événements de la BRVM."
        actions={user ? <Link href="/forum/nouveau" className="rounded-lg bg-info px-4 py-2 text-sm font-medium text-bg">Nouveau sujet</Link> : null} />
      <ForumTopicList topics={topics} authors={authors} />
    </div>
  );
}
