import { ChatInterface } from '@/components/assistant/ChatInterface';
import { SectionHeader, StatPill, PremiumPanel } from '@/components/ui/premium';

export const metadata = {
  title: 'Assistant IA Analyste | BRVM Analyst Pro',
  description: 'Analyse technique et fondamentale des actions BRVM par IA',
};

interface Props {
  searchParams: Promise<{ symbole?: string }>;
}

export default async function AssistantPage({ searchParams }: Props) {
  const { symbole } = await searchParams;
  const sym = symbole?.toUpperCase();

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeader
          kicker="Intelligence artificielle · Exclusif"
          title={sym ? `Assistant IA — ${sym}` : 'Assistant IA Analyste'}
          subtitle="Analyse multi-dimensionnelle en temps réel — technique, fondamentale, macro UEMOA."
          actions={
            <div className="flex items-center gap-2">
              <StatPill tone="gold">✦ Premium</StatPill>
              {sym && (
                <StatPill tone="sapphire">{sym}</StatPill>
              )}
            </div>
          }
        />
      </div>

      {/* Gold rule */}
      <div className="gold-rule" />

      {/* Chat container — double-bezel */}
      <div className="rounded-panel border p-1.5 border-gold/20 bg-gold/[0.03]">
        <div className="rounded-[calc(1.125rem-0.375rem)] bg-surface shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] overflow-hidden">
          <ChatInterface symbolePreselect={sym} />
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-[11px] text-faint text-center leading-relaxed">
        Cet outil est une aide à l&apos;analyse. Il ne constitue pas un conseil en investissement.
        Les informations produites sont dérivées des données de marché BRVM et ne garantissent pas les performances futures.
      </p>
    </div>
  );
}
