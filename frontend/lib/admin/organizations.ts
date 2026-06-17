import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';

/* ── Liste ──────────────────────────────────────────────────────────────── */

export interface OrgRow {
  id: string;
  name: string;
  owner_email: string | null;
  member_count: number;
  subscription: { plan: string | null; status: string } | null;
  created_at: string;
}
export interface OrgsDashboard {
  rows: OrgRow[];
  kpis: { total: number; withActiveSub: number; members: number };
}

function planName(raw: unknown): string | null {
  const p = Array.isArray(raw) ? raw[0] : raw;
  return (p as { name?: string } | null)?.name ?? null;
}

/** Liste des organisations : propriétaire, nb de membres, abonnement rattaché, KPIs. */
export async function loadOrganizations(): Promise<OrgsDashboard> {
  const db = getServiceClient();
  const { data } = await db
    .from('organizations')
    .select('id, name, owner_user_id, created_at')
    .order('created_at', { ascending: false })
    .limit(500);
  const orgs = (data ?? []) as { id: string; name: string; owner_user_id: string | null; created_at: string }[];
  if (orgs.length === 0) return { rows: [], kpis: { total: 0, withActiveSub: 0, members: 0 } };

  const orgIds = orgs.map((o) => o.id);
  const ownerIds = Array.from(new Set(orgs.map((o) => o.owner_user_id).filter(Boolean) as string[]));

  // Emails des propriétaires
  const emailById = new Map<string, string | null>();
  if (ownerIds.length) {
    const { data: profs } = await db.from('profiles').select('id, email').in('id', ownerIds);
    for (const p of (profs ?? []) as { id: string; email: string | null }[]) emailById.set(p.id, p.email);
  }

  // Comptage des membres par org
  const { data: members } = await db.from('organization_members').select('organization_id').in('organization_id', orgIds);
  const memberCount = new Map<string, number>();
  for (const m of (members ?? []) as { organization_id: string }[]) {
    memberCount.set(m.organization_id, (memberCount.get(m.organization_id) ?? 0) + 1);
  }

  // Abonnements rattachés
  const { data: subs } = await db
    .from('subscriptions')
    .select('organization_id, status, subscription_plans(name)')
    .in('organization_id', orgIds);
  const subByOrg = new Map<string, { plan: string | null; status: string }>();
  for (const s of (subs ?? []) as Record<string, unknown>[]) {
    const orgId = s.organization_id as string;
    // priorité à un abonnement actif si plusieurs
    const entry = { plan: planName(s.subscription_plans), status: s.status as string };
    const existing = subByOrg.get(orgId);
    if (!existing || (entry.status === 'active' && existing.status !== 'active')) subByOrg.set(orgId, entry);
  }

  const rows: OrgRow[] = orgs.map((o) => ({
    id: o.id,
    name: o.name,
    owner_email: o.owner_user_id ? (emailById.get(o.owner_user_id) ?? null) : null,
    member_count: memberCount.get(o.id) ?? 0,
    subscription: subByOrg.get(o.id) ?? null,
    created_at: o.created_at,
  }));

  return {
    rows,
    kpis: {
      total: rows.length,
      withActiveSub: rows.filter((r) => r.subscription?.status === 'active').length,
      members: rows.reduce((acc, r) => acc + r.member_count, 0),
    },
  };
}

/* ── Détail ─────────────────────────────────────────────────────────────── */

export interface OrgMember {
  user_id: string;
  email: string | null;
  role: string;
  is_premium: boolean;
}
export interface LinkableSub {
  id: string;
  user_email: string | null;
  plan: string | null;
  status: string;
}
export interface OrgDetail {
  id: string;
  name: string;
  owner_email: string | null;
  created_at: string;
  members: OrgMember[];
  subscription: { id: string; plan: string | null; status: string; user_email: string | null } | null;
  linkableSubs: LinkableSub[];
}

/** Détail d'une organisation : membres (+premium), abonnement lié, abonnements rattachables. */
export async function loadOrganization(id: string): Promise<OrgDetail | null> {
  const db = getServiceClient();
  const { data: org } = await db
    .from('organizations')
    .select('id, name, owner_user_id, created_at')
    .eq('id', id)
    .maybeSingle();
  if (!org) return null;
  const o = org as { id: string; name: string; owner_user_id: string | null; created_at: string };

  // Membres
  const { data: memberRows } = await db
    .from('organization_members')
    .select('user_id, role')
    .eq('organization_id', id)
    .order('role', { ascending: true });
  const memberList = (memberRows ?? []) as { user_id: string; role: string }[];

  const profileIds = Array.from(new Set([...memberList.map((m) => m.user_id), o.owner_user_id].filter(Boolean) as string[]));
  const profById = new Map<string, { email: string | null; is_premium: boolean }>();
  if (profileIds.length) {
    const { data: profs } = await db.from('profiles').select('id, email, is_premium').in('id', profileIds);
    for (const p of (profs ?? []) as { id: string; email: string | null; is_premium: boolean }[]) {
      profById.set(p.id, { email: p.email, is_premium: Boolean(p.is_premium) });
    }
  }

  const members: OrgMember[] = memberList.map((m) => ({
    user_id: m.user_id,
    email: profById.get(m.user_id)?.email ?? null,
    role: m.role,
    is_premium: profById.get(m.user_id)?.is_premium ?? false,
  }));

  // Abonnement lié (priorité à l'actif)
  const { data: linked } = await db
    .from('subscriptions')
    .select('id, user_id, status, subscription_plans(name)')
    .eq('organization_id', id);
  const linkedRows = (linked ?? []) as Record<string, unknown>[];
  const chosen = linkedRows.find((s) => s.status === 'active') ?? linkedRows[0];
  let subscription: OrgDetail['subscription'] = null;
  if (chosen) {
    const uid = chosen.user_id as string | null;
    let subEmail: string | null = null;
    if (uid) {
      const { data: p } = await db.from('profiles').select('email').eq('id', uid).maybeSingle();
      subEmail = (p as { email: string | null } | null)?.email ?? null;
    }
    subscription = {
      id: chosen.id as string,
      plan: planName(chosen.subscription_plans),
      status: chosen.status as string,
      user_email: subEmail,
    };
  }

  // Abonnements rattachables : actifs, sans organisation
  const { data: free } = await db
    .from('subscriptions')
    .select('id, user_id, status, subscription_plans(name)')
    .is('organization_id', null)
    .eq('status', 'active')
    .limit(100);
  const freeRows = (free ?? []) as Record<string, unknown>[];
  const freeUserIds = Array.from(new Set(freeRows.map((s) => s.user_id as string).filter(Boolean)));
  const freeEmailById = new Map<string, string | null>();
  if (freeUserIds.length) {
    const { data: profs } = await db.from('profiles').select('id, email').in('id', freeUserIds);
    for (const p of (profs ?? []) as { id: string; email: string | null }[]) freeEmailById.set(p.id, p.email);
  }
  const linkableSubs: LinkableSub[] = freeRows.map((s) => ({
    id: s.id as string,
    user_email: freeEmailById.get(s.user_id as string) ?? null,
    plan: planName(s.subscription_plans),
    status: s.status as string,
  }));

  return {
    id: o.id,
    name: o.name,
    owner_email: o.owner_user_id ? (profById.get(o.owner_user_id)?.email ?? null) : null,
    created_at: o.created_at,
    members,
    subscription,
    linkableSubs,
  };
}
