import env from '../config/env';
import * as authService from '../services/authService';
import { recordAudit } from '../services/auditService';
import { buildAuthUser } from '../services/authService';
import ApiError from '../utils/ApiError';
import { AUDIT_ACTIONS, ENTITY_TYPES, HTTP_STATUS } from '../utils/constants';
import { asyncHandler } from '../utils/helpers';
import type { Request, Response } from 'express';
import type { UserPopulatedDoc } from '../types/models';
import crypto from 'node:crypto';

const GENERIC_LOGIN_ERROR = 'Invalid email or password';

/** POST /api/auth/login */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };

  const user = await authService.findUserForLogin(email);
  if (!user) {
    await recordAudit({
      actor: { name: email, email } as { name: string; email: string },
      entityType: ENTITY_TYPES.AUTH,
      entityLabel: email,
      action: AUDIT_ACTIONS.LOGIN,
      newValue: { success: false, reason: 'user_not_found' } as Record<string, unknown>,
      req,
    } as Parameters<typeof recordAudit>[0]);
    throw ApiError.unauthorized(GENERIC_LOGIN_ERROR, { code: 'INVALID_CREDENTIALS' });
  }

  authService.assertNotLocked(user);

  const passwordMatches = await (user as unknown as { comparePassword: (p: string) => Promise<boolean> }).comparePassword(password);
  if (!passwordMatches) {
    await authService.registerFailedAttempt(user);
    await recordAudit({
      actor: { _id: user._id, name: user.name, email: user.email } as { _id: unknown; name: string; email: string },
      entityType: ENTITY_TYPES.AUTH,
      entityId: user._id,
      entityLabel: user.email,
      action: AUDIT_ACTIONS.LOGIN,
      newValue: { success: false, reason: 'bad_password' } as Record<string, unknown>,
      req,
    } as Parameters<typeof recordAudit>[0]);
    throw ApiError.unauthorized(GENERIC_LOGIN_ERROR, { code: 'INVALID_CREDENTIALS' });
  }

  if (!user.isActive) {
    throw ApiError.forbidden(
      'This account has been deactivated. Please contact an administrator.',
      { code: 'USER_INACTIVE' },
    );
  }

  if (!user.role) {
    throw ApiError.forbidden('This account has no role assigned', { code: 'ROLE_MISSING' });
  }

  await authService.clearFailedAttempts(user);

  const { accessToken, refreshToken, expiresAt } = await authService.issueTokenPair(user, { req, familyId: crypto.randomUUID() } as { req?: Request; familyId?: string });
  authService.setRefreshCookie(res, refreshToken, expiresAt);

  await recordAudit({
    actor: user as { _id: unknown; name: string; email: string; role: { name: string } },
    entityType: ENTITY_TYPES.AUTH,
    entityId: user._id,
    entityLabel: user.email,
    action: AUDIT_ACTIONS.LOGIN,
    newValue: { success: true, role: (user as { role: { name: string } }).role.name } as Record<string, unknown>,
    req,
  } as Parameters<typeof recordAudit>[0]);

  return res.status(HTTP_STATUS.OK).json({
    success: true,
    accessToken,
    expiresIn: env.jwt.accessExpiresMinutes * 60,
    user: buildAuthUser(user),
  });
});

/** POST /api/auth/refresh - rotates the refresh token */
export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const rawToken = req.cookies?.[env.cookie.refreshName] as string | undefined;
  const { accessToken, refreshToken, expiresAt, user } = await authService.rotateRefreshToken(rawToken, { req } as { req?: Request });

  authService.setRefreshCookie(res, refreshToken, expiresAt);

  return res.status(HTTP_STATUS.OK).json({
    success: true,
    accessToken,
    expiresIn: env.jwt.accessExpiresMinutes * 60,
    user: buildAuthUser(user),
  });
});

/** POST /api/auth/logout */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const rawToken = req.cookies?.[env.cookie.refreshName] as string | undefined;
  const { revoked } = await authService.revokeRefreshToken(rawToken, 'logout');
  authService.clearRefreshCookie(res);

  if (req.user) {
    await recordAudit({
      actor: req.user as { id: string; name: string; email: string },
      entityType: ENTITY_TYPES.AUTH,
      entityId: req.user.id,
      entityLabel: req.user.email,
      action: AUDIT_ACTIONS.LOGOUT,
      newValue: { revokedTokens: revoked } as Record<string, unknown>,
      req,
    } as Parameters<typeof recordAudit>[0]);
  }

  return res.status(HTTP_STATUS.OK).json({ success: true, message: 'Signed out successfully' });
});

/** GET /api/auth/me - restores the session on page reload */
export const me = asyncHandler(async (req: Request, res: Response) => {
  const { default: User } = await import('../models/User.js');
  const user = (await User.findById(req.user!.id).populate({
    path: 'role',
    populate: { path: 'permissions' },
  })) as unknown as UserPopulatedDoc | null;
  if (!user) throw ApiError.notFound('User not found');
  return res.status(HTTP_STATUS.OK).json({ success: true, user: buildAuthUser(user) });
});

/** POST /api/auth/change-password */
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  const { default: User } = await import('../models/User.js');
  const user = await User.findById(req.user!.id).select('+password');
  if (!user) throw ApiError.notFound('User not found');

  const matches = await (user as unknown as { comparePassword: (p: string) => Promise<boolean> }).comparePassword(currentPassword);
  if (!matches) throw ApiError.badRequest('Current password is incorrect', { code: 'INVALID_CREDENTIALS' });

  user.password = newPassword;
  await user.save();

  await authService.revokeAllUserTokens(user._id, 'password_changed');
  authService.clearRefreshCookie(res);

  await recordAudit({
    actor: req.user! as { id: string; name: string; email: string },
    entityType: ENTITY_TYPES.USER,
    entityId: req.user!.id,
    entityLabel: req.user!.email,
    action: AUDIT_ACTIONS.UPDATED,
    metadata: { operation: 'change_password', sessionsRevoked: true } as Record<string, unknown>,
    req,
  } as Parameters<typeof recordAudit>[0]);

  return res.status(HTTP_STATUS.OK).json({ success: true, message: 'Password updated. Please sign in again.' });
});

export default { login, refresh, logout, me, changePassword };
