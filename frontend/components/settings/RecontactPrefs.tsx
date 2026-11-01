'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { normaliserTelephone } from '@/lib/crm/telephone';

/**
 * Numéro DÉCLARÉ et consentement au recontact commercial (0174). Distinct du
 * WhatsApp lié par appairage (WhatsAppPrefs, numéro prouvé) : celui-ci
 * n'active aucun service, il sert seulement à vous recontacter si vous
 * l'acceptez. Se masque si la colonne est absente.
 */
export default function RecontactPrefs({ userId }: { userId: string }) {
  const [pret, setPret] = useState(false);
  const [absent, setAbsent] = useState(false);
  const [numero, setNumero] = useState('');
  const [recontact, setRecontact] = useState(false);
  // Date de consentement d'origine : conservée tant que la case reste cochée.
  const [optinAt, setOptinAt] = useState<string | null>(null);
  // WhatsApp déjà lié par appairage : c'est alors un moyen de contact prouvé.
  const [lie, setLie] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texte: string } | null>(null);

  useEffect(() => {
    void createClient()
      .from('notification_prefs')
      .select('telephone_declare, recontact_optin_at, whatsapp_phone, whatsapp_chat_id')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) { setAbsent(true); return; }
        setNumero(data?.telephone_declare ?? '');
        setOptinAt(data?.recontact_optin_at ?? null);
        setRecontact(Boolean(data?.recontact_optin_at));
        setLie(Boolean(data?.whatsapp_phone || data?.whatsapp_chat_id));
        setPret(true);
      });
  }, [userId]);

  if (absent || !pret) return null;
  const tel = normaliserTelephone(numero);

  const enregistrer = async () => {
    if (!tel.ok) return;
    const date = recontact && (tel.e164 || lie) ? (optinAt ?? new Date().toISOString()) : null;
    const { error } = await createClient()
      .from('notification_prefs')
      .upsert({ user_id: userId, telephone_declare: tel.e164 || null, recontact_optin_at: date }, { onConflict: 'user_id' });
    if (!error) setOptinAt(date);
    setMsg(error ? { ok: false, texte: 'Enregistrement impossible : réessayez.' } : { ok: true, texte: 'Enregistré.' });
  };

  return (
    <section className="space-y-3 rounded-panel border border-border bg-surface p-5">
      <h2 className="font-display text-lg text-ivory">Être recontacté sur WhatsApp</h2>
      <p className="text-sm leading-relaxed text-muted">Facultatif. Votre numéro ne sert qu&apos;à vous recontacter au sujet de l&apos;offre WESTBOURSE, et seulement si vous cochez la case (possible avec un numéro valide saisi{lie ? ' ou votre WhatsApp déjà lié' : ''}). Vous pouvez décocher la case à tout moment pour retirer votre consentement{lie ? ' ; votre WhatsApp lié reste géré plus haut' : ' ; videz le champ pour effacer le numéro'}.</p>
      <input value={numero} onChange={(e) => { setNumero(e.target.value); if (!e.target.value.trim() && !lie) setRecontact(false); }} inputMode="tel" autoComplete="tel" placeholder="+225 07 07 12 34 56" aria-label="Numéro WhatsApp" className="w-full rounded-xl border border-border bg-sunken px-4 py-2.5 text-sm text-ivory" />
      {!tel.ok && <p className="text-xs text-down">{tel.erreur}</p>}
      <label className="flex items-start gap-3 text-sm text-muted">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-accent" checked={recontact} disabled={!recontact && (!tel.ok || (!tel.e164 && !lie))} onChange={(e) => setRecontact(e.target.checked)} />
        <span>J&apos;accepte d&apos;être recontacté par WESTBOURSE sur WhatsApp au sujet de son offre.</span>
      </label>
      <button disabled={!tel.ok} onClick={enregistrer} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-bg disabled:opacity-50">Enregistrer</button>
      {msg && <p className={`text-sm ${msg.ok ? 'text-up' : 'text-down'}`}>{msg.texte}</p>}
    </section>
  );
}
