import { headers } from 'next/headers';
import { getServiceClient } from '@/lib/billing/serviceClient';
import type { AdminContext } from './rbac';

export interface AuditEntry {
  /** Verbe.objet, ex. 'payment.confirm', 'user.suspend'. */
  action: string;
  /** Type de ressource concernée, ex. 'subscription', 'user'. */
  resourceType: string;
  resourceId?: string | null;
  targetUserId?: string | null;
  severity?: 'info' | 'warning' | 'critical';
  metadata?: Record<string, unknown>;
}

/**
 * Journalise une action d'administration sensible dans `admin_audit_logs`.
 * IP/user-agent stockés pour la traçabilité sécurité (intérêt légitime, purgés
 * à 12 mois par la rétention RGPD — cf. docs/RGPD.md). N'échoue JAMAIS l'action
 * métier : toute erreur d'écriture est avalée.
 */
export async function recordAudit(ctx: AdminContext, entry: AuditEntry): Promise<void> {
  try {
    const h = headers();
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
    const ua = h.get('user-agent') ?? null;
    const db = getServiceClient();
    await db.from('admin_audit_logs').insert({
      actor_user_id: ctx.userId,
      actor_role: ctx.isSuperAdmin ? 'super_admin' : (ctx.roles[0] ?? null),
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId ?? null,
      target_user_id: entry.targetUserId ?? null,
      severity: entry.severity ?? 'info',
      ip_address: ip,
      user_agent: ua,
      metadata: entry.metadata ?? {},
    });
  } catch {
    /* l'audit ne doit jamais faire échouer l'action métier */
  }
}
