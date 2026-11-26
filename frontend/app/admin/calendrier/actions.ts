'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';

export async function ajouterFerieAction(input: {
  date: string;
  holidayName: string;
  countryCode: string;
  notes?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requirePermission('scraping.configure');
  const date = input.date.trim();
  const holidayName = input.holidayName.trim();
  const countryCode = input.countryCode.trim().toUpperCase().slice(0, 2);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: 'Date invalide (format AAAA-MM-JJ attendu).' };
  }
  if (!holidayName) {
    return { ok: false, error: 'Libellé du jour férié requis.' };
  }

  const db = getServiceClient();
  const { error } = await db.from('market_calendar').upsert(
    {
      date,
      is_trading_day: false,
      country_code: countryCode || null,
      holiday_name: holidayName,
      notes: input.notes?.trim() || null,
    },
    { onConflict: 'date' },
  );

  if (error) return { ok: false, error: error.message };

  await recordAudit(ctx, {
    action: 'calendar.holiday.upsert',
    resourceType: 'market_calendar',
    resourceId: date,
    severity: 'info',
    metadata: { holidayName, countryCode: countryCode || null },
  });

  revalidatePath('/admin/calendrier');
  revalidatePath('/admin/controle');
  return { ok: true };
}

export async function supprimerFerieAction(date: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requirePermission('scraping.configure');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: 'Date invalide.' };
  }

  const db = getServiceClient();
  const { error } = await db
    .from('market_calendar')
    .delete()
    .eq('date', date)
    .eq('is_trading_day', false);

  if (error) return { ok: false, error: error.message };

  await recordAudit(ctx, {
    action: 'calendar.holiday.delete',
    resourceType: 'market_calendar',
    resourceId: date,
    severity: 'warning',
  });

  revalidatePath('/admin/calendrier');
  revalidatePath('/admin/controle');
  return { ok: true };
}
