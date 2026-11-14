import Link from 'next/link';
import { Download, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { SectionHeader, EmptyStatePremium } from '@/components/ui/premium';
import ViewTabs from '@/components/ViewTabs';
import { REPORT_TABS } from '@/lib/reportTabs';
import { fmtDateCourte } from '@/lib/format';
import { fcfa, libelleMois, lireReleve, pourcentSigne, tonVariation } from '@/lib/releve/affichage';

export const metadata = {
  title: 'Mon relevé',
};

// Données privées du propriétaire : jamais de cache partagé.
export const dynamic = 'force-dynamic';

interface LigneBibliotheque {
  id: string;
  month: string;
  report_url: string | null;
  report_json: unknown;
  sent_at: string | null;
  created_at: string;
}

const majuscule = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export default async function BibliothequeRelevesPage() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <p className="text-muted">Veuillez vous connecter pour accéder à vos relevés.</p>
      </div>
    );
  }

  // Colonnes listées une à une : le SELECT de `rendu_jeton_*` est refusé au propriétaire (migration 0233).
  const { data, error } = await supabase
    .from('monthly_reports')
    .select('id, month, report_url, report_json, sent_at, created_at')
    .eq('user_id', user.id)
    .order('month', { ascending: false });

  const releves = (data ?? []) as LigneBibliotheque[];

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        <SectionHeader
          title="Mon relevé mensuel"
          subtitle="Où en est votre portefeuille : valeur, variation, dividendes, publications et rendez-vous du mois suivant."
        />
        <div className="mt-4">
          <ViewTabs tabs={REPORT_TABS} current="/premium/reports" />
        </div>

        {error ? (
          <div className="mt-8">
            <EmptyStatePremium
              title="Vos relevés sont momentanément indisponibles"
              hint="La lecture a échoué. Réessayez dans quelques minutes."
            />
          </div>
        ) : releves.length === 0 ? (
          <div className="mt-8">
            <EmptyStatePremium
              title="Votre premier relevé arrive le 2 du mois prochain"
              hint="Il est produit à partir de vos positions. Ajoutez-en dans votre portefeuille : le mois suivant, vous recevez la valeur, la variation, la contribution de chaque ligne, les dividendes et les rendez-vous à venir."
              action={{ href: '/portefeuille', label: 'Ajouter une position' }}
            />
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {releves.map((rel) => {
              const r = lireReleve(rel.report_json);
              const nom = majuscule(libelleMois(rel.month));

              if (!r) {
                return (
                  <li key={rel.id} className="rounded-card border border-border bg-surface p-4 sm:p-5">
                    <h3 className="text-base font-semibold text-ivory">{nom}</h3>
                    <p className="mt-1 text-xs text-muted">Ancien format (portefeuille simulé) : pas de version imprimable.</p>
                  </li>
                );
              }

              const ton = tonVariation(r.resume.variation_pct);
              return (
                <li key={rel.id} className="rounded-card border border-border bg-surface p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold text-ivory">
                        <Link href={`/rapports/releve/${rel.id}`} className="hover:text-accent-ink transition-colors">
                          {nom}
                        </Link>
                      </h3>
                      <p className="mt-1 text-xs text-muted">
                        {r.type === 'simule' ? 'Portefeuille simulé' : 'Portefeuille réel'}
                        {' · '}édité le {fmtDateCourte(r.genere_le)}
                        {rel.sent_at ? ` · envoyé le ${fmtDateCourte(rel.sent_at)}` : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-5 text-xs">
                      <div>
                        <p className="text-muted text-[11px] mb-0.5">Valeur de fin de mois</p>
                        <p className="tabular font-semibold text-ivory">
                          {r.resume.valeur_fin != null ? `${fcfa(r.resume.valeur_fin)} FCFA` : 'non disponible'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted text-[11px] mb-0.5">Variation</p>
                        <p className={`tabular font-semibold ${ton === 'hausse' ? 'text-up' : ton === 'baisse' ? 'text-down' : 'text-ivory'}`}>
                          {pourcentSigne(r.resume.variation_pct) ?? 'non disponible'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/rapports/releve/${rel.id}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-ivory hover:border-accent-ink/40 transition-colors"
                        >
                          <FileText size={14} aria-hidden /> Consulter
                        </Link>
                        {rel.report_url ? (
                          <a
                            href={`/api/releve/${rel.id}/pdf`}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-ivory hover:border-accent-ink/40 transition-colors"
                          >
                            <Download size={14} aria-hidden /> PDF
                          </a>
                        ) : (
                          <span className="text-[11px] text-faint">PDF en préparation</span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
