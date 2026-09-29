import { Router } from 'express';
import * as workflowController from '../controllers/workflowController';
import * as documentController from '../controllers/documentController';
import { authenticate, filterClientData, requirePermission, validate } from '../middlewares/index';
import { idSchema } from '../validators/index';

const router = Router();

router.use(authenticate, filterClientData);

/** GET /api/workflow/board */
router.get('/board', requirePermission('stage', 'read'), workflowController.getBoard);

/** GET /api/documents/:id/versions */
router.get('/documents/:id/versions', requirePermission('document', 'read'), validate(idSchema, 'params'), documentController.documentVersions);

/**
 * GET /api/documents/:id/download
 * `document:read` is the permission that covers reading a document's contents;
 * the catalogue deliberately has no separate download permission.
 */
router.get('/documents/:id/download', requirePermission('document', 'read'), validate(idSchema, 'params'), documentController.downloadDocument);

/** DELETE /api/documents/:id */
router.delete('/documents/:id', requirePermission('document', 'delete'), validate(idSchema, 'params'), documentController.deleteDocument);

export default router;
