import type { Config } from 'tailwindcss';

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  BRVM Analyst Pro — Design System « Maison de marché premium africaine »  ║
// ║  Noir laqué · ivoire raffiné · or rare · émeraude · saphir               ║
// ╚══════════════════════════════════════════════════════════════════════════╝
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Surfaces minérales (noir laqué) ────────────────────────────────
        bg:       '#07080a',   // page — obsidienne / noir laqué
        surface:  '#0e1014',   // cartes, panneaux — onyx
        elevated: '#15181e',   // modales, dropdowns — graphite
        sunken:   '#050609',   // creux, fonds de champs
        border:   '#20242d',   // filets — hairline minéral
        'border-strong': '#2c313d',

        obsidian: '#07080a',
        onyx:     '#0e1014',
        graphite: '#15181e',

        // ── Or rare — consécration (logo, nav active, CTA signature) ───────
        accent:        '#c8a45c',
        'accent-dim':  '#9c7d3f',
        'accent-glow': '#c8a45c2e',
        gold:          '#c8a45c',
        'gold-soft':   '#e3c98c',
        'gold-deep':   '#8a6d35',

        // ── Émeraude — rendement / validation / hausse ─────────────────────
        up:       '#16b46a',
        emerald:  '#16b46a',
        'emerald-soft': '#3fd991',

        // ── Saphir — signal / systèmes secondaires / informationnel ────────
        info:     '#3b74e8',
        sapphire: '#3b74e8',
        'sapphire-soft': '#6f9bff',
        blue:     '#3b74e8',

        // ── Sémantiques restants ───────────────────────────────────────────
        down:   '#e24b4b',
        ruby:   '#e24b4b',
        warn:   '#e0a93a',
        purple: '#8b6fc2',

        // ── Texte — ivoire raffiné ─────────────────────────────────────────
        white:  '#ece4d3',
        ivory:  '#ece4d3',
        muted:  '#989384',
        faint:  '#54513f',
      },

      // ── Typographies ──────────────────────────────────────────────────────
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans:    ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        'display-xl': ['clamp(2.75rem, 6vw, 4.75rem)', { lineHeight: '1.02', letterSpacing: '-0.02em', fontWeight: '500' }],
        'display-lg': ['clamp(2rem, 4vw, 3rem)',       { lineHeight: '1.08', letterSpacing: '-0.015em', fontWeight: '500' }],
        'heading-lg': ['24px', { lineHeight: '1.3', fontWeight: '600' }],
        'heading-md': ['20px', { lineHeight: '1.4', fontWeight: '600' }],
        'heading-sm': ['16px', { lineHeight: '1.5', fontWeight: '600' }],
        'body-md':    ['14px', { lineHeight: '1.65' }],
        'body-sm':    ['12px', { lineHeight: '1.6' }],
        'mono-lg':    ['20px', { lineHeight: '1.2', fontWeight: '600' }],
        'mono-sm':    ['11px', { lineHeight: '1.4' }],
        'overline':   ['11px', { lineHeight: '1.4', letterSpacing: '0.18em', fontWeight: '600' }],
      },
      letterSpacing: { overline: '0.18em' },

      // ── Espacements ───────────────────────────────────────────────────────
      spacing: { section: '24px', card: '16px', gutter: '32px' },

      // ── Rayons ────────────────────────────────────────────────────────────
      borderRadius: { card: '14px', panel: '18px', chip: '7px', full: '9999px' },

      // ── Ombres ────────────────────────────────────────────────────────────
      boxShadow: {
        card:   '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 4px 24px -6px rgba(0,0,0,0.7)',
        panel:  '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 12px 48px -12px rgba(0,0,0,0.8)',
        modal:  '0 24px 80px -16px rgba(0,0,0,0.85)',
        gold:   '0 0 0 1px rgba(200,164,92,0.35), 0 8px 32px -8px rgba(200,164,92,0.25)',
        'gold-sm': '0 0 0 1px rgba(200,164,92,0.4)',
        emerald: '0 0 0 1px rgba(22,180,106,0.35), 0 8px 28px -10px rgba(22,180,106,0.3)',
      },

      // ── Atmosphère ────────────────────────────────────────────────────────
      backgroundImage: {
        'gold-line': 'linear-gradient(90deg, transparent, rgba(200,164,92,0.5), transparent)',
        'obsidian-glow': 'radial-gradient(120% 80% at 50% -10%, rgba(200,164,92,0.10), transparent 60%)',
        'emerald-veil': 'radial-gradient(80% 60% at 100% 0%, rgba(22,180,106,0.08), transparent 70%)',
      },

      // ── Animations ────────────────────────────────────────────────────────
      keyframes: {
        'rise-in': {
          '0%':   { opacity: '0', transform: 'translateY(14px)' },
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
        'rise-in':    'rise-in 0.6s cubic-bezier(0.16,1,0.3,1) both',
        'gold-sweep': 'gold-sweep 6s linear infinite',
        ticker:       'ticker 40s linear infinite',
      },
    },
  },
  plugins: [],
};
export default config;
