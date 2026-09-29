import Joi from 'joi';
import { PRIORITY_VALUES, PROJECT_STATUS_VALUES, STAGE_STATUS_VALUES } from '../utils/constants';

export const idSchema: Joi.ObjectSchema = Joi.object({
  id: Joi.string().pattern(/^[a-f\d]{24}$/i).required().messages({ 'string.pattern.base': 'Invalid id' }),
}).unknown(true);

export const projectParamsSchema: Joi.ObjectSchema = Joi.object({
  projectId: Joi.string().pattern(/^[a-f\d]{24}$/i).required().messages({ 'string.pattern.base': 'Invalid project id' }),
  stageId: Joi.string().pattern(/^[a-f\d]{24}$/i).optional().messages({ 'string.pattern.base': 'Invalid stage id' }),
}).unknown(true);

export const sopParamsSchema: Joi.ObjectSchema = Joi.object({
  id: Joi.string().pattern(/^[a-f\d]{24}$/i).required().messages({ 'string.pattern.base': 'Invalid template id' }),
  stageId: Joi.string().pattern(/^[a-f\d]{24}$/i).required().messages({ 'string.pattern.base': 'Invalid stage id' }),
}).unknown(true);

export const objectId: Joi.StringSchema = Joi.string().pattern(/^[a-f\d]{24}$/i);
export const optionalObjectId: Joi.StringSchema = objectId.allow('', null);

export const paginationSchema: Joi.ObjectSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(120).allow(''),
  sort: Joi.string().trim().max(40).allow(''),
}).unknown(true);

const email: Joi.StringSchema = Joi.string().trim().lowercase().email().max(160);

export const loginSchema: Joi.ObjectSchema = Joi.object({
  email: email.required().messages({ 'string.email.base': 'Please provide a valid email address' }),
  password: Joi.string().required().min(1).max(128).messages({ 'any.required': 'Password is required' }),
});

export const createUserSchema: Joi.ObjectSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  email: email.required(),
  password: Joi.string().min(8).max(128).required().messages({ 'string.min': 'Password must be at least 8 characters' }),
  role: objectId.required(),
  jobTitle: Joi.string().trim().max(120).allow('').default(''),
  department: Joi.string().trim().max(120).allow('').default(''),
  team: Joi.string().trim().max(120).allow('').default(''),
  phone: Joi.string().trim().max(40).allow('').default(''),
  avatarColor: Joi.string().trim().max(20).allow('').default('#1976d2'),
});

export const updateUserSchema: Joi.ObjectSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120),
  password: Joi.string().min(8).max(128),
  role: objectId,
  jobTitle: Joi.string().trim().max(120).allow(''),
  department: Joi.string().trim().max(120).allow(''),
  team: Joi.string().trim().max(120).allow(''),
  phone: Joi.string().trim().max(40).allow(''),
  avatarColor: Joi.string().trim().max(20).allow(''),
  isActive: Joi.boolean(),
}).min(1);

export const deactivateSchema: Joi.ObjectSchema = Joi.object({
  reason: Joi.string().trim().max(500).allow('').default(''),
});

export const reassignSchema: Joi.ObjectSchema = Joi.object({
  newOwnerId: objectId.required().messages({ 'any.required': 'A replacement assignee is required' }),
  projectIds: Joi.array().items(objectId).default([]),
  note: Joi.string().trim().max(500).allow('').default(''),
});

export const listUsersSchema: Joi.ObjectSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(120).allow(''),
  role: objectId.allow(''),
  isActive: Joi.string().valid('true', 'false').allow(''),
  team: Joi.string().trim().max(120).allow(''),
  department: Joi.string().trim().max(120).allow(''),
}).unknown(true);

/* ---------------------------------- SOP ---------------------------------- */

const sopStageShape = {
  key: Joi.string().trim().uppercase().min(2).max(40),
  name: Joi.string().trim().min(2).max(150),
  description: Joi.string().trim().max(1000).allow(''),
  clientVisible: Joi.boolean(),
  estimatedDays: Joi.number().min(0).max(3650).allow(null),
  requiredDocuments: Joi.array().items(Joi.string().trim().max(120)).default([]),
  dependsOn: Joi.array().items(Joi.string().trim().uppercase().max(40)).default([]),
};

export const createTemplateSchema: Joi.ObjectSchema = Joi.object({
  name: Joi.string().trim().min(3).max(150).required(),
  key: Joi.string().trim().uppercase().pattern(/^[A-Z0-9][A-Z0-9_-]*$/).min(3).max(40).required()
    .messages({ 'string.pattern.base': 'key may contain letters, numbers, hyphens and underscores only' }),
  description: Joi.string().trim().max(2000).allow('').default(''),
  category: Joi.string().trim().max(80).allow('').default('General'),
  stages: Joi.array()
    .items(Joi.object({ ...sopStageShape, key: sopStageShape.key.required(), name: sopStageShape.name.required() }))
    .default([]),
});

export const updateTemplateSchema: Joi.ObjectSchema = Joi.object({
  name: Joi.string().trim().min(3).max(150),
  description: Joi.string().trim().max(2000).allow(''),
  category: Joi.string().trim().max(80).allow(''),
}).min(1);

export const addStageSchema: Joi.ObjectSchema = Joi.object({
  key: sopStageShape.key.required(),
  name: sopStageShape.name.required(),
  description: sopStageShape.description,
  clientVisible: Joi.boolean().default(false),
  estimatedDays: sopStageShape.estimatedDays,
  requiredDocuments: sopStageShape.requiredDocuments,
  dependsOn: sopStageShape.dependsOn,
});

export const updateStageSchema: Joi.ObjectSchema = Joi.object({
  name: Joi.string().trim().min(2).max(150),
  description: Joi.string().trim().max(1000).allow(''),
  clientVisible: Joi.boolean(),
  estimatedDays: sopStageShape.estimatedDays,
  requiredDocuments: sopStageShape.requiredDocuments,
  dependsOn: sopStageSchemaDependsOn(),
}).min(1);

function sopStageSchemaDependsOn(): Joi.ArraySchema {
  return Joi.array().items(Joi.string().trim().uppercase().max(40)).default([]);
}

export const reorderStagesSchema: Joi.ObjectSchema = Joi.object({
  stageIds: Joi.array().items(objectId).min(1).required(),
});

export const publishSchema: Joi.ObjectSchema = Joi.object({
  changeNote: Joi.string().trim().max(1000).allow('').default(''),
});

/* -------------------------------- Projects -------------------------------- */

export const createProjectSchema: Joi.ObjectSchema = Joi.object({
  name: Joi.string().trim().min(3).max(150).required(),
  code: Joi.string().trim().uppercase().pattern(/^[A-Z0-9][A-Z0-9_-]*$/).min(2).max(30)
    .messages({ 'string.pattern.base': 'code may contain letters, numbers, hyphens and underscores only' }),
  description: Joi.string().trim().max(2000).allow('').default(''),
  sopTemplate: optionalObjectId.default(''),
  client: objectId.required(),
  projectManager: objectId.required(),
  members: Joi.array().items(objectId).default([]),
  priority: Joi.string().valid(...PRIORITY_VALUES).default('Medium'),
  startDate: Joi.date(),
  targetEndDate: Joi.date().allow(null),
  internalRemarks: Joi.string().trim().max(2000).allow('').default(''),
  tags: Joi.array().items(Joi.string().trim().max(40)).default([]),
});

export const updateProjectSchema: Joi.ObjectSchema = Joi.object({
  name: Joi.string().trim().min(3).max(150),
  description: Joi.string().trim().max(2000).allow(''),
  status: Joi.string().valid(...PROJECT_STATUS_VALUES),
  priority: Joi.string().valid(...PRIORITY_VALUES),
  projectManager: objectId,
  members: Joi.array().items(objectId),
  startDate: Joi.date(),
  targetEndDate: Joi.date().allow(null),
  internalRemarks: Joi.string().trim().max(2000).allow(''),
}).min(1);

export const listProjectsSchema: Joi.ObjectSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(120).allow(''),
  status: Joi.string().valid(...PROJECT_STATUS_VALUES).allow(''),
  priority: Joi.string().valid(...PRIORITY_VALUES).allow(''),
  client: optionalObjectId.default(''),
  projectManager: optionalObjectId.default(''),
}).unknown(true);

export const previewProjectSchema: Joi.ObjectSchema = Joi.object({
  sopTemplate: optionalObjectId.default(''),
  startDate: Joi.date(),
  // The stage generator spreads the window between these two dates, so an
  // absent end date is legitimate: the model defaults it to null and the
  // update schema already clears it to null.
  targetEndDate: Joi.date().allow(null),
});

export const assignStagesSchema: Joi.ObjectSchema = Joi.object({
  assignments: Joi.array()
    .items(
      Joi.object({
        stageId: objectId.required(),
        owner: optionalObjectId.allow(null).default(null),
        dueDate: Joi.date().allow(null).default(null),
      }),
    )
    .min(1)
    .required(),
});

/* -------------------------------- Workflow -------------------------------- */

export const updateStatusSchema: Joi.ObjectSchema = Joi.object({
  status: Joi.string().valid(...STAGE_STATUS_VALUES).required().messages({
    'any.only': `Status must be one of: ${STAGE_STATUS_VALUES.join(', ')}`,
  }),
  // Conditional fields - required server side for specific statuses.
  blocker: Joi.string().trim().max(1000).allow(''),
  holdReason: Joi.string().trim().max(1000).allow(''),
  reason: Joi.string().trim().max(1000).allow(''),
  completionDate: Joi.date(),
  note: Joi.string().trim().max(1000).allow(''),
  force: Joi.boolean().default(false),
});

export const assignStageSchema: Joi.ObjectSchema = Joi.object({
  owner: optionalObjectId.allow(null).default(null),
  dueDate: Joi.date().allow(null).default(null),
});

export const remarkSchema: Joi.ObjectSchema = Joi.object({
  remark: Joi.string().trim().min(1).max(2000).required(),
});

export const documentUploadSchema: Joi.ObjectSchema = Joi.object({
  stageId: optionalObjectId.default(''),
  description: Joi.string().trim().max(500).allow('').default(''),
  clientVisible: Joi.string().valid('true', 'false').default('false'),
});

/* ---------------------------------- Audit --------------------------------- */

export const auditQuerySchema: Joi.ObjectSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  entityType: Joi.string().trim().max(60).allow(''),
  entityId: optionalObjectId.default(''),
  action: Joi.string().trim().max(60).allow(''),
  actor: optionalObjectId.default(''),
  from: Joi.date().allow(''),
  to: Joi.date().allow(''),
  search: Joi.string().trim().max(120).allow(''),
}).unknown(true);

/* ------------------------------ Roles/Reports ----------------------------- */

export const createRoleSchema: Joi.ObjectSchema = Joi.object({
  name: Joi.string().trim().min(2).max(60).required(),
  key: Joi.string().trim().lowercase().max(60).allow(''),
  description: Joi.string().trim().max(500).allow('').default(''),
  accessScope: Joi.string().valid('all', 'assigned').default('assigned'),
  isClientScoped: Joi.boolean().default(false),
  canSeeInternalData: Joi.boolean().default(true),
  permissions: Joi.array().items(objectId).default([]),
});

export const updateRoleSchema: Joi.ObjectSchema = Joi.object({
  name: Joi.string().trim().min(2).max(60),
  description: Joi.string().trim().max(500).allow(''),
  accessScope: Joi.string().valid('all', 'assigned'),
  isClientScoped: Joi.boolean(),
  canSeeInternalData: Joi.boolean(),
  permissions: Joi.array().items(objectId),
}).min(1);