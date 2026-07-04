import type { Config } from 'tailwindcss';

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  WESTBOURSE — Design System « DeFi Cyan »                                  ║
// ║  Noir profond #030303 · teal #112B33 · cyan #56D7FD · ivoire #FCFCFC       ║
// ║  (les tokens 'gold'/'accent' portent désormais le cyan — compat conservée) ║
// ╚══════════════════════════════════════════════════════════════════════════╝

/**
 * Compose une couleur Tailwind à partir d'une variable CSS "triplet RGB"
 * (ex. `--color-accent: 86 215 253;`) tout en préservant les modificateurs
 * d'opacité (`bg-accent/10`, `text-up/80`...). Nécessaire pour le mode clair
 * (data-theme="light") : la valeur change selon le thème, mais chaque classe
 * garde son alpha. Voir docs/superpowers/specs/2026-07-03-mode-clair-design.md.
 */
function withAlpha(cssVar: string) {
  return ({ opacityValue }: { opacityValue?: string }) =>
    opacityValue === undefined ? `rgb(var(${cssVar}))` : `rgb(var(${cssVar}) / ${opacityValue})`;
}

// Construit à part (type non contraint) : Tailwind supporte au runtime une
// fonction `({ opacityValue }) => string` comme valeur de couleur (pattern
// documenté, utilisé par ex. par shadcn/ui pour les couleurs pilotées par
// variables CSS), mais les types fournis par `tailwindcss` ne l'acceptent pas
// pour `Config['theme']['extend']['colors']` — d'où le cast unique à
// l'insertion dans `config`, plutôt que 20+ assertions ligne par ligne.
const themeColors = {
  // ── Surfaces ─────────────────────────────────────────────────────────────
  // Valeurs pilotées par variables CSS (app/globals.css) pour supporter le
  // mode clair (data-theme="light") sans dupliquer de classes — voir
  // docs/superpowers/specs/2026-07-03-mode-clair-design.md.
  bg:       withAlpha('--color-bg'),
  surface:  withAlpha('--color-surface'),
  elevated: withAlpha('--color-elevated'),
  sunken:   withAlpha('--color-sunken'),
  border:   withAlpha('--color-border'),
  'border-strong': withAlpha('--color-border-strong'),

  obsidian: withAlpha('--color-bg'),
  onyx:     withAlpha('--color-surface'),
  graphite: withAlpha('--color-elevated'),

  // ── Cyan — accent / CTA / consécration (porté par 'accent'+'gold') ────────
  accent:        withAlpha('--color-accent'),
  'accent-dim':  withAlpha('--color-accent-dim'),
  'accent-glow': '#56d7fd24',
  gold:          withAlpha('--color-accent'),
  'gold-2':      withAlpha('--color-gold-2'),
  'gold-soft':   withAlpha('--color-gold-2'),
  'gold-deep':   withAlpha('--color-gold-deep'),
  cyan:          withAlpha('--color-accent'),
  'cyan-soft':   withAlpha('--color-gold-2'),

  // ── Émeraude — rendement / hausse ──────────────────────────────────────
  up:       withAlpha('--color-up'),
  emerald:  withAlpha('--color-up'),
  'emerald-soft': withAlpha('--color-emerald-soft'),

  // ── Saphir/Info — désormais cyan ───────────────────────────────────────
  info:     withAlpha('--color-accent'),
  sapphire: withAlpha('--color-accent'),
  'sapphire-soft': withAlpha('--color-gold-2'),
  blue:     withAlpha('--color-accent'),

  // ── Rubis — baisse ──────────────────────────────────────────────────────
  down:   withAlpha('--color-down'),
  ruby:   withAlpha('--color-down'),
  warn:   withAlpha('--color-warn'),
  purple: withAlpha('--color-purple'),

  // ── Texte ───────────────────────────────────────────────────────────────
  white:  withAlpha('--color-ivory'),
  ivory:  withAlpha('--color-ivory'),
  muted:  withAlpha('--color-muted'),
  faint:  withAlpha('--color-faint'),
};

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      colors: themeColors as any,

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
        // Pilotés par variable CSS : halos lumineux en sombre, ombres neutres
        // discrètes en clair (un halo coloré lit comme un bug sur fond blanc).
        card:   'var(--shadow-card)',
        panel:  'var(--shadow-panel)',
        modal:  'var(--shadow-modal)',
        gold:   'var(--shadow-gold)',
        'gold-sm': 'var(--shadow-gold-sm)',
        emerald: 'var(--shadow-emerald)',
      },

      backgroundImage: {
        'gold-line': 'linear-gradient(90deg, transparent, rgba(86,215,253,0.5), transparent)',
        // Neutralisé en clair (var(--obsidian-glow) ci-dessous) : un halo cyan
        // lumineux n'a pas sa place sur fond blanc — voir globals.css.
        'obsidian-glow': 'var(--obsidian-glow)',
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
