import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Les ventes passent désormais par un ordre simulé.' },
    { status: 405 },
  );
}
