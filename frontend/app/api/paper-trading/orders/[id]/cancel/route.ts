import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { paperOrderErrorResponse } from '@/lib/paper-trading/orderErrors';
import {
  cancelPaperOrder,
  PaperOrderServiceError,
} from '@/lib/paper-trading/ordersServer';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  _request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  if (!UUID.test(id)) {
    return NextResponse.json({ error: 'Identifiant d’ordre invalide.' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });
    }

    const order = await cancelPaperOrder(user.id, id);
    return NextResponse.json({ order });
  } catch (error) {
    if (error instanceof PaperOrderServiceError) {
      const response = paperOrderErrorResponse(error.code);
      if (response) return NextResponse.json({ error: response.message }, { status: response.status });
    }

    console.error('Paper trading cancel error:', error);
    return NextResponse.json(
      { error: 'Le service de simulation est temporairement indisponible.' },
      { status: 500 },
    );
  }
}
