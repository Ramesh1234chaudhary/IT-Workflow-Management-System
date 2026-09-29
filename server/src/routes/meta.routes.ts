import { Router } from 'express';
import * as metaController from '../controllers/metaController';
import * as roleController from '../controllers/roleController';
import { authenticate, filterClientData, requirePermission } from '../middlewares/index';

const router = Router();

router.get('/health', metaController.health);

/**
 * Scoped to the real route prefixes on purpose. A blanket `router.use` would
 * also swallow unmatched paths and answer them with 401, hiding typos and
 * malformed URLs behind an authentication error instead of a 404.
 */
const protectedPaths = ['/notifications', '/integrations', '/reports'];
router.use(protectedPaths, authenticate, filterClientData);

router.get('/notifications', metaController.listNotifications);
router.patch('/notifications/read-all', metaController.markAllRead);
router.patch('/notifications/:id/read', metaController.markRead);

router.get('/integrations', metaController.integrations);

/* Reports are grouped here so admin analytics live under one permission family. */
router.get('/reports/summary', requirePermission('report', 'read'), roleController.summary);
router.get('/reports/project-progress', requirePermission('report', 'read'), roleController.projectProgress);
router.get('/reports/stage-distribution', requirePermission('report', 'read'), roleController.stageDistribution);
router.get('/reports/workload', requirePermission('report', 'read'), roleController.workload);

export default router;
