import multer from 'multer';
import type { NextFunction, Request, Response } from 'express';
import ApiError from '../utils/ApiError';
import env from '../config/env';
import logger from '../utils/logger';

export const notFound = (req: Request, _res: Response, next: NextFunction): void => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

/** The subset of Mongoose error shapes this handler actually branches on. */
interface DriverError {
  message?: string;
  name?: string;
  status?: number;
  statusCode?: number;
  code?: string | number;
  details?: string[] | Record<string, unknown> | null;
  errors?: Record<string, { path?: string; message?: string }>;
  path?: string;
  keyPattern?: Record<string, unknown>;
  stack?: string;
}

export const errorHandler = (err: DriverError, req: Request, res: Response, _next: NextFunction): void => {
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Something went wrong';
  let code = err.code as string | undefined;
  let details: unknown = err.details || null;

  if (err.name === 'ValidationError' && err.errors) {
    status = 422;
    code = 'MONGOOSE_VALIDATION_ERROR';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    message = Object.values(err.errors)
      .map((e) => `${e.path}: ${e.message}`)
      .join('; ');
  } else if (err.name === 'CastError') {
    status = 400;
    code = 'INVALID_IDENTIFIER';
    message = `Invalid value for "${err.path}"`;
  } else if (err.code === 11000) {
    status = 409;
    code = 'DUPLICATE_KEY';
    const field = Object.keys(err.keyPattern || { field: 1 })[0];
    message = `A record with this ${field} already exists`;
    details = { field };
  } else if (err instanceof multer.MulterError) {
    status = 400;
    code = err.code;
    message =
      err.code === 'LIMIT_FILE_SIZE'
        ? `File is too large (max ${env.uploads.maxSizeBytes / 1024 / 1024} MB)`
        : err.message;
  }

  if (status >= 500) {
    logger.error(`[${req.method} ${req.originalUrl}]`, err);
    if (env.isProduction) message = 'Internal server error';
  }

  const body: Record<string, unknown> = {
    success: false,
    message,
    code: code || (status === 500 ? 'INTERNAL_SERVER_ERROR' : 'ERROR'),
  };
  if (details) body.details = details;
  if (!env.isProduction) body.stack = err.stack;

  res.status(status).json(body);
};

export default { notFound, errorHandler };
