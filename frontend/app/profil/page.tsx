import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SectionHeader } from '@/components/ui/premium';
import ProfileClient from '@/components/profile/ProfileClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mon profil' };

export default async function ProfilPage() {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');

  const { data: p } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
  const profile = (p ?? {}) as Record<string, unknown>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <SectionHeader kicker="Compte" title="Mon profil" subtitle="Votre identité sur WESTBOURSE — photo, bio et préférences." />
      <ProfileClient
        email={user.email ?? ''}
        isPremium={Boolean(profile.is_premium)}
        initialPreferences={(profile.preferences as Record<string, unknown>) ?? {}}
        initial={{
          display_name: (profile.display_name as string) ?? null,
          avatar_url: (profile.avatar_url as string) ?? null,
          bio: (profile.bio as string) ?? null,
          location: (profile.location as string) ?? null,
          experience_level: (profile.experience_level as string) ?? null,
          favorite_sectors: (profile.favorite_sectors as string[]) ?? [],
        }}
      />
    </div>
  );
}
