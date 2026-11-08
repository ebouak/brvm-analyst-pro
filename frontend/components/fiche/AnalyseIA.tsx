'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Send, Sparkles, Square, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { lireEvenements } from '@/lib/analyseIA/flux';
import { questionsProposees } from '@/lib/analyseIA/questions';
import { formaterSource } from '@/lib/analyseIA/sources';
import { AVERTISSEMENT_ANALYSE, libelleProvenance, texteACopier } from '@/lib/analyseIA/affichage';
import type { CodeErreur, MetaReponse } from '@/lib/analyseIA/types';

/**
 * « Analyse par IA » de la fiche action : rangée de questions proposées, puis
 * panneau de conversation. Chaque réponse dit d'où elle vient (Jev type-safe
 * ou rédaction IA) et quelles données elle a lues, avec leur date.
 * Le retour « utile / pas utile » reste sur cet écran : aucune table ne le reçoit.
 */

type Avis = 'utile' | 'pas_utile' | null;
type Tour =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; etape: string | null; meta: MetaReponse | null; erreur: { code: CodeErreur; message: string } | null; enCours: boolean; avis: Avis };

interface Props {
  code: string;
  nom: string | null;
  exerciceComptes: number | null;
}

export function AnalyseIA({ code, nom, exerciceComptes }: Props) {
  const questions = questionsProposees({ code, nom, exerciceComptes });
  const [ouvert, setOuvert] = useState(false);
  const [tours, setTours] = useState<Tour[]>([]);
  const [saisie, setSaisie] = useState('');
  const enCours = tours.some((t) => t.role === 'assistant' && t.enCours);
  const ctrlRef = useRef<AbortController | null>(null);
  const declencheurRef = useRef<HTMLElement | null>(null);
  const rangeeRef = useRef<HTMLDivElement>(null);

  // Molette verticale → défilement horizontal, seulement tant que la rangée peut encore défiler.
  useEffect(() => {
    const el = rangeeRef.current;
    if (!el) return;
    const surMolette = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.deltaY === 0) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      if ((e.deltaY > 0 && el.scrollLeft < max - 1) || (e.deltaY < 0 && el.scrollLeft > 0)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', surMolette, { passive: false });
    return () => el.removeEventListener('wheel', surMolette);
  }, []);

  const majDernier = useCallback((f: (t: Extract<Tour, { role: 'assistant' }>) => Extract<Tour, { role: 'assistant' }>) => {
    setTours((prev) => {
      const copie = [...prev];
      const i = copie.length - 1;
      const t = copie[i];
      if (t && t.role === 'assistant') copie[i] = f(t);
      return copie;
    });
  }, []);

  const poser = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || enCours) return;
      const historique = tours
        .filter((t) => (t.role === 'user' ? true : !t.erreur && t.content.trim() !== '' && !t.enCours))
        .map((t) => ({ role: t.role, content: t.content }));
      setTours((prev) => [...prev, { role: 'user', content: q }, { role: 'assistant', content: '', etape: 'Recherche des données…', meta: null, erreur: null, enCours: true, avis: null }]);
      setSaisie('');
      const ctrl = new AbortController();
      ctrlRef.current = ctrl;
      try {
        const r = await fetch('/api/analyse-ia', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, exercice: exerciceComptes, messages: [...historique, { role: 'user', content: q }] }),
          signal: ctrl.signal,
        });
        if (!r.ok || !r.body) {
          const j = (await r.json().catch(() => null)) as { code?: CodeErreur; error?: string } | null;
          const c: CodeErreur = j?.code ?? (r.status === 401 ? 'connexion' : r.status === 403 ? 'acces' : r.status === 429 ? 'quota' : 'interne');
          majDernier((t) => ({ ...t, enCours: false, etape: null, erreur: { code: c, message: j?.error ?? 'L’analyse n’a pas pu aboutir.' } }));
          return;
        }
        const lecteur = r.body.getReader();
        const dec = new TextDecoder();
        let tampon = '';
        for (;;) {
          const { done, value } = await lecteur.read();
          if (done) break;
          tampon += dec.decode(value, { stream: true });
          const { evenements, reste } = lireEvenements(tampon);
          tampon = reste;
          for (const e of evenements) {
            if (e.type === 'etape') majDernier((t) => ({ ...t, etape: e.libelle }));
            else if (e.type === 'texte') majDernier((t) => ({ ...t, etape: null, content: t.content + e.texte }));
            else if (e.type === 'meta') majDernier((t) => ({ ...t, meta: e.meta }));
            else if (e.type === 'erreur') majDernier((t) => ({ ...t, erreur: { code: e.code, message: e.message } }));
          }
        }
        majDernier((t) => ({ ...t, enCours: false, etape: null }));
      } catch (e) {
        const arret = (e as Error).name === 'AbortError';
        majDernier((t) => ({
          ...t,
          enCours: false,
          etape: null,
          erreur: arret ? (t.content ? null : { code: 'interne', message: 'Réponse interrompue.' }) : { code: 'interne', message: 'Connexion interrompue. Réessayez.' },
        }));
      } finally {
        ctrlRef.current = null;
      }
    },
    [code, exerciceComptes, enCours, tours, majDernier],
  );

  const ouvrir = (question: string | null, declencheur: HTMLElement) => {
    declencheurRef.current = declencheur;
    setOuvert(true);
    if (question) void poser(question);
  };
  const fermer = useCallback(() => {
    ctrlRef.current?.abort();
    setOuvert(false);
    declencheurRef.current?.focus();
  }, []);

  return (
    <section id="analyse-ia" aria-labelledby="t-analyse-ia" className="mt-8 scroll-mt-24">
      <h2 id="t-analyse-ia" className="mb-3.5 text-base font-semibold text-ivory">
        Analyse par IA
      </h2>
      <div
        ref={rangeeRef}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] md:mx-0 md:px-0"
        role="list"
        aria-label={`Questions proposées sur ${code}`}
      >
        <div role="listitem" className="shrink-0 snap-start">
          <button
            type="button"
            onClick={(e) => ouvrir(null, e.currentTarget)}
            aria-label="Ouvrir l’analyse par IA pour poser votre question"
            className="flex h-[76px] w-[76px] items-center justify-center rounded-card border border-border bg-surface text-accent-ink transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Sparkles size={22} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        {questions.map((q) => (
          <div role="listitem" key={q} className="shrink-0 snap-start">
            <button
              type="button"
              onClick={(e) => ouvrir(q, e.currentTarget)}
              className="flex h-[76px] w-[220px] items-center rounded-card border border-border bg-surface px-4 text-left text-[13px] leading-snug text-ivory transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="line-clamp-2">{q}</span>
            </button>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-faint">Réponses tirées des données de WESTBOURSE, avec leur provenance et leurs sources. Ce n&apos;est pas un conseil en investissement.</p>

      {ouvert && (
        <Panneau
          code={code}
          tours={tours}
          saisie={saisie}
          setSaisie={setSaisie}
          enCours={enCours}
          poser={poser}
          arreter={() => ctrlRef.current?.abort()}
          fermer={fermer}
          noterAvis={(i, a) =>
            setTours((prev) => prev.map((t, k) => (k === i && t.role === 'assistant' ? { ...t, avis: t.avis === a ? null : a } : t)))
          }
          questionsDepart={questions.slice(0, 3)}
        />
      )}
    </section>
  );
}

function Panneau({
  code,
  tours,
  saisie,
  setSaisie,
  enCours,
  poser,
  arreter,
  fermer,
  noterAvis,
  questionsDepart,
}: {
  code: string;
  tours: Tour[];
  saisie: string;
  setSaisie: (s: string) => void;
  enCours: boolean;
  poser: (q: string) => void;
  arreter: () => void;
  fermer: () => void;
  noterAvis: (i: number, a: Exclude<Avis, null>) => void;
  questionsDepart: string[];
}) {
  const titreId = useId();
  const boiteRef = useRef<HTMLDivElement>(null);
  const champRef = useRef<HTMLTextAreaElement>(null);
  const finRef = useRef<HTMLDivElement>(null);

  // Focus initial, défilement de page bloqué, Échap, focus piégé.
  useEffect(() => {
    champRef.current?.focus();
    const ancien = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const clavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        fermer();
        return;
      }
      if (e.key !== 'Tab' || !boiteRef.current) return;
      const f = [...boiteRef.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),textarea,[tabindex]:not([tabindex="-1"])')];
      if (f.length === 0) return;
      const premier = f[0]!;
      const dernier = f[f.length - 1]!;
      if (e.shiftKey && document.activeElement === premier) {
        e.preventDefault();
        dernier.focus();
      } else if (!e.shiftKey && document.activeElement === dernier) {
        e.preventDefault();
        premier.focus();
      }
    };
    document.addEventListener('keydown', clavier);
    return () => {
      document.body.style.overflow = ancien;
      document.removeEventListener('keydown', clavier);
    };
  }, [fermer]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: 'end' });
  }, [tours]);

  const dernierAssistant = [...tours].reverse().find((t) => t.role === 'assistant') as Extract<Tour, { role: 'assistant' }> | undefined;
  const relances = !enCours && dernierAssistant?.meta ? dernierAssistant.meta.relances : tours.length === 0 ? questionsDepart : [];

  // Portail vers <body> : la page porte `animate-rise-in`, dont le `transform`
  // persistant (fill-mode both) ferait d'un `fixed` un enfant positionné dans
  // la page au lieu de l'écran — le panneau sortait tout petit, en bas.
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-bg/70 backdrop-blur-[2px]" onClick={fermer} aria-hidden />
      <div
        ref={boiteRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titreId}
        className="relative flex h-full w-full flex-col bg-surface shadow-modal md:w-[460px] md:border-l md:border-border"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 id={titreId} className="flex items-center gap-2 text-base font-semibold text-ivory">
            <Sparkles size={16} strokeWidth={1.75} className="text-accent-ink" aria-hidden />
            Analyse par IA · {code}
          </h2>
          <button
            type="button"
            onClick={fermer}
            aria-label="Fermer l’analyse par IA"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-muted transition-colors hover:bg-elevated hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X size={18} strokeWidth={1.75} aria-hidden />
          </button>
        </div>

        <p className="border-b border-border bg-sunken px-4 py-3 text-xs leading-relaxed text-muted">{AVERTISSEMENT_ANALYSE}</p>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4" aria-live="polite" aria-busy={enCours}>
          {tours.map((t, i) =>
            t.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <p className="max-w-[85%] rounded-card bg-elevated px-3.5 py-2.5 text-[14px] text-ivory">{t.content}</p>
              </div>
            ) : (
              <Reponse key={i} tour={t} code={code} noterAvis={(a) => noterAvis(i, a)} />
            ),
          )}
          {relances.length > 0 && (
            <div>
              <p className="mb-2 text-xs text-faint">{tours.length === 0 ? 'Pour commencer' : 'Pour aller plus loin'}</p>
              <div className="grid gap-2">
                {relances.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => poser(q)}
                    className="min-h-[44px] rounded-card border border-border bg-surface px-3.5 py-2.5 text-left text-[13px] text-ivory transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div ref={finRef} />
        </div>

        <form
          className="flex items-end gap-2 border-t border-border px-4 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            poser(saisie);
          }}
        >
          <label htmlFor={`${titreId}-champ`} className="sr-only">
            Votre question
          </label>
          <textarea
            id={`${titreId}-champ`}
            ref={champRef}
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                poser(saisie);
              }
            }}
            rows={1}
            maxLength={1000}
            placeholder="Demandez ce que vous voulez"
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-border bg-sunken px-3.5 py-2.5 text-[14px] text-ivory placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          {enCours ? (
            <button
              type="button"
              onClick={arreter}
              aria-label="Arrêter la réponse"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border-strong text-ivory transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Square size={16} strokeWidth={1.75} aria-hidden />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!saisie.trim()}
              aria-label="Envoyer la question"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-ink text-obsidian transition-[filter] hover:brightness-110 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Send size={16} strokeWidth={1.75} aria-hidden />
            </button>
          )}
        </form>
      </div>
    </div>,
    document.body,
  );
}

function Reponse({ tour, code, noterAvis }: { tour: Extract<Tour, { role: 'assistant' }>; code: string; noterAvis: (a: Exclude<Avis, null>) => void }) {
  const [copie, setCopie] = useState(false);
  const sources = tour.meta?.sources.map(formaterSource) ?? [];

  if (tour.erreur && !tour.content) {
    const lien =
      tour.erreur.code === 'connexion'
        ? { href: `/login?next=${encodeURIComponent(`/actions/${code}`)}`, texte: 'Se connecter' }
        : tour.erreur.code === 'acces' || tour.erreur.code === 'quota'
          ? { href: '/pricing', texte: 'Voir l’offre Premium' }
          : null;
    return (
      <div className="rounded-card border border-border bg-sunken px-3.5 py-3 text-[13px] text-muted">
        <p>{tour.erreur.message}</p>
        {lien && (
          <Link href={lien.href} className="mt-2 inline-flex min-h-[44px] items-center text-accent-ink underline-offset-2 hover:underline">
            {lien.texte}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div>
      {tour.etape && !tour.content && (
        <p className="flex items-center gap-2 text-[13px] text-muted" role="status">
          <Sparkles size={14} strokeWidth={1.75} className="text-accent-ink" aria-hidden />
          {tour.etape}
        </p>
      )}
      {tour.content && <p className="whitespace-pre-line text-[14px] leading-relaxed text-ivory">{tour.content}</p>}
      {tour.erreur && tour.content && <p className="mt-2 text-xs text-faint">{tour.erreur.message}</p>}
      {tour.meta && !tour.enCours && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <p className="text-xs text-muted">{libelleProvenance(tour.meta.provenance)}</p>
          {sources.length > 0 ? (
            <details className="text-xs text-faint">
              <summary className="cursor-pointer select-none py-1 text-muted hover:text-ivory">Sources ({sources.length})</summary>
              <ul className="mt-1 space-y-1">
                {sources.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </details>
          ) : (
            <p className="text-xs text-faint">Aucune donnée consultée pour cette réponse.</p>
          )}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard
                  ?.writeText(texteACopier(tour.content, tour.meta?.provenance ?? null, sources))
                  .then(() => {
                    setCopie(true);
                    setTimeout(() => setCopie(false), 1500);
                  })
                  .catch(() => undefined);
              }}
              aria-label={copie ? 'Réponse copiée' : 'Copier la réponse'}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-muted transition-colors hover:bg-elevated hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {copie ? <Check size={16} strokeWidth={1.75} aria-hidden /> : <Copy size={16} strokeWidth={1.75} aria-hidden />}
            </button>
            <button
              type="button"
              onClick={() => noterAvis('utile')}
              aria-pressed={tour.avis === 'utile'}
              aria-label="Réponse utile"
              className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${tour.avis === 'utile' ? 'text-accent-ink' : 'text-muted hover:text-ivory'}`}
            >
              <ThumbsUp size={16} strokeWidth={1.75} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => noterAvis('pas_utile')}
              aria-pressed={tour.avis === 'pas_utile'}
              aria-label="Réponse pas utile"
              className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${tour.avis === 'pas_utile' ? 'text-accent-ink' : 'text-muted hover:text-ivory'}`}
            >
              <ThumbsDown size={16} strokeWidth={1.75} aria-hidden />
            </button>
            {tour.avis && <span className="ml-1 text-xs text-faint">Merci pour votre retour.</span>}
          </div>
        </div>
      )}
    </div>
  );
}
