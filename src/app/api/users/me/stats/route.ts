import { NextRequest, NextResponse } from 'next/server';
import { getUserStats } from '@/lib/services/userStatsService';

export async function GET(req: NextRequest) {
	const userId = new URL(req.url).searchParams.get('user_id');
	if (!userId) {
		return NextResponse.json({ error: 'user_id query param is required' }, { status: 400 });
	}

	const stats = await getUserStats(userId);
	return NextResponse.json({ stats });
}
