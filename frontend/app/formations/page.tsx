import Link from 'next/link';
import { listFormations, type FormationCard } from '@/lib/formations/server';
import { SectionHeader } from '@/components/ui/premium';

export const metadata = { title: 'Formations & conférences — WESTBOURSE' };
export const revalidate = 300;

const TYPE_LABEL: Record<string, string> = { cours: 'Cours', conference: 'Conférence', webinaire: 'Webinaire' };
const NIVEAU_LABEL: Record<string, string> = { debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé' };
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : null;

export default async function FormationsPage() {
  const formations = await listFormations().catch(() => [] as FormationCard[]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <SectionHeader
        kicker="Académie"
        title="Formations & conférences"
        subtitle="Montez en compétence sur l'investissement à la BRVM : cours, replays et conférences. Accès réservé aux membres Premium."
      />

      {formations.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-muted">Aucune formation publiée pour l&apos;instant.</p>
          <p className="mt-1 text-xs text-faint">De nouveaux contenus arrivent prochainement.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {formations.map((f) => (
            <Link key={f.id} href={`/premium/formations/${f.id}`}
              className="group flex flex-col rounded-xl border border-border bg-surface overflow-hidden hover:border-info/40 transition">
              <div className="aspect-video bg-elevated relative">
                {f.cover_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={f.cover_url} alt="" className="h-full w-full object-cover" />
                  : <div className="h-full w-full flex items-center justify-center text-3xl opacity-40">🎓</div>}
                <span className="absolute top-2 right-2 rounded-full bg-gold/90 px-2 py-0.5 text-[10px] font-semibold text-bg">Premium</span>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-center gap-2 text-[11px] text-faint">
                  <span className="text-info">{TYPE_LABEL[f.type] ?? f.type}</span>
                  {f.niveau && <span>· {NIVEAU_LABEL[f.niveau] ?? f.niveau}</span>}
                  {f.duree_min && <span>· {f.duree_min} min</span>}
                </div>
                <h3 className="mt-1 font-display text-white group-hover:text-info transition line-clamp-2">{f.titre}</h3>
                {f.description && <p className="mt-1 text-xs text-muted line-clamp-2">{f.description}</p>}
                <div className="mt-auto pt-3 flex items-center justify-between text-[11px]">
                  <span className="text-faint">{fmtDate(f.date_evenement) ?? ''}</span>
                  <span className="text-info group-hover:underline">Accéder →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="text-[11px] text-faint">
        Les contenus (replays, supports) sont accessibles aux membres Premium.{' '}
        <Link href="/pricing" className="text-info hover:underline">Voir les offres →</Link>
      </p>
    </div>
  );
}
