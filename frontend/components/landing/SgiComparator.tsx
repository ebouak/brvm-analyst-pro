'use client';

import { useMemo, useState } from 'react';
import { CalculateurCout } from '@/components/comparateur-sgi/CalculateurCout';
import { PAYS, SGI_DIRECTORY, type Sgi } from '@/lib/sgi-frais/directory';
import type { SgiFrais } from '@/lib/sgi-frais/types';

/* ──────────────────────────────────────────────────────────────────────────
   Comparateur des SGI BRVM — annuaire par pays UEMOA.
   Données indicatives issues de sources publiques (BRVM, APSGI).
   Les dépôts minimums sont des repères de marché par profil, pas des barèmes
   officiels. `logo` vide → monogramme généré automatiquement.
   L'annuaire (pays/type/groupe/dépôt min/liens) vit dans
   lib/sgi-frais/directory.ts — partagé avec CalculateurCout (jointure).
   ────────────────────────────────────────────────────────────────────────── */

/* ── Helpers monogramme / couleur stable ───────────────────────────────── */

const STOP = new Set([
  'de', 'du', 'des', 'la', 'le', 'et', '&', 'cie', 'capital', 'finance', 'securities',
  'bourse', 'investment', 'corporation', 'management', 'financière',
]);
function monogram(nom: string): string {
  const words = nom.replace(/&/g, ' ').split(/\s+/).filter(Boolean);
  if (/^[A-Z]{2,5}$/.test(words[0])) return words[0].slice(0, 4);
  const sig = words.filter((w) => !STOP.has(w.toLowerCase()));
  const pick = sig.length >= 1 ? sig : words;
  return ((pick[0][0] || '') + (pick[1] ? pick[1][0] : '')).toUpperCase();
}
const HUES = [188, 176, 166, 200, 210, 158];
function hueOf(nom: string): number {
  let h = 0;
  for (let i = 0; i < nom.length; i++) h = (h * 31 + nom.charCodeAt(i)) >>> 0;
  return HUES[h % HUES.length];
}

function flagUrl(code: keyof typeof PAYS): string {
  return `https://flagcdn.com/w80/${PAYS[code].iso}.png`;
}

/* ── Carte SGI ─────────────────────────────────────────────────────────── */

function SgiCard({ s }: { s: Sgi }) {
  const p = PAYS[s.pays];
  const h = hueOf(s.nom);
  const lien = s.ficheBRVM
    ? { href: s.ficheBRVM, label: 'Fiche BRVM' }
    : s.siteWeb
      ? { href: s.siteWeb, label: 'Site officiel' }
      : null;
  return (
    <article className="flex flex-col rounded-panel border border-border bg-surface/40 p-5 transition-all hover:-translate-y-0.5 hover:border-accent/35 hover:bg-elevated/60">
      <div className="mb-3.5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {/* Tuile : monogramme de repli dessous, logo (officiel ou placeholder) par-dessus.
              Si le fichier est absent/cassé, l'img se masque et le monogramme reste visible. */}
          <span
            className="relative h-11 w-11 flex-none overflow-hidden rounded-[11px] border"
            style={{ background: `hsl(${h},34%,13%)`, borderColor: `hsl(${h},42%,30%)`, color: `hsl(${h},60%,70%)` }}
          >
            <span className="absolute inset-0 grid place-items-center font-display text-sm font-bold" aria-hidden>
              {monogram(s.nom)}
            </span>
            {s.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={s.logo}
                alt={`Logo ${s.nom}`}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-[1.05rem] leading-tight text-ivory">{s.nom}</h3>
            <p className="mt-1 text-[12.5px] text-muted">{s.groupe}</p>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={flagUrl(s.pays)} alt={`Drapeau ${p.nom}`} loading="lazy" width={30} height={21} className="h-[21px] w-[30px] flex-none rounded-[3px] object-cover ring-1 ring-white/15" title={p.nom} />
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <span
          className={`rounded-md border px-2 py-1 font-mono text-[10.5px] uppercase tracking-wide ${
            s.type === 'Banque' ? 'border-accent/25 bg-accent/10 text-accent' : 'border-border bg-elevated/40 text-muted'
          }`}
        >
          {s.type}
        </span>
        <span className="rounded-md border border-border bg-surface/40 px-2 py-1 font-mono text-[10.5px] uppercase tracking-wide text-muted">
          {p.nom}
        </span>
      </div>

      <dl className="mt-auto grid gap-2.5 border-t border-border pt-3.5 text-[13.5px]">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-faint">Dépôt min.</dt>
          <dd className="tabular text-[12.5px] font-medium text-ivory/90">
            {s.depotMin}
            {s.depotMinSource !== 'inconnu' && (
              <>
                {' '}
                <span
                  className="ml-0.5 text-[10px] not-italic text-faint"
                  title={s.depotMinSource === 'relevé' ? 'Constaté, à reconfirmer auprès de la SGI' : 'Ordre de grandeur du marché'}
                >
                  {s.depotMinSource === 'relevé' ? 'relevé*' : 'indic.'}
                </span>
              </>
            )}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-faint">Courtage</dt>
          <dd className="tabular text-[12.5px] font-medium text-ivory/90">
            ≈ 1–1,5 % <span className="ml-0.5 text-[10px] not-italic text-faint">indic.</span>
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-faint">Ordre en ligne</dt>
          <dd className="tabular text-[12.5px] font-medium text-accent/80">à confirmer</dd>
        </div>
      </dl>

      {lien && (
        <a
          href={lien.href}
          rel="nofollow noopener"
          target="_blank"
          className="mt-3 inline-flex items-center gap-1.5 font-mono text-[11.5px] text-accent/80 transition-colors hover:text-accent"
        >
          {lien.label}
          <span aria-hidden>↗</span>
        </a>
      )}
    </article>
  );
}

/* ── Critères & FAQ (contenu statique) ─────────────────────────────────── */

const CRITERES: { n: string; t: string; d: string }[] = [
  { n: '01', t: 'Le coût réel', d: 'Comparez le courtage en pourcentage, mais aussi les frais fixes par ordre, les droits de garde annuels et les frais de virement. Pour de petits montants, un minimum de perception pèse souvent plus lourd que le taux affiché.' },
  { n: '02', t: "L'autonomie numérique", d: 'Pouvez-vous passer vos ordres en ligne ou via une application, ou faut-il téléphoner à chaque fois ? Si vous voulez gérer seul, exigez une démonstration de la plateforme avant de signer.' },
  { n: '03', t: "L'accès depuis l'étranger", d: "Diaspora ou hors UEMOA : vérifiez que la SGI accepte les dossiers à distance et sait gérer les virements internationaux. L'essentiel de la place se concentre en Côte d'Ivoire." },
  { n: '04', t: 'Le conseil et la réactivité', d: "Un débutant gagne à choisir une équipe pédagogue et joignable. Testez le service client avant d'ouvrir : posez deux questions précises et jugez la qualité des réponses." },
  { n: '05', t: "La solidité et l'adossement", d: "Une SGI adossée à un grand groupe bancaire offre un réseau d'agences ; une maison indépendante peut être plus souple et spécialisée. Cela dépend de votre profil." },
  { n: '06', t: 'Le dépôt minimum', d: "Le ticket d'entrée va de quelques dizaines de milliers à plus d'un million de FCFA. Choisissez une SGI dont le seuil correspond au capital que vous comptez réellement engager." },
];

const FAQ: { q: string; r: string; open?: boolean }[] = [
  { q: 'Faut-il vraiment passer par une SGI ?', r: "Oui, sans exception. La réglementation du marché régional réserve l'accès à la cote aux intermédiaires agréés. Un particulier ne peut ni acheter ni vendre une action de la BRVM en direct : il doit obligatoirement ouvrir un compte chez une SGI, qui transmet et exécute ses ordres.", open: true },
  { q: "Combien coûte l'ouverture et la tenue d'un compte ?", r: "L'ouverture d'un compte-titres est le plus souvent gratuite. Le dépôt de départ se situe généralement entre 100 000 et 1 000 000 FCFA. À chaque transaction s'applique un courtage de l'ordre de 1 à 1,5 %. Des droits de garde annuels peuvent s'ajouter : demandez toujours le barème complet par écrit." },
  { q: 'Puis-je choisir une SGI dans un autre pays que le mien ?', r: "Oui. La BRVM est un marché régional unifié couvrant les huit pays de l'UEMOA. Vous pouvez ouvrir un compte chez n'importe quelle SGI agréée, y compris hors de votre pays de résidence, dès lors qu'elle accepte votre dossier." },
  { q: 'Quel délai et quels documents pour ouvrir le compte ?', r: "Comptez en général une à deux semaines entre le dépôt du dossier et l'activation. Prévoyez une pièce d'identité valide, un justificatif de domicile, un justificatif de revenus ou d'origine des fonds, et un RIB." },
  { q: 'Pourrai-je passer mes ordres en ligne ?', r: "Cela dépend de la SGI. Certaines proposent une plateforme web ou une application mobile ; d'autres fonctionnent encore par téléphone ou e-mail. Si l'autonomie compte pour vous, vérifiez ce point — et demandez une démonstration — avant de vous engager." },
  { q: 'Existe-t-il une « meilleure » SGI ?', r: "Non, il n'y a pas de classement universel. La SGI idéale dépend de votre profil : petits ordres → frais bas et pédagogie ; investisseur actif → plateforme rapide ; non-résident → gestion à distance. Servez-vous des six critères pour trancher selon vos besoins." },
];

/* ── Section principale ────────────────────────────────────────────────── */

export default function SgiComparator({
  className = 'scroll-mt-24',
  directory,
  frais,
}: {
  className?: string;
  /** Annuaire depuis Supabase (repli sur le TS si non fourni). */
  directory?: Sgi[];
  /** Barèmes depuis Supabase (repli sur le TS si non fourni). */
  frais?: SgiFrais[];
}) {
  const SGI = directory ?? SGI_DIRECTORY;
  const [filtreP, setFiltreP] = useState<'ALL' | keyof typeof PAYS>('ALL');
  const [recherche, setRecherche] = useState('');

  const list = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return SGI.filter((s) => {
      const okP = filtreP === 'ALL' || s.pays === filtreP;
      const okQ = !q || s.nom.toLowerCase().includes(q) || s.groupe.toLowerCase().includes(q);
      return okP && okQ;
    }).sort((a, b) => (a.pays === b.pays ? a.nom.localeCompare(b.nom) : a.pays.localeCompare(b.pays)));
  }, [SGI, filtreP, recherche]);

  const chips: ('ALL' | keyof typeof PAYS)[] = ['ALL', ...(Object.keys(PAYS) as (keyof typeof PAYS)[])];

  return (
    <section id="comparateur-sgi" className={className}>
      {/* En-tête */}
      <p className="overline mb-3 text-gold-2">Comparateur · BRVM / UEMOA</p>
      <h2 className="mb-3 max-w-[18ch] font-display text-2xl text-ivory md:text-3xl [letter-spacing:-0.03em]">
        Choisir sa SGI, sans <span className="text-accent">improviser</span>.
      </h2>
      <p className="mb-6 max-w-[64ch] text-sm leading-relaxed text-muted">
        Pour acheter ou vendre une action à la BRVM, une seule porte d&apos;entrée : une SGI agréée. Voici l&apos;annuaire
        complet, classé par pays, avec les critères pour décider sur des faits — pas sur une réputation.
      </p>

      {/* Repères chiffrés */}
      <dl className="mb-2 flex flex-wrap gap-x-10 gap-y-4 border-t border-border pt-5">
        {[
          ['8', "pays de l'UEMOA"],
          [`${SGI.length}`, 'SGI référencées'],
          ['1', 'marché unifié'],
        ].map(([num, lab]) => (
          <div key={lab} className="min-w-[88px]">
            <dt className="font-display text-3xl leading-none text-ivory">{num}</dt>
            <dd className="mt-2 font-mono text-[11px] uppercase tracking-wide text-faint">{lab}</dd>
          </div>
        ))}
      </dl>

      {/* Rôle de la SGI */}
      <div className="grid grid-cols-1 gap-6 rounded-panel border border-border bg-surface/40 p-6 md:grid-cols-[1.45fr_1fr] md:items-center md:p-8">
        <div>
          <p className="overline mb-2 text-gold-2">Le rôle de la SGI</p>
          <h3 className="mb-3 font-display text-xl text-ivory">Votre intermédiaire obligatoire</h3>
          <p className="mb-3 text-sm leading-relaxed text-muted">
            Une SGI — Société de Gestion et d&apos;Intermédiation — est un courtier agréé par le régulateur régional
            (le CREPMF). Aucun particulier ne passe d&apos;ordre directement sur la cote : tout achat et toute vente
            transitent par une SGI, qui ouvre votre compte-titres, exécute vos ordres et conserve vos valeurs.
          </p>
          <p className="text-sm leading-relaxed text-muted">
            La BRVM étant un marché régional unique, vous n&apos;êtes pas tenu de choisir une SGI dans votre pays de
            résidence. Le critère décisif n&apos;est pas la géographie, mais la qualité du service et les conditions.
          </p>
        </div>
        <ol className="flex flex-col">
          {[
            ['01', 'Vous', ' ouvrez un compte-titres chez une SGI.'],
            ['02', 'La SGI', ' transmet et exécute votre ordre sur la BRVM.'],
            ['03', 'Le dépositaire', ' règle, livre et conserve vos titres.'],
          ].map(([n, b, t]) => (
            <li key={n} className="flex items-start gap-4 border-b border-border py-3.5 last:border-0">
              <span className="w-6 flex-none font-mono text-[13px] text-accent">{n}</span>
              <span className="text-[14.5px] text-muted">
                <b className="font-semibold text-ivory">{b}</b>
                {t}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* Calculateur de coût réel — mis en avant juste après le rôle de la
          SGI (avant : plus bas, après l'annuaire et les 6 critères) */}
      <div className="mt-8">
        <p className="overline mb-2 text-gold-2">Calculer le coût réel</p>
        <h3 className="mb-1 font-display text-xl text-ivory">Combien coûterait votre investissement ?</h3>
        <p className="mb-5 max-w-[64ch] text-sm leading-relaxed text-muted">
          Comparez le coût total (courtage, frais réglementaires, droits de garde, tenue de compte) entre plusieurs
          SGI pour un montant donné. Les champs sont pré-remplis avec des données agrégées de sources publiques,
          modifiables et badgées selon leur niveau de confiance.
        </p>
        <CalculateurCout frais={frais} directory={directory} />
      </div>

      {/* Annuaire : filtres + recherche */}
      <div className="mt-8">
        <p className="overline mb-2 text-gold-2">L&apos;annuaire</p>
        <h3 className="mb-4 font-display text-xl text-ivory">Les SGI par pays</h3>

        <label className="mb-4 flex max-w-sm items-center gap-2.5 rounded-xl border border-border bg-surface/40 px-3.5 focus-within:border-accent/40 focus-within:ring-2 focus-within:ring-accent/15">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-none text-faint" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher une SGI…"
            aria-label="Rechercher une SGI par nom"
            className="w-full bg-transparent py-2.5 text-[15px] text-ivory outline-none placeholder:text-faint"
          />
        </label>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par pays">
          {chips.map((code) => {
            const pressed = filtreP === code;
            const n = code === 'ALL' ? SGI.length : SGI.filter((s) => s.pays === code).length;
            return (
              <button
                key={code}
                type="button"
                aria-pressed={pressed}
                onClick={() => setFiltreP(code)}
                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 font-mono text-[12.5px] font-medium transition-all ${
                  pressed
                    ? 'border-accent bg-accent text-[#03222b] shadow-[0_0_18px_rgba(86,215,253,0.35)]'
                    : 'border-border bg-surface/40 text-muted hover:border-accent/40 hover:text-ivory'
                }`}
              >
                {code === 'ALL' ? (
                  <span aria-hidden>🌍</span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={flagUrl(code)} alt="" width={18} height={13} className="h-[13px] w-[18px] rounded-[2px] object-cover" />
                )}
                {code === 'ALL' ? 'Tous' : PAYS[code].nom}
                <span className={pressed ? 'opacity-85' : 'opacity-55'}>{n}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 font-mono text-[12.5px] text-faint">
          <span>{list.length > 1 ? `${list.length} SGI affichées` : `${list.length} SGI affichée`}</span>
          <span>
            Ouverture souvent gratuite · Dépôt min. ≈ 100 k–1 M FCFA · Courtage ≈ 1–1,5 %{' '}
            <span className="text-accent/80">(indicatif)</span>
          </span>
        </div>

        {/* Grille de cartes */}
        {list.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((s) => (
              <SgiCard key={s.nom} s={s} />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-panel border border-dashed border-border px-5 py-14 text-center font-mono text-sm text-faint">
            Aucune SGI ne correspond à votre recherche.
          </div>
        )}

        {/* Note */}
        <div className="mt-7 rounded-xl border border-border border-l-2 border-l-accent bg-surface/40 px-5 py-4 text-[14.5px] leading-relaxed text-muted">
          <b className="text-ivory">Liste non exhaustive et données indicatives.</b> Cet annuaire reprend les
          principales SGI agréées à la BRVM à partir de sources publiques. Les dépôts marqués{' '}
          <span className="font-mono text-[12px] text-faint">indic.</span> sont des ordres de grandeur par profil de
          SGI ; ceux marqués <span className="font-mono text-[12px] text-faint">relevé*</span> ont été constatés mais
          restent à reconfirmer. Aucun n&apos;est un barème officiel. Pour la liste à jour et les barèmes
          précis, consultez{' '}
          <a href="https://www.brvm.org/fr/intervenants/sgi/tous" rel="nofollow noopener" target="_blank" className="text-accent hover:underline">
            brvm.org
          </a>{' '}
          et{' '}
          <a href="https://apsgi.org/liste-des-sgi/" rel="nofollow noopener" target="_blank" className="text-accent hover:underline">
            apsgi.org
          </a>
          , puis confirmez directement auprès de la SGI.
        </div>
      </div>

      {/* Six critères */}
      <div className="mt-12">
        <p className="overline mb-2 text-gold-2">Méthode</p>
        <h3 className="mb-1 font-display text-xl text-ivory">Six critères pour décider</h3>
        <p className="mb-5 max-w-[64ch] text-sm leading-relaxed text-muted">
          Au-delà du nom, ce sont ces points qui font la différence à l&apos;usage. Posez-les en questions directes à
          chaque SGI que vous contactez.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {CRITERES.map((c) => (
            <div key={c.n} className="flex gap-4 rounded-2xl border border-border bg-surface/40 p-5">
              <span className="flex-none font-mono text-[14px] text-accent">{c.n}</span>
              <div>
                <h4 className="mb-1.5 font-display text-[1.1rem] text-ivory">{c.t}</h4>
                <p className="text-[14.5px] leading-relaxed text-muted">{c.d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="mt-12">
        <p className="overline mb-2 text-gold-2">Questions fréquentes</p>
        <h3 className="mb-4 font-display text-xl text-ivory">Avant d&apos;ouvrir un compte</h3>
        <div className="border-t border-border">
          {FAQ.map((f) => (
            <details key={f.q} open={f.open} className="group border-b border-border">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-display text-[1.15rem] text-ivory marker:hidden">
                {f.q}
                <span className="font-mono text-xl text-accent transition-transform group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="max-w-[74ch] pb-5 text-[14.5px] leading-relaxed text-muted">{f.r}</p>
            </details>
          ))}
        </div>
      </div>

      {/* Outil associé : simulateur de budget */}
      <a
        href="/simulateur-budget"
        className="mt-12 flex flex-col items-start justify-between gap-4 rounded-2xl border border-accent/25 bg-accent/[0.05] p-6 transition-colors hover:border-accent/45 sm:flex-row sm:items-center"
      >
        <div>
          <p className="overline mb-1.5 text-gold-2">Outil associé</p>
          <h3 className="mb-1.5 font-display text-xl text-ivory">Que faire de votre budget ?</h3>
          <p className="max-w-[60ch] text-[14px] leading-relaxed text-muted">
            Une fois votre SGI choisie, entrez votre montant et vos frais de courtage : le simulateur compose trois
            portefeuilles BRVM (dividende, croissance, équilibré) à partir des cours réels.
          </p>
        </div>
        <span className="flex-none font-mono text-[13px] text-accent">Ouvrir le simulateur →</span>
      </a>
    </section>
  );
}
