import type { Config } from 'tailwindcss';

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  BRVM Analyst Pro — Design System « Taste » (maison de marché premium)     ║
// ║  Obsidienne chaude · ivoire · or riche (#d0a231/#f4d57b) · émeraude/saphir ║
// ╚══════════════════════════════════════════════════════════════════════════╝
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Surfaces ───────────────────────────────────────────────────────
        bg:       '#060607',
        surface:  '#0e0e12',
        elevated: '#16161b',
        sunken:   '#050506',
        border:   '#20202a',
        'border-strong': '#2c2c38',

        obsidian: '#060607',
        onyx:     '#0e0e12',
        graphite: '#16161b',

        // ── Or riche — consécration ───────────────────────────────────────
        accent:        '#d0a231',
        'accent-dim':  '#9c7d3f',
        'accent-glow': '#d0a23124',
        gold:          '#d0a231',
        'gold-2':      '#f4d57b',
        'gold-soft':   '#f4d57b',
        'gold-deep':   '#8a6d35',

        // ── Émeraude — rendement / hausse ─────────────────────────────────
        up:       '#3fe18b',
        emerald:  '#3fe18b',
        'emerald-soft': '#7af0b3',

        // ── Saphir — signal / secondaire ──────────────────────────────────
        info:     '#8bacff',
        sapphire: '#8bacff',
        'sapphire-soft': '#b3c8ff',
        blue:     '#8bacff',

        // ── Rubis — baisse ────────────────────────────────────────────────
        down:   '#ff7567',
        ruby:   '#ff7567',
        warn:   '#e0a93a',
        purple: '#8b6fc2',

        // ── Texte — ivoire ────────────────────────────────────────────────
        white:  '#efe7d8',
        ivory:  '#efe7d8',
        muted:  '#baaf9f',
        faint:  '#756d61',
      },

      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans:    ['var(--font-sans)', 'Helvetica Neue', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'display-xl': ['clamp(3rem, 6.3vw, 6.8rem)', { lineHeight: '0.9', letterSpacing: '-0.08em', fontWeight: '500' }],
        'display-lg': ['clamp(2rem, 3.4vw, 3.4rem)', { lineHeight: '0.94', letterSpacing: '-0.06em', fontWeight: '500' }],
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
      borderRadius: { card: '1.2rem', panel: '1.65rem', xl2: '2rem', chip: '0.7rem', full: '9999px' },

      boxShadow: {
        card:   '0 10px 24px rgba(0,0,0,0.22)',
        panel:  '0 22px 60px rgba(0,0,0,0.36)',
        modal:  '0 24px 80px -16px rgba(0,0,0,0.85)',
        gold:   '0 0 0 1px rgba(208,162,49,0.14), 0 24px 80px rgba(208,162,49,0.11)',
        'gold-sm': '0 0 0 1px rgba(208,162,49,0.4)',
        emerald: '0 0 0 1px rgba(63,225,139,0.18), 0 8px 28px -10px rgba(63,225,139,0.3)',
      },

      backgroundImage: {
        'gold-line': 'linear-gradient(90deg, transparent, rgba(208,162,49,0.55), transparent)',
        'obsidian-glow': 'radial-gradient(120% 80% at 50% -10%, rgba(208,162,49,0.12), transparent 60%)',
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
