import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { changePasswordSchema } from '@/lib/schemas/user';
import bcrypt from 'bcrypt';

export async function POST(req: NextRequest) {
	const userId = new URL(req.url).searchParams.get('user_id');
	if (!userId) {
		return NextResponse.json({ error: 'user_id query param is required' }, { status: 400 });
	}

	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const parsed = changePasswordSchema.safeParse(body);
	if (!parsed.success) {
		const errors = parsed.error.issues.map((i) => ({
			field: i.path.join('.'),
			message: i.message,
		}));
		return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
	}

	// Get current password hash
	const { rows } = await query(
		`SELECT id, password_hash FROM users WHERE id = $1`,
		[userId]
	);
	if (rows.length === 0) {
		return NextResponse.json({ error: 'User not found' }, { status: 404 });
	}

	// Verify current password
	const isMatch = await bcrypt.compare(parsed.data.currentPassword, rows[0].password_hash as string);
	if (!isMatch) {
		return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
	}

	// Hash new password
	const newHash = await bcrypt.hash(parsed.data.newPassword, 12);

	// Update password
	await query(
		`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
		[newHash, userId]
	);

	// Revoke all refresh tokens
	await query(
		`UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
		[userId]
	);

	return NextResponse.json({ message: 'Password changed successfully' });
}
