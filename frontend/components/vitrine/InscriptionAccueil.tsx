'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Champ e-mail de l'ouverture. Il ne crée rien lui-même : il ouvre le parcours
 * d'inscription existant (/signup, code par e-mail + vérification anti-robot)
 * avec l'adresse déjà saisie. Mêmes validations, même message de confirmation
 * que la page de connexion, sans dupliquer le captcha ni l'appel Supabase.
 */
export function InscriptionAccueil({ id = 'v-mail-ouverture', emplacement = 'ouverture' }: { id?: string; emplacement?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const envoyer = (e: FormEvent) => {
    e.preventDefault();
    const adresse = email.trim();
    router.push(`/signup?email=${encodeURIComponent(adresse)}&from=${encodeURIComponent(emplacement)}`);
  };
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
