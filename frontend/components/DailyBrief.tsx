import type { Brief } from '@/lib/brief';
import { fmtDateFR } from '@/lib/format';

interface Props {
  brief: Brief;
}

const toneConfig: Record<Brief['tone'], {
  bar: string;
  badge: string;
  label: string;
  glow: string;
  dot: string;
}> = {
  positive: {
    bar:   'border-l-up/50',
    badge: 'border-up/25 bg-up/10 text-up',
    label: 'Marché porteur',
    glow:  'rgba(22,180,106,0.04)',
    dot:   'bg-up',
  },
  negative: {
    bar:   'border-l-down/50',
    badge: 'border-down/25 bg-down/10 text-down',
    label: 'Marché défavorable',
    glow:  'rgba(226,75,75,0.04)',
    dot:   'bg-down',
  },
  neutral: {
    bar:   'border-l-warn/40',
    badge: 'border-warn/25 bg-warn/10 text-warn',
    label: 'Marché neutre',
    glow:  'rgba(224,169,58,0.04)',
    dot:   'bg-warn',
  },
};

export default function DailyBrief({ brief }: Props) {
  const paragraphs = [brief.summary, brief.sectors, brief.signals].filter(Boolean);
  const cfg = toneConfig[brief.tone];

  return (
    /* Outer shell — double-bezel, tone-tinted */
    <div className={`rounded-panel border border-border/60 p-1.5 bg-border/25 transition-all duration-300`}>
      {/* Inner core — left accent bar + content */}
      <div
        className={`
          rounded-[calc(1.125rem-0.375rem)] bg-surface
          shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]
          border-l-2 ${cfg.bar}
          px-5 py-5
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div className="flex items-center gap-2.5">
            <span className={`h-2 w-2 rounded-full ${cfg.dot} shrink-0`} />
            <h2 className="font-display text-base text-ivory leading-none">
              Brief — <span className="text-muted font-sans font-normal text-sm">Séance du {fmtDateFR(brief.date)}</span>
            </h2>
          </div>
          <span
            className={`
              inline-flex items-center rounded-full border px-3 py-0.5
              text-[10px] font-semibold tracking-wide uppercase
              ${cfg.badge}
            `}
          >
            {cfg.label}
          </span>
        </div>

        {/* Paragraphs */}
        <div className="space-y-3">
          {paragraphs.map((para, i) => (
            <p key={i} className="text-sm text-ivory/85 leading-relaxed">
              {para}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
