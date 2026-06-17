import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/server/admin';
import ApiKeysForm from '@/components/admin/ApiKeysForm';
import { SectionHeader, PremiumPanel } from '@/components/ui/premium';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Clés API' };

export default async function ClesApiPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  if (!isAdminEmail(user.email)) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <PremiumPanel className="px-6 py-5">
          <p className="text-sm text-muted">Accès réservé à l&apos;administrateur.</p>
        </PremiumPanel>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

      {/* En-tête de page */}
      <SectionHeader
        kicker="Administration"
        title="Clés API"
        subtitle="Configurez les clés des fournisseurs IA (extraction de fondamentaux : DeepSeek, Mistral, Grok) et de Resend (envoi d'emails newsletter/individuels)."
      />

      {/* Filet or décoratif */}
      <div className="gold-rule" />

      {/* Avertissement sécurité */}
      <div className="flex items-start gap-3 rounded-card border border-warn/20 bg-warn/[0.04] px-4 py-3">
        <span className="mt-0.5 shrink-0 text-warn text-xs">▲</span>
        <p className="text-xs text-muted leading-relaxed">
          Ces clés sont stockées chiffrées côté serveur et ne transitent jamais vers le navigateur.
          Ne partagez jamais vos clés d&apos;API en dehors de cette interface.
        </p>
      </div>

      {/* Formulaire clés */}
      <div className="space-y-1.5">
        <p className="overline text-faint">Fournisseurs IA</p>
        <PremiumPanel className="p-5">
          <ApiKeysForm />
        </PremiumPanel>
      </div>

      {/* Légende fournisseurs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { name: 'DeepSeek', role: 'Extracteur primaire', tone: 'text-sapphire border-sapphire/20 bg-sapphire/[0.04]' },
          { name: 'Mistral', role: 'Extracteur secondaire', tone: 'text-muted border-border/60 bg-surface/60' },
          { name: 'Grok', role: 'Extracteur tertiaire', tone: 'text-muted border-border/60 bg-surface/60' },
        ].map(({ name, role, tone }) => (
          <div
            key={name}
            className={`flex items-center gap-3 rounded-card border px-4 py-3 shadow-card ${tone}`}
          >
            <span className="text-[10px] font-semibold tracking-widest uppercase">{name}</span>
            <span className="text-[11px] text-faint">{role}</span>
          </div>
        ))}
      </div>

    </div>
  );
}
