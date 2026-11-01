// frontend/app/admin/crm/FicheProspect.tsx
// Contenu de la fiche : réutilisé par la page pleine et par le panneau latéral de la liste.
import type { Dossier, Score } from '@/lib/crm/types';
import type { ResultatPaiement } from '@/lib/crm/paiement';
import { decisionsCourantes, reponseRecue, LIB_VUE, LIB_MOTIF, actionRecommandee, type Vue } from '@/lib/crm/vues';
import { chronologie } from '@/lib/crm/identite';
import { fmtJour, fmtMontant, compareIso } from '@/lib/crm/score';
import type { TemplateId } from '@/lib/crm/gabarits';
import { eligibilite } from '@/lib/crm/eligibilite';
import type { Reglages } from '@/lib/crm/reglages';
import { dernierContact } from '@/lib/crm/vues';
import { texteWhatsappInitial } from '@/lib/crm/whatsappRelance';
import { suiviRelance, fmtJourHeure, libSequence } from './libelles';
import RelanceForm from './[cle]/RelanceForm';
import RelanceWhatsapp from './[cle]/RelanceWhatsapp';
import NoteForm from './[cle]/NoteForm';
import { ClotureForm, ActionSimple, ResponsableForm, EcheanceForm } from './DecisionForms';

export const TON_ETAT: Record<ResultatPaiement['etat'], { lib: string; cls: string }> = {
  paye: { lib: 'Payé', cls: 'border-up/30 bg-up/10 text-up' },
  a_verifier: { lib: 'À vérifier', cls: 'border-warn/40 bg-warn/10 text-warn' },
  abandonne: { lib: 'Abandonné', cls: 'border-down/30 bg-down/10 text-down' },
  expire: { lib: 'Expiré', cls: 'border-border bg-elevated text-muted' },
  aucun: { lib: 'Aucun paiement', cls: 'border-border bg-elevated text-muted' },
};
export const BadgeEtat = ({ etat }: { etat: ResultatPaiement['etat'] }) => (
  <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs ${TON_ETAT[etat].cls}`}>{TON_ETAT[etat].lib}</span>
);

const H2 = 'mb-2 text-sm font-semibold text-ivory';
const STATUT_PAIEMENT = { paid: 'payé', pending: 'en attente', failed: 'échoué' } as const;
const LIB_DECISION: Record<string, string> = { cloture: 'Clôture', reouverture: 'Réouverture', echeance: 'Échéance', responsable: 'Responsable', reponse: 'Réponse reçue', traite: 'Réponse traitée' };

export interface FicheProps {
  d: Dossier; etat: ResultatPaiement; vue: Vue; score: Score; canWrite: boolean;
  responsables: { id: string; email: string }[];
  templateId: TemplateId; sujet: string; corps: string; relanceRecente: string | null;
  maintenant: Date; reglages: Reglages;
}

export default function FicheProspect({ d, etat, vue, score, canWrite, responsables, templateId, sujet, corps, relanceRecente, maintenant, reglages }: FicheProps) {
  const dec = decisionsCourantes(d);
  const reco = actionRecommandee(d, vue, etat, maintenant);
  const nomResp = (id: string | null) => (id ? responsables.find((r) => r.id === id)?.email ?? 'compte inconnu' : null);
  const relances = d.actions.filter((a) => a.type === 'relance').sort((a, b) => compareIso(b.date, a.date));
  const decisions = d.actions.filter((a) => a.type === 'decision').sort((a, b) => compareIso(b.date, a.date));
  const notes = d.actions.filter((a) => a.type === 'note').sort((a, b) => compareIso(b.date, a.date));
  const paiements = [...d.paiements].sort((a, b) => compareIso(b.date, a.date));
  const messages = [...d.messages].sort((a, b) => compareIso(b.date, a.date));
  const elig = eligibilite(d, reglages, maintenant);
  const nbRelances = d.actions.filter((a) => a.type === 'relance' && (a.statut === 'envoye' || a.statut === 'prepare')).length;
  const contact = dernierContact(d);
  const nbDoublons = etat.doublons.length;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-accent/40 bg-accent/5 p-4">
        <p className="overline text-faint">Action recommandée · {LIB_VUE[vue]}</p>
        <p className="font-display text-lg text-ivory">{reco.libelle}</p>
        <p className="text-sm text-muted">{reco.justification}</p>
      </section>

      <section className="space-y-1 text-sm">
        <h2 className={H2}>Identité et coordonnées</h2>
        <p className="text-ivory">{d.nom ?? '—'}</p>
        <p className="text-muted">{d.emailNorm} · {d.userId ? (d.premium ? 'compte Premium' : 'compte gratuit') : 'prospect sans compte'}{d.inscritLe ? ` · inscrit le ${fmtJour(d.inscritLe)}` : ''}</p>
        <p className="text-muted">
          WhatsApp : {d.whatsapp.numero
            ? <><span className="tabular text-ivory">{d.whatsapp.numero}</span> ({d.whatsapp.source === 'prouve' ? 'prouvé' : 'déclaré'}{d.whatsapp.recontact ? ', consentement au recontact' : ', sans consentement au recontact'})</>
            : d.whatsapp.lieSansNumero ? 'lié, numéro non visible' : 'aucun numéro connu'}
        </p>
        <p className="tabular text-muted">Score {score.score} · {score.niveau}</p>
        <p className="text-xs text-faint">Score calculé le {fmtJourHeure(maintenant.toISOString())} (heure d&apos;Abidjan)</p>
        {score.raisons.length > 0 && (
          <ul className="space-y-0.5 text-xs text-muted">
            {score.raisons.map((r) => (
              <li key={r.code}><span className="tabular text-faint">+{r.points}</span> {r.texte}{r.date ? <span className="text-faint"> · {r.code === 'offre' ? fmtJour(r.date) : fmtJourHeure(r.date)}</span> : null}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-1 text-sm">
        <h2 className={H2}>Offre et paiement</h2>
        <p className="flex flex-wrap items-center gap-2 text-muted">
          <BadgeEtat etat={etat.etat} />
          {etat.enCours
            ? <span className="tabular text-ivory">{fmtMontant(etat.enCours.montant, etat.enCours.devise)} · {etat.enCours.provider} · {fmtJour(etat.enCours.date)}</span>
            : <span>Aucun paiement en cours.</span>}
        </p>
        <p className="text-muted">{etat.detail}</p>
        {nbDoublons > 0 && <p className="text-xs text-faint">{nbDoublons} intention{nbDoublons > 1 ? 's' : ''} ancienne{nbDoublons > 1 ? 's' : ''} ignorée{nbDoublons > 1 ? 's' : ''} (antérieure{nbDoublons > 1 ? 's' : ''} à un paiement confirmé).</p>}
      </section>

      <section>
        <h2 className={H2}>Chronologie des paiements</h2>
        {paiements.length === 0 ? <p className="text-sm text-muted">Aucun paiement enregistré.</p> : (
          <ul className="space-y-1 text-sm">{paiements.map((p) => (
            <li key={p.id} className="text-muted"><span className="tabular text-faint">{fmtJour(p.date)}</span> · {STATUT_PAIEMENT[p.statut]} · <span className="tabular text-ivory">{fmtMontant(p.montant, p.devise)}</span> · {p.provider}{etat.doublons.includes(p.id) ? ' · intention ancienne ignorée' : ''}</li>
          ))}</ul>
        )}
      </section>

      <section>
        <h2 className={H2}>Messages et réponses</h2>
        <ul className="space-y-1 text-sm">
          {relances.map((a, i) => <li key={`r${i}`} className="text-muted"><span className="tabular text-faint">{fmtJour(a.date)}</span> · relance {a.canal ?? ''} (<span className={suiviRelance(d, a).cls}>{suiviRelance(d, a).lib}</span>){libSequence(a.sequenceCle) ? ` · ${libSequence(a.sequenceCle)}` : ''}{a.sujet ? ` · ${a.sujet}` : ''}</li>)}
          {messages.map((m, i) => <li key={`m${i}`} className="text-muted"><span className="tabular text-faint">{fmtJour(m.date)}</span> · message reçu via le formulaire de contact</li>)}
          {decisions.map((a, i) => <li key={`d${i}`} className="text-muted"><span className="tabular text-faint">{fmtJour(a.date)}</span> · {LIB_DECISION[a.decision ?? ''] ?? 'Décision'} — {a.contenu}</li>)}
          {relances.length + messages.length + decisions.length === 0 && <li className="text-muted">Aucun échange enregistré.</li>}
        </ul>
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-faint">Chronologie complète</summary>
          <ul className="mt-1 space-y-1">{chronologie(d).map((e, i) => <li key={i} className="text-muted"><span className="tabular text-faint">{fmtJour(e.date)}</span> · {e.libelle}</li>)}</ul>
        </details>
      </section>

      <section>
        <h2 className={H2}>Notes internes</h2>
        {notes.length > 0 && <ul className="mb-2 space-y-1 text-sm">{notes.map((a, i) => <li key={i} className="text-muted"><span className="tabular text-faint">{fmtJour(a.date)}</span> · {a.contenu}</li>)}</ul>}
        {canWrite && <NoteForm cle={d.cle} />}
      </section>

      <section className="space-y-3">
        <h2 className={H2}>Suivi</h2>
        <p className="text-sm text-muted">
          Responsable : <span className="text-ivory">{nomResp(dec.responsable) ?? 'non assigné'}</span> · Échéance : <span className="tabular text-ivory">{dec.echeance ? fmtJour(dec.echeance) : 'aucune'}</span>
          {dec.cloture ? ` · clôturé (${dec.cloture.motif ? LIB_MOTIF[dec.cloture.motif] : 'sans motif'})` : ''}{d.oppose ? ' · opposé aux propositions commerciales' : ''}
        </p>
        {canWrite && (
          <div className="space-y-3">
            <ResponsableForm cle={d.cle} courant={dec.responsable} responsables={responsables} />
            <EcheanceForm cle={d.cle} courante={dec.echeance} />
            <div className="flex flex-wrap items-start gap-3">
              <ActionSimple cle={d.cle} type="reponse" libelle="Réponse reçue" />
              {reponseRecue(d) ? <ActionSimple cle={d.cle} type="traite" libelle="Réponse traitée" /> : null}
              {dec.cloture ? <ActionSimple cle={d.cle} type="rouvrir" libelle="Rouvrir le dossier" /> : <ClotureForm cle={d.cle} />}
            </div>
          </div>
        )}
      </section>

      {canWrite && (
        <>
          <section>
            <h2 className={H2}>Relance par e-mail</h2>
            {elig.ok ? (
              <p role="status" className="mb-2 text-xs text-up">Relance possible · {nbRelances}/{reglages.max_relances} relance{reglages.max_relances > 1 ? 's' : ''}{contact ? `, dernier contact le ${fmtJour(contact)}` : ', aucun contact encore'}</p>
            ) : (
              <div role="status" className="mb-2 rounded-md border border-down/30 bg-down/5 p-3 text-sm">
                <p className="font-medium text-down">Relance bloquée</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted">{elig.raisons.map((r) => <li key={r}>{r}</li>)}</ul>
              </div>
            )}
            {!elig.ok ? null : (
              <RelanceForm cle={d.cle} templateId={templateId} sujetInitial={sujet} corpsInitial={corps} relanceRecente={relanceRecente} oppose={d.oppose} />
            )}
          </section>
          <section>
            <h2 className={H2}>Relance par WhatsApp</h2>
            {!elig.ok ? (
              <p className="text-sm text-muted">Relance bloquée : voir les raisons dans la section e-mail ci-dessus.</p>
            ) : d.whatsapp.numero && d.whatsapp.recontact && d.whatsapp.source ? (
              <RelanceWhatsapp cle={d.cle} templateId={templateId} texteInitial={texteWhatsappInitial(d.nom?.trim().split(/\s+/)[0] || null)} numero={d.whatsapp.numero} source={d.whatsapp.source} />
            ) : d.whatsapp.lieSansNumero ? (
              <p className="text-sm text-muted">WhatsApp lié sans numéro visible : joignable en répondant dans la console de contact WhatsApp.</p>
            ) : d.whatsapp.numero ? (
              <p className="text-sm text-muted">Numéro connu, mais pas de consentement au recontact : pas de relance WhatsApp.</p>
            ) : (
              <p className="text-sm text-muted">Aucun numéro WhatsApp connu.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
