'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { suivreInscription, useEtatSession } from './suivi';

/**
 * Champ e-mail de l'ouverture. Il ne crée rien lui-même : il ouvre le parcours
 * d'inscription existant (/signup, code par e-mail + vérification anti-robot)
 * avec l'adresse déjà saisie. Mêmes validations, même message de confirmation
 * que la page de connexion, sans dupliquer le captcha ni l'appel Supabase.
 *
 * Connecté : le champ laisse place à « Créer un compte » (contour) puis
 * « Mon tableau de bord ». L'attribut
 * `data-hero-cta` reste dans les deux cas : le bandeau flottant s'y repère.
 */
export function InscriptionAccueil({ id = 'v-mail-ouverture' }: { id?: string }) {
  const router = useRouter();
  const session = useEtatSession();
  const [email, setEmail] = useState('');
  const envoyer = (e: FormEvent) => {
    e.preventDefault();
    suivreInscription('ouverture');
    const adresse = email.trim();
    router.push(`/signup?email=${encodeURIComponent(adresse)}&from=ouverture`);
  };
  if (session === 'connecte') {
    return (
      <div data-hero-cta="" className="v-cta-duo">
        <Link href="/signup?from=ouverture" className="v-bouton-second">Créer un compte</Link>
        <Link href="/dashboard" className="v-bouton">Mon tableau de bord</Link>
      </div>
    );
  }
  return (
    <form onSubmit={envoyer} className="v-inscription" data-hero-cta="">
      <label htmlFor={id} className="sr-only">Votre adresse e-mail</label>
      <input
        id={id}
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        placeholder="nom@exemple.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button type="submit" className="v-bouton">Créer mon compte gratuit</button>
    </form>
  );
}
