import { NextRequest, NextResponse } from 'next/server';
import { AppError } from '@/lib/errors';

type RouteHandler = (req: NextRequest, ...args: unknown[]) => Promise<NextResponse>;

export function withErrorHandler(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, ...args: unknown[]): Promise<NextResponse> => {
    try {
      return await handler(req, ...args);
    } catch (err) {
      if (err instanceof AppError) {
        const body: Record<string, unknown> = { error: err.message };
        if (err.details) {
          body.details = err.details;
        }
        return NextResponse.json(body, { status: err.statusCode });
      }

      // Unknown error — never leak stack traces
      console.error('Unhandled error:', err);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}
