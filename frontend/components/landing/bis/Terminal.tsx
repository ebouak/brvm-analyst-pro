import Link from 'next/link';
import { VideoSeance } from '@/components/landing/VideoSeance';
import { RatingSpotlight } from '@/components/landing/RatingSpotlight';
import { DiagnosticSpotlight } from '@/components/landing/DiagnosticSpotlight';
import type { LandingBisData } from '@/lib/landing/bisData';

/**
 * Trois écrans du terminal, sous « La BRVM aujourd'hui » : la séance en
 * vidéo, la note quantitative, le diagnostic IA. Les composants existants
 * sont réutilisés TELS QUELS (sombres, encadrés) parce qu'ils portent des
 * garde-fous qu'une réécriture aurait dupliqués : verrou de publiabilité de
 * la vidéo (rien n'est affiché sans vidéo publiée), note recalculée sur les
 * sous-scores réels, diagnostic effectivement généré. La liste « ce qu'elle
 * lit / ce qu'elle ne fait pas » est celle de l'ancienne landing : chaque
 * entrée est vérifiée dans lib/diagnostic/prompt.ts et metrics.ts — ne rien
 * y ajouter qui ne soit réellement injecté dans le prompt.
 */
export function Terminal({ d, dateMarche }: { d: LandingBisData; dateMarche: string | null }) {
  return (
    <>
      {d.videoSeance && (
        <section className="etat term" aria-label="La séance en vidéo">
          <VideoSeance data={d.videoSeance} dateMarche={dateMarche} />
        </section>
      )}

      <section className="etat term" aria-label="Note quantitative">
        <RatingSpotlight signal={d.spotlightSignal} nbActions={d.nbActions} />
      </section>

      <section className="etat term" aria-label="Diagnostic IA">
        <DiagnosticSpotlight report={d.latestDiagnostic && d.latestDiagnostic.generated_at && d.latestDiagnostic.markdown_content ? { code: d.latestDiagnostic.code, generated_at: d.latestDiagnostic.generated_at, markdown_content: d.latestDiagnostic.markdown_content } : null} />
        <div className="lit">
          <div>
            <p className="over">Ce qu&apos;elle lit</p>
            <ul>
              <li>Cotations et plage 52 semaines</li>
              <li>Deux exercices : résultat, bilan, trésorerie</li>
              <li>Ratios calculés en amont (ROE DuPont, marges)</li>
              <li>Presse — avec sa source, sa date et son lien</li>
            </ul>
          </div>
          <div>
            <p className="over">Ce qu&apos;elle ne fait pas</p>
            <ul>
              <li>Calculer les chiffres — ils le sont avant, par du code testé</li>
              <li>Recommander d&apos;acheter ou de vendre</li>
              <li>Prédire un cours</li>
              <li>Inventer une source : sans presse trouvée, elle écrit « non évaluable »</li>
            </ul>
          </div>
          <p className="note">Analyse façon sell-side générée à partir des données réelles de la plateforme — un outil d&apos;analyse, jamais une recommandation d&apos;achat ou de vente. <Link href="/premium/diagnostic">Voir l&apos;analyse complète →</Link></p>
        </div>
      </section>
    </>
  );
}
