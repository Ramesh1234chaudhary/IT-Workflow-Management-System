import crypto from 'node:crypto';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import env from './env';

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  email: string;
  roleId: string;
  type: 'access';
}

export interface RefreshTokenPayload extends JwtPayload {
  sub: string;
  familyId: string;
  type: 'refresh';
}

const ISSUER = 'it-workflow-api';
const AUDIENCE = 'it-workflow-client';

export type AccessTokenInput = Omit<AccessTokenPayload, keyof JwtPayload | 'type'>;
export type RefreshTokenInput = Omit<RefreshTokenPayload, keyof JwtPayload | 'type'>;

export function signAccessToken(payload: AccessTokenInput) {
  return jwt.sign({ ...payload, type: 'access' } as AccessTokenPayload, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessTtl as SignOptions['expiresIn'],
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwt.accessSecret, { issuer: ISSUER, audience: AUDIENCE }) as AccessTokenPayload;
}

export function signRefreshToken(payload: RefreshTokenInput) {
  return jwt.sign({ ...payload, type: 'refresh' } as RefreshTokenPayload, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshTtl as SignOptions['expiresIn'],
    issuer: ISSUER,
    audience: AUDIENCE,
    jwtid: crypto.randomUUID(),
  });
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.jwt.refreshSecret, { issuer: ISSUER, audience: AUDIENCE }) as RefreshTokenPayload;
}

export default { signAccessToken, verifyAccessToken, signRefreshToken, verifyRefreshToken };
