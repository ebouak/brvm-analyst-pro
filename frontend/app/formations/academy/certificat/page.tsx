import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isNiveau } from '@/lib/academy/examServer';
import CertificateActions from '@/components/academy/CertificateActions';

export const dynamic = 'force-dynamic';

export default async function CertificatPage({ searchParams }: { searchParams: { niveau?: string } }) {
  const niveau = searchParams.niveau ?? '';
  if (!isNiveau(niveau)) redirect('/formations/academy');
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/login?next=/formations/academy');
  const { data: profile } = await db.from('profiles').select('display_name').eq('id', user.id).maybeSingle();
  const defaultName = (profile as { display_name?: string } | null)?.display_name ?? '';

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 py-10">
      <h1 className="font-display text-2xl text-white">Votre certificat</h1>
      <p className="text-sm text-muted">Confirmez le nom qui apparaîtra sur le certificat public.</p>
      <CertificateActions niveau={niveau} defaultName={defaultName} />
    </div>
  );
}
