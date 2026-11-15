import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { validatePlacePaperOrder } from '@/lib/paper-trading/orders';
import { paperOrderErrorResponse } from '@/lib/paper-trading/orderErrors';
import {
  listPaperOrders,
  PaperOrderServiceError,
  placePaperOrder,
  settlePaperOrders,
} from '@/lib/paper-trading/ordersServer';

function operationError(error: unknown, action: string) {
  if (error instanceof PaperOrderServiceError) {
    const response = paperOrderErrorResponse(error.code);
    if (response) {
      return NextResponse.json({ error: response.message }, { status: response.status });
    }
  }

  console.error(`Paper trading ${action} error:`, error);
  return NextResponse.json(
    { error: 'Le service de simulation est temporairement indisponible.' },
    { status: 500 },
  );
}

async function authenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return { user, error };
}

export async function GET() {
  try {
    const { user, error } = await authenticatedUser();
    if (error || !user) {
      return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });
    }

    await settlePaperOrders(user.id);
    const result = await listPaperOrders(user.id);
    return NextResponse.json(result);
  } catch (error) {
    return operationError(error, 'list');
  }
}

export async function POST(request: NextRequest) {
  const { user, error } = await authenticatedUser();
  if (error || !user) {
    return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 });
  }

  const input = validatePlacePaperOrder(body);
  if (!input) {
    return NextResponse.json({ error: 'Les paramètres de l’ordre sont invalides.' }, { status: 400 });
  }

  try {
    const order = await placePaperOrder(user.id, input);
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    return operationError(error, 'place');
  }
}
