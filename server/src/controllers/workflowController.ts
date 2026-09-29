import * as workflowService from '../services/workflowService';
import { buildProjectScope, canSeeInternalData } from '../services/accessService';
import { Project } from '../models/index';
import { publicHistory } from '../utils/serializers';
import { HTTP_STATUS, STAGE_STATUS } from '../utils/constants';
import { asyncHandler, buildMeta } from '../utils/helpers';
import type { AuthUser } from '../types/domain.js';
import type { Request, Response } from 'express';

const requireUser = (req: Request): AuthUser => {
  if (!req.user) throw new Error('Authentication required');
  return req.user;
};

/** GET /api/projects/:projectId/stages */
export const listStages = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const { project, stages } = await workflowService.listStages(req.params.projectId, user, req.query);
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    project: { id: project._id, name: project.name, code: project.code, status: project.status, priority: project.priority },
    stages: canSeeInternalData(user)
      ? stages
      : stages.map((s) => ({ ...s, internalRemarks: undefined, documents: undefined, blocker: undefined, holdReason: undefined })),
  });
});

/** GET /api/projects/:projectId/stages/:stageId */
export const getStage = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const { stage } = await workflowService.getStage(req.params.projectId, req.params.stageId, user);
  return res.status(HTTP_STATUS.OK).json({ success: true, stage });
});

/**
 * PATCH /api/projects/:projectId/stages/:stageId/status
 * The single, explicit, manual status transition. Uploading a document or
 * adding a remark never routes through here.
 */
export const updateStageStatus = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const { stage, history } = await workflowService.updateStageStatus(
    req.params.projectId,
    req.params.stageId,
    req.body,
    { actor: user, req },
  );

  return res.status(HTTP_STATUS.OK).json({
    success: true,
    message: `Stage status changed to "${stage.status}"`,
    stage: {
      id: stage._id,
      name: stage.name,
      stageKey: stage.stageKey,
      order: stage.order,
      status: stage.status,
      blocker: stage.blocker,
      holdReason: stage.holdReason,
      completionDate: stage.completionDate,
      completedAt: stage.completedAt,
      startedAt: stage.startedAt,
      dueDate: stage.dueDate,
      owner: stage.owner,
      updatedAt: stage.updatedAt,
    },
    history: publicHistory(history as unknown as Parameters<typeof publicHistory>[0]),
  });
});

/** GET /api/projects/:projectId/stages/:stageId/status-history */
export const getStatusHistory = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const { items, page, limit, total } = await workflowService.getStatusHistory(
    req.params.projectId,
    req.params.stageId,
    user,
    req.query,
  );
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    items: items.map(h => publicHistory(h as Record<string, unknown>)),
    pagination: buildMeta({ page, limit, total }),
  });
});

/** GET /api/projects/:projectId/status-history */
export const getProjectHistory = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const { items, page, limit, total } = await workflowService.getProjectHistory(req.params.projectId, user, req.query);
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    items: items.map(h => publicHistory(h as Record<string, unknown>)),
    pagination: buildMeta({ page, limit, total }),
  });
});

/** PATCH /api/projects/:projectId/stages/:stageId/assign */
export const assignStage = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const stage = await workflowService.assignStage(req.params.projectId, req.params.stageId, req.body, {
    actor: user,
    req,
  });
  return res.status(HTTP_STATUS.OK).json({ success: true, stage });
});

/** POST /api/projects/:projectId/stages/:stageId/remarks - never changes status */
export const addRemark = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const stage = await workflowService.addStageRemark(req.params.projectId, req.params.stageId, {
    remark: req.body.remark,
    actor: user,
    req,
  });
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Internal remark saved. Workflow status was not changed.',
    stage: { id: stage._id, status: stage.status, internalRemarks: stage.internalRemarks },
  });
});

/** GET /api/workflow/board - flat board of stages across accessible projects */
export const getBoard = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const accessible = await Project.find(buildProjectScope(user)).select('_id name code status priority').lean();
  const ids = new Set(accessible.map((p) => String(p._id)));

  const stages = await workflowService.getBoardData(user, { ...req.query });
  const scoped = stages.filter((s) => ids.has(String(s.project?._id)));
  const visible = canSeeInternalData(user) ? scoped : scoped.filter((s) => s.clientVisible === true);

  return res.status(HTTP_STATUS.OK).json({
    success: true,
    projects: accessible,
    stages: visible,
    summary: {
      total: visible.length,
      [STAGE_STATUS.NOT_STARTED]: visible.filter((s) => s.status === STAGE_STATUS.NOT_STARTED).length,
      [STAGE_STATUS.IN_PROGRESS]: visible.filter((s) => s.status === STAGE_STATUS.IN_PROGRESS).length,
      [STAGE_STATUS.ON_HOLD]: visible.filter((s) => s.status === STAGE_STATUS.ON_HOLD).length,
      [STAGE_STATUS.BLOCKED]: visible.filter((s) => s.status === STAGE_STATUS.BLOCKED).length,
      [STAGE_STATUS.COMPLETED]: visible.filter((s) => s.status === STAGE_STATUS.COMPLETED).length,
    },
  });
});

export default {
  listStages,
  getStage,
  updateStageStatus,
  getStatusHistory,
  getProjectHistory,
  assignStage,
  addRemark,
  getBoard,
};
