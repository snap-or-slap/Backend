import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { query } from '@/lib/db';
import { refreshSchema } from '@/lib/schemas/auth';
import { signAccessToken } from '@/lib/auth/tokens';

export async function POST(req: NextRequest) {
	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const parsed = refreshSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json({ error: 'Refresh token is required' }, { status: 400 });
	}

	const { refresh_token } = parsed.data;
	const tokenHash = crypto.createHash('sha256').update(refresh_token).digest('hex');

	// Find token in DB
	const { rows: tokens } = await query(
		`SELECT id, user_id, expires_at, revoked_at
		 FROM refresh_tokens WHERE token_hash = $1`,
		[tokenHash]
	);

	if (tokens.length === 0) {
		return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
	}

	const tokenRecord = tokens[0];

	if (tokenRecord.revoked_at) {
		return NextResponse.json({ error: 'Token has been revoked' }, { status: 401 });
	}

	if (new Date(tokenRecord.expires_at) < new Date()) {
		return NextResponse.json({ error: 'Token has expired' }, { status: 401 });
	}

	// Revoke old token (rotation)
	await query(
		`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`,
		[tokenRecord.id]
	);

	// Get user info
	const { rows: users } = await query(
		`SELECT id, email FROM users WHERE id = $1`,
		[tokenRecord.user_id]
	);

	if (users.length === 0) {
		return NextResponse.json({ error: 'User not found' }, { status: 401 });
	}

	const user = users[0];

	// Generate new tokens
	const accessToken = signAccessToken({
		userId: user.id,
		email: user.email,
	});

	const newRefreshToken = crypto.randomBytes(40).toString('hex');
	const newTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');

	await query(
		`INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
		 VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
		[user.id, newTokenHash]
	);

	return NextResponse.json({
		access_token: accessToken,
		refresh_token: newRefreshToken,
	});
}
