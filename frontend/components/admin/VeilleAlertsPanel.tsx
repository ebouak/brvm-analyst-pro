'use client';

import { useState } from 'react';

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

interface VeilleAlertsPanelProps {
  alerts: VeilleAlert[];
  onAcknowledge?: (alertId: number) => Promise<void>;
}

export default function VeilleAlertsPanel({
  alerts,
  onAcknowledge,
}: VeilleAlertsPanelProps) {
  const [acknowledging, setAcknowledging] = useState<number | null>(null);

  const unacknowledgedAlerts = alerts.filter((a) => !a.acknowledged_at);

  if (unacknowledgedAlerts.length === 0) {
    return null;
  }

  const severityColors: Record<string, string> = {
    high: 'bg-red-500/20 border-red-500/50 text-red-300',
    medium: 'bg-orange-500/20 border-orange-500/50 text-orange-300',
    low: 'bg-blue-500/20 border-blue-500/50 text-blue-300',
  };

  const alertTypeLabels: Record<string, string> = {
    regulatory_change: '📋 Changement Réglementaire',
    competitor_move: '🎯 Mouvement Concurrent',
    technical_vulnerability: '🔓 Vulnérabilité Technique',
    market_shock: '⚡ Choc de Marché',
    systemic_risk: '⚠️ Risque Systémique',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="text-2xl">🚨</div>
        <h2 className="font-semibold text-gold text-lg">
          Alertes Critiques ({unacknowledgedAlerts.length})
        </h2>
      </div>

      <div className="space-y-2">
        {unacknowledgedAlerts.map((alert) => (
          <div
            key={alert.id}
            className={`border rounded-lg p-4 ${
              severityColors[alert.severity] ||
              'bg-blue-500/20 border-blue-500/50 text-blue-300'
            }`}
          >
            {/* Alert Type and Severity */}
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="font-semibold text-sm">
                {alertTypeLabels[alert.alert_type] || alert.alert_type}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase px-2 py-1 bg-black/30 rounded">
                  {alert.severity === 'high' && '🔴'}
                  {alert.severity === 'medium' && '🟠'}
                  {alert.severity === 'low' && '🔵'} {alert.severity}
                </span>
              </div>
            </div>

            {/* Description */}
            {alert.description && (
              <p className="text-sm mb-3 opacity-90">
                {alert.description}
              </p>
            )}

            {/* Recommended Action */}
            {alert.recommended_action && (
              <div className="bg-black/20 rounded p-3 mb-3">
                <div className="text-xs font-semibold mb-1 opacity-75">Action Recommandée:</div>
                <div className="text-sm">{alert.recommended_action}</div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 text-xs opacity-75">
              <span>{new Date(alert.created_at).toLocaleString('fr-FR')}</span>
              {onAcknowledge && (
                <button
                  onClick={async () => {
                    setAcknowledging(alert.id);
                    try {
                      await onAcknowledge(alert.id);
                    } finally {
                      setAcknowledging(null);
                    }
                  }}
                  disabled={acknowledging === alert.id}
                  className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-xs font-semibold transition disabled:opacity-50"
                >
                  {acknowledging === alert.id ? 'Traitement...' : '✓ Reconnaître'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
