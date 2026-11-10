import Link from 'next/link';

interface Props {
  type: string;
  days: string;
  view: string;
  totalItems: number;
}

const VUES = [
  { value: 'timeline', label: 'Chronologie' },
  { value: 'liste', label: 'Liste' },
];
const TYPES = [
  { value: 'all', label: 'Tout' },
  { value: 'dividende', label: 'Dividendes' },
  { value: 'event', label: 'Événements' },
];
const DAYS = [
  { value: '7', label: '7 jours' },
  { value: '14', label: '14 jours' },
  { value: '30', label: '30 jours' },
  { value: '60', label: '60 jours' },
  { value: '90', label: '90 jours' },
];

function buildHref(params: { type: string; days: string; view: string }, overrides: Partial<{ type: string; days: string; view: string }>) {
  const p = { ...params, ...overrides };
  return `/calendrier?type=${p.type}&days=${p.days}&view=${p.view}`;
}

/** Groupe de liens segmentés : l'option active porte aria-current. */
function Groupe({ libelle, options, actif, href }: { libelle: string; options: { value: string; label: string }[]; actif: string; href: (v: string) => string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted">{libelle}</span>
      <div className="inline-flex flex-wrap overflow-hidden rounded-lg border border-border bg-surface">
        {options.map((o) => {
          const estActif = o.value === actif;
          return (
            <Link
              key={o.value}
              href={href(o.value)}
              aria-current={estActif ? 'true' : undefined}
              className={`inline-flex min-h-[44px] items-center px-3 text-xs transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent md:min-h-[32px] ${
                estActif ? 'bg-accent/15 font-medium text-accent-ink' : 'text-muted hover:text-ivory'
              }`}
            >
              {o.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function CalendarFilters({ type, days, view, totalItems }: Props) {
  const p = { type, days, view };
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <Groupe libelle="Afficher" options={VUES} actif={view} href={(v) => buildHref(p, { view: v })} />
      <Groupe libelle="Type" options={TYPES} actif={type} href={(v) => buildHref(p, { type: v })} />
      <Groupe libelle="Période" options={DAYS} actif={days} href={(v) => buildHref(p, { days: v })} />
      <span className="tabular text-xs text-muted md:ml-auto">
        {totalItems} élément{totalItems !== 1 ? 's' : ''}
      </span>
    </div>
  );
}
