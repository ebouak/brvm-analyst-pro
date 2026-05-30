import type { Brief } from '@/lib/brief';
import { fmtDateFR } from '@/lib/format';

interface Props {
  brief: Brief;
}

const toneStyles: Record<Brief['tone'], string> = {
  positive: 'border-l-2 border-l-up/40',
  negative: 'border-l-2 border-l-down/40',
  neutral:  'border-l-2 border-l-border',
};

const toneBadge: Record<Brief['tone'], { label: string; cls: string }> = {
  positive: { label: 'Marché porteur',   cls: 'text-up   bg-up/10'   },
  negative: { label: 'Marché défavorable', cls: 'text-down bg-down/10' },
  neutral:  { label: 'Marché neutre',    cls: 'text-warn  bg-warn/10' },
};

export default function DailyBrief({ brief }: Props) {
  const paragraphs = [brief.summary, brief.sectors, brief.signals].filter(Boolean);
  const badge = toneBadge[brief.tone];

  return (
    <div
      className={`bg-surface border border-border rounded-xl p-5 ${toneStyles[brief.tone]}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h2 className="text-sm font-semibold text-white">
          Brief — Séance du {fmtDateFR(brief.date)}
        </h2>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      {/* Paragraphs */}
      <div className="space-y-2.5">
        {paragraphs.map((para, i) => (
          <p key={i} className="text-sm text-white/90 leading-relaxed">
            {para}
          </p>
        ))}
      </div>
    </div>
  );
}
