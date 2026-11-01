import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { estNouveauCompte, nextSur } from '@/lib/bienvenue/redirection';
import Ecran from './Ecran';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'WESTBOURSE sur WhatsApp', robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: { next?: string } }) {
  const next = nextSur(searchParams.next);
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');
  const [{ data: prefs, error }, { count }] = await Promise.all([
    sb.from('notification_prefs').select('ecran_whatsapp_vu_at, whatsapp_optin').eq('user_id', user.id).maybeSingle(),
    sb.from('whatsapp_liaisons').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
  ]);
  // Lecture en échec : ne jamais piéger l'utilisateur sur un écran facultatif.
  if (error) redirect(next);
  const dejaLie = Boolean(prefs?.whatsapp_optin) || (count ?? 0) > 0;
  if (!estNouveauCompte(user.created_at, new Date()) || prefs?.ecran_whatsapp_vu_at || dejaLie) redirect(next);
  return <Ecran next={next} numeroAgent={(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '').replace(/\D/g, '')} />;
}
