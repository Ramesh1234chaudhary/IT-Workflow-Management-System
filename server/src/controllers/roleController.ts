import * as roleService from '../services/roleService';
import * as reportService from '../services/reportService';
import { publicPermission, publicRole } from '../utils/serializers';
import { HTTP_STATUS } from '../utils/constants';
import { asyncHandler } from '../utils/helpers';
import type { AuthUser } from '../types/domain.js';
import type { Request, Response } from 'express';

const requireUser = (req: Request): AuthUser => {
  if (!req.user) throw new Error('Authentication required');
  return req.user;
};

/* --------------------------------- Roles --------------------------------- */

export const listRoles = asyncHandler(async (_req: Request, res: Response) => {
  const roles = await roleService.listRoles(_req.query);
  return res.status(HTTP_STATUS.OK).json({ success: true, items: roles.map(publicRole) });
});

export const getRole = asyncHandler(async (req: Request, res: Response) => {
  const role = await roleService.getRole(req.params.id);
  return res.status(HTTP_STATUS.OK).json({ success: true, role: publicRole(role) });
});

export const createRole = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const role = await roleService.createRole(req.body, { actor: user, req });
  const populated = await roleService.getRole(role._id);
  return res.status(HTTP_STATUS.CREATED).json({ success: true, role: publicRole(populated) });
});

export const updateRole = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const role = await roleService.updateRole(req.params.id, req.body, { actor: user, req });
  const populated = await roleService.getRole(role._id);
  return res.status(HTTP_STATUS.OK).json({ success: true, role: publicRole(populated) });
});

export const deleteRole = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  await roleService.deleteRole(req.params.id, { actor: user, req });
  return res.status(HTTP_STATUS.OK).json({ success: true, message: 'Role deleted' });
});

/* ------------------------------ Permissions ------------------------------ */

export const listPermissions = asyncHandler(async (_req: Request, res: Response) => {
  const permissions = await roleService.listPermissions(_req.query);
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    items: permissions.map(publicPermission),
    modules: [...new Set(permissions.map((p) => p.module))].sort(),
  });
});

export const permissionMatrix = asyncHandler(async (_req: Request, res: Response) => {
  const matrix = await roleService.permissionMatrix();
  return res.status(HTTP_STATUS.OK).json({ success: true, ...matrix });
});

/* -------------------------------- Reports -------------------------------- */

export const summary = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const data = await reportService.summaryReport(user);
  return res.status(HTTP_STATUS.OK).json({ success: true, ...data });
});

export const projectProgress = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const data = await reportService.projectProgressReport(user, req.query);
  return res.status(HTTP_STATUS.OK).json({ success: true, ...data });
});

export const stageDistribution = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const data = await reportService.stageDistributionReport(user);
  return res.status(HTTP_STATUS.OK).json({ success: true, ...data });
});

export const workload = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const data = await reportService.workloadReport(user);
  return res.status(HTTP_STATUS.OK).json({ success: true, ...data });
});

export default {
  listRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  listPermissions,
  permissionMatrix,
  summary,
  projectProgress,
  stageDistribution,
  workload,
};
