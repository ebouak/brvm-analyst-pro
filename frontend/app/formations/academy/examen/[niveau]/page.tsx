import { redirect } from 'next/navigation';
import { canAccess } from '@/lib/server/featureAccess';
import { AccessGate } from '@/components/premium/AccessGate';
import { isNiveau } from '@/lib/academy/examServer';
import ExamRunner from '@/components/academy/ExamRunner';

export const dynamic = 'force-dynamic';

export default async function ExamenPage({ params }: { params: { niveau: string } }) {
  if (!isNiveau(params.niveau)) redirect('/formations/academy');
  const gate = await canAccess('formations');
  if (!gate.allowed) {
    return <AccessGate required={gate.required === 'free' ? 'premium' : gate.required} feature="Les examens de l’Academy" hint="Validez vos acquis et obtenez un certificat." />;
  }
  return <ExamRunner niveau={params.niveau} />;
}
