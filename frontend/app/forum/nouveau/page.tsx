import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ForumNewTopicForm } from '@/components/forum/ForumNewTopicForm';
import { SectionHeader } from '@/components/ui/premium';

export const metadata = { title: 'Nouveau sujet' };

export default async function NewTopicPage(props: { searchParams?: Promise<{ code?: string }> }) {
  const searchParams = await props.searchParams;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: instruments } = await supabase
    .from('brvm_instruments').select('code, designation').eq('type', 'action').order('code');
  const initialCode = searchParams?.code?.toUpperCase() ?? '';
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <SectionHeader title="Nouveau sujet" subtitle="Partagez une analyse ou posez une question." />
      <ForumNewTopicForm instruments={instruments ?? []} initialCode={initialCode} />
    </div>
  );
}
