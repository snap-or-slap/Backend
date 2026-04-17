import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentCycle } from '@/lib/services/checkinService';

// GET — Challenge statistics
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;

	const { rows: challenges } = await query(
		`SELECT status, start_at, duration_days, hearts_left FROM challenges WHERE id = $1`,
		[id]
	);
	if (challenges.length === 0) {
		return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
	}
	if (!['active', 'completed'].includes(challenges[0].status)) {
		return NextResponse.json({ error: 'Challenge is not active or completed' }, { status: 409 });
	}

	const challenge = challenges[0];
	const elapsedCycles = Math.min(
		getCurrentCycle(challenge.start_at),
		challenge.duration_days
	);

	const { rows: memberStats } = await query(
		`SELECT cm.user_id, u.username, u.display_name, u.avatar_url,
		        COUNT(ci.id)::int AS checkin_count
		 FROM challenge_members cm
		 JOIN users u ON u.id = cm.user_id
		 LEFT JOIN checkins ci ON ci.challenge_id = cm.challenge_id AND ci.user_id = cm.user_id
		 WHERE cm.challenge_id = $1 AND cm.status = 'accepted'
		 GROUP BY cm.user_id, u.username, u.display_name, u.avatar_url
		 ORDER BY checkin_count DESC`,
		[id]
	);

	const totalCheckins = memberStats.reduce((sum, m) => sum + Number(m.checkin_count), 0);
	const memberCount = memberStats.length;
	const maxPossible = memberCount * elapsedCycles;
	const completionRate = maxPossible > 0
		? Math.round((totalCheckins / maxPossible) * 1000) / 10
		: 0;

	const formattedMembers = memberStats.map(m => ({
		user_id: m.user_id,
		username: m.username,
		display_name: m.display_name,
		avatar_url: m.avatar_url,
		checkin_count: Number(m.checkin_count),
		missed_count: elapsedCycles - Number(m.checkin_count),
		completion_rate: elapsedCycles > 0
			? Math.round((Number(m.checkin_count) / elapsedCycles) * 1000) / 10
			: 0,
	}));

	const topPerformer = formattedMembers.length > 0 ? formattedMembers[0] : null;

	return NextResponse.json({
		challenge_id: id,
		status: challenge.status,
		elapsed_cycles: elapsedCycles,
		duration_days: challenge.duration_days,
		hearts_left: challenge.hearts_left,
		total_checkins: totalCheckins,
		completion_rate: completionRate,
		top_performer: topPerformer,
		member_stats: formattedMembers,
	});
}
