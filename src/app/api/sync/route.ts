import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const userId = searchParams.get('user_id');
	if (!userId) {
		return NextResponse.json({ error: 'user_id query param is required' }, { status: 400 });
	}

	// Fetch pending overlays (shown_at IS NULL), oldest first
	const { rows: pending } = await query(
		`SELECT id, type, metadata, created_at
		 FROM notifications
		 WHERE user_id = $1 AND shown_at IS NULL
		 ORDER BY created_at ASC`,
		[userId],
	);

	// Mark as shown
	if (pending.length > 0) {
		const ids = (pending as Array<{ id: string }>).map(r => r.id);
		await query(
			`UPDATE notifications SET shown_at = NOW() WHERE id = ANY($1::uuid[])`,
			[ids],
		);
	}

	return NextResponse.json({
		pending_overlays: pending,
	});
}
