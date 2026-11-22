'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BellRing, X } from 'lucide-react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { estEnSeance } from '@/lib/freshness';
import {
  TYPES_ALERTE_PRIX, etatInitial, franchissements, messageAlerte,
  type AlertePrix, type CoursVu,
} from '@/lib/alertes/franchissement';

interface Message { id: string; code: string; texte: string; heure: string }

const DUREE_MS = 12_000;
const heureUtc = (d: Date) => `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
const cleVue = (id: string, jour: string) => `ws-alerte-vue-${id}-${jour}`;
const dejaVue = (id: string, jour: string) => {
  try { return sessionStorage.getItem(cleVue(id, jour)) === '1'; } catch { return false; }
};
const marquerVue = (id: string, jour: string) => {
  try { sessionStorage.setItem(cleVue(id, jour), '1'); } catch { /* stockage refusé */ }
};

/**
 * Vos alertes de PRIX, vues en direct dans la page : quand un cours reçu
 * pendant votre visite franchit le seuil d'une de vos alertes actives, un
 * message l'annonce (une fois par alerte et par jour).
 *
 * - Rien hors séance, rien sans compte, rien sans alerte de prix active :
 *   aucune connexion temps réel n'est ouverte dans ces cas.
 * - Les alertes sont lues sous la RLS de leur propriétaire (la vôtre).
 * - Ce message ne remplace pas l'e-mail ou Telegram, envoyés par le serveur
 *   selon son propre rythme ; il dit ce qui se passe sous vos yeux.
 */
export default function AlertesEnDirect() {
  const [enSeance, setEnSeance] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const calme = useReducedMotion();

  useEffect(() => {
    const maj = () => setEnSeance(estEnSeance(new Date()));
    maj();
    const t = setInterval(maj, 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!enSeance) return;
    let annule = false;
    let canal: RealtimeChannel | null = null;
    const sb = createClient();
    (async () => {
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user || annule) return;
      const { data: lues } = await sb
        .from('alerts')
        .select('id, code, type, seuil')
        .eq('actif', true)
        .in('type', [...TYPES_ALERTE_PRIX]);
      const alertes = ((lues ?? []) as { id: string; code: string; type: AlertePrix['type']; seuil: number | string | null }[])
        .map((a) => ({ ...a, seuil: Number(a.seuil) }))
        .filter((a) => Number.isFinite(a.seuil)) as AlertePrix[];
      if (alertes.length === 0 || annule) return;

      const jour = new Date().toISOString().slice(0, 10);
      const codes = [...new Set(alertes.map((a) => a.code))];
      // État de départ = DERNIER cours connu de chaque valeur. Avant le premier
      // relevé du jour, c'est la clôture de la veille : un cours déjà au-dessus
      // du seuil hier ne sera pas annoncé comme franchi à 9 h 15. La variation,
      // elle, ne vaut que pour la séance du jour (sinon inconnue).
      const { data: recents } = await sb
        .from('brvm_actions_daily')
        .select('code, cours_jour, variation_pct, date_marche')
        .in('code', codes)
        .order('date_marche', { ascending: false })
        .limit(codes.length * 5);
      if (annule) return;
      const depart: CoursVu[] = [];
      for (const r of (recents ?? []) as (CoursVu & { date_marche: string })[]) {
        if (depart.some((d) => d.code === r.code)) continue;
        depart.push({ code: r.code, cours_jour: r.cours_jour, variation_pct: r.date_marche === jour ? r.variation_pct : null });
      }
      // Ce qui est déjà vrai à l'arrivée ne sera pas annoncé comme un franchissement.
      let etat = etatInitial(alertes, depart);
      // Une valeur sans cours de départ (aucune ligne récente) : son PREMIER
      // cours reçu fixe l'état, il n'annonce rien (revue Fable).
      const connues = new Set(depart.map((d) => d.code));

      canal = sb
        .channel(`alertes-live-${jour}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'brvm_actions_daily', filter: `date_marche=eq.${jour}` },
          (payload) => {
            const recu = payload.new as CoursVu | null;
            if (!recu || !codes.includes(recu.code)) return;
            const r = franchissements(alertes, etat, recu);
            etat = r.etat;
            if (!connues.has(recu.code)) {
              connues.add(recu.code);
              return;
            }
            for (const a of r.declenchees) {
              if (dejaVue(a.id, jour)) continue;
              marquerVue(a.id, jour);
              const id = `${a.id}-${Date.now()}`;
              setMessages((m) => [...m.slice(-2), { id, code: a.code, texte: messageAlerte(a, recu), heure: heureUtc(new Date()) }]);
              setTimeout(() => setMessages((m) => m.filter((x) => x.id !== id)), DUREE_MS);
            }
          },
        )
        .subscribe();
    })();
    return () => {
      annule = true;
      if (canal) sb.removeChannel(canal);
    };
  }, [enSeance]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed right-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] lg:bottom-6"
    >
      <AnimatePresence initial={false}>
        {messages.map((m) => (
          <motion.div
            key={m.id}
            layout={!calme}
            initial={calme ? { opacity: 0 } : { opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={calme ? { opacity: 0 } : { opacity: 0, x: 32 }}
            transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
            className="pointer-events-auto rounded-xl border border-accent/40 bg-surface p-3 shadow-lg"
          >
            <div className="flex items-start gap-2.5">
              <BellRing size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-accent-ink" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ivory">{m.texte}</p>
                <p className="mt-0.5 text-[11px] text-faint">
                  Seuil de votre alerte · <span className="tabular">{m.heure}</span> UTC ·{' '}
                  <Link href={`/actions/${m.code}`} className="text-accent-ink hover:underline">Voir la fiche</Link>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMessages((l) => l.filter((x) => x.id !== m.id))}
                aria-label="Fermer ce message"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <X size={14} strokeWidth={1.75} aria-hidden />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
