import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/server/admin';
import ApiKeysForm from '@/components/admin/ApiKeysForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Clés API' };

export default async function ClesApiPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  if (!isAdminEmail(user.email)) {
    return <div className="p-6 text-muted">Accès réservé à l'administrateur.</div>;
  }
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">🔑 Clés API</h1>
        <p className="text-sm text-muted">Configurez les clés des fournisseurs IA (DeepSeek, Mistral, Grok).</p>
      </div>
      <ApiKeysForm />
    </div>
  );
}
