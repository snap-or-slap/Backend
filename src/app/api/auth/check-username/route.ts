import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { checkUsernameSchema } from '@/lib/schemas/auth';

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const username = searchParams.get('username');

	const parsed = checkUsernameSchema.safeParse({ username });
	if (!parsed.success) {
		const errors = parsed.error.issues.map((i) => ({
			field: i.path.join('.'),
			message: i.message,
		}));
		return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
	}

	const { rows } = await query(
		`SELECT id FROM users WHERE username = $1 LIMIT 1`,
		[parsed.data.username]
	);

	return NextResponse.json({ available: rows.length === 0 });
}
