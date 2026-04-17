import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const q = searchParams.get('q');
	const userId = searchParams.get('user_id');

	if (!q || q.length < 2) {
		return NextResponse.json({ error: 'Query param q must be at least 2 characters' }, { status: 400 });
	}

	const searchQuery = userId
		? `SELECT id, username, display_name, avatar_url, is_private
		   FROM users
		   WHERE username ILIKE $1
		     AND id != $2
		     AND is_active = true
		   ORDER BY username ASC
		   LIMIT 20`
		: `SELECT id, username, display_name, avatar_url, is_private
		   FROM users
		   WHERE username ILIKE $1
		     AND is_active = true
		   ORDER BY username ASC
		   LIMIT 20`;

	const params = userId ? [`${q}%`, userId] : [`${q}%`];
	const { rows } = await query(searchQuery, params);

	return NextResponse.json({ users: rows });
}
