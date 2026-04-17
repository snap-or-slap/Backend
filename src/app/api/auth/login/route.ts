import { NextRequest, NextResponse } from 'next/server';

export async function POST(_req: NextRequest) {
  // TODO: verify credentials, return JWT
  return NextResponse.json({ message: 'not implemented' }, { status: 501 });
}
