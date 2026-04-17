import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest) {
  // TODO: return authenticated user profile
  return NextResponse.json({ message: 'not implemented' }, { status: 501 });
}

export async function PATCH(_req: NextRequest) {
  // TODO: update user profile
  return NextResponse.json({ message: 'not implemented' }, { status: 501 });
}
