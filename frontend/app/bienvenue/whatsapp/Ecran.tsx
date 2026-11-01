'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { terminerEcran } from './actions';
import { normaliserTelephone } from '@/lib/crm/telephone';

// Uniquement ce qui fonctionne aujourd'hui (lots A, D, E). L'assistant est Premium.
const AVANTAGES = [
  { titre: 'Vos alertes de cours', texte: 'Un seuil franchi sur une valeur suivie : vous êtes prévenu sur WhatsApp.' },
  { titre: 'Le point du soir', texte: 'La séance de la BRVM résumée, chaque soir de bourse.' },
  { titre: 'Vos dossiers du samedi', texte: 'Le dossier PDF des valeurs de votre portefeuille.' },
  { titre: 'Les cours à la demande', texte: 'Écrivez « cours SNTS », « div ORAC » ou « top » : réponse immédiate.' },
  { titre: "L'équipe, sans détour", texte: 'Écrivez « HUMAIN » : un membre de l’équipe vous répond.' },
];

export default function Ecran({ next, numeroAgent }: { next: string; numeroAgent: string }) {
  const router = useRouter();
  const [recontact, setRecontact] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  // Sans numéro d'agent configuré, l'appairage est impossible : seule la saisie reste.
  const [saisie, setSaisie] = useState(!numeroAgent);
  const [numero, setNumero] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, demarrer] = useTransition();

  const finir = (num: string) =>
    demarrer(async () => {
      setErreur(null);
      const r = await terminerEcran(num, recontact).catch(() => ({ ok: false, message: 'Erreur de connexion : réessayez.' }));
      if (!r.ok) { setErreur(r.message ?? 'Erreur.'); return; }
      router.push(next);
      router.refresh();
    });

  const lienCode = (c: string) => `https://wa.me/${numeroAgent}?text=${encodeURIComponent(c)}`;

  const lier = async () => {
    setErreur(null);
    const res = await fetch('/api/whatsapp/pairing', { method: 'POST' }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { code?: string; error?: string } | null;
    if (!res?.ok || !body?.code) { setErreur(body?.error ?? 'Génération du code impossible : réessayez.'); return; }
    setCode(body.code);
    // Fenêtre bloquée : le lien reste affiché dans le cadre du code.
    window.open(lienCode(body.code), '_blank', 'noopener');
  };

  const numeroValide = normaliserTelephone(numero);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <p className="overline mb-3 text-gold-2">Une dernière étape, facultative</p>
      <h1 className="mb-3 font-display text-3xl text-ivory md:text-4xl [letter-spacing:-0.03em]">Recevez WESTBOURSE sur WhatsApp</h1>
      <p className="mb-8 max-w-[56ch] text-sm leading-relaxed text-muted">Là où vous lisez déjà vos messages. Gratuit, et vous pouvez tout couper à tout moment.</p>

      <ul className="mb-8 grid gap-3 sm:grid-cols-2">
        {AVANTAGES.map((a) => (
          <li key={a.titre} className="rounded-2xl border border-border bg-surface p-4">
            <p className="mb-1 text-sm font-semibold text-ivory">{a.titre}</p>
            <p className="text-sm leading-relaxed text-muted">{a.texte}</p>
          </li>
        ))}
        <li className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
          <p className="mb-1 text-sm font-semibold text-ivory">
            L&apos;assistant WESTBOURSE <span className="ml-1 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] text-accent">Premium</span>
          </p>
          <p className="text-sm leading-relaxed text-muted">Posez vos questions sur vos valeurs, en langage courant.</p>
        </li>
      </ul>

      <label className="mb-6 flex items-start gap-3 text-sm text-muted">
        <input type="checkbox" className="mt-1" checked={recontact} onChange={(e) => setRecontact(e.target.checked)} />
        <span>J&apos;accepte d&apos;être recontacté par WESTBOURSE sur WhatsApp au sujet de son offre. Facultatif, retirable à tout moment dans mes paramètres.</span>
      </label>

      {numeroAgent && !code && (
        <button type="button" disabled={occupe} onClick={lier} className="w-full rounded-full bg-[#25D366] px-6 py-3.5 text-base font-semibold text-[#06210f] disabled:opacity-50 sm:w-auto">
          Lier mon WhatsApp
        </button>
      )}
      {numeroAgent && code && (
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="mb-2 text-sm text-muted">WhatsApp s&apos;est ouvert avec votre code. Envoyez le message tel quel, puis continuez.</p>
          <p className="tabular mb-2 text-2xl font-semibold tracking-[0.2em] text-ivory">{code}</p>
          <a href={lienCode(code)} target="_blank" rel="noopener noreferrer" className="mb-4 inline-block text-sm text-accent underline underline-offset-4 rounded focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60">
            Ouvrir WhatsApp avec le code
          </a>
          <div>
            <button type="button" disabled={occupe} onClick={() => finir('')} className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-bg disabled:opacity-50">C&apos;est envoyé, continuer</button>
          </div>
        </div>
      )}

      <div className="mt-6">
        {!saisie ? (
          <button type="button" onClick={() => setSaisie(true)} className="text-sm text-muted underline underline-offset-4 hover:text-ivory rounded focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60">ou laissez simplement votre numéro</button>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row">
            <input value={numero} onChange={(e) => setNumero(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="+225 07 07 12 34 56" aria-label="Votre numéro WhatsApp" className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-ivory placeholder:text-faint" />
            <button type="button" disabled={occupe || !numero.trim() || !numeroValide.ok} onClick={() => finir(numero)} className="rounded-full border border-border px-5 py-3 text-sm font-semibold text-ivory disabled:opacity-50">Enregistrer</button>
          </div>
        )}
        {saisie && numero.trim() && !numeroValide.ok && <p className="mt-2 text-xs text-down">{numeroValide.erreur}</p>}
      </div>

      {erreur && <p role="alert" className="mt-4 text-sm text-down">{erreur}</p>}

      <button type="button" disabled={occupe} onClick={() => finir('')} className="mt-10 text-sm text-faint hover:text-muted rounded focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60">Plus tard</button>
    </main>
  );
}
