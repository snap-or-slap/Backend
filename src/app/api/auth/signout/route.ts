import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { query } from '@/lib/db';
import { signoutSchema } from '@/lib/schemas/auth';

export async function POST(req: NextRequest) {
	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const parsed = signoutSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json({ error: 'Refresh token is required' }, { status: 400 });
	}

	const { refresh_token } = parsed.data;
	const tokenHash = crypto.createHash('sha256').update(refresh_token).digest('hex');

	await query(
		`UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL`,
		[tokenHash]
	);

	return NextResponse.json({ message: 'Signed out' });
}
