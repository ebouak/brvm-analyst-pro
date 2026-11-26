import { can, requirePermission } from '@/lib/server/rbac';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { WORKFLOWS_AUTORISES } from '@/lib/opsAgent/githubDispatch';
import { SectionHeader } from '@/components/ui/premium';
import OpsConsoleClient, { type CommandRunRow, type IncidentRow } from './OpsConsoleClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bot Ops & Canaux — Administration' };

export default async function OpsAdminPage() {
  const ctx = await requirePermission('scraping.read');
  const canDispatch = can(ctx, 'scraping.retry');
  const db = getServiceClient();

  const [incRes, runsRes] = await Promise.all([
    db
      .from('ops_incidents')
      .select('id, type_alerte, gravite, titre, detail, statut, escalade_vocale_at, cree_le')
      .order('cree_le', { ascending: false })
      .limit(20),
    db
      .from('ops_command_runs')
      .select('id, source, commande, statut, workflow_fichier, erreur, cree_le')
      .order('cree_le', { ascending: false })
      .limit(30),
  ]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader
        title="Bot Ops &amp; Canaux"
        subtitle="Orchestrateur Telegram d'exploitation, sondes temps réel (LLM, WAHA, Resend, Bland), incidents et déclenchement de workflows."
      />
      <div className="gold-rule" />
      <OpsConsoleClient
        workflows={WORKFLOWS_AUTORISES}
        incidentsInit={(incRes.data ?? []) as IncidentRow[]}
        runs={(runsRes.data ?? []) as CommandRunRow[]}
        canDispatch={canDispatch}
      />
    </div>
  );
}
