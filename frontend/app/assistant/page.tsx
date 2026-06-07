import { ChatInterface } from '@/components/assistant/ChatInterface';

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
    <div className="p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-heading-md text-white font-bold">
          Assistant IA Analyste
          {sym && <span className="ml-2 text-accent font-mono">{sym}</span>}
        </h1>
        <p className="text-sm text-muted mt-1">
          Analyse multi-dimensionnelle — technique, fondamentale, macro UEMOA
        </p>
      </div>
      <ChatInterface symbolePreselect={sym} />
    </div>
  );
}
