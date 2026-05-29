import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { verifyAccessToken } from '@/lib/auth/tokens';

export interface AuthUser {
	userId: string;
	email: string;
}

type AuthHandler = (
	req: NextRequest,
	user: AuthUser,
	...args: unknown[]
) => Promise<NextResponse>;

export function withAuth(handler: AuthHandler) {
	return async (req: NextRequest, ...args: unknown[]): Promise<NextResponse> => {
		const authHeader = req.headers.get('authorization');
		if (!authHeader?.startsWith('Bearer ')) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const token = authHeader.slice(7);

		try {
			const payload = verifyAccessToken(token);
			const user: AuthUser = {
				userId: String(payload.userId),
				email: payload.email,
			};
			return handler(req, user, ...args);
		} catch (err) {
			if (err instanceof jwt.TokenExpiredError) {
				return NextResponse.json({ error: 'Token expired' }, { status: 401 });
			}
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}
	};
}
