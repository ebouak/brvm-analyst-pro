import Link from 'next/link';
import { EnTeteCote } from '@/components/marche/EnTeteCote';
import { Chapitre } from '@/components/fiche/Chapitre';
import { LigneSource } from '@/components/marche/LigneSource';
import { EmptyStatePremium } from '@/components/ui/premium';
import { MyPortfolioAdvice } from '@/components/advisor/MyPortfolioAdvice';
import { TableauPositions } from '@/components/conseiller/TableauPositions';
import { canAccess } from '@/lib/server/featureAccess';
import { AccessGate } from '@/components/premium/AccessGate';
import { FAMILLES } from '@/lib/conseiller/facteurs';
import { lirePositions } from '@/lib/conseiller/lecture';
import { fmtDateCourte } from '@/lib/format';

export const metadata = { title: 'Conseiller BRVM' };
// Garde par utilisateur : rendu dynamique obligatoire (plus de cache partagé).
export const dynamic = 'force-dynamic';

export default async function ConseillerPage() {
  // Niveau requis LU EN BASE (feature_flags, editable dans /admin/features).
  const gate = await canAccess('conseiller');
  if (!gate.allowed) {
    return (
      <AccessGate
        required={gate.required === 'free' ? 'premium' : gate.required}
        feature="Le Conseiller"
        hint="Positions de chaque valeur par famille de facteurs."
      />
    );
  }

  let positions: Awaited<ReturnType<typeof lirePositions>> = null;
  let illisible = false;
  try {
    positions = await lirePositions();
  } catch {
    illisible = true;
  }

  if (illisible || !positions) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <EnTeteCote
          titre="Conseiller"
          description="Où se situe chaque valeur de la cote, famille par famille, sans recommandation d'achat ni de vente."
          source={null}
        />
        <div className="mt-8">
          {illisible ? (
            <EmptyStatePremium title="Positions momentanément illisibles" hint="Réessayez dans un instant." />
          ) : (
            <EmptyStatePremium title="Positions pas encore calculées" hint="Elles sont mises à jour chaque soir de séance." />
          )}
        </div>
      </div>
    );
  }

  const { date, lignes } = positions;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <EnTeteCote
        titre="Conseiller"
        description="Où se situe chaque valeur de la cote, famille par famille, sans recommandation d'achat ni de vente."
        seance={date}
        compte={{ n: lignes.length, libelle: 'valeurs' }}
        source="Calcul WESTBOURSE sur les cours et comptes publiés"
      />

      <section aria-labelledby="t-abstention" className="mt-8 rounded-card border border-border bg-surface p-5">
        <h2 id="t-abstention" className="font-display text-xl text-ivory">
          Le Conseiller s&apos;abstient de recommander d&apos;acheter ou de vendre
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Nous avons testé, sur l&apos;historique de la BRVM depuis 2007, si une règle combinant tendance, risque et valorisation battait le marché. Le marché est trop étroit pour le prouver : environ 46 périodes indépendantes seulement, et il faudrait un écart de près de 27 % par an pour que le test le confirme. Plutôt que d&apos;afficher un conseil que nous ne pouvons pas justifier, nous montrons où se situe chaque valeur, et vous décidez.
        </p>
        <p className="mt-3 text-sm">
          <Link href="/conseiller/track-record" className="text-accent-ink underline underline-offset-2 hover:no-underline">
            Comment nous l&apos;avons mesuré
          </Link>
        </p>
      </section>

      <Chapitre id="mes-positions" numero="01" titre="Mes positions" sousTitre="Vos lignes, avec leur position par famille." />
      <div className="mt-6">
        <MyPortfolioAdvice />
      </div>

      <Chapitre id="cote" numero="02" titre="Toute la cote" sousTitre="Tiers haut = tiers le plus favorable de la famille dans la cote du jour." />
      <TableauPositions lignes={lignes} />

      <dl className="mt-8 grid gap-3 text-sm sm:grid-cols-2">
        {FAMILLES.map((f) => (
          <div key={f.cle}>
            <dt className="font-medium text-ivory">{f.titre}</dt>
            <dd className="text-muted">Tiers haut : {f.haut}</dd>
          </div>
        ))}
      </dl>

      <LigneSource>
        Positions calculées par WESTBOURSE pour la séance du {fmtDateCourte(date)} à partir des cours, des comptes et des dividendes publiés. Valeurs de liquidité C ou D : cours peu échangés, positions à lire avec prudence. Ce n&apos;est pas un conseil en investissement.
      </LigneSource>
    </div>
  );
}
