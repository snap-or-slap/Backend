import { NextRequest, NextResponse } from 'next/server';
import { recalculateUserStats } from '@/lib/services/userStatsService';

export async function POST(req: NextRequest) {
	const userId = new URL(req.url).searchParams.get('user_id');
	if (!userId) {
		return NextResponse.json({ error: 'user_id query param is required' }, { status: 400 });
	}

	const stats = await recalculateUserStats(userId);
	return NextResponse.json({ stats, message: 'Stats recalculated successfully' });
}
