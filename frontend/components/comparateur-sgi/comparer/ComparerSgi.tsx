'use client';

import Link from 'next/link';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { CheckCircle2, Plus, RotateCcw, Search, Trophy, X } from 'lucide-react';
import { baremeComplet, calculerCoutSGI, montantParOrdreParDefaut, type CoutSGIResult } from '@/lib/sgi-frais/calculateur';
import { PAYS, type Sgi } from '@/lib/sgi-frais/directory';
import { CONFIANCE_LABEL, lienDecision, type SgiFrais } from '@/lib/sgi-frais/types';
import { drapeau, slugSgi } from '@/lib/sgi-frais/identite';
import { DUREES_ANS, SCENARIO_DEFAUT, lienAvecScenario, lireScenario, type Scenario } from '@/lib/sgi-frais/scenario';
import { constatsComparaison, ecartALaMeilleure, fmtFcfa, meilleureLigne, type LigneComparee } from '@/lib/sgi-frais/comparaison';
import { ChiffreAnime } from '../ChiffreAnime';

const MAX = 3;
const EASE = [0.16, 1, 0.3, 1] as const;
const MONTANTS = [
  { v: 100_000, l: '100 k' },
  { v: 500_000, l: '500 k' },
  { v: 1_000_000, l: '1 M' },
  { v: 5_000_000, l: '5 M' },
];
const RYTHMES: [number, number][] = [[1, 0], [1, 1], [2, 2], [4, 4], [6, 6], [12, 12]];
const FREQ: Record<string, string> = { annuel: '/ an', trimestriel: '/ trimestre', semestriel: '/ semestre' };
const NR = 'Non renseigné';
/** Police à chasse fixe pour les chiffres seulement ; un libellé reste en texte courant. */
const chiffre = (v: string) => (/^\d/.test(v) ? 'tabular' : '');

const libDuree = (a: number) => (a < 1 ? `${Math.round(a * 12)} mois` : a === 1 ? '1 an' : `${a} ans`);
const pct = (n: number | null | undefined) => (n == null ? null : `${n.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} %`);

interface Colonne {
  slug: string;
  sgi: Sgi;
  frais: SgiFrais;
  cout: CoutSGIResult;
  ligne: LigneComparee;
}

/** Critères affichés : une donnée absente s'écrit « Non renseigné », jamais « 0 ». */
function valeurs(c: Colonne) {
  const f = c.frais;
  const courtage = f.courtagePaliers?.length ? 'Par tranche, selon l’ordre' : pct(f.courtagePctMax ?? f.courtagePctMin);
  const garde = f.gardePaliers?.length ? 'Par tranche, selon le portefeuille' : pct(f.droitsGardePctMax ?? f.droitsGardePctMin);
  const freqGarde = f.gardePaliers?.length ? '' : FREQ[f.droitsGardeFrequence ?? 'annuel'] ?? '';
  return {
    courtage: courtage ?? NR,
    garde: garde ? `${garde} ${freqGarde}`.trim() : NR,
    tenue:
      f.tenueCompteMontant == null
        ? NR
        : f.tenueCompteMontant === 0
          ? 'Aucune au barème'
          : `${fmtFcfa(f.tenueCompteMontant)} ${FREQ[f.tenueCompteFrequence ?? 'annuel'] ?? ''}`.trim(),
    depot: c.sgi.depotMin && c.sgi.depotMin !== NR ? c.sgi.depotMin : NR,
    bourseEnLigne: c.ligne.bourseEnLigne ? 'Au barème' : NR,
  };
}

const CRITERES: { cle: keyof ReturnType<typeof valeurs>; libelle: string }[] = [
  { cle: 'courtage', libelle: 'Courtage (max.)' },
  { cle: 'garde', libelle: 'Droits de garde' },
  { cle: 'tenue', libelle: 'Tenue de compte' },
  { cle: 'depot', libelle: 'Dépôt minimum' },
  { cle: 'bourseEnLigne', libelle: 'Bourse en ligne' },
];

function Logo({ sgi }: { sgi: Sgi }) {
  return (
    <span className="relative grid h-10 w-10 flex-none place-items-center overflow-hidden rounded-xl border border-border bg-elevated font-display text-xs font-bold text-accent">
      <span aria-hidden>{sgi.nom.slice(0, 2).toUpperCase()}</span>
      {sgi.logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sgi.logo}
          alt=""
          className="absolute inset-0 h-full w-full bg-white object-contain p-0.5"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      )}
    </span>
  );
}

function Drapeau({ pays }: { pays: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={drapeau(pays)} alt="" width={16} height={11} className="h-[11px] w-4 flex-none rounded-[2px]" />;
}

function Meilleur() {
  return (
    <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-up px-2.5 py-0.5 text-xs font-bold text-bg">
      <Trophy size={11} aria-hidden /> Meilleur coût
    </span>
  );
}

export function ComparerSgi({ directory, frais }: { directory: Sgi[]; frais: SgiFrais[] }) {
  const parNom = useMemo(() => new Map(frais.map((f) => [f.sgiNom, f])), [frais]);
  // Le coût ne se compare que là où un barème est connu.
  const candidates = useMemo(() => directory.filter((s) => parNom.has(s.nom)), [directory, parNom]);
  const parSlug = useMemo(() => new Map(candidates.map((s) => [slugSgi(s), s])), [candidates]);

  const [scenario, setScenario] = useState<Scenario>(SCENARIO_DEFAUT);
  const [choix, setChoix] = useState<string[] | null>(null);
  const montantParOrdre = scenario.montantParOrdre ?? montantParOrdreParDefaut(scenario.montant, scenario.nbAchats);

  const couts = useMemo(() => {
    const m = new Map<string, CoutSGIResult>();
    for (const s of candidates) {
      m.set(
        slugSgi(s),
        calculerCoutSGI(parNom.get(s.nom)!, {
          montant: scenario.montant,
          montantParOrdre,
          nbOrdres: scenario.nbAchats + scenario.nbVentes,
          dureeAns: scenario.dureeAns,
        }),
      );
    }
    return m;
  }, [candidates, parNom, scenario, montantParOrdre]);

  // Sans choix explicite : les 3 moins chères du scénario, barèmes complets seulement.
  const parDefaut = useMemo(
    () =>
      [...couts.entries()]
        .filter(([, c]) => baremeComplet(c))
        .sort((a, b) => a[1].total - b[1].total)
        .slice(0, MAX)
        .map(([s]) => s),
    [couts],
  );
  const selection = (choix ?? parDefaut).filter((s) => parSlug.has(s)).slice(0, MAX);

  // URL → état au montage, puis état → URL : lien partageable, sans stockage.
  const lu = useRef(false);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setScenario(lireScenario(p));
    const sgi = p.get('sgi');
    if (sgi) setChoix(sgi.split(',').filter(Boolean).slice(0, MAX));
    lu.current = true;
  }, []);
  useEffect(() => {
    if (!lu.current) return;
    window.history.replaceState(null, '', lienAvecScenario(window.location.pathname, scenario, choix ? { sgi: choix.join(',') } : undefined));
  }, [scenario, choix]);

  const colonnes: Colonne[] = selection.map((slug) => {
    const sgi = parSlug.get(slug)!;
    const f = parNom.get(sgi.nom)!;
    const cout = couts.get(slug)!;
    return {
      slug,
      sgi,
      frais: f,
      cout,
      ligne: {
        nom: sgi.nom,
        total: cout.total,
        complet: baremeComplet(cout),
        homologue: f.confiance === 'homologue_crepmf',
        depotMinimum: f.depotMinimum,
        bourseEnLigne: f.notes?.toLowerCase().includes('bourse en ligne') ?? false,
      },
    };
  });
  const meilleure = meilleureLigne(colonnes.map((c) => c.ligne));
  const constats = constatsComparaison(colonnes.map((c) => c.ligne));

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-5 rounded-panel border border-border bg-surface p-4 md:p-5 xl:grid-cols-[1fr_auto] xl:items-start">
          <div>
            <p className="mb-2 text-xs text-muted">
              SGI comparées <span className="tabular">({selection.length} / {MAX})</span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <AnimatePresence initial={false}>
                {colonnes.map((c) => (
                  <motion.span
                    key={c.slug}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2, ease: EASE }}
                    className="inline-flex min-h-[36px] items-center gap-2 rounded-full border border-accent/30 bg-accent/10 pl-3 pr-1 text-sm text-ivory"
                  >
                    <Drapeau pays={c.sgi.pays} />
                    {c.sgi.nom}
                    <button
                      type="button"
                      onClick={() => setChoix(selection.filter((s) => s !== c.slug))}
                      aria-label={`Retirer ${c.sgi.nom}`}
                      className="grid h-7 w-7 place-items-center rounded-full text-muted transition-colors hover:bg-accent/15 hover:text-ivory"
                    >
                      <X size={14} aria-hidden />
                    </button>
                  </motion.span>
                ))}
              </AnimatePresence>
              {selection.length < MAX && (
                <Ajout candidates={candidates.filter((s) => !selection.includes(slugSgi(s)))} onChoisir={(slug) => setChoix([...selection, slug].slice(0, MAX))} />
              )}
              {choix && (
                <button type="button" onClick={() => setChoix(null)} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 text-xs text-muted transition-colors hover:text-accent">
                  <RotateCcw size={13} aria-hidden /> Revenir aux 3 moins chères
                </button>
              )}
            </div>
          </div>
          <Reglages scenario={scenario} onChange={setScenario} />
        </div>

        {colonnes.length === 0 ? (
          <div className="rounded-panel border border-dashed border-border px-5 py-14 text-center text-sm text-muted">Ajoutez une SGI pour commencer la comparaison.</div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px] lg:items-start">
            <Tableau colonnes={colonnes} meilleure={meilleure} scenario={scenario} />
            <aside className="rounded-panel border border-border bg-surface p-5" aria-labelledby="titre-analyse">
              <h2 id="titre-analyse" className="mb-3 font-display text-lg text-ivory">
                Ce que révèle la comparaison
              </h2>
              <ul className="space-y-2.5">
                {constats.map((k) => (
                  <li key={k} className="flex gap-2 text-[13.5px] leading-relaxed text-muted">
                    <CheckCircle2 size={16} aria-hidden className="mt-0.5 flex-none text-up" />
                    {k}
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-border pt-3 text-[11px] leading-relaxed text-faint">
                Coûts hors taxes calculés sur les barèmes publiés : {fmtFcfa(scenario.montant)} sur {libDuree(scenario.dureeAns)}, {scenario.nbAchats} achat(s) et{' '}
                {scenario.nbVentes} vente(s), frais BRVM et DC/BR compris.
              </p>
            </aside>
          </div>
        )}
      </div>
    </MotionConfig>
  );
}

function Reglages({ scenario, onChange }: { scenario: Scenario; onChange: (s: Scenario) => void }) {
  const set = (p: Partial<Scenario>) => onChange({ ...scenario, ...p });
  const rythme = `${scenario.nbAchats}-${scenario.nbVentes}`;
  const rythmeConnu = RYTHMES.some(([a, v]) => a === scenario.nbAchats && v === scenario.nbVentes);
  return (
    <div className="flex flex-wrap items-end gap-3 text-xs text-muted">
      <fieldset>
        <legend className="mb-1.5">Montant investi</legend>
        <div className="flex flex-wrap gap-1">
          {MONTANTS.map((m) => (
            <button
              key={m.v}
              type="button"
              aria-pressed={scenario.montant === m.v}
              onClick={() => set({ montant: m.v, montantParOrdre: null })}
              className={`tabular min-h-[36px] rounded-full border px-3 font-medium transition-colors active:scale-95 ${
                scenario.montant === m.v ? 'border-nuit bg-nuit text-sur-nuit' : 'border-border text-muted hover:border-accent/40 hover:text-ivory'
              }`}
            >
              {m.l}
            </button>
          ))}
          {!MONTANTS.some((m) => m.v === scenario.montant) && (
            <span className="tabular inline-flex min-h-[36px] items-center rounded-full border border-nuit bg-nuit px-3 font-medium text-sur-nuit">{fmtFcfa(scenario.montant)}</span>
          )}
        </div>
      </fieldset>
      <label>
        <span className="mb-1.5 block">Durée</span>
        <select
          value={scenario.dureeAns}
          onChange={(e) => set({ dureeAns: Number(e.target.value) })}
          className="min-h-[36px] rounded-lg border border-border bg-surface px-2 text-sm text-ivory"
        >
          {DUREES_ANS.map((d) => (
            <option key={d} value={d}>
              {libDuree(d)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="mb-1.5 block">Achats / ventes</span>
        <select
          value={rythme}
          onChange={(e) => {
            const [a, v] = e.target.value.split('-').map(Number);
            set({ nbAchats: a!, nbVentes: v!, montantParOrdre: null });
          }}
          className="tabular min-h-[36px] rounded-lg border border-border bg-surface px-2 text-sm text-ivory"
        >
          {RYTHMES.map(([a, v]) => (
            <option key={`${a}-${v}`} value={`${a}-${v}`}>
              {a} / {v}
            </option>
          ))}
          {!rythmeConnu && (
            <option value={rythme}>
              {scenario.nbAchats} / {scenario.nbVentes}
            </option>
          )}
        </select>
      </label>
    </div>
  );
}

function Ajout({ candidates, onChoisir }: { candidates: Sgi[]; onChoisir: (slug: string) => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [q, setQ] = useState('');
  const [actif, setActif] = useState(0);
  const id = useId();
  const n = q.trim().toLowerCase();
  const liste = candidates.filter((s) => !n || s.nom.toLowerCase().includes(n) || (PAYS[s.pays]?.nom ?? '').toLowerCase().includes(n)).slice(0, 8);
  const choisir = (s: Sgi) => {
    onChoisir(slugSgi(s));
    setQ('');
    setOuvert(false);
  };

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-dashed border-accent/50 px-3 text-sm font-medium text-accent transition-colors hover:bg-accent/10 active:scale-95"
      >
        <Plus size={15} aria-hidden /> Ajouter une SGI
      </button>
    );
  }
  return (
    <div className="relative">
      <div className="flex min-h-[36px] w-[min(18rem,80vw)] items-center gap-2 rounded-full border border-accent/50 bg-surface px-3">
        <Search size={15} aria-hidden className="text-faint" />
        <input
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls={id}
          aria-autocomplete="list"
          aria-activedescendant={liste[actif] ? `${id}-${actif}` : undefined}
          aria-label="Rechercher une SGI à ajouter"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActif(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActif((a) => Math.min(a + 1, liste.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActif((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && liste[actif]) {
              e.preventDefault();
              choisir(liste[actif]!);
            } else if (e.key === 'Escape') {
              setOuvert(false);
            }
          }}
          onBlur={() => setTimeout(() => setOuvert(false), 150)}
          placeholder="Nom ou pays…"
          className="w-full bg-transparent text-sm text-ivory outline-none placeholder:text-faint"
        />
      </div>
      <ul id={id} role="listbox" className="absolute left-0 top-full z-30 mt-2 max-h-72 w-[min(20rem,85vw)] overflow-auto rounded-xl border border-border bg-elevated p-1 shadow-xl">
        {liste.length === 0 && <li className="px-3 py-2 text-sm text-muted">Aucune SGI ne correspond.</li>}
        {liste.map((s, i) => (
          <li
            key={s.nom}
            id={`${id}-${i}`}
            role="option"
            aria-selected={i === actif}
            onMouseDown={(e) => {
              e.preventDefault();
              choisir(s);
            }}
            onMouseEnter={() => setActif(i)}
            className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${i === actif ? 'bg-accent/10 text-ivory' : 'text-muted'}`}
          >
            <Drapeau pays={s.pays} />
            <span className="min-w-0 truncate">{s.nom}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Tableau({ colonnes, meilleure, scenario }: { colonnes: Colonne[]; meilleure: LigneComparee | null; scenario: Scenario }) {
  const fond = (c: Colonne) => (meilleure?.nom === c.sgi.nom ? 'bg-up/[0.06]' : '');
  return (
    <>
      {/* Tablette et bureau : colonnes côte à côte */}
      <div className="hidden overflow-x-auto rounded-panel border border-border bg-surface md:block">
        <table className="w-full min-w-[640px] table-fixed text-sm">
          <caption className="sr-only">Comparaison des SGI sélectionnées pour votre scénario</caption>
          <thead>
            <tr>
              <th scope="col" className="w-[160px] p-4 text-left align-bottom text-xs font-medium text-muted">
                Critères
              </th>
              {colonnes.map((c) => (
                <th key={c.slug} scope="col" className={`p-4 text-left align-top font-normal ${fond(c)}`}>
                  {meilleure?.nom === c.sgi.nom ? <Meilleur /> : meilleure && <span aria-hidden className="invisible block"><Meilleur /></span>}
                  <div className="flex items-center gap-2.5">
                    <Logo sgi={c.sgi} />
                    <div className="min-w-0">
                      <p className="font-display text-[15px] font-semibold leading-tight text-ivory">{c.sgi.nom}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
                        <Drapeau pays={c.sgi.pays} />
                        {PAYS[c.sgi.pays]?.nom}
                      </p>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border">
              <th scope="row" className="p-4 text-left text-xs font-medium text-muted">
                Coût total estimé
              </th>
              {colonnes.map((c) => {
                const top = meilleure?.nom === c.sgi.nom;
                const e = ecartALaMeilleure(c.ligne, meilleure);
                return (
                  <td key={c.slug} className={`p-4 ${fond(c)}`}>
                    <ChiffreAnime valeur={c.cout.total} format={fmtFcfa} className={`tabular block font-display text-xl font-bold ${top ? 'text-up' : 'text-ivory'}`} />
                    <span className={`tabular text-[11px] ${c.ligne.complet ? 'text-faint' : 'text-warn'}`}>
                      {!c.ligne.complet
                        ? 'Barème incomplet : sous-estimé'
                        : e
                          ? `+${fmtFcfa(e.montant)} (+${e.pct.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} %)`
                          : top
                            ? 'La moins chère de la sélection'
                            : ''}
                    </span>
                  </td>
                );
              })}
            </tr>
            {CRITERES.map((k) => (
              <tr key={k.cle} className="border-t border-border/70">
                <th scope="row" className="p-4 text-left text-xs font-medium text-muted">
                  {k.libelle}
                </th>
                {colonnes.map((c) => {
                  const v = valeurs(c)[k.cle];
                  return (
                    <td key={c.slug} className={`${chiffre(v)} p-4 ${v === NR ? 'text-faint' : 'text-ivory'} ${fond(c)}`}>
                      {v}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="border-t border-border/70">
              <th scope="row" className="p-4 text-left text-xs font-medium text-muted">
                Barème
              </th>
              {colonnes.map((c) => {
                const pdf = lienDecision(c.frais);
                return (
                  <td key={c.slug} className={`p-4 ${fond(c)}`}>
                    <span
                      className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                        c.ligne.homologue ? 'border-up/30 bg-up/5 text-up' : 'border-border text-muted'
                      }`}
                    >
                      {CONFIANCE_LABEL[c.frais.confiance]}
                    </span>
                    {pdf && (
                      <a href={pdf} target="_blank" rel="noopener noreferrer" className="mt-1.5 block text-[11px] text-accent hover:underline">
                        Décision officielle (PDF) ↗
                      </a>
                    )}
                  </td>
                );
              })}
            </tr>
            <tr className="border-t border-border/70">
              <th scope="row" className="p-4 text-left text-xs font-medium text-muted">
                Aller plus loin
              </th>
              {colonnes.map((c) => (
                <td key={c.slug} className={`p-4 ${fond(c)}`}>
                  <div className="flex flex-col gap-1.5 text-xs font-semibold">
                    <Link href={`/comparateur-sgi/annuaire/${c.slug}`} className="text-accent hover:underline">
                      Fiche de la SGI →
                    </Link>
                    <Link href={lienAvecScenario('/comparateur-sgi/simuler', scenario)} className="text-accent hover:underline">
                      Détail du calcul →
                    </Link>
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Mobile : une carte par SGI, le coût d'abord */}
      <ul className="space-y-3 md:hidden">
        <AnimatePresence initial={false}>
          {colonnes.map((c) => {
            const top = meilleure?.nom === c.sgi.nom;
            const e = ecartALaMeilleure(c.ligne, meilleure);
            const v = valeurs(c);
            const pdf = lienDecision(c.frais);
            return (
              <motion.li
                key={c.slug}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: EASE }}
                className={`rounded-panel border p-4 ${top ? 'border-up/40 bg-up/[0.06]' : 'border-border bg-surface'}`}
              >
                {top && <Meilleur />}
                <div className="flex items-center gap-2.5">
                  <Logo sgi={c.sgi} />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-[15px] font-semibold leading-tight text-ivory">{c.sgi.nom}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
                      <Drapeau pays={c.sgi.pays} />
                      {PAYS[c.sgi.pays]?.nom}
                    </p>
                  </div>
                  <div className="text-right">
                    <ChiffreAnime valeur={c.cout.total} format={fmtFcfa} className={`tabular block whitespace-nowrap font-display text-lg font-bold ${top ? 'text-up' : 'text-ivory'}`} />
                    {e && <span className="tabular text-[11px] text-faint">+{fmtFcfa(e.montant)}</span>}
                    {!c.ligne.complet && <span className="text-[11px] text-warn">Barème incomplet</span>}
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3 text-[12.5px]">
                  {CRITERES.map((k) => (
                    <div key={k.cle}>
                      <dt className="text-faint">{k.libelle}</dt>
                      <dd className={`${chiffre(v[k.cle])} ${v[k.cle] === NR ? 'text-faint' : 'text-ivory'}`}>{v[k.cle]}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold">
                  {pdf && (
                    <a href={pdf} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[32px] items-center text-accent">
                      Décision (PDF) ↗
                    </a>
                  )}
                  <Link href={`/comparateur-sgi/annuaire/${c.slug}`} className="inline-flex min-h-[32px] items-center text-accent">
                    Fiche de la SGI →
                  </Link>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </>
  );
}
