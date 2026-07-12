import { getServiceClient } from '@/lib/billing/serviceClient';

export interface AuditLogRow {
  id: string;
  actor_user_id: string | null;
  actor_role: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  target_user_id: string | null;
  severity: string;
  /** IP de l'administrateur — tracée pour la sécurité (elle n'était jamais affichée). */
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  /** Email de l'auteur, résolu depuis profiles (un UUID ne dit rien à personne). */
  actor_email: string | null;
  target_email: string | null;
}

export interface AuditFilters {
  /** Ne garder que les actions critiques (suppression, suspension, révocation…). */
  criticalOnly?: boolean;
  /** Filtre sur le verbe d'action (ex. 'user.suspend'). */
  action?: string;
  limit?: number;
}

export interface AuditDashboard {
  rows: AuditLogRow[];
  /** Actions distinctes présentes (alimente le filtre). */
  actions: string[];
  kpis: { total: number; critical24h: number; warning24h: number };
}

export async function loadAuditLogs(filters: AuditFilters = {}): Promise<AuditDashboard> {
  const { criticalOnly = false, action, limit = 100 } = filters;
  const db = getServiceClient();

  let q = db
    .from('admin_audit_logs')
    .select(
      'id, actor_user_id, actor_role, action, resource_type, resource_id, target_user_id, severity, ip_address, user_agent, metadata, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (criticalOnly) q = q.eq('severity', 'critical');
  if (action) q = q.eq('action', action);

  const { data } = await q;
  const raw = (data ?? []) as Omit<AuditLogRow, 'actor_email' | 'target_email'>[];

  // Résolution des emails : un journal qui n'affiche que des UUID est illisible.
  const ids = [
    ...new Set(
      raw.flatMap((r) => [r.actor_user_id, r.target_user_id]).filter((v): v is string => Boolean(v)),
    ),
  ];
  const emailById = new Map<string, string>();
  if (ids.length > 0) {
    const { data: profiles } = await db.from('profiles').select('id, email').in('id', ids);
    for (const p of (profiles ?? []) as { id: string; email: string | null }[]) {
      if (p.email) emailById.set(p.id, p.email);
    }
  }

  const rows: AuditLogRow[] = raw.map((r) => ({
    ...r,
    actor_email: r.actor_user_id ? (emailById.get(r.actor_user_id) ?? null) : null,
    target_email: r.target_user_id ? (emailById.get(r.target_user_id) ?? null) : null,
  }));

  // KPIs sur 24 h — indépendants des filtres (sinon le tableau de bord mentirait).
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [{ count: total }, { count: critical24h }, { count: warning24h }] = await Promise.all([
    db.from('admin_audit_logs').select('*', { count: 'exact', head: true }),
    db
      .from('admin_audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('severity', 'critical')
      .gte('created_at', since),
    db
      .from('admin_audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('severity', 'warning')
      .gte('created_at', since),
  ]);

  // Liste des actions distinctes (PostgREST n'a pas de DISTINCT : on déduplique
  // sur un échantillon récent, suffisant pour alimenter un filtre).
  const { data: recent } = await db
    .from('admin_audit_logs')
    .select('action')
    .order('created_at', { ascending: false })
    .limit(500);
  const actions = [...new Set(((recent ?? []) as { action: string }[]).map((r) => r.action))].sort();

  return {
    rows,
    actions,
    kpis: { total: total ?? 0, critical24h: critical24h ?? 0, warning24h: warning24h ?? 0 },
  };
}

/** Dernières connexions d'un utilisateur (IP, appareil) — fiche admin. */
export interface AuthEventRow {
  id: number;
  event: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export async function loadAuthEvents(userId: string, limit = 10): Promise<AuthEventRow[]> {
  const db = getServiceClient();
  const { data } = await db
    .from('auth_events')
    .select('id, event, ip_address, user_agent, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as AuthEventRow[];
}
