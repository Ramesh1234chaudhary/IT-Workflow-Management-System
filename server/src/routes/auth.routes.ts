import { Router } from 'express';
import * as authController from '../controllers/authController';
import { authenticate, authLimiter, validate } from '../middlewares/index';
import { loginSchema } from '../validators/index';
import Joi from 'joi';
import env from '../config/env';

const router = Router();

/** POST /api/auth/login - rate limited, sets the httpOnly refresh cookie */
router.post('/login', authLimiter, validate(loginSchema), authController.login);

/** POST /api/auth/refresh - rotates the refresh token and issues a new access token */
router.post('/refresh', authController.refresh);

/** POST /api/auth/logout - revokes the refresh token and clears the cookie */
router.post('/logout', authController.logout);

/** GET /api/auth/me */
router.get('/me', authenticate, authController.me);

/** POST /api/auth/change-password */
router.post(
  '/change-password',
  authenticate,
  validate(
    Joi.object({
      currentPassword: Joi.string().required(),
      newPassword: Joi.string().min(8).max(128).required(),
    }),
  ),
  authController.changePassword,
);

router.get('/config', (_req, res) => {
  res.json({
    success: true,
    accessTokenExpiresIn: env.jwt.accessTtl,
    refreshCookieName: env.cookie.refreshName,
  });
});

export default router;
