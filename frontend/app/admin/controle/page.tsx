import { Suspense } from 'react';
import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, PremiumPanel } from '@/components/ui/premium';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { chargerTour } from '@/lib/controle/tour';
import { niveauGlobal, type Domaine, type Niveau, type Signal } from '@/lib/controle/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tour de contrôle — Administration' };

/**
 * Tour de contrôle : envois, tâches planifiées et fraîcheur des données sur
 * UNE page, le plus grave d'abord. Née de la panne e-mail muette de sept
 * semaines (CLAUDE.md §9) : un run vert ne prouve rien, la donnée produite si.
 * Lecture seule. Pas de loading.tsx (règle anti-soft-404) : <Suspense> ici.
 */
export default async function Page() {
  await requirePermission('scraping.read');
  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader
        kicker="Administration"
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
  attention: { libelle: 'Attention', badge: 'border-warn/40 bg-warn/10 text-warn', ligne: '' },
  ok: { libelle: 'OK', badge: 'border-up/40 bg-up/10 text-up', ligne: '' },
};

const VERDICT: Record<Niveau, string> = {
  alerte: 'Au moins un point exige une action',
  inconnu: 'Une source n’a pas pu être lue : rien ne peut être affirmé sur elle',
  attention: 'Des points sont à surveiller',
  ok: 'Tout ce qui est surveillé est à jour',
};

const DOMAINES: Array<{ id: Domaine; titre: string; sousTitre: string }> = [
  { id: 'envois', titre: 'Envois', sousTitre: 'Alertes, dossiers, réponses de contact, réseaux sociaux.' },
  { id: 'taches', titre: 'Tâches planifiées', sousTitre: 'Workflows GitHub et commandes du scraper.' },
  { id: 'donnees', titre: 'Fraîcheur des données', sousTitre: 'Cours, indices, carnet, vidéo, dividendes, tests.' },
];

function Badge({ niveau }: { niveau: Niveau }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLE[niveau].badge}`}>
      {STYLE[niveau].libelle}
    </span>
  );
}

function depuis(iso: string | null | undefined, maintenant: Date): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const min = Math.round((maintenant.getTime() - t) / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}

async function Contenu() {
  const maintenant = new Date();
  const signaux = await chargerTour(maintenant);
  const global = niveauGlobal(signaux);
  const compte = (n: Niveau) => signaux.filter((s) => s.niveau === n).length;

  return (
    <>
      <PremiumPanel className="flex flex-wrap items-center gap-4 p-5">
        <Badge niveau={global} />
        <p className="text-sm text-ivory">{VERDICT[global]}.</p>
        <p className="tabular ml-auto text-xs text-muted">
          {compte('alerte')} alerte(s) · {compte('inconnu')} inconnu(s) · {compte('attention')} à surveiller · {compte('ok')} OK
          <span className="text-faint"> — {maintenant.toISOString().slice(11, 16)} UTC</span>
        </p>
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
                    <LigneSignal key={s.id} s={s} maintenant={maintenant} />
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

function LigneSignal({ s, maintenant }: { s: Signal; maintenant: Date }) {
  const succes = depuis(s.dernierSucces, maintenant);
  const externe = s.lien?.startsWith('https://') ?? false;
  // Défense en profondeur : seuls un lien https ou un chemin interne sont rendus
  // (jamais `javascript:` ni `//hôte`), même si les sources sont aujourd'hui sûres.
  const lienSur = s.lien && (externe || /^\/(?!\/)/.test(s.lien)) ? s.lien : null;
  return (
    <li className={`flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-4 ${STYLE[s.niveau].ligne}`}>
      <div className="sm:w-28 sm:pt-0.5"><Badge niveau={s.niveau} /></div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ivory">{s.titre}</p>
        <p className="mt-0.5 text-sm text-muted">{s.detail}</p>
      </div>
      <div className="shrink-0 text-xs text-faint sm:text-right">
        {succes && <p>Dernier succès : {succes}</p>}
        {lienSur && (
          <a
            href={lienSur}
            className="text-accent hover:underline"
            {...(externe ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            Voir →
          </a>
        )}
      </div>
    </li>
  );
}
