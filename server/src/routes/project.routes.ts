import { Router } from 'express';
import * as projectController from '../controllers/projectController';
import * as workflowController from '../controllers/workflowController';
import * as documentController from '../controllers/documentController';
import { authenticate, filterClientData, requirePermission, singleDocument, validate } from '../middlewares/index';
import {
  assignStageSchema,
  assignStagesSchema,
  createProjectSchema,
  documentUploadSchema,
  idSchema,
  listProjectsSchema,
  previewProjectSchema,
  projectParamsSchema,
  remarkSchema,
  updateProjectSchema,
  updateStatusSchema,
} from '../validators/index';

const router = Router();

router.use(authenticate, filterClientData);

/* --------------------------------- Projects -------------------------------- */

router.get('/', requirePermission('project', 'read'), validate(listProjectsSchema, 'query'), projectController.listProjects);
router.get('/options', requirePermission('project', 'read'), projectController.projectOptions);

router.post('/preview', requirePermission('project', 'create'), validate(previewProjectSchema), projectController.previewStages);

router.post('/', requirePermission('project', 'create'), validate(createProjectSchema), projectController.createProject);

router.get('/:id', requirePermission('project', 'read'), validate(idSchema, 'params'), projectController.getProject);
router.patch(
  '/:id',
  requirePermission('project', 'update'),
  validate(idSchema, 'params'),
  validate(updateProjectSchema),
  projectController.updateProject,
);
router.delete('/:id', requirePermission('project', 'delete'), validate(idSchema, 'params'), projectController.deleteProject);

router.patch(
  '/:id/stages/assign',
  requirePermission('project', 'assign'),
  validate(idSchema, 'params'),
  validate(assignStagesSchema),
  projectController.assignStages,
);

/* ------------------------------ Workflow stages ---------------------------- */

router.get('/:projectId/stages', requirePermission('stage', 'read'), validate(projectParamsSchema, 'params'), workflowController.listStages);

router.get(
  '/:projectId/status-history',
  requirePermission('stage', 'readHistory'),
  validate(projectParamsSchema, 'params'),
  workflowController.getProjectHistory,
);

router.get(
  '/:projectId/stages/:stageId',
  requirePermission('stage', 'read'),
  validate(projectParamsSchema, 'params'),
  workflowController.getStage,
);

/**
 * PATCH /api/projects/:projectId/stages/:stageId/status
 * The one and only manual status transition.
 */
router.patch(
  '/:projectId/stages/:stageId/status',
  requirePermission('stage', 'updateStatus'),
  validate(projectParamsSchema, 'params'),
  validate(updateStatusSchema),
  workflowController.updateStageStatus,
);

router.get(
  '/:projectId/stages/:stageId/status-history',
  requirePermission('stage', 'readHistory'),
  validate(projectParamsSchema, 'params'),
  workflowController.getStatusHistory,
);

router.patch(
  '/:projectId/stages/:stageId/assign',
  requirePermission('stage', 'assign'),
  validate(projectParamsSchema, 'params'),
  validate(assignStageSchema),
  workflowController.assignStage,
);

router.post(
  '/:projectId/stages/:stageId/remarks',
  requirePermission('stage', 'remark'),
  validate(projectParamsSchema, 'params'),
  validate(remarkSchema),
  workflowController.addRemark,
);

/* -------------------------------- Documents -------------------------------- */

router.get('/:projectId/documents', requirePermission('document', 'read'), validate(projectParamsSchema, 'params'), documentController.listDocuments);

router.post(
  '/:projectId/documents',
  requirePermission('document', 'upload'),
  validate(projectParamsSchema, 'params'),
  singleDocument,
  validate(documentUploadSchema),
  documentController.uploadDocument,
);

export default router;
