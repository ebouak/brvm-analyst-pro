import { redirect } from 'next/navigation';
import { peutSuivreNiveau } from '@/lib/server/academyAccess';
import { AccessGate } from '@/components/premium/AccessGate';
import { isNiveau } from '@/lib/academy/examServer';
import ExamRunner from '@/components/academy/ExamRunner';

export const dynamic = 'force-dynamic';

export default async function ExamenPage(props: { params: Promise<{ niveau: string }> }) {
  const params = await props.params;
  if (!isNiveau(params.niveau)) redirect('/formations/academy');
  // Abonnement premium OU niveau acheté à l'unité (Chariow).
  const gate = await peutSuivreNiveau(params.niveau);
  if (!gate.allowed) {
    const required = gate.acces.abonnement.required;
    return (
      <>
        <div className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6">
          <h1 className="font-display text-3xl font-medium tracking-tight text-ivory md:text-4xl">Examen de l’Academy</h1>
        </div>
        <AccessGate required={required === 'free' ? 'premium' : required} feature="Les examens de l’Academy" hint="Validez vos acquis et obtenez un certificat." />
      </>
    );
  }
  return <ExamRunner niveau={params.niveau} />;
}
