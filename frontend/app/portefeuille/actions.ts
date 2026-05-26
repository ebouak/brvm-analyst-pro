'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function requireUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');
  return { supabase, user };
}

/** Récupère (ou crée) la watchlist par défaut de l'utilisateur. */
async function defaultWatchlistId(): Promise<string> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from('watchlists')
    .select('id, is_default')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .limit(1);
  if (data && data.length > 0) return data[0]!.id as string;
  const { data: created, error } = await supabase
    .from('watchlists')
    .insert({ user_id: user.id, nom: 'Ma watchlist', is_default: true })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return created!.id as string;
}

export async function createWatchlist(formData: FormData) {
  const { supabase, user } = await requireUser();
  const nom = String(formData.get('nom') ?? '').trim();
  if (!nom) throw new Error('Nom requis');
  const { error } = await supabase
    .from('watchlists')
    .insert({ user_id: user.id, nom, is_default: false });
  if (error) throw new Error(error.message);
  revalidatePath('/portefeuille');
}

export async function deleteWatchlist(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get('id'));
  const { error } = await supabase.from('watchlists').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/portefeuille');
}

export async function setDefaultWatchlist(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get('id'));
  // Reset puis set : index unique partial empêche d'avoir deux is_default.
  await supabase.from('watchlists').update({ is_default: false }).eq('user_id', user.id);
  const { error } = await supabase.from('watchlists').update({ is_default: true }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/portefeuille');
}

export async function addPosition(formData: FormData) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from('portfolios_positions').insert({
    user_id: user.id,
    code: String(formData.get('code')).toUpperCase().trim(),
    quantite: Number(formData.get('quantite')),
    prix_entree: Number(formData.get('prix_entree')),
    date_entree: (formData.get('date_entree') as string) || null,
    note: (formData.get('note') as string) || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/portefeuille');
}

export async function deletePosition(formData: FormData) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from('portfolios_positions').delete().eq('id', String(formData.get('id')));
  if (error) throw new Error(error.message);
  revalidatePath('/portefeuille');
}

export async function addWatchItem(formData: FormData) {
  const { supabase } = await requireUser();
  // Si une watchlist explicite est fournie, on l'utilise ; sinon la défaut.
  const wlFromForm = formData.get('watchlist_id');
  const watchlist_id =
    wlFromForm && String(wlFromForm).length > 0
      ? String(wlFromForm)
      : await defaultWatchlistId();
  const ah = formData.get('prix_alerte_haut');
  const ab = formData.get('prix_alerte_bas');
  const { error } = await supabase.from('watchlist_items').insert({
    watchlist_id,
    code: String(formData.get('code')).toUpperCase().trim(),
    note: (formData.get('note') as string) || null,
    prix_alerte_haut: ah ? Number(ah) : null,
    prix_alerte_bas: ab ? Number(ab) : null,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/portefeuille');
}

export async function deleteWatchItem(formData: FormData) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from('watchlist_items').delete().eq('id', String(formData.get('id')));
  if (error) throw new Error(error.message);
  revalidatePath('/portefeuille');
}

export async function updatePosition(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get('id'));
  const quantite = Number(formData.get('quantite'));
  const prix_entree = Number(formData.get('prix_entree'));
  const date_entree = (formData.get('date_entree') as string) || null;
  const note = (formData.get('note') as string) || null;

  const { error } = await supabase
    .from('portfolios_positions')
    .update({
      quantite,
      prix_entree,
      date_entree,
      note,
    })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/portefeuille');
}

export async function createAlert(formData: FormData) {
  const { supabase, user } = await requireUser();
  const code = String(formData.get('code')).toUpperCase().trim();
  const type = String(formData.get('type'));
  const seuil = Number(formData.get('seuil'));
  const actif = formData.get('actif') === 'true';

  if (!['prix_au_dessus', 'prix_en_dessous', 'variation'].includes(type)) {
    throw new Error('Type d\'alerte invalide');
  }
  if (seuil <= 0) throw new Error('Seuil doit être positif');

  const { error } = await supabase.from('alerts').insert({
    user_id: user.id,
    code,
    type,
    seuil,
    actif,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/portefeuille');
}

export async function updateAlert(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get('id'));
  const type = String(formData.get('type'));
  const seuil = Number(formData.get('seuil'));
  const actif = formData.get('actif') === 'true';

  if (!['prix_au_dessus', 'prix_en_dessous', 'variation'].includes(type)) {
    throw new Error('Type d\'alerte invalide');
  }
  if (seuil <= 0) throw new Error('Seuil doit être positif');

  const { error } = await supabase
    .from('alerts')
    .update({
      type,
      seuil,
      actif,
    })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/portefeuille');
}

export async function deleteAlert(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get('id'));
  const { error } = await supabase.from('alerts').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/portefeuille');
}
