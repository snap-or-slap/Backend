import { NextRequest, NextResponse } from 'next/server';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // TODO: upload photo proof for a challenge step
  return NextResponse.json({ id, message: 'not implemented' }, { status: 501 });
}
