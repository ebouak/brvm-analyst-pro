'use client';

export interface Onglet { cle: string; libelle: string }

/** Barre d'onglets accessible (role=tablist) partagée par les filtres d'agenda et de publications. */
export default function OngletsFiltre({
  onglets, actif, onChange, label,
}: {
  onglets: Onglet[];
  actif: string;
  onChange: (cle: string) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="mb-3 flex flex-wrap gap-1.5">
      {onglets.map((o) => {
        const sel = o.cle === actif;
        return (
          <button
            key={o.cle}
            type="button"
            role="tab"
            aria-selected={sel}
            onClick={() => onChange(o.cle)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
              sel ? 'border-accent/50 bg-accent/10 text-accent-ink' : 'border-border text-muted hover:border-border-strong hover:text-ivory'
            }`}
          >
            {o.libelle}
          </button>
        );
      })}
    </div>
  );
}
