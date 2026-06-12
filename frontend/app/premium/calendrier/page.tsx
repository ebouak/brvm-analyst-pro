import { getDatesClés, type TypeDate } from '@/lib/premium/calendrier';
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

function DayBlock({ d }: { d: ReturnType<typeof Array.prototype.filter>[number] }) {
  const cfg = TYPE_CONFIG[d.type as TypeDate] ?? TYPE_CONFIG.publication;
  const dateObj = new Date(d.date + 'T12:00:00Z');
  const jourCourt = dateObj.toLocaleDateString('fr-FR', { weekday: 'short' });
  const moisCourt = dateObj.toLocaleDateString('fr-FR', { month: 'short' });
  const jour = String(dateObj.getUTCDate()).padStart(2, '0');

  return (
    <div className="group flex items-start gap-4 rounded-card border border-border bg-surface p-4 shadow-card transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-gold/20 hover:shadow-gold/5">
      {/* Date pillar */}
      <div className="flex min-w-[56px] flex-col items-center justify-center rounded-lg border border-border-strong bg-elevated px-2 py-2.5">
        <span className="text-[9px] font-semibold uppercase tracking-widest text-faint">{jourCourt}</span>
        <span className="tabular font-display text-xl font-bold text-ivory">{jour}</span>
        <span className="text-[9px] font-medium uppercase text-muted">{moisCourt}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          {d.code && (
            <a
              href={`/actions/${d.code}`}
              className="font-mono text-xs font-bold text-gold transition-colors hover:text-gold-soft"
            >
              {d.code}
            </a>
          )}
          <span className="text-sm font-medium text-ivory">{d.designation}</span>
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cfg.color} ${cfg.bg} ${cfg.border}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        </div>
        <p className="text-xs text-muted truncate leading-relaxed">{d.detail}</p>
      </div>

      {/* Right accent line */}
      <div className={`w-0.5 self-stretch rounded-full ${cfg.dot} opacity-30 group-hover:opacity-60 transition-opacity duration-300`} />
    </div>
  );
}

function DateSection({
  items,
  titre,
  passé = false,
}: {
  items: Awaited<ReturnType<typeof getDatesClés>>;
  titre: string;
  passé?: boolean;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <Eyebrow className={passé ? 'text-faint/60' : 'text-gold/70'}>{titre}</Eyebrow>
        <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
      </div>
      {items.length === 0 ? (
        <EmptyStatePremium
          icon="◇"
          title="Aucune date enregistrée"
          hint="Les prochaines dates apparaîtront ici dès leur publication."
        />
      ) : (
        <div className="space-y-2">
          {items.map((d, i) => (
            <DayBlock key={i} d={d} />
          ))}
        </div>
      )}
    </section>
  );
}

export default async function CalendrierPremiumPage() {
  const dates = await getDatesClés(12);
  const today = new Date().toISOString().split('T')[0]!;
  const passees = dates.filter((d) => d.date < today);
  const avenir  = dates.filter((d) => d.date >= today);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <SectionHeader
          kicker="Agenda Premium"
          title="Dates Clés"
          subtitle="Publications, dividendes et Assemblées Générales sur 12 mois."
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

      {/* Stats rapides */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(Object.entries(TYPE_CONFIG) as [TypeDate, typeof TYPE_CONFIG[TypeDate]][]).map(([type, cfg]) => {
          const count = avenir.filter((d) => d.type === type).length;
          return (
            <div key={type} className={`rounded-card border bg-surface p-3 shadow-card ${cfg.border}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-widest ${cfg.color}`}>{cfg.label}</p>
              <p className={`tabular mt-1 text-2xl font-bold ${cfg.color}`}>{count}</p>
              <p className="text-[10px] text-faint mt-0.5">à venir</p>
            </div>
          );
        })}
      </div>

      {/* Sections */}
      <DateSection items={avenir} titre={`À venir · ${avenir.length} événement${avenir.length !== 1 ? 's' : ''}`} />
      <DateSection items={passees} titre={`Passées · 3 derniers mois · ${passees.length}`} passé />
    </div>
  );
}
