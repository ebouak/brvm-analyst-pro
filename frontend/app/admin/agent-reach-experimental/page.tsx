import { requirePermission } from '@/lib/server/rbac';
import AgentReachExperimentalClient from './AgentReachExperimentalClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Agent Reach — Administration' };

export default async function AgentReachExperimentalPage() {
  await requirePermission('settings.write');
  return <AgentReachExperimentalClient />;
}
