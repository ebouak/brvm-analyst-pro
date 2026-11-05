import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  Calculator,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  PieChart,
  Scale,
  Target,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { PAYS, type Sgi } from '@/lib/sgi-frais/directory';
import { CONFIANCE_LABEL, lienDecision, type SgiFrais } from '@/lib/sgi-frais/types';
import { drapeau, slugSgi } from '@/lib/sgi-frais/identite';
import { fmtFcfa } from '@/lib/sgi-frais/comparaison';
import { SCENARIO_DEFAUT } from '@/lib/sgi-frais/scenario';
import { arcsAnneau, syntheseVueEnsemble, type LigneClassement, type PosteCout } from '@/lib/sgi-frais/vueEnsemble';

/* ──────────────────────────────────────────────────────────────────────────
   Vue d'ensemble : portes d'entrée vers les modules, recommandation et
   classement sur le scénario de référence. Rendu serveur, SVG pur : rien ne
   dépend de JavaScript. Chaque chiffre vient de `syntheseVueEnsemble`.
   ────────────────────────────────────────────────────────────────────────── */

const S = SCENARIO_DEFAUT;
const SCENARIO_TXT = `${fmtFcfa(S.montant)} · 1 an · ${S.nbAchats} achats / ${S.nbVentes} ventes`;
const pct = (n: number, d = 2) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: d })} %`;

/** Couleur de chaque poste : trait de l'anneau + pastille de légende. */
const TEINTE: Record<PosteCout['cle'], { trait: string; pastille: string }> = {
  courtage: { trait: 'stroke-accent', pastille: 'bg-accent' },
  reglementaire: { trait: 'stroke-warn', pastille: 'bg-warn' },
  garde: { trait: 'stroke-up', pastille: 'bg-up' },
  tenue: { trait: 'stroke-purple', pastille: 'bg-purple' },
  virement: { trait: 'stroke-muted', pastille: 'bg-muted' },
};

function Logo({ sgi, taille = 'h-12 w-12' }: { sgi: Sgi; taille?: string }) {
  return (
    <span className={`relative grid ${taille} flex-none place-items-center overflow-hidden rounded-xl border border-border bg-elevated font-display text-sm font-bold text-accent`}>
      <span aria-hidden>{sgi.nom.slice(0, 2).toUpperCase()}</span>
      {sgi.logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={sgi.logo} alt="" loading="lazy" className="absolute inset-0 h-full w-full bg-white object-contain p-1" />
      )}
    </span>
  );
}

function Drapeau({ pays, grand = false }: { pays: string; grand?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={drapeau(pays)}
      alt={PAYS[pays]?.nom ?? ''}
      width={grand ? 36 : 20}
      height={grand ? 24 : 13}
      className={`${grand ? 'h-6 w-9 rounded-[3px]' : 'h-[13px] w-5 rounded-[2px]'} flex-none ring-1 ring-border`}
    />
  );
}

function Panneau({ titre, icone: Icone, action, children, className = '' }: { titre: string; icone: LucideIcon; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-panel border border-border bg-surface p-5 md:p-6 ${className}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2.5 font-display text-lg text-ivory">
          <Icone size={20} aria-hidden className="text-accent" />
          {titre}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/* ── Portes d'entrée ─────────────────────────────────────────────────── */

const PORTES: { href: string; titre: string; texte: string; cta: string; icone: LucideIcon; decor: LucideIcon }[] = [
  {
    href: '/comparateur-sgi/trouver',
    titre: 'Trouver ma SGI',
    texte: 'Répondez à 5 questions et obtenez un classement justifié selon votre profil.',
    cta: 'Démarrer le questionnaire',
    icone: Target,
    decor: ClipboardCheck,
  },
  {
    href: '/comparateur-sgi/simuler',
    titre: 'Simuler mes frais',
    texte: 'Estimez le coût réel de votre investissement : courtage, commissions de marché, garde, tenue de compte.',
    cta: 'Lancer la simulation',
    icone: Calculator,
    decor: PieChart,
  },
];

const PORTES_MOBILE: { href: string; titre: string; texte: string; icone: LucideIcon }[] = [
  { href: '/comparateur-sgi/trouver', titre: 'Trouver ma SGI', texte: 'Questionnaire en 5 étapes', icone: Target },
  { href: '/comparateur-sgi/simuler', titre: 'Simuler mes frais', texte: 'Le coût de votre investissement', icone: Calculator },
  { href: '/comparateur-sgi/comparer', titre: 'Comparer les SGI', texte: 'Jusqu’à 3 intermédiaires côte à côte', icone: Scale },
];

function Portes({ nbSgi }: { nbSgi: number }) {
  return (
    <>
      <div className="hidden grid-cols-2 gap-5 md:grid">
        {PORTES.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className="group relative overflow-hidden rounded-panel border border-border bg-surface p-6 transition-all hover:-translate-y-0.5 hover:border-accent/40"
          >
            <p.decor aria-hidden strokeWidth={1.1} className="pointer-events-none absolute -bottom-4 -right-3 h-36 w-36 text-accent/15 transition-transform duration-500 group-hover:scale-105" />
            <h2 className="flex items-center gap-3 font-display text-2xl text-ivory">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-accent/10 text-accent">
                <p.icone size={22} aria-hidden />
              </span>
              {p.titre}
            </h2>
            <p className="mt-2 max-w-[38ch] text-[14.5px] leading-relaxed text-muted">{p.texte}</p>
            <span className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-nuit px-5 text-sm font-semibold text-sur-nuit transition-colors group-hover:bg-accent group-hover:text-bg">
              {p.cta}
              <ArrowRight size={16} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>

      <ul className="space-y-2.5 md:hidden">
        {[...PORTES_MOBILE, { href: '/comparateur-sgi/annuaire', titre: `Annuaire (${nbSgi} SGI)`, texte: 'Toutes les SGI de la BRVM', icone: BookOpen }].map((p) => (
          <li key={p.href}>
            <Link href={p.href} className="flex min-h-[64px] items-center gap-3.5 rounded-panel border border-border bg-surface px-4 py-3 transition-colors active:bg-elevated">
              <p.icone size={22} aria-hidden className="flex-none text-accent" />
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[15px] font-semibold text-ivory">{p.titre}</span>
                <span className="block text-[12.5px] text-muted">{p.texte}</span>
              </span>
              <ChevronRight size={18} aria-hidden className="flex-none text-faint" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ── Recommandation ──────────────────────────────────────────────────── */

function Recommandation({ r, nbComplets, economie }: { r: LigneClassement; nbComplets: number; economie: ReturnType<typeof syntheseVueEnsemble>['economie'] }) {
  const pdf = lienDecision(r.frais);
  const homologue = r.frais.confiance === 'homologue_crepmf';
  const constats = [
    `Coût le plus bas des ${nbComplets} barèmes complets pour ce scénario`,
    homologue ? 'Barème homologué par l’AMF-UMOA' : 'Barème agrégé de sources publiques, à confirmer',
    economie && economie.montant > 0 ? `${fmtFcfa(economie.montant)} de moins que la moyenne (−${pct(economie.pct, 0)})` : null,
    'Accessible depuis tout l’UEMOA : la BRVM est un marché régional unique',
  ].filter((x): x is string => !!x);

  return (
    <Panneau titre="Notre recommandation" icone={Award} className="border-up/30 bg-[linear-gradient(135deg,rgb(var(--color-up)/0.07),transparent_60%)]">
      <div className="flex items-center gap-4">
        <Logo sgi={r.sgi} taille="h-14 w-14" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-semibold leading-tight text-ivory md:text-2xl">{r.sgi.nom}</p>
          <p className="mt-1 text-[13px] text-muted">
            {PAYS[r.sgi.pays]?.nom} · {CONFIANCE_LABEL[r.frais.confiance]}
          </p>
        </div>
        <Drapeau pays={r.sgi.pays} grand />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-7">
        <div>
          <span className="inline-block rounded-md bg-up px-2.5 py-0.5 text-[11px] font-bold text-bg">Meilleur coût estimé</span>
          <p className="tabular mt-2 font-display text-4xl font-bold leading-none text-up md:text-[2.75rem]">{fmtFcfa(r.cout.total)}</p>
          <p className="mt-1.5 text-[12px] text-muted">Coût total HT · {SCENARIO_TXT}</p>
        </div>
        <ul className="space-y-2 border-border sm:border-l sm:pl-6">
          {constats.map((c) => (
            <li key={c} className="flex gap-2 text-[13.5px] leading-snug text-muted">
              <CheckCircle2 size={16} aria-hidden className="mt-0.5 flex-none text-up" />
              {c}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-4 text-[13px] font-semibold">
        <Link href={`/comparateur-sgi/annuaire/${slugSgi(r.sgi)}`} className="inline-flex min-h-[36px] items-center gap-1.5 text-accent hover:underline">
          Voir la fiche <ArrowRight size={14} aria-hidden />
        </Link>
        {pdf && (
          <a href={pdf} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[36px] items-center text-accent hover:underline">
            Décision officielle (PDF) ↗
          </a>
        )}
      </div>
    </Panneau>
  );
}

/* ── Détail du coût : anneau SVG ─────────────────────────────────────── */

function DetailCout({ postes, total, seuilPct }: { postes: PosteCout[]; total: number; seuilPct: number | null }) {
  const arcs = arcsAnneau(postes.map((p) => p.montant));
  // Cercle de circonférence 100 : la longueur d'arc vaut directement le pourcentage.
  const R = 15.9155;
  return (
    <Panneau titre="Détail du coût estimé" icone={PieChart}>
      <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-[170px_1fr]">
        <div className="relative mx-auto h-[170px] w-[170px]">
          <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90" role="img" aria-label={`Répartition du coût de ${fmtFcfa(total)}`}>
            <circle cx="21" cy="21" r={R} fill="none" className="stroke-border" strokeWidth="5" />
            {postes.map((p, i) => {
              const a = arcs[i]!;
              if (a.part <= 0) return null;
              // Un liseré de 0,6 sépare les arcs voisins.
              const longueur = Math.max(a.part * 100 - 0.6, 0.4);
              return (
                <circle
                  key={p.cle}
                  cx="21"
                  cy="21"
                  r={R}
                  fill="none"
                  strokeWidth="5"
                  className={TEINTE[p.cle].trait}
                  strokeDasharray={`${longueur} ${100 - longueur}`}
                  strokeDashoffset={-a.debut * 100}
                />
              );
            })}
          </svg>
          <p className="absolute inset-0 grid place-items-center text-center">
            <span className="tabular font-display text-xl font-bold leading-tight text-ivory">
              {Math.round(total).toLocaleString('fr-FR')}
              <span className="block text-[11px] font-medium text-muted">FCFA</span>
            </span>
          </p>
        </div>
        <ul className="space-y-2.5">
          {postes.map((p) => (
            <li key={p.cle} className="flex items-center justify-between gap-3 text-[13.5px]">
              <span className="flex items-center gap-2.5 text-muted">
                <span aria-hidden className={`h-2.5 w-2.5 flex-none rounded-full ${TEINTE[p.cle].pastille}`} />
                {p.libelle}
              </span>
              <span className="tabular whitespace-nowrap text-ivory">{fmtFcfa(p.montant)}</span>
            </li>
          ))}
        </ul>
      </div>
      {seuilPct != null && (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-border bg-elevated/50 px-4 py-3">
          <span className="text-[13px] text-muted">
            Hausse nécessaire pour couvrir un aller-retour
            <span className="block text-[11px] text-faint">Achat puis vente d’un ordre type, courtage et commissions compris</span>
          </span>
          <span className="tabular rounded-full bg-up/15 px-3 py-1 text-sm font-bold text-up">+{pct(seuilPct)}</span>
        </div>
      )}
    </Panneau>
  );
}

/* ── Classement ──────────────────────────────────────────────────────── */

function Classement({ lignes }: { lignes: LigneClassement[] }) {
  return (
    <Panneau
      titre="Classement des SGI (coût total)"
      icone={Trophy}
      action={
        <Link href="/comparateur-sgi/simuler" className="inline-flex min-h-[36px] items-center gap-1.5 text-[13px] font-semibold text-accent hover:underline">
          Classement complet <ArrowRight size={14} aria-hidden />
        </Link>
      }
    >
      <p className="-mt-2 mb-4 text-[12.5px] text-muted">Top {lignes.length} sur le scénario de référence ({SCENARIO_TXT})</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">Les SGI les moins chères sur le scénario de référence</caption>
          <thead>
            <tr className="border-b border-border text-left text-[11px] text-faint">
              <th scope="col" className="w-10 pb-2 font-medium">#</th>
              <th scope="col" className="pb-2 font-medium">SGI</th>
              <th scope="col" className="pb-2 text-right font-medium">Coût estimé</th>
              <th scope="col" className="hidden pb-2 text-right font-medium sm:table-cell">Courtage max.</th>
              <th scope="col" className="hidden pb-2 font-medium lg:table-cell">Dépôt min.</th>
              <th scope="col" className="pb-2 font-medium">Barème</th>
              <th scope="col" className="pb-2 text-right font-medium">
                <span className="sr-only">Fiche</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => (
              <tr key={l.sgi.nom} className={`border-b border-border/60 last:border-0 ${i === 0 ? 'bg-up/[0.06]' : ''}`}>
                <td className="py-3 pl-1">
                  <span className={`tabular grid h-6 w-6 place-items-center rounded-md text-[12px] font-bold ${i === 0 ? 'bg-up text-bg' : 'bg-elevated text-muted'}`}>{i + 1}</span>
                </td>
                <td className="py-3 pr-3">
                  <span className="flex items-center gap-2.5">
                    <Drapeau pays={l.sgi.pays} />
                    <span className="font-medium text-ivory">{l.sgi.nom}</span>
                  </span>
                </td>
                <td className={`tabular py-3 pr-3 text-right font-semibold ${i === 0 ? 'text-up' : 'text-ivory'}`}>
                  {fmtFcfa(l.cout.total)}
                  {!l.complet && <span className="block text-[10px] font-normal text-warn">barème incomplet</span>}
                </td>
                <td className="tabular hidden py-3 pr-3 text-right text-muted sm:table-cell">{l.courtageMax != null ? pct(l.courtageMax) : '—'}</td>
                <td className="tabular hidden py-3 pr-3 text-muted lg:table-cell">{l.sgi.depotMin}</td>
                <td className="py-3 pr-3">
                  <span
                    className={`inline-block rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${
                      l.frais.confiance === 'homologue_crepmf' ? 'border-up/30 bg-up/10 text-up' : 'border-border text-muted'
                    }`}
                  >
                    {l.frais.confiance === 'homologue_crepmf' ? 'Homologué' : 'À confirmer'}
                  </span>
                </td>
                <td className="py-3 text-right">
                  <Link
                    href={`/comparateur-sgi/annuaire/${slugSgi(l.sgi)}`}
                    className="inline-flex min-h-[32px] items-center rounded-full border border-accent/40 px-3 text-[12px] font-semibold text-accent transition-colors hover:bg-accent/10"
                  >
                    Voir la fiche
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panneau>
  );
}

/* ── Aperçu de l'annuaire ────────────────────────────────────────────── */

function ApercuAnnuaire({ directory }: { directory: Sgi[] }) {
  const pays = Object.keys(PAYS).filter((c) => directory.some((s) => s.pays === c));
  return (
    <Panneau titre="L’annuaire des SGI" icone={BookOpen} className="flex flex-col">
      <p className="text-[14px] leading-relaxed text-muted">
        Consultez les <span className="tabular text-ivory">{directory.length}</span> SGI référencées, filtrez par pays, barème ou courtage, et ouvrez leur fiche détaillée.
      </p>
      <ul className="mt-5 flex flex-wrap gap-2" aria-label="Pays où siègent les SGI">
        {pays.map((c) => (
          <li key={c} className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[12px] text-muted">
            <Drapeau pays={c} />
            <span className="tabular">{directory.filter((s) => s.pays === c).length}</span>
          </li>
        ))}
      </ul>
      <div aria-hidden className="flex-1" />
      <Link
        href="/comparateur-sgi/annuaire"
        className="mt-6 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-5 text-sm font-semibold text-accent transition-colors hover:bg-accent/20"
      >
        Explorer l’annuaire <ArrowRight size={16} aria-hidden />
      </Link>
    </Panneau>
  );
}

/* ── Assemblage ──────────────────────────────────────────────────────── */

export function VueEnsemble({ directory, frais }: { directory: Sgi[]; frais: SgiFrais[] }) {
  const v = syntheseVueEnsemble(directory, frais, S);
  return (
    <div className="space-y-6">
      <Portes nbSgi={directory.length} />

      {v.recommandee ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
          <Recommandation r={v.recommandee} nbComplets={v.nbComplets} economie={v.economie} />
          <DetailCout postes={v.postes} total={v.recommandee.cout.total} seuilPct={v.seuilPct} />
        </div>
      ) : (
        <div className="rounded-panel border border-dashed border-border px-5 py-10 text-center text-sm text-muted">
          Aucun barème complet n’est disponible pour le moment : pas de recommandation sans données vérifiées.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.7fr_1fr]">
        {v.classement.length > 0 && <Classement lignes={v.classement.slice(0, 5)} />}
        <ApercuAnnuaire directory={directory} />
      </div>
    </div>
  );
}
