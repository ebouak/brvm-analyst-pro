'use client';

import { useEffect, useState } from 'react';
import { requireAdmin } from '@/lib/server/rbac';
import VeilleDigestTable from '@/components/admin/VeilleDigestTable';
import VeilleAlertsPanel from '@/components/admin/VeilleAlertsPanel';

interface VeilleDigest {
  id: number;
  source: string;
  category: string;
  title: string;
  summary: string;
  url: string;
  relevance_score: number;
  sentiment: string;
  is_critical: boolean;
  created_at: string;
  tags: string[];
}

interface VeilleAlert {
  id: number;
  digest_id: number;
  alert_type: string;
  severity: string;
  description: string;
  recommended_action: string;
  created_at: string;
  acknowledged_at: string | null;
}

export default function VeilleBRVMPage() {
  const [digest, setDigest] = useState<VeilleDigest[]>([]);
  const [alerts, setAlerts] = useState<VeilleAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [digestRes, alertsRes] = await Promise.all([
          fetch('/api/admin/veille/digest'),
          fetch('/api/admin/veille/alerts'),
        ]);

        if (!digestRes.ok || !alertsRes.ok) {
          throw new Error('Failed to fetch veille data');
        }

        const digestData = await digestRes.json();
        const alertsData = await alertsRes.json();

        setDigest(digestData.data || []);
        setAlerts(alertsData.data || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        console.error('Error loading veille data:', err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-accent">
          BRVM Veille Intelligente
        </h1>
        <p className="text-muted text-sm mt-2">
          Monitoring en temps réel: GitHub issues, Twitter, Stack Overflow, YouTube, RSS, LinkedIn
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-300 text-sm">
          Erreur: {error}
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-muted text-xs font-semibold mb-1">Total Articles</div>
          <div className="text-2xl font-bold text-accent">
            {digest.length}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-muted text-xs font-semibold mb-1">Critiques</div>
          <div className="text-2xl font-bold text-gold">
            {digest.filter((d) => d.is_critical).length}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-muted text-xs font-semibold mb-1">Alertes Non Lues</div>
          <div className="text-2xl font-bold text-orange-400">
            {alerts.filter((a) => !a.acknowledged_at).length}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-muted text-xs font-semibold mb-1">Sources Actives</div>
          <div className="text-2xl font-bold text-accent">
            6
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <VeilleAlertsPanel
          alerts={alerts}
          onAcknowledge={async (alertId) => {
            try {
              const res = await fetch(
                `/api/admin/veille/alerts/${alertId}/acknowledge`,
                { method: 'POST' }
              );
              if (res.ok) {
                setAlerts(
                  alerts.map((a) =>
                    a.id === alertId
                      ? { ...a, acknowledged_at: new Date().toISOString() }
                      : a
                  )
                );
              }
            } catch (err) {
              console.error('Failed to acknowledge alert:', err);
            }
          }}
        />
      )}

      {/* Digest Table */}
      <VeilleDigestTable digest={digest} loading={loading} />
    </div>
  );
}
