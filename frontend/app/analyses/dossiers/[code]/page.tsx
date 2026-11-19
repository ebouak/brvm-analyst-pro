import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { buildDossier } from '@/lib/dossier/build';
import { construireApercu } from '@/lib/dossier/apercu';
import { accesDossier } from '@/lib/dossier/acces';
import { pdfFrais } from '@/lib/crm/jetonBonus';
import { jsonLdScript } from '@/lib/jsonLd';
import ApercuDossier from '@/components/dossier/ApercuDossier';
import AchatDossier from '@/components/dossier/AchatDossier';
import { codeSujetValide } from '@/lib/billing/chariow/regles';
import './dossier-article.css';

export const dynamic = 'force-dynamic';
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.westbourse.com';

export async function generateMetadata(props: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const code = codeSujetValide((await props.params).code);
  if (!code) return {};
  return {
    title: `Dossier valeur ${code} — WESTBOURSE Recherche`,
    description: `Deux pages ouvertes et le dossier A4 complet sur ${code} : chiffres clés, valorisation, dividende, risques et lecture méthodologique.`,
    alternates: { canonical: `${SITE}/analyses/dossiers/${code}` },
    openGraph: { type: 'article', title: `Dossier valeur ${code}`, description: `Recherche WESTBOURSE sur ${code}.` },
  };
}

function dateCourte(value: string): string {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(parsed)
    : 'Date non disponible';
}

export default async function DossierArticlePage(props: { params: Promise<{ code: string }> }) {
  const code = codeSujetValide((await props.params).code);
  if (!code) notFound();

  const supabase = createClient();
  const [{ data: auth }, dossier, acces] = await Promise.all([
    supabase.auth.getUser(),
    buildDossier(supabase, code),
    accesDossier(code),
  ]);
  if (!dossier) notFound();

  const { data: objets, error: errPdf } = await getServiceClient()
    .storage.from('dossiers')
    .list(code, { search: 'dernier.pdf' });
  if (errPdf) {
    console.error('[dossier/article] stockage illisible', { code, message: errPdf.message });
  }
  const majPdf = objets?.find((objet) => objet.name === 'dernier.pdf')?.updated_at ?? null;
  const disponible = pdfFrais(majPdf, new Date()) && !errPdf;
  const apercu = construireApercu(dossier);
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: apercu.titre,
    description: apercu.chapo,
    datePublished: dossier.genere_le,
    dateModified: majPdf ?? dossier.genere_le,
    author: { '@type': 'Organization', name: 'WESTBOURSE Recherche' },
    publisher: { '@type': 'Organization', name: 'WESTBOURSE' },
    mainEntityOfPage: `${SITE}/analyses/dossiers/${code}`,
    isAccessibleForFree: false,
  };

  return (
    <main className="dossier-article">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(article) }} />
      <header className="dossier-article__masthead">
        <Link href="/" aria-label="Accueil WESTBOURSE">WESTBOURSE</Link>
        <nav aria-label="Fil d’Ariane">
          <Link href="/analyses/dossiers">Recherche &amp; valeur</Link>
          <span aria-hidden> / </span>
          <span>{code}</span>
        </nav>
        <span>ÉDITION NUMÉRIQUE</span>
      </header>

      <article className="dossier-article__body">
        <header className="dossier-article__header">
          <div>
            <p className="dossier-article__rubrique">{dossier.identite.secteur ?? 'Marché BRVM'} · Dossier valeur</p>
            <h1>{apercu.titre}</h1>
            <p className="dossier-article__chapo">{apercu.chapo}</p>
          </div>
          <aside>
            <span>Édition du</span>
            <strong>{dateCourte(dossier.genere_le)}</strong>
            <span>Par WESTBOURSE Recherche</span>
            <span>9 pages · 2 ouvertes</span>
          </aside>
        </header>

        <ApercuDossier apercu={apercu} />

        <section className="dossier-article__transition">
          <span>02 / 09</span>
          <div>
            <p>La lecture ouverte s’arrête ici.</p>
            <h2>La suite examine ce que les deux premières pages ne peuvent pas montrer.</h2>
          </div>
          <p>
            Valorisation, qualité du résultat, risques, comparables, liquidité, scénarios, rendez-vous et réserves.
            Aucun verdict caché derrière une animation ou un texte flouté.
          </p>
        </section>

        <AchatDossier
          code={code}
          connecte={Boolean(auth.user)}
          acces={acces}
          disponible={disponible}
        />

        <footer className="dossier-article__footer">
          <p>
            Données WESTBOURSE issues des cotations, publications financières et référentiels de marché.
            Les montants absents restent signalés comme absents. Information, pas conseil en investissement.
          </p>
          <Link href="/methodologie">Méthodologie et sources →</Link>
        </footer>
      </article>
    </main>
  );
}
