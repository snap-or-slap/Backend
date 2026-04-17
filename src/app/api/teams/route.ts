import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest) {
  // TODO: list teams for authenticated user
  return NextResponse.json({ message: 'not implemented' }, { status: 501 });
}

export async function POST(_req: NextRequest) {
  // TODO: create a new team
  return NextResponse.json({ message: 'not implemented' }, { status: 501 });
}
