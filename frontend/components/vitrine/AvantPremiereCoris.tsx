import Link from 'next/link';

export function AvantPremiereCoris() {
  return (
    <section className="vitrine-avp" aria-labelledby="h-coris-avp">
      <Link href="/analyses/coris-bank-ipo-2027" className="vitrine-avp__image">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/analyses/coris-bank-ipo-2027/opengraph-image"
          alt="Étude WESTBOURSE de l’OPV Coris Bank International Côte d’Ivoire"
          width={1200}
          height={630}
        />
      </Link>
      <div className="vitrine-avp__body">
        <p className="vitrine-avp__eyebrow">Avant-première · Recherche WESTBOURSE · 20 novembre 2026</p>
        <h2 id="h-coris-avp">OPV CBI CI : 20 % du capital à 7 720 FCFA.</h2>
        <p>
          Opération, comptes, plan d’affaires, valorisation, dividendes projetés,
          risques et effet sur la liquidité BRVM, d’après la note d’information.
        </p>
        <div className="vitrine-avp__facts" aria-label="Trois chiffres clés">
          <span><strong>62,7 Md</strong> offerts</span>
          <span><strong>12,8×</strong> le résultat 2025</span>
          <span><strong>6,7 %</strong> de rendement visé 2026</span>
        </div>
        <Link href="/analyses/coris-bank-ipo-2027" className="vitrine-avp__cta">
          Lire l’analyse →
        </Link>
      </div>
    </section>
  );
}
