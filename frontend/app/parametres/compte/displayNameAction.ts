'use server';

import { createClient } from '@/lib/supabase/server';

export async function saveDisplayName(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const name = String(formData.get('display_name') ?? '').trim().slice(0, 40);
  await supabase.from('profiles').update({ display_name: name || null }).eq('id', user.id);
}
