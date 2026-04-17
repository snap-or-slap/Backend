import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { updateProfileSchema } from '@/lib/schemas/user';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('user_id');
  if (!userId) {
    return NextResponse.json({ error: 'user_id query param is required' }, { status: 400 });
  }

  const { rows } = await query(
    `SELECT id, email, username, display_name, avatar_url, bio, is_private, is_active, created_at
		 FROM users WHERE id = $1`,
    [userId]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ user: rows[0] });
}

export async function PATCH(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('user_id');
  if (!userId) {
    return NextResponse.json({ error: 'user_id query param is required' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (parsed.data.displayName !== undefined) {
    updates.push(`display_name = $${paramIndex++}`);
    values.push(parsed.data.displayName);
  }
  if (parsed.data.bio !== undefined) {
    updates.push(`bio = $${paramIndex++}`);
    values.push(parsed.data.bio);
  }
  if (parsed.data.isPrivate !== undefined) {
    updates.push(`is_private = $${paramIndex++}`);
    values.push(parsed.data.isPrivate);
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  updates.push(`updated_at = NOW()`);
  values.push(userId);

  const { rows } = await query(
    `UPDATE users SET ${updates.join(', ')}
		 WHERE id = $${paramIndex}
		 RETURNING id, email, username, display_name, avatar_url, bio, is_private`,
    values
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ user: rows[0] });
}

export async function DELETE(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get('user_id');
  if (!userId) {
    return NextResponse.json({ error: 'user_id query param is required' }, { status: 400 });
  }

  // Soft delete: deactivate + anonymize
  const { rows } = await query(
    `UPDATE users SET
       is_active = false,
       email = 'deleted_' || id || '@deleted.local',
       username = 'deleted_' || id,
       display_name = 'Deleted User',
       avatar_url = NULL,
       bio = NULL,
       updated_at = NOW()
     WHERE id = $1 AND is_active = true
     RETURNING id`,
    [userId]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: 'User not found or already deleted' }, { status: 404 });
  }

  // Revoke all refresh tokens
  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );

  return NextResponse.json({ message: 'Account deleted successfully' });
}
