import type { ProjectStatus, Priority, SopStatus, StageStatus } from '../utils/constants';

/** A permission is a `module:action` key, e.g. `sop:publish`. */
export type PermissionKey = string;
export type PermissionPair = readonly [module: string, action: string];
export type PermissionInput = PermissionKey | PermissionPair;

export type AccessScope = 'all' | 'assigned';

export interface UserRef {
  id: string;
  name: string;
  email?: string;
  avatarColor?: string;
}

export interface Role {
  id: string;
  name: string;
  key?: string;
  description?: string;
  accessScope: AccessScope;
  isClientScoped?: boolean;
  canSeeInternalData?: boolean;
  isSystem?: boolean;
  isActive?: boolean;
  permissions?: PermissionKey[];
  permissionKeys?: PermissionKey[];
  userCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Present on the signed-in session user only; list endpoints omit it. */
  permissions?: string[];
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

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  avatarColor?: string;
  isActive?: boolean;
  /** Only present when the endpoint populates the role. */
  role?: Role;
}

export interface Project {
  id: string;
  code?: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  priority: Priority;
  client: UserRef;
  projectManager?: UserRef | null;
  startDate?: string | null;
  targetEndDate?: string | null;
  sopTemplate?: { id: string; name: string } | null;
  sopVersion?: number | null;
  internalRemarks?: string;
  tags?: string[];
  /** Populated on the detail endpoint only. */
  stages?: Stage[];
  createdAt?: string;
  updatedAt?: string;
  /** Board/dashboard aggregates, derived server side from the project's stages. */
  progressPercent?: number;
  stageCount?: number;
  completedStageCount?: number;
}

export interface Stage {
  id: string;
  /**
   * Populated ref on the board; a bare id on project detail. The board
   * serializer sends `_id`, so both spellings can appear.
   */
  project: string | ({
    _id?: string;
    id?: string;
    name: string;
    code?: string;
    status?: ProjectStatus;
  } & Partial<UserRef>);
  stageKey: string;
  name: string;
  description?: string;
  order: number;
  status: StageStatus;
  owner?: UserRef | null;
  clientVisible: boolean;
  requiredDocuments?: string[];
  dependsOn?: string[];
  estimatedDays?: number | null;
  dueDate?: string | null;
  startedAt?: string | null;
  blocker?: string;
  holdReason?: string;
  completionDate?: string | null;
  internalRemarks?: string;
  /** Board progress bar only; never sent to the API. */
  progressPercent?: number;
  updatedAt?: string;
}

export interface StatusHistoryEntry {
  id: string;
  stage: string;
  stageName?: string;
  fromStatus: StageStatus | null;
  toStatus: StageStatus;
  changedBy?: UserRef | null;
  note?: string;
  blocker?: string;
  holdReason?: string;
  completionDate?: string | null;
  changedAt: string;
  /** Optimistic placeholder, dropped once the server confirms. */
  pending?: boolean;
}

export interface DocumentVersion {
  id: string;
  version: number;
  fileName: string;
  mimeType?: string;
  size: number;
  uploadedBy?: UserRef | null;
  uploadedAt: string;
}

export interface ProjectDocument {
  id: string;
  project: string;
  stage: string | null;
  fileName: string;
  originalName?: string;
  mimeType?: string;
  size: number;
  version: number;
  isLatest?: boolean;
  currentVersion?: number;
  versions?: DocumentVersion[];
  uploadedBy?: UserRef | null;
  uploadedAt?: string;
}

export interface SopStageDefinition {
  _id?: string;
  id?: string;
  key: string;
  name: string;
  description?: string;
  order: number;
  clientVisible: boolean;
  estimatedDays?: number | null;
  requiredDocuments?: string[];
  dependsOn?: string[];
}

export interface SopTemplate {
  id: string;
  name: string;
  key?: string;
  description?: string;
  category?: string;
  status: SopStatus;
  currentVersion: number;
  stages?: SopStageDefinition[];
  publishedAt?: string | null;
  createdBy?: UserRef | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SopVersion {
  id: string;
  template: string | SopTemplate;
  version: number;
  templateName?: string;
  status?: SopStatus;
  stages: SopStageDefinition[];
  changeNote?: string;
  stageCount?: number;
  publishedBy?: UserRef | null;
  publishedAt?: string | null;
  createdAt?: string;
}

export interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  entityLabel?: string;
  action: string;
  actor?: UserRef | null;
  actorName?: string;
  actorEmail?: string;
  actorRole?: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

export interface Permission {
  id: string;
  module: string;
  action: string;
  key: string;
  description?: string;
  isActive?: boolean;
}

export interface PermissionMatrix {
  roles: { id: string; name: string; key?: string }[];
  permissions: Permission[];
  /** roleId -> permission keys currently granted. */
  matrix: Record<string, string[]>;
  modules?: string[];
}

export interface Notification {
  id: string;
  type?: string;
  title: string;
  message?: string;
  entityType?: string;
  entityId?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface BoardSummary {
  total?: number;
  notStarted?: number;
  inProgress?: number;
  blocked?: number;
  onHold?: number;
  completed?: number;
  overdue?: number;
  [key: string]: number | undefined;
}

export interface WorkflowBoard {
  project?: Project | null;
  stages: Stage[];
  summary: BoardSummary;
  history?: StatusHistoryEntry[];
  /** Populated by the board endpoint so cards can show the project code. */
  projects?: Project[];
}

/**
 * The board endpoint decorates each stage with a couple of read-only extras that
 * the card and filter selectors rely on. They are never sent back to the API.
 */
export interface BoardStage extends Stage {
  isMine?: boolean;
  ownerId?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface Paginated<T> {
  items: T[];
  pagination: Pagination;
}

export interface SummaryReport {
  projects?: number;
  users?: number;
  roles?: number;
  permissions?: number;
  auditEntries?: number;
  [key: string]: number | undefined;
}

export interface ProgressTotals {
  projects: number;
  totalStages: number;
  completedStages: number;
  blockedStages: number;
  onHoldStages: number;
  overdueStages: number;
  completionRate: number;
}

/** One row of `GET /reports/project-progress`. Keyed by `projectId`, not `id`. */
export interface ProjectProgressRow {
  projectId: string;
  name: string;
  code?: string;
  status: ProjectStatus;
  priority: Priority;
  sopVersion: number | null;
  totalStages: number;
  completedStages: number;
  blockedStages: number;
  onHoldStages: number;
  overdueStages: number;
  completionRate: number;
  targetEndDate?: string | null;
}

/** One row of `GET /reports/workload`. */
export interface WorkloadRow {
  id: string;
  name: string;
  email: string;
  role?: { id?: string; _id?: string; name?: string } | null;
  department?: string;
  team?: string;
  activeAssignments: number;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  permissions?: PermissionKey[];
}

export interface ReassignTargets {
  users: UserSummary[];
  projects: { id: string; name: string; code?: string }[];
}

/** `GET /users/:id/assignments` — open stage assignments owned by one user. */
export interface UserAssignments {
  count: number;
  stages: {
    id: string;
    name: string;
    stageKey?: string;
    status: StageStatus;
    dueDate?: string | null;
    project: { id: string; name: string; code?: string } | null;
  }[];
}

export interface ApiErrorPayload {
  message: string;
  code?: string;
  details?: string[];
}
