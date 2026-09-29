import { Router } from 'express';
import * as roleController from '../controllers/roleController';
import { authenticate, filterClientData, requirePermission, validate } from '../middlewares/index';
import { createRoleSchema, idSchema, updateRoleSchema } from '../validators/index';

const router = Router();

router.use(authenticate, filterClientData);

/* Permissions are readable by anyone who can read roles (needed by the matrix) */
router.get('/permissions', requirePermission('permission', 'read'), roleController.listPermissions);
router.get('/permission-matrix', requirePermission('role', 'read'), roleController.permissionMatrix);

router.get('/', requirePermission('role', 'read'), roleController.listRoles);
router.get('/:id', requirePermission('role', 'read'), validate(idSchema, 'params'), roleController.getRole);
router.post('/', requirePermission('role', 'create'), validate(createRoleSchema), roleController.createRole);
router.patch('/:id', requirePermission('role', 'update'), validate(idSchema, 'params'), validate(updateRoleSchema), roleController.updateRole);
router.delete('/:id', requirePermission('role', 'delete'), validate(idSchema, 'params'), roleController.deleteRole);

export default router;
