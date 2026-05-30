'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export interface InstrumentRef {
  code: string;
  designation: string | null;
  secteur: string | null;
}

const COLORS = ['#00c853', '#42a5f5', '#ffb300', '#7e57c2', '#f44336', '#e6e9f0'];
const MAX = 6;

interface Props {
  instruments: InstrumentRef[];
  selected: string[];
  period: string;
  mode: string;
}

export default function CompareSelector({ instruments, selected, period, mode }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string[]>(selected);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // Sync if URL changes externally
  useEffect(() => { setCurrent(selected); }, [selected.join(',')]);

  // Close dropdown on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const filtered = instruments
    .filter((i) => {
      if (!query) return true;
      const q = query.toUpperCase();
      return (
        i.code.includes(q) ||
        (i.designation?.toUpperCase().includes(q) ?? false) ||
        (i.secteur?.toUpperCase().includes(q) ?? false)
      );
    })
    .slice(0, 30);

  const toggle = useCallback(
    (code: string) => {
      setCurrent((prev) => {
        if (prev.includes(code)) return prev.filter((c) => c !== code);
        if (prev.length >= MAX) return prev;
        return [...prev, code];
      });
    },
    [],
  );

  const remove = (code: string) => setCurrent((prev) => prev.filter((c) => c !== code));

  const apply = () => {
    const params = new URLSearchParams();
    if (current.length) params.set('codes', current.join(','));
    params.set('period', period);
    params.set('mode', mode);
    router.push(`/actions/compare?${params.toString()}`);
    setOpen(false);
  };

  return (
    <div className="space-y-3">
      {/* Selected chips */}
      <div className="flex flex-wrap gap-2 min-h-[32px]">
        {current.length === 0 && (
          <span className="text-sm text-muted">Aucune action sélectionnée</span>
        )}
        {current.map((code, i) => (
          <span
            key={code}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ backgroundColor: COLORS[i % COLORS.length] + '22', color: COLORS[i % COLORS.length], border: `1px solid ${COLORS[i % COLORS.length]}55` }}
          >
            {code}
            <button
              onClick={() => remove(code)}
              className="ml-0.5 hover:opacity-70 transition-opacity leading-none"
              aria-label={`Retirer ${code}`}
            >
              ✕
            </button>
          </span>
        ))}
        {current.length >= MAX && (
          <span className="text-xs text-warn self-center">Maximum 6 actions</span>
        )}
      </div>

      {/* Search + dropdown */}
      <div className="relative" ref={dropRef}>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Rechercher un titre (code, nom, secteur)…"
            className="bg-[#161922] border border-[#232733] rounded px-3 py-1.5 text-sm w-72 focus:border-[#42a5f5] outline-none transition-colors"
          />
          <button
            onClick={apply}
            disabled={current.length < 2}
            className="bg-[#00c853]/90 hover:bg-[#00c853] disabled:opacity-40 disabled:cursor-not-allowed text-black text-sm font-semibold rounded px-4 py-1.5 transition-colors"
          >
            Appliquer
          </button>
        </div>

        {open && filtered.length > 0 && (
          <div className="absolute z-50 mt-1 w-80 max-h-64 overflow-y-auto bg-[#161922] border border-[#232733] rounded-lg shadow-xl">
            {filtered.map((instr) => {
              const isSelected = current.includes(instr.code);
              const isDisabled = !isSelected && current.length >= MAX;
              const colorIdx = current.indexOf(instr.code);
              return (
                <button
                  key={instr.code}
                  onClick={() => { if (!isDisabled) toggle(instr.code); }}
                  disabled={isDisabled}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors
                    ${isSelected ? 'bg-white/5' : 'hover:bg-white/5'}
                    ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: isSelected ? COLORS[colorIdx % COLORS.length] : '#232733' }}
                  />
                  <span className="font-mono font-semibold text-[#e6e9f0]">{instr.code}</span>
                  {instr.designation && (
                    <span className="text-[#8b93a7] truncate flex-1">{instr.designation}</span>
                  )}
                  {isSelected && <span className="text-[#8b93a7] ml-auto">✓</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
