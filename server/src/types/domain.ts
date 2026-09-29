import type { Types } from 'mongoose';

export const STAGE_STATUS = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  ON_HOLD: 'On Hold',
  BLOCKED: 'Blocked',
  COMPLETED: 'Completed',
} as const;

export type StageStatus = (typeof STAGE_STATUS)[keyof typeof STAGE_STATUS];

export const SOP_STATUS = { DRAFT: 'draft', PUBLISHED: 'published', ARCHIVED: 'archived' } as const;
export type SopStatus = (typeof SOP_STATUS)[keyof typeof SOP_STATUS];

export const PROJECT_STATUS = {
  PLANNED: 'Planned',
  IN_PROGRESS: 'In Progress',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
} as const;
export type ProjectStatus = (typeof PROJECT_STATUS)[keyof typeof PROJECT_STATUS];

export const PRIORITY = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', CRITICAL: 'Critical' } as const;
export type Priority = (typeof PRIORITY)[keyof typeof PRIORITY];

export const ACCESS_SCOPE = { ALL: 'all', ASSIGNED: 'assigned' } as const;
export type AccessScope = (typeof ACCESS_SCOPE)[keyof typeof ACCESS_SCOPE];

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
export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

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
export type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];

export type ObjectIdLike = Types.ObjectId | string;

export interface PermissionRef {
  id: string;
  module: string;
  action: string;
  description?: string;
  scope?: 'own' | 'all';
}

/** Role as returned to the client. `accessScope` drives client-data filtering. */
export interface RoleView {
  id: string;
  name: string;
  description?: string;
  accessScope: AccessScope;
  isSystem?: boolean;
  isActive?: boolean;
  permissions?: string[];
  permissionKeys?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface UserView {
  id: string;
  name: string;
  email: string;
  role: RoleView;
  jobTitle?: string;
  department?: string;
  team?: string;
  phone?: string;
  avatarColor?: string;
  isActive: boolean;
  deactivatedAt?: string | null;
  deactivationReason?: string;
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Identity attached to every authenticated request by `authenticate`. */
export interface AuthUser {
  id: string;
  _id: string;
  name: string;
  email: string;
  avatarColor: string;
  roleId: string;
  roleName: string;
  roleKey: string;
  accessScope: AccessScope;
  isClientScoped: boolean;
  canSeeInternalData: boolean;
  permissions: string[];
}

export interface SopStageDefinition {
  key: string;
  name: string;
  description?: string;
  order: number;
  ownerRoleId?: ObjectIdLike | null;
  clientVisible: boolean;
  requiredDocuments?: string[];
  dependsOn?: string[];
  dueOffsetDays?: number | null;
}

export interface SopTemplateView {
  id: string;
  name: string;
  description?: string;
  status: SopStatus;
  currentVersion: number;
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: Pick<UserView, 'id' | 'name'> | null;
}

export interface SopVersionView {
  id: string;
  template: string | SopTemplateView;
  version: number;
  status: SopStatus;
  stages: SopStageDefinition[];
  changeNote?: string;
  publishedAt?: string | null;
  publishedBy?: Pick<UserView, 'id' | 'name'> | null;
  createdAt?: string;
}

export interface ProjectView {
  id: string;
  code?: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  priority: Priority;
  client: Pick<UserView, 'id' | 'name' | 'email'>;
  projectManager?: Pick<UserView, 'id' | 'name'> | null;
  team?: Pick<UserView, 'id' | 'name'> | null;
  startDate?: string | null;
  targetDate?: string | null;
  sopTemplate?: Pick<SopTemplateView, 'id' | 'name'> | null;
  sopVersion?: number | null;
  internalRemarks?: string;
  clientVisibleNotes?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Present only on list endpoints; signals the payload is already client-filtered. */
  meta?: { filtered: boolean; scope: AccessScope };
}

export interface StageView {
  id: string;
  project: string;
  stageKey: string;
  name: string;
  description?: string;
  order: number;
  status: StageStatus;
  owner?: Pick<UserView, 'id' | 'name' | 'email'> | null;
  clientVisible: boolean;
  requiredDocuments?: string[];
  dependsOn?: string[];
  dueDate?: string | null;
  blocker?: string;
  holdReason?: string;
  completionDate?: string | null;
  startedAt?: string | null;
  updatedAt?: string;
}

export interface StatusHistoryEntry {
  id: string;
  stage: string;
  fromStatus: StageStatus | null;
  toStatus: StageStatus;
  changedBy?: Pick<UserView, 'id' | 'name'> | null;
  note?: string;
  changedAt: string;
}

export interface DocumentVersion {
  id: string;
  version: number;
  fileName: string;
  mimeType?: string;
  size: number;
  uploadedBy?: Pick<UserView, 'id' | 'name'> | null;
  uploadedAt: string;
}

export interface DocumentView {
  id: string;
  project: string;
  stage: string;
  fileName: string;
  mimeType?: string;
  size: number;
  currentVersion: number;
  versions: DocumentVersion[];
  uploadedAt?: string;
}

export interface AuditLogEntry {
  id: string;
  entityType: EntityType;
  entityId: string;
  entityLabel?: string;
  action: AuditAction;
  actor?: Pick<UserView, 'id' | 'name' | 'email'> | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ApiErrorBody {
  message: string;
  code?: string;
  details?: string[];
}
