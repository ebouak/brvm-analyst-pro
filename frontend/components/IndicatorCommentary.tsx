import Link from 'next/link';
import type { IndicatorReading } from '@/lib/indicators/commentary';

const TONE: Record<IndicatorReading['tone'], { label: string; cls: string }> = {
  haussier: { label: 'Lecture haussière', cls: 'text-up border-up/30 bg-up/[0.04]' },
  baissier: { label: 'Lecture baissière', cls: 'text-down border-down/30 bg-down/[0.04]' },
  mixte: { label: 'Signaux divergents', cls: 'text-warn border-warn/30 bg-warn/[0.04]' },
  neutre: { label: 'Lecture neutre', cls: 'text-muted border-border bg-surface' },
};

/** Questions IA prêtes à l'emploi (deep-link vers l'assistant pré-rempli). */
const QUESTIONS = [
  'Que disent le RSI et le MACD aujourd’hui ?',
  'Quel est le risque à court terme ?',
  'Faut-il acheter, vendre ou conserver ?',
  'Pourquoi ce signal aujourd’hui ?',
];

/**
 * Encart de lecture automatique des indicateurs + boutons « Expliquer avec l'IA »
 * (questions prêtes à l'emploi, deep-link vers l'assistant pré-rempli).
 */
export default function IndicatorCommentary({ reading, code }: { reading: IndicatorReading; code: string }) {
  if (reading.points.length === 0) return null;
  const t = TONE[reading.tone];

  return (
    <div className="space-y-3">
      <div className={`rounded-card border p-4 ${t.cls}`}>
        <p className="text-[11px] uppercase tracking-[0.18em] mb-2 opacity-80">{t.label}</p>
        <ul className="space-y-1.5">
          {reading.points.map((p, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-muted leading-relaxed">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-faint" /><span>{p}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-faint">✦ Expliquer avec l'IA :</span>
        {QUESTIONS.map((q) => (
          <Link
            key={q}
            href={`/assistant?symbole=${code}&q=${encodeURIComponent(q)}`}
            className="text-[11px] rounded-full border border-gold/30 bg-gold/[0.05] px-2.5 py-1 text-gold/90 hover:bg-gold/10 transition-colors"
          >
            {q}
          </Link>
        ))}
      </div>
    </div>
  );
}
