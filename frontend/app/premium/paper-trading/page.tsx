'use client';

import { useState, useEffect } from 'react';
import { PaperTradingDashboard } from '@/components/PaperTradingDashboard';
import { PaperLeaderboard } from '@/components/PaperLeaderboard';
import { paperTradingService } from '@/lib/paper-trading/service';
import { Account } from '@/lib/paper-trading/types';
import { phCapture } from '@/lib/analytics/posthogClient';

const PRESET_CAPITALS = [
  { label: '5M FCFA', value: 5_000_000 },
  { label: '10M FCFA', value: 10_000_000 },
  { label: '50M FCFA', value: 50_000_000 },
];

export default function PaperTradingPage() {
  const [account, setAccount] = useState<Account | null | 'loading'>('loading');
  const [customCapital, setCustomCapital] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkAccount() {
      try {
        const { account: acc } = await paperTradingService.getPositions();
        setAccount(acc);
        if (!acc) {
          setShowModal(true);
        }
      } catch (err) {
        console.error('Failed to check account:', err);
        setAccount(null);
        setShowModal(true);
      }
    }

    checkAccount();
  }, []);

  const handleInitialize = async (capital: number) => {
    try {
      setError(null);
      const acc = await paperTradingService.initializeAccount(capital);
      setAccount(acc);
      setShowModal(false);
      void phCapture('paper_trading_started', { capital_initial: capital });
    } catch (err) {
      setError((err as Error).message || 'Failed to initialize account');
    }
  };

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="space-y-2 mb-8">
          <h1 className="text-2xl md:text-3xl font-semibold text-white">
            Paper Trading
          </h1>
          <p className="text-sm text-muted">
            Testez vos signaux sans risquer votre capital
          </p>
        </div>

        {account === 'loading' && (
          <div className="text-center text-muted py-8">
            Vérification du compte...
          </div>
        )}

        {account === null && !showModal && (
          <div className="mt-8 bg-surface border border-border rounded-lg p-8 text-center">
            <p className="text-white mb-6">
              Pas encore de compte paper trading. Créez-en un maintenant.
            </p>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="bg-info hover:bg-info/90 text-white px-6 py-2 rounded transition"
            >
              Initialiser un compte
            </button>
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-elevated border border-border rounded-lg p-6 w-full max-w-md shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-4">
                Capital fictif initial
              </h3>

              {error && (
                <div className="mb-4 p-3 bg-down/10 border border-down/30 rounded text-down text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-3 mb-6">
                {PRESET_CAPITALS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => handleInitialize(preset.value)}
                    className="w-full bg-surface hover:bg-surface/80 border border-border rounded p-3 text-white transition text-left text-sm font-medium"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="space-y-2 border-t border-border/30 pt-4">
                <label className="text-xs text-muted">
                  Ou un montant personnalisé
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={customCapital}
                    onChange={(e) => {
                      setCustomCapital(e.target.value);
                      setError(null);
                    }}
                    placeholder="Ex: 25000000"
                    className="flex-1 bg-surface border border-border rounded px-3 py-2 text-white text-sm placeholder:text-muted/50 focus:outline-none focus:border-info"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customCapital) {
                        handleInitialize(parseInt(customCapital));
                      } else {
                        setError('Veuillez entrer un montant');
                      }
                    }}
                    className="bg-info hover:bg-info/90 text-white px-4 py-2 rounded transition text-sm font-medium"
                  >
                    Créer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {account && account !== 'loading' && (
          <div className="mt-8">
            <PaperTradingDashboard />
          </div>
        )}

        {/* Classement anonymisé (opt-in) — visible même sans compte, en lecture */}
        <div className="mt-8">
          <PaperLeaderboard withControls={Boolean(account && account !== 'loading')} />
        </div>
      </div>
    </div>
  );
}
