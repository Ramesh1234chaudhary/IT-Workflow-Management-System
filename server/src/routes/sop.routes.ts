import { Router } from 'express';
import * as sopController from '../controllers/sopController';
import { authenticate, filterClientData, requirePermission, validate } from '../middlewares/index';
import {
  addStageSchema,
  createTemplateSchema,
  idSchema,
  publishSchema,
  reorderStagesSchema,
  sopParamsSchema,
  updateStageSchema,
  updateTemplateSchema,
} from '../validators/index';

const router = Router();

router.use(authenticate, filterClientData);

/** GET /api/sop/versions/latest */
router.get('/versions/latest', requirePermission('sop', 'read'), sopController.latestPublished);

/** GET /api/sop/versions/:versionId */
router.get('/versions/:versionId', requirePermission('sop', 'version:read'), validate(idSchema, 'params'), sopController.getVersion);

/** GET /api/sop */
router.get('/', requirePermission('sop', 'read'), sopController.listTemplates);

/** GET /api/sop/:id */
router.get('/:id', requirePermission('sop', 'read'), validate(idSchema, 'params'), sopController.getTemplate);

/** POST /api/sop */
router.post('/', requirePermission('sop', 'create'), validate(createTemplateSchema), sopController.createTemplate);

/** PATCH /api/sop/:id - draft templates only */
router.patch(
  '/:id',
  requirePermission('sop', 'update'),
  validate(idSchema, 'params'),
  validate(updateTemplateSchema),
  sopController.updateTemplate,
);

/** DELETE /api/sop/:id - draft templates only */
router.delete('/:id', requirePermission('sop', 'delete'), validate(idSchema, 'params'), sopController.deleteTemplate);

/** POST /api/sop/:id/stages */
router.post(
  '/:id/stages',
  requirePermission('sop', 'create'),
  validate(idSchema, 'params'),
  validate(addStageSchema),
  sopController.addStage,
);

/** PATCH /api/sop/:id/stages/reorder - drag & drop persistence */
router.patch(
  '/:id/stages/reorder',
  requirePermission('sop', 'reorder'),
  validate(idSchema, 'params'),
  validate(reorderStagesSchema),
  sopController.reorderStages,
);

/** PATCH /api/sop/:id/stages/:stageId - draft templates only */
router.patch(
  '/:id/stages/:stageId',
  requirePermission('sop', 'update'),
  validate(sopParamsSchema, 'params'),
  validate(updateStageSchema),
  sopController.updateStage,
);

/** DELETE /api/sop/:id/stages/:stageId - draft templates only */
router.delete(
  '/:id/stages/:stageId',
  requirePermission('sop', 'delete'),
  validate(sopParamsSchema, 'params'),
  sopController.deleteStage,
);

/** POST /api/sop/:id/publish - creates an immutable version */
router.post(
  '/:id/publish',
  requirePermission('sop', 'publish'),
  validate(idSchema, 'params'),
  validate(publishSchema),
  sopController.publishTemplate,
);

/** POST /api/sop/:id/draft - clones the latest published version back into a draft */
router.post('/:id/draft', requirePermission('sop', 'update'), validate(idSchema, 'params'), sopController.createDraft);

/** GET /api/sop/:id/versions - version history */
router.get('/:id/versions', requirePermission('sop', 'version:read'), validate(idSchema, 'params'), sopController.listVersions);

export default router;
