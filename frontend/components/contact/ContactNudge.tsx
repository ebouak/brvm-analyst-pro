'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Encart de contact non-intrusif « Salut, on se parle ? ».
 * Déclenchement « après engagement » : apparaît une fois que le visiteur a
 * parcouru ≥ 3 pages OU passé ≥ 35 s sur la session. Carte glissante en bas à
 * droite (jamais un modal bloquant). Mémorisé en localStorage : une fois fermé
 * ou envoyé, ne réapparaît pas avant 7 jours.
 *
 * RGPD : aucune donnée n'est stockée côté navigateur hormis l'horodatage de
 * fermeture (préférence d'affichage). Le message est relayé par email via
 * /api/contact (pas de persistance en base).
 */

const STORAGE_KEY = 'wb_contact_nudge_done';
const SESSION_PAGES = 'wb_nudge_pages';
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const PAGES_THRESHOLD = 3;
const DWELL_MS = 35_000;

const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '';

function recentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    return Number.isFinite(ts) && Date.now() - ts < SEVEN_DAYS;
  } catch {
    return false;
  }
}

export function ContactNudge() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const cardRef = useRef<HTMLDivElement>(null);
  const dwellTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reveal = useCallback(() => {
    if (recentlyDismissed()) return;
    setOpen(true);
  }, []);

  // Comptage des pages parcourues dans la session + seuil d'engagement.
  useEffect(() => {
    if (recentlyDismissed()) return;
    let count = 0;
    try {
      count = Number(sessionStorage.getItem(SESSION_PAGES) ?? '0') + 1;
      sessionStorage.setItem(SESSION_PAGES, String(count));
    } catch {
      count = 1;
    }
    if (count >= PAGES_THRESHOLD) {
      reveal();
      return;
    }
    dwellTimer.current = setTimeout(reveal, DWELL_MS);
    return () => {
      if (dwellTimer.current) clearTimeout(dwellTimer.current);
    };
  }, [pathname, reveal]);

  // Fermeture par Échap.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function remember() {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      /* no-op */
    }
  }

  function dismiss() {
    setOpen(false);
    remember();
  }

  const waLink =
    WHATSAPP &&
    `https://wa.me/${WHATSAPP.replace(/[^\d]/g, '')}?text=${encodeURIComponent(
      `Bonjour, je suis ${prenom || 'un visiteur'} sur WESTBOURSE. ${message}`.trim(),
    )}`;

  async function sendByEmail() {
    if (status === 'sending') return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.trim().length < 2) {
      setStatus('error');
      return;
    }
    setStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prenom, email, message, page: pathname }),
      });
      if (!res.ok) throw new Error();
      setStatus('sent');
      remember();
      setTimeout(() => setOpen(false), 2200);
    } catch {
      setStatus('error');
    }
  }

  if (!open) return null;

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label="Une question ? On vous répond"
      className="fixed bottom-4 right-4 z-[120] w-[min(92vw,22rem)] motion-safe:animate-[nudgeIn_.45s_ease-out] rounded-2xl border border-accent/30 bg-surface/95 p-4 shadow-[0_18px_50px_-12px_rgba(0,0,0,.7)] backdrop-blur"
    >
      <button
        type="button"
        aria-label="Fermer"
        onClick={dismiss}
        className="absolute right-3 top-3 text-muted transition-colors hover:text-ivory"
      >
        ✕
      </button>

      {status === 'sent' ? (
        <div className="py-4 text-center">
          <div className="text-2xl">✅</div>
          <p className="mt-2 font-display text-base text-ivory">Message envoyé&nbsp;!</p>
          <p className="mt-1 text-xs text-muted">On vous répond très vite par email.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-accent/15 text-lg">💬</span>
            <div>
              <p className="font-display text-[1.02rem] font-semibold leading-tight text-ivory">
                Salut, on se parle&nbsp;?
              </p>
              <p className="text-xs text-muted">Une question sur la BRVM ou l&apos;appli&nbsp;?</p>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                placeholder="Prénom"
                aria-label="Prénom"
                className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ivory placeholder:text-faint focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                aria-label="Email"
                className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ivory placeholder:text-faint focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Votre question en deux mots…"
              aria-label="Votre message"
              rows={2}
              className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ivory placeholder:text-faint focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/30"
            />

            {status === 'error' && (
              <p className="text-xs text-down">Vérifiez l&apos;email et votre message, puis réessayez.</p>
            )}

            <div className="flex gap-2">
              {waLink && (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={remember}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-sm font-semibold text-[#04210f] transition-transform active:scale-95"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                    <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-1.5-.7-2.5-1.3-3.5-3-.3-.5.3-.4.7-1.3.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.6-.4-.5-.6-.5h-.5c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 5 4.3 1.9.7 2.6.8 3.5.7.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 00-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1012 2z" />
                  </svg>
                  WhatsApp
                </a>
              )}
              <button
                type="button"
                onClick={sendByEmail}
                disabled={status === 'sending'}
                className="flex-1 rounded-lg border border-accent/50 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/20 disabled:opacity-60"
              >
                {status === 'sending' ? 'Envoi…' : 'Par email'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ContactNudge;
