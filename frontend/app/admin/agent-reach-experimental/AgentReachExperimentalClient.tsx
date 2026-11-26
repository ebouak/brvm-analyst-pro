'use client';

import AgentReachConsole from '@/components/admin/AgentReachConsole';

export default function AgentReachExperimentalClient() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-accent">
          Agent Reach — Experimental
        </h1>
        <p className="text-muted text-sm mt-2">
          Test advanced Agent Reach features for multi-source monitoring
        </p>
      </div>

      <div className="bg-gold/20 border border-gold/50 rounded-lg p-4">
        <div className="text-gold font-semibold text-sm mb-2">Experimental Feature</div>
        <p className="text-muted text-sm">
          Agent Reach is an experimental tool for advanced multi-source intelligence gathering.
          For production use, prefer the native <strong>BRVM Veille Intelligente</strong> system
          in the admin panel.
        </p>
      </div>

      <AgentReachConsole />
    </div>
  );
}
