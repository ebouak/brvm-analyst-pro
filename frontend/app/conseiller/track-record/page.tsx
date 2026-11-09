import type { Metadata } from 'next';
import Link from 'next/link';
import { EnTeteCote } from '@/components/marche/EnTeteCote';
import { Chapitre } from '@/components/fiche/Chapitre';
import { LigneSource } from '@/components/marche/LigneSource';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Comment nous avons mesuré le Conseiller',
  description:
    'Pourquoi le Conseiller WESTBOURSE ne recommande plus d\'acheter ni de vendre : la mesure, ses limites et ce que nous montrons à la place.',
};

const LIGNES: { reco: string; cas: string; sens: string; ecart: string }[] = [
  { reco: 'Acheter', cas: '363', sens: '50 %', ecart: '−1,1 pt' },
  { reco: 'Vendre', cas: '2 093', sens: '50 %', ecart: '−2,1 pt' },
  { reco: 'Conserver', cas: '985', sens: '—', ecart: '−5,0 pt' },
];

export default function TrackRecordPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <EnTeteCote
        titre="Comment nous avons mesuré le Conseiller"
        description="Ce que l'ancien moteur a donné, pourquoi nous l'avons retiré et ce que nous montrons à la place."
        source={null}
      />

      <Chapitre id="ancien" numero="01" titre="L'ancien moteur, du 19 juin au 6 novembre 2026" sousTitre="Ce qu'il combinait et ce qu'il a donné." premier />
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted">
        <p>
          Il combinait un signal quantitatif, une valorisation par flux actualisés, le RSI et le dividende. Sur 93 séances et 49 valeurs, le marché a progressé de 17,6 %. Vingt séances après chaque recommandation :
        </p>
        <div tabIndex={0} role="region" aria-label="Tableau, défilement horizontal" className="overflow-x-auto rounded-card border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-elevated/40 text-xs text-muted">
                <th scope="col" className="px-3 py-2.5 text-left font-semibold">Recommandation</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Cas</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Cours dans le bon sens</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Écart moyen au marché</th>
              </tr>
            </thead>
            <tbody>
              {LIGNES.map((l) => (
                <tr key={l.reco} className="border-b border-border/30">
                  <th scope="row" className="px-3 py-2.5 text-left font-medium text-ivory">{l.reco}</th>
                  <td className="tabular px-3 py-2.5 text-right text-ivory">{l.cas}</td>
                  <td className="tabular px-3 py-2.5 text-right text-ivory">{l.sens}</td>
                  <td className="tabular px-3 py-2.5 text-right text-ivory">{l.ecart}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Acheter et Vendre ne se distinguaient presque pas. 61 % des recommandations étaient « Vendre » en plein marché haussier : la valorisation par flux actualisés, calculée à un taux d&apos;environ 18 % et appliquée aussi aux banques, jugeait presque tout trop cher. Ces chiffres portent sur quatre périodes indépendantes seulement : ils décrivent, ils ne prouvent pas.
        </p>
      </div>

      <Chapitre id="test" numero="02" titre="Le test du nouveau moteur" sousTitre="Une règle écrite avant toute mesure." />
      <p className="mt-6 text-sm leading-relaxed text-muted">
        Avant toute mesure, nous avons écrit la règle et le critère de réussite : les valeurs à « Acheter » devaient battre le marché sur 20 séances, frais de 1,5 % déduits, sur l&apos;historique depuis 2007. Nous avons d&apos;abord vérifié si le test pouvait réussir. Il fallait un écart d&apos;au moins 26,9 % par an pour que la mesure le confirme, avec environ 46 périodes indépendantes. Aucune règle honnête n&apos;atteint ce niveau : le test ne pouvait rien prouver, nous l&apos;avons arrêté avant d&apos;en lire le résultat.
      </p>

      <Chapitre id="alternative" numero="03" titre="Ce que nous montrons à la place" sousTitre="Des faits mesurés, pas des conseils." />
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted">
        <p>
          Pour chaque valeur, sa position dans la cote du jour sur cinq familles : tendance, risque, valorisation, qualité, rendement. Ce sont des faits mesurés, pas des conseils. Nous referons le test chaque année : le jour où il pourra prouver quelque chose, nous publierons le résultat, quel qu&apos;il soit.
        </p>
        <p>
          <Link href="/conseiller" className="text-accent-ink underline underline-offset-2 hover:no-underline">Voir les positions du jour</Link>
        </p>
      </div>

      <LigneSource>Mesures du 9 novembre 2026. Ce n&apos;est pas un conseil en investissement.</LigneSource>
    </div>
  );
}
