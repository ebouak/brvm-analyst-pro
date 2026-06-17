import { getServiceClient } from '@/lib/billing/serviceClient';
import { computeLeadKpis, type LeadKpis, type LeadLevel, type LeadStatut } from '@/lib/leads';

export interface LeadRow {
  id: string;
  created_at: string;
  nom: string;
  email: string;
  telephone: string | null;
  pays: string | null;
  message: string | null;
  niveau: LeadLevel | null;
  source: string;
  statut: LeadStatut;
  consent: boolean;
  consent_at: string | null;
}

export interface LeadsDashboard {
  rows: LeadRow[];
  kpis: LeadKpis;
}

const COLS =
  'id, created_at, nom, email, telephone, pays, message, niveau, source, statut, consent, consent_at';

/**
 * Charge les leads pour l'inbox admin (service-role, RLS sans select anonyme).
 * Filtre optionnel par statut + recherche texte (nom/email). Les KPIs sont
 * calculés sur l'ensemble (non filtré) pour rester stables.
 */
export async function loadLeads(opts: { statut?: string; search?: string } = {}): Promise<LeadsDashboard> {
  const db = getServiceClient();

  let query = db.from('leads_brvm').select(COLS).order('created_at', { ascending: false }).limit(300);
  if (opts.statut && opts.statut !== 'tous') query = query.eq('statut', opts.statut);
  if (opts.search && opts.search.trim()) {
    const s = opts.search.trim();
    query = query.or(`nom.ilike.%${s}%,email.ilike.%${s}%`);
  }

  const [listRes, allRes] = await Promise.all([
    query,
    db.from('leads_brvm').select('statut'),
  ]);

  const rows = (listRes.data ?? []) as LeadRow[];
  const kpis = computeLeadKpis((allRes.data ?? []) as { statut: LeadStatut }[]);
  return { rows, kpis };
}
