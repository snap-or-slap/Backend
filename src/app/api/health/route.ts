import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'snap-or-slap-backend',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
