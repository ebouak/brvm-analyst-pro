import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { listTopics } from '@/lib/forum/server';
import { ForumTopicList } from '@/components/forum/ForumTopicList';
import { SectionHeader } from '@/components/ui/premium';

export const metadata = { title: 'Forum' };
export const revalidate = 60;

export default async function ForumPage({ searchParams }: { searchParams?: { code?: string } }) {
  const code = searchParams?.code?.toUpperCase();
  const { topics, authors } = await listTopics(0, code);
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const nouveauHref = code ? `/forum/nouveau?code=${code}` : '/forum/nouveau';
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <SectionHeader kicker="Communauté" title={code ? `Forum · ${code}` : 'Forum'}
        subtitle={code ? `Discussions sur la valeur ${code}.` : 'Échangez sur les actions, obligations et événements de la BRVM.'}
        actions={user ? <Link href={nouveauHref} className="rounded-lg bg-info px-4 py-2 text-sm font-medium text-bg">Nouveau sujet</Link> : null} />
      {code && (
        <Link href="/forum" className="inline-block text-xs text-faint hover:text-white">← Tous les sujets</Link>
      )}
      <ForumTopicList topics={topics} authors={authors} />
      {topics.length === 0 && (
        <p className="text-sm text-muted">
          Aucun sujet {code ? `sur ${code} ` : ''}pour l&apos;instant.{' '}
          {user ? <Link href={nouveauHref} className="text-info hover:underline">Lancez la discussion →</Link>
            : <Link href="/login" className="text-info hover:underline">Connectez-vous pour lancer la discussion →</Link>}
        </p>
      )}
    </div>
  );
}
