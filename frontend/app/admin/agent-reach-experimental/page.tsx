'use client';

import AgentReachConsole from '@/components/admin/AgentReachConsole';

export default function AgentReachExperimentalPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-accent">
          🧪 Agent Reach — Experimental
        </h1>
        <p className="text-muted text-sm mt-2">
          Test advanced Agent Reach features for multi-source monitoring
        </p>
      </div>

      {/* Warning Banner */}
      <div className="bg-gold/20 border border-gold/50 rounded-lg p-4">
        <div className="text-gold font-semibold text-sm mb-2">⚠️ Experimental Feature</div>
        <p className="text-muted text-sm">
          Agent Reach is an experimental tool for advanced multi-source intelligence gathering.
          For production use, prefer the native <strong>BRVM Veille Intelligente</strong> system
          in the admin panel.
        </p>
      </div>

      {/* Agent Reach Console */}
      <AgentReachConsole />

      {/* Info Section */}
      <div className="bg-elevated border border-border rounded-lg p-6 space-y-4">
        <h2 className="font-semibold text-accent">À propos d'Agent Reach</h2>
        <div className="space-y-3 text-sm text-muted">
          <p>
            <strong className="text-white">Agent Reach</strong> est un outil expérimental pour
            orchestrer des requêtes multi-sources vers GitHub, Twitter, Stack Overflow, YouTube
            et RSS.
          </p>
          <p>
            Contrairement au système de Veille BRVM intégré (production-ready), Agent Reach
            permet des requêtes personnalisées et des expérimentations.
          </p>
          <p className="text-xs">
            📌 <strong>Installation requise:</strong> <code className="text-accent">npm install agent-reach</code> dans le scraper
          </p>
        </div>
      </div>
    </div>
  );
}
