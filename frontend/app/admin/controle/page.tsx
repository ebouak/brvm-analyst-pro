import { Suspense } from 'react';
import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, PremiumPanel } from '@/components/ui/premium';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { BoutonActualiser } from '@/components/admin/controle/BoutonActualiser';
import { chargerTour } from '@/lib/controle/tour';
import { niveauGlobal, type Domaine, type Niveau, type Repere, type Signal } from '@/lib/controle/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tour de contrôle — Administration' };

const DEPOT = 'https://github.com/ebouak/brvm-analyst-pro';

/**
 * Tour de contrôle : envois, tâches planifiées et fraîcheur des données sur
 * UNE page, le plus grave d'abord. Née de la panne e-mail muette de sept
 * semaines (CLAUDE.md §9) : un run vert ne prouve rien, la donnée produite si.
 * Lecture seule : les boutons relisent l'état ou mènent à la preuve, aucun ne
 * relance un traitement en aveugle.
 * Pas de loading.tsx (règle anti-soft-404) : <Suspense> ici.
 */
export default async function Page() {
  await requirePermission('scraping.read');
  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader
        title="Tour de contrôle"
        subtitle="Ce qui part, ce qui tourne, ce qui est à jour — jugé sur la donnée produite, pas sur la couleur des runs."
      />
      <div className="gold-rule" />
      <Suspense fallback={<LoadingSkeleton />}>
        <Contenu />
      </Suspense>
    </div>
  );
}

const STYLE: Record<Niveau, { libelle: string; badge: string; ligne: string }> = {
  alerte: { libelle: 'Alerte', badge: 'border-down/40 bg-down/10 text-down', ligne: 'bg-down/[0.04]' },
  inconnu: { libelle: 'Inconnu', badge: 'border-warn/40 bg-warn/10 text-warn', ligne: 'bg-warn/[0.03]' },
  attention: { libelle: 'À surveiller', badge: 'border-warn/40 bg-warn/10 text-warn', ligne: '' },
  ok: { libelle: 'OK', badge: 'border-up/40 bg-up/10 text-up', ligne: '' },
  na: { libelle: 'Non applicable', badge: 'border-border bg-elevated/40 text-faint', ligne: 'opacity-70' },
};

const VERDICT: Record<Niveau, string> = {
  alerte: 'Au moins un point exige une action',
  inconnu: 'Une source n’a pas pu être lue : rien ne peut être affirmé sur elle',
  attention: 'Des points sont à surveiller',
  ok: 'Tout ce qui est surveillé et applicable est à jour',
  na: 'Rien d’applicable à surveiller',
};

const DOMAINES: Array<{ id: Domaine; titre: string; sousTitre: string }> = [
  { id: 'envois', titre: 'Envois', sousTitre: 'Alertes, dossiers, réponses de contact, réseaux sociaux, relances.' },
  { id: 'taches', titre: 'Tâches planifiées', sousTitre: 'Workflows GitHub et commandes du scraper.' },
  { id: 'donnees', titre: 'Fraîcheur des données', sousTitre: 'Cours, clôture, indices, carnet, vidéo, dividendes, tests.' },
];

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

function Badge({ niveau }: { niveau: Niveau }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLE[niveau].badge}`}>
      {STYLE[niveau].libelle}
    </span>
  );
}

function anciennete(iso: string, maintenant: Date): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const min = Math.round((maintenant.getTime() - t) / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}

/** Un repère « période » se lit en date (« lun. 2 nov. »), un « instant » en ancienneté. */
function valeurRepere(r: Repere, maintenant: Date): string {
  if (r.nature === 'periode') {
    const d = new Date(`${r.date.slice(0, 10)}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? r.date : `${JOURS[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`;
  }
  return anciennete(r.date, maintenant);
}

const hhmm = (iso: string) => `${iso.slice(11, 16)} UTC`;
const ancre = (id: string) => `s-${id.replace(/[^a-zA-Z0-9-]/g, '-')}`;
/** Défense en profondeur : seuls un lien https ou un chemin interne sont rendus. */
const lienSur = (href: string) => href.startsWith('https://') || /^\/(?!\/)/.test(href);

async function Contenu() {
  const maintenant = new Date();
  const { signaux, observeA, collecteWorkflows } = await chargerTour(maintenant);
  const global = niveauGlobal(signaux);
  const compte = (n: Niveau) => signaux.filter((s) => s.niveau === n).length;
  const aTraiter = signaux.filter((s) => s.niveau === 'alerte' || s.niveau === 'inconnu');
  const aVerifier = signaux.filter((s) => s.niveau === 'attention');
  const preuvesPartielles = signaux.filter((s) => s.preuve && s.preuve !== 'verifiee');

  return (
    <>
      <PremiumPanel className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Badge niveau={global} />
          <p className="text-sm text-ivory">{VERDICT[global]}.</p>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <BoutonActualiser />
            <a
              href={`${DEPOT}/actions/workflows/ops-controle.yml`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-ivory"
            >
              Recollecter les workflows (GitHub)
            </a>
          </div>
        </div>
        <p className="tabular text-xs text-muted">
          État observé à {hhmm(observeA)}
          {' · '}
          {collecteWorkflows
            ? `photo des workflows de ${hhmm(collecteWorkflows)} (${anciennete(collecteWorkflows, maintenant)})`
            : 'photo des workflows indisponible'}
          {' · '}
          {compte('alerte')} alerte(s), {compte('inconnu')} inconnu(s), {compte('attention')} à surveiller, {compte('ok')} OK
          {compte('na') > 0 ? `, ${compte('na')} non applicable(s)` : ''}
          {preuvesPartielles.length > 0 ? ` · ${preuvesPartielles.length} contrôle(s) à preuve partielle` : ''}
        </p>

        {(aTraiter.length > 0 || aVerifier.length > 0) && (
          <div className="grid gap-4 border-t border-border/50 pt-4 md:grid-cols-2">
            <ListeDecisions titre="À traiter" vide="Rien à traiter." signaux={aTraiter} />
            <ListeDecisions titre="À vérifier" vide="Rien à vérifier." signaux={aVerifier} />
          </div>
        )}
      </PremiumPanel>

      {DOMAINES.map((d) => {
        const liste = signaux.filter((s) => s.domaine === d.id);
        return (
          <section key={d.id} aria-labelledby={`dom-${d.id}`} className="space-y-3">
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 id={`dom-${d.id}`} className="font-display text-lg text-ivory">{d.titre}</h2>
              <p className="text-xs text-muted">{d.sousTitre}</p>
            </div>
            <PremiumPanel className="p-0">
              {liste.length === 0 ? (
                // Le contrat garantit au moins un signal par domaine ; si ce n'est pas le cas, on le dit.
                <p className="px-4 py-3 text-sm text-warn">Aucun signal produit pour ce domaine : rien ne peut être affirmé.</p>
              ) : (
                <ul className="divide-y divide-border/50">
                  {liste.map((s) => (
                    <Carte key={s.id} s={s} maintenant={maintenant} />
                  ))}
                </ul>
              )}
            </PremiumPanel>
          </section>
        );
      })}
    </>
  );
}

/** Liste de décisions : une ligne par carte, renvoyant à elle. Proposition de triage, pas un recalcul d'incidents. */
function ListeDecisions({ titre, vide, signaux }: { titre: string; vide: string; signaux: Signal[] }) {
  return (
    <div>
      <p className="text-xs font-semibold text-faint">{titre}</p>
      {signaux.length === 0 ? (
        <p className="mt-1.5 text-sm text-muted">{vide}</p>
      ) : (
        <ul className="mt-1.5 space-y-1 text-sm">
          {signaux.map((s) => (
            <li key={s.id}>
              <a href={`#${ancre(s.id)}`} className="text-ivory hover:text-accent">
                • {s.titre}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Carte({ s, maintenant }: { s: Signal; maintenant: Date }) {
  const reperes = s.reperes ?? [];
  const actions = (s.actions ?? []).filter((a) => lienSur(a.href));
  return (
    <li id={ancre(s.id)} className={`scroll-mt-20 flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-4 ${STYLE[s.niveau].ligne}`}>
      <div className="sm:w-32 sm:pt-0.5"><Badge niveau={s.niveau} /></div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-sm font-medium text-ivory">
          {s.titre}
          {s.preuve && s.preuve !== 'verifiee' && (
            <span className="ml-2 rounded border border-warn/30 px-1.5 py-0.5 text-xs font-normal text-warn">
              Preuve {s.preuve === 'partielle' ? 'partielle' : 'inconnue'}
            </span>
          )}
        </p>
        <p className="text-sm text-muted">{s.detail}</p>
        {reperes.length > 0 && (
          <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
            {reperes.map((r) => (
              <div key={r.libelle} className="flex gap-1">
                <dt className="text-faint">{r.libelle} :</dt>
                <dd className="tabular text-muted" title={r.date}>{valeurRepere(r, maintenant)}</dd>
              </div>
            ))}
          </dl>
        )}
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-0.5">
            {actions.map((a) => {
              const externe = a.href.startsWith('https://');
              return (
                <a
                  key={a.href + a.libelle}
                  href={a.href}
                  className="rounded-md border border-border px-2.5 py-1 text-xs text-accent transition-colors hover:border-accent/40 hover:bg-accent/10"
                  {...(externe ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                >
                  {a.libelle}{externe ? ' ↗' : ' →'}
                </a>
              );
            })}
          </div>
        )}
      </div>
    </li>
  );
}
