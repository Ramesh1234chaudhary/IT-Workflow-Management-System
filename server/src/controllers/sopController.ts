import * as sopService from '../services/sopService';
import { publicSOPTemplate, publicSOPVersion } from '../utils/serializers';
import { HTTP_STATUS } from '../utils/constants';
import { asyncHandler } from '../utils/helpers';
import type { AuthUser } from '../types/domain.js';
import type { Request, Response } from 'express';

const requireUser = (req: Request): AuthUser => {
  if (!req.user) throw new Error('Authentication required');
  return req.user;
};

/** GET /api/sop - list templates */
export const listTemplates = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const templates = await sopService.listTemplates({
    status: (req.query.status as string) || undefined,
    search: (req.query.search as string) || undefined,
    actor: user,
  });
  return res.status(HTTP_STATUS.OK).json({ success: true, items: templates.map(publicSOPTemplate) });
});

/** GET /api/sop/versions/latest - latest published version across all templates */
export const latestPublished = asyncHandler(async (_req: Request, res: Response) => {
  const version = await sopService.getLatestPublishedVersionAny();
  if (!version) {
    return res.status(HTTP_STATUS.OK).json({ success: true, version: null, message: 'No published SOP version yet' });
  }
  const template = await sopService.getTemplate(String(version.template));
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    version: publicSOPVersion(version as unknown as Parameters<typeof publicSOPVersion>[0]),
    template: publicSOPTemplate(template),
  });
});

/** GET /api/sop/:id */
export const getTemplate = asyncHandler(async (req: Request, res: Response) => {
  const template = await sopService.getTemplateByIdOrThrow(req.params.id);
  return res.status(HTTP_STATUS.OK).json({ success: true, template: publicSOPTemplate(template) });
});

/** POST /api/sop */
export const createTemplate = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const template = await sopService.createTemplate({ ...req.body, actor: user, req });
  const populated = await sopService.getTemplateByIdOrThrow(template._id.toString());
  return res.status(HTTP_STATUS.CREATED).json({ success: true, template: publicSOPTemplate(populated) });
});

/** PATCH /api/sop/:id */
export const updateTemplate = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const template = await sopService.updateTemplate(req.params.id, req.body, { actor: user, req } as { actor: AuthUser; req: Request });
  const populated = await sopService.getTemplateByIdOrThrow(template._id.toString());
  return res.status(HTTP_STATUS.OK).json({ success: true, template: publicSOPTemplate(populated) });
});

/** DELETE /api/sop/:id */
export const deleteTemplate = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  await sopService.deleteTemplate(req.params.id, { actor: user, req } as { actor: AuthUser; req: Request });
  return res.status(HTTP_STATUS.OK).json({ success: true, message: 'SOP template deleted' });
});

/** POST /api/sop/:id/stages */
export const addStage = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const template = await sopService.addStage(req.params.id, req.body, { actor: user, req } as { actor: AuthUser; req: Request });
  const populated = await sopService.getTemplateByIdOrThrow(template._id.toString());
  return res.status(HTTP_STATUS.CREATED).json({ success: true, template: publicSOPTemplate(populated) });
});

/** PATCH /api/sop/:id/stages/:stageId */
export const updateStage = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const template = await sopService.updateStage(req.params.id, req.params.stageId, req.body, { actor: user, req } as { actor: AuthUser; req: Request });
  const populated = await sopService.getTemplateByIdOrThrow(template._id.toString());
  return res.status(HTTP_STATUS.OK).json({ success: true, template: publicSOPTemplate(populated) });
});

/** DELETE /api/sop/:id/stages/:stageId - draft templates only */
export const deleteStage = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const template = await sopService.deleteStage(req.params.id, req.params.stageId, { actor: user, req } as { actor: AuthUser; req: Request });
  const populated = await sopService.getTemplateByIdOrThrow(template._id.toString());
  return res.status(HTTP_STATUS.OK).json({ success: true, template: publicSOPTemplate(populated) });
});

/** PATCH /api/sop/:id/stages/reorder */
export const reorderStages = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const template = await sopService.reorderStages(req.params.id, req.body.stageIds, { actor: user, req } as { actor: AuthUser; req: Request });
  const populated = await sopService.getTemplateByIdOrThrow(template._id.toString());
  return res.status(HTTP_STATUS.OK).json({ success: true, template: publicSOPTemplate(populated) });
});

/** POST /api/sop/:id/publish - creates an immutable version */
export const publishTemplate = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const { template, version } = await sopService.publishTemplate(req.params.id, {
    changeNote: req.body?.changeNote,
    actor: user,
    req,
  } as { changeNote?: string; actor: AuthUser; req: Request });
  const populated = await sopService.getTemplateByIdOrThrow(template._id.toString());
  return res.status(HTTP_STATUS.CREATED).json({
    success: true,
    message: `Version ${version.version} published. Existing projects keep their original version.`,
    template: publicSOPTemplate(populated),
    version: publicSOPVersion(version as unknown as Parameters<typeof publicSOPVersion>[0]),
  });
});

/** POST /api/sop/:id/draft */
export const createDraft = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const template = await sopService.createDraftFromVersion(req.params.id, { actor: user, req });
  const populated = await sopService.getTemplateByIdOrThrow(template._id.toString());
  return res.status(HTTP_STATUS.OK).json({ success: true, template: publicSOPTemplate(populated) });
});

/** GET /api/sop/:id/versions */
export const listVersions = asyncHandler(async (req: Request, res: Response) => {
  const versions = await sopService.listVersions(req.params.id);
  return res.status(HTTP_STATUS.OK).json({ success: true, items: versions.map(v => publicSOPVersion(v)) });
});

/** GET /api/sop/versions/:versionId */
export const getVersion = asyncHandler(async (req: Request, res: Response) => {
  const version = await sopService.getVersion(req.params.versionId);
  return res.status(HTTP_STATUS.OK).json({ success: true, version: publicSOPVersion(version as Record<string, unknown>) });
});

export default {
  listTemplates,
  latestPublished,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  addStage,
  updateStage,
  deleteStage,
  reorderStages,
  publishTemplate,
  createDraft,
  listVersions,
  getVersion,
};
