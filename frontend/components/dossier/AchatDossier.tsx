import Link from 'next/link';
import AchatChariow from '@/components/billing/AchatChariow';
import type { AccesDossier } from '@/lib/dossier/accesPur';

export default function AchatDossier({
  code,
  connecte,
  acces,
  disponible,
}: {
  code: string;
  connecte: boolean;
  acces: AccesDossier;
  disponible: boolean;
}) {
  if (acces.complet) {
    return (
      <section className="dossier-achat dossier-achat--ouvert">
        <p className="dossier-achat__kicker">{acces.motif === 'premium' ? 'Inclus avec Premium' : 'Dossier acheté'}</p>
        <h2>Le dossier complet est ouvert.</h2>
        <p>Accédez à l’édition A4 en lecture web ou téléchargez le PDF de référence.</p>
        <div>
          <Link href={`/rapports/dossier/${code}`} className="dossier-achat__primary">Lire les 9 pages</Link>
          <Link href={`/api/dossier/${code}/pdf`} className="dossier-achat__secondary">Télécharger le PDF</Link>
        </div>
      </section>
    );
  }

  if (!disponible) {
    return (
      <section className="dossier-achat dossier-achat--indisponible">
        <p className="dossier-achat__kicker">Édition en préparation</p>
        <h2>Ce dossier n’est pas achetable pour le moment.</h2>
        <p>Le PDF est absent ou trop ancien. Le bouton d’achat réapparaîtra après le prochain contrôle de fraîcheur.</p>
        <p className="dossier-achat__premium">Prix habituel : 1 500 FCFA le dossier.</p>
      </section>
    );
  }

  return (
    <section className="dossier-achat">
      <div>
        <p className="dossier-achat__kicker">Dossier complet</p>
        <h2>Continuer la lecture.</h2>
        <p>
          Neuf pages : trajectoire, valorisation, dividende, liquidité, risques, scénarios, comparables et réserves.
          Un achat, une société, accès rattaché à votre compte.
        </p>
      </div>
      <div className="dossier-achat__prix">
        <strong><span>1 500</span> FCFA</strong>
        <span>paiement unique · PDF inclus</span>
      </div>
      <div className="dossier-achat__action">
        <AchatChariow
          productCode="dossier:a4"
          subjectCode={code}
          libelle={`Dossier valeur ${code}`}
          montant={1500}
          devise="XOF"
          connecte={connecte}
          retour={`/analyses/dossiers/${code}`}
          cta="Acheter ce dossier"
        />
      </div>
      <p className="dossier-achat__premium">
        Déjà Premium ? <Link href="/account/plan">Le dossier complet est inclus dans votre accès.</Link>
      </p>
    </section>
  );
}
