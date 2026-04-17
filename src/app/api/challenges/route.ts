import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest) {
  // TODO: return list of challenges for authenticated user
  return NextResponse.json({ message: 'not implemented' }, { status: 501 });
}

export async function POST(_req: NextRequest) {
  // TODO: create a new challenge
  return NextResponse.json({ message: 'not implemented' }, { status: 501 });
}
