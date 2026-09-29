import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import roleRoutes from './role.routes';
import sopRoutes from './sop.routes';
import projectRoutes from './project.routes';
import workflowRoutes from './workflow.routes';
import auditRoutes from './audit.routes';
import metaRoutes from './meta.routes';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    success: true,
    name: 'IT Workflow Management API',
    version: '1.0.0',
    endpoints: [
      'POST   /api/auth/login',
      'POST   /api/auth/refresh',
      'POST   /api/auth/logout',
      'GET    /api/auth/me',
      'CRUD   /api/users',
      'PATCH  /api/users/:id/deactivate',
      'POST   /api/users/:id/reassign',
      'CRUD   /api/roles',
      'GET    /api/roles/permissions',
      'CRUD   /api/sop',
      'POST   /api/sop/:id/publish',
      'PATCH  /api/sop/:id/stages/reorder',
      'CRUD   /api/projects',
      'GET    /api/projects/:projectId/stages',
      'PATCH  /api/projects/:projectId/stages/:stageId/status',
      'GET    /api/workflow/board',
      'GET    /api/audit',
      'GET    /api/reports/*',
    ],
  });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/sop', sopRoutes);
router.use('/projects', projectRoutes);
router.use('/workflow', workflowRoutes);
router.use('/audit', auditRoutes);
router.use('/', metaRoutes);

export default router;
