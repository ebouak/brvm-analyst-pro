import { createClient } from '@/lib/supabase/server';
import type { Stance } from '@/lib/theses/status';

export interface TheseRow {
  id: string;
  code: string;
  stance: Stance;
  cours_reference: number | null;
  objectif: number | null;
  horizon: string | null;
  these: string;
  statut: 'active' | 'cloturee';
  verdict: string | null;
  bilan: string | null;
  cours_cloture: number | null;
  cloturee_le: string | null;
  created_at: string;
  updated_at: string;
}

/** Toutes les thèses de l'utilisateur courant, actives d'abord. RLS owner. */
export async function loadTheses(): Promise<TheseRow[]> {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return [];
  const { data } = await sb
    .from('investment_theses')
    .select('id, code, stance, cours_reference, objectif, horizon, these, statut, verdict, bilan, cours_cloture, cloturee_le, created_at, updated_at')
    .eq('user_id', user.id)
    .order('statut', { ascending: true })        // 'active' avant 'cloturee'
    .order('updated_at', { ascending: false });
  return (data ?? []) as TheseRow[];
}
