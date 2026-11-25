'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Rappels de progression Academy par e-mail (migration 0272).
 *
 * RGPD. Finalité : rappeler, après 5 jours sans activité, la leçon suivante
 * d'un parcours commencé — au plus un e-mail tous les 14 jours, sans offre
 * commerciale. Base légale : intérêt légitime ; d'où une case COCHÉE par
 * défaut, retirable ici et depuis chaque e-mail (lien d'arrêt + désabonnement
 * « un clic » de la messagerie), qui écrivent la même colonne.
 *
 * Ce composant n'écrit QUE `academy_relances` : jamais les colonnes de liaison
 * (telegram_chat_id, whatsapp_*) que le verrou 0162 réserve au serveur.
 */

const COLONNE = 'academy_relances';

export default function AcademyRelancesPrefs({ userId }: { userId: string }) {
  const [actif, setActif] = useState(true);
  const [etat, setEtat] = useState<'chargement' | 'pret' | 'envoi' | 'erreur' | 'indisponible'>('chargement');
  const [message, setMessage] = useState<string | null>(null);
  const supabase = createClient();

  const charger = useCallback(async () => {
    const { data, error } = await supabase.from('notification_prefs').select(COLONNE).eq('user_id', userId).maybeSingle();
    if (error) {
      // Colonne absente (0272 non appliquée) : on se tait plutôt que d'afficher une erreur technique.
      if (['42703', 'PGRST204', 'PGRST205'].includes(error.code ?? '')) {
        setEtat('indisponible');
        return;
      }
      setEtat('erreur');
      setMessage(error.message);
      return;
    }
    // Pas de ligne = valeur par défaut de la colonne (vrai).
    setActif((data as { academy_relances?: boolean } | null)?.academy_relances ?? true);
    setEtat('pret');
  }, [supabase, userId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const enregistrer = async (valeur: boolean) => {
    setEtat('envoi');
    setMessage(null);
    const avant = actif;
    setActif(valeur);
    const { error } = await supabase
      .from('notification_prefs')
      .upsert({ user_id: userId, academy_relances: valeur }, { onConflict: 'user_id' });
    if (error) {
      setActif(avant);
      setEtat('erreur');
      setMessage(error.message);
      return;
    }
    setEtat('pret');
  };

  if (etat === 'indisponible') return null;

  return (
    <section className="rounded-panel border border-border bg-surface p-5">
      <h2 className="font-display text-lg text-ivory">Academy</h2>
      <label className="mt-4 flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={actif}
          disabled={etat !== 'pret'}
          onChange={(e) => void enregistrer(e.target.checked)}
          className="mt-1 h-4 w-4 accent-accent"
        />
        <span>
          <span className="text-ivory">Rappels de progression par e-mail</span>
          <span className="mt-0.5 block text-xs text-faint">
            Après 5 jours sans activité sur un parcours commencé, un e-mail indique la leçon suivante. Au plus un
            tous les 14 jours, jamais une fois l&apos;examen du niveau réussi.
          </span>
        </span>
      </label>
      {etat === 'erreur' && message && <p className="mt-3 text-xs text-down">Enregistrement impossible : {message}</p>}
    </section>
  );
}
