import { can, requirePermission } from '@/lib/server/rbac';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { loadOpsSettings } from '@/lib/admin/opsSettings';
import { isTestSender } from '@/lib/server/email';
import { SectionHeader } from '@/components/ui/premium';
import SettingsClient, { type IntegrationStatus } from './SettingsClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Paramètres — Administration' };

export default async function AdminSettingsPage() {
  const ctx = await requirePermission('settings.read');
  const canEdit = can(ctx, 'settings.write');
  const initial = await loadOpsSettings(getServiceClient());

  const integrations: IntegrationStatus[] = [
    {
      cle: 'TELEGRAM_OPS_BOT_TOKEN',
      libelle: 'Bot Telegram Ops dédié',
      configure: Boolean(process.env.TELEGRAM_OPS_BOT_TOKEN),
      detail: 'Jeton du bot d’orchestration admin (@BotFather).',
    },
    {
      cle: 'TELEGRAM_OPS_WEBHOOK_SECRET',
      libelle: 'Secret webhook Telegram Ops',
      configure: Boolean(process.env.TELEGRAM_OPS_WEBHOOK_SECRET),
      detail: 'En-tête X-Telegram-Bot-Api-Secret-Token comparé à temps constant.',
    },
    {
      cle: 'TELEGRAM_OPS_ADMIN_CHAT_IDS',
      libelle: 'Liste blanche admins Telegram',
      configure: Boolean(
        process.env.TELEGRAM_OPS_ADMIN_CHAT_IDS ||
          process.env.TELEGRAM_CHAT_ID ||
          initial.adminTelegramChatIds.length > 0,
      ),
      detail: 'Chat IDs autorisés à piloter la plateforme depuis Telegram.',
    },
    {
      cle: 'GITHUB_OPS_TOKEN',
      libelle: 'Déclenchement GitHub Actions (workflow_dispatch)',
      configure: Boolean(process.env.GITHUB_OPS_TOKEN),
      detail: 'PAT finement scopé Actions:Write sur le dépôt.',
    },
    {
      cle: 'OPS_CALLBACK_SECRET',
      libelle: 'Callback de fin de workflow GitHub',
      configure: Boolean(process.env.OPS_CALLBACK_SECRET && process.env.OPS_CALLBACK_SECRET.length >= 32),
      detail: 'Authentifie POST /api/ops/callback (≥ 32 caractères).',
    },
    {
      cle: 'BLAND_API_KEY',
      libelle: 'Assistant vocal critique (Bland)',
      configure: Boolean(process.env.BLAND_API_KEY && process.env.BLAND_HASH_SECRET),
      detail: 'Appels vocaux d’escalade et rappels support.',
    },
    {
      cle: 'RESEND',
      libelle: 'Emails Resend (domaine vérifié)',
      configure: Boolean(process.env.RESEND_API_KEY) && !isTestSender(),
      detail: isTestSender()
        ? 'Expéditeur encore sur onboarding@resend.dev : tiers bloqués.'
        : 'Expéditeur vérifié configuré.',
    },
    {
      cle: 'WAHA',
      libelle: 'Passerelle WhatsApp (WAHA / Meta)',
      configure: Boolean((process.env.WAHA_URL && process.env.WAHA_API_KEY) || process.env.WHATSAPP_TOKEN),
      detail: 'Envoi de relances, récaps et support WhatsApp.',
    },
    {
      cle: 'RECAP_SECRET',
      libelle: 'Signature images Edge (Récap & Carte Pulse)',
      configure: ((process.env.OPS_PULSE_SECRET ?? process.env.RECAP_SECRET)?.length ?? 0) >= 32,
      detail: 'Liens signés HMAC-SHA256 pour le rendu PNG Edge.',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader
        title="Paramètres & Intégrations"
        subtitle="Réglages de l’orchestrateur Ops, escalade vocale et état de configuration des canaux."
      />
      <div className="gold-rule" />
      <SettingsClient initial={initial} canEdit={canEdit} integrations={integrations} />
    </div>
  );
}
