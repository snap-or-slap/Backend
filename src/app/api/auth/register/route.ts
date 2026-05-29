import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { query } from '@/lib/db';
import { registerSchema } from '@/lib/schemas/auth';
import { signAccessToken } from '@/lib/auth/tokens';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
  }

  const { email, password, username } = parsed.data;

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, username, terms_agreed_at)
			 VALUES ($1, $2, $3, NOW())
			 RETURNING id, email, username, display_name, avatar_url`,
      [email, passwordHash, username]
    );

    const user = rows[0];

    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
    });

    const refreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
			 VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
      [user.id, tokenHash]
    );

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
      },
      access_token: accessToken,
      refresh_token: refreshToken,
    }, { status: 201 });
  } catch (err: unknown) {
    const pgErr = err as { code?: string; constraint?: string };
    if (pgErr.code === '23505') {
      if (pgErr.constraint?.includes('email')) {
        return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
      }
      if (pgErr.constraint?.includes('username')) {
        return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
      }
    }
    console.error('Register error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
