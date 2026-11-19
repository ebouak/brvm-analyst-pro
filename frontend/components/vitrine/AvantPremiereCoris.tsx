import Link from 'next/link';

export function AvantPremiereCoris() {
  return (
    <section className="vitrine-avp" aria-labelledby="h-coris-avp">
      <Link href="/analyses/coris-bank-ipo-2027" className="vitrine-avp__image">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/analyses/coris-bank-ipo-2027/opengraph-image"
          alt="Étude WESTBOURSE sur les deux IPO Coris et la liquidité BRVM"
          width={1200}
          height={630}
        />
      </Link>
      <div className="vitrine-avp__body">
        <p className="vitrine-avp__eyebrow">Avant-première · Recherche WESTBOURSE · 19 novembre 2026</p>
        <h2 id="h-coris-avp">81 milliards FCFA. Deux IPO Coris. Un test de liquidité.</h2>
        <p>
          Mesure des flux potentiels, précédent Bridge Bank, comportement autour des
          dividendes et simulateur WPLI.
        </p>
        <div className="vitrine-avp__facts" aria-label="Trois chiffres clés">
          <span><strong>81 Md</strong> annoncés</span>
          <span><strong>7,3×</strong> une séance observée</span>
          <span><strong>0,42 %</strong> de la capitalisation</span>
        </div>
        <Link href="/analyses/coris-bank-ipo-2027" className="vitrine-avp__cta">
          Lire l’analyse →
        </Link>
      </div>
    </section>
  );
}
