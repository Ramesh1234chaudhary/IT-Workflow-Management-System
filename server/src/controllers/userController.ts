import * as userService from '../services/userService';
import { publicUser } from '../utils/serializers';
import ApiError from '../utils/ApiError';
import { HTTP_STATUS } from '../utils/constants';
import { asyncHandler } from '../utils/helpers';
import type { AuthUser } from '../types/domain.js';
import type { Request, Response } from 'express';

const requireUser = (req: Request): AuthUser => {
  if (!req.user) throw new Error('Authentication required');
  return req.user;
};

/** GET /api/users */
export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const { items, page, limit, total } = await userService.listUsers(user, req.validatedQuery || req.query);
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    items: items.map((u) => ({ ...publicUser(u), activeAssignments: u.activeAssignments || 0 })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

/** GET /api/users/assignable - lightweight list for dropdowns */
export const assignableUsers = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const users = await userService.getAssignableUsers(user);
  return res.status(HTTP_STATUS.OK).json({ success: true, items: users.map(publicUser) });
});

/** GET /api/users/:id */
export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const found = await userService.getUserById(req.params.id);
  if (!found) throw ApiError.notFound('User not found');
  const assignments = await userService.getActiveAssignments(found._id.toString());
  return res.status(HTTP_STATUS.OK).json({ success: true, user: publicUser(found), assignments });
});

/** POST /api/users */
export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const actor = requireUser(req);
  const created = await userService.createUser(req.body, { actor, req });
  const populated = await userService.getUserById(created._id.toString());
  return res.status(HTTP_STATUS.CREATED).json({ success: true, user: publicUser(populated) });
});

/** PATCH /api/users/:id */
export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const actor = requireUser(req);
  const updated = await userService.updateUser(req.params.id, req.body, { actor, req });
  return res.status(HTTP_STATUS.OK).json({ success: true, user: publicUser(updated) });
});

/** DELETE /api/users/:id */
export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const actor = requireUser(req);
  await userService.deleteUser(req.params.id, { actor, req });
  return res.status(HTTP_STATUS.OK).json({ success: true, message: 'User deleted' });
});

/**
 * PATCH /api/users/:id/deactivate
 * Returns 409 CONFLICT when the user still owns active stage assignments.
 * The 409 body carries the offending assignments so the UI can open the
 * reassign modal.
 */
export const deactivateUser = asyncHandler(async (req: Request, res: Response) => {
  const actor = requireUser(req);
  const deactivated = await userService.deactivateUser(req.params.id, {
    reason: req.body?.reason,
    actor,
    req,
  });
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    message: `${deactivated.name} has been deactivated`,
    user: publicUser(deactivated),
  });
});

/** PATCH /api/users/:id/reactivate */
export const reactivateUser = asyncHandler(async (req: Request, res: Response) => {
  const actor = requireUser(req);
  const reactivated = await userService.reactivateUser(req.params.id, { actor, req });
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    message: `${reactivated.name} has been reactivated`,
    user: publicUser(reactivated),
  });
});

/** GET /api/users/:id/assignments */
export const getAssignments = asyncHandler(async (req: Request, res: Response) => {
  const assignments = await userService.getActiveAssignments(req.params.id);
  return res.status(HTTP_STATUS.OK).json({ success: true, ...assignments });
});

/** GET /api/users/:id/deactivation-preview */
export const deactivationPreview = asyncHandler(async (req: Request, res: Response) => {
  const preview = await userService.deactivateUserGuardPreview(req.params.id);
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    user: publicUser(preview.user),
    assignments: preview.assignments,
    canDeactivate: preview.canDeactivate,
  });
});

/** POST /api/users/:id/reassign */
export const reassignUser = asyncHandler(async (req: Request, res: Response) => {
  const actor = requireUser(req);
  const result = await userService.reassignUserAssignments(req.params.id, {
    newOwnerId: req.body.newOwnerId,
    projectIds: req.body.projectIds,
    note: req.body.note,
    actor,
    req,
  });
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    message: `${result.reassigned} stage assignment(s) moved from ${result.from} to ${result.to}. Stage statuses were not changed.`,
    ...result,
  });
});

/** GET /api/users/reassign-targets */
export const reassignTargets = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const [users, projects] = await Promise.all([
    userService.getAssignableUsers(user),
    userService.accessibleProjects(user),
  ]);
  // Serialised like /users/assignable, so the pickers read `id` like the rest of the UI.
  return res.status(HTTP_STATUS.OK).json({ success: true, users: users.map(publicUser), projects });
});

export default {
  listUsers,
  assignableUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  deactivateUser,
  reactivateUser,
  getAssignments,
  deactivationPreview,
  reassignUser,
  reassignTargets,
};
