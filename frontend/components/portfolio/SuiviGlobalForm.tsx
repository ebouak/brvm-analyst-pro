'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAddMonthlyEntry, useMonthlyTracking } from '@/lib/portfolio/queries';
import { fmtFcfa, fmtDateFR, fmtNumber } from '@/lib/format';
import { calculateIndex, calculateMonthlyPerformance, formatPercentage } from '@/lib/portfolio/calculations';
import type { MonthlyTrackingEntry } from '@/lib/portfolio/queries';
import type { SupabaseClient } from '@supabase/supabase-js';

interface Props {
  userId: string;
  onSuccess?: () => void;
}

/**
 * SuiviGlobalForm: Monthly portfolio tracking entry form
 * - Date picker (end of month, DD/MM/YYYY)
 * - Valeur Finale FCFA input with live formatting
 * - Live preview: estimated performance + index
 * - "Enregistrer" button POSTs via useAddMonthlyEntry
 * - Historical table below (read-only)
 */
export default function SuiviGlobalForm({ userId, onSuccess }: Props) {

  // Form state
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [valeurFinale, setValeurFinale] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Live preview state
  const [livePerformance, setLivePerformance] = useState<number | null>(null);
  const [liveIndex, setLiveIndex] = useState<number | null>(null);

  // Data loading
  const { data: entries, isLoading, error: fetchError } = useMonthlyTracking(userId || '');
  const { mutate, isLoading: isMutating, error: mutateError } = useAddMonthlyEntry();

  const clientRef = useRef<SupabaseClient | null>(null);

  // Initialize Supabase client
  useEffect(() => {
    if (!clientRef.current) {
      clientRef.current = createClient();
    }
  }, []);

  // Calculate live preview when date or value changes
  useEffect(() => {
    if (!selectedDate || !valeurFinale || !entries || entries.length === 0) {
      setLivePerformance(null);
      setLiveIndex(null);
      return;
    }

    const entryDate = new Date(selectedDate);
    const lastEntry = entries[0]; // Most recent entry (DESC order)

    if (!lastEntry || !lastEntry.valeur_finale || lastEntry.indice_base100 === null) {
      setLivePerformance(null);
      setLiveIndex(null);
      return;
    }

    const valeurFinaleNum = parseFloat(valeurFinale.replace(/\s/g, ''));
    if (isNaN(valeurFinaleNum)) {
      setLivePerformance(null);
      setLiveIndex(null);
      return;
    }

    // Calculate performance using Modified Dietz
    // For simplicity in preview, assume no movements (empty array)
    // In real scenario, fetch movements for this month
    const movements: Array<{ montant: number; poids: number }> = [];
    const monthlyPerf = calculateMonthlyPerformance(
      valeurFinaleNum,
      lastEntry.valeur_finale,
      movements
    );

    // Calculate new index
    const newIndex = calculateIndex(lastEntry.indice_base100, monthlyPerf);

    setLivePerformance(monthlyPerf);
    setLiveIndex(newIndex);
  }, [selectedDate, valeurFinale, entries]);

  // Handle date input (convert DD/MM/YYYY to YYYY-MM-DD ISO)
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSelectedDate(value);
  };

  // Handle numeric input with live formatting
  const handleValeurFinaleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\s/g, ''); // Remove spaces
    setValeurFinale(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    if (!userId) {
      setSubmitError('User not authenticated');
      return;
    }

    if (!selectedDate || !valeurFinale) {
      setSubmitError('Date et valeur finale sont requis');
      return;
    }

    try {
      setIsSubmitting(true);

      const entryDate = new Date(selectedDate);
      const valeurFinaleNum = parseFloat(valeurFinale.replace(/\s/g, ''));

      if (isNaN(valeurFinaleNum)) {
        setSubmitError('Valeur finale invalide');
        return;
      }

      // Get last entry for initial value
      if (!entries || entries.length === 0) {
        setSubmitError('Aucune entrée précédente. Veuillez créer une première entrée manuellement.');
        return;
      }

      const lastEntry = entries[0];
      const valeurInitiale = lastEntry.valeur_finale || 0;
      const indexPrecedent = lastEntry.indice_base100 || 100;

      // Fetch movements for this month
      const monthStart = new Date(entryDate.getFullYear(), entryDate.getMonth(), 1);
      const moisFinStr = selectedDate;

      if (!clientRef.current) {
        clientRef.current = createClient();
      }

      const { data: movements, error: movError } = await clientRef.current
        .from('portfolio_movements')
        .select('*')
        .eq('user_id', userId)
        .eq('mois_fin', moisFinStr);

      if (movError) {
        setSubmitError(`Erreur de chargement des mouvements: ${movError.message}`);
        return;
      }

      // Calculate performance with movements
      const movArray: Array<{ montant: number; poids: number }> = (movements || []).map((m: any) => ({
        montant: m.montant as number,
        poids: (m.poids as number) || 0,
      }));

      const monthlyPerf = calculateMonthlyPerformance(
        valeurFinaleNum,
        valeurInitiale,
        movArray
      );

      const newIndex = calculateIndex(indexPrecedent, monthlyPerf);

      // Create entry object
      const newEntry: Omit<MonthlyTrackingEntry, 'id' | 'created_at' | 'updated_at'> = {
        user_id: userId,
        date: selectedDate,
        year: entryDate.getFullYear(),
        valeur_initiale: valeurInitiale,
        apports: 0, // TODO: sum from movements
        retraits: 0, // TODO: sum from movements
        flux_ponderes: movArray.reduce((sum, m) => sum + m.montant * m.poids, 0),
        valeur_finale: valeurFinaleNum,
        performance_mensuelle: monthlyPerf,
        indice_base100: newIndex,
      };

      // Call mutation hook
      await mutate(newEntry);

      // Reset form on success
      setSelectedDate('');
      setValeurFinale('');
      setLivePerformance(null);
      setLiveIndex(null);
      setSuccessMessage(`Entrée enregistrée pour ${fmtDateFR(selectedDate)}`);

      // Call onSuccess callback
      if (onSuccess) {
        onSuccess();
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!userId) {
    return <div className="text-muted text-sm">Veuillez vous connecter</div>;
  }

  return (
    <div className="space-y-6">
      {/* Form Card */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">📊 Enregistrer une valeur de portefeuille</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date Input */}
          <div>
            <label htmlFor="suivi-date" className="block text-sm font-medium mb-1">
              Date (fin de mois) *
            </label>
            <input
              id="suivi-date"
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              required
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm"
              placeholder="JJ/MM/AAAA"
            />
            <p className="text-xs text-muted mt-1">Sélectionnez le dernier jour du mois</p>
          </div>

          {/* Valeur Finale Input */}
          <div>
            <label htmlFor="suivi-valeur" className="block text-sm font-medium mb-1">
              Valeur Finale FCFA *
            </label>
            <input
              id="suivi-valeur"
              type="number"
              value={valeurFinale}
              onChange={handleValeurFinaleChange}
              required
              step="1"
              min="0"
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm tabular font-mono"
              placeholder="0"
            />
            {valeurFinale && (
              <p className="text-xs text-muted mt-1">
                {fmtFcfa(parseFloat(valeurFinale))}
              </p>
            )}
          </div>

          {/* Live Preview */}
          {selectedDate && valeurFinale && (
            <div className="bg-bg border border-border rounded p-4 space-y-2">
              <div className="text-sm">
                <span className="text-muted">Performance estimée : </span>
                <span className={`font-semibold ${(livePerformance ?? 0) >= 0 ? 'text-up' : 'text-down'}`}>
                  {livePerformance !== null ? formatPercentage(livePerformance, 2) : '—'}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-muted">Indice estimé : </span>
                <span className="font-semibold">
                  {liveIndex !== null ? fmtNumber(liveIndex, 2) : '—'}
                </span>
              </div>
            </div>
          )}

          {/* Error Messages */}
          {submitError && (
            <div className="bg-red-950/30 border border-red-900/50 rounded p-3 text-sm text-red-200">
              {submitError}
            </div>
          )}

          {mutateError && (
            <div className="bg-red-950/30 border border-red-900/50 rounded p-3 text-sm text-red-200">
              Erreur: {mutateError}
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-950/30 border border-green-900/50 rounded p-3 text-sm text-green-200">
              {successMessage}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setSelectedDate('');
                setValeurFinale('');
                setSubmitError(null);
                setLivePerformance(null);
                setLiveIndex(null);
              }}
              disabled={isSubmitting || isMutating}
              className="flex-1 px-4 py-2 rounded border border-border text-sm font-medium hover:bg-bg/40 transition disabled:opacity-50"
            >
              Réinitialiser
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isMutating}
              className="flex-1 px-4 py-2 rounded bg-up/90 hover:bg-up text-black text-sm font-medium transition disabled:opacity-50"
            >
              {isSubmitting || isMutating ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>

      {/* Historical Table */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">📈 Historique mensuel</h3>

        {isLoading && (
          <div className="space-y-2">
            <div className="h-8 bg-elevated rounded animate-pulse" />
            <div className="h-8 bg-elevated rounded animate-pulse" />
            <div className="h-8 bg-elevated rounded animate-pulse" />
          </div>
        )}

        {fetchError && (
          <div className="bg-red-950/30 border border-red-900/50 rounded p-3 text-sm text-red-200">
            Erreur: {fetchError}
          </div>
        )}

        {!isLoading && !fetchError && (!entries || entries.length === 0) && (
          <div className="text-center py-8 text-muted">
            Aucun historique disponible
          </div>
        )}

        {!isLoading && !fetchError && entries && entries.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2 font-semibold">Date</th>
                  <th className="text-right px-4 py-2 font-semibold">Valeur initiale</th>
                  <th className="text-right px-4 py-2 font-semibold">Apports</th>
                  <th className="text-right px-4 py-2 font-semibold">Retraits</th>
                  <th className="text-right px-4 py-2 font-semibold">Valeur finale</th>
                  <th className="text-right px-4 py-2 font-semibold">Perf</th>
                  <th className="text-right px-4 py-2 font-semibold">Indice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((entry) => {
                  const perfPercent = (entry.performance_mensuelle ?? 0) * 100;
                  const perfColor = perfPercent >= 0 ? 'text-up' : 'text-down';

                  return (
                    <tr key={entry.id} className="hover:bg-bg/40 transition">
                      <td className="px-4 py-2 text-muted">{fmtDateFR(entry.date)}</td>
                      <td className="text-right px-4 py-2 tabular font-mono">
                        {fmtFcfa(entry.valeur_initiale)}
                      </td>
                      <td className="text-right px-4 py-2 tabular font-mono text-up">
                        {entry.apports ? '+' + fmtFcfa(entry.apports) : '—'}
                      </td>
                      <td className="text-right px-4 py-2 tabular font-mono text-down">
                        {entry.retraits ? '-' + fmtFcfa(entry.retraits) : '—'}
                      </td>
                      <td className="text-right px-4 py-2 tabular font-mono font-semibold">
                        {fmtFcfa(entry.valeur_finale)}
                      </td>
                      <td className={`text-right px-4 py-2 tabular font-mono font-semibold ${perfColor}`}>
                        {entry.performance_mensuelle !== null
                          ? `${perfPercent >= 0 ? '+' : ''}${perfPercent.toFixed(2)}%`
                          : '—'}
                      </td>
                      <td className="text-right px-4 py-2 tabular font-mono">
                        {entry.indice_base100 !== null
                          ? fmtNumber(entry.indice_base100, 2)
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
