import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import env from '../config/env';
import { HTTP_STATUS } from '../utils/constants';

const handler = (message: string) => (_req: Request, res: Response) => {
  res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
    success: false,
    message,
    code: 'TOO_MANY_REQUESTS',
  });
};

export const authLimiter = rateLimit({
  windowMs: env.security.authRateLimitWindowMs,
  max: env.security.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: handler('Too many authentication attempts. Please wait a few minutes and try again.'),
});

export const apiLimiter = rateLimit({
  windowMs: env.security.apiRateLimitWindowMs,
  max: env.security.apiRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: handler('Too many requests. Please slow down and try again shortly.'),
});

export default { authLimiter, apiLimiter };
