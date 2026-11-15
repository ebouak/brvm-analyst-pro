'use client';

/**
 * Barre de cote : la navigation unique du site, pages publiques ET application
 * (lot 7, étapes 1 et 2). Posée une seule fois par `ConditionalShell`.
 *
 * Plate, pleine largeur, découpée en cellules par des filets d'un pixel, cellule
 * d'action pleine collée au bord droit. Aucun lien n'est écrit ici : panneaux,
 * descriptions et colonnes viennent du registre (`lib/navRegistre.ts`) via
 * `lib/barreDeCote.ts`.
 *
 * Accessibilité : motif « disclosure » (`button aria-expanded` + `nav`), pas de
 * `role="menu"`. Les données de la colonne vivante ne sont demandées qu'à la
 * première ouverture d'un panneau (ou au premier focus d'une cellule), jamais
 * au chargement de la page. Le focus clavier n'ouvre PAS le panneau : Entrée,
 * Espace ou ↓ l'ouvrent (accord de l'exploitant du 2026-11-15).
 */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, Grid3x3, Lock, Search, X } from 'lucide-react';
import { AnimatedLogo } from '@/components/brand/AnimatedLogo';
import ThemeToggle from '@/components/ThemeToggle';
import BeginnerToggle from '@/components/BeginnerToggle';
import { OPEN_PALETTE_EVENT } from '@/components/CommandPalette';
import { createClient } from '@/lib/supabase/client';
import { phCapture, phReset } from '@/lib/analytics/posthogClient';
import { isNavItemActive, rubriqueDe } from '@/lib/nav';
import type { Rubrique } from '@/lib/navRegistre';
import {
  LIENS_COMPTE, PANNEAUX, REPLI_VIVANT, RUBRIQUES_BARRE, codeContexte, etatSeance, formaterContexte, hrefPanneau, panneauDe,
  type Apercu, type ContexteValeur, type EtatSeance, type LienPanneau,
} from '@/lib/barreDeCote';

type Session = 'inconnu' | 'anonyme' | 'connecte';
type Cellule = Rubrique;
type Acces = { connecte: boolean; premium: boolean };

const ORDRE_CELLULES: Cellule[] = ['aujourdhui', ...RUBRIQUES_BARRE];

/** Événement qui ouvre le plein écran mobile (cellule grille de la barre du bas). */
export const OUVRIR_GRILLE_EVENT = 'westbourse:ouvrir-grille';

// ── Hooks ──────────────────────────────────────────────────────────────────

function useSession(initiale?: boolean): Session {
  // Le serveur (app/layout.tsx) connaît la session : la barre est rendue d'emblée
  // dans son état final, sans cellule qui apparaît après coup.
  const [etat, setEtat] = useState<Session>(initiale === undefined ? 'inconnu' : initiale ? 'connecte' : 'anonyme');
  useEffect(() => {
    let actif = true;
    let fin: (() => void) | undefined;
    try {
      const sb = createClient();
      sb.auth.getSession().then(({ data }) => { if (actif) setEtat(data.session ? 'connecte' : 'anonyme'); })
        .catch(() => { if (actif) setEtat('anonyme'); });
      const { data } = sb.auth.onAuthStateChange((_e, s) => { if (actif) setEtat(s ? 'connecte' : 'anonyme'); });
      fin = () => data.subscription.unsubscribe();
    } catch {
      setEtat('anonyme');
    }
    return () => { actif = false; fin?.(); };
  }, []);
  return etat;
}

/**
 * L'état de séance dépend de l'heure : calculé dès le rendu (pas de libellé
 * provisoire qui change de largeur), puis recalculé au montage et toutes les
 * 30 s. Un HTML servi depuis un cache peut porter un texte de quelques minutes :
 * l'écart est corrigé dès l'hydratation (`suppressHydrationWarning`).
 */
function useSeance(): EtatSeance | null {
  const [s, setS] = useState<EtatSeance | null>(() => etatSeance(new Date()));
  useEffect(() => {
    const maj = () => setS(etatSeance(new Date()));
    maj();
    const t = window.setInterval(maj, 30_000);
    return () => window.clearInterval(t);
  }, []);
  return s;
}

type Chargement = Apercu | 'echec';

function useApercus(connecte: boolean) {
  const [apercus, setApercus] = useState<Partial<Record<Rubrique, Chargement>>>({});
  const demandes = useRef(new Set<Rubrique>());
  const charger = useCallback((id: Rubrique) => {
    if (demandes.current.has(id)) return;
    if (id === 'portefeuille' && !connecte) return;
    demandes.current.add(id);
    const ctl = new AbortController();
    const t = window.setTimeout(() => ctl.abort(), 4000);
    // Données privées (portefeuille, leçon en cours) : routes distinctes, jamais en cache partagé.
    const url = id === 'portefeuille' ? '/api/nav/portefeuille'
      : id === 'apprendre' && connecte ? '/api/nav/apprendre'
      : `/api/nav/apercu?r=${id}`;
    fetch(url, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { apercu?: Apercu }) => setApercus((a) => ({ ...a, [id]: j.apercu ?? 'echec' })))
      .catch(() => setApercus((a) => ({ ...a, [id]: 'echec' })))
      .finally(() => window.clearTimeout(t));
  }, [connecte]);
  return { apercus, charger };
}

// ── Pièces ─────────────────────────────────────────────────────────────────

const FILET = 'border-r border-border';
const CELLULE = 'relative flex h-full items-center gap-2 whitespace-nowrap px-3 text-sm font-medium text-muted outline-none xl:px-4 transition-colors hover:text-ivory focus-visible:bg-elevated focus-visible:text-ivory focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-ink';

function Pastille({ seance }: { seance: EtatSeance | null }) {
  return (
    <span
      aria-hidden
      suppressHydrationWarning
      className={`h-2 w-2 shrink-0 rounded-full ${seance?.ouverte ? 'bg-up motion-safe:animate-[pulse_2s_infinite]' : 'bg-faint'}`}
    />
  );
}

/** Intitulé d'un groupe nommé (« Documents ») : rendu avant son premier lien. */
function debutGroupe(liens: LienPanneau[], i: number): string | null {
  const g = liens[i].groupe;
  return g && (i === 0 || liens[i - 1].groupe !== g) ? g : null;
}

function ColonneLiens({ liens, fermer, refPremier, acces, pathname }: { liens: LienPanneau[]; fermer: () => void; refPremier?: (el: HTMLAnchorElement | null) => void; acces: Acces; pathname: string }) {
  return (
    <ul className="space-y-0.5">
      {liens.map((l, i) => (
        <li key={l.href}>
          {debutGroupe(liens, i) && (
            <p className={`px-3 pb-1 text-xs font-semibold text-faint ${i > 0 ? 'mt-2 border-t border-border pt-3' : 'pt-1'}`}>{l.groupe}</p>
          )}
          <Link
            href={hrefPanneau(l, acces)}
            ref={i === 0 ? refPremier : undefined}
            onClick={fermer}
            aria-current={isNavItemActive(l.href, pathname) ? 'page' : undefined}
            className="group grid min-h-[44px] content-center rounded-sm px-3 py-1.5 outline-none hover:bg-elevated focus-visible:bg-elevated focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-ink aria-[current=page]:bg-elevated"
          >
            <span className="flex items-center gap-1.5 text-sm font-semibold text-ivory group-aria-[current=page]:text-accent-ink">
              {l.label}
              {l.premium && <Lock aria-label="Premium" className="h-3 w-3 text-faint" strokeWidth={2} />}
            </span>
            {l.description && <span className="text-xs text-muted">{l.description}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ColonneVivante({ id, charge, fermer }: { id: Rubrique; charge: Chargement | undefined; fermer: () => void }) {
  const repli = REPLI_VIVANT[id];
  const a = charge && charge !== 'echec' ? charge : null;
  const titre = a?.titre ?? repli.titre;
  const lien = a?.lien ?? { href: repli.href, label: repli.label };
  return (
    <div className="flex min-h-[200px] flex-col bg-sunken px-5 py-4">
      <p className="text-sm font-semibold text-ivory">{titre}</p>
      <ul className="mt-2 min-h-[104px] space-y-0.5">
        {(a?.lignes ?? []).slice(0, 4).map((l, i) => (
          <li key={`${l.texte}-${i}`}>
            {l.href ? (
              <Link href={l.href} onClick={fermer} className="tabular flex min-h-[32px] items-center justify-between gap-3 rounded-sm px-2 text-sm text-ivory outline-none hover:bg-elevated focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-ink">
                <span className="truncate">{l.texte}</span>
                {l.detail && <span className={l.sens === 'hausse' ? 'text-up' : l.sens === 'baisse' ? 'text-down' : 'text-muted'}>{l.detail}</span>}
              </Link>
            ) : (
              <p className="tabular flex min-h-[32px] items-center justify-between gap-3 px-2 text-sm text-ivory">
                <span className="truncate">{l.texte}</span>
                {l.detail && <span className={l.sens === 'hausse' ? 'text-up' : l.sens === 'baisse' ? 'text-down' : 'text-muted'}>{l.detail}</span>}
              </p>
            )}
          </li>
        ))}
      </ul>
      <Link href={lien.href} onClick={fermer} className="mt-auto inline-flex min-h-[44px] items-center text-sm font-medium text-accent-ink underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent-ink">
        {lien.label}
      </Link>
    </div>
  );
}

// ── Barre ──────────────────────────────────────────────────────────────────

export default function BarreDeCote({
  connecteInitial,
  isPremium = false,
  isAdmin = false,
}: {
  /** Session connue du serveur (app/layout.tsx). Absente : déterminée au montage. */
  connecteInitial?: boolean;
  isPremium?: boolean;
  isAdmin?: boolean;
} = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession(connecteInitial);
  const seance = useSeance();
  const connecte = session === 'connecte';
  const acces: Acces = { connecte, premium: isPremium };
  const { apercus, charger } = useApercus(connecte);
  const liensCompte = [...LIENS_COMPTE, ...(connecte && isAdmin ? [{ href: '/admin', label: 'Administration' }] : [])];

  const [ouvert, setOuvert] = useState<Cellule | null>(null);
  const [compact, setCompact] = useState(false);
  const [mobileOuvert, setMobileOuvert] = useState(false);
  const [raccourci, setRaccourci] = useState('Ctrl K');
  const [contexte, setContexte] = useState<ContexteValeur | null>(null);

  const entete = useRef<HTMLElement>(null);
  const cellules = useRef<Partial<Record<Cellule, HTMLButtonElement | null>>>({});
  const premierLien = useRef<HTMLAnchorElement | null>(null);
  const focusPanneau = useRef(false);
  const tOuverture = useRef<number | undefined>(undefined);
  const tFermeture = useRef<number | undefined>(undefined);
  const scrollOuverture = useRef(0);
  const idPanneau = useId();

  const rubriqueCourante = rubriqueDe(pathname);
  const code = codeContexte(pathname);

  // Plateforme du raccourci (après montage : le HTML mis en cache est neutre).
  useEffect(() => {
    if (/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)) setRaccourci('⌘K');
  }, []);

  // Référence stable : le plein écran pose le piège de focus à son montage, pas à chaque rendu de la barre.
  const fermerMobile = useCallback(() => setMobileOuvert(false), []);

  const fermer = useCallback(() => {
    window.clearTimeout(tOuverture.current);
    window.clearTimeout(tFermeture.current);
    setOuvert(null);
  }, []);

  const ouvrir = useCallback((id: Cellule) => {
    window.clearTimeout(tFermeture.current);
    scrollOuverture.current = window.scrollY;
    setOuvert(id);
    charger(id);
  }, [charger]);

  // Fermeture : changement de route, clic extérieur, défilement > 40 px, sortie du focus.
  useEffect(() => { fermer(); setMobileOuvert(false); }, [pathname, fermer]);

  useEffect(() => {
    const onScroll = () => {
      setCompact(window.scrollY > 80);
      if (ouvert && Math.abs(window.scrollY - scrollOuverture.current) > 40) fermer();
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [ouvert, fermer]);

  useEffect(() => {
    if (!ouvert) return;
    const onDown = (e: PointerEvent) => { if (entete.current && !entete.current.contains(e.target as Node)) fermer(); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [ouvert, fermer]);

  // La cellule grille de la barre du bas (mobile) ouvre le même plein écran.
  useEffect(() => {
    const ouvrirGrille = () => setMobileOuvert(true);
    window.addEventListener(OUVRIR_GRILLE_EVENT, ouvrirGrille);
    return () => window.removeEventListener(OUVRIR_GRILLE_EVENT, ouvrirGrille);
  }, []);

  // Raccourci « / » : ouvre la palette (hors champ de saisie).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Cellule de contexte : le cours n'est demandé qu'une fois la page défilée (la barre se compacte), jamais au chargement.
  useEffect(() => {
    setContexte(null);
    if (!code || !compact) return;
    let actif = true;
    fetch(`/api/nav/apercu?r=contexte&code=${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { contexte?: ContexteValeur | null } | null) => { if (actif && j?.contexte) setContexte(j.contexte); })
      .catch(() => {});
    return () => { actif = false; };
  }, [code, compact]);

  // Focus dans le panneau après ↓ / Entrée.
  useEffect(() => {
    if (ouvert && focusPanneau.current) {
      focusPanneau.current = false;
      window.setTimeout(() => premierLien.current?.focus(), 0);
    }
  }, [ouvert]);

  const clavierCellule = (id: Cellule) => (e: React.KeyboardEvent) => {
    const ordre: Cellule[] = connecte ? [...ORDRE_CELLULES, 'portefeuille'] : ORDRE_CELLULES;
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      if (e.key !== 'ArrowDown' && e.currentTarget.getAttribute('aria-expanded') === 'true') return; // le clic ferme
      e.preventDefault();
      focusPanneau.current = true;
      ouvrir(id);
    } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && ouvert) {
      e.preventDefault();
      const i = ordre.indexOf(id);
      const suivant = ordre[(i + (e.key === 'ArrowRight' ? 1 : -1) + ordre.length) % ordre.length];
      ouvrir(suivant);
      cellules.current[suivant]?.focus();
    }
  };

  const survol = (id: Cellule) => (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return; // jamais au survol seul sur écran tactile
    window.clearTimeout(tFermeture.current);
    window.clearTimeout(tOuverture.current);
    if (ouvert === id) return;
    tOuverture.current = window.setTimeout(() => ouvrir(id), 120);
  };
  const sortie = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    window.clearTimeout(tOuverture.current);
    tFermeture.current = window.setTimeout(() => setOuvert(null), 200);
  };

  const echap = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && ouvert) {
      e.stopPropagation();
      const cible = cellules.current[ouvert];
      fermer();
      cible?.focus();
    }
  };

  const sortieFocus = (e: React.FocusEvent) => {
    if (ouvert && entete.current && !entete.current.contains(e.relatedTarget as Node | null)) setOuvert(null);
  };

  const basculer = (id: Cellule) => () => { if (ouvert === id) fermer(); else ouvrir(id); };

  // ── Panneau : hauteur mesurée, ajustée en 150 ms sans refermer ────────────
  const interieur = useRef<HTMLDivElement>(null);
  const [hauteur, setHauteur] = useState(0);
  useLayoutEffect(() => {
    const el = interieur.current;
    if (!el) { setHauteur(0); return; }
    const mesure = () => setHauteur(el.getBoundingClientRect().height);
    mesure();
    const ro = new ResizeObserver(mesure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ouvert]);

  const panneau = ouvert ? panneauDe(ouvert) : null;
  const estPortefeuille = ouvert === 'portefeuille';

  const seanceCellule = (
    <>
      <Pastille seance={seance} />
      <span className="tabular">
        <span suppressHydrationWarning className="min-[1536px]:hidden">{seance?.court ?? 'Séance'}</span>
        <span suppressHydrationWarning className="hidden min-[1536px]:inline">{seance?.libelle ?? 'Séance'}</span>
      </span>
    </>
  );

  const ctx = contexte ? formaterContexte(contexte) : null;

  async function deconnecter() {
    await createClient().auth.signOut();
    void phReset();
    fermer();
    router.push('/login');
    router.refresh();
  }

  const cellule = (id: Cellule, contenu: React.ReactNode, extra = '') => {
    const actif = rubriqueCourante === id;
    const estOuvert = ouvert === id;
    return (
      <button
        key={id}
        ref={(el) => { cellules.current[id] = el; }}
        type="button"
        aria-expanded={estOuvert}
        aria-controls={estOuvert ? idPanneau : undefined}
        aria-current={actif ? 'true' : undefined}
        onClick={basculer(id)}
        onKeyDown={clavierCellule(id)}
        onPointerEnter={survol(id)}
        onFocus={() => charger(id)}
        className={`${CELLULE} ${FILET} ${estOuvert ? 'bg-elevated text-ivory' : ''} ${actif ? 'text-ivory' : ''} ${extra}`}
      >
        {contenu}
        {actif && <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-accent-ink" />}
      </button>
    );
  };

  return (
    <>
      {/* Réserve la hauteur normale : la barre se compacte sans pousser le contenu. */}
      <div aria-hidden className="h-14 print:hidden" />
      <header
        ref={entete}
        id="barre-de-cote"
        data-compacte={compact ? '' : undefined}
        onKeyDown={echap}
        onBlur={sortieFocus}
        onPointerLeave={sortie}
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') window.clearTimeout(tFermeture.current); }}
        className="fixed inset-x-0 top-0 z-40 border-b border-border bg-bg print:hidden"
      >
        {/* ── Bureau ── */}
        <nav aria-label="Navigation principale" className={`hidden items-stretch border-l border-border transition-[height] duration-150 motion-reduce:transition-none lg:flex ${compact ? 'h-11' : 'h-14'}`}>
          <Link
            href={connecte ? '/dashboard' : '/'}
            aria-label="WESTBOURSE, accueil"
            className={`${CELLULE} ${FILET} gap-2.5 text-ivory`}
          >
            <AnimatedLogo size={26} variant="mark" animate={false} />
            <span className="hidden font-display text-base font-semibold tracking-tight xl:inline">WESTBOURSE</span>
          </Link>

          {cellule('aujourdhui', <>{seanceCellule}<ChevronDown aria-hidden className="h-3.5 w-3.5 shrink-0 opacity-60" /></>)}
          {RUBRIQUES_BARRE.map((id) => cellule(id, <span>{panneauDe(id).libelle}</span>))}

          {code && (
            <div
              aria-live="polite"
              className={`tabular ${FILET} hidden min-w-[168px] items-center xl:flex gap-2 whitespace-nowrap px-4 text-sm ${ctx ? '' : 'invisible'}`}
            >
              <Link href={`/actions/${code}`} className="font-semibold text-ivory hover:underline">{code}</Link>
              {ctx && (
                <>
                  <span className="text-muted">{ctx.cours}</span>
                  <span className={ctx.sens === 'hausse' ? 'text-up' : ctx.sens === 'baisse' ? 'text-down' : 'text-muted'}>{ctx.variation}</span>
                </>
              )}
            </div>
          )}

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
            className={`${CELLULE} border-l border-border ${FILET}`}
          >
            <Search aria-hidden className="h-4 w-4" />
            <span className="hidden min-[1536px]:inline">Chercher une valeur</span>
            <span className="sr-only min-[1536px]:hidden">Chercher une valeur</span>
            <kbd className="rounded-sm border border-border px-1.5 py-0.5 font-sans text-[11px] text-faint">{raccourci}</kbd>
          </button>

          {session !== 'connecte' && (
            <div className={`${FILET} hidden w-28 items-center justify-center min-[1360px]:flex`}>
              <ThemeToggle className="!rounded-sm !border-0 !bg-transparent" />
            </div>
          )}

          {session === 'anonyme' && (
            <Link href="/login" className={`${CELLULE} ${FILET}`}>Se connecter</Link>
          )}

          {connecte ? (
            <button
              ref={(el) => { cellules.current.portefeuille = el; }}
              type="button"
              aria-expanded={estPortefeuille}
              aria-controls={estPortefeuille ? idPanneau : undefined}
              onClick={basculer('portefeuille')}
              onKeyDown={clavierCellule('portefeuille')}
              onPointerEnter={survol('portefeuille')}
              onFocus={() => charger('portefeuille')}
              className="flex h-full items-center gap-2 whitespace-nowrap bg-ivory px-5 text-sm font-semibold text-bg outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-ink"
            >
              Mon portefeuille <ChevronDown aria-hidden className="h-4 w-4" />
            </button>
          ) : (
            <Link
              href="/signup"
              onClick={() => { if (pathname === '/') void phCapture('vitrine_inscription_clic', { emplacement: 'en-tete' }); }}
              tabIndex={session === 'inconnu' ? -1 : undefined}
              aria-hidden={session === 'inconnu' ? true : undefined}
              className={`flex h-full items-center whitespace-nowrap bg-ivory px-5 text-sm font-semibold text-bg outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-ink ${session === 'inconnu' ? 'invisible' : ''}`}
            >
              Créer un compte
            </Link>
          )}
        </nav>

        {/* ── Panneau partagé (bureau) ── */}
        <div
          id={idPanneau}
          className="absolute inset-x-0 top-full hidden overflow-hidden border-b border-border bg-surface transition-[height] duration-150 motion-reduce:transition-none lg:block"
          style={{ height: panneau ? hauteur : 0, borderBottomWidth: panneau ? 1 : 0 }}
          aria-hidden={!panneau}
        >
          {panneau && (
            <div ref={interieur}>
              <div key={panneau.id} className="cote-fondu grid grid-cols-[1fr_1fr_minmax(280px,360px)] divide-x divide-border border-l border-border">
                <div className="px-3 py-3">
                  <ColonneLiens
                    liens={panneau.colonnes[0]}
                    fermer={fermer}
                    refPremier={(el) => { premierLien.current = el; }}
                    acces={acces}
                    pathname={pathname}
                  />
                </div>
                <div className="px-3 py-3">
                  <ColonneLiens liens={panneau.colonnes[1]} fermer={fermer} acces={acces} pathname={pathname} />
                  {estPortefeuille && (
                    <div className="mt-2 border-t border-border pt-2">
                      <p className="px-3 py-1 text-xs font-semibold text-faint">Compte</p>
                      <ul className="space-y-0.5">
                        {liensCompte.map((l) => (
                          <li key={l.href}>
                            <Link href={l.href} onClick={fermer} aria-current={pathname === l.href ? 'page' : undefined} className="flex min-h-[36px] items-center rounded-sm px-3 text-sm text-ivory outline-none hover:bg-elevated focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-ink aria-[current=page]:text-accent-ink">{l.label}</Link>
                          </li>
                        ))}
                      </ul>
                      <div className="flex flex-wrap items-center justify-between gap-3 px-3 pt-2">
                        <span className="flex items-center gap-2">
                          <ThemeToggle />
                          <BeginnerToggle />
                        </span>
                        <button type="button" onClick={deconnecter} className="inline-flex min-h-[44px] items-center text-sm text-muted underline-offset-4 outline-none hover:text-ivory hover:underline focus-visible:ring-2 focus-visible:ring-accent-ink">Se déconnecter</button>
                      </div>
                    </div>
                  )}
                </div>
                <ColonneVivante id={panneau.id} charge={apercus[panneau.id]} fermer={fermer} />
              </div>
            </div>
          )}
        </div>

        {/* ── Mobile et tablette ── */}
        <div className="flex h-14 items-stretch border-l border-border lg:hidden">
          <Link href={connecte ? '/dashboard' : '/'} aria-label="WESTBOURSE, accueil" className={`${CELLULE} ${FILET} text-ivory`}>
            <AnimatedLogo size={28} variant="mark" animate={false} />
          </Link>
          <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))} className={`${CELLULE} ${FILET} min-w-0 flex-1`}>
            <Search aria-hidden className="h-4 w-4 shrink-0" />
            <span className="truncate">Chercher une valeur</span>
          </button>
          <button
            type="button"
            aria-label="Ouvrir le menu"
            aria-expanded={mobileOuvert}
            aria-haspopup="dialog"
            onClick={() => setMobileOuvert(true)}
            className="flex h-full w-14 shrink-0 items-center justify-center text-ivory outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-ink"
          >
            <Grid3x3 aria-hidden className="h-5 w-5" />
          </button>
        </div>
      </header>

      {mobileOuvert && (
        <GrilleMobile
          seance={seance}
          connecte={connecte}
          session={session}
          courante={rubriqueCourante}
          fermer={fermerMobile}
          deconnecter={deconnecter}
          acces={acces}
          pathname={pathname}
          liensCompte={liensCompte}
        />
      )}
    </>
  );
}

// ── Plein écran mobile ─────────────────────────────────────────────────────

function GrilleMobile({
  seance, connecte, session, courante, fermer, deconnecter, acces, pathname, liensCompte,
}: {
  seance: EtatSeance | null;
  connecte: boolean;
  session: Session;
  courante: Rubrique | null;
  fermer: () => void;
  deconnecter: () => void;
  acces: Acces;
  pathname: string;
  liensCompte: { href: string; label: string }[];
}) {
  const [ouverte, setOuverte] = useState<Rubrique>(courante ?? 'marche');
  const boite = useRef<HTMLDivElement>(null);
  const idTitre = useId();

  // Défilement de la page verrouillé, focus piégé, Échap ferme et rend le focus.
  useEffect(() => {
    const precedent = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focalisables = () => Array.from(boite.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []);
    focalisables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); fermer(); return; }
      if (e.key !== 'Tab') return;
      const f = focalisables();
      if (f.length === 0) return;
      const premier = f[0];
      const dernier = f[f.length - 1];
      if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
      else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      precedent?.focus?.();
    };
  }, [fermer]);

  return (
    <div ref={boite} role="dialog" aria-modal="true" aria-labelledby={idTitre} className="fixed inset-0 z-50 flex flex-col bg-bg lg:hidden">
      <div className="flex h-14 shrink-0 items-stretch border-b border-border">
        <div className="flex flex-1 items-center gap-2 px-4 text-sm text-ivory">
          <Pastille seance={seance} />
          <span id={idTitre} className="tabular">{seance?.libelle ?? 'Menu'}</span>
        </div>
        <button type="button" aria-label="Fermer le menu" onClick={fermer} className="flex h-full w-14 items-center justify-center border-l border-border text-ivory outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-ink">
          <X aria-hidden className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {PANNEAUX.filter((p) => connecte || p.id !== 'portefeuille').map((p) => {
          const est = ouverte === p.id;
          const idc = `cote-m-${p.id}`;
          return (
            <section key={p.id} className="border-b border-border">
              <h2>
                <button
                  type="button"
                  aria-expanded={est}
                  aria-controls={idc}
                  onClick={() => setOuverte(p.id)}
                  className="flex min-h-[52px] w-full items-center justify-between px-4 text-left text-[15px] font-semibold text-ivory outline-none focus-visible:bg-elevated"
                >
                  <span className="relative">
                    {p.libelle}
                    {courante === p.id && <span aria-hidden className="absolute -bottom-1 left-0 h-0.5 w-full bg-accent-ink" />}
                  </span>
                  <ChevronDown aria-hidden className={`h-4 w-4 transition-transform motion-reduce:transition-none ${est ? 'rotate-180' : ''}`} />
                </button>
              </h2>
              <div id={idc} hidden={!est} className="bg-surface px-2 pb-2">
                {(() => {
                  const liens = [...p.colonnes[0].filter((l) => !l.groupe), ...p.colonnes[1].filter((l) => !l.groupe), ...p.colonnes.flat().filter((l) => l.groupe)];
                  return liens.map((l, i) => (
                    <div key={l.href}>
                      {debutGroupe(liens, i) && <p className="px-3 pb-1 pt-3 text-xs font-semibold text-faint">{l.groupe}</p>}
                      <Link
                        href={hrefPanneau(l, acces)}
                        onClick={fermer}
                        aria-current={isNavItemActive(l.href, pathname) ? 'page' : undefined}
                        className="group grid min-h-[48px] content-center rounded-sm px-3 py-1.5 outline-none hover:bg-elevated focus-visible:bg-elevated aria-[current=page]:bg-elevated"
                      >
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-ivory group-aria-[current=page]:text-accent-ink">
                          {l.label}
                          {l.premium && <Lock aria-label="Premium" className="h-3 w-3 text-faint" />}
                        </span>
                        {l.description && <span className="text-xs text-muted">{l.description}</span>}
                      </Link>
                    </div>
                  ));
                })()}
                {p.id === 'portefeuille' && (
                  <>
                    <p className="px-3 pb-1 pt-3 text-xs font-semibold text-faint">Compte</p>
                    {liensCompte.map((l) => (
                      <Link key={l.href} href={l.href} onClick={fermer} aria-current={pathname === l.href ? 'page' : undefined} className="flex min-h-[48px] items-center rounded-sm px-3 text-sm text-ivory outline-none hover:bg-elevated focus-visible:bg-elevated aria-[current=page]:text-accent-ink">{l.label}</Link>
                    ))}
                  </>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <div className="shrink-0 border-t border-border bg-bg p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <ThemeToggle className="min-h-[48px]" />
            {connecte && <BeginnerToggle className="min-h-[48px]" />}
          </span>
          {connecte && <button type="button" onClick={deconnecter} className="inline-flex min-h-[48px] items-center px-3 text-sm text-muted outline-none hover:text-ivory focus-visible:ring-2 focus-visible:ring-accent-ink">Se déconnecter</button>}
        </div>
        {session === 'anonyme' && (
          <Link href="/login" onClick={fermer} className="mb-2 flex min-h-[48px] items-center justify-center border border-border text-sm font-medium text-ivory">Se connecter</Link>
        )}
        {connecte ? (
          <Link href="/dashboard" onClick={fermer} className="flex min-h-[48px] items-center justify-center bg-ivory text-sm font-semibold text-bg">Mon tableau de bord</Link>
        ) : (
          <Link
            href="/signup"
            onClick={fermer}
            tabIndex={session === 'inconnu' ? -1 : undefined}
            className="flex min-h-[48px] items-center justify-center bg-ivory text-sm font-semibold text-bg"
          >
            Créer un compte
          </Link>
        )}
      </div>
    </div>
  );
}
