'use client';

import { useState } from 'react';
import Link from 'next/link';

/**
 * Formulaire de la page /contact : même circuit que l'encart ContactNudge
 * (/api/contact, enregistrement dans contact_messages, réponse depuis
 * /admin/contact). Le numéro n'est envoyé QUE si la case de rappel vocal,
 * décochée par défaut, est cochée ; l'API refuse de toute façon un numéro sans
 * consentement (contrainte de la migration 0250).
 */
export function FormulaireContact() {
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [rappel, setRappel] = useState(false);
  const [telephone, setTelephone] = useState('');
  const [etat, setEtat] = useState<'saisie' | 'envoi' | 'envoye' | 'erreur'>('saisie');
  const [erreur, setErreur] = useState<string | null>(null);

  function echec(texte: string) {
    setErreur(texte);
    setEtat('erreur');
  }

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    if (etat === 'envoi') return;
    setErreur(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return echec('Indiquez une adresse e-mail valide : la réponse y sera envoyée.');
    if (message.trim().length < 2) return echec('Écrivez votre question en quelques mots.');
    if (rappel && !telephone.trim()) return echec('Indiquez le numéro auquel vous rappeler, avec l’indicatif du pays.');
    setEtat('envoi');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prenom,
          email,
          message,
          page: '/contact',
          ...(rappel ? { telephone, rappelVocal: true } : {}),
        }),
      });
      if (!res.ok) {
        const corps = (await res.json().catch(() => null)) as { error?: string } | null;
        return echec(res.status === 400 && corps?.error ? corps.error : 'L’envoi n’a pas abouti. Réessayez dans un instant.');
      }
      setEtat('envoye');
    } catch {
      echec('L’envoi n’a pas abouti. Vérifiez votre connexion et réessayez.');
    }
  }

  if (etat === 'envoye') {
    return (
      <p role="status" className="rounded-panel border border-up/30 bg-up/5 p-4 text-sm text-ivory">
        Message reçu. Nous vous répondons par e-mail
        {rappel ? ', et l’assistant vocal vous rappellera au numéro indiqué' : ''}.
      </p>
    );
  }

  const champ =
    'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ivory placeholder:text-faint focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/30';

  return (
    <form onSubmit={envoyer} className="space-y-3" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-muted">Prénom (facultatif)</span>
          <input value={prenom} onChange={(e) => setPrenom(e.target.value)} autoComplete="given-name" className={`mt-1 ${champ}`} />
        </label>
        <label className="block text-sm">
          <span className="text-muted">E-mail</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required className={`mt-1 ${champ}`} />
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-muted">Votre question</span>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} required className={`mt-1 resize-y ${champ}`} />
      </label>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={rappel} onChange={(e) => setRappel(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-accent" />
        <span className="text-muted">
          J&apos;accepte d&apos;être rappelé·e par l&apos;assistant vocal automatisé de WESTBOURSE au numéro ci-dessous.{' '}
          <Link href="/confidentialite" className="underline underline-offset-2 hover:text-ivory">
            Confidentialité
          </Link>
        </span>
      </label>
      {rappel && (
        <label className="block text-sm">
          <span className="text-muted">Numéro de téléphone, avec l&apos;indicatif</span>
          <input
            type="tel"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            placeholder="Ex. +225…"
            autoComplete="tel"
            className={`mt-1 ${champ}`}
          />
        </label>
      )}

      {erreur && (
        <p role="alert" className="text-sm text-down">
          {erreur}
        </p>
      )}
      <button type="submit" disabled={etat === 'envoi'} className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-bg disabled:opacity-50">
        {etat === 'envoi' ? 'Envoi…' : 'Envoyer'}
      </button>
    </form>
  );
}
