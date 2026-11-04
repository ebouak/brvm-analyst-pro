import type { Metadata } from 'next';
import { Info } from 'lucide-react';
import { CadreComparateur } from '@/components/comparateur-sgi/cadre/Cadre';
import { CriteresSgi, FaqSgi } from '@/components/comparateur-sgi/GuideSgi';
import { chargerSgi } from '@/lib/sgi-frais/chargement';

export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.westbourse.com';

export const metadata: Metadata = {
  title: 'Méthodologie du comparateur de SGI',
  description:
    'Sources, niveaux de fiabilité et règles de calcul du comparateur de SGI WESTBOURSE : barèmes homologués AMF-UMOA, commissions BRVM et DC/BR, paliers, limites.',
  alternates: { canonical: `${SITE_URL}/comparateur-sgi/methodologie` },
};

function Regle({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h3 className="mb-1.5 font-display text-[1.05rem] text-ivory">{titre}</h3>
      <div className="text-[14.5px] leading-relaxed text-muted">{children}</div>
    </div>
  );
}

export default async function MethodologiePage() {
  const { stats } = await chargerSgi();
  return (
    <CadreComparateur
      nbSgi={stats.sgi}
      entete={{
        titre: 'Méthodologie',
        sousTitre: 'D’où viennent les chiffres, comment ils sont calculés, et ce qu’ils ne disent pas.',
        icone: Info,
        filAriane: true,
      }}
    >
      <section aria-labelledby="titre-sources" className="space-y-4">
        <p className="overline text-gold-2">Sources et calcul</p>
        <h2 id="titre-sources" className="font-display text-xl text-ivory">Comment le coût est calculé</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Regle titre="Des barèmes officiels d’abord">
            {stats.baremesHomologues} barèmes sur {stats.sgi} SGI sont lus dans la décision d’homologation de
            l’AMF-UMOA, dont {stats.baremesAvecDecision} avec le lien vers le PDF publié par la BRVM. Les autres
            sont marqués « agrégé, à confirmer » ; une SGI sans barème connu n’est jamais classée.
          </Regle>
          <Regle titre="Les postes comptés">
            Courtage et commissions BRVM (0,2 %) et DC/BR (0,1 %), sur chaque achat et chaque vente ; droits de
            garde sur la valeur du portefeuille ; tenue de compte sur la durée. Les frais ponctuels (transfert,
            clôture, nantissement) ne sont pas comptés.
          </Regle>
          <Regle titre="Le montant d’un ordre">
            Courtage et commissions portent sur le montant moyen d’un ordre (par défaut : capital divisé par le
            nombre d’achats), la garde sur le capital investi.
          </Regle>
          <Regle titre="Tranches et fourchettes">
            Quand un barème fixe le taux selon le montant, la tranche correspondant à votre ordre ou à votre
            portefeuille est appliquée. Quand seule une fourchette est publiée, la borne haute est retenue :
            le coût n’est jamais sous-estimé.
          </Regle>
          <Regle titre="Barèmes incomplets">
            Si le courtage, la garde ou la tenue de compte manque, le coût affiché est incomplet : la SGI est
            classée après les barèmes complets et n’est jamais présentée comme la moins chère.
          </Regle>
          <Regle titre="Hors taxes">
            Les barèmes homologués sont exprimés hors taxes ; les taxes sur les commissions s’ajoutent sur
            l’avis d’opéré. Les dépôts minimums ne figurent pas dans les décisions : ce sont des repères à
            confirmer auprès de la SGI.
          </Regle>
        </div>
      </section>
      <div className="mt-12">
        <CriteresSgi />
      </div>
      <div className="mt-12">
        <FaqSgi />
      </div>
    </CadreComparateur>
  );
}
