'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { type SearchItem, fuzzyFilter } from '@/lib/search-index';

interface Props {
  items: SearchItem[];
}

/** Événement global pour ouvrir la palette depuis un bouton (bottom nav mobile…). */
export const OPEN_PALETTE_EVENT = 'westbourse:open-palette';

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

/** Réponse de /api/copilot (barre de commande serveur outillée). */
interface CopilotResultItem { code: string; nom: string; detail: string; href: string }
type CopilotAnswer =
  | { action: 'navigate'; href: string; label: string }
  | { action: 'resultats'; titre: string; items: CopilotResultItem[] }
  | { action: 'assistant'; href: string };

export default function CommandPalette({ items }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotResults, setCopilotResults] = useState<{ titre: string; items: CopilotResultItem[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const filtered = fuzzyFilter(items, query, 60);
  const groups = groupByKind(filtered);
  const flatFiltered = groups.flatMap(([, groupItems]) => groupItems);
  // Ligne « Copilote » : requêtes en langage naturel (phrase, filtre, question).
  const showCopilotRow = !copilotResults && query.trim().length >= 4 && /\s/.test(query.trim());

  const openPalette = useCallback(() => {
    setOpen(true);
    setQuery('');
    setSelectedIndex(0);
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery('');
    setSelectedIndex(0);
    setCopilotResults(null);
    setCopilotLoading(false);
  }, []);

  const navigate = useCallback(
    (item: SearchItem) => {
      closePalette();
      router.push(item.href);
    },
    [closePalette, router],
  );

  const goTo = useCallback(
    (href: string) => {
      closePalette();
      router.push(href);
    },
    [closePalette, router],
  );

  /** Envoie la requête au copilote serveur (parse déterministe → outils LLM → assistant). */
  const runCopilot = useCallback(async () => {
    const q = query.trim();
    if (!q || copilotLoading) return;
    setCopilotLoading(true);
    try {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q }),
      });
      if (!res.ok) {
        goTo(`/assistant?q=${encodeURIComponent(q)}`);
        return;
      }
      const answer = (await res.json()) as CopilotAnswer;
      if (answer.action === 'navigate' || answer.action === 'assistant') {
        goTo(answer.href);
      } else {
        setCopilotResults({ titre: answer.titre, items: answer.items });
        setSelectedIndex(0);
      }
    } catch {
      goTo(`/assistant?q=${encodeURIComponent(q)}`);
    } finally {
      setCopilotLoading(false);
    }
  }, [query, copilotLoading, goTo]);

  // Global keyboard shortcut + ouverture externe (bottom nav mobile).
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
    const onExternalOpen = () => openPalette();
    window.addEventListener('keydown', handler);
    window.addEventListener(OPEN_PALETTE_EVENT, onExternalOpen);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener(OPEN_PALETTE_EVENT, onExternalOpen);
    };
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
    // En mode résultats copilote, la liste navigable = les résultats.
    const total = copilotResults ? copilotResults.items.length : flatFiltered.length + (showCopilotRow ? 1 : 0);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, Math.max(0, total - 1)));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (copilotResults) {
        const r = copilotResults.items[selectedIndex];
        if (r) goTo(r.href);
        return;
      }
      if (selectedIndex >= flatFiltered.length) {
        void runCopilot();
        return;
      }
      const item = flatFiltered[selectedIndex];
      if (item) navigate(item);
      return;
    }
  };

  // Reset selection on query change
  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setSelectedIndex(0);
    setCopilotResults(null);
  };

  // Fermée : rien à rendre — l'ouverture se fait au clavier (⌘K/Ctrl+K) ou via
  // l'onglet Recherche de la bottom nav mobile (OPEN_PALETTE_EVENT).
  if (!open) return null;

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
          {copilotResults ? (
            <div>
              <p className="px-4 pb-1 pt-3 text-xs font-semibold tracking-wider text-[#8b93a7]">
                ◈ {copilotResults.titre}
              </p>
              {copilotResults.items.length === 0 && (
                <p className="px-4 py-4 text-sm text-[#8b93a7]">Aucune action ne correspond à ce critère.</p>
              )}
              {copilotResults.items.map((r, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={r.href}
                    data-selected={isSelected}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => goTo(r.href)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={[
                      'flex w-full items-center gap-3 px-4 py-2 text-left transition-colors',
                      isSelected ? 'bg-[#00c853]/10 text-[#00c853]' : 'text-[#e6e9f0] hover:bg-[#0f1117]',
                    ].join(' ')}
                  >
                    <span aria-hidden>📈</span>
                    <span className="flex-1 truncate">
                      <span className="font-medium">{r.code}</span>
                      <span className={`ml-2 text-sm ${isSelected ? 'text-[#00c853]/70' : 'text-[#8b93a7]'}`}>
                        {r.nom} · {r.detail}
                      </span>
                    </span>
                    <span className={`text-xs ${isSelected ? 'text-[#00c853]/70' : 'text-[#8b93a7]'}`}>↵</span>
                  </button>
                );
              })}
            </div>
          ) : flatFiltered.length === 0 && !showCopilotRow ? (
            <p className="px-4 py-6 text-center text-sm text-[#8b93a7]">
              Aucun résultat pour «&nbsp;{query}&nbsp;»
            </p>
          ) : (
            <>
            {groups.map(([kind, groupItems]) => {
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
            })}
            {showCopilotRow && (
              <div>
                <p className="px-4 pb-1 pt-3 text-xs font-semibold tracking-wider text-[#8b93a7]">COPILOTE</p>
                <button
                  data-selected={selectedIndex === flatFiltered.length}
                  role="option"
                  aria-selected={selectedIndex === flatFiltered.length}
                  onClick={() => void runCopilot()}
                  onMouseEnter={() => setSelectedIndex(flatFiltered.length)}
                  disabled={copilotLoading}
                  className={[
                    'flex w-full items-center gap-3 px-4 py-2 text-left transition-colors',
                    selectedIndex === flatFiltered.length
                      ? 'bg-[#00c853]/10 text-[#00c853]'
                      : 'text-[#e6e9f0] hover:bg-[#0f1117]',
                  ].join(' ')}
                >
                  <span aria-hidden>{copilotLoading ? '⏳' : '◈'}</span>
                  <span className="flex-1 truncate">
                    <span className="font-medium">
                      {copilotLoading ? 'Recherche en cours…' : `Demander : « ${query.trim()} »`}
                    </span>
                    <span className={`ml-2 text-sm ${selectedIndex === flatFiltered.length ? 'text-[#00c853]/70' : 'text-[#8b93a7]'}`}>
                      société, filtre PER/rendement, page
                    </span>
                  </span>
                  <span className={`text-xs ${selectedIndex === flatFiltered.length ? 'text-[#00c853]/70' : 'text-[#8b93a7]'}`}>↵</span>
                </button>
              </div>
            )}
            </>
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
