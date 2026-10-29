/**
 * Rendu d'un décryptage (gabarit « Décryptage Sonatel », 2026-10-29). Lit
 * UNIQUEMENT `DecryptageDonnees` : produire le décryptage d'une autre valeur
 * ne demande que d'autres données, jamais un autre composant.
 *
 * Statuts en badges texte (pas d'emoji), chiffres en `.tabular`, liens
 * externes en nouvel onglet, tableaux défilables sur mobile.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import type { Badge, DecryptageDonnees, EntreeDatee, Stat, Ton } from '@/lib/articles/decryptage';
import type { Source } from '@/lib/articles/decryptageEditorial';
import { DividendChart, MultiplesChart, PriceChart, ProfitabilityChart, ResultsChart } from './Graphiques';

const TON_TEXTE: Record<Exclude<Ton, null>, string> = { up: 'text-up', down: 'text-down', warn: 'text-warn' };
const TON_PASTILLE: Record<Exclude<Ton, null>, string> = { up: 'bg-up', down: 'bg-down', warn: 'bg-warn' };
const BADGE: Record<Badge, string> = {
  Tenu: 'bg-up/[0.14] text-up',
  Favorable: 'bg-up/[0.14] text-up',
  Neutre: 'bg-warn/[0.14] text-warn',
  'Non tenu': 'bg-down/[0.14] text-down',
  Défavorable: 'bg-down/[0.14] text-down',
  'Non mesurable': 'bg-faint/[0.14] text-faint',
  'Sans objet': 'bg-faint/[0.14] text-faint',
};

const carte = 'rounded-xl border border-border bg-surface';
const externe = { target: '_blank', rel: 'noopener noreferrer' } as const;
const fr = (x: number | null, d: number) =>
  x == null ? '—' : new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).format(x);

export function StatutBadge({ statut }: { statut: Badge }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE[statut]}`}>{statut}</span>;
}

function Section({ id, titre, intro, children }: { id: string; titre: string; intro?: string | null; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
      <h2 className="font-display text-[clamp(1.375rem,2.4vw,1.75rem)] font-medium leading-tight text-white">{titre}</h2>
      {intro ? <p className="max-w-3xl text-base leading-relaxed text-muted">{intro}</p> : null}
      {children}
    </section>
  );
}

function Figure({ titre, sous, label, children }: { titre: string; sous: string; label: string; children: ReactNode }) {
  return (
    <figure className={`${carte} min-w-0 p-4`}>
      <figcaption className="mb-3">
        <p className="text-base font-medium text-ivory">{titre}</p>
        <p className="text-sm text-faint">{sous}</p>
      </figcaption>
      <div role="img" aria-label={label}>
        {children}
      </div>
    </figure>
  );
}

function Tableau({ tete, droite = [], children }: { tete: string[]; droite?: number[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-surface">
            {tete.map((t, i) => (
              <th key={t} scope="col" className={`px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-faint ${droite.includes(i) ? 'text-right' : ''}`}>
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
const td = 'border-b border-border/50 px-3 py-2.5 align-top';
const tdNum = `${td} tabular whitespace-nowrap text-right text-ivory`;

function StatsBar({ stats }: { stats: Stat[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className={`${carte} p-4`}>
          <dt className="text-xs uppercase tracking-wide text-faint">{s.label}</dt>
          <dd className="tabular mt-1 text-[clamp(1.25rem,2.2vw,1.5rem)] text-white">{s.valeur}</dd>
          {s.sous ? <dd className={`tabular mt-1 text-xs ${s.ton ? TON_TEXTE[s.ton] : 'text-muted'}`}>{s.sous}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

function Hero({ d }: { d: DecryptageDonnees }) {
  return (
    <header className="space-y-5">
      <p className="tabular text-xs uppercase tracking-[0.14em] text-accent">{d.kicker}</p>
      <h1 className="font-display text-[clamp(1.875rem,4.4vw,3rem)] font-medium leading-[1.1] text-white">{d.titre}</h1>
      <p className="max-w-3xl text-[clamp(1rem,1.6vw,1.125rem)] leading-relaxed text-ivory">{d.chapo}</p>
      <StatsBar stats={d.stats} />
    </header>
  );
}

function Sommaire({ d }: { d: DecryptageDonnees }) {
  const liens: [string, string, boolean][] = [
    ['piliers', 'Piliers', true],
    ['valorisation', 'Valorisation', !!d.comparables],
    ['resultats', 'Résultats', !!d.resultats],
    ['dividende', 'Dividende', !!d.dividende],
    ['risques', 'Risques', d.risques.length > 0],
    ['calendrier', 'Calendrier', d.journal.length + d.catalyseurs.length > 0],
    ['sources', 'Sources', true],
  ];
  return (
    <nav aria-label="Sommaire" className="flex flex-wrap gap-2">
      {liens
        .filter(([, , ok]) => ok)
        .map(([id, l]) => (
          <a key={id} href={`#${id}`} className="rounded-full border border-border px-3 py-1 text-sm text-muted hover:border-accent hover:text-accent">
            {l}
          </a>
        ))}
    </nav>
  );
}

function VerdictCards({ verdict }: { verdict: DecryptageDonnees['verdict'] }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {verdict.map((v) => (
        <article key={v.titre} className={`${carte} p-4`}>
          <h3 className={`flex items-center gap-2 text-base font-medium ${v.ton ? TON_TEXTE[v.ton] : 'text-ivory'}`}>
            <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${v.ton ? TON_PASTILLE[v.ton] : 'bg-faint'}`} />
            {v.titre}
          </h3>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">{v.texte}</p>
        </article>
      ))}
    </div>
  );
}

function Jauge({ valeur }: { valeur: number | null }) {
  if (valeur == null) return <span className="text-faint">—</span>;
  return (
    <span
      className="block h-1.5 w-full min-w-[96px] overflow-hidden rounded-full bg-border"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={valeur}
      aria-label="Marge de sécurité"
    >
      <span className="block h-full rounded-full bg-accent" style={{ width: `${valeur}%` }} />
    </span>
  );
}

function PillarsTable({ p }: { p: DecryptageDonnees['piliers'] }) {
  return (
    <>
      <Tableau tete={['Pilier', 'Valeur', 'Seuil', 'Marge de sécurité', 'Tendance', 'Statut']} droite={[1]}>
        {p.lignes.map((l) => (
          <tr key={l.libelle}>
            <th scope="row" className={`${td} font-medium text-ivory`}>
              {l.libelle}
            </th>
            <td className={tdNum}>{l.valeur}</td>
            <td className={`${td} tabular whitespace-nowrap text-muted`}>{l.seuil}</td>
            <td className={`${td} w-[30%]`}>
              <Jauge valeur={l.jauge} />
              <span className="mt-1.5 block text-xs text-faint">{l.legende}</span>
            </td>
            <td className={`${td} text-muted`}>{l.tendance}</td>
            <td className={td}>
              <StatutBadge statut={l.statut} />
            </td>
          </tr>
        ))}
      </Tableau>
      <p className="text-sm leading-relaxed text-faint">{p.note}</p>
    </>
  );
}

function VigilanceBox({ v }: { v: NonNullable<DecryptageDonnees['vigilance']> }) {
  return (
    <aside className="flex flex-col gap-4 rounded-xl border border-warn/60 bg-surface p-5 md:flex-row md:items-center">
      <div className="flex-1 space-y-2">
        <h3 className="text-base font-medium text-warn">{v.titre}</h3>
        <p className="text-[15px] leading-relaxed text-muted">{v.texte}</p>
      </div>
      <p className="tabular text-[clamp(2rem,5vw,3rem)] leading-none text-warn">{v.chiffre}</p>
    </aside>
  );
}

function ComparablesTable({ c, nom }: { c: NonNullable<DecryptageDonnees['comparables']>; nom: string }) {
  return (
    <Tableau tete={['Indicateur', nom, 'Médiane', 'Lecture', 'Précision']} droite={[1, 2]}>
      {c.lignes.map((l) => (
        <tr key={l.indicateur}>
          <th scope="row" className={`${td} font-medium text-ivory`}>
            {l.indicateur}
          </th>
          <td className={tdNum}>{l.valeur}</td>
          <td className={`${tdNum} text-muted`}>{l.mediane}</td>
          <td className={td}>{l.lecture ? <StatutBadge statut={l.lecture} /> : <span className="text-faint">—</span>}</td>
          <td className={`${td} text-sm text-faint`}>{l.precision}</td>
        </tr>
      ))}
    </Tableau>
  );
}

function Paragraphes({ items }: { items: { titre: string; texte: string }[] }) {
  return (
    <div className="space-y-4">
      {items.map((p) => (
        <div key={p.titre} className="max-w-3xl">
          <h3 className="text-lg font-medium text-ivory">{p.titre}</h3>
          <p className="mt-1 text-base leading-relaxed text-muted">{p.texte}</p>
        </div>
      ))}
    </div>
  );
}

function LienSource({ s }: { s: Source }) {
  return (
    <a href={s.url} {...externe} className="text-accent underline-offset-2 hover:underline">
      {s.label}
    </a>
  );
}

function RiskGrid({ risques }: { risques: DecryptageDonnees['risques'] }) {
  return (
    <div className="grid gap-3 min-[820px]:grid-cols-2">
      {risques.map((r, i) => (
        <article key={r.titre} className={`${carte} p-4`}>
          <h3 className="flex items-baseline gap-2 text-base font-medium text-ivory">
            <span className="tabular text-xs text-faint">{String(i + 1).padStart(2, '0')}</span>
            {r.titre}
          </h3>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">{r.texte}</p>
          {r.sources.length ? (
            <p className="mt-2 text-xs text-faint">
              Source{r.sources.length > 1 ? 's' : ''} :{' '}
              {r.sources.map((s, k) => (
                <span key={s.url}>
                  {k > 0 ? ' ; ' : ''}
                  <LienSource s={s} />
                </span>
              ))}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function InvalidationTable({ inv }: { inv: DecryptageDonnees['invalidation'] }) {
  return (
    <Tableau tete={['Indicateur', 'Aujourd’hui', 'Thèse invalidée si', 'Origine']} droite={[1]}>
      {inv.lignes.map((l) => (
        <tr key={l.indicateur}>
          <th scope="row" className={`${td} font-medium text-ivory`}>
            {l.indicateur}
          </th>
          <td className={tdNum}>{l.aujourdhui}</td>
          <td className={`${td} text-muted`}>{l.invalidee_si}</td>
          <td className={`${td} text-sm ${l.origine === 'Seuil indicatif' ? 'text-warn' : 'text-faint'}`}>{l.origine}</td>
        </tr>
      ))}
    </Tableau>
  );
}

function Timeline({ titre, entrees, vide }: { titre: string; entrees: EntreeDatee[]; vide: string }) {
  return (
    <div className="min-w-0 space-y-3">
      <h3 className="text-lg font-medium text-ivory">{titre}</h3>
      {entrees.length === 0 ? (
        <p className="text-sm text-faint">{vide}</p>
      ) : (
        <ol className="space-y-4 border-l border-border pl-4">
          {entrees.map((e) => (
            <li key={`${e.date}-${e.titre}`} className="grid grid-cols-[5.5rem_1fr] gap-3">
              <span className="tabular pt-0.5 text-xs text-accent">{e.date}</span>
              <div className="min-w-0">
                <p className="text-[15px] font-medium text-ivory">
                  {e.lien ? (
                    e.lien.startsWith('/') ? (
                      <Link href={e.lien} className="hover:text-accent hover:underline">
                        {e.titre}
                      </Link>
                    ) : (
                      <a href={e.lien} {...externe} className="hover:text-accent hover:underline">
                        {e.titre}
                      </a>
                    )
                  ) : (
                    e.titre
                  )}
                  {e.indicatif ? <span className="ml-2 rounded-full bg-warn/[0.14] px-2 py-0.5 text-xs font-normal text-warn">Indicatif</span> : null}
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted">{e.texte}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function DecryptageVue({ d }: { d: DecryptageDonnees }) {
  const c = d.comparables;
  return (
    <div className="space-y-12 text-base">
      <Hero d={d} />
      <Sommaire d={d} />

      {d.verdict.length ? (
        <Section id="lecture" titre="Lecture en 30 secondes">
          <VerdictCards verdict={d.verdict} />
        </Section>
      ) : null}

      <Section id="piliers" titre={`Les ${d.piliers.lignes.length} piliers de la thèse, avec leur marge de sécurité`} intro={d.piliers.intro}>
        <PillarsTable p={d.piliers} />
        {d.vigilance ? <VigilanceBox v={d.vigilance} /> : null}
      </Section>

      {c ? (
        <Section id="valorisation" titre="Valorisation et rentabilité face aux comparables" intro={c.intro}>
          <div className="grid gap-3 min-[820px]:grid-cols-2">
            {c.multiples.length ? (
              <Figure
                titre="Multiples de valorisation"
                sous={`${d.nom} contre la médiane BRVM`}
                label={`Multiples de ${d.nom} contre la médiane : ${c.multiples.map((b) => `${b.indicateur} ${fr(b.valeur, 2)} contre ${fr(b.mediane, 2)}`).join(', ')}.`}
              >
                <MultiplesChart data={c.multiples} nom={d.nom} />
              </Figure>
            ) : null}
            {c.rentabilite.length ? (
              <Figure
                titre="Rentabilité et croissance"
                sous="En %, contre la médiane BRVM"
                label={`Rentabilité de ${d.nom} contre la médiane : ${c.rentabilite.map((b) => `${b.indicateur} ${fr(b.valeur, 1)} % contre ${fr(b.mediane, 1)} %`).join(', ')}.`}
              >
                <ProfitabilityChart data={c.rentabilite} nom={d.nom} />
              </Figure>
            ) : null}
          </div>
          <ComparablesTable c={c} nom={d.nom} />
          {c.note ? <p className="text-sm leading-relaxed text-faint">{c.note}</p> : null}
        </Section>
      ) : null}

      {d.resultats ? (
        <Section id="resultats" titre={`Résultats ${d.resultats.serie[0].exercice}-${d.resultats.serie[d.resultats.serie.length - 1].exercice}`}>
          <Figure
            titre="Chiffre d’affaires, résultat net et marge nette"
            sous="Milliards de FCFA (axe gauche), marge nette en % (axe droit)"
            label={`Chiffre d’affaires et résultat net par exercice : ${d.resultats.serie.map((p) => `${p.exercice} : ${fr(p.ca, 1)} et ${fr(p.rn, 2)} milliards, marge ${fr(p.marge, 1)} %`).join(' ; ')}.`}
          >
            <ResultsChart serie={d.resultats.serie} />
          </Figure>
          <StatsBar stats={d.resultats.kpis} />
          <Paragraphes items={d.resultats.paragraphes} />
        </Section>
      ) : null}

      {d.dividende ? (
        <Section id="dividende" titre="Dividende">
          <Figure
            titre="Dividende par action"
            sous="F CFA (axe gauche), variation annuelle en % (axe droit)"
            label={`Dividende par action : ${d.dividende.serie.map((p) => `${p.exercice} : ${fr(p.montant, p.montant % 1 ? 1 : 0)} F${p.variation != null ? ` (${fr(p.variation, 1)} %)` : ''}`).join(' ; ')}.`}
          >
            <DividendChart serie={d.dividende.serie} />
          </Figure>
          <Paragraphes items={d.dividende.precisions} />
          {d.dividende.lien ? (
            <p className="text-sm">
              <LienSource s={d.dividende.lien} />
            </p>
          ) : null}
        </Section>
      ) : null}

      {d.cours ? (
        <Section id="seances" titre={d.cours.titre} intro={d.cours.intro}>
          <Figure titre="Cours de clôture" sous="F CFA par séance" label={`Cours de clôture : ${d.cours.serie.map((p) => `${p.date} : ${fr(p.cours, 0)} F`).join(' ; ')}.`}>
            <PriceChart serie={d.cours.serie} />
          </Figure>
          {d.cours.note ? <p className="text-xs text-faint">{d.cours.note}</p> : null}
          <ul className="tabular list-disc space-y-1 pl-5 text-[15px] text-muted">
            {d.cours.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          {d.cours.conclusion ? <p className="max-w-3xl text-base text-muted">{d.cours.conclusion}</p> : null}
        </Section>
      ) : null}

      {d.risques.length ? (
        <Section id="risques" titre="Ce qui fragilise la thèse">
          <RiskGrid risques={d.risques} />
        </Section>
      ) : null}

      {d.invalidation.lignes.length ? (
        <Section id="invalidation" titre="Ce qui invaliderait la thèse" intro={d.invalidation.intro}>
          <InvalidationTable inv={d.invalidation} />
        </Section>
      ) : null}

      <Section id="calendrier" titre="Journal et prochains rendez-vous">
        <div className="grid gap-8 min-[820px]:grid-cols-2">
          <Timeline titre="Journal récent" entrees={d.journal} vide="Aucun fait récent publié sur cette valeur." />
          <Timeline titre="Catalyseurs à surveiller" entrees={d.catalyseurs} vide="Aucun rendez-vous daté connu à ce jour." />
        </div>
      </Section>

      <Section id="sources" titre="Méthode et sources" intro={d.methode}>
        <ul className="space-y-1.5 text-sm">
          {d.sources.map((s) => (
            <li key={s.url}>
              <LienSource s={s} />
            </li>
          ))}
        </ul>
      </Section>

      <p className="border-t border-border pt-4 text-sm leading-relaxed text-faint">{d.avertissement}</p>
    </div>
  );
}
