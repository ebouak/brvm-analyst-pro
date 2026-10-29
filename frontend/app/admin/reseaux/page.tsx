import { requirePermission } from '@/lib/server/rbac';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { identifiantsClient } from '@/lib/server/social';
import { siteUrl } from '@/lib/email/templates';
import { ENV_CLIENT, LIBELLE_RESEAU, RESEAUX, cheminRetour, joursRestants, type Reseau } from '@/lib/social/oauth';
import { basculerReseau, deconnecterReseau } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Réseaux sociaux — Administration' };

interface Jeton {
  reseau: Reseau;
  expire_le: string | null;
  refresh_expire_le: string | null;
  compte_nom: string | null;
  actif: boolean;
  maj_le: string;
}
interface Publication {
  cible: string;
  cible_id: string;
  reseau: string;
  statut: string;
  erreur: string | null;
  lance_le: string;
}

const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
const TON: Record<string, string> = { publie: 'text-up', echec: 'text-down', en_cours: 'text-accent', ignore: 'text-faint' };

export default async function ReseauxPage({ searchParams }: { searchParams: { ok?: string; erreur?: string } }) {
  await requirePermission('content.publish');
  const db = getServiceClient();
  const [{ data: jetons, error: eJ }, { data: pubs }] = await Promise.all([
    db.from('social_tokens').select('reseau, expire_le, refresh_expire_le, compte_nom, actif, maj_le'),
    db.from('publications_sociales').select('cible, cible_id, reseau, statut, erreur, lance_le').order('lance_le', { ascending: false }).limit(20),
  ]);
  const parReseau = new Map(((jetons ?? []) as Jeton[]).map((j) => [j.reseau, j]));
  const maintenant = new Date();
  const base = siteUrl();

  return (
    <div className="max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="font-display text-xl text-white">Réseaux sociaux</h1>
        <p className="mt-1 text-sm text-muted">
          Publication automatique des articles publiés (3 par jour et par réseau au plus, au passage de 17 h UTC) et de la
          vidéo de séance (18 h UTC). LinkedIn publie sur le profil connecté ; TikTok dépose des brouillons à valider dans
          l&apos;application. Un post ne part qu&apos;une fois ; un échec est signalé sur Telegram.
        </p>
      </div>
      {eJ && <p className="rounded-lg border border-down/40 p-3 text-sm text-down">Tables absentes : appliquez la migration 0170.</p>}
      {searchParams.ok && <p role="status" className="rounded-lg border border-up/40 p-3 text-sm text-up">{LIBELLE_RESEAU[searchParams.ok as Reseau] ?? searchParams.ok} connecté.</p>}
      {searchParams.erreur && <p role="alert" className="rounded-lg border border-down/40 p-3 text-sm text-down">{searchParams.erreur}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {RESEAUX.map((r) => {
          const j = parReseau.get(r) ?? null;
          const configure = identifiantsClient(r) != null;
          const jours = joursRestants(j?.expire_le ?? null, maintenant);
          const joursRefresh = joursRestants(j?.refresh_expire_le ?? null, maintenant);
          // LinkedIn n'a pas de jeton de rafraîchissement : c'est son jeton d'accès qui expire.
          const echeance = r === 'linkedin' ? jours : joursRefresh;
          return (
            <section key={r} className="space-y-3 rounded-panel border border-border bg-surface p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-base text-ivory">{LIBELLE_RESEAU[r]}</h2>
                {j ? (
                  <span className={`text-xs ${j.actif ? 'text-up' : 'text-faint'}`}>{j.actif ? 'Publication active' : 'Publication coupée'}</span>
                ) : (
                  <span className="text-xs text-faint">Non connecté</span>
                )}
              </div>
              {j ? (
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-muted">Compte</dt><dd className="text-ivory">{j.compte_nom ?? '—'}</dd></div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">{r === 'linkedin' ? 'Jeton valable' : 'Connexion valable'}</dt>
                    <dd className={`tabular ${echeance != null && echeance <= 10 ? 'text-down' : 'text-ivory'}`}>
                      {echeance == null ? '—' : echeance < 0 ? 'expiré, reconnectez' : `${echeance} j`}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3"><dt className="text-muted">Connecté le</dt><dd className="tabular text-ivory">{DATE.format(new Date(j.maj_le))}</dd></div>
                </dl>
              ) : null}
              {!configure && (
                <p className="text-xs text-down">
                  Variables {ENV_CLIENT[r].id} et {ENV_CLIENT[r].secret} absentes sur Vercel.
                </p>
              )}
              <p className="break-all text-[11px] text-faint">URL de retour à déclarer : {base}{cheminRetour(r)}</p>
              <div className="flex flex-wrap gap-2">
                <a href={`/api/admin/reseaux/${r}/connexion`} className={`rounded-lg border border-accent/40 px-3 py-1.5 text-xs text-accent hover:bg-accent/10 ${configure ? '' : 'pointer-events-none opacity-40'}`}>
                  {j ? 'Reconnecter' : 'Connecter'}
                </a>
                {j && (
                  <form action={basculerReseau.bind(null, r, !j.actif)}>
                    <button className="rounded-lg border border-border px-3 py-1.5 text-xs text-ivory hover:bg-white/[0.06]">{j.actif ? 'Couper la publication' : 'Réactiver'}</button>
                  </form>
                )}
                {j && (
                  <form action={deconnecterReseau.bind(null, r)}>
                    <button className="rounded-lg border border-down/40 px-3 py-1.5 text-xs text-down hover:bg-down/10">Déconnecter</button>
                  </form>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <section className="rounded-panel border border-border bg-surface p-5">
        <h2 className="font-display text-base text-ivory">Dernières publications</h2>
        {(pubs ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-faint">Aucune publication pour le moment.</p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-faint">
                <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Réseau</th><th className="py-2 pr-3">Contenu</th><th className="py-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {((pubs ?? []) as Publication[]).map((p) => (
                <tr key={`${p.cible}-${p.cible_id}-${p.reseau}`} className="border-b border-border/40 align-top">
                  <td className="tabular py-2 pr-3 text-muted">{DATE.format(new Date(p.lance_le))}</td>
                  <td className="py-2 pr-3 text-ivory">{LIBELLE_RESEAU[p.reseau as Reseau] ?? p.reseau}</td>
                  <td className="py-2 pr-3 text-muted">{p.cible === 'video' ? `Vidéo du ${p.cible_id}` : `Article ${p.cible_id.slice(0, 8)}`}</td>
                  <td className="py-2">
                    <span className={TON[p.statut] ?? 'text-faint'}>{p.statut}</span>
                    {p.erreur && <p className="text-xs text-faint">{p.erreur}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
