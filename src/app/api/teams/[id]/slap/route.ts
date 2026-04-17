import { NextRequest, NextResponse } from 'next/server';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // TODO: send slap reminder to a team member
  return NextResponse.json({ id, message: 'not implemented' }, { status: 501 });
}
