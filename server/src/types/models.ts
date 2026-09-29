import type { HydratedDocument, Types } from 'mongoose';
import type { AccessScope, AuditAction, EntityType, Priority, ProjectStatus, SopStatus, StageStatus } from './domain.js';

/**
 * A field that holds either a bare ObjectId (unpopulated) or the referenced
 * document (after `.populate()`). Services usually work with the populated side,
 * so every populated variant is spelled out explicitly rather than cast.
 */
export type Ref<T> = Types.ObjectId | T;

export interface IPermission {
  module: string;
  action: string;
  key: string;
  description: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRole {
  name: string;
  key: string;
  description: string;
  accessScope: AccessScope;
  isClientScoped: boolean;
  canSeeInternalData: boolean;
  permissions: Types.ObjectId[];
  isSystem: boolean;
  isActive: boolean;
  userCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRolePopulated extends Omit<IRole, 'permissions'> {
  _id: Types.ObjectId;
  permissions: IPermission[];
  permissionKeys: string[];
}

export interface IUser {
  name: string;
  email: string;
  password: string;
  passwordChangedAt?: Date;
  role: Types.ObjectId;
  jobTitle: string;
  department: string;
  team: string;
  phone: string;
  avatarColor: string;
  isActive: boolean;
  deactivatedAt: Date | null;
  deactivatedBy: Types.ObjectId | null;
  deactivationReason: string;
  lastLoginAt: Date | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  createdBy: Types.ObjectId | null;
  updatedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserPopulated extends Omit<IUser, 'role'> {
  role: IRolePopulated;
}

/** Mongoose cannot infer populate targets, so the populated shape is asserted at the call site. */
export type UserPopulatedDoc = HydratedDocument<IUserPopulated>;

export interface IRefreshToken {
  user: Types.ObjectId;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
  replacedByTokenHash: string | null;
  userAgent: string;
  ip: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISopStage {
  key: string;
  name: string;
  description: string;
  order: number;
  clientVisible: boolean;
  estimatedDays: number | null;
  requiredDocuments: string[];
  dependsOn: string[];
  _id?: Types.ObjectId;
}

export interface ISopTemplate {
  name: string;
  key: string;
  description: string;
  category: string;
  status: SopStatus;
  currentVersion: number;
  versions: Types.ObjectId[];
  stages: ISopStage[];
  publishedAt: Date | null;
  archivedAt: Date | null;
  createdBy: Types.ObjectId | null;
  updatedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISopVersion {
  template: Types.ObjectId;
  version: number;
  templateName: string;
  changeNote: string;
  stages: ISopStage[];
  stageCount: number;
  publishedBy: Types.ObjectId | null;
  publishedAt: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProject {
  name: string;
  code: string;
  description: string;
  status: ProjectStatus;
  priority: Priority;
  sopTemplate: Types.ObjectId;
  sopVersion: Types.ObjectId;
  sopVersionNumber: number | null;
  client: Types.ObjectId;
  projectManager: Types.ObjectId;
  members: Types.ObjectId[];
  startDate: Date | null;
  targetEndDate: Date | null;
  internalRemarks: string;
  tags: string[];
  createdBy: Types.ObjectId | null;
  updatedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProjectWorkflowStage {
  project: Types.ObjectId;
  sopVersion: Types.ObjectId;
  stageKey: string;
  name: string;
  description: string;
  order: number;
  clientVisible: boolean;
  estimatedDays: number | null;
  requiredDocuments: string[];
  dependsOn: string[];
  status: StageStatus;
  owner: Types.ObjectId | null;
  dueDate: Date | null;
  startedAt: Date | null;
  blocker: string;
  holdReason: string;
  completionDate: Date | null;
  completedAt: Date | null;
  documents: Types.ObjectId[];
  internalRemarks: string;
  updatedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStageStatusHistory {
  project: Types.ObjectId;
  stage: Types.ObjectId;
  stageName: string;
  stageKey: string;
  fromStatus: StageStatus | null;
  toStatus: StageStatus;
  note: string;
  blocker: string;
  holdReason: string;
  completionDate: Date | null;
  changedBy: Types.ObjectId;
  changedAt: Date;
  createdAt: Date;
}

export interface IDocument {
  project: Types.ObjectId;
  stage: Types.ObjectId | null;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  checksum: string;
  description: string;
  version: number;
  isLatest: boolean;
  supersedes: Types.ObjectId | null;
  clientVisible: boolean;
  uploadedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAuditLog {
  actor: Types.ObjectId | null;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  entityType: EntityType | string;
  entityId: Types.ObjectId | null;
  entityLabel: string;
  action: AuditAction | string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ip: string;
  userAgent: string;
  createdAt: Date;
}

export interface INotification {
  recipient: Types.ObjectId;
  type: string;
  title: string;
  message: string;
  entityType: string;
  entityId: Types.ObjectId | null;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Loose filter shape accepted by the list endpoints. */
export interface ListQuery {
  page?: string | number;
  limit?: string | number;
  search?: string;
  status?: string;
  sort?: string;
  from?: string | number | Date;
  to?: string | number | Date;
  [key: string]: unknown;
}
