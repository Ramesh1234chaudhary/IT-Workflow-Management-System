import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import type { Types } from 'mongoose';
import { RefreshToken, User } from '../models/index';
import env from '../config/env';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../config/jwt';
import ApiError from '../utils/ApiError';
import { HTTP_STATUS } from '../utils/constants';
import { publicUser } from '../utils/serializers';
import { randomToken, sha256 } from '../utils/helpers';
import { recordAudit } from './auditService';
import { AUDIT_ACTIONS, ENTITY_TYPES } from '../utils/constants';
import type { UserPopulatedDoc } from '../types/models';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export async function findUserForLogin(email: string): Promise<UserPopulatedDoc | null> {
  return User.findOne({ email: String(email).toLowerCase() })
    .select('+password')
    .populate({ path: 'role', populate: { path: 'permissions' } }) as unknown as Promise<UserPopulatedDoc | null>;
}

export function assertNotLocked(user: { lockedUntil?: Date | null }): void {
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    throw new ApiError(
      HTTP_STATUS.UNAUTHORIZED,
      `Account temporarily locked after multiple failed attempts. Try again in ${minutes} minute(s).`,
      { code: 'ACCOUNT_LOCKED' },
    );
  }
}

export async function registerFailedAttempt(
  user: UserPopulatedDoc & { failedLoginAttempts?: number; lockedUntil?: Date | null },
): Promise<void> {
  user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
  if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
    user.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
    user.failedLoginAttempts = 0;
  }
  await user.save({ validateBeforeSave: false });
}

export async function clearFailedAttempts(user: UserPopulatedDoc): Promise<void> {
  if (!user.failedLoginAttempts && !user.lockedUntil) return;
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });
}

/** Compact claims embedded in the 15 minute access token. */
export function buildTokenPayload(user: UserPopulatedDoc) {
  const permissions = (user.role?.permissions || []).map((p) => p.key).filter(Boolean);
  return {
    sub: String(user._id),
    email: user.email,
    name: user.name,
    roleId: String(user.role?._id ?? ''),
    roleName: user.role?.name ?? '',
    accessScope: user.role?.accessScope ?? 'assigned',
    isClientScoped: Boolean(user.role?.isClientScoped),
    canSeeInternalData: user.role?.canSeeInternalData !== false,
    permissions,
  };
}

export function buildAuthUser(user: UserPopulatedDoc) {
  return {
    ...publicUser(user as unknown as Record<string, unknown>),
    permissions: (user.role?.permissions || []).map((p) => (typeof p === 'string' ? p : p.key)).filter(Boolean),
    roleName: user.role?.name,
  };
}

interface TokenPairOptions {
  familyId?: string;
  req?: Request;
}

export async function issueTokenPair(user: UserPopulatedDoc, { familyId = crypto.randomUUID(), req }: TokenPairOptions = {}) {
  const payload = buildTokenPayload(user);
  const accessToken = signAccessToken(payload);

  const refreshPayload = { sub: String(user._id), familyId };
  const refreshToken = signRefreshToken(refreshPayload);
  const tokenHash = sha256(refreshToken);

  const expiresAt = new Date(Date.now() + env.jwt.refreshExpiresDays * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    user: user._id,
    tokenHash,
    familyId,
    expiresAt,
    userAgent: req?.get?.('user-agent') || '',
    ip: req?.ip || '',
  });

  return { accessToken, refreshToken, familyId, expiresAt };
}

export function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(env.cookie.refreshName, token, {
    httpOnly: true,
    secure: env.cookie.secure,
    sameSite: env.cookie.sameSite,
    domain: env.cookie.domain,
    path: env.cookie.path,
    expires: expiresAt,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(env.cookie.refreshName, {
    httpOnly: true,
    secure: env.cookie.secure,
    sameSite: env.cookie.sameSite,
    domain: env.cookie.domain,
    path: env.cookie.path,
  });
}

async function revokeFamily(familyId: string, reason: string): Promise<void> {
  await RefreshToken.updateMany(
    { familyId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  );
}

/**
 * Refresh token rotation. The presented token is revoked and replaced by a new
 * one. Presenting an already-rotated token indicates theft: the whole token
 * family is revoked and the user is asked to log in again.
 */
export async function rotateRefreshToken(rawToken: string | undefined, { req }: { req?: Request } = {}) {
  if (!rawToken) throw ApiError.unauthorized('Refresh token missing');

  try {
    verifyRefreshToken(rawToken);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token', { code: 'INVALID_REFRESH_TOKEN' });
  }

  const tokenHash = sha256(rawToken);
  const stored = await RefreshToken.findOne({ tokenHash }).populate('user');

  if (!stored) {
    throw ApiError.unauthorized('Refresh token not recognised', { code: 'INVALID_REFRESH_TOKEN' });
  }

  if (stored.revokedAt) {
    await revokeFamily(stored.familyId, 'reuse_detected');
    throw new ApiError(
      HTTP_STATUS.UNAUTHORIZED,
      'Refresh token has already been used. All sessions were revoked, please sign in again.',
      { code: 'TOKEN_REUSE_DETECTED' },
    );
  }

  if (stored.expiresAt.getTime() <= Date.now()) {
    throw ApiError.unauthorized('Refresh token expired', { code: 'REFRESH_TOKEN_EXPIRED' });
  }

  const user = stored.user as unknown as UserPopulatedDoc | null;
  if (!user || !user.isActive) {
    await revokeFamily(stored.familyId, 'user_inactive');
    throw ApiError.unauthorized('Account is inactive', { code: 'USER_INACTIVE' });
  }

  const populated = (await User.findById(user._id).populate({
    path: 'role',
    populate: { path: 'permissions' },
  })) as unknown as UserPopulatedDoc | null;
  if (!populated?.role) {
    await revokeFamily(stored.familyId, 'role_missing');
    throw ApiError.unauthorized('Account role is not configured', { code: 'ROLE_MISSING' });
  }

  const { accessToken, refreshToken, expiresAt } = await issueTokenPair(populated, {
    familyId: stored.familyId,
    req,
  });

  stored.revokedAt = new Date();
  stored.revokedReason = 'rotated';
  stored.replacedByTokenHash = sha256(refreshToken);
  await stored.save();

  await recordAudit({
    actor: populated,
    entityType: ENTITY_TYPES.AUTH,
    entityId: populated._id,
    entityLabel: populated.email,
    action: AUDIT_ACTIONS.TOKEN_REFRESHED,
    metadata: { familyId: stored.familyId },
    req,
  });

  return { accessToken, refreshToken, expiresAt, user: populated };
}

export async function revokeRefreshToken(rawToken: string | undefined, reason = 'logout') {
  if (!rawToken) return { revoked: 0 };
  const result = await RefreshToken.updateMany(
    { tokenHash: sha256(rawToken), revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  );
  return { revoked: result.modifiedCount };
}

export async function revokeAllUserTokens(userId: Types.ObjectId | string, reason = 'logout_all') {
  const result = await RefreshToken.updateMany(
    { user: userId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  );
  return result.modifiedCount;
}

export const generateOpaqueToken = () => randomToken(32);
