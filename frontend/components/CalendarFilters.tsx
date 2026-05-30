import Link from 'next/link';

interface Props {
  type: string;
  days: string;
  view: string;
  totalItems: number;
}

const TYPES = [
  { value: 'all', label: 'Tout' },
  { value: 'dividende', label: 'Dividendes' },
  { value: 'event', label: 'Événements' },
];
const DAYS = [
  { value: '7', label: '7 j' },
  { value: '14', label: '14 j' },
  { value: '30', label: '30 j' },
  { value: '60', label: '60 j' },
  { value: '90', label: '90 j' },
];

function chip(active: boolean) {
  return active
    ? 'px-3 py-1 rounded-full text-xs font-medium bg-blue/20 text-blue border border-blue/40'
    : 'px-3 py-1 rounded-full text-xs font-medium bg-surface text-muted border border-border hover:border-blue/30 hover:text-blue transition-colors';
}

function buildHref(params: { type: string; days: string; view: string }, overrides: Partial<{ type: string; days: string; view: string }>) {
  const p = { ...params, ...overrides };
  return `/calendrier?type=${p.type}&days=${p.days}&view=${p.view}`;
}

export default function CalendarFilters({ type, days, view, totalItems }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {/* View toggle */}
      <div className="flex items-center gap-2">
        <Link
          href={buildHref({ type, days, view }, { view: 'timeline' })}
          className={chip(view === 'timeline')}
        >
          Timeline
        </Link>
        <Link
          href={buildHref({ type, days, view }, { view: 'liste' })}
          className={chip(view === 'liste')}
        >
          Liste
        </Link>
        <span className="ml-auto text-xs text-muted">{totalItems} entrée{totalItems !== 1 ? 's' : ''}</span>
      </div>

      {/* Type + Days */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted mr-1">Type :</span>
        {TYPES.map((t) => (
          <Link key={t.value} href={buildHref({ type, days, view }, { type: t.value })} className={chip(type === t.value)}>
            {t.label}
          </Link>
        ))}
        <span className="text-xs text-muted ml-4 mr-1">Fenêtre :</span>
        {DAYS.map((d) => (
          <Link key={d.value} href={buildHref({ type, days, view }, { days: d.value })} className={chip(days === d.value)}>
            {d.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
