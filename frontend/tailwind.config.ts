import type { Config } from 'tailwindcss';

// Design tokens — Dark Finance (sync Figma Variables collection)
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // ── Colors ──────────────────────────────────────────────────────────────
      colors: {
        // Backgrounds
        bg:      '#0f1117',   // bg.primary
        surface: '#161922',   // bg.surface
        elevated:'#1c2030',   // bg.surface-elevated
        border:  '#232733',   // border.default

        // Status / signals
        up:   '#00c853',   // status.bull / signal.buy
        down: '#f44336',   // status.bear / signal.sell
        warn: '#ffb300',   // status.warning
        info: '#2196f3',   // status.info

        // Text
        muted:   '#8b93a7',   // text.secondary
        faint:   '#4a5268',   // text.disabled
      },

      // ── Typography ──────────────────────────────────────────────────────────
      fontFamily: {
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'heading-lg': ['24px', { lineHeight: '1.3', fontWeight: '700' }],
        'heading-md': ['20px', { lineHeight: '1.4', fontWeight: '600' }],
        'heading-sm': ['16px', { lineHeight: '1.5', fontWeight: '600' }],
        'body-md':    ['14px', { lineHeight: '1.6' }],
        'body-sm':    ['12px', { lineHeight: '1.6' }],
        'mono-lg':    ['20px', { lineHeight: '1.2', fontWeight: '700' }],
        'mono-sm':    ['11px', { lineHeight: '1.4' }],
      },

      // ── Spacing ─────────────────────────────────────────────────────────────
      spacing: {
        section: '24px',  // spacing.section
        card:    '16px',  // spacing.card
      },

      // ── Border radius ────────────────────────────────────────────────────────
      borderRadius: {
        card: '12px',   // radius.md (cards)
        chip: '6px',    // radius.sm (badges, pills)
        full: '9999px', // radius.full
      },

      // ── Box shadows ──────────────────────────────────────────────────────────
      boxShadow: {
        card:  '0 2px 8px rgba(0,0,0,0.4)',
        modal: '0 8px 32px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
};
export default config;
