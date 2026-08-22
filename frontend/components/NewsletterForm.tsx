'use client';

import { useState } from 'react';

interface Props {
  source?: string;
  compact?: boolean; // mode compact pour la sidebar/in-app
  /**
   * Bandeau horizontal (icône · texte · champ+bouton) au lieu du panneau
   * centré. Utilisé sur la landing, où la newsletter est une bande fine
   * entre deux sections plutôt qu'un bloc à part entière.
   */
  banner?: boolean;
}

export default function NewsletterForm({ source = 'landing', compact = false, banner = false }: Props) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus('loading');

    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source }),
      });
      if (res.ok) {
        setStatus('ok');
        setMsg('Inscription confirmée ! Vous recevrez notre prochain brief.');
      } else {
        const d = await res.json() as { error?: string };
        setStatus('error');
        setMsg(d.error ?? 'Une erreur est survenue.');
      }
    } catch {
      setStatus('error');
      setMsg('Impossible de contacter le serveur.');
    }
  }

  if (status === 'ok') {
    if (banner) {
      return (
        <div className="flex items-center justify-center gap-2 rounded-panel border border-up/25 bg-surface/60 px-6 py-6 text-sm text-up">
          <span className="text-lg" aria-hidden>✓</span>
          <span>{msg}</span>
        </div>
      );
    }
    return (
      <div className={compact
        ? 'flex items-center gap-2 text-sm text-up'
        : 'flex flex-col items-center gap-2 py-4 text-up text-sm'
      }>
        <span className="text-lg">✓</span>
        <span>{msg}</span>
      </div>
    );
  }

  if (banner) {
    return (
      <div className="rounded-panel border border-border bg-surface/60 px-5 py-5 md:px-7 md:py-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:gap-7">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent/[0.07] text-accent"
            aria-hidden
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
              <path d="M3 7l9 6 9-6" />
            </svg>
          </span>

          <div className="min-w-0 flex-1">
            <p className="font-display text-lg text-ivory md:text-xl [letter-spacing:-0.02em]">
              Le brief BRVM chaque semaine dans votre boîte mail
            </p>
            <p className="mt-1 text-xs text-muted">
              Cours, signaux, événements — un résumé hebdomadaire clair et actionnable. Gratuit.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex w-full shrink-0 flex-col gap-2 sm:flex-row lg:w-auto">
            <label htmlFor="newsletter-banner-email" className="sr-only">Adresse email</label>
            <input
              id="newsletter-banner-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              className="min-w-0 flex-1 rounded-full border border-border bg-elevated px-4 py-2.5 text-sm text-ivory transition placeholder:text-faint focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/40 sm:w-56"
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="landing-hero-cta shrink-0 rounded-full px-5 py-2.5 text-sm font-bold text-[#03222b] shadow-gold transition-transform active:scale-95 disabled:opacity-50"
            >
              {status === 'loading' ? 'Inscription…' : "S'abonner"}
            </button>
          </form>
        </div>

        {status === 'error' && <p className="mt-3 text-sm text-down">{msg}</p>}

        <p className="mt-3 text-[11px] text-faint">
          En vous abonnant, vous acceptez de recevoir notre newsletter. Désabonnement en 1 clic.
        </p>
      </div>
    );
  }

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="votre@email.com"
            className="flex-1 min-w-0 bg-elevated border border-border rounded-lg px-3 py-1.5 text-sm text-ivory placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/60 transition"
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            className="px-3 py-1.5 rounded-lg bg-gold text-obsidian text-xs font-semibold hover:bg-gold-2 active:scale-95 transition disabled:opacity-50 whitespace-nowrap"
          >
            {status === 'loading' ? '…' : 'S\'abonner'}
          </button>
        </div>
        {status === 'error' && <p className="text-xs text-down">{msg}</p>}
      </form>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-gold/20 bg-gradient-to-br from-surface via-elevated to-surface p-8 text-center space-y-5">
      {/* Glow décoratif */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_40%_at_50%_100%,rgba(201,162,39,0.08),transparent)]" aria-hidden />

      <div className="relative space-y-2">
        <p className="overline text-gold-2">Newsletter</p>
        <h2 className="font-display text-heading-sm text-ivory">
          Le brief BRVM chaque semaine dans votre boîte mail
        </h2>
        <p className="text-sm text-muted max-w-md mx-auto">
          Cours, signaux, événements — un résumé hebdomadaire clair et actionnable. Gratuit.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="relative flex flex-col sm:flex-row gap-3 max-w-sm mx-auto">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="votre@email.com"
          className="flex-1 bg-elevated border border-border rounded-xl px-4 py-2.5 text-sm text-ivory placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/60 transition"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="px-5 py-2.5 rounded-xl bg-gold text-obsidian font-semibold text-sm hover:bg-gold-2 hover:-translate-y-0.5 hover:shadow-gold active:translate-y-0 active:scale-95 transition disabled:opacity-50 shadow-gold-sm motion-reduce:hover:translate-y-0"
        >
          {status === 'loading' ? 'Inscription…' : 'S\'abonner gratuitement'}
        </button>
      </form>

      {status === 'error' && (
        <p className="relative text-sm text-down">{msg}</p>
      )}

      <p className="relative text-[11px] text-faint">
        En vous abonnant, vous acceptez de recevoir notre newsletter. Désabonnement en 1 clic.
      </p>
    </section>
  );
}
