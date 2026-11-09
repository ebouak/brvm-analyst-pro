import Link from 'next/link';
import { fmtDateCourte } from '@/lib/format';
import { notFound } from 'next/navigation';
import { createPublicClient } from '@/lib/supabase/public';
import { decomposerScore, calculeEstAncien } from '@/lib/fiche/quant';
import { traduireNote, raisonAffichable, chaineGardeFous, penaliteRetiree, noteEcartArrondi, libelleClasse, SEUILS_CLASSES } from '@/lib/fiche/quantTextes';
import SousPageNav from '@/components/sousPage/SousPageNav';
import { SectionHeader, PremiumPanel, StatPill, EmptyStatePremium } from '@/components/ui/premium';

export const revalidate = 300;

const Nb = ({ children }: { children: React.ReactNode }) => <span className="tabular">{children}</span>;
const fr = libelleClasse;
const cf = (c: string) => (c === 'high' ? 'Élevée' : c === 'medium' ? 'Moyenne' : c === 'low' ? 'Faible' : 'Insuffisante');
const ef = (s: string) => (s === 'eligible' ? 'Éligible' : s === 'eligible_with_warning' ? 'Éligible (réserve)' : 'Non éligible');
// Un niveau de score n'est pas une variation de cours : pas de vert/rouge, la valeur reste en texte principal.
const tone = (v: number | null) => (v == null ? 'text-faint' : 'text-ivory');
const barC = (v: number | null) => (v == null ? 'bg-border' : 'bg-muted');
function sigC(c: string) {
  if (c === 'Strong Buy Quant') return 'border-up/30 bg-up/5 text-up';
  if (c === 'Buy Quant') return 'border-up/20 bg-up/[0.07] text-up';
  if (c === 'Watchlist / Neutral') return 'border-warn/30 bg-warn/10 text-warn';
  if (c === 'Reduce / Avoid') return 'border-down/20 bg-down/5 text-down';
  if (c === 'High Risk / Avoid') return 'border-down/30 bg-down/15 text-down';
  return 'border-border bg-elevated text-faint';
}

type Pen = { code: string; label: string; points: number; reason: string };
type Ligne = {
  combined_alpha_score: number | null; price_momentum_score: number | null; value_score: number | null;
  earnings_quality_score: number | null; financial_strength_score: number | null; dividend_quality_score: number | null;
  liquidity_score: number | null; classification: string; confidence_level: string; eligibility_status: string;
  penalties_json: unknown; calculation_notes: unknown; score_date: string; rank_global: number | null;
};

export default async function QuantSecurityPage({ params }: { params: { code: string } }) {
  const symbol = params.code.toUpperCase();
  const supabase = createPublicClient();
  const { data: inst } = await supabase.from('brvm_instruments').select('code,designation,secteur,famille_comptable').eq('code', symbol).maybeSingle();
  if (!inst) notFound();
  const i = inst as { code: string; designation: string | null; secteur: string | null; famille_comptable: string | null };
  // Toujours afficher la fiche WB_COMBINED_ALPHA (pas WB_PRICE_MOMENTUM) : sinon SNTS affichait "Strong Positive Momentum" au lieu du profil quant favorable.
  const { data: runCA } = await supabase.from('quant_model_runs').select('id').eq('model_code', 'WB_COMBINED_ALPHA').order('calculation_date', { ascending: false }).limit(1).maybeSingle();
  const runId = (runCA as { id: string } | null)?.id ?? null;
  const { data: scores } = runId
    ? await supabase.from('quant_model_scores').select('*').eq('security_id', symbol).eq('run_id', runId).order('score_date', { ascending: false }).limit(3)
    : { data: null } as { data: null };
  const latest = scores?.[0] as unknown as Ligne | undefined;
  // Dénominateur du rang : nombre de valeurs classées dans ce calcul.
  const { count: nbClassees } = runId
    ? await supabase.from('quant_model_scores').select('security_id', { count: 'exact', head: true }).eq('run_id', runId).not('rank_global', 'is', null)
    : { count: null };
  const { data: derniere } = await supabase.from('brvm_actions_daily').select('date_marche').eq('code', symbol).order('date_marche', { ascending: false }).limit(1).maybeSingle();
  const derniereSeance = (derniere as { date_marche: string } | null)?.date_marche ?? null;
  const penalties = Array.isArray(latest?.penalties_json) ? (latest!.penalties_json as Pen[]) : [];
  const notes = Array.isArray(latest?.calculation_notes) ? (latest!.calculation_notes as string[]) : [];
  const pillars = latest ? [
    { label: 'Valorisation', w: '30 %', h: 'Prix bon marché ? (PER, P/B, rendement)', v: latest.value_score },
    { label: 'Momentum', w: '25 %', h: 'Tendance du cours 3/6/12 mois', v: latest.price_momentum_score },
    { label: 'Qualité bénéficiaire', w: '20 %', h: 'ROE, croissance et régularité', v: latest.earnings_quality_score },
    { label: 'Solidité financière', w: '15 %', h: 'Dette, trésorerie et couverture', v: latest.financial_strength_score },
    { label: 'Dividende', w: '10 %', h: 'Rendement et régularité', v: latest.dividend_quality_score },
  ] : [];
  const poidsNum = [30, 25, 20, 15, 10];
  const decomposition = latest ? decomposerScore(pillars.map((p, k) => ({ poids: poidsNum[k]!, valeur: p.v })), latest.combined_alpha_score) : null;
  const ancien = calculeEstAncien(latest?.score_date ?? null, derniereSeance);
  const n1 = (x: number) => x.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const dateCalcul = latest?.score_date ? fmtDateCourte(String(latest.score_date)) : null;
  const chaine = chaineGardeFous(penalties, decomposition);
  const retiree = chaine ? penaliteRetiree(chaine) : (decomposition?.penalite ?? 0);
  const noteArrondi = chaine ? noteEcartArrondi(chaine) : null;
  const rang = latest?.rank_global ? `Rang ${latest.rank_global}${nbClassees ? ` sur ${nbClassees}` : ''}` : null;
  const famille = ({ banque: 'Banque', assurance: 'Assurance', general: 'Société non financière' } as Record<string, string>)[i.famille_comptable ?? 'general'] ?? i.famille_comptable;
  const titreSection = 'text-sm font-semibold text-ivory';

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-6">
      <SousPageNav code={symbol} courant="Fiche Quant" />
      <SectionHeader
        title={`${i.code} · ${i.designation ?? i.code}`}
        subtitle={`${i.secteur ?? 'Secteur non renseigné'} · ${famille}${dateCalcul ? ` · Calcul du ${dateCalcul}` : ''}`}
        accent="gold"
        actions={latest ? (
          <div className="flex flex-wrap items-center gap-2">
            <StatPill tone={latest.eligibility_status === 'eligible' ? 'emerald' : latest.eligibility_status === 'eligible_with_warning' ? 'gold' : 'neutral'}>{ef(latest.eligibility_status)}</StatPill>
            <StatPill tone={latest.confidence_level === 'high' ? 'emerald' : latest.confidence_level === 'medium' ? 'gold' : 'neutral'}>Fiabilité {cf(latest.confidence_level)}</StatPill>
            {rang ? <StatPill tone="neutral">{rang}</StatPill> : null}
          </div>
        ) : undefined}
      />
      <div className="gold-rule" />
      <p className="text-xs"><Link href="/analyse/combined-alpha" className="text-accent-ink hover:underline">Classement Combined Alpha →</Link></p>
      {latest && ancien && derniereSeance && (
        <p role="status" className="rounded-lg border border-warn/30 bg-warn/10 px-4 py-2 text-sm text-warn">
          Calculée le {fmtDateCourte(String(latest.score_date))} : le score n’intègre pas la séance du {fmtDateCourte(derniereSeance)}.
        </p>
      )}
      {!latest ? (
        <EmptyStatePremium icon="◈" title="Données insuffisantes" hint="Score non calculable : au moins 20 séances, un momentum disponible et 3 piliers sur 4 requis. L’historique s’étoffe séance après séance." />
      ) : latest.combined_alpha_score == null ? (
        <PremiumPanel>
          <div className="space-y-3 p-6">
            <p className="text-sm font-medium text-warn">Score Combined Alpha non calculable pour {symbol}</p>
            <p className="text-sm leading-relaxed text-muted">Raison : {notes.map(traduireNote).join(' · ') || 'données insuffisantes.'} Vérifiez l’historique de cours et les états financiers.</p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Link href="/analyse/combined-alpha" className="text-xs text-accent-ink hover:underline">Voir le classement →</Link>
              <Link href={`/actions/${symbol}`} className="text-xs text-muted hover:text-ivory">Retour fiche →</Link>
            </div>
          </div>
        </PremiumPanel>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <PremiumPanel className="p-5">
              <h2 className={titreSection}>Combined Alpha</h2>
              <div className="mt-2 flex flex-wrap items-baseline gap-3">
                <span className={`tabular font-display text-5xl font-bold ${tone(latest.combined_alpha_score)}`}>{latest.combined_alpha_score}</span>
                <span className="text-sm text-faint">/ 100</span>
                <span className={`ml-auto inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${sigC(latest.classification)}`}>{fr(latest.classification)}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted">Combine les 5 piliers puis retire une pénalité de risque (25 pts au plus). {SEUILS_CLASSES}.</p>
              <p className="mt-2 text-xs text-faint">Fiabilité {cf(latest.confidence_level)} · {ef(latest.eligibility_status)}{latest.liquidity_score != null ? ` · Liquidité ${latest.liquidity_score}/100` : ''}</p>
            </PremiumPanel>
            <PremiumPanel className="p-5">
              <h2 className={titreSection}>Price Momentum</h2>
              <div className="mt-2 flex items-baseline gap-3">
                <span className={`tabular font-display text-5xl font-bold ${tone(latest.price_momentum_score)}`}>{latest.price_momentum_score ?? '—'}</span>
                {latest.price_momentum_score != null && <span className="text-sm text-faint">/ 100</span>}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted">Tendance du cours seule : 40 % 12 mois hors dernier mois + 25 % 6 mois + 15 % 3 mois + 10 % proximité du plus haut 52 semaines + 10 % pente. Pénalités de liquidité et de volatilité appliquées.</p>
            </PremiumPanel>
          </div>

          {decomposition && (
            <PremiumPanel className="space-y-3 p-5">
              <h2 className={titreSection}>Comment on arrive à {latest.combined_alpha_score}</h2>
              <dl className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-elevated/40 px-3 py-2"><dt className="text-xs text-muted">Somme pondérée des piliers</dt><dd className="tabular text-xl font-semibold text-ivory">{n1(decomposition.sommePonderee)}</dd></div>
                <div className="rounded-lg border border-border bg-elevated/40 px-3 py-2"><dt className="text-xs text-muted">Pénalité de risque retirée</dt><dd className="tabular text-xl font-semibold text-ivory">{retiree > 0 ? '−' : ''}{n1(retiree).replace(',0', '')} pts</dd>{noteArrondi && <p className="mt-0.5 text-xs text-faint">{noteArrondi}</p>}</div>
                <div className="rounded-lg border border-border bg-elevated/40 px-3 py-2"><dt className="text-xs text-muted">Score Combined Alpha</dt><dd className="tabular text-xl font-semibold text-ivory">{latest.combined_alpha_score}</dd></div>
              </dl>
              <p className="text-xs leading-relaxed text-faint">Somme pondérée − pénalité = score. Les poids des piliers manquants sont redistribués sur les autres ; la pénalité est la différence mesurée, dans la limite de 25 pts (chaîne de calcul détaillée dans « Garde-fous et notes »).</p>
            </PremiumPanel>
          )}

          <PremiumPanel className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={titreSection}>Les 5 piliers du score</h2>
              <span className="text-xs text-faint">Poids entre parenthèses, redistribués si un pilier manque</span>
            </div>
            <div className="space-y-3">
              {pillars.map((p) => (
                <div key={p.label} className="grid grid-cols-[1fr_auto] items-center gap-3 md:grid-cols-[14rem_1fr_3.5rem]">
                  <div>
                    <p className="text-sm font-medium text-ivory">{p.label} <span className="text-xs font-normal text-faint">({p.w})</span></p>
                    <p className="text-xs leading-relaxed text-faint">{p.h}</p>
                  </div>
                  <div className="relative h-2.5 rounded-full border border-border bg-elevated">
                    <div className={`h-full rounded-full transition-all ${barC(p.v)}`} style={{ width: `${p.v != null ? Math.max(4, p.v) : 0}%` }} />
                    <span aria-hidden="true" className="absolute -bottom-1 -top-1 w-px bg-ivory/50" style={{ left: '50%' }} />
                    <span aria-hidden="true" className="absolute -bottom-1 -top-1 w-px bg-ivory/50" style={{ left: '65%' }} />
                  </div>
                  <span className={`tabular text-right text-sm font-semibold ${tone(p.v)}`}>{p.v ?? '—'}</span>
                </div>
              ))}
            </div>
            <p className="text-xs leading-relaxed text-faint">Lecture : 80–100 excellent, 65–79 bon, 50–64 moyen, &lt; 50 faible. Repères verticaux à 50 et 65. Barre courte : faible mais calculé ; « — » : non calculable.</p>
          </PremiumPanel>

          <PremiumPanel className="space-y-3 p-5">
            <h2 className={titreSection}>Garde-fous et notes</h2>
            {penalties.length === 0 ? (
              <p className="text-sm text-muted">Aucune pénalité : aucun garde-fou déclenché.</p>
            ) : (
              <>
                <ul className="space-y-2">
                  {penalties.map((pe, k) => (
                    <li key={k} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-elevated/40 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-ivory">{pe.label}</p>
                        {raisonAffichable(pe, dateCalcul) && <p className="text-xs leading-relaxed text-muted">{raisonAffichable(pe, dateCalcul)}</p>}
                      </div>
                      <span className="tabular shrink-0 rounded-full border border-border-strong px-2 py-0.5 text-xs font-semibold text-ivory">−{pe.points} pts</span>
                    </li>
                  ))}
                </ul>
                {chaine && (
                  <div className="space-y-1 rounded-lg border border-border bg-elevated/30 px-3 py-3 text-xs leading-relaxed text-muted">
                    <p className="font-medium text-ivory">Chaîne de calcul</p>
                    <p>
                      Garde-fous déclenchés : <Nb>{chaine.points.map((p) => `−${p}`).join(' ')}</Nb> = <Nb>−{chaine.total}</Nb> pts.
                    </p>
                    {chaine.dansMomentum > 0 && (
                      <p>Liquidité et volatilité (<Nb>−{chaine.dansMomentum}</Nb> pts) sont déjà déduites du pilier Momentum (<Nb>{latest.price_momentum_score ?? '—'}</Nb>).</p>
                    )}
                    {chaine.risque > 0 && (
                      <p>La pénalité de risque (<Nb>−{chaine.risque}</Nb> pts, plafond <Nb>{chaine.plafond}</Nb>{chaine.risquePlafonne ? ', atteint' : ', non atteint'}) est retirée de la somme pondérée{decomposition ? <> : <Nb>{n1(decomposition.sommePonderee)} − {chaine.risque} = {n1(decomposition.sommePonderee - chaine.risque)}</Nb>, arrondi à <Nb>{latest.combined_alpha_score}</Nb></> : ''}.</p>
                    )}
                    {chaine.appliquee != null && (
                      <p>Pénalité mesurée sur le score : <Nb>−{n1(chaine.appliquee)}</Nb> pts (écart entre la somme pondérée et le score affiché, arrondi compris).</p>
                    )}
                  </div>
                )}
              </>
            )}
            {notes.length > 0 && (
              <div className="rounded-lg border border-border bg-elevated/30 px-3 py-3">
                <p className="mb-1 text-xs font-medium text-ivory">Notes</p>
                <ul className="list-inside list-disc space-y-1 text-xs leading-relaxed text-muted">{notes.map((n, k) => <li key={k}>{traduireNote(n)}</li>)}</ul>
              </div>
            )}
          </PremiumPanel>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-elevated/30 px-5 py-4">
            <p className="max-w-2xl text-xs leading-relaxed text-faint">Score quantitatif propriétaire Westbourse, indicatif et non constitutif d’un conseil en investissement. À compléter par une analyse fondamentale et votre horizon personnel.</p>
            <div className="flex gap-2">
              <Link href="/analyse/combined-alpha" className="inline-flex items-center rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ivory transition-colors hover:border-gold/40 hover:text-accent-ink">Classement complet</Link>
              <Link href="/fondamentaux" className="inline-flex items-center rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-obsidian transition-colors hover:bg-gold-soft">Fondamentaux →</Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
