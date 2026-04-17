import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function PUT(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const userId = searchParams.get('user_id');
	if (!userId) {
		return NextResponse.json({ error: 'user_id query param is required' }, { status: 400 });
	}

	let body: { notification_ids?: string[]; mark_all?: boolean };
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const { notification_ids, mark_all } = body;

	if (!mark_all && (!notification_ids || notification_ids.length === 0)) {
		return NextResponse.json(
			{ error: 'Either notification_ids or mark_all=true is required' },
			{ status: 400 },
		);
	}

	let result;
	if (mark_all) {
		result = await query(
			`UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
			[userId],
		);
	} else {
		result = await query(
			`UPDATE notifications SET is_read = true WHERE user_id = $1 AND id = ANY($2::uuid[]) AND is_read = false`,
			[userId, notification_ids],
		);
	}

	return NextResponse.json({
		updated_count: result.rowCount ?? 0,
	});
}
