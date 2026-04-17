import { NextRequest, NextResponse } from 'next/server';

export async function POST(_req: NextRequest) {
  // TODO: validate body, hash password, create user, return JWT
  return NextResponse.json({ message: 'not implemented' }, { status: 501 });
}
