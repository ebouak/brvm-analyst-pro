'use client';

// Bandeau haut de la page de connexion : cours du jour qui défilent +
// strip de bougies animées (vraies variations du jour, jamais inventées).
import { motion } from 'framer-motion';
import type { LoginTick, LoginCandle } from '@/app/login/getLoginMarket';

function AnimatedCandle({ candle, index }: { candle: LoginCandle; index: number }) {
  const up = candle.pct >= 0;
  const color = up ? '#3fe18b' : '#ff6b6b';
  // Corps proportionnel à l'amplitude (borné pour rester lisible).
  const mag = Math.min(Math.abs(candle.pct), 8);
  const bodyH = 10 + (mag / 8) * 34; // 10 → 44 px
  const wickH = bodyH + 10 + (index % 3) * 4;

  return (
    <div
      className="group relative flex w-5 flex-col items-center justify-center"
      title={`${candle.code} ${up ? '+' : ''}${candle.pct.toFixed(2)}%`}
    >
      {/* Mèche */}
      <motion.span
        aria-hidden
        className="absolute left-1/2 -translate-x-1/2 rounded-full"
        style={{ width: 1.5, background: color, opacity: 0.5 }}
        initial={{ height: wickH * 0.6 }}
        animate={{ height: [wickH * 0.6, wickH, wickH * 0.6] }}
        transition={{ duration: 2.4 + (index % 5) * 0.3, repeat: Infinity, ease: 'easeInOut', delay: index * 0.12 }}
      />
      {/* Corps */}
      <motion.span
        className="relative rounded-[2px]"
        style={{ width: 8, background: color, boxShadow: `0 0 10px ${color}55` }}
        initial={{ height: bodyH * 0.4, opacity: 0.7 }}
        animate={{
          height: [bodyH * 0.55, bodyH, bodyH * 0.7, bodyH],
          opacity: [0.6, 1, 0.8, 1],
        }}
        transition={{ duration: 2.2 + (index % 4) * 0.4, repeat: Infinity, ease: 'easeInOut', delay: index * 0.1 }}
      />
      <span className="mt-1.5 text-[8px] font-medium tracking-tight text-white/35 group-hover:text-white/70 transition-colors">
        {candle.code}
      </span>
    </div>
  );
}

export function LoginMarketBar({ asOf, ticks, candles }: { asOf: string | null; ticks: LoginTick[]; candles: LoginCandle[] }) {
  if (!asOf || ticks.length === 0) return null;
  const doubled = [...ticks, ...ticks];

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col">
      {/* Ticker des cours du jour */}
      <div
        className="border-b border-white/5 bg-black/40 py-2 backdrop-blur-sm"
        style={{ maskImage: 'linear-gradient(90deg,transparent,black 5%,black 95%,transparent)', WebkitMaskImage: 'linear-gradient(90deg,transparent,black 5%,black 95%,transparent)' }}
      >
        <div className="flex w-max animate-ticker gap-7 whitespace-nowrap px-4 font-mono">
          {doubled.map((t, i) => (
            <span key={`${t.sym}-${i}`} className="inline-flex items-center gap-1.5 text-[11px] font-bold">
              <span className="text-white/45">{t.sym}</span>
              <span className="text-white/85">{t.val}</span>
              <span style={{ color: t.dir === 'up' ? '#3fe18b' : '#ff6b6b' }}>{t.pct}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Strip de bougies animées (signaux du marché) */}
      {candles.length > 0 && (
        <div className="flex items-end justify-center gap-2.5 px-4 pt-4 pb-2">
          {candles.map((c, i) => (
            <AnimatedCandle key={c.code} candle={c} index={i} />
          ))}
        </div>
      )}

      <div className="px-4 pb-1 text-center">
        <span className="text-[9px] uppercase tracking-[0.2em] text-white/25">
          Séance BRVM · {asOf}
        </span>
      </div>
    </div>
  );
}
