import { HTTP_STATUS } from './constants';

export interface ApiErrorOptions {
  code?: string;
  /** A list of offending field names, or a small context object. Diagnostics only. */
  details?: string[] | Record<string, unknown> | Record<string, unknown>[] | null;
}

const DEFAULT_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_SERVER_ERROR',
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: string[] | Record<string, unknown> | Record<string, unknown>[] | null;
  readonly isOperational = true;

  constructor(status: number, message: string, options: ApiErrorOptions = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = options.code ?? DEFAULT_CODES[status] ?? 'ERROR';
    this.details = options.details ?? null;
    Error.captureStackTrace(this, ApiError);
  }

  static badRequest(message = 'Bad request', options?: ApiErrorOptions) {
    return new ApiError(HTTP_STATUS.BAD_REQUEST, message, options);
  }

  static unauthorized(message = 'Authentication required', options?: ApiErrorOptions) {
    return new ApiError(HTTP_STATUS.UNAUTHORIZED, message, options);
  }

  static forbidden(message = 'You do not have permission to perform this action', options?: ApiErrorOptions) {
    return new ApiError(HTTP_STATUS.FORBIDDEN, message, options);
  }

  static notFound(message = 'Resource not found', options?: ApiErrorOptions) {
    return new ApiError(HTTP_STATUS.NOT_FOUND, message, options);
  }

  static conflict(message = 'Resource conflict', options?: ApiErrorOptions) {
    return new ApiError(HTTP_STATUS.CONFLICT, message, options);
  }

  static unprocessable(message = 'Validation failed', options?: ApiErrorOptions) {
    return new ApiError(HTTP_STATUS.UNPROCESSABLE, message, options);
  }

  static tooManyRequests(message = 'Too many requests', options?: ApiErrorOptions) {
    return new ApiError(HTTP_STATUS.TOO_MANY_REQUESTS, message, options);
  }

  static internal(message = 'Internal server error', options?: ApiErrorOptions) {
    return new ApiError(HTTP_STATUS.SERVER_ERROR, message, options);
  }
}

export default ApiError;
