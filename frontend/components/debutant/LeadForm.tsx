'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLevelModal } from './useLevelModal';

type Phase = 'idle' | 'loading' | 'success';

const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '';

const FIELD =
  'w-full rounded-xl border border-[#ddd7cd] bg-white px-4 py-3 text-sm text-[#191714] placeholder:text-[#9b958c] focus:border-[#0b6b6f] focus:outline-none focus:ring-2 focus:ring-[#0b6b6f]/20';

/**
 * Formulaire de contact débutant → POST /api/leads. Consentement RGPD
 * obligatoire (lien vers /confidentialite). Trois phases animées (idle →
 * loading → succès). CTA WhatsApp en complément (lien direct au partenaire).
 */
export default function LeadForm() {
  const { level } = useLevelModal();
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    nom: '', email: '', telephone: '', pays: '', message: '', consent: false,
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.consent) {
      setError('Merci de cocher la case de consentement.');
      return;
    }
    setPhase('loading');
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, niveau: level ?? undefined }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? 'Une erreur est survenue. Réessayez.');
        setPhase('idle');
        return;
      }
      setPhase('success');
    } catch {
      setError('Connexion impossible. Réessayez.');
      setPhase('idle');
    }
  }

  const waLink = WHATSAPP
    ? `https://wa.me/${WHATSAPP.replace(/[^\d]/g, '')}?text=${encodeURIComponent(
        "Bonjour, je souhaite ouvrir un compte BRVM et être accompagné(e).",
      )}`
    : null;

  return (
    <div className="rounded-[1.7rem] border border-[#ddd7cd] bg-[#fbfaf7] p-6 shadow-[0_8px_30px_rgba(25,23,20,0.08)] sm:p-8">
      <AnimatePresence mode="wait">
        {phase === 'success' ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3 py-6 text-center"
          >
            <span className="grid h-14 w-14 place-items-center rounded-full bg-[#d4ebe8] text-2xl" aria-hidden>✓</span>
            <h3 className="text-xl font-bold text-[#191714]">Demande reçue, merci !</h3>
            <p className="max-w-sm text-sm text-[#6e6a63]">
              Un partenaire habilité vous recontacte rapidement pour ouvrir votre compte BRVM.
            </p>
            {waLink && (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#0b6b6f] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#084d50]"
              >
                💬 Discuter sur WhatsApp maintenant
              </a>
            )}
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onSubmit={submit}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[#191714]">Nom complet *</span>
                <input className={FIELD} required value={form.nom}
                  onChange={(e) => set('nom', e.target.value)} placeholder="Votre nom" autoComplete="name" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[#191714]">Email *</span>
                <input className={FIELD} required type="email" value={form.email}
                  onChange={(e) => set('email', e.target.value)} placeholder="vous@email.com" autoComplete="email" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[#191714]">Téléphone</span>
                <input className={FIELD} value={form.telephone}
                  onChange={(e) => set('telephone', e.target.value)} placeholder="+225 …" autoComplete="tel" inputMode="tel" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[#191714]">Pays</span>
                <input className={FIELD} value={form.pays}
                  onChange={(e) => set('pays', e.target.value)} placeholder="Côte d’Ivoire, Sénégal…" autoComplete="country-name" />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[#191714]">Votre message (optionnel)</span>
              <textarea className={FIELD} rows={3} value={form.message}
                onChange={(e) => set('message', e.target.value)} placeholder="Une question, votre situation…" />
            </label>

            <div className="flex items-start gap-3">
              <input
                id="consent" type="checkbox" required checked={form.consent}
                onChange={(e) => set('consent', e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[#ddd7cd] accent-[#0b6b6f]"
              />
              <label htmlFor="consent" className="text-sm leading-6 text-[#6e6a63]">
                J’accepte d’être contacté(e) par un partenaire habilité au sujet de l’ouverture d’un compte BRVM.{' '}
                <Link href="/confidentialite" className="font-medium text-[#0b6b6f] underline">
                  Politique de confidentialité
                </Link>{' '}
                <span className="text-[#c0392b]">*</span>
              </label>
            </div>

            {error && <p role="alert" className="text-sm text-[#c0392b]">{error}</p>}

            <div className="flex flex-col gap-3 pt-1 sm:flex-row">
              <motion.button
                type="submit"
                whileTap={{ scale: 0.97 }}
                disabled={phase === 'loading'}
                className="inline-flex flex-1 items-center justify-center rounded-full bg-[#0b6b6f] px-7 py-3.5 text-sm font-semibold text-white shadow-[0_20px_60px_rgba(11,107,111,0.18)] transition hover:bg-[#084d50] disabled:opacity-60"
              >
                {phase === 'loading' ? 'Envoi…' : 'Être recontacté(e)'}
              </motion.button>
              {waLink && (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[#0b6b6f]/30 bg-white px-7 py-3.5 text-sm font-semibold text-[#0b6b6f] transition hover:bg-[#d4ebe8]/40"
                >
                  💬 WhatsApp
                </a>
              )}
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
