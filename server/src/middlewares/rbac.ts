import type { NextFunction, Request, Response } from 'express';
import ApiError from '../utils/ApiError';
import { ACCESS_SCOPE } from '../utils/constants';

type Middleware = (req: Request, _res: Response, next: NextFunction) => void;

/**
 * Database driven RBAC.
 *
 * Usage:  router.post('/', requirePermission('user', 'create'), handler)
 *         router.post('/', authorizeAny('user:create', 'user:admin'), handler)
 *
 * No role name is ever compared - only `module:action` permission keys that the
 * user's role grants (see the Role model and the seed script).
 */
export const requirePermission = (module: string, action: string): Middleware => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized('Authentication required'));
  const key = `${module}:${action}`;
  if (!req.user.permissions.includes(key)) {
    return next(
      ApiError.forbidden(`Missing required permission: ${key}`, {
        code: 'MISSING_PERMISSION',
        details: { module, action },
      }),
    );
  }
  return next();
};

export const authorizeAny = (...keys: string[]): Middleware => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized('Authentication required'));
  const allowed = keys.some((key) => req.user?.permissions.includes(key) ?? false);
  if (!allowed) {
    return next(
      ApiError.forbidden(`Missing required permission: one of ${keys.join(', ')}`, { code: 'MISSING_PERMISSION' }),
    );
  }
  return next();
};

/**
 * Blocker for client-scoped (Client / Operations) accounts.
 * The audit trail is a hard 403 for them, enforced here and in the controller.
 */
export const denyClientScoped: Middleware = (req, _res, next) => {
  if (req.user?.isClientScoped) {
    return next(
      ApiError.forbidden('This resource is not available for client accounts', { code: 'CLIENT_SCOPE_FORBIDDEN' }),
    );
  }
  return next();
};

/** Requires a role whose accessScope === 'all' (admin style visibility). */
export const requireFullScope: Middleware = (req, _res, next) => {
  if (req.user?.accessScope !== ACCESS_SCOPE.ALL) {
    return next(ApiError.forbidden('This resource requires an administrative scope', { code: 'SCOPE_REQUIRED' }));
  }
  return next();
};

export default { requirePermission, authorizeAny, denyClientScoped, requireFullScope };
