'use client';

import { useState, useEffect, useCallback } from 'react';
import { PUBLICATION_TYPES } from '@/lib/publications';
import { titrePublication } from '@/lib/fiche/affichage';
import { documentsCles, compteursParType, filtrerPublications, grouperParAnnee } from '@/lib/fiche/publications';

export interface Publication {
  id: string;
  date_publication: string;
  libelle: string;
  type_publication: 'etats_financiers' | 'ag' | 'rapport' | 'bilan' | 'notation' | 'avis' | 'autre' | null;
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

function PubRow({ pub }: { pub: Publication }) {
  return (
    <div className="flex items-start justify-between gap-3 border border-border/60 rounded-lg px-4 py-3 hover:border-border transition">
      <div className="flex-1 min-w-0">
        <span className="tabular text-xs text-muted block mb-1">{fmtDateFR(pub.date_publication)}</span>
        <p className="text-sm text-white/90 line-clamp-2 leading-snug">{titrePublication(pub.libelle)}</p>
      </div>
      {pub.source_url ? (
        <a
          href={pub.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[44px] flex-shrink-0 items-center text-xs text-up border border-up/30 rounded px-3 hover:bg-up/10 transition whitespace-nowrap"
        >
          Voir →
        </a>
      ) : (
        <span className="flex min-h-[44px] flex-shrink-0 items-center text-xs text-faint border border-border rounded px-3 whitespace-nowrap cursor-not-allowed">
          Pas de lien
        </span>
      )}
    </div>
  );
}

export default function PublicationsModal({ code, designation, publications, count }: Props) {
  const [open, setOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [recherche, setRecherche] = useState('');

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

  const filtered = filtrerPublications(publications, activeFilter, recherche);
  const compteurs = compteursParType(publications);
  const cles = documentsCles(publications);
  const groupes = grouperParAnnee(filtered);
  const total = Math.max(count, publications.length);

  const disabled = total === 0;

  const filtres = [
    { value: 'all', label: 'Tous', n: compteurs.total },
    ...PUBLICATION_TYPES.map((pt) => ({ value: pt.value as string, label: pt.label as string, n: compteurs.parType[pt.value] ?? 0 })),
    { value: 'sans_type', label: 'Sans type', n: compteurs.sansType },
  ].filter((f) => f.value === 'all' || f.n > 0);

  const lienCles: [string, (typeof cles)['etats']][] = [
    ['Derniers états financiers', cles.etats],
    ["Dernier rapport d'activités", cles.rapport],
    ['Dernière assemblée', cles.ag],
  ];

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
        title={disabled ? 'Aucune publication disponible' : `Voir les publications (${total})`}
      >
        Publications ({total})
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-20 px-4"
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
                <p className="text-xs text-muted mt-0.5">{designation ?? code} · {total} document{total > 1 ? 's' : ''}</p>
              </div>
              <button
                onClick={close}
                className="flex h-11 w-11 items-center justify-center text-muted hover:text-white transition rounded hover:bg-border/50"
                aria-label="Fermer"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Documents clés */}
            {lienCles.some(([, d]) => d) && (
              <div className="grid gap-2 border-b border-border/50 px-5 py-3 sm:grid-cols-3">
                {lienCles.map(([titre, doc]) => doc && doc.source_url ? (
                  <a key={titre} href={doc.source_url} target="_blank" rel="noopener noreferrer"
                    className="flex min-h-[44px] flex-col justify-center rounded-lg border border-border px-3 py-2 transition hover:border-up/40">
                    <span className="text-xs font-medium text-up">{titre}</span>
                    <span className="tabular text-[11px] text-muted">{fmtDateFR(doc.date_publication)}</span>
                  </a>
                ) : (
                  <div key={titre} className="flex min-h-[44px] flex-col justify-center rounded-lg border border-border/60 px-3 py-2">
                    <span className="text-xs text-faint">{titre}</span>
                    <span className="text-[11px] text-faint">{doc ? 'Pas de lien' : 'Aucun document'}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Recherche */}
            <div className="border-b border-border/50 px-5 py-3">
              <label htmlFor="pub-recherche" className="mb-1 block text-xs text-muted">Rechercher dans les titres</label>
              <input
                id="pub-recherche"
                type="search"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                className="min-h-[44px] w-full rounded-lg border border-border bg-bg px-3 text-sm text-ivory"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-1.5 px-5 py-3 border-b border-border/50">
              {filtres.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setActiveFilter(f.value)}
                  aria-pressed={activeFilter === f.value}
                  className={`min-h-[44px] text-xs px-3 rounded-chip border transition ${
                    activeFilter === f.value
                      ? 'border-up text-up bg-up/5'
                      : 'border-border text-muted hover:border-up/40 hover:text-up'
                  }`}
                >
                  {f.label} ({f.n})
                </button>
              ))}
            </div>

            {/* List */}
            <div className="flex-1 px-5 py-3">
              {groupes.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-muted text-sm">
                    {publications.length === 0 ? 'Aucune publication disponible pour cette action.' : 'Aucun document ne correspond à la recherche.'}
                  </p>
                  {publications.length === 0 && (
                    <p className="text-faint text-xs mt-2">Les publications BDFIN sont ingérées quotidiennement à 13h30 UTC.</p>
                  )}
                </div>
              ) : (
                groupes.map((g) => (
                  <div key={g.annee} className="mb-5">
                    <div className="mb-2 flex items-center gap-2">
                      <h3 className="tabular text-sm font-semibold text-ivory">{g.annee}</h3>
                      <span className="text-xs text-faint">{g.items.length} doc{g.items.length > 1 ? 's' : ''}</span>
                    </div>
                    <div className="space-y-1.5">
                      {g.items.map((pub) => <PubRow key={pub.id} pub={pub as Publication} />)}
                    </div>
                  </div>
                ))
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
