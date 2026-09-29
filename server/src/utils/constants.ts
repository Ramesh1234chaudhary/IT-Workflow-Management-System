import type { StageStatus } from '../types/domain.js';

/**
 * Application level constants. Role *names* are deliberately absent - roles,
 * their access scope and their permissions are database driven (see the seed).
 */
export const STAGE_STATUS = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  ON_HOLD: 'On Hold',
  BLOCKED: 'Blocked',
  COMPLETED: 'Completed',
} as const;

export const STAGE_STATUS_VALUES: readonly StageStatus[] = Object.values(STAGE_STATUS);

/** Statuses that count as "still open work" for assignment and dependency checks. */
export const ACTIVE_STAGE_STATUSES: readonly StageStatus[] = Object.freeze([
  STAGE_STATUS.NOT_STARTED,
  STAGE_STATUS.IN_PROGRESS,
  STAGE_STATUS.ON_HOLD,
  STAGE_STATUS.BLOCKED,
]);

/** A dependency must reach one of these before its dependent stage can start. */
export const COMPLETION_GATE_STATUSES: readonly StageStatus[] = Object.freeze([STAGE_STATUS.COMPLETED]);

export interface StatusRule {
  required: readonly string[];
  label: string;
}

/** Conditional fields enforced server side whenever a stage changes status. */
export const STATUS_RULES: Partial<Record<StageStatus, StatusRule>> = Object.freeze({
  [STAGE_STATUS.BLOCKED]: { required: ['blocker'], label: 'blocker' },
  [STAGE_STATUS.ON_HOLD]: { required: ['holdReason'], label: 'reason' },
  [STAGE_STATUS.COMPLETED]: { required: ['completionDate'], label: 'completion date' },
});

export const SOP_STATUS = { DRAFT: 'draft', PUBLISHED: 'published', ARCHIVED: 'archived' } as const;

export const PROJECT_STATUS = {
  PLANNED: 'Planned',
  IN_PROGRESS: 'In Progress',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
} as const;

export const PROJECT_STATUS_VALUES = Object.freeze(Object.values(PROJECT_STATUS));

export const PRIORITY = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', CRITICAL: 'Critical' } as const;
export const PRIORITY_VALUES = Object.freeze(Object.values(PRIORITY));

export const ACCESS_SCOPE = { ALL: 'all', ASSIGNED: 'assigned' } as const;

export const PERMISSION_MODULES = [
  'auth',
  'user',
  'role',
  'permission',
  'sop',
  'project',
  'stage',
  'document',
  'audit',
  'report',
  'notification',
] as const;

export const AUDIT_ACTIONS = {
  CREATED: 'created',
  UPDATED: 'updated',
  DELETED: 'deleted',
  STATUS_CHANGED: 'status_changed',
  PUBLISHED: 'published',
  ASSIGNED: 'assigned',
  REASSIGNED: 'reassigned',
  ACTIVATED: 'activated',
  DEACTIVATED: 'deactivated',
  LOGIN: 'login',
  LOGOUT: 'logout',
  TOKEN_REFRESHED: 'token_refreshed',
  DOCUMENT_UPLOADED: 'document_uploaded',
  DOCUMENT_DELETED: 'document_deleted',
  REMARK_ADDED: 'remark_added',
} as const;

export const ENTITY_TYPES = {
  USER: 'User',
  ROLE: 'Role',
  PERMISSION: 'Permission',
  SOP_TEMPLATE: 'SOPTemplate',
  SOP_VERSION: 'SOPVersion',
  PROJECT: 'Project',
  PROJECT_WORKFLOW_STAGE: 'ProjectWorkflowStage',
  STAGE_STATUS_HISTORY: 'StageStatusHistory',
  DOCUMENT: 'Document',
  AUTH: 'Auth',
} as const;

/** Scalar fields stripped from every payload headed to a client-scoped user. */
export const CLIENT_FORBIDDEN_FIELDS = Object.freeze([
  'password',
  'passwordChangedAt',
  'refreshToken',
  'tokenHash',
  'documents',
  'internalRemarks',
  'internalNotes',
  'auditLog',
  'auditLogs',
  'auditTrail',
  'changeLog',
  'activity',
  'createdByInternal',
  'riskNotes',
  'escalationNotes',
  'privateNotes',
  'clientVisible',
  'isClientVisible',
  'restricted',
  'blocker',
  'holdReason',
]);

/** Whole sub-trees dropped for client-scoped users. */
export const CLIENT_FORBIDDEN_KEYS = Object.freeze([
  'documents',
  'internalRemarks',
  'internalNotes',
  'auditLog',
  'auditLogs',
  'auditTrail',
  'statusHistory',
  'changeLog',
  'privateNotes',
  'escalationNotes',
  'riskNotes',
  'activity',
]);

export const HTTP_STATUS = Object.freeze({
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  SERVER_ERROR: 500,
});
