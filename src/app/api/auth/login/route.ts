import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '@/lib/db';
import { loginSchema } from '@/lib/schemas/auth';

export async function POST(req: NextRequest) {
	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const parsed = loginSchema.safeParse(body);
	if (!parsed.success) {
		const errors = parsed.error.issues.map((i) => ({
			field: i.path.join('.'),
			message: i.message,
		}));
		return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
	}

	const { email, password } = parsed.data;

	const { rows } = await query(
		`SELECT id, email, password_hash, username, display_name, avatar_url, is_active
		 FROM users WHERE email = $1`,
		[email]
	);

	if (rows.length === 0) {
		// Constant-time: still run bcrypt compare to prevent timing attacks
		await bcrypt.compare(password, '$2b$12$invalid.hash.placeholder.for.timing.attack.prevention');
		return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
	}

	const user = rows[0];
	const passwordValid = await bcrypt.compare(password, user.password_hash);

	if (!passwordValid) {
		return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
	}

	if (!user.is_active) {
		return NextResponse.json({ error: 'Account disabled' }, { status: 403 });
	}

	const accessToken = jwt.sign(
		{ userId: user.id, email: user.email },
		process.env.JWT_ACCESS_SECRET!,
		{ expiresIn: '15m' }
	);

	const refreshToken = crypto.randomBytes(40).toString('hex');
	const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

	await query(
		`INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
		 VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
		[user.id, tokenHash]
	);

	return NextResponse.json({
		user: {
			id: user.id,
			email: user.email,
			username: user.username,
			display_name: user.display_name,
			avatar_url: user.avatar_url,
		},
		access_token: accessToken,
		refresh_token: refreshToken,
	});
}
