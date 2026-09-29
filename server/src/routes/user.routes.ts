import { Router } from 'express';
import * as userController from '../controllers/userController';
import { authenticate, filterClientData, requirePermission, validate } from '../middlewares/index';
import {
  createUserSchema,
  deactivateSchema,
  idSchema,
  listUsersSchema,
  reassignSchema,
  updateUserSchema,
} from '../validators/index';

const router = Router();

router.use(authenticate, filterClientData);

/** GET /api/users/assignable */
router.get('/assignable', requirePermission('user', 'read'), userController.assignableUsers);

/** GET /api/users/reassign-targets */
router.get('/reassign-targets', requirePermission('user', 'reassign'), userController.reassignTargets);

/** GET /api/users */
router.get('/', requirePermission('user', 'read'), validate(listUsersSchema, 'query'), userController.listUsers);

/** GET /api/users/:id */
router.get('/:id', requirePermission('user', 'read'), validate(idSchema, 'params'), userController.getUser);

/** GET /api/users/:id/assignments */
router.get('/:id/assignments', requirePermission('user', 'read'), validate(idSchema, 'params'), userController.getAssignments);

/** GET /api/users/:id/deactivation-preview */
router.get(
  '/:id/deactivation-preview',
  requirePermission('user', 'deactivate'),
  validate(idSchema, 'params'),
  userController.deactivationPreview,
);

/** POST /api/users */
router.post('/', requirePermission('user', 'create'), validate(createUserSchema), userController.createUser);

/** PATCH /api/users/:id */
router.patch('/:id', requirePermission('user', 'update'), validate(idSchema, 'params'), validate(updateUserSchema), userController.updateUser);

/** DELETE /api/users/:id */
router.delete('/:id', requirePermission('user', 'delete'), validate(idSchema, 'params'), userController.deleteUser);

/**
 * PATCH /api/users/:id/deactivate
 * 409 CONFLICT when the user still owns active stage assignments.
 */
router.patch(
  '/:id/deactivate',
  requirePermission('user', 'deactivate'),
  validate(idSchema, 'params'),
  validate(deactivateSchema),
  userController.deactivateUser,
);

/** PATCH /api/users/:id/reactivate */
router.patch('/:id/reactivate', requirePermission('user', 'update'), validate(idSchema, 'params'), userController.reactivateUser);

/** POST /api/users/:id/reassign - moves all active stage assignments */
router.post(
  '/:id/reassign',
  requirePermission('user', 'reassign'),
  validate(idSchema, 'params'),
  validate(reassignSchema),
  userController.reassignUser,
);

export default router;
