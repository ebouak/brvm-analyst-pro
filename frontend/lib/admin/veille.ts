import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Fetch veille digest data from Supabase (server-side)
 */
export async function getVeilleDigest(
  source?: string,
  limit: number = 50
): Promise<any[]> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );

    let query = supabase
      .from('brvm_veille_digest')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (source) {
      query = query.eq('source', source);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching veille digest:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error in getVeilleDigest:', err);
    return [];
  }
}

/**
 * Fetch veille alerts from Supabase (server-side)
 */
export async function getVeilleAlerts(
  dateStr?: string,
  limit: number = 20
): Promise<any[]> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );

    let query = supabase
      .from('brvm_veille_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    // Get unacknowledged alerts by default
    query = query.is('acknowledged_at', null);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching veille alerts:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error in getVeilleAlerts:', err);
    return [];
  }
}

/**
 * Get critical veille items only
 */
export async function getCriticalVeilleItems(
  limit: number = 20
): Promise<any[]> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );

    const { data, error } = await supabase
      .from('brvm_veille_digest')
      .select('*')
      .eq('is_critical', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching critical veille items:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error in getCriticalVeilleItems:', err);
    return [];
  }
}

/**
 * Get veille job run history
 */
export async function getVeilleJobRuns(
  limit: number = 50
): Promise<any[]> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );

    const { data, error } = await supabase
      .from('brvm_veille_job_runs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching veille job runs:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error in getVeilleJobRuns:', err);
    return [];
  }
}

/**
 * Get statistics for veille dashboard
 */
export async function getVeilleStats(): Promise<{
  totalDigests: number;
  criticalItems: number;
  pendingAlerts: number;
  sourceStats: Record<string, number>;
}> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );

    // Get total digests count
    const { count: totalDigests } = await supabase
      .from('brvm_veille_digest')
      .select('*', { count: 'exact', head: true });

    // Get critical items count
    const { count: criticalItems } = await supabase
      .from('brvm_veille_digest')
      .select('*', { count: 'exact', head: true })
      .eq('is_critical', true);

    // Get pending alerts count
    const { count: pendingAlerts } = await supabase
      .from('brvm_veille_alerts')
      .select('*', { count: 'exact', head: true })
      .is('acknowledged_at', null);

    // Get source distribution
    const { data: sourceData } = await supabase
      .from('brvm_veille_digest')
      .select('source');

    const sourceStats: Record<string, number> = {};
    (sourceData || []).forEach((item: any) => {
      sourceStats[item.source] = (sourceStats[item.source] || 0) + 1;
    });

    return {
      totalDigests: totalDigests || 0,
      criticalItems: criticalItems || 0,
      pendingAlerts: pendingAlerts || 0,
      sourceStats,
    };
  } catch (err) {
    console.error('Error in getVeilleStats:', err);
    return {
      totalDigests: 0,
      criticalItems: 0,
      pendingAlerts: 0,
      sourceStats: {},
    };
  }
}
