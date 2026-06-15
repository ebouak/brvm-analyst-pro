import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import { Placeholder } from '@/components/legal/Placeholder';

export const metadata: Metadata = { title: 'Mentions légales' };

export default function MentionsLegalesPage() {
  return (
    <LegalPage title="Mentions légales" updatedAt="2026-06-15">
      <section>
        <h2>Éditeur du service</h2>
        <p>
          Le service <strong>BRVM Analyst Pro</strong> est édité par{' '}
          <Placeholder>raison sociale</Placeholder>, société{' '}
          <Placeholder>forme juridique (SARL, SAS…)</Placeholder> au capital de{' '}
          <Placeholder>montant du capital</Placeholder>, immatriculée au RCCM sous le numéro{' '}
          <Placeholder>numéro RCCM</Placeholder>, dont le siège social est situé{' '}
          <Placeholder>adresse du siège</Placeholder>.
        </p>
        <p>
          Numéro de contribuable / identifiant fiscal : <Placeholder>NCC / IFU</Placeholder>.<br />
          Adresse e-mail : <Placeholder>email de contact</Placeholder> — Téléphone :{' '}
          <Placeholder>téléphone</Placeholder>.
        </p>
      </section>

      <section>
        <h2>Directeur de la publication</h2>
        <p><Placeholder>nom du directeur de la publication</Placeholder>.</p>
      </section>

      <section>
        <h2>Hébergement</h2>
        <p>
          Application hébergée par <strong>Vercel Inc.</strong>, 340 S Lemon Ave #4133,
          Walnut, CA 91789, États-Unis (<a href="https://vercel.com">vercel.com</a>).
        </p>
        <p>
          Base de données et authentification hébergées par <strong>Supabase Inc.</strong>
          (<a href="https://supabase.com">supabase.com</a>).
        </p>
      </section>

      <section>
        <h2>Propriété intellectuelle</h2>
        <p>
          L&apos;ensemble des éléments du site (textes, analyses, interface, logos, code) est
          protégé par le droit de la propriété intellectuelle. Toute reproduction ou
          réutilisation non autorisée est interdite.
        </p>
      </section>

      <section>
        <h2>Sources de données</h2>
        <p>
          Les données de marché proviennent de la BRVM et du portail BDFIN. BRVM Analyst Pro
          n&apos;est ni affilié ni endossé par la BRVM. Les données sont fournies sans garantie
          d&apos;exhaustivité ni d&apos;exactitude.
        </p>
      </section>
    </LegalPage>
  );
}
