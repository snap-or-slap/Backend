import jwt, { type SignOptions } from 'jsonwebtoken';

const ACCESS_TOKEN_EXPIRES_IN = '15m';

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getJwtAccessSecret(): string {
  const secret = getRequiredEnv('JWT_ACCESS_SECRET');

  if (secret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET must be at least 32 characters long.');
  }

  return secret;
}

export type AccessTokenPayload = {
  userId: number | string;
  email: string;
};

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: SignOptions = {
    algorithm: 'HS256',
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    issuer: 'snap-or-slap-backend',
    audience: 'snap-or-slap-mobile',
    subject: String(payload.userId),
  };

  return jwt.sign(payload, getJwtAccessSecret(), options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, getJwtAccessSecret(), {
    algorithms: ['HS256'],
    issuer: 'snap-or-slap-backend',
    audience: 'snap-or-slap-mobile',
  }) as AccessTokenPayload;
}
