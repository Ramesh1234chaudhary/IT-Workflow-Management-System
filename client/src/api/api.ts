/**
 * Every API call in the app lives here so slices stay declarative and the
 * contract is easy to audit against the backend routes.
 */
import http from './httpClient';
import type { StageStatus } from '../utils/constants';
import type {
  AuditLogEntry,
  LoginResponse,
  Notification,
  Paginated,
  Permission,
  PermissionMatrix,
  Project,
  ProjectDocument,
  ProgressTotals,
  ProjectProgressRow,
  ReassignTargets,
  SopStageDefinition,
  SopTemplate,
  SopVersion,
  Stage,
  StatusHistoryEntry,
  SummaryReport,
  User,
  UserAssignments,
  UserSummary,
  WorkflowBoard,
  WorkloadRow,
} from '../types';

export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: string;
  jobTitle?: string;
  department?: string;
  team?: string;
  phone?: string;
}

export interface UpdateUserPayload extends Partial<Omit<CreateUserPayload, 'password'>> {
  password?: string;
}

export interface DeactivatePayload {
  reason: string;
}

export interface ReassignPayload {
  newOwnerId: string;
  projectIds?: string[];
  note?: string;
}

/** Every mutating endpoint answers with `success` and a human readable `message`. */
export interface ActionResult {
  success: boolean;
  message: string;
}

export interface DeactivationBlock {
  userId: string;
  reason: string;
  projects?: { id: string; name: string; code?: string }[];
  stages?: { id: string; name: string; projectId?: string; projectName?: string }[];
}

export interface RolePayload {
  name: string;
  key?: string;
  description?: string;
  accessScope: 'all' | 'assigned';
  isClientScoped: boolean;
  canSeeInternalData: boolean;
  /** Permission ids, not `module:action` keys. */
  permissions: string[];
}

export interface StagePayload {
  key: string;
  name: string;
  description?: string;
  clientVisible: boolean;
  requiredDocuments?: string[];
  dependsOn?: string[];
  estimatedDays?: number | null;
}

export interface CreateProjectPayload {
  name: string;
  code?: string;
  description?: string;
  priority: string;
  client: string;
  projectManager: string;
  members?: string[];
  startDate?: string;
  targetEndDate?: string | null;
  internalRemarks?: string;
  tags?: string[];
  /** The API resolves the latest published SOP version itself. */
  sopTemplate: string;
}

export interface StatusUpdatePayload {
  status: StageStatus;
  note?: string;
  blocker?: string;
  holdReason?: string;
  completionDate?: string;
}

export interface AssignStagePayload {
  owner: string | null;
  dueDate?: string | null;
}

export interface RemarkPayload {
  remark: string;
}

export const authApi = {
  login: (payload: LoginPayload) => http.post<LoginResponse>('/auth/login', payload),
  refresh: () => http.post<{ accessToken: string; user: User }>('/auth/refresh'),
  logout: () => http.post<{ message: string }>('/auth/logout'),
  me: () => http.get<{ user: User }>('/auth/me'),
  changePassword: (payload: ChangePasswordPayload) => http.post<{ message: string }>('/auth/change-password', payload),
};

export const usersApi = {
  list: (params: ListParams) => http.get<Paginated<User> & { items: User[] }>('/users', { params }),
  assignable: () => http.get<{ items: UserSummary[] }>('/users/assignable'),
  reassignTargets: () => http.get<ReassignTargets>('/users/reassign-targets'),
  get: (id: string) => http.get<{ user: User }>(`/users/${id}`),
  create: (body: CreateUserPayload) => http.post<ActionResult & { user: User }>('/users', body),
  update: (id: string, body: UpdateUserPayload) =>
    http.patch<ActionResult & { user: User }>(`/users/${id}`, body),
  remove: (id: string) => http.delete<ActionResult>(`/users/${id}`),
  deactivate: (id: string, body: DeactivatePayload) =>
    http.patch<ActionResult & { user: User }>(`/users/${id}/deactivate`, body),
  reactivate: (id: string) => http.patch<ActionResult & { user: User }>(`/users/${id}/reactivate`),
  assignments: (id: string) => http.get<UserAssignments>(`/users/${id}/assignments`),
  deactivationPreview: (id: string) => http.get<{ user: User; assignments: UserAssignments }>(`/users/${id}/deactivation-preview`),
  reassign: (id: string, body: ReassignPayload) =>
    http.post<ActionResult & { user: User; reassigned: number }>(`/users/${id}/reassign`, body),
};

export const rolesApi = {
  list: () => http.get<{ items: import('../types').Role[] }>('/roles'),
  get: (id: string) => http.get<{ role: import('../types').Role }>(`/roles/${id}`),
  create: (body: RolePayload) => http.post<{ role: import('../types').Role }>('/roles', body),
  update: (id: string, body: RolePayload) => http.patch<{ role: import('../types').Role }>(`/roles/${id}`, body),
  remove: (id: string) => http.delete<{ message: string }>(`/roles/${id}`),
  permissions: () => http.get<{ items: Permission[]; modules: string[] }>('/roles/permissions'),
  matrix: () => http.get<PermissionMatrix>('/roles/permission-matrix'),
};

export const sopApi = {
  list: (params: ListParams) => http.get<Paginated<SopTemplate>>('/sop', { params }),
  get: (id: string) => http.get<{ template: SopTemplate }>(`/sop/${id}`),
  create: (body: Partial<SopTemplate>) => http.post<{ template: SopTemplate }>('/sop', body),
  update: (id: string, body: Partial<SopTemplate>) => http.patch<{ template: SopTemplate }>(`/sop/${id}`, body),
  remove: (id: string) => http.delete<{ message: string }>(`/sop/${id}`),
  addStage: (id: string, body: StagePayload) => http.post<{ template: SopTemplate }>(`/sop/${id}/stages`, body),
  updateStage: (id: string, stageId: string, body: Partial<StagePayload>) =>
    http.patch<{ template: SopTemplate }>(`/sop/${id}/stages/${stageId}`, body),
  deleteStage: (id: string, stageId: string) => http.delete<{ template: SopTemplate }>(`/sop/${id}/stages/${stageId}`),
  reorderStages: (id: string, stageIds: string[]) =>
    http.patch<{ template: SopTemplate }>(`/sop/${id}/stages/reorder`, { stageIds }),
  publish: (id: string, body: { changeNote?: string }) =>
    http.post<{ template: SopTemplate; version: SopVersion }>(`/sop/${id}/publish`, body),
  createDraft: (id: string) => http.post<{ template: SopTemplate }>(`/sop/${id}/draft`),
  versions: (id: string) => http.get<{ items: SopVersion[] }>(`/sop/${id}/versions`),
  latestVersion: () => http.get<{ version: SopVersion }>('/sop/versions/latest'),
};

export interface ProjectOptions {
  id: string;
  name: string;
  code?: string;
  status: string;
  priority?: string;
  client?: string | null;
}

export const projectsApi = {
  list: (params: ListParams) => http.get<Paginated<Project>>('/projects', { params }),
  options: () => http.get<{ items: ProjectOptions[] }>('/projects/options'),
  get: (id: string) => http.get<{ project: Project; meta: { filtered: boolean; scope: string } }>(`/projects/${id}`),
  create: (body: CreateProjectPayload) => http.post<{ project: Project; message?: string }>('/projects', body),
  update: (id: string, body: Partial<CreateProjectPayload>) => http.patch<{ project: Project }>(`/projects/${id}`, body),
  remove: (id: string) => http.delete<{ message: string }>(`/projects/${id}`),
  preview: (body: { sopTemplate: string; startDate?: string; targetEndDate?: string | null }) =>
    http.post<{ stages: SopStageDefinition[] }>('/projects/preview', body),
  assignStages: (id: string, assignments: { stageId: string; owner: string | null; dueDate?: string | null }[]) =>
    http.patch<{ project: Project }>(`/projects/${id}/stages/assign`, { assignments }),
};

export interface BoardPayload extends WorkflowBoard {
  projects?: Project[];
}

export const workflowApi = {
  board: (params: ListParams = {}) => http.get<BoardPayload>('/workflow/board', { params }),
  stages: (projectId: string, params: ListParams) => http.get<{ stages: Stage[]; project?: Project }>(`/projects/${projectId}/stages`, { params }),
  stage: (projectId: string, stageId: string) => http.get<{ stage: Stage }>(`/projects/${projectId}/stages/${stageId}`),
  updateStatus: (projectId: string, stageId: string, body: StatusUpdatePayload) =>
    http.patch<{ stage: Stage; history: StatusHistoryEntry; message?: string }>(`/projects/${projectId}/stages/${stageId}/status`, body),
  statusHistory: (projectId: string, stageId: string, params: ListParams) =>
    http.get<Paginated<StatusHistoryEntry>>(`/projects/${projectId}/stages/${stageId}/status-history`, { params }),
  projectHistory: (projectId: string, params: ListParams) =>
    http.get<Paginated<StatusHistoryEntry>>(`/projects/${projectId}/status-history`, { params }),
  assignStage: (projectId: string, stageId: string, body: AssignStagePayload) =>
    http.patch<{ stage: Stage }>(`/projects/${projectId}/stages/${stageId}/assign`, body),
  addRemark: (projectId: string, stageId: string, body: RemarkPayload) =>
    http.post<{ stage: Stage }>(`/projects/${projectId}/stages/${stageId}/remarks`, body),
};

export const documentsApi = {
  list: (projectId: string, params: ListParams) => http.get<Paginated<ProjectDocument>>(`/projects/${projectId}/documents`, { params }),
  upload: (projectId: string, formData: FormData) =>
    http.post<{ document: ProjectDocument }>(`/projects/${projectId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  versions: (documentId: string) => http.get<{ items: import('../types').DocumentVersion[] }>(`/workflow/documents/${documentId}/versions`),
  remove: (documentId: string) => http.delete<{ message: string }>(`/workflow/documents/${documentId}`),
  /**
   * Downloads must go through the authenticated axios instance, not a bare href:
   * the access token lives in memory and is attached by the request interceptor,
   * so a plain link or window.open would always come back 401.
   */
  download: (documentId: string) =>
    http.get<Blob>(`/workflow/documents/${documentId}/download`, {
      responseType: 'blob',
      headers: { Accept: 'application/octet-stream' },
    }),
};

export interface AuditFacets {
  entityTypes: string[];
  actions: string[];
}

export const auditApi = {
  list: (params: ListParams) => http.get<Paginated<AuditLogEntry>>('/audit', { params }),
  facets: () => http.get<AuditFacets>('/audit/facets'),
  timeline: (entityType: string, entityId: string) =>
    http.get<Paginated<AuditLogEntry>>(`/audit/${entityType}/${entityId}`),
};

export interface StageDistribution {
  byStatus: Record<string, number>;
  total: number;
}

export interface WorkloadReport {
  items: WorkloadRow[];
  total: number;
}

export const reportsApi = {
  summary: () => http.get<SummaryReport>('/reports/summary'),
  projectProgress: (params: ListParams) =>
    http.get<{ items: ProjectProgressRow[]; totals: ProgressTotals }>('/reports/project-progress', { params }),
  stageDistribution: () => http.get<StageDistribution>('/reports/stage-distribution'),
  workload: () => http.get<WorkloadReport>('/reports/workload'),
};

export const notificationsApi = {
  list: () => http.get<{ items: Notification[]; unread: number }>('/notifications'),
  markRead: (id: string) => http.patch<{ notification: Notification }>(`/notifications/${id}/read`),
  markAllRead: () => http.patch<{ updated: number }>('/notifications/read-all'),
};

export const metaApi = {
  integrations: () => http.get<Record<string, { configured: boolean; connected: boolean | null }>>('/integrations'),
};

export type { ReassignTargets, ReassignTargets as ReassignTargetPayload };
