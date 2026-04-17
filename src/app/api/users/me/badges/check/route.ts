import { NextRequest, NextResponse } from 'next/server';
import { checkAndAwardBadges } from '@/lib/services/badgeService';

export async function POST(req: NextRequest) {
	const userId = new URL(req.url).searchParams.get('user_id');
	if (!userId) {
		return NextResponse.json({ error: 'user_id query param is required' }, { status: 400 });
	}

	const awarded = await checkAndAwardBadges(userId);
	return NextResponse.json({
		awarded,
		message: awarded.length > 0
			? `Awarded ${awarded.length} new badge(s): ${awarded.join(', ')}`
			: 'No new badges earned',
	});
}
