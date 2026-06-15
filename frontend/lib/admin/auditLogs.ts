import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}

export interface AuditLogRow {
  id: string;
  actor_role: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  severity: string;
  created_at: string | null;
}

/** Charge les dernières entrées du journal d'audit (lecture seule, tolérant). */
export async function loadAuditLogs(limit = 60): Promise<AuditLogRow[]> {
  const db = getAdminClient();
  const { data } = await db
    .from('admin_audit_logs')
    .select('id, actor_role, action, resource_type, resource_id, severity, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as AuditLogRow[];
}
