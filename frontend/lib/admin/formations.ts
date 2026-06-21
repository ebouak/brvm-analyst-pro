import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';

export interface AdminFormation {
  id: string;
  titre: string;
  description: string | null;
  type: 'cours' | 'conference' | 'webinaire';
  niveau: string | null;
  date_evenement: string | null;
  duree_min: number | null;
  cover_url: string | null;
  replay_url: string | null;
  support_url: string | null;
  published: boolean;
  created_at: string;
}

/** Toutes les formations (publiées ou non) pour la console admin. */
export async function loadAdminFormations(): Promise<{ rows: AdminFormation[]; kpis: { total: number; published: number } }> {
  const sb = getServiceClient();
  const { data } = await sb.from('formations').select('*').order('created_at', { ascending: false });
  const rows = (data ?? []) as AdminFormation[];
  return { rows, kpis: { total: rows.length, published: rows.filter((r) => r.published).length } };
}
