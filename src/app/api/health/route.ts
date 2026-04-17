import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Simple health check (active)
//
// Returns 200 immediately without querying the database. This is the safest
// approach for Railway's healthcheck: it confirms the Node.js process and
// Next.js runtime are alive without risking a hang caused by a slow or
// unresponsive Supabase connection pooler.
// ---------------------------------------------------------------------------
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    uptime: process.uptime(),
  });
}

// ---------------------------------------------------------------------------
// Health check with DB connectivity + timeout (alternative)
//
// Uncomment this export (and remove the simple one above) if you want the
// healthcheck to also verify database connectivity. A 5-second AbortController
// timeout ensures the endpoint always responds quickly even when the Supabase
// connection pooler is slow, preventing the 502 Bad Gateway caused by a
// hanging SELECT that blocks the Node.js event loop.
//
// import { pool } from '@/lib/db';
//
// export async function GET() {
//   const controller = new AbortController();
//   const timeoutId = setTimeout(() => controller.abort(), 5000);
//
//   try {
//     await Promise.race([
//       pool.query('SELECT 1'),
//       new Promise<never>((_, reject) =>
//         controller.signal.addEventListener('abort', () =>
//           reject(new Error('DB health check timed out after 5 s'))
//         )
//       ),
//     ]);
//
//     clearTimeout(timeoutId);
//     return NextResponse.json({
//       status: 'ok',
//       db: 'ok',
//       uptime: process.uptime(),
//     });
//   } catch (err) {
//     clearTimeout(timeoutId);
//     console.error('[health] DB check failed:', err);
//     return NextResponse.json(
//       { status: 'error', db: 'error' },
//       { status: 503 }
//     );
//   }
// }
// ---------------------------------------------------------------------------
