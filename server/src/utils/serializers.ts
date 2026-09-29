import type { Types } from 'mongoose';
import type {
  AccessScope,
  AuditAction,
  EntityType,
  Priority,
  ProjectStatus,
  SopStatus,
  StageStatus,
  StatusHistoryEntry,
} from '../types/domain';
import type {
  IAuditLog,
  IDocument,
  IPermission,
  IProject,
  IProjectWorkflowStage,
  IRolePopulated,
  ISopStage,
  ISopTemplate,
  ISopVersion,
  IStageStatusHistory,
  IUser,
  INotification,
} from '../types/models';
import { STAGE_STATUS } from '../utils/constants';

/* ------------------------------------------------------------------ *
 * Input shapes
 *
 * Every serialiser accepts whatever the caller happens to hold: a hydrated
 * document, a `.lean()` result, a partial `select()` projection or an already
 * plain object. Inputs are therefore described as "all fields optional + index
 * signature" and narrowed with `as` at the point a field is read.
 * ------------------------------------------------------------------ */

/**
 * An interface never gets an implicit index signature, so a Mongoose document
 * cannot satisfy `Partial<T> & Record<string, unknown>` on its own. Accepting
 * either shape keeps every call site free of casts.
 */
type Loose<T> = Partial<T> | (Partial<T> & { [key: string]: unknown });

type UserInput = Loose<Omit<IUser, 'role'>> & { role?: unknown };
type RoleInput = Loose<Omit<IRolePopulated, 'permissions'>> & { permissions?: unknown };
type PermissionInput = Loose<IPermission>;
type SopStageInput = Loose<ISopStage>;
type SopTemplateInput = Loose<Omit<ISopTemplate, 'versions' | 'stages'>> & { versions?: unknown[] | null; stages?: SopStageInput[] | null };
type SopVersionInput = Loose<Omit<ISopVersion, 'stages'>> & { stages?: SopStageInput[] | null };
type HistoryInput = Loose<IStageStatusHistory>;
type DocumentInput = Loose<Omit<IDocument, 'project' | 'stage' | 'supersedes' | 'uploadedBy'>> & {
  project?: unknown;
  stage?: unknown;
  supersedes?: unknown;
  uploadedBy?: unknown;
};
type StageInput = Loose<Omit<IProjectWorkflowStage, 'owner' | 'documents'>> & { owner?: unknown; documents?: unknown[] | null };
type ProjectInput = Loose<
  Omit<IProject, 'client' | 'projectManager' | 'members' | 'createdBy' | 'sopTemplate' | 'sopVersion'>
> & {
  client?: unknown;
  projectManager?: unknown;
  members?: unknown[] | null;
  createdBy?: unknown;
  sopTemplate?: unknown;
  sopVersion?: unknown;
  stages?: unknown[] | null;
  documents?: unknown[] | null;
};
type AuditLogInput = Loose<IAuditLog>;
type NotificationInput = Loose<INotification>;

/* ------------------------------------------------------------------ *
 * Output shapes
 *
 * These are the exact wire shapes emitted below. They line up with the `*View`
 * contracts in `types/domain` wherever the API contract is shared, and are
 * spelled out where the wire format is richer (nested stages carry their own
 * progress/blocker fields, and every payload also carries `_id`).
 * ------------------------------------------------------------------ */

/** A populated reference is emitted as an object, an unpopulated one as a bare id. */
export type RefValue = string | Record<string, unknown> | Types.ObjectId | null | undefined;

export interface PublicRoleRef {
  id: string | null;
  _id: string | null;
  name: string;
  key: string;
  accessScope: AccessScope;
  isClientScoped: boolean;
  canSeeInternalData: boolean;
}

/** The user payload the API exposes - `UserView` plus the mirrored `_id` and nullable fields. */
export interface PublicUserView {
  id: string | null;
  _id: string | null;
  name: string;
  email: string;
  jobTitle: string | null;
  department: string | null;
  team: string | null;
  phone: string | null;
  avatarColor: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date | undefined;
  role: PublicRoleRef | null;
}

export interface PublicRoleView {
  id: string | null;
  _id: string | null;
  name: string;
  key: string;
  description: string | null;
  accessScope: AccessScope;
  isClientScoped: boolean;
  canSeeInternalData: boolean;
  isSystem: boolean;
  isActive: boolean;
  permissions: string[];
  permissionCount: number;
  createdAt: Date | undefined;
  updatedAt: Date | undefined;
}

export interface PublicPermissionView {
  id: string | null;
  _id: string | null;
  module: string;
  action: string;
  key: string;
  description: string | null;
  isActive: boolean;
}

export interface PublicSopStageView {
  id: string | null;
  _id: string | null;
  key: string;
  name: string;
  description: string | null;
  order: number;
  clientVisible: boolean;
  estimatedDays: number | null;
  requiredDocuments: string[];
  dependsOn: string[];
  createdAt: Date | undefined;
  updatedAt: Date | undefined;
}

export interface PublicSopTemplateView {
  id: string | null;
  _id: string | null;
  name: string;
  key: string;
  description: string | null;
  category: string | null;
  status: SopStatus;
  currentVersion: number;
  versions: PublicSopVersionView[];
  stages: Array<PublicSopStageView | null>;
  stageCount: number;
  createdBy: PublicUserView | RefValue;
  updatedBy: PublicUserView | RefValue;
  publishedAt: Date | null;
  createdAt: Date | undefined;
  updatedAt: Date | undefined;
}

export interface PublicSopVersionView {
  id: string | null;
  _id: string | null;
  template: RefValue;
  version: number;
  changeNote: string | null;
  stageCount: number;
  stages: Array<PublicSopStageView | null>;
  publishedBy: PublicUserView | RefValue;
  publishedAt: Date | undefined;
  createdAt: Date | undefined;
}

/** A stage nested inside a project payload: `StageView` without `project`, plus progress. */
export interface PublicProjectStageView {
  id: string | null;
  _id: string | null;
  stageKey: string;
  name: string;
  description?: string | null;
  order: number;
  clientVisible: boolean;
  status: StageStatus;
  owner: PublicUserView | RefValue;
  dueDate: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  completionDate: Date | null;
  progressPercent: number;
  updatedAt: Date | undefined;
  /** Internal-only, present when `includeInternalFields` is set. */
  blocker?: string | null;
  holdReason?: string | null;
  estimatedDays?: number | null;
  requiredDocuments?: string[];
  dependsOn?: string[];
  documents?: PublicDocumentView[];
}

export interface PublicProjectView {
  id: string | null;
  _id: string | null;
  name: string;
  code: string;
  description: string | null;
  status: ProjectStatus;
  priority: Priority;
  sopTemplate: RefValue;
  sopVersion: RefValue;
  sopVersionNumber: number | null;
  client: PublicUserView | RefValue;
  projectManager: PublicUserView | RefValue;
  members: Array<PublicUserView | RefValue>;
  startDate: Date | null;
  targetEndDate: Date | null;
  createdBy: PublicUserView | RefValue;
  progressPercent: number;
  stageCount: number;
  completedStageCount: number;
  createdAt: Date | undefined;
  updatedAt: Date | undefined;
  stages?: PublicProjectStageView[];
  internalRemarks?: string | null;
  documents?: PublicDocumentView[];
}

export interface PublicProjectOptions {
  includeStages?: boolean;
  includeInternalFields?: boolean;
}

export type PublicHistoryView = Omit<StatusHistoryEntry, 'id' | 'project' | 'stage' | 'changedBy' | 'changedAt' | 'note'> & {
  id: string | null;
  _id: string | null;
  project: RefValue;
  stage: RefValue;
  stageName: string | null;
  note: string | null;
  blocker: string | null;
  holdReason: string | null;
  completionDate: Date | null;
  changedBy: PublicUserView | RefValue;
  changedAt: Date | undefined;
};

export interface PublicDocumentView {
  id: string | null;
  _id: string | null;
  project: RefValue;
  stage: RefValue;
  originalName: string;
  mimeType: string;
  size: number;
  version: number;
  isLatest: boolean;
  supersedes: RefValue;
  description: string | null;
  clientVisible: boolean;
  uploadedBy: PublicUserView | RefValue;
  createdAt: Date | undefined;
}

export interface PublicAuditLogView {
  id: string | null;
  _id: string | null;
  actor: string;
  actorEmail: string | null;
  actorRole: string | null;
  entityType: EntityType;
  entityId: string | null;
  entityLabel: string | null;
  action: AuditAction;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  createdAt: Date | undefined;
}

export interface PublicNotificationView {
  id: string | null;
  _id: string | null;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  createdAt: Date | undefined;
}

/**
 * Strips Mongoose internals and normalises an object for API output.
 *
 * Populated references are kept as plain objects (NOT depopulated): the auth
 * payload needs `user.role` and `user.permissions` to be real objects, and the
 * serialisers below branch on `isPopulated()` to decide what to emit.
 */
export const clean = <T>(doc: T): T => {
  if (!doc) return doc;
  const obj = (
    typeof (doc as { toObject?: unknown }).toObject === 'function'
      ? (doc as unknown as { toObject: (options: object) => unknown }).toObject({ versionKey: false })
      : { ...(doc as object) }
  ) as T & { __v?: unknown };
  delete obj.__v;
  return obj;
};

export const cleanMany = <T>(docs: T[] = []): T[] => docs.map(clean);

/**
 * True only for a *populated* document - not for a raw ObjectId.
 *
 * Mongoose hands back an ObjectId instance for an unpopulated ref, and
 * `typeof` reports "object" for it too, so a plain typeof check would treat an
 * unpopulated ref as a populated document and silently emit empty fields.
 */
const isPopulated = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) &&
  typeof value === 'object' &&
  typeof (value as { toHexString?: unknown }).toHexString !== 'function' &&
  !(value as { _bsontype?: unknown })._bsontype;

/** Returns the populated object when there is one, otherwise the raw id. */
const refValue = (value: unknown): RefValue => {
  if (!value) return null;
  if (isPopulated(value)) return value;
  return String((value as { _id?: unknown })._id || (value as { id?: unknown }).id || value);
};

const idOf = (value: unknown): string | null => {
  if (!value) return null;
  const id = (value as { _id?: unknown })._id || (value as { id?: unknown }).id;
  return id ? String(id) : null;
};

export const publicUser = (user: UserInput | null | undefined): PublicUserView | null => {
  if (!user) return null;
  const u = clean(user);
  const role = isPopulated(u.role) ? (u.role as RoleInput) : null;
  return {
    id: idOf(u),
    _id: idOf(u),
    name: u.name as string,
    email: u.email as string,
    jobTitle: u.jobTitle ?? null,
    department: u.department ?? null,
    team: u.team ?? null,
    phone: u.phone ?? null,
    avatarColor: u.avatarColor ?? null,
    isActive: u.isActive as boolean,
    lastLoginAt: u.lastLoginAt ?? null,
    createdAt: u.createdAt as Date | undefined,
    role: role
      ? {
          id: idOf(role),
          _id: idOf(role),
          name: role.name as string,
          key: role.key as string,
          accessScope: role.accessScope as AccessScope,
          isClientScoped: role.isClientScoped as boolean,
          canSeeInternalData: role.canSeeInternalData as boolean,
        }
      : null,
  };
};

export const publicRole = (role: RoleInput | null | undefined): PublicRoleView | null => {
  if (!role) return null;
  const r = clean(role);
  const permissions = ((r.permissions as unknown[] | undefined) || [])
    .map((p) => (isPopulated(p) ? p.key : p))
    .filter((p): p is string => Boolean(typeof p === 'string' && p));
  return {
    id: idOf(r),
    _id: idOf(r),
    name: r.name as string,
    key: r.key as string,
    description: r.description ?? null,
    accessScope: r.accessScope as AccessScope,
    isClientScoped: r.isClientScoped as boolean,
    canSeeInternalData: r.canSeeInternalData as boolean,
    isSystem: r.isSystem as boolean,
    isActive: r.isActive as boolean,
    permissions,
    permissionCount: permissions.length,
    createdAt: r.createdAt as Date | undefined,
    updatedAt: r.updatedAt as Date | undefined,
  };
};

export const publicPermission = (permission: PermissionInput | null | undefined): PublicPermissionView | null => {
  if (!permission) return null;
  const p = clean(permission);
  return {
    id: idOf(p),
    _id: idOf(p),
    module: p.module as string,
    action: p.action as string,
    key: p.key as string,
    description: p.description ?? null,
    isActive: p.isActive as boolean,
  };
};

export const publicStage = (stage: SopStageInput | null | undefined): PublicSopStageView | null => {
  if (!stage) return null;
  const s = clean(stage);
  return {
    id: idOf(s),
    _id: idOf(s),
    key: s.key as string,
    name: s.name as string,
    description: s.description ?? null,
    order: s.order as number,
    clientVisible: s.clientVisible as boolean,
    estimatedDays: s.estimatedDays ?? null,
    requiredDocuments: (s.requiredDocuments as string[] | undefined) ?? [],
    dependsOn: (s.dependsOn as string[] | undefined) ?? [],
    createdAt: (s as { createdAt?: Date }).createdAt,
    updatedAt: (s as { updatedAt?: Date }).updatedAt,
  };
};

export const publicSOPTemplate = (template: SopTemplateInput | null | undefined): PublicSopTemplateView | null => {
  if (!template) return null;
  const t = clean(template);
  const versions = (t.versions || []).map((v) =>
    isPopulated(v) || isPopulated((v as { snapshot?: unknown } | null | undefined)?.snapshot)
      ? publicSOPVersion(v as SopVersionInput)
      : v,
  );
  return {
    id: idOf(t),
    _id: idOf(t),
    name: t.name as string,
    key: t.key as string,
    description: t.description ?? null,
    category: t.category ?? null,
    status: t.status as SopStatus,
    currentVersion: t.currentVersion ?? 0,
    versions: versions.filter(Boolean) as PublicSopVersionView[],
    stages: (t.stages || []).map(publicStage),
    stageCount: (t.stages || []).length,
    createdBy: isPopulated(t.createdBy) ? publicUser(t.createdBy) : refValue(t.createdBy),
    updatedBy: isPopulated(t.updatedBy) ? publicUser(t.updatedBy) : refValue(t.updatedBy),
    publishedAt: t.publishedAt ?? null,
    createdAt: t.createdAt as Date | undefined,
    updatedAt: t.updatedAt as Date | undefined,
  };
};

export const publicSOPVersion = (version: SopVersionInput | null | undefined): PublicSopVersionView | null => {
  if (!version) return null;
  const v = clean(version);
  return {
    id: idOf(v),
    _id: idOf(v),
    template: (idOf(v.template) || v.template) as RefValue,
    version: v.version as number,
    changeNote: v.changeNote ?? null,
    stageCount: (v.stages || []).length,
    stages: (v.stages || []).map(publicStage),
    publishedBy: isPopulated(v.publishedBy) ? publicUser(v.publishedBy) : refValue(v.publishedBy),
    publishedAt: v.publishedAt as Date | undefined,
    createdAt: v.createdAt as Date | undefined,
  };
};

export const publicHistory = (entry: HistoryInput | null | undefined): PublicHistoryView | null => {
  if (!entry) return null;
  const h = clean(entry);
  return {
    id: idOf(h),
    _id: idOf(h),
    project: idOf(h.project) || h.project,
    stage: idOf(h.stage) || h.stage,
    stageName: h.stageName ?? null,
    fromStatus: h.fromStatus ?? null,
    toStatus: h.toStatus as StageStatus,
    note: h.note ?? null,
    blocker: h.blocker ?? null,
    holdReason: h.holdReason ?? null,
    completionDate: h.completionDate ?? null,
    changedBy: isPopulated(h.changedBy) ? publicUser(h.changedBy) : refValue(h.changedBy),
    changedAt: h.changedAt as Date | undefined,
  };
};

export const publicDocument = (doc: DocumentInput | null | undefined): PublicDocumentView | null => {
  if (!doc) return null;
  const d = clean(doc);
  return {
    id: idOf(d),
    _id: idOf(d),
    project: (idOf(d.project) || d.project) as RefValue,
    stage: (idOf(d.stage) ?? d.stage ?? null) as RefValue,
    originalName: d.originalName as string,
    mimeType: d.mimeType as string,
    size: d.size as number,
    version: d.version ?? 1,
    isLatest: d.isLatest ?? true,
    supersedes: (idOf(d.supersedes) ?? d.supersedes ?? null) as RefValue,
    description: d.description ?? null,
    clientVisible: d.clientVisible as boolean,
    uploadedBy: isPopulated(d.uploadedBy) ? publicUser(d.uploadedBy) : refValue(d.uploadedBy),
    createdAt: d.createdAt as Date | undefined,
  };
};

export const publicProject = (
  project: ProjectInput | null | undefined,
  options: PublicProjectOptions = {},
): PublicProjectView | null => {
  if (!project) return null;
  const p = clean(project);
  const stages = (p.stages || []).map((s) => {
    const stage = clean(s) as StageInput;
    const base: PublicProjectStageView = {
      id: idOf(stage),
      _id: idOf(stage),
      stageKey: stage.stageKey as string,
      name: stage.name as string,
      description: options.includeInternalFields ? stage.description ?? null : undefined,
      order: stage.order as number,
      clientVisible: stage.clientVisible as boolean,
      status: stage.status as StageStatus,
      owner: isPopulated(stage.owner) ? publicUser(stage.owner) : refValue(stage.owner),
      dueDate: stage.dueDate ?? null,
      startedAt: stage.startedAt ?? null,
      completedAt: stage.completedAt ?? null,
      completionDate: stage.completionDate ?? null,
      progressPercent: computeStageProgress(stage),
      updatedAt: stage.updatedAt as Date | undefined,
    };
    if (options.includeInternalFields) {
      base.blocker = stage.blocker ?? null;
      base.holdReason = stage.holdReason ?? null;
      base.estimatedDays = stage.estimatedDays ?? null;
      base.requiredDocuments = (stage.requiredDocuments as string[] | undefined) ?? [];
      base.dependsOn = (stage.dependsOn as string[] | undefined) ?? [];
      base.documents = (stage.documents || []).map((d) => publicDocument(d as DocumentInput)).filter(Boolean) as PublicDocumentView[];
    }
    return base;
  });

  const out: PublicProjectView = {
    id: idOf(p),
    _id: idOf(p),
    name: p.name as string,
    code: p.code as string,
    description: p.description ?? null,
    status: p.status as ProjectStatus,
    priority: p.priority as Priority,
    sopTemplate: (idOf(p.sopTemplate) ?? p.sopTemplate) as RefValue,
    sopVersion: (idOf(p.sopVersion) ?? p.sopVersion) as RefValue,
    sopVersionNumber: p.sopVersionNumber ?? null,
    client: isPopulated(p.client) ? publicUser(p.client) : refValue(p.client),
    projectManager: isPopulated(p.projectManager) ? publicUser(p.projectManager) : refValue(p.projectManager),
    members: (p.members || []).map((m) => (isPopulated(m) ? publicUser(m) : m)) as Array<PublicUserView | RefValue>,
    startDate: p.startDate ?? null,
    targetEndDate: p.targetEndDate ?? null,
    createdBy: isPopulated(p.createdBy) ? publicUser(p.createdBy) : refValue(p.createdBy),
    progressPercent: computeProjectProgress(p.stages || []),
    stageCount: (p.stages || []).length,
    completedStageCount: (p.stages || [])
      .filter((raw) => {
        const s = clean(raw) as StageInput;
        return (s.status || s.status) === STAGE_STATUS.COMPLETED;
      }).length,
    createdAt: p.createdAt as Date | undefined,
    updatedAt: p.updatedAt as Date | undefined,
  };

  if (options.includeStages !== false) out.stages = stages;
  if (options.includeInternalFields) {
    out.internalRemarks = p.internalRemarks ?? null;
    out.documents = (p.documents || []).map((d) => publicDocument(d as DocumentInput)).filter(Boolean) as PublicDocumentView[];
  }
  return out;
};

export function computeStageProgress(stage: StageInput | null | undefined): number {
  const s = clean(stage);
  if (!s) return 0;
  switch (s.status) {
    case STAGE_STATUS.COMPLETED:
      return 100;
    case STAGE_STATUS.IN_PROGRESS:
      return 50;
    case STAGE_STATUS.BLOCKED:
    case STAGE_STATUS.ON_HOLD:
      return 25;
    default:
      return 0;
  }
}

export function computeProjectProgress(stages: unknown[] = []): number {
  if (!stages.length) return 0;
  const total = stages.reduce<number>((sum, s) => sum + computeStageProgress(s as StageInput), 0);
  return Math.round(total / stages.length);
}

export const publicAuditLog = (entry: AuditLogInput | null | undefined): PublicAuditLogView | null => {
  if (!entry) return null;
  const a = clean(entry);
  return {
    id: idOf(a),
    _id: idOf(a),
    actor: a.actorName ?? 'System',
    actorEmail: a.actorEmail ?? null,
    actorRole: a.actorRole ?? null,
    entityType: a.entityType as EntityType,
    entityId: a.entityId ? String(a.entityId) : null,
    entityLabel: a.entityLabel ?? null,
    action: a.action as AuditAction,
    oldValue: a.oldValue ?? null,
    newValue: a.newValue ?? null,
    metadata: a.metadata ?? null,
    ip: a.ip ?? null,
    createdAt: a.createdAt as Date | undefined,
  };
};

export const publicNotification = (n: NotificationInput | null | undefined): PublicNotificationView | null => {
  if (!n) return null;
  const item = clean(n);
  return {
    id: idOf(item),
    _id: idOf(item),
    type: item.type as string,
    title: item.title as string,
    message: item.message as string,
    entityType: item.entityType ?? null,
    entityId: item.entityId ? String(item.entityId) : null,
    isRead: item.isRead as boolean,
    createdAt: item.createdAt as Date | undefined,
  };
};
