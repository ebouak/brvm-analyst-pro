'use client';

import { useState, useMemo } from 'react';
import type { Position } from '@/lib/portfolio/queries';
import { fmtNumber, fmtFcfa } from '@/lib/format';

interface Props {
  positions: Position[] | null;
  onUpdate: (position: Position) => void;
  isLoading?: boolean;
}

/**
 * Inline edit modal for position
 */
function EditPositionModal({
  isOpen,
  onClose,
  position,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  position: Position | null;
  onSave: (updated: Position) => void;
}) {
  const [quantite, setQuantite] = useState(position?.quantite.toString() ?? '');
  const [cours, setCours] = useState(position?.cours.toString() ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !position) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const updated: Position = {
      ...position,
      quantite: parseFloat(quantite) || 0,
      cours: parseFloat(cours) || 0,
      valeur: (parseFloat(quantite) || 0) * (parseFloat(cours) || 0),
    };

    onSave(updated);
    setTimeout(() => {
      setIsSubmitting(false);
      onClose();
    }, 100);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-surface border border-border rounded-xl shadow-lg max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">Modifier position</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-fg text-lg"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Symbole</label>
            <input
              type="text"
              disabled
              value={position.symbole || '—'}
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-muted"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ep-quantite" className="block text-sm font-medium mb-1">
                Quantité *
              </label>
              <input
                id="ep-quantite"
                type="number"
                placeholder="0"
                step="any"
                required
                value={quantite}
                onChange={(e) => setQuantite(e.target.value)}
                className="w-full bg-bg border border-border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="ep-cours" className="block text-sm font-medium mb-1">
                Cours *
              </label>
              <input
                id="ep-cours"
                type="number"
                placeholder="0"
                step="any"
                required
                value={cours}
                onChange={(e) => setCours(e.target.value)}
                className="w-full bg-bg border border-border rounded px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 rounded border border-border text-sm font-medium hover:bg-bg/40 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 rounded bg-up/90 hover:bg-up text-black text-sm font-medium transition disabled:opacity-50"
            >
              {isSubmitting ? 'Mise à jour…' : 'Mettre à jour'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Section A: Positions table with edit modal
 */
function PositionsTable({
  positions,
  onEditSave,
}: {
  positions: Position[];
  onEditSave: (position: Position) => void;
}) {
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleEdit = (pos: Position) => {
    setEditingPosition(pos);
    setIsModalOpen(true);
  };

  const handleSave = (updated: Position) => {
    onEditSave(updated);
  };

  // Separate liquidities and positions
  const liquiditiesPosition = positions.find((p) => p.is_liquidites);
  const otherPositions = positions.filter((p) => !p.is_liquidites);

  // Calculate totals
  const totalValue = positions.reduce((sum, p) => sum + (p.valeur ?? 0), 0);

  const MAX_POSITIONS = 30;
  const usedCount = otherPositions.length;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-2 text-left text-xs text-muted font-medium uppercase">
                Symbole
              </th>
              <th className="px-4 py-2 text-left text-xs text-muted font-medium uppercase">
                Secteur
              </th>
              <th className="px-4 py-2 text-right text-xs text-muted font-medium uppercase">
                Quantité
              </th>
              <th className="px-4 py-2 text-right text-xs text-muted font-medium uppercase">
                Cours
              </th>
              <th className="px-4 py-2 text-right text-xs text-muted font-medium uppercase">
                Valeur
              </th>
              <th className="px-4 py-2 text-right text-xs text-muted font-medium uppercase">
                Pondération
              </th>
              <th className="px-4 py-2 text-center text-xs text-muted font-medium uppercase">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Other positions */}
            {otherPositions.map((pos) => {
              const weight = totalValue > 0 ? (pos.valeur ?? 0) / totalValue : 0;
              return (
                <tr key={pos.id} className="border-b border-border hover:bg-bg/30 transition">
                  <td className="px-4 py-3 font-semibold">{pos.symbole || '—'}</td>
                  <td className="px-4 py-3 text-muted text-xs">{pos.secteur || '—'}</td>
                  <td className="px-4 py-3 text-right tabular">{fmtNumber(pos.quantite, 0)}</td>
                  <td className="px-4 py-3 text-right tabular">{fmtNumber(pos.cours, 0)}</td>
                  <td className="px-4 py-3 text-right tabular">{fmtFcfa(pos.valeur ?? 0)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="tabular text-sm font-medium">
                        {(weight * 100).toFixed(1)}%
                      </span>
                      <div className="w-16 h-1.5 bg-elevated rounded-full overflow-hidden">
                        <div
                          className="h-full bg-up transition-all duration-300"
                          style={{ width: `${Math.min(weight * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleEdit(pos)}
                      className="text-xs px-2 py-1 rounded border border-border hover:bg-bg/40 transition text-muted hover:text-white"
                    >
                      Modifier
                    </button>
                  </td>
                </tr>
              );
            })}

            {/* Liquidities row (italics, no cours) */}
            {liquiditiesPosition && (
              <tr className="border-b border-border hover:bg-bg/30 transition">
                <td className="px-4 py-3 font-semibold italic">Liquidités</td>
                <td className="px-4 py-3 text-muted text-xs italic">—</td>
                <td className="px-4 py-3 text-right tabular italic">
                  {fmtNumber(liquiditiesPosition.quantite, 0)}
                </td>
                <td className="px-4 py-3 text-right italic text-muted">—</td>
                <td className="px-4 py-3 text-right tabular italic">
                  {fmtFcfa(liquiditiesPosition.valeur ?? 0)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2 italic">
                    <span className="tabular text-sm font-medium">
                      {totalValue > 0
                        ? (
                            ((liquiditiesPosition.valeur ?? 0) / totalValue) *
                            100
                          ).toFixed(1)
                        : '0'}
                      %
                    </span>
                    <div className="w-16 h-1.5 bg-elevated rounded-full overflow-hidden">
                      <div
                        className="h-full bg-up transition-all duration-300"
                        style={{
                          width: `${Math.min(
                            totalValue > 0
                              ? (((liquiditiesPosition.valeur ?? 0) / totalValue) *
                                  100) as number
                              : 0,
                            100
                          )}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleEdit(liquiditiesPosition)}
                    className="text-xs px-2 py-1 rounded border border-border hover:bg-bg/40 transition text-muted hover:text-white"
                  >
                    Modifier
                  </button>
                </td>
              </tr>
            )}

            {/* TOTAL row (bold) */}
            <tr className="bg-bg/20 border-t border-border">
              <td colSpan={4} className="px-4 py-3 font-bold text-white">
                TOTAL
              </td>
              <td className="px-4 py-3 text-right font-bold tabular">
                {fmtFcfa(totalValue)}
              </td>
              <td className="px-4 py-3 text-right font-bold">100%</td>
              <td className="px-4 py-3"></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Usage counter */}
      <div className="text-xs text-muted">
        {usedCount} / {MAX_POSITIONS} lignes utilisées
      </div>

      {/* Edit modal */}
      <EditPositionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        position={editingPosition}
        onSave={handleSave}
      />
    </div>
  );
}

/**
 * Section B: Sector distribution table
 */
function SectorDistribution({ positions }: { positions: Position[] }) {
  const sectorData = useMemo(() => {
    if (!positions || positions.length === 0) {
      return { items: [], total: 0 };
    }

    // Aggregate by sector
    const sectorMap: Record<string, number> = {};
    let total = 0;

    for (const pos of positions) {
      const sector = pos.is_liquidites
        ? 'Liquidités'
        : pos.secteur || 'Autre';

      sectorMap[sector] = (sectorMap[sector] ?? 0) + (pos.valeur ?? 0);
      total += pos.valeur ?? 0;
    }

    // Convert to array and sort by value descending
    const items = Object.entries(sectorMap)
      .map(([sector, value]) => ({
        sector,
        value,
        weight: total > 0 ? (value / total) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);

    return { items, total };
  }, [positions]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-2 text-left text-xs text-muted font-medium uppercase">
              Secteur
            </th>
            <th className="px-4 py-2 text-right text-xs text-muted font-medium uppercase">
              Valeur (FCFA)
            </th>
            <th className="px-4 py-2 text-right text-xs text-muted font-medium uppercase">
              Pondération
            </th>
          </tr>
        </thead>
        <tbody>
          {sectorData.items.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-4 py-4 text-center text-muted text-xs">
                Aucun secteur
              </td>
            </tr>
          ) : (
            <>
              {sectorData.items.map((item) => (
                <tr key={item.sector} className="border-b border-border hover:bg-bg/30 transition">
                  <td className="px-4 py-3 font-medium">{item.sector}</td>
                  <td className="px-4 py-3 text-right tabular">{fmtFcfa(item.value)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="tabular text-sm font-medium">
                        {item.weight.toFixed(1)}%
                      </span>
                      <div className="w-16 h-1.5 bg-elevated rounded-full overflow-hidden">
                        <div
                          className="h-full bg-up transition-all duration-300"
                          style={{ width: `${Math.min(item.weight, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}

              {/* TOTAL row */}
              <tr className="bg-bg/20 border-t border-border">
                <td className="px-4 py-3 font-bold text-white">TOTAL</td>
                <td className="px-4 py-3 text-right font-bold tabular">
                  {fmtFcfa(sectorData.total)}
                </td>
                <td className="px-4 py-3 text-right font-bold">100%</td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Main component: Portfolio Positions + Sector Distribution
 */
export default function PortfolioPositions({
  positions,
  onUpdate,
  isLoading = false,
}: Props) {
  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="h-4 bg-elevated rounded w-32 mb-4"></div>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-elevated rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!positions || positions.length === 0) {
    return (
      <div className="space-y-8">
        <div className="bg-surface border border-border rounded-xl p-4 text-center text-muted">
          Aucune position
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Section A: Positions Table */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <h2 className="text-lg font-semibold mb-4">📊 Positions</h2>
        <PositionsTable positions={positions} onEditSave={onUpdate} />
      </div>

      {/* Section B: Sector Distribution */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <h2 className="text-lg font-semibold mb-4">🥧 Répartition par secteur</h2>
        <SectorDistribution positions={positions} />
      </div>
    </div>
  );
}
