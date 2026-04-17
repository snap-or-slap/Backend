import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function PUT(req: NextRequest) {
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

	const { isPrivate } = body as { isPrivate?: boolean };
	if (typeof isPrivate !== 'boolean') {
		return NextResponse.json({ error: 'isPrivate (boolean) is required' }, { status: 400 });
	}

	const { rows } = await query(
		`UPDATE users SET is_private = $1, updated_at = NOW()
		 WHERE id = $2
		 RETURNING id, is_private`,
		[isPrivate, userId]
	);

	if (rows.length === 0) {
		return NextResponse.json({ error: 'User not found' }, { status: 404 });
	}

	return NextResponse.json({ user: rows[0], message: 'Settings updated' });
}
