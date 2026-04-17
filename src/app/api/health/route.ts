import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    await pool.query('SELECT 1');
    return NextResponse.json({
      status: 'ok',
      db: 'ok',
      uptime: process.uptime(),
    });
  } catch {
    return NextResponse.json(
      { status: 'error', db: 'error' },
      { status: 503 }
    );
  }
}
