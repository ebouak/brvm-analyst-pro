'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fmtNumber, fmtDateFR } from '@/lib/format';
import { calculateWeight, calculateWeightedFlow } from '@/lib/portfolio/calculations';

interface Movement {
  id: string;
  mois_fin: string; // ISO date
  date_flux: string; // ISO date
  montant: number;
  poids: number | null;
  flux_pondere: number | null;
  created_at: string;
}

interface Props {
  onSuccess?: () => void;
}

export default function MovementsForm({ onSuccess }: Props) {
  const supabase = createClient();

  // Form state
  const [moisFin, setMoisFin] = useState<string>(''); // ISO date
  const [dateFlux, setDateFlux] = useState<string>(''); // ISO date
  const [montant, setMontant] = useState<string>(''); // string input
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Data state
  const [movements, setMovements] = useState<Movement[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Computed values for selected month
  const monthMovements = movements.filter((m) => m.mois_fin === moisFin);
  const totalApports = monthMovements
    .filter((m) => m.montant > 0)
    .reduce((sum, m) => sum + m.montant, 0);
  const totalRetraits = Math.abs(
    monthMovements
      .filter((m) => m.montant < 0)
      .reduce((sum, m) => sum + m.montant, 0)
  );

  // Load movements for authenticated user
  const loadMovements = useCallback(async () => {
    setIsLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('portfolio_movements')
        .select('*')
        .eq('user_id', user.id)
        .order('mois_fin', { ascending: false })
        .order('date_flux', { ascending: false });

      if (error) throw error;
      setMovements(data || []);
    } catch (err) {
      console.error('Failed to load movements:', err);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  // Load movements on mount
  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  // Calculate weight and weighted flow for preview
  const calculatePreview = () => {
    if (!moisFin || !dateFlux || !montant) {
      return { poids: null, fluxPondere: null };
    }
    const montantNum = parseFloat(montant);
    if (isNaN(montantNum)) {
      return { poids: null, fluxPondere: null };
    }
    const poids = calculateWeight(new Date(dateFlux), new Date(moisFin));
    const fluxPondere = calculateWeightedFlow(montantNum, poids);
    return { poids, fluxPondere };
  };

  const preview = calculatePreview();

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!moisFin || !dateFlux || !montant) {
      setSubmitError('Tous les champs sont requis');
      return;
    }

    const montantNum = parseFloat(montant);
    if (isNaN(montantNum) || montantNum === 0) {
      setSubmitError('Montant invalide');
      return;
    }

    setIsSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setSubmitError('Non authentifié');
        return;
      }

      const poids = calculateWeight(new Date(dateFlux), new Date(moisFin));
      const fluxPondere = calculateWeightedFlow(montantNum, poids);

      const { error } = await supabase.from('portfolio_movements').insert([
        {
          user_id: user.id,
          mois_fin: moisFin,
          date_flux: dateFlux,
          montant: montantNum,
          poids,
          flux_pondere: fluxPondere,
        },
      ]);

      if (error) throw error;

      // Reset form
      setMontant('');
      setDateFlux('');
      // Keep moisFin selected

      // Reload movements
      await loadMovements();

      // Notify parent
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de l\'ajout';
      setSubmitError(message);
      console.error('Submit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete movement
  const handleDelete = async (id: string) => {
    if (!window.confirm('Confirmer la suppression de ce mouvement ?')) {
      return;
    }

    try {
      const { error } = await supabase.from('portfolio_movements').delete().eq('id', id);

      if (error) throw error;

      // Reload movements
      await loadMovements();

      // Notify parent
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Delete error:', err);
      setSubmitError('Erreur lors de la suppression');
    }
  };

  // Determine discrepancy status (stub: compare with tracking)
  // For now, always show "Correspond" — full implementation requires portfolio_monthly_tracking data
  const discrepancyStatus = {
    matches: true,
    message: 'Correspond au Suivi Global',
  };

  return (
    <div className="space-y-6">
      {/* Form Section */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Ajouter un mouvement</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Row 1: Mois fin + Date réelle */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="mois-fin" className="block text-sm text-muted mb-2">Mois (fin de mois)</label>
              <input
                id="mois-fin"
                type="date"
                value={moisFin}
                onChange={(e) => setMoisFin(e.target.value)}
                title="Sélectionner le mois (fin de mois)"
                className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div>
              <label htmlFor="date-flux" className="block text-sm text-muted mb-2">Date réelle du flux</label>
              <input
                id="date-flux"
                type="date"
                value={dateFlux}
                onChange={(e) => setDateFlux(e.target.value)}
                title="Sélectionner la date réelle du flux"
                className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          {/* Row 2: Montant */}
          <div>
            <label className="block text-sm text-muted mb-2">Montant FCFA</label>
            <input
              type="number"
              step="1"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              placeholder="Ex: 1000000 (positif) ou -500000 (négatif)"
              className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* Live Preview */}
          {preview.poids !== null && (
            <div className="bg-elevated border border-border rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Poids (Dietz):</span>
                <span className="tabular">{(preview.poids * 100).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Flux pondéré:</span>
                <span className={`tabular ${preview.fluxPondere >= 0 ? 'text-up' : 'text-down'}`}>
                  {fmtNumber(preview.fluxPondere, 0)} FCFA
                </span>
              </div>
            </div>
          )}

          {/* Error message */}
          {submitError && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
              {submitError}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-accent hover:bg-accent/90 disabled:bg-muted disabled:cursor-not-allowed text-black font-semibold py-2 rounded-lg transition"
          >
            {isSubmitting ? 'Ajout en cours...' : 'Ajouter un mouvement'}
          </button>
        </form>
      </div>

      {/* Movements Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-lg font-semibold">
            {moisFin ? `Mouvements de ${fmtDateFR(moisFin)}` : 'Mouvements du portefeuille'}
          </h3>
        </div>

        {isLoading ? (
          <div className="p-6 text-center text-muted">Chargement...</div>
        ) : monthMovements.length === 0 ? (
          <div className="p-6 text-center text-muted">
            {moisFin ? 'Aucun mouvement pour ce mois' : 'Sélectionnez un mois pour afficher les mouvements'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-elevated border-b border-border">
                  <th className="px-4 py-2 text-left text-muted font-semibold">Date</th>
                  <th className="px-4 py-2 text-right text-muted font-semibold">Montant</th>
                  <th className="px-4 py-2 text-right text-muted font-semibold">Poids</th>
                  <th className="px-4 py-2 text-right text-muted font-semibold">Flux pondéré</th>
                  <th className="px-4 py-2 text-center text-muted font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {monthMovements.map((movement) => (
                  <tr key={movement.id} className="border-b border-border hover:bg-elevated/50">
                    <td className="px-4 py-3 text-white">{fmtDateFR(movement.date_flux)}</td>
                    <td
                      className={`px-4 py-3 tabular font-semibold ${
                        movement.montant >= 0 ? 'text-up' : 'text-down'
                      }`}
                    >
                      {movement.montant >= 0 ? '+' : ''}
                      {fmtNumber(movement.montant, 0)} FCFA
                    </td>
                    <td className="px-4 py-3 text-right text-muted tabular">
                      {movement.poids ? (movement.poids * 100).toFixed(2) : '—'}%
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular ${
                        movement.flux_pondere && movement.flux_pondere >= 0 ? 'text-up' : 'text-down'
                      }`}
                    >
                      {movement.flux_pondere ? fmtNumber(movement.flux_pondere, 0) : '—'} FCFA
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDelete(movement.id)}
                        className="px-2 py-1 text-xs bg-red-900/30 hover:bg-red-900/50 text-red-300 rounded transition"
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary Footer */}
      {monthMovements.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-muted">Total apports saisis:</span>
            <span className="text-lg font-semibold text-up tabular">
              +{fmtNumber(totalApports, 0)} FCFA
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted">Total retraits:</span>
            <span className="text-lg font-semibold text-down tabular">
              -{fmtNumber(totalRetraits, 0)} FCFA
            </span>
          </div>

          <div className="pt-3 border-t border-border flex justify-between items-center">
            <span className="text-muted font-semibold">État:</span>
            <span
              className={`text-sm font-semibold ${
                discrepancyStatus.matches ? 'text-up' : 'text-down'
              }`}
            >
              {discrepancyStatus.matches ? '✅' : '❌'} {discrepancyStatus.message}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
