import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // TODO: return challenge by id
  return NextResponse.json({ id, message: 'not implemented' }, { status: 501 });
}

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // TODO: update challenge
  return NextResponse.json({ id, message: 'not implemented' }, { status: 501 });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // TODO: delete challenge
  return NextResponse.json({ id, message: 'not implemented' }, { status: 501 });
}
