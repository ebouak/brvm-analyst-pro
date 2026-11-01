// frontend/app/admin/crm/page.tsx
import Link from 'next/link';
import type { ReactNode } from 'react';
import { requirePermission, can } from '@/lib/server/rbac';
import { SectionHeader, PremiumPanel } from '@/components/ui/premium';
import { chargerDossiers, chargerPaiementsOrphelins } from '@/lib/crm/charger';
import { scorer, fmtJour, fmtMontant, compareIso } from '@/lib/crm/score';
import { etatPaiement } from '@/lib/crm/paiement';
import { VUES, LIB_VUE, LIB_MOTIF, decisionsCourantes, vueDe, type Vue } from '@/lib/crm/vues';
import { listerResponsables } from '@/lib/crm/responsables';
import type { Dossier, Niveau } from '@/lib/crm/types';
import FicheProspect, { BadgeEtat } from './FicheProspect';
import { preparerFiche } from './preparerFiche';
import { suiviRelance } from './libelles';
import PanneauFocus from './PanneauFocus';
import IndicateursBandeau from './IndicateursBandeau';
import ReglagesForm from './ReglagesForm';
import { MasseProvider, CaseTout, CaseLigne } from './RelanceMasse';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { fmtJourHeure } from './libelles';
import { chargerReglages } from '@/lib/crm/reglagesServeur';
import { calculerIndicateurs } from '@/lib/crm/indicateurs';
import type { Reglages } from '@/lib/crm/reglages';
import { nomPays, continentDe } from '@/lib/crm/geo';
import { ZONES, LIB_ZONE, estZone, dansZone, aInteretFormation, type Zone } from '@/lib/crm/segments';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'CRM — Administration' };

type Sp = { vue?: string; niveau?: string; resp?: string; q?: string; fiche?: string; zone?: string; formation?: string };
const NIVEAUX = ['chaud', 'tiede', 'froid', 'tous'] as const;
const LIB_NIVEAU: Record<Niveau | 'tous', string> = { chaud: 'Chaud', tiede: 'Tiède', froid: 'Froid', tous: 'Tous' };
const VIDE: Record<Vue, string> = {
  a_traiter: 'Rien à traiter : aucune échéance atteinte, aucune réponse en attente, aucun silence prolongé.',
  jamais_contactes: 'Toutes les personnes suivies ont déjà été contactées au moins une fois.',
  paiements_a_verifier: 'Aucun paiement à vérifier pour le moment.',
  en_attente: 'Personne n\'est en attente de réponse dans le délai de suivi.',
  convertis: 'Aucune personne convertie pour l\'instant.',
  clotures: 'Aucun dossier clôturé.',
};

const local = (e: string | null | undefined) => (e ? e.split('@')[0] : null);

function href(sp: Sp, maj: Partial<Sp>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...maj })) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `/admin/crm?${s}` : '/admin/crm';
}

export default async function Page({ searchParams }: { searchParams: Sp }) {
  const ctx = await requirePermission('crm.read');
  const vueActive: Vue = (VUES as readonly string[]).includes(searchParams.vue ?? '') ? (searchParams.vue as Vue) : 'a_traiter';
  const niveau = (NIVEAUX as readonly string[]).includes(searchParams.niveau ?? '') ? (searchParams.niveau as Niveau | 'tous') : 'tous';
  const resp = searchParams.resp || 'tous';
  const zone: Zone = estZone(searchParams.zone) ? searchParams.zone : 'tous';
  const interetFormation = searchParams.formation === '1';
  const q = (searchParams.q ?? '').trim().toLowerCase().slice(0, 100);
  const peutEcrire = can(ctx, 'crm.write');
  const surReglages = peutEcrire && searchParams.vue === 'reglages';
  const sp: Sp = { vue: searchParams.vue, niveau: searchParams.niveau, resp: searchParams.resp, q: searchParams.q, fiche: searchParams.fiche, zone: searchParams.zone, formation: searchParams.formation };

  const maintenant = new Date();
  const [dossiers, orphelins, responsables, reglages] = await Promise.all([
    chargerDossiers(),
    chargerPaiementsOrphelins().catch(() => []),
    listerResponsables().catch(() => []),
    chargerReglages(),
  ]);
  const indicateurs = calculerIndicateurs(dossiers, reglages, maintenant);
  let modifieLe: string | null = null;
  if (surReglages) {
    // Date de dernière modification : lecture seule, absente => non affichée.
    const { data } = await getServiceClient().from('crm_reglages').select('modifie_le').eq('id', 1).maybeSingle().then((r) => r, () => ({ data: null }));
    const iso = (data as { modifie_le?: string } | null)?.modifie_le;
    modifieLe = iso ? fmtJourHeure(iso, true) : null;
  }
  const emailResp = (id: string | null) => local(id ? responsables.find((r) => r.id === id)?.email : null);

  const lignes = dossiers.filter((d) => !d.admin).map((d) => {
    const etat = etatPaiement(d, maintenant);
    const v = vueDe(d, maintenant, reglages);
    const dec = decisionsCourantes(d);
    const dernier = [...d.actions].filter((a) => a.type === 'relance' || a.type === 'decision').sort((a, b) => compareIso(b.date, a.date))[0] ?? null;
    return { d, etat, vue: v.vue, echeance: v.echeance, dec, dernier, score: scorer(d, maintenant) };
  });

  // Compteurs des onglets calculés AVANT les filtres secondaires (niveau, responsable, recherche) :
  // ils décrivent le portefeuille entier ; le nombre filtré figure dans la légende du tableau.
  const compte = Object.fromEntries(VUES.map((v) => [v, 0])) as Record<Vue, number>;
  for (const l of lignes) compte[l.vue]++;

  const filtrees = lignes.filter((l) => l.vue === vueActive
    && (niveau === 'tous' || l.score.niveau === niveau)
    && (resp === 'tous' || (resp === 'aucun' ? !l.dec.responsable : l.dec.responsable === resp))
    && dansZone(l.d.pays, zone)
    && (!interetFormation || aInteretFormation(l.d))
    && (!q || (l.d.nom ?? '').toLowerCase().includes(q) || l.d.emailNorm.includes(q)));

  // « À traiter » et « Paiements à vérifier » : le plus ancien d'abord ; ailleurs : score décroissant.
  const cleAncien = (l: (typeof lignes)[number]) => l.echeance ?? (vueActive === 'paiements_a_verifier' ? l.etat.enCours?.date : null) ?? l.dernier?.date ?? '9999';
  filtrees.sort(vueActive === 'a_traiter' || vueActive === 'paiements_a_verifier'
    ? (a, b) => compareIso(cleAncien(a), cleAncien(b))
    : (a, b) => b.score.score - a.score.score);

  const ouverte = searchParams.fiche ? lignes.find((l) => l.d.cle === searchParams.fiche) : undefined;
  const sansFiche = { ...sp, fiche: undefined };

  return (
    <>
    {/* Contenu derrière le panneau : inerte (ni focus ni lecteur d'écran) tant qu'il est ouvert. */}
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6" {...(searchParams.fiche ? ({ inert: '' } as Record<string, unknown>) : {})}>
      <SectionHeader kicker="Administration" title="CRM · proches du Premium" />

      <IndicateursBandeau i={indicateurs} />

      <nav aria-label="Vues" className="flex flex-wrap gap-2 text-sm">
        {VUES.map((v) => (
          <Link key={v} href={href(sansFiche, { vue: v })} aria-current={!surReglages && v === vueActive ? 'page' : undefined}
            className={`rounded-full border px-3 py-1 ${!surReglages && v === vueActive ? 'border-accent text-accent-ink' : 'border-border text-muted hover:text-ivory'}`}>
            {LIB_VUE[v]} <span className="tabular text-faint">{compte[v]}</span>
          </Link>
        ))}
        {peutEcrire && (
          <Link href={href(sansFiche, { vue: 'reglages' })} aria-current={surReglages ? 'page' : undefined}
            className={`ml-auto rounded-full border border-dashed px-3 py-1 ${surReglages ? 'border-accent text-accent-ink' : 'border-border text-muted hover:text-ivory'}`}>
            Réglages
          </Link>
        )}
      </nav>

      {surReglages ? (
        <div className="max-w-2xl space-y-3">
          <h2 className="font-display text-xl text-ivory">Réglages de la relance pilotée</h2>
          <ReglagesForm initial={reglages} modifieLe={modifieLe} />
        </div>
      ) : (<>

      <form method="get" action="/admin/crm" className="flex flex-wrap items-end gap-3 text-sm">
        <input type="hidden" name="vue" value={vueActive} />
        <label className="space-y-1"><span className="block text-xs text-faint">Niveau</span>
          <select name="niveau" defaultValue={niveau} className="rounded-md border border-border bg-sunken px-3 py-1.5 text-ivory">
            {NIVEAUX.map((n) => <option key={n} value={n}>{LIB_NIVEAU[n]}</option>)}
          </select></label>
        <label className="space-y-1"><span className="block text-xs text-faint">Responsable</span>
          <select name="resp" defaultValue={resp} className="rounded-md border border-border bg-sunken px-3 py-1.5 text-ivory">
            <option value="tous">Tous</option><option value="aucun">Non assigné</option>
            {responsables.map((r) => <option key={r.id} value={r.id}>{local(r.email)}</option>)}
          </select></label>
        <label className="space-y-1"><span className="block text-xs text-faint">Zone</span>
          <select name="zone" defaultValue={zone} className="rounded-md border border-border bg-sunken px-3 py-1.5 text-ivory">
            {ZONES.map((z) => <option key={z} value={z}>{LIB_ZONE[z]}</option>)}
          </select></label>
        <label className="flex items-center gap-2 pb-2 text-ivory"><input type="checkbox" name="formation" value="1" defaultChecked={interetFormation} className="accent-accent" />Intérêt formation</label>
        <label className="space-y-1"><span className="block text-xs text-faint">Recherche</span>
          <input name="q" defaultValue={searchParams.q ?? ''} placeholder="Nom ou e-mail" className="rounded-md border border-border bg-sunken px-3 py-1.5 text-ivory" /></label>
        <button type="submit" className="rounded-full border border-border px-4 py-1.5 text-ivory hover:border-accent">Filtrer</button>
        {(niveau !== 'tous' || resp !== 'tous' || zone !== 'tous' || interetFormation || q) && <Link href={href({ vue: vueActive }, {})} className="py-1.5 text-muted hover:text-ivory">Réinitialiser</Link>}
      </form>

      {vueActive === 'paiements_a_verifier' && orphelins.length > 0 && (
        <div role="alert" className="rounded-lg border border-warn/40 bg-warn/10 p-4 text-sm">
          <p className="font-medium text-warn">{orphelins.length} intention{orphelins.length > 1 ? 's' : ''} de paiement sans compte rattaché</p>
          <ul className="mt-1 space-y-0.5 text-muted">
            {orphelins.map((o) => <li key={o.id}><span className="tabular text-ivory">{fmtMontant(o.montant, o.devise)}</span> · {o.provider} · {fmtJour(o.date)}</li>)}
          </ul>
          <Link href="/admin/payments" className="mt-2 inline-block text-accent-ink underline">Vérifier dans Paiements</Link>
        </div>
      )}

      <p className="text-xs text-faint">{filtrees.length} sur {compte[vueActive]} personne{compte[vueActive] > 1 ? 's' : ''} dans « {LIB_VUE[vueActive]} »</p>

      {filtrees.length === 0 ? (
        <PremiumPanel><p className="text-sm text-muted">{compte[vueActive] > 0 ? 'Aucun résultat avec ces filtres.' : VIDE[vueActive]}</p></PremiumPanel>
      ) : (
        <MasseProvider cles={filtrees.map((l) => l.d.cle)} peutEcrire={peutEcrire} masquerBarre={Boolean(searchParams.fiche)}>
        <PremiumPanel className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-faint">
                {peutEcrire && <th className="w-10 px-4 py-3"><CaseTout /></th>}
                <th className="px-4 py-3 font-medium">Personne</th><th className="px-4 py-3 font-medium">Pays</th><th className="px-4 py-3 font-medium">Paiement</th>
                <th className="px-4 py-3 text-right font-medium">Montant</th><th className="px-4 py-3 font-medium">Échéance</th>
                <th className="px-4 py-3 font-medium">Dernière action</th><th className="px-4 py-3 font-medium">Responsable</th>
                <th className="px-4 py-3 font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {filtrees.map(({ d, etat, echeance, dec, dernier, score }) => (
                <tr key={d.cle} className={`relative border-b border-border/40 align-top last:border-0 ${d.cle === searchParams.fiche ? 'bg-accent/5' : ''}`}>
                  {peutEcrire && <td className="px-4 py-2.5"><CaseLigne cle={d.cle} nom={d.nom ?? d.emailNorm} /></td>}
                  <td className="px-4 py-2.5">
                    <Link href={href(sp, { fiche: d.cle })} scroll={false} className="font-medium text-ivory after:absolute after:inset-0 hover:text-accent-ink">{d.nom ?? d.emailNorm}</Link>
                    {!d.userId && <span className="ml-2 text-xs text-faint">prospect sans compte</span>}
                    {d.formationAchetee && <span className="ml-2 rounded-full border border-accent/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-accent-ink">formation achetée{d.formationAchetee === 'partielle' ? ' (partielle)' : ''}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-muted">{d.pays ? <>{nomPays(d.pays)} <span className="ml-1 rounded-full border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-faint">{continentDe(d.pays) ?? '—'}</span></> : '—'}</td>
                  <td className="px-4 py-2.5"><BadgeEtat etat={etat.etat} /></td>
                  <td className="px-4 py-2.5 text-right tabular text-muted">{etat.enCours ? fmtMontant(etat.enCours.montant, etat.enCours.devise) : '—'}</td>
                  <td className="px-4 py-2.5 tabular text-muted">{echeance ? fmtJour(echeance) : '—'}</td>
                  <td className="px-4 py-2.5 text-muted">{libelleDernier(d, dernier)}</td>
                  <td className="px-4 py-2.5 text-muted">{emailResp(dec.responsable) ?? '—'}</td>
                  <td className="px-4 py-2.5 tabular text-muted">{score.score} · {LIB_NIVEAU[score.niveau]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PremiumPanel>
        </MasseProvider>
      )}
      </>)}

    </div>
    {searchParams.fiche && (ouverte
      ? <PanneauFiche l={ouverte} fermer={href(sansFiche, {})} canWrite={can(ctx, 'crm.write')} responsables={responsables} maintenant={maintenant} reglages={reglages} />
      : <PanneauIntrouvable fermer={href(sansFiche, {})} />)}
    </>
  );
}

function libelleDernier(d: Dossier, a: Dossier['actions'][number] | null): ReactNode {
  if (!a) return 'aucune';
  if (a.type === 'relance') { const s = suiviRelance(d, a); return <>{fmtJour(a.date)} · {a.canal ?? 'relance'} (<span className={s.cls}>{s.lib}</span>)</>; }
  if (a.decision === 'cloture') return `${fmtJour(a.date)} · clôture${a.motif ? ` (${LIB_MOTIF[a.motif]})` : ''}`;
  const lib: Record<string, string> = { reouverture: 'réouverture', echeance: 'échéance fixée', responsable: 'responsable assigné', reponse: 'réponse reçue', traite: 'réponse traitée' };
  return `${fmtJour(a.date)} · ${lib[a.decision ?? ''] ?? 'décision'}`;
}

function PanneauFiche({ l, fermer, canWrite, responsables, maintenant, reglages }: {
  l: { d: Dossier; etat: ReturnType<typeof etatPaiement>; vue: Vue; score: ReturnType<typeof scorer> };
  fermer: string; canWrite: boolean; responsables: { id: string; email: string }[]; maintenant: Date; reglages: Reglages;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`Fiche de ${l.d.nom ?? l.d.emailNorm}`}>
      <PanneauFocus fermer={fermer} titreId="panneau-titre" />
      <Link href={fermer} scroll={false} aria-label="Fermer la fiche" className="hidden flex-1 bg-bg/70 backdrop-blur-sm lg:block" />
      <aside className="h-full w-full overflow-y-auto border-l border-border bg-surface p-6 lg:w-[34rem]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="panneau-titre" tabIndex={-1} className="font-display text-xl text-ivory outline-none">{l.d.nom ?? l.d.emailNorm}</h2>
          <div className="flex shrink-0 items-center gap-3 text-sm">
            <Link href={`/admin/crm/${encodeURIComponent(l.d.cle)}`} className="text-muted hover:text-ivory">Ouvrir en grand</Link>
            <Link href={fermer} scroll={false} className="rounded-full border border-border px-3 py-1 text-ivory hover:border-accent">Fermer</Link>
          </div>
        </div>
        <FicheProspect key={l.d.cle} d={l.d} etat={l.etat} vue={l.vue} score={l.score} canWrite={canWrite} responsables={responsables} maintenant={maintenant} reglages={reglages} {...preparerFiche(l.d, l.score, maintenant)} />
      </aside>
    </div>
  );
}

function PanneauIntrouvable({ fermer }: { fermer: string }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Fiche introuvable">
      <PanneauFocus fermer={fermer} titreId="panneau-titre" />
      <Link href={fermer} scroll={false} aria-label="Fermer" className="hidden flex-1 bg-bg/70 backdrop-blur-sm lg:block" />
      <aside className="h-full w-full overflow-y-auto border-l border-border bg-surface p-6 lg:w-[34rem]">
        <h2 id="panneau-titre" tabIndex={-1} className="font-display text-xl text-ivory outline-none">Fiche introuvable</h2>
        <p className="mt-2 text-sm text-muted">Cette personne n&apos;existe pas ou n&apos;est pas suivie dans le CRM.</p>
        <Link href={fermer} scroll={false} className="mt-4 inline-block rounded-full border border-border px-3 py-1 text-sm text-ivory hover:border-accent">Fermer</Link>
      </aside>
    </div>
  );
}
