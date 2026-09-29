import { authenticate } from './auth';
import { denyClientScoped, requirePermission } from './rbac';
import { filterClientData } from './filterClientData';
import { validate } from './validate';
import { errorHandler, notFound } from './errorHandler';
import { apiLimiter, authLimiter } from './rateLimiter';
import { singleDocument, singleFile } from './upload';

export {
  authenticate,
  requirePermission,
  denyClientScoped,
  filterClientData,
  validate,
  errorHandler,
  notFound,
  authLimiter,
  apiLimiter,
  singleDocument,
  singleFile,
};

export default {
  authenticate,
  requirePermission,
  denyClientScoped,
  filterClientData,
  validate,
  errorHandler,
  notFound,
  authLimiter,
  apiLimiter,
  singleDocument,
  singleFile,
};
