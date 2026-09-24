import Link from 'next/link';
import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, PremiumPanel, MetricCard, EmptyStatePremium, StatPill } from '@/components/ui/premium';
import { loadCoherenceDashboard, type AnomalieOuverte } from '@/lib/admin/coherence';
import type { RegleCode } from '@/lib/coherence/regles';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cohérence des fiches — Administration' };

const DASH = '—';

/** Date seule (colonne `date`, sans heure) en français — évite le décalage de fuseau en fixant UTC des deux côtés. */
function fmtDate(iso: string | null): string {
  if (!iso) return DASH;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return DASH;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Ordre d'affichage des 4 règles, groupes « trompeuse » avant « à
 * surveiller » — reprend l'ordre documenté dans `lib/coherence/regles.ts`
 * (chaque fonction y fixe une gravité constante pour sa règle). La pastille
 * de chaque groupe, elle, relit la gravité réelle de ses lignes plutôt que
 * cette liste : si une règle future faisait varier sa gravité d'un cas à
 * l'autre, l'affichage resterait honnête sans qu'il faille toucher ici.
 */
const ORDRE_REGLES: { code: RegleCode; libelle: string }[] = [
  { code: 'notation_perimee', libelle: 'Notation périmée' },
  { code: 'publication_mal_attribuee', libelle: 'Publication mal attribuée' },
  { code: 'etiquette_contredite', libelle: 'Étiquette contredite par le sous-score' },
  { code: 'comptes_perimes', libelle: 'Comptes périmés' },
];

function GroupeRegle({ libelle, lignes }: { libelle: string; lignes: AnomalieOuverte[] }) {
  if (lignes.length === 0) return null;
  const gravite = lignes[0].gravite;

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <StatPill tone={gravite === 'trompeuse' ? 'gold' : 'neutral'}>
          {gravite === 'trompeuse' ? 'Trompeuse' : 'À surveiller'}
        </StatPill>
        <h2 className="font-display text-base text-ivory">{libelle}</h2>
        <span className="tabular text-xs text-faint">({lignes.length})</span>
      </div>
      <PremiumPanel className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-faint">
              <th className="px-4 py-3 font-medium">Valeur</th>
              <th className="px-4 py-3 font-medium">Constat</th>
              <th className="px-4 py-3 font-medium">Détectée le</th>
              <th className="px-4 py-3 font-medium">Preuve</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((a) => (
              <tr key={a.id} className="border-b border-border/40 align-top last:border-0">
                <td className="whitespace-nowrap px-4 py-2.5">
                  <Link href={`/actions/${a.code}`} className="text-accent hover:underline">
                    {a.code}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-ivory">{a.message}</td>
                <td className="tabular whitespace-nowrap px-4 py-2.5 text-muted">{fmtDate(a.detectee_le)}</td>
                <td className="px-4 py-2.5">
                  {a.preuve == null ? (
                    <span className="text-xs text-faint">{DASH}</span>
                  ) : (
                    // Repliée par défaut : le message suffit à la lecture courante,
                    // la preuve sert à VÉRIFIER l'anomalie, pas à la répéter.
                    <details>
                      <summary className="cursor-pointer text-xs text-faint hover:text-muted">Détail</summary>
                      <pre className="tabular mt-2 max-w-md overflow-x-auto rounded-lg border border-border bg-elevated p-2 text-[11px] text-muted">
                        {JSON.stringify(a.preuve, null, 2)}
                      </pre>
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </PremiumPanel>
    </div>
  );
}

export default async function Page() {
  // Ces anomalies portent sur des données déjà collectées (notation,
  // publications, comptes) et leur cohérence mutuelle — même nature que le
  // monitoring scraping (app/admin/scraping), pas du contenu éditorial :
  // `content.read` couvre les actualités/communiqués saisis à la main,
  // un sujet différent. `data_admin` et `support_admin` ont déjà les deux.
  await requirePermission('scraping.read');

  const { etat, anomalies, dernierBalayage, kpis, erreurMessage } = await loadCoherenceDashboard();

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader
        kicker="Administration"
        title="Cohérence des fiches société"
        subtitle="Contradictions entre les blocs d'une même fiche : notation périmée, étiquette technique démentie par son propre sous-score, publication mal attribuée à une autre société cotée, comptes plus anciens que les publications disponibles. Alimenté par le balayage hebdomadaire."
      />
      <div className="gold-rule" />

      {etat === 'table_absente' && (
        <EmptyStatePremium
          icon="⏳"
          title="Table pas encore créée"
          hint="La migration 0141_coherence_et_flag_lecture_seance.sql n'est pas encore appliquée en base : il n'y a rien à lire pour l'instant, ni en bien ni en mal."
        />
      )}

      {etat === 'erreur' && (
        <EmptyStatePremium
          icon="◌"
          title="Lecture impossible"
          hint={`La lecture des anomalies a échoué${erreurMessage ? ` (${erreurMessage})` : ''}. Ceci n'est pas une preuve d'absence d'anomalie — c'est une panne de la console, pas un constat sur les données.`}
        />
      )}

      {etat === 'jamais_balaye' && (
        <EmptyStatePremium
          icon="◇"
          title="Aucune trace de balayage"
          hint="La table ne contient aucune ligne, ouverte ou résolue. Un passage qui ne trouve aucune anomalie n'écrit rien (« zéro anomalie n'est pas un échec ») : impossible de distinguer, depuis cette seule table, « le balayage n'a jamais tourné » de « il a tourné et n'a jamais rien trouvé ». Dans les deux cas, ce silence n'est pas un satisfecit."
        />
      )}

      {etat === 'balaye' && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard
              label="Trompeuses ouvertes"
              value={String(kpis.trompeuses)}
              accent={kpis.trompeuses > 0 ? 'gold' : 'neutral'}
            />
            <MetricCard
              label="À surveiller (ouvertes)"
              value={String(kpis.aSurveiller)}
              accent={kpis.aSurveiller > 0 ? 'sapphire' : 'neutral'}
            />
            <MetricCard label="Valeurs concernées" value={String(kpis.valeursConcernees)} accent="neutral" />
            <MetricCard label="Dernière anomalie détectée" value={fmtDate(dernierBalayage)} accent="neutral" />
          </div>

          {anomalies.length === 0 ? (
            <EmptyStatePremium
              icon="✦"
              title="Aucune anomalie ouverte"
              hint={`Dernière anomalie détectée le ${fmtDate(dernierBalayage)}, désormais résolue. Un passage propre n'écrivant rien, ceci ne certifie pas qu'un balayage ait eu lieu depuis cette date — seulement qu'aucune anomalie n'est restée ouverte.`}
            />
          ) : (
            <div className="space-y-6">
              {ORDRE_REGLES.map(({ code, libelle }) => (
                <GroupeRegle key={code} libelle={libelle} lignes={anomalies.filter((a) => a.regle === code)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
