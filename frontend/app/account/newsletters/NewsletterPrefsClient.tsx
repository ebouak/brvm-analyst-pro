'use client';

import { useState } from 'react';
import Link from 'next/link';

interface NewsletterPrefs {
  weekly_commodity: boolean;
  daily_market: boolean;
  signals_digest: boolean;
  events_digest: boolean;
}

interface Topic {
  key: keyof NewsletterPrefs;
  title: string;
  description: string;
  badge: string;
}

const TOPICS: Topic[] = [
  {
    key: 'weekly_commodity',
    title: 'Analyses Hebdo — Matières Premières',
    description:
      'Impact du cacao, pétrole, caoutchouc et huile de palme sur les valeurs BRVM. Publié chaque vendredi.',
    badge: 'Hebdo',
  },
  {
    key: 'daily_market',
    title: 'Brief Quotidien Marché',
    description:
      'Résumé de la séance BRVM : indices, volumes, top movers. Publié chaque soir de séance.',
    badge: 'Quotidien',
  },
  {
    key: 'signals_digest',
    title: 'Digest Signaux Opportunité',
    description:
      'Synthèse hebdomadaire des signaux BUY/WATCH générés par le scoring IA. Publié le lundi matin.',
    badge: 'Hebdo',
  },
  {
    key: 'events_digest',
    title: 'Événements & Dividendes',
    description:
      'Assemblées générales, distributions de dividendes, résultats financiers. En temps réel.',
    badge: 'Temps réel',
  },
];

type ToastState = { type: 'success' | 'error'; message: string } | null;

export function NewsletterPrefsClient({ initial }: { initial: NewsletterPrefs }) {
  const [prefs, setPrefs] = useState<NewsletterPrefs>(initial);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  function toggle(key: keyof NewsletterPrefs) {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSave() {
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch('/api/account/newsletters', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? 'Erreur serveur');
      }
      setToast({ type: 'success', message: 'Préférences enregistrées.' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Une erreur est survenue.';
      setToast({ type: 'error', message });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 4000);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-medium tracking-widest uppercase text-[#56d7fd]/70 mb-2">
          Compte
        </p>
        <h1 className="font-display text-2xl md:text-3xl text-[#FCFCFC] tracking-tight">
          Préférences newsletter
        </h1>
        <p className="mt-2 text-sm text-[#8a9aa0]">
          Choisissez les contenus que vous souhaitez recevoir par email.
        </p>
      </div>

      <div className="h-px bg-gradient-to-r from-[#56d7fd]/30 via-[#56d7fd]/10 to-transparent" />

      {/* Topic cards */}
      <div className="space-y-3">
        {TOPICS.map((topic) => {
          const checked = prefs[topic.key];
          return (
            <button
              key={topic.key}
              type="button"
              onClick={() => toggle(topic.key)}
              className={[
                'w-full text-left rounded-xl border p-5 transition-all duration-200',
                'flex items-start gap-4',
                checked
                  ? 'border-[#56d7fd]/40 bg-[#0a1417] shadow-[0_0_0_1px_rgba(86,215,253,0.08)]'
                  : 'border-[#1a2a30] bg-[#0a1417] hover:border-[#1a2a30]/80',
              ].join(' ')}
            >
              {/* Toggle switch */}
              <div className="flex-shrink-0 mt-0.5">
                <div
                  className={[
                    'relative w-10 h-6 rounded-full transition-colors duration-200',
                    checked ? 'bg-[#56d7fd]' : 'bg-[#1a2a30]',
                  ].join(' ')}
                  aria-checked={checked}
                  role="switch"
                >
                  <div
                    className={[
                      'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200',
                      checked ? 'translate-x-4' : 'translate-x-0',
                    ].join(' ')}
                  />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={[
                      'text-sm font-semibold',
                      checked ? 'text-[#FCFCFC]' : 'text-[#c8d8dc]',
                    ].join(' ')}
                  >
                    {topic.title}
                  </span>
                  <span
                    className={[
                      'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide',
                      checked
                        ? 'border-[#56d7fd]/30 bg-[#56d7fd]/10 text-[#56d7fd]'
                        : 'border-[#1a2a30] bg-[#030303] text-[#5a6e73]',
                    ].join(' ')}
                  >
                    {topic.badge}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#8a9aa0] leading-relaxed">
                  {topic.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Save button + toast */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className={[
            'inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-200',
            'bg-[#56d7fd] text-[#030303] shadow-[0_0_12px_rgba(86,215,253,0.25)]',
            'hover:bg-[#7de3ff] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed',
          ].join(' ')}
        >
          {saving ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Enregistrement…
            </>
          ) : (
            'Enregistrer mes préférences'
          )}
        </button>

        {toast && (
          <div
            className={[
              'flex items-center gap-2 rounded-lg border px-4 py-2 text-sm',
              toast.type === 'success'
                ? 'border-[#3fe18b]/30 bg-[#3fe18b]/10 text-[#3fe18b]'
                : 'border-[#ff6b6b]/30 bg-[#ff6b6b]/10 text-[#ff6b6b]',
            ].join(' ')}
          >
            <span>{toast.type === 'success' ? '✓' : '✕'}</span>
            {toast.message}
          </div>
        )}
      </div>

      {/* Back link */}
      <div className="pt-2">
        <Link
          href="/account/plan"
          className="text-sm text-[#5a6e73] hover:text-[#56d7fd] transition-colors duration-150"
        >
          ← Retour à mon abonnement
        </Link>
      </div>
    </div>
  );
}
