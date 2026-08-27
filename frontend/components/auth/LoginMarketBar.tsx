'use client';

// Bandeau haut de la page de connexion : cours du jour qui défilent +
// strip de bougies animées (vraies variations du jour, jamais inventées).
import { motion, useReducedMotion } from 'framer-motion';
import type { LoginTick, LoginCandle } from '@/app/login/getLoginMarket';

/**
 * Une bougie du strip, animée en `scaleY` et non en `height`.
 *
 * Pourquoi ce détail compte : ces bougies bouclent à l'infini sur la page de
 * connexion. Animer `height` sort du compositeur — chaque image déclenche un
 * recalcul de mise en page, et comme la colonne est en `justify-center`, la
 * hauteur du corps la recentrait : l'étiquette du code sautillait à chaque
 * frame. `scaleY` s'exécute sur le compositeur, ne reflowe rien, et
 * l'étiquette cesse de bouger.
 *
 * L'origine de transformation reste au centre : c'est ainsi que la bougie
 * grandissait déjà (colonne centrée). On corrige le coût, pas l'apparence.
 *
 * `useReducedMotion` coupe la boucle. Une animation infinie qui ignore la
 * préférence système est exactement ce qu'il ne faut pas faire, et celle-ci
 * était sur la page que tout le monde traverse pour se connecter.
 */
function AnimatedCandle({ candle, index }: { candle: LoginCandle; index: number }) {
  const reduire = useReducedMotion();
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
        className="absolute left-1/2 rounded-full"
        // La hauteur est désormais FIXE (elle vaut le maximum de l'ancienne
        // animation) ; c'est `scaleY` qui varie. `translateX(-50%)` passe dans
        // `style` : la classe Tailwind `-translate-x-1/2` serait écrasée par
        // le transform que framer-motion écrit sur l'élément.
        style={{ width: 1.5, height: wickH, background: color, opacity: 0.5, x: '-50%' }}
        initial={{ scaleY: reduire ? 1 : 0.6 }}
        animate={reduire ? { scaleY: 1 } : { scaleY: [0.6, 1, 0.6] }}
        transition={
          reduire
            ? { duration: 0 }
            : { duration: 2.4 + (index % 5) * 0.3, repeat: Infinity, ease: 'easeInOut', delay: index * 0.12 }
        }
      />
      {/* Corps */}
      <motion.span
        className="relative rounded-[2px]"
        style={{ width: 8, height: bodyH, background: color, boxShadow: `0 0 10px ${color}55` }}
        initial={{ scaleY: reduire ? 1 : 0.4, opacity: reduire ? 1 : 0.7 }}
        animate={
          reduire
            ? { scaleY: 1, opacity: 1 }
            : { scaleY: [0.55, 1, 0.7, 1], opacity: [0.6, 1, 0.8, 1] }
        }
        transition={
          reduire
            ? { duration: 0 }
            : { duration: 2.2 + (index % 4) * 0.4, repeat: Infinity, ease: 'easeInOut', delay: index * 0.1 }
        }
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
