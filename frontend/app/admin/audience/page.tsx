import Link from 'next/link';
import type { ReactNode } from 'react';
import { requirePermission } from '@/lib/server/rbac';
import { PremiumPanel, SectionHeader, MetricCard } from '@/components/ui/premium';
import TendanceContinents from '@/components/admin/audience/TendanceContinents';
import { bornesPeriode, estPeriode, libelleFenetre, PERIODES_PAGE, type Periode } from '@/lib/audience/periodes';
import { chargerAudienceCache } from '@/lib/audience/indicateurs';
import { delta, fmtDelta, fmtDuree, pivoterTendance, sousTotalUemoa } from '@/lib/audience/lignes';
import { MENTION_COOKIES } from '@/lib/audience/resume';
import type { Bloc } from '@/lib/audience/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Audience — Administration' };

const n = (x: number) => Math.round(x).toLocaleString('fr-FR').replace(/[  ]/g, ' ');

function Section({ titre, note, children }: { titre: string; note?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg text-ivory">{titre}</h2>
      <PremiumPanel className="p-5">{children}</PremiumPanel>
      {note && <p className="text-xs text-faint">{note}</p>}
    </section>
  );
}
const Indispo = () => <p className="text-sm text-muted">Indisponible : PostHog n'a pas répondu pour ce bloc. Les autres blocs restent valides.</p>;
const Vide = ({ t }: { t: string }) => <p className="text-sm text-muted">{t}</p>;
function Tab({ cols, lignes }: { cols: string[]; lignes: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs text-faint">{cols.map((c, i) => <th key={c} className={`pb-2 font-medium ${i > 0 ? 'text-right' : ''}`}>{c}</th>)}</tr></thead>
        <tbody>{lignes.map((l, i) => <tr key={i} className="border-t border-border/60">{l.map((c, j) => <td key={j} className={`py-1.5 ${j > 0 ? 'tabular text-right' : 'text-ivory'}`}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
function avec<T>(b: Bloc<T>, rendu: (d: T) => ReactNode): ReactNode { return b.ok ? rendu(b.data) : <Indispo />; }

export default async function Page({ searchParams }: { searchParams: { periode?: string } }) {
  await requirePermission('crm.read');
  const periode: Periode = estPeriode(searchParams.periode) && (PERIODES_PAGE as readonly string[]).includes(searchParams.periode) ? searchParams.periode : '30j';
  const b = bornesPeriode(periode, new Date());
  const a = await chargerAudienceCache(periode, b);
  const prec = a.overviewPrecedent.ok ? a.overviewPrecedent.data : null;
  const kpi = (lib: string, v: number, p: number | undefined) => {
    const d = p === undefined ? null : delta(v, p);
    return <MetricCard key={lib} label={lib} value={n(v)} delta={d === null ? 'n/d vs période précédente' : `${fmtDelta(d)} vs période précédente`} deltaDir={d === null ? 'flat' : d > 0 ? 'up' : d < 0 ? 'down' : 'flat'} />;
  };
  const af = a.continents.ok ? a.continents.data.find((c) => c.code === 'AF') : undefined;
  const u = a.pays.ok ? sousTotalUemoa(a.pays.data) : null;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <SectionHeader
        kicker="Audience"
        title="Audience du site"
        subtitle={`${libelleFenetre(b)} — comparée à la période précédente de même durée. Source : PostHog (UE).`}
        actions={
          <div className="flex gap-1 text-sm" role="group" aria-label="Période">
            {PERIODES_PAGE.map((p) => (
              <Link key={p} href={`/admin/audience?periode=${p}`} aria-current={p === periode ? 'true' : undefined} className={`rounded-lg border px-3 py-1.5 ${p === periode ? 'border-accent bg-accent/10 text-accent' : 'border-border text-muted hover:text-ivory'}`}>{p}</Link>
            ))}
            <Link href="/admin/audience/rapport?periode=semaine" className="ml-2 rounded-lg border border-border px-3 py-1.5 text-muted hover:text-ivory">Rapport imprimable</Link>
          </div>
        }
      />

      <p className="rounded-lg border border-border bg-surface/60 px-4 py-3 text-sm text-muted">{MENTION_COOKIES}</p>

      {a.overview.ok ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {kpi('Personnes', a.overview.data.personnes, prec?.personnes)}
          {kpi('Sessions', a.overview.data.sessions, prec?.sessions)}
          {kpi('Pages vues', a.overview.data.pagesVues, prec?.pagesVues)}
          {kpi('Événements', a.overview.data.evenements, prec?.evenements)}
        </div>
      ) : <Indispo />}

      <Section titre="Afrique" note="Sous-total UEMOA = somme par pays (une personne vue depuis deux pays y compte deux fois). Localisation par IP côté PostHog, au niveau pays/ville.">
        {avec(a.continents, () => (
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <MetricCard label="Personnes en Afrique" value={af ? n(af.personnes) : '0'} accent="emerald" />
            <MetricCard label="Part des personnes mesurées" value={af && a.overview.ok && a.overview.data.personnes > 0 ? `${Math.min(100, Math.round((af.personnes / a.overview.data.personnes) * 100))} %` : 'n/d'} />
            <MetricCard label="Dont UEMOA" value={u ? n(u.personnes) : 'n/d'} unit={u ? `${u.pays} pays` : undefined} />
            <MetricCard label="Sessions en Afrique" value={af ? n(af.sessions) : '0'} />
          </div>
        ))}
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm text-muted">Pays</h3>
            {avec(a.pays, (p) => p.length === 0 ? <Vide t="Aucune visite africaine sur la période." /> : (
              <Tab cols={['Pays', 'Personnes', 'Sessions']} lignes={[
                ...p.map((x) => [`${x.nom}${x.uemoa ? ' · UEMOA' : ''}`, n(x.personnes), n(x.sessions)]),
                ...(u && u.pays > 0 ? [[<strong key="u">Sous-total UEMOA</strong>, <strong key="p">{n(u.personnes)}</strong>, <strong key="s">{n(u.sessions)}</strong>]] : []),
              ]} />
            ))}
          </div>
          <div>
            <h3 className="mb-2 text-sm text-muted">Villes</h3>
            {avec(a.villes, (v) => v.length === 0 ? <Vide t="Aucune ville renseignée." /> : <Tab cols={['Ville', 'Personnes']} lignes={v.map((x) => [`${x.ville} (${x.pays})`, n(x.personnes)])} />)}
          </div>
        </div>
      </Section>

      <Section titre="Continents">
        {avec(a.continents, (c) => c.length === 0 ? <Vide t="Aucune donnée." /> : (
          <Tab cols={['Continent', 'Personnes', 'Sessions']} lignes={c.map((x) => [x.nom, n(x.personnes), n(x.sessions)])} />
        ))}
      </Section>

      <Section titre="Tendance hebdomadaire par continent" note="Personnes distinctes par semaine (lundi), 12 semaines.">
        {avec(a.tendance, (t) => {
          const { donnees, continents } = pivoterTendance(t);
          return donnees.length === 0 ? <Vide t="Pas encore assez de données." /> : <TendanceContinents donnees={donnees} continents={continents} />;
        })}
      </Section>

      <Section titre="Sessions et durée">
        {avec(a.sessions, (s) => (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MetricCard label="Sessions" value={n(s.sessions)} />
            <MetricCard label="Durée médiane" value={fmtDuree(s.dureeMedianeS)} />
            <MetricCard label="Durée moyenne" value={fmtDuree(s.dureeMoyenneS)} />
            <MetricCard label="Pages par session" value={s.pagesParSession == null ? '—' : s.pagesParSession.toFixed(1).replace('.', ',')} />
          </div>
        ))}
      </Section>

      <Section titre="Appareils">
        {avec(a.appareils, (d) => d.length === 0 ? <Vide t="Aucune donnée." /> : <Tab cols={['Appareil', 'Personnes', 'Sessions']} lignes={d.map((x) => [x.type, n(x.personnes), n(x.sessions)])} />)}
      </Section>

      <Section titre="Pages les plus vues">
        {avec(a.pages, (p) => p.length === 0 ? <Vide t="Aucune page vue." /> : <Tab cols={['Page', 'Vues', 'Personnes']} lignes={p.map((x) => [x.chemin, n(x.vues), n(x.personnes)])} />)}
      </Section>

      <Section titre="Clics les plus fréquents" note="Libellés des éléments cliqués, tels que PostHog les capte (ex. « fermeture (✕) » : bouton de fermeture), sans interprétation.">
        {avec(a.clics, (c) => c.length === 0 ? <Vide t="Aucun clic capté." /> : <Tab cols={['Élément', 'Clics', 'Personnes']} lignes={c.map((x) => [x.libelle, n(x.clics), n(x.personnes)])} />)}
      </Section>

      <Section titre="Entonnoir Academy" note="Personnes distinctes ayant atteint chaque étape sur la période ; l'ordre des étapes n'est pas vérifié.">
        {avec(a.entonnoir, (e) => (
          <Tab cols={['Étape', 'Personnes']} lignes={[['Ont consulté la formation (/formations/academy…)', n(e.academy)], ['Ont ouvert une leçon', n(e.lecon)], ["Ont atteint l'inscription (/signup)", n(e.inscription)]]} />
        ))}
      </Section>

      <Section titre="Intérêt formation dans le CRM" note="Notre base : comptes connectés avec un signal « formation consultée » sur la période, répartis par pays du compte.">
        {avec(a.formationCrm, (f) => (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <MetricCard label="Comptes" value={n(f.comptes)} />
              <MetricCard label="En Afrique" value={n(f.afrique)} />
              <MetricCard label="Dont UEMOA" value={n(f.uemoa)} />
              <MetricCard label="Pays inconnu" value={n(f.paysInconnu)} />
            </div>
            <Link href="/admin/crm?formation=1" className="inline-block text-sm text-accent hover:underline">Voir dans le CRM →</Link>
          </div>
        ))}
      </Section>
    </div>
  );
}
