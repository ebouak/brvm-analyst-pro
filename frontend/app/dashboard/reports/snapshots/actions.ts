'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function saveSnapshot(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return; // silencieux : bouton masqué si non connecté
  const params = JSON.parse(String(formData.get('params') || '{}'));
  const { error } = await supabase.from('report_snapshots').insert({
    user_id: user.id,
    report_type: String(formData.get('report_type')),
    title: String(formData.get('title')),
    params,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/reports');
}

export async function deleteSnapshot(formData: FormData) {
  const supabase = createClient();
  const { error } = await supabase
    .from('report_snapshots').delete().eq('id', String(formData.get('id')));
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/reports');
}
