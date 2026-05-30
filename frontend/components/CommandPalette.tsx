'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { type SearchItem, fuzzyFilter } from '@/lib/search-index';

interface Props {
  items: SearchItem[];
}

const KIND_LABEL: Record<SearchItem['kind'], string> = {
  action: 'ACTIONS',
  secteur: 'SECTEURS',
  page: 'PAGES',
};

function groupByKind(items: SearchItem[]): Array<[SearchItem['kind'], SearchItem[]]> {
  const map = new Map<SearchItem['kind'], SearchItem[]>();
  for (const item of items) {
    const existing = map.get(item.kind);
    if (existing) {
      existing.push(item);
    } else {
      map.set(item.kind, [item]);
    }
  }
  const order: SearchItem['kind'][] = ['action', 'secteur', 'page'];
  return order.flatMap((k) => {
    const group = map.get(k);
    return group && group.length > 0 ? [[k, group] as [SearchItem['kind'], SearchItem[]]] : [];
  });
}

export default function CommandPalette({ items }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const filtered = fuzzyFilter(items, query, 60);
  const groups = groupByKind(filtered);
  const flatFiltered = groups.flatMap(([, groupItems]) => groupItems);

  const openPalette = useCallback(() => {
    setOpen(true);
    setQuery('');
    setSelectedIndex(0);
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery('');
    setSelectedIndex(0);
  }, []);

  const navigate = useCallback(
    (item: SearchItem) => {
      closePalette();
      router.push(item.href);
    },
    [closePalette, router],
  );

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (open) {
          closePalette();
        } else {
          openPalette();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, openPalette, closePalette]);

  // Focus input when opening
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>('[data-selected="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Keyboard navigation inside palette
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      closePalette();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatFiltered.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const item = flatFiltered[selectedIndex];
      if (item) navigate(item);
      return;
    }
  };

  // Reset selection on query change
  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setSelectedIndex(0);
  };

  if (!open) {
    return (
      <button
        onClick={openPalette}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-lg border border-[#232733] bg-[#161922] px-3 py-2 text-sm text-[#8b93a7] shadow-lg transition-colors hover:border-[#00c853]/40 hover:text-[#e6e9f0] md:hidden"
        aria-label="Ouvrir la palette de commandes"
      >
        🔍
      </button>
    );
  }

  // Build a flat index offset per group for selected tracking
  let runningIndex = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-20 backdrop-blur-sm"
      onClick={closePalette}
      role="dialog"
      aria-modal="true"
      aria-label="Palette de commandes"
    >
      <div
        className="w-full max-w-xl rounded-xl border border-[#232733] bg-[#161922] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-[#232733] px-4 py-3">
          <span className="text-[#8b93a7]" aria-hidden>🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher action, secteur, page…"
            className="w-full bg-transparent text-[#e6e9f0] placeholder-[#8b93a7] focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setSelectedIndex(0); inputRef.current?.focus(); }}
              className="text-[#8b93a7] hover:text-[#e6e9f0] transition-colors"
              aria-label="Effacer la recherche"
            >
              ✕
            </button>
          )}
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-1" role="listbox">
          {flatFiltered.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-[#8b93a7]">
              Aucun résultat pour «&nbsp;{query}&nbsp;»
            </p>
          ) : (
            groups.map(([kind, groupItems]) => {
              const sectionStart = runningIndex;
              runningIndex += groupItems.length;
              return (
                <div key={kind}>
                  <p className="px-4 pb-1 pt-3 text-xs font-semibold tracking-wider text-[#8b93a7]">
                    {KIND_LABEL[kind]}
                  </p>
                  {groupItems.map((item, localIdx) => {
                    const globalIdx = sectionStart + localIdx;
                    const isSelected = globalIdx === selectedIndex;
                    return (
                      <button
                        key={item.href}
                        data-selected={isSelected}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => navigate(item)}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                        className={[
                          'flex w-full items-center gap-3 px-4 py-2 text-left transition-colors',
                          isSelected
                            ? 'bg-[#00c853]/10 text-[#00c853]'
                            : 'text-[#e6e9f0] hover:bg-[#0f1117]',
                        ].join(' ')}
                      >
                        <span aria-hidden>{item.emoji}</span>
                        <span className="flex-1 truncate">
                          <span className="font-medium">{item.label}</span>
                          {item.sublabel && (
                            <span className={`ml-2 text-sm ${isSelected ? 'text-[#00c853]/70' : 'text-[#8b93a7]'}`}>
                              {item.sublabel}
                            </span>
                          )}
                        </span>
                        <span className={`text-xs ${isSelected ? 'text-[#00c853]/70' : 'text-[#8b93a7]'}`}>↵</span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-4 border-t border-[#232733] px-3 py-2 text-xs text-[#8b93a7]">
          <span>↑↓ naviguer</span>
          <span>↵ ouvrir</span>
          <span>ESC fermer</span>
        </div>
      </div>
    </div>
  );
}
