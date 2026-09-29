import * as projectService from '../services/projectService';
import { canSeeInternalData } from '../services/accessService';
import { publicProject, publicSOPVersion } from '../utils/serializers';
import { HTTP_STATUS } from '../utils/constants';
import { asyncHandler } from '../utils/helpers';
import type { AuthUser } from '../types/domain.js';
import type { Request, Response } from 'express';

const requireUser = (req: Request): AuthUser => {
  if (!req.user) throw new Error('Authentication required');
  return req.user;
};

/** GET /api/projects */
export const listProjects = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const query = req.validatedQuery || req.query;
  const { projects, page, limit, total } = await projectService.listProjects(user, query);
  const includeInternal = canSeeInternalData(user);

  return res.status(HTTP_STATUS.OK).json({
    success: true,
    items: projects.map((p) => publicProject(p, { includeStages: true, includeInternalFields: includeInternal })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

/** GET /api/projects/options - lightweight list for dropdowns */
export const projectOptions = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const projects = await projectService.projectOptions(user);
  return res.status(HTTP_STATUS.OK).json({ success: true, items: projects });
});

/**
 * POST /api/projects/preview
 * Returns the stages that WOULD be generated from the latest published SOP
 * version, so the Create Project screen can preview before saving.
 */
export const previewStages = asyncHandler(async (req: Request, res: Response) => {
  const preview = await projectService.previewStages({
    sopTemplate: req.body?.sopTemplate,
    startDate: req.body?.startDate,
    targetEndDate: req.body?.targetEndDate,
  });
  return res.status(HTTP_STATUS.OK).json({ success: true, ...preview });
});

/** POST /api/projects - auto-generates stages from the latest published SOP */
export const createProject = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const { project, generatedStages, version } = await projectService.createProject(req.body, { actor: user, req });

  const { project: populated, stages } = await projectService.getProjectWithStages(project._id.toString(), user);

  return res.status(HTTP_STATUS.CREATED).json({
    success: true,
    message: `Project created with ${generatedStages} workflow stage(s) from ${project.sopVersionNumber ? `SOP v${project.sopVersionNumber}` : 'the published SOP'}.`,
    project: publicProject({ ...populated, stages }, { includeInternalFields: canSeeInternalData(user) }),
    generatedStages,
    sopVersion: publicSOPVersion(version),
    stagesPreview: stages.map((s) => ({ name: s.name, order: s.order, status: s.status, clientVisible: s.clientVisible })),
  });
});

/** GET /api/projects/:id - client filtered when the caller is client scoped */
export const getProject = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const { project, stages, allStageCount } = await projectService.getProjectWithStages(req.params.id, user);
  const includeInternal = canSeeInternalData(user);

  return res.status(HTTP_STATUS.OK).json({
    success: true,
    project: publicProject({ ...project, stages }, { includeInternalFields: includeInternal }),
    meta: {
      visibleStageCount: stages.length,
      totalStageCount: allStageCount,
      filtered: !includeInternal,
    },
  });
});

/** PATCH /api/projects/:id */
export const updateProject = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  await projectService.updateProject(req.params.id, req.body, { actor: user, req } as { actor: AuthUser; req: Request });
  const { project, stages } = await projectService.getProjectWithStages(req.params.id, user);
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    project: publicProject({ ...project, stages }, { includeInternalFields: canSeeInternalData(user) }),
  });
});

/** DELETE /api/projects/:id */
export const deleteProject = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  await projectService.deleteProject(req.params.id, { actor: user, req } as { actor: AuthUser; req: Request });
  return res.status(HTTP_STATUS.OK).json({ success: true, message: 'Project deleted' });
});

/** PATCH /api/projects/:id/stages/assign - bulk assignment */
export const assignStages = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const results = await projectService.assignStages(req.params.id, req.body.assignments, {
    actor: user,
    req,
  } as { actor: AuthUser; req: Request });
  const failed = results.filter((r) => !r.success);
  if (failed.length === results.length) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: 'No stage could be assigned',
      results,
    });
  }
  return res.status(HTTP_STATUS.OK).json({ success: true, results });
});

export default {
  listProjects,
  projectOptions,
  previewStages,
  createProject,
  getProject,
  updateProject,
  deleteProject,
  assignStages,
};
