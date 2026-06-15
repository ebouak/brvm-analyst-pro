'use client';

import { useState } from 'react';
import { CONSENT_CATEGORIES, CONSENT_VERSION, type ConsentCategoryId } from '@/lib/consent/registry';
import { useConsent } from './ConsentProvider';

export function CookiePreferences() {
  const { isPrefsOpen, close, save, choice } = useConsent();
  const [granted, setGranted] = useState<Record<ConsentCategoryId, boolean>>(() => {
    const base = {} as Record<ConsentCategoryId, boolean>;
    for (const c of CONSENT_CATEGORIES) base[c.id] = c.required ? true : choice?.granted[c.id] ?? false;
    return base;
  });

  if (!isPrefsOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Préférences cookies">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0a1417] p-6 shadow-2xl">
        <h2 className="font-display text-xl font-semibold text-white">Préférences cookies</h2>
        <p className="mt-1 text-sm text-white/60">Choisissez les catégories que vous autorisez. Les cookies strictement nécessaires restent toujours actifs.</p>

        <div className="mt-5 space-y-3">
          {CONSENT_CATEGORIES.map((cat) => (
            <div key={cat.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-white">{cat.label}</p>
                  <p className="mt-0.5 text-xs text-white/55">{cat.description}</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={granted[cat.id]}
                    disabled={cat.required}
                    onChange={(e) => setGranted((g) => ({ ...g, [cat.id]: e.target.checked }))}
                  />
                  <span className="h-5 w-9 rounded-full bg-white/15 transition-colors peer-checked:bg-[#56d7fd] peer-disabled:opacity-50 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={close} className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/70 hover:text-white">Annuler</button>
          <button
            type="button"
            onClick={() => save({ version: CONSENT_VERSION, timestamp: new Date().toISOString(), granted })}
            className="rounded-full bg-[#56d7fd] px-5 py-2 text-sm font-semibold text-[#03222b] hover:bg-[#8fe6ff]"
          >
            Enregistrer mes choix
          </button>
        </div>
      </div>
    </div>
  );
}
