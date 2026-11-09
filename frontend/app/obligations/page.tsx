import { createPublicClient } from '@/lib/supabase/public';
import ObligationsTable, { type ObligationRow } from '@/components/ObligationsTable';
import type { ObligationDaily } from '@/lib/types';
// Source UNIQUE du calcul (ligne, YTM, moyenne) : le bloc « Le marché
// aujourd'hui » du tableau de bord lit la même, les deux chiffres concordent.
import { syntheseObligations, versLigneObligation } from '@/lib/marche/obligations';
import {
  PremiumPanel,
  MetricCard,
  EmptyStatePremium,
} from '@/components/ui/premium';
import { EnTeteCote } from '@/components/marche/EnTeteCote';
import { SommaireChapitres } from '@/components/marche/SommaireChapitres';
import { LigneSource } from '@/components/marche/LigneSource';
import { Chapitre } from '@/components/fiche/Chapitre';

/** 6.1234 → « 6,12 % » ; absent → « — ». */
function pctFr(v: number | null): string {
  if (v == null) return '—';
  return `${v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
}

export const revalidate = 300;
export const metadata = { title: 'Obligations' };

/** "2026-11-03" → "3 nov. 2026" (affichage seul ; la donnée reste ISO). */
function fmtSeance(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

async function getData() {
  const supabase = createPublicClient();

  const { data: lastRow } = await supabase
    .from('brvm_obligations_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);

  const lastDate = lastRow?.[0]?.date_marche ?? null;
  if (!lastDate) return { lastDate: null, active: [] as ObligationRow[], expired: [] as ObligationRow[], avgBondYtm: null };

  const { data } = await supabase
    .from('brvm_obligations_daily')
    .select('*')
    .eq('date_marche', lastDate);

  const obls = (data ?? []) as ObligationDaily[];
  // YTM moyen = actives, non amorties, YTM plausible (règles dans lib/marche/obligations).
  const { actives: active, echues: expired, ytmMoyen: avgBondYtm } = syntheseObligations(obls.map((o) => versLigneObligation(o)));

  return { lastDate, active, expired, avgBondYtm };
}

export default async function ObligationsPage() {
  const { lastDate, active, expired, avgBondYtm } = await getData();

  if (!lastDate) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        <EnTeteCote
          titre="Marché obligataire"
          description="Rendement à l’échéance (YTM), duration modifiée et courbe des taux des obligations cotées à la BRVM."
          source={null}
        />
        <div className="mt-8">
          <EmptyStatePremium
            icon="◎"
            title="Aucune donnée obligataire"
            hint="Les obligations apparaîtront ici dès la publication de la prochaine séance."
          />
        </div>
      </div>
    );
  }

  const withYtm = active.filter((r) => r.ytm != null).length;
  const ytms = active.map((r) => r.ytm).filter((y): y is number => y != null);
  const minYtm = ytms.length ? Math.min(...ytms) : null;
  const maxYtm = ytms.length ? Math.max(...ytms) : null;

  const chapitres = [
    { id: 'actives', label: 'Obligations actives' },
    ...(expired.length > 0 ? [{ id: 'echues', label: 'Obligations échues' }] : []),
    { id: 'methode', label: 'Méthode et fiscalité' },
  ];
  const num = (id: string) => String(chapitres.findIndex((c) => c.id === id) + 1).padStart(2, '0');

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <EnTeteCote
        titre="Marché obligataire"
        description="Rendement à l’échéance (YTM) et duration modifiée des obligations cotées à la BRVM."
        seance={lastDate}
        compte={{ n: active.length, libelle: `actives · ${expired.length} échues` }}
      />
      <SommaireChapitres chapitres={chapitres} />

      <Chapitre
        id="actives"
        numero={num('actives')}
        titre="Obligations actives"
        sousTitre="Lignes dont l’échéance n’est pas encore passée, avec leur rendement à l’échéance."
        premier
      />

      {/* KPI cards */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="YTM moyen" value={pctFr(avgBondYtm)} accent="gold" />
        <MetricCard label="YTM min" value={pctFr(minYtm)} accent="emerald" />
        <MetricCard label="YTM max" value={pctFr(maxYtm)} accent="sapphire" />
        <MetricCard label="Avec YTM calculé" value={`${withYtm} / ${active.length}`} accent="neutral" />
      </div>

      {/* Note sur les obligations amorties (repliée : elle occupait l'en-tête) */}
      <details className="group mt-4 text-xs text-faint leading-relaxed">
        <summary className="cursor-pointer text-muted hover:text-ivory py-0.5">
          Pourquoi certains rendements sont « N/A » ?
        </summary>
        <p className="mt-1.5">
          <strong className="text-warn">YTM N/A</strong> = obligation à amortissement partiel (prix {`<`} 8 000 FCFA) : le capital remboursé périodiquement rend le calcul YTM non fiable avec nominal 10 000 FCFA.
          Les obligations cotées &quot;Au pair&quot; (cours ≈ 10 000 FCFA) ont un YTM ≈ coupon nominal.
        </p>
      </details>

      <div className="mt-4">
        {active.length > 0 ? (
          <PremiumPanel>
            <div className="p-5">
              <ObligationsTable rows={active} title="obligations actives" />
            </div>
          </PremiumPanel>
        ) : (
          <EmptyStatePremium
            icon="◎"
            title="Aucune obligation active"
            hint="Toutes les obligations listées ont une échéance dépassée."
          />
        )}
        <LigneSource>
          Cours publiés par la BRVM, séance du <time dateTime={lastDate}>{fmtSeance(lastDate)}</time> · YTM et duration calculés par WESTBOURSE.
        </LigneSource>
      </div>

      {expired.length > 0 && (
        <>
          <Chapitre
            id="echues"
            numero={num('echues')}
            titre="Obligations échues"
            sousTitre="Lignes encore présentes dans la cote alors que leur échéance est passée : référence historique."
          />
          <details className="group mt-6">
            <summary className="cursor-pointer text-xs text-faint hover:text-muted flex items-center gap-2 py-2 list-none">
              <span className="border border-border rounded px-2 py-0.5 group-open:border-accent/30">
                {expired.length} obligations échues : cliquer pour afficher
              </span>
            </summary>
            <div className="mt-3">
              <PremiumPanel>
                <div className="p-5">
                  <ObligationsTable rows={expired} title="obligations échues" compact />
                </div>
              </PremiumPanel>
            </div>
          </details>
        </>
      )}

      <Chapitre
        id="methode"
        numero={num('methode')}
        titre="Méthode et fiscalité"
        sousTitre="Comment le rendement est calculé, et ce que l’impôt en retire."
      />
      <p className="mt-6 max-w-3xl text-sm text-muted leading-relaxed">
        YTM calculé par bisection (hypothèses : nominal 10 000 FCFA, coupon annuel, maturité = 31 déc. de l&apos;année de fin
        extraite de la désignation). Données source : scraper BRVM intraday.
        Fiscalité : coupons des émetteurs souverains (États, BOAD, BIDC) <strong className="text-up">exonérés</strong> de retenue,
        le YTM affiché est donc net. Obligations privées : retenue de 2&nbsp;% (Côte d&apos;Ivoire) à ~6&nbsp;% selon le pays de
        l&apos;émetteur. <a href="/fiscalite" className="text-accent-ink underline underline-offset-2">Barème et sources</a>.
      </p>
    </div>
  );
}
