import type { Config } from 'tailwindcss';

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  BRVM Analyst Pro — Design System « DeFi Cyan »                            ║
// ║  Noir profond #030303 · teal #112B33 · cyan #56D7FD · ivoire #FCFCFC       ║
// ║  (les tokens 'gold'/'accent' portent désormais le cyan — compat conservée) ║
// ╚══════════════════════════════════════════════════════════════════════════╝
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Surfaces ───────────────────────────────────────────────────────
        bg:       '#030303',
        surface:  '#0a1417',
        elevated: '#112b33',
        sunken:   '#020303',
        border:   '#1b2a30',
        'border-strong': '#2a3d44',

        obsidian: '#030303',
        onyx:     '#0a1417',
        graphite: '#112b33',

        // ── Cyan — accent / CTA / consécration (porté par 'accent'+'gold') ──
        accent:        '#56d7fd',
        'accent-dim':  '#2fa9cf',
        'accent-glow': '#56d7fd24',
        gold:          '#56d7fd',
        'gold-2':      '#8fe6ff',
        'gold-soft':   '#8fe6ff',
        'gold-deep':   '#2a8aa8',
        cyan:          '#56d7fd',
        'cyan-soft':   '#8fe6ff',

        // ── Émeraude — rendement / hausse ─────────────────────────────────
        up:       '#3fe18b',
        emerald:  '#3fe18b',
        'emerald-soft': '#7af0b3',

        // ── Saphir/Info — désormais cyan ──────────────────────────────────
        info:     '#56d7fd',
        sapphire: '#56d7fd',
        'sapphire-soft': '#8fe6ff',
        blue:     '#56d7fd',

        // ── Rubis — baisse ────────────────────────────────────────────────
        down:   '#ff6b6b',
        ruby:   '#ff6b6b',
        warn:   '#f0b23a',
        purple: '#8b6fc2',

        // ── Texte ─────────────────────────────────────────────────────────
        white:  '#fcfcfc',
        ivory:  '#fcfcfc',
        muted:  '#b5b5b5',
        faint:  '#5c6b70',
      },

      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans:    ['var(--font-sans)', 'Helvetica Neue', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'display-xl': ['clamp(3rem, 6.3vw, 6.8rem)', { lineHeight: '0.9', letterSpacing: '-0.06em', fontWeight: '500' }],
        'display-lg': ['clamp(2rem, 3.4vw, 3.4rem)', { lineHeight: '0.94', letterSpacing: '-0.04em', fontWeight: '500' }],
        'heading-lg': ['24px', { lineHeight: '1.3', fontWeight: '600' }],
        'heading-md': ['20px', { lineHeight: '1.4', fontWeight: '600' }],
        'heading-sm': ['16px', { lineHeight: '1.5', fontWeight: '600' }],
        'body-md':    ['14px', { lineHeight: '1.7' }],
        'body-sm':    ['12px', { lineHeight: '1.6' }],
        'mono-lg':    ['20px', { lineHeight: '1.2', fontWeight: '600' }],
        'mono-sm':    ['11px', { lineHeight: '1.4' }],
        'overline':   ['10px', { lineHeight: '1.4', letterSpacing: '0.18em', fontWeight: '700' }],
      },
      letterSpacing: { overline: '0.18em' },
      spacing: { section: '24px', card: '16px', gutter: '32px' },
      maxWidth: { content: '1480px' },
      borderRadius: { card: '1.1rem', panel: '1.5rem', xl2: '1.8rem', chip: '0.6rem', full: '9999px' },

      boxShadow: {
        card:   '0 10px 24px rgba(0,0,0,0.35)',
        panel:  '0 22px 60px rgba(0,0,0,0.45)',
        modal:  '0 24px 80px -16px rgba(0,0,0,0.85)',
        gold:   '0 0 0 1px rgba(86,215,253,0.22), 0 16px 50px rgba(86,215,253,0.14)',
        'gold-sm': '0 0 0 1px rgba(86,215,253,0.45)',
        emerald: '0 0 0 1px rgba(63,225,139,0.18), 0 8px 28px -10px rgba(63,225,139,0.3)',
      },

      backgroundImage: {
        'gold-line': 'linear-gradient(90deg, transparent, rgba(86,215,253,0.5), transparent)',
        'obsidian-glow': 'radial-gradient(120% 80% at 50% -10%, rgba(86,215,253,0.10), transparent 60%)',
        'emerald-veil': 'radial-gradient(80% 60% at 100% 0%, rgba(63,225,139,0.08), transparent 70%)',
      },

      keyframes: {
        'rise-in': {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'gold-sweep': {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        ticker: {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'rise-in':    'rise-in 0.7s cubic-bezier(0.16,1,0.3,1) both',
        'gold-sweep': 'gold-sweep 6s linear infinite',
        ticker:       'ticker 46s linear infinite',
      },
    },
  },
  plugins: [],
};
export default config;
