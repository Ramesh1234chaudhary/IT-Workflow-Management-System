import { Router } from 'express';
import Joi from 'joi';
import * as auditController from '../controllers/auditController';
import { authenticate, denyClientScoped, filterClientData, requirePermission, validate } from '../middlewares/index';
import { auditQuerySchema } from '../validators/index';

const router = Router();

/**
 * Audit trail.
 *  - authenticate          -> 401 without a valid access token
 *  - denyClientScoped      -> 403 for Client / Operations accounts
 *  - requirePermission     -> 403 without the `audit:read` permission
 * The collection is append-only: this router exposes no write routes.
 */
router.use(authenticate, denyClientScoped, filterClientData);

router.get('/', requirePermission('audit', 'read'), validate(auditQuerySchema, 'query'), auditController.listAuditLogs);
router.get('/facets', requirePermission('audit', 'read'), auditController.auditFacets);
router.get(
  '/:entityType/:entityId',
  requirePermission('audit', 'read'),
  validate(
    Joi.object({
      entityType: Joi.string().trim().max(60).required(),
      entityId: Joi.string().pattern(/^[a-f\d]{24}$/i).required(),
    }).unknown(true),
    'params',
  ),
  auditController.entityTimeline,
);

export default router;
