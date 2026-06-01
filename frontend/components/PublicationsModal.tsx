'use client';

import { useState, useEffect, useCallback } from 'react';
import { PUBLICATION_TYPES, labelForType, colorClassesForType } from '@/lib/publications';

export interface Publication {
  id: string;
  date_publication: string;
  libelle: string;
  type_publication: 'etats_financiers' | 'ag' | 'rapport' | 'bilan' | 'notation' | 'avis' | 'autre';
  source_url: string | null;
}

interface Props {
  code: string;
  designation?: string | null;
  publications: Publication[];
  count: number;
}

function fmtDateFR(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export default function PublicationsModal({ code, designation, publications, count }: Props) {
  const [open, setOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, close]);

  // Lock scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const filtered = activeFilter === 'all'
    ? publications
    : publications.filter((p) => p.type_publication === activeFilter);

  const disabled = count === 0;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
        className={`text-xs border rounded px-3 py-1.5 transition ${
          disabled
            ? 'border-border text-faint cursor-default'
            : 'border-border text-muted hover:text-up hover:border-up/40'
        }`}
        title={disabled ? 'Aucune publication disponible' : `Voir les publications (${count})`}
      >
        📰 Publications ({count})
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-20 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
          role="dialog"
          aria-modal="true"
          aria-label={`Publications — ${designation ?? code}`}
        >
          <div className="bg-surface border border-border rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-modal flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-surface z-10">
              <div>
                <h2 className="text-sm font-semibold">Publications</h2>
                <p className="text-xs text-muted mt-0.5">{designation ?? code} · {count} document{count > 1 ? 's' : ''}</p>
              </div>
              <button
                onClick={close}
                className="text-muted hover:text-white transition p-1 rounded hover:bg-border/50"
                aria-label="Fermer"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-1.5 px-5 py-3 border-b border-border/50">
              <button
                onClick={() => setActiveFilter('all')}
                className={`text-xs px-2.5 py-1 rounded-chip border transition ${
                  activeFilter === 'all'
                    ? 'border-up text-up bg-up/10'
                    : 'border-border text-muted hover:border-up/40 hover:text-up'
                }`}
              >
                Tous ({count})
              </button>
              {PUBLICATION_TYPES.map((pt) => {
                const typeCount = publications.filter((p) => p.type_publication === pt.value).length;
                if (typeCount === 0) return null;
                const active = activeFilter === pt.value;
                return (
                  <button
                    key={pt.value}
                    onClick={() => setActiveFilter(pt.value)}
                    className={`text-xs px-2.5 py-1 rounded-chip border transition ${
                      active
                        ? 'border-up text-up bg-up/10'
                        : 'border-border text-muted hover:border-up/40 hover:text-up'
                    }`}
                  >
                    {pt.label} ({typeCount})
                  </button>
                );
              })}
            </div>

            {/* List */}
            <div className="flex-1 px-5 py-3 space-y-2">
              {filtered.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-muted text-sm">Aucune publication disponible pour cette action.</p>
                  <p className="text-faint text-xs mt-2">
                    Les publications BDFIN sont ingérées quotidiennement à 13h30 UTC.
                  </p>
                </div>
              ) : (
                filtered.map((pub) => {
                  const { bg, text } = colorClassesForType(pub.type_publication);
                  return (
                    <div
                      key={pub.id}
                      className="flex items-start justify-between gap-3 border border-border/60 rounded-lg px-4 py-3 hover:border-border transition"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="tabular text-xs text-muted">
                            {fmtDateFR(pub.date_publication)}
                          </span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-chip ${bg} ${text}`}>
                            {labelForType(pub.type_publication)}
                          </span>
                        </div>
                        <p className="text-sm text-white/90 line-clamp-2 leading-snug">
                          {pub.libelle}
                        </p>
                      </div>
                      {pub.source_url ? (
                        <a
                          href={pub.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 text-xs text-up border border-up/30 rounded px-2.5 py-1 hover:bg-up/10 transition whitespace-nowrap"
                        >
                          📄 Voir →
                        </a>
                      ) : (
                        <span className="flex-shrink-0 text-xs text-faint border border-border rounded px-2.5 py-1 whitespace-nowrap cursor-not-allowed">
                          📄 Voir →
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border/50 text-center">
              <p className="text-[11px] text-faint">Cliquez ailleurs ou ESC pour fermer</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
