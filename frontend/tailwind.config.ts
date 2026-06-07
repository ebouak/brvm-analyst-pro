import type { Config } from 'tailwindcss';

// Design tokens — Dark Finance × Claude Code aesthetic
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // ── Colors ──────────────────────────────────────────────────────────────
      colors: {
        // Backgrounds (Claude Code dark palette)
        bg:       '#0d0f17',   // page background — slightly deeper
        surface:  '#13161f',   // cards, panels
        elevated: '#1a1d2e',   // modals, dropdowns
        border:   '#1e2235',   // borders — cooler, more refined

        // Claude accent — warm coral/orange (Anthropic brand)
        accent:   '#cf6b4e',   // primary UI accent (CTA, active nav, focus)
        'accent-dim': '#a3523a', // pressed / darker
        'accent-glow': '#cf6b4e33', // glow / bg tint

        // Financial signals — unchanged (semantic, must stay green/red)
        up:   '#00c853',   // bull / BUY
        down: '#f44336',   // bear / SELL
        warn: '#ffb300',   // caution / HOLD
        info: '#2196f3',   // informational

        // Accents
        blue:   '#42a5f5',
        purple: '#7e57c2',

        // Text hierarchy
        white:  '#e8e3dc',   // primary text — warm white (Claude feel)
        muted:  '#8892a4',   // secondary text
        faint:  '#3d4461',   // disabled / tertiary
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
        section: '24px',
        card:    '16px',
      },

      // ── Border radius ────────────────────────────────────────────────────────
      borderRadius: {
        card: '10px',
        chip: '6px',
        full: '9999px',
      },

      // ── Box shadows ──────────────────────────────────────────────────────────
      boxShadow: {
        card:   '0 2px 12px rgba(0,0,0,0.5)',
        modal:  '0 8px 40px rgba(0,0,0,0.7)',
        accent: '0 0 0 2px rgba(207,107,78,0.4)',
      },
    },
  },
  plugins: [],
};
export default config;
