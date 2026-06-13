import { getDatesClés, type TypeDate, type DateCle } from '@/lib/premium/calendrier';
import ViewTabs from '@/components/ViewTabs';
import { CALENDAR_TABS } from '@/lib/calendarTabs';
import {
  SectionHeader,
  PremiumPanel,
  EmptyStatePremium,
  StatPill,
  Eyebrow,
} from '@/components/ui/premium';

const TYPE_CONFIG: Record<TypeDate, { label: string; color: string; bg: string; border: string; dot: string }> = {
  publication:        { label: 'États financiers', color: 'text-sapphire',  bg: 'bg-sapphire/10', border: 'border-sapphire/20', dot: 'bg-sapphire' },
  dividende_annonce:  { label: 'Dividende annoncé', color: 'text-up',   bg: 'bg-up/10', border: 'border-up/20', dot: 'bg-up' },
  dividende_paiement: { label: 'Paiement dividende', color: 'text-gold',  bg: 'bg-gold/10', border: 'border-gold/20', dot: 'bg-gold' },
  ag:                 { label: 'Assemblée Générale', color: 'text-warn', bg: 'bg-warn/10', border: 'border-warn/20', dot: 'bg-warn' },
};

/** Ligne compacte d'un évènement (date + type + détail). */
function EventRow({ d, isFuture }: { d: DateCle; isFuture: boolean }) {
  const cfg = TYPE_CONFIG[d.type] ?? TYPE_CONFIG.publication;
  const dateObj = new Date(d.date + 'T12:00:00Z');
  const jour = String(dateObj.getUTCDate()).padStart(2, '0');
  const moisCourt = dateObj.toLocaleDateString('fr-FR', { month: 'short' });
  const annee = dateObj.getUTCFullYear();

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0">
      {/* Date */}
      <div className="flex min-w-[48px] flex-col items-center justify-center rounded-md border border-border bg-elevated/60 px-1.5 py-1">
        <span className="tabular text-sm font-bold text-ivory leading-none">{jour}</span>
        <span className="text-[9px] font-medium uppercase text-muted mt-0.5">{moisCourt} {String(annee).slice(2)}</span>
      </div>
      {/* Détail */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cfg.color} ${cfg.bg} ${cfg.border}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
          {isFuture && (
            <span className="inline-flex items-center rounded-full border border-up/30 bg-up/10 px-2 py-0.5 text-[10px] font-semibold text-up">
              À venir
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted leading-relaxed">{d.detail}</p>
      </div>
    </div>
  );
}

/** Carte regroupant tous les communiqués d'une société. */
function EntityCard({
  code,
  designation,
  items,
  today,
}: {
  code: string;
  designation: string;
  items: DateCle[];
  today: string;
}) {
  return (
    <PremiumPanel className="p-0 overflow-hidden">
      {/* En-tête entité */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-elevated/40 px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {code && (
            <a
              href={`/actions/${code}`}
              className="font-mono text-xs font-bold text-gold transition-colors hover:text-gold-soft shrink-0"
            >
              {code}
            </a>
          )}
          <span className="text-sm font-semibold text-ivory truncate">{designation}</span>
        </div>
        <StatPill tone="neutral">
          <span className="tabular">{items.length}</span>&nbsp;date{items.length !== 1 ? 's' : ''}
        </StatPill>
      </div>
      {/* Liste des évènements */}
      <div className="px-4 py-1">
        {items.map((d, i) => (
          <EventRow key={i} d={d} isFuture={d.date >= today} />
        ))}
      </div>
    </PremiumPanel>
  );
}

interface EntityGroup {
  code: string;
  designation: string;
  items: DateCle[];
  lastDate: string;
}

function groupByEntity(dates: DateCle[]): EntityGroup[] {
  const map = new Map<string, EntityGroup>();
  for (const d of dates) {
    const key = d.code || d.designation;
    if (!map.has(key)) map.set(key, { code: d.code, designation: d.designation, items: [], lastDate: '' });
    map.get(key)!.items.push(d);
  }
  return [...map.values()]
    .map((g) => {
      const items = [...g.items].sort((a, b) => b.date.localeCompare(a.date));
      return { ...g, items, lastDate: items[0]?.date ?? '' };
    })
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate));
}

export default async function CalendrierPremiumPage() {
  const dates = await getDatesClés(12);
  const today = new Date().toISOString().split('T')[0]!;
  const avenir = dates.filter((d) => d.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const groups = groupByEntity(dates);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <SectionHeader
          kicker="Agenda Premium"
          title="Dates Clés"
          subtitle="Communiqués, états financiers, dividendes et Assemblées Générales — regroupés par société."
          actions={<StatPill tone="gold">✦ Premium</StatPill>}
        />
        <ViewTabs tabs={CALENDAR_TABS} current="/premium/calendrier" />

        {/* Légende des types */}
        <PremiumPanel className="p-4">
          <div className="flex flex-wrap gap-2">
            {(Object.entries(TYPE_CONFIG) as [TypeDate, typeof TYPE_CONFIG[TypeDate]][]).map(([type, cfg]) => (
              <span
                key={type}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-semibold ${cfg.color} ${cfg.bg} ${cfg.border}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </span>
            ))}
          </div>
        </PremiumPanel>
      </div>

      {/* Stats rapides — total par type sur la fenêtre (12 mois glissants) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(Object.entries(TYPE_CONFIG) as [TypeDate, typeof TYPE_CONFIG[TypeDate]][]).map(([type, cfg]) => {
          const count = dates.filter((d) => d.type === type).length;
          const future = avenir.filter((d) => d.type === type).length;
          return (
            <div key={type} className={`rounded-card border bg-surface p-3 shadow-card ${cfg.border}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-widest ${cfg.color}`}>{cfg.label}</p>
              <p className={`tabular mt-1 text-2xl font-bold ${cfg.color}`}>{count}</p>
              <p className="text-[10px] text-faint mt-0.5">{future > 0 ? `${future} à venir` : 'sur 12 mois'}</p>
            </div>
          );
        })}
      </div>

      {/* À venir — mis en avant uniquement s'il y a des dates futures */}
      {avenir.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <Eyebrow className="text-up/70">À venir · {avenir.length} évènement{avenir.length !== 1 ? 's' : ''}</Eyebrow>
            <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
          </div>
          <PremiumPanel className="px-4 py-1">
            {avenir.map((d, i) => (
              <EventRow key={i} d={d} isFuture />
            ))}
          </PremiumPanel>
        </section>
      )}

      {/* Communiqués regroupés par société */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <Eyebrow className="text-gold/70">Par société · {groups.length} émetteur{groups.length !== 1 ? 's' : ''}</Eyebrow>
          <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
        </div>
        {groups.length === 0 ? (
          <EmptyStatePremium
            icon="◇"
            title="Aucune date enregistrée"
            hint="Les communiqués et dates clés apparaîtront ici dès leur publication."
          />
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <EntityCard key={g.code || g.designation} code={g.code} designation={g.designation} items={g.items} today={today} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
