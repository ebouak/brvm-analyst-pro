import SignalFormation from '@/components/crm/SignalFormation';

/** Seul rôle : poser la balise CRM « formation consultée » sur toutes les pages de l'Academy. */
export default function AcademyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SignalFormation />
      {children}
    </>
  );
}
