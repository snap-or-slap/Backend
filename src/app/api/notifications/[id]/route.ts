import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function DELETE(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { searchParams } = new URL(req.url);
	const userId = searchParams.get('user_id');
	if (!userId) {
		return NextResponse.json({ error: 'user_id query param is required' }, { status: 400 });
	}

	const { id } = await params;

	const result = await query(
		`DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
		[id, userId],
	);

	if ((result.rowCount ?? 0) === 0) {
		return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
	}

	return NextResponse.json({ message: 'Notification deleted' });
}
