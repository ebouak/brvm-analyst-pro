'use client';
import { useState } from 'react';

export type ReportType = 'hebdomadaire' | 'mensuel' | 'personnalise';

export interface ReportParams {
  type: ReportType;
  dateFrom: string;
  dateTo: string;
  codes: string[]; // [] = tous
}

interface Props {
  instruments: { code: string; designation: string | null }[];
  onGenerate: (params: ReportParams) => void;
  loading: boolean;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function nDaysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const PRESET_DATES: Record<ReportType, () => { from: string; to: string }> = {
  hebdomadaire: () => ({ from: nDaysAgoIso(7), to: todayIso() }),
  mensuel: () => ({ from: nDaysAgoIso(30), to: todayIso() }),
  personnalise: () => ({ from: nDaysAgoIso(30), to: todayIso() }),
};

export default function ReportConfig({ instruments, onGenerate, loading }: Props) {
  const [type, setType] = useState<ReportType>('mensuel');
  const [dateFrom, setDateFrom] = useState(nDaysAgoIso(30));
  const [dateTo, setDateTo] = useState(todayIso());
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);

  function handleTypeChange(t: ReportType) {
    setType(t);
    if (t !== 'personnalise') {
      const { from, to } = PRESET_DATES[t]();
      setDateFrom(from);
      setDateTo(to);
    }
  }

  function toggleCode(code: string) {
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onGenerate({ type, dateFrom, dateTo, codes: selectedCodes });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-surface border border-border rounded-xl p-5 space-y-4"
    >
      <h2 className="font-semibold">Configuration du rapport</h2>

      {/* Type */}
      <div className="space-y-1">
        <label className="text-xs text-muted">Type de rapport</label>
        <div className="flex gap-2">
          {(['hebdomadaire', 'mensuel', 'personnalise'] as ReportType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => handleTypeChange(t)}
              className={`text-xs px-3 py-1.5 rounded border transition capitalize ${
                type === t
                  ? 'border-up text-up'
                  : 'border-border text-muted hover:border-up/40'
              }`}
            >
              {t === 'personnalise' ? 'Personnalisé' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Dates */}
      <div className="flex gap-4">
        <div className="space-y-1">
          <label className="text-xs text-muted">Date début</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            disabled={type !== 'personnalise'}
            className="text-xs bg-bg border border-border rounded px-2 py-1.5 tabular text-white disabled:opacity-50"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted">Date fin</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            disabled={type !== 'personnalise'}
            className="text-xs bg-bg border border-border rounded px-2 py-1.5 tabular text-white disabled:opacity-50"
          />
        </div>
      </div>

      {/* Sélection titres */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-muted">Titres</label>
          <button
            type="button"
            onClick={() => setSelectedCodes([])}
            className="text-xs text-muted hover:text-up"
          >
            Tous
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
          {instruments.map((instr) => (
            <button
              key={instr.code}
              type="button"
              onClick={() => toggleCode(instr.code)}
              title={instr.designation ?? instr.code}
              className={`text-xs px-2 py-1 rounded border transition ${
                selectedCodes.includes(instr.code)
                  ? 'border-up text-up bg-up/10'
                  : 'border-border text-muted hover:border-up/30'
              }`}
            >
              {instr.code}
            </button>
          ))}
        </div>
        {selectedCodes.length > 0 && (
          <p className="text-xs text-muted">{selectedCodes.length} titre(s) sélectionné(s)</p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 rounded border border-up text-up text-sm hover:bg-up/10 transition disabled:opacity-50"
      >
        {loading ? 'Génération…' : 'Générer le rapport'}
      </button>
    </form>
  );
}
