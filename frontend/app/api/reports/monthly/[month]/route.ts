import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { month: string } }
) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate month format (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(params.month)) {
      return NextResponse.json(
        { error: 'Invalid month format (use YYYY-MM)' },
        { status: 400 }
      );
    }

    // Fetch report for current user
    const { data: report, error } = await supabase
      .from('monthly_reports')
      .select('id, month, report_url, report_json, sent_at, created_at')
      .eq('user_id', user.id)
      .eq('month', params.month)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Report not found' },
          { status: 404 }
        );
      }
      console.error('Supabase error:', error);
      throw error;
    }

    return NextResponse.json({ report }, { status: 200 });
  } catch (error) {
    console.error('Failed to fetch report:', error);
    return NextResponse.json(
      { error: 'Failed to fetch report' },
      { status: 500 }
    );
  }
}
