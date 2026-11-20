import Link from 'next/link';

export function AvantPremiereCoris() {
  return (
    <section className="vitrine-avp" aria-labelledby="h-coris-avp">
      <Link href="/analyses/coris-bank-ipo-2027" className="vitrine-avp__image">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/analyses/coris-bank-ipo-2027/opengraph-image"
          alt="Étude WESTBOURSE de l’OPV Coris Bank Côte d’Ivoire et de la liquidité BRVM"
          width={1200}
          height={630}
        />
      </Link>
      <div className="vitrine-avp__body">
        <p className="vitrine-avp__eyebrow">Recherche WESTBOURSE · mis à jour le 20 novembre 2026</p>
        <h2 id="h-coris-avp">62,7 milliards FCFA. Une OPV Coris. Un test de liquidité.</h2>
        <p>
          L’offre CBI CI à 7 720 FCFA du 30 novembre au 4 décembre : valorisation,
          dividendes attendus, points de vigilance et effets sur la liquidité.
        </p>
        <div className="vitrine-avp__facts" aria-label="Trois chiffres clés">
          <span><strong>62,7 Md</strong> mis en vente</span>
          <span><strong>5,7×</strong> une séance observée</span>
          <span><strong>0,33 %</strong> de la capitalisation</span>
        </div>
        <Link href="/analyses/coris-bank-ipo-2027" className="vitrine-avp__cta">
          Lire l’analyse →
        </Link>
      </div>
    </section>
  );
}
