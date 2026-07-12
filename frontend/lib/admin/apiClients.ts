import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';

/** Client d'API tel qu'affiché dans la console admin (jamais la clé en clair). */
export interface ApiClientRow {
  id: string;
  nom: string;
  email: string;
  organisation: string | null;
  motif: string;
  site_url: string | null;
  key_prefix: string | null;
  statut: 'pending' | 'active' | 'rejected' | 'revoked';
  quota_daily: number;
  motif_refus: string | null;
  created_at: string;
  last_used_at: string | null;
  /** Consommation du jour (0 si aucune). */
  usage_today: number;
}

export interface ApiClientsDashboard {
  rows: ApiClientRow[];
  kpis: { pending: number; active: number; revoked: number; requetesToday: number };
}

/** Liste des clients d'API + consommation du jour. */
export async function loadApiClients(): Promise<ApiClientsDashboard> {
  const db = getServiceClient();

  const [{ data: clients }, { data: usage }] = await Promise.all([
    db
      .from('api_clients')
      .select(
        'id, nom, email, organisation, motif, site_url, key_prefix, statut, quota_daily, motif_refus, created_at, last_used_at',
      )
      .order('created_at', { ascending: false })
      .limit(200),
    db.from('api_usage').select('client_id, requetes').eq('jour', new Date().toISOString().slice(0, 10)),
  ]);

  const todayByClient = new Map<string, number>();
  for (const u of (usage ?? []) as { client_id: string; requetes: number }[]) {
    todayByClient.set(u.client_id, u.requetes);
  }

  const rows: ApiClientRow[] = ((clients ?? []) as Omit<ApiClientRow, 'usage_today'>[]).map((c) => ({
    ...c,
    usage_today: todayByClient.get(c.id) ?? 0,
  }));

  return {
    rows,
    kpis: {
      pending: rows.filter((r) => r.statut === 'pending').length,
      active: rows.filter((r) => r.statut === 'active').length,
      revoked: rows.filter((r) => r.statut === 'revoked').length,
      requetesToday: [...todayByClient.values()].reduce((a, b) => a + b, 0),
    },
  };
}
