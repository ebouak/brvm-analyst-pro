'use client';

/**
 * Fil d'Ariane, généré depuis le registre de navigation (lib/navRegistre.ts).
 *
 * - `app` : posé une fois par le shell applicatif (ConditionalShell), affiché
 *   sur toute page de niveau 2 et plus. Une page dynamique peut nommer son
 *   dernier maillon avec <LibelleFil libelle="…" /> ; à défaut, la valeur
 *   réelle du paramètre de l'adresse, ou le libellé du modèle de route.
 * - `public` : posé en tête des pages publiques plein écran (PublicShell et
 *   pages à en-tête propre). Ne garde que les maillons publics (un lien vers une
 *   page à compte enverrait le visiteur sur /login), commence par « Accueil »
 *   et publie les données structurées BreadcrumbList. Rendu côté serveur : le
 *   libellé vient de la prop, jamais d'un état client, pour que le HTML servi
 *   aux moteurs soit complet.
 *   Pour une session ouverte, un lien « Mon tableau de bord » apparaît APRÈS
 *   hydratation (P1-1) : le HTML servi aux visiteurs ne change pas.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronRight, LayoutDashboard } from 'lucide-react';
import { construireFil, type MaillonFil } from '@/lib/nav';
import { jsonLdScript } from '@/lib/jsonLd';
import { isPublicPath } from '@/lib/auth/cheminsPublics';
import { createClient } from '@/lib/supabase/client';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.westbourse.com';

// ── Libellé fourni par la page (shell applicatif) ───────────────────────────

interface CtxLibelle {
  chemin: string | null;
  libelle: string | null;
  poser: (chemin: string, libelle: string | null) => void;
}
const LibelleCtx = createContext<CtxLibelle | null>(null);

export function FilArianeProvider({ children }: { children: ReactNode }) {
  const [etat, setEtat] = useState<{ chemin: string | null; libelle: string | null }>({ chemin: null, libelle: null });
  // `poser` stable : sinon chaque rendu relancerait l'effet de LibelleFil, en boucle.
  const poser = useCallback((chemin: string, libelle: string | null) => {
    setEtat((e) => (e.chemin === chemin && e.libelle === libelle ? e : { chemin, libelle }));
  }, []);
  const valeur = useMemo(() => ({ ...etat, poser }), [etat, poser]);
  return (
    <LibelleCtx.Provider value={valeur}>
      {children}
    </LibelleCtx.Provider>
  );
}

/** À rendre dans une page dynamique pour nommer le dernier maillon (ex. la désignation d'une société). */
export function LibelleFil({ libelle }: { libelle: string | null | undefined }) {
  const ctx = useContext(LibelleCtx);
  const pathname = usePathname();
  const poser = ctx?.poser;
  useEffect(() => {
    if (!poser) return;
    poser(pathname, libelle ?? null);
    return () => poser(pathname, null);
  }, [poser, pathname, libelle]);
  return null;
}

// ── Session (pages publiques) ────────────────────────────────────────────────

function useSessionOuverte(): boolean {
  const [ouverte, setOuverte] = useState(false);
  useEffect(() => {
    let actif = true;
    let desabonner: (() => void) | undefined;
    try {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data }) => { if (actif) setOuverte(Boolean(data.session)); }).catch(() => {});
      const { data } = supabase.auth.onAuthStateChange((_e, s) => { if (actif) setOuverte(Boolean(s)); });
      desabonner = () => data.subscription.unsubscribe();
    } catch {
      /* sans client Supabase : on reste en visiteur */
    }
    return () => { actif = false; desabonner?.(); };
  }, []);
  return ouverte;
}

/** « Mon tableau de bord » pour une session ouverte, après hydratation seulement. */
function RetourEspace() {
  const ouverte = useSessionOuverte();
  if (!ouverte) return null;
  return (
    <Link
      href="/dashboard"
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 font-medium text-accent-ink hover:underline md:min-h-0"
    >
      <LayoutDashboard size={14} aria-hidden />
      Mon tableau de bord
    </Link>
  );
}

// ── Rendu ───────────────────────────────────────────────────────────────────

function Liste({ maillons, tete }: { maillons: MaillonFil[]; tete?: ReactNode }) {
  return (
    <ol className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
      {tete}
      {maillons.map((m, i) => (
        <li key={`${i}-${m.libelle}`} className="flex min-w-0 items-center gap-1.5">
          {(i > 0 || tete) && <ChevronRight size={12} aria-hidden className="shrink-0 text-faint" />}
          {m.href ? (
            <Link href={m.href} className="truncate text-muted transition-colors hover:text-accent-ink">
              {m.libelle}
            </Link>
          ) : (
            <span aria-current="page" className="truncate text-ivory">{m.libelle}</span>
          )}
        </li>
      ))}
    </ol>
  );
}

export default function FilAriane({
  variante,
  libelle,
  className = '',
}: {
  variante: 'app' | 'public';
  /** Libellé du dernier maillon, fourni par la page. */
  libelle?: string | null;
  className?: string;
}) {
  const pathname = usePathname();
  const ctx = useContext(LibelleCtx);
  const libelleCtx = ctx && ctx.chemin === pathname ? ctx.libelle : null;
  const fil = construireFil(pathname, variante === 'app' ? libelleCtx ?? libelle : libelle);
  if (!fil || fil.sansFil) return null;

  if (variante === 'app') {
    if (fil.maillons.length < 2) return null;
    return (
      <nav aria-label="Fil d'Ariane" className={`mx-auto max-w-7xl px-4 pt-4 text-xs md:px-6 print:hidden ${className}`}>
        <Liste
          maillons={fil.maillons}
          tete={fil.rubrique ? <li className="text-faint">{fil.rubrique}</li> : undefined}
        />
      </nav>
    );
  }

  // Public : seuls les maillons publics (et la page courante) restent.
  const maillons = fil.maillons.filter((m) => m.href === null || isPublicPath(m.href));
  const accueil: MaillonFil = { libelle: 'Accueil', href: '/' };
  const tous = [accueil, ...maillons];
  const donnees = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: tous.map((m, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: m.libelle,
      item: `${SITE_URL}${m.href ?? pathname}`,
    })),
  };
  return (
    <nav aria-label="Fil d'Ariane" className={`flex flex-wrap items-center justify-between gap-2 text-xs print:hidden ${className}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(donnees) }} />
      <Liste maillons={tous} />
      <RetourEspace />
    </nav>
  );
}
