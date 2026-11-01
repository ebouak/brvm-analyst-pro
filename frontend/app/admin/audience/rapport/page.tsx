import Link from 'next/link';
import type { ReactNode } from 'react';
import { requirePermission } from '@/lib/server/rbac';
import { bornesPeriode, libelleFenetre, PERIODES_RAPPORT } from '@/lib/audience/periodes';
import { chargerAudienceCache } from '@/lib/audience/indicateurs';
import { delta, fmtDelta, fmtDuree, sousTotalUemoa } from '@/lib/audience/lignes';
import { MENTION_COOKIES, resumeAudience } from '@/lib/audience/resume';
import ImprimerRapport from './ImprimerRapport';
import './rapport.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: "Rapport d'audience — Administration" };

const n = (x: number) => Math.round(x).toLocaleString('fr-FR').replace(/[  ]/g, ' ');
const LIB = { jour: 'journalier', semaine: 'hebdomadaire', mois: 'mensuel' } as const;
const Indispo = () => <p className="ra-note">Indisponible : PostHog n'a pas répondu pour ce bloc.</p>;
const Sec = ({ t, children, note }: { t: string; children: ReactNode; note?: string }) => <section><h2>{t}</h2>{children}{note && <p className="ra-note">{note}</p>}</section>;

export default async function Page({ searchParams }: { searchParams: { periode?: string } }) {
  await requirePermission('crm.read');
  const periode = (PERIODES_RAPPORT as readonly string[]).includes(searchParams.periode ?? '') ? (searchParams.periode as (typeof PERIODES_RAPPORT)[number]) : 'semaine';
  const b = bornesPeriode(periode, new Date());
  const a = await chargerAudienceCache(`rapport-${periode}`, b);
  const prec = a.overviewPrecedent.ok ? a.overviewPrecedent.data : null;
  const u = a.pays.ok ? sousTotalUemoa(a.pays.data) : null;
  const af = a.continents.ok ? a.continents.data.find((c) => c.code === 'AF') : undefined;
  const ligne = (lib: string, v: number, p: number | undefined) => <tr key={lib}><td>{lib}</td><td><strong>{n(v)}</strong></td><td>{p === undefined ? 'n/d' : fmtDelta(delta(v, p))}</td></tr>;

  return (
    <div className="ra">
      <div className="ra-barre">
        {PERIODES_RAPPORT.map((p) => <Link key={p} href={`/admin/audience/rapport?periode=${p}`} className="ra-onglet" aria-current={p === periode ? 'true' : undefined}>{LIB[p]}</Link>)}
        <Link href="/admin/audience" className="ra-onglet">Tableau détaillé</Link>
        <ImprimerRapport />
      </div>

      <h1>Rapport d'audience — {LIB[periode]}</h1>
      <p className="ra-sous">{libelleFenetre(b)} · source PostHog (UE)</p>

      <Sec t="Chiffres clés">
        {a.overview.ok ? (
          <table>
            <thead><tr><th>Indicateur</th><th>Période</th><th>vs précédente</th></tr></thead>
            <tbody>
              {ligne('Personnes', a.overview.data.personnes, prec?.personnes)}
              {ligne('Sessions', a.overview.data.sessions, prec?.sessions)}
              {ligne('Pages vues', a.overview.data.pagesVues, prec?.pagesVues)}
              {a.sessions.ok && <tr><td>Durée médiane d'une session</td><td>{fmtDuree(a.sessions.data.dureeMedianeS)}</td><td /></tr>}
            </tbody>
          </table>
        ) : <Indispo />}
      </Sec>

      <Sec t="Afrique et UEMOA" note="Sous-total UEMOA = somme par pays.">
        {a.continents.ok ? (
          <table>
            <tbody>
              <tr><td>Personnes en Afrique</td><td><strong>{af ? n(af.personnes) : '0'}</strong></td></tr>
              <tr><td>Dont UEMOA</td><td>{u ? n(u.personnes) : 'n/d'}</td></tr>
              {a.pays.ok && a.pays.data.slice(0, 8).map((p) => <tr key={p.code ?? p.nom}><td>— {p.nom}{p.uemoa ? ' (UEMOA)' : ''}</td><td>{n(p.personnes)}</td></tr>)}
            </tbody>
          </table>
        ) : <Indispo />}
      </Sec>

      <Sec t="Pages les plus vues">
        {a.pages.ok ? (
          <table><thead><tr><th>Page</th><th>Vues</th><th>Personnes</th></tr></thead>
            <tbody>{a.pages.data.slice(0, 10).map((p) => <tr key={p.chemin}><td>{p.chemin}</td><td>{n(p.vues)}</td><td>{n(p.personnes)}</td></tr>)}</tbody></table>
        ) : <Indispo />}
      </Sec>

      <Sec t="Entonnoir Academy" note="Personnes distinctes ayant atteint chaque étape ; l'ordre n'est pas vérifié.">
        {a.entonnoir.ok ? (
          <table><tbody>
            <tr><td>Ont consulté la formation</td><td>{n(a.entonnoir.data.academy)}</td></tr>
            <tr><td>Ont ouvert une leçon</td><td>{n(a.entonnoir.data.lecon)}</td></tr>
            <tr><td>Ont atteint l'inscription</td><td>{n(a.entonnoir.data.inscription)}</td></tr>
          </tbody></table>
        ) : <Indispo />}
      </Sec>

      <Sec t="Intérêt formation (CRM)">
        {a.formationCrm.ok ? (
          <p>{n(a.formationCrm.data.comptes)} compte(s) connecté(s) ont consulté la formation : {n(a.formationCrm.data.afrique)} en Afrique, dont {n(a.formationCrm.data.uemoa)} en UEMOA ; {n(a.formationCrm.data.paysInconnu)} de pays inconnu.</p>
        ) : <Indispo />}
      </Sec>

      <Sec t="En bref">
        <ul>{resumeAudience(a, prec).map((r) => <li key={r}>{r}</li>)}</ul>
      </Sec>

      <p className="ra-note">{MENTION_COOKIES} Agrégats uniquement, aucune donnée personnelle.</p>
    </div>
  );
}
