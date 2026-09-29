import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../config/jwt';
import { User } from '../models/index';
import ApiError from '../utils/ApiError';
import { asyncHandler } from '../utils/helpers';
import type { UserPopulatedDoc } from '../types/models';

const extractToken = (req: Request): string | null => {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
};

/**
 * Verifies the 15 minute access token and rehydrates the live user from Mongo so
 * deactivated accounts lose access immediately, even before their token expires.
 */
export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized('Authentication required. Please sign in.');

  let payload: jwt.JwtPayload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw ApiError.unauthorized('Access token expired', { code: 'TOKEN_EXPIRED' });
    }
    throw ApiError.unauthorized('Invalid authentication token', { code: 'INVALID_TOKEN' });
  }

  const user = (await User.findById(payload.sub).populate({
    path: 'role',
    populate: { path: 'permissions' },
  })) as UserPopulatedDoc | null;

  if (!user) throw ApiError.unauthorized('Account no longer exists', { code: 'USER_NOT_FOUND' });
  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated', { code: 'USER_INACTIVE' });
  if (!user.role) throw ApiError.forbidden('This account has no role assigned', { code: 'ROLE_MISSING' });

  const role = user.role;
  req.user = {
    id: String(user._id),
    _id: String(user._id),
    name: user.name,
    email: user.email,
    avatarColor: user.avatarColor,
    roleId: String(role._id),
    roleName: role.name,
    roleKey: role.key,
    accessScope: role.accessScope,
    isClientScoped: Boolean(role.isClientScoped),
    canSeeInternalData: role.canSeeInternalData !== false,
    permissions: (role.permissions || []).map((p) => p.key).filter(Boolean),
  };
  req.currentUserDoc = user;

  return next();
});

export default authenticate;
