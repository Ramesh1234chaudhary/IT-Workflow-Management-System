import * as reportService from '../services/reportService';
import { publicAuditLog } from '../utils/serializers';
import { HTTP_STATUS } from '../utils/constants';
import { asyncHandler, buildMeta } from '../utils/helpers';
import type { AuthUser } from '../types/domain.js';
import type { Request, Response } from 'express';

const requireUser = (req: Request): AuthUser => {
  if (!req.user) throw new Error('Authentication required');
  return req.user;
};

/**
 * GET /api/audit
 * Append-only trail. The route is guarded by denyClientScoped() so a Client /
 * Operations account always receives 403, plus `audit:read` permission.
 */
export const listAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const { items, page, limit, total } = await reportService.listAuditLogs(user, req.validatedQuery || req.query);
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    items: items.map(a => publicAuditLog(a as Record<string, unknown>)),
    pagination: buildMeta({ page, limit, total }),
  });
});

/** GET /api/audit/facets */
export const auditFacets = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const facets = await reportService.auditFacets(user);
  return res.status(HTTP_STATUS.OK).json({ success: true, ...facets });
});

/** GET /api/audit/:entityType/:entityId - timeline for a single record */
export const entityTimeline = asyncHandler(async (req: Request, res: Response) => {
  const { items, page, limit, total } = await reportService.entityTimeline(
    req.params.entityType,
    req.params.entityId,
    req.query,
  );
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    items: items.map(a => publicAuditLog(a as Record<string, unknown>)),
    pagination: buildMeta({ page, limit, total }),
  });
});

export default { listAuditLogs, auditFacets, entityTimeline };
