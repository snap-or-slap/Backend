import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const { rows: users } = await query(
      'SELECT id, email, username, display_name, bio, created_at FROM users ORDER BY created_at'
    );
    const { rows: challenges } = await query(
      'SELECT id, title, description, status, duration_days, creator_id FROM challenges'
    );
    const { rows: members } = await query(
      `SELECT cm.role, cm.status, u.username, c.title as challenge_title
       FROM challenge_members cm
       JOIN users u ON u.id = cm.user_id
       JOIN challenges c ON c.id = cm.challenge_id`
    );
    const { rows: checkins } = await query(
      `SELECT ch.cycle_number, ch.caption, u.username, c.title as challenge_title
       FROM checkins ch
       JOIN users u ON u.id = ch.user_id
       JOIN challenges c ON c.id = ch.challenge_id`
    );

    return NextResponse.json({
      users,
      challenges,
      members,
      checkins,
    });
  } catch (err) {
    console.error('DB query error:', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
