import type { Request } from 'express';
import type { Types } from 'mongoose';
import {
  ProjectWorkflowStage,
  Project,
  StageStatusHistory,
} from '../models/index';
import ApiError from '../utils/ApiError';
import {
  ACTIVE_STAGE_STATUSES,
  AUDIT_ACTIONS,
  ENTITY_TYPES,
  STAGE_STATUS,
  STAGE_STATUS_VALUES,
  STATUS_RULES,
} from '../utils/constants';
import { assertProjectAccess, canSeeInternalData, hasFullProjectScope } from './accessService';
import { recordAudit as writeAudit } from './auditService';
import { notifyStageAssignment, notifyStageStatusChange } from './notificationService';
import * as integrationService from './integrations/integrationService';
import { parsePagination } from '../utils/helpers';
import type { AuditAction, AuthUser, EntityType, StageStatus } from '../types/domain';
import type { IProject, IProjectWorkflowStage, ListQuery } from '../types/models';

/** Contract of `recordAudit`, pinned here so the audit calls stay type checked. */
interface AuditEntry {
  actor?: AuthUser | Record<string, unknown> | null;
  entityType: EntityType;
  entityId?: unknown;
  entityLabel?: string;
  action: AuditAction;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: unknown;
  req?: Request;
}
const recordAudit = writeAudit as unknown as (entry: AuditEntry) => Promise<unknown>;

/**
 * `owner` / `updatedBy` are typed as ObjectId but callers pass the string id
 * from `req.user`; Mongoose casts it on write.
 */
const actorId = (actor?: AuthUser | null): Types.ObjectId => actor?.id as unknown as Types.ObjectId;

/** Comparison helper so the status literals do not narrow the caller's variable. */
const isBlocked = (status: StageStatus): boolean => status === STAGE_STATUS.BLOCKED;

const assertObjectId = (id: unknown, label: string) => {
  if (!/^[a-f\d]{24}$/i.test(String(id))) throw ApiError.badRequest(`Invalid ${label}`);
};

/** Conditional fields accepted by PATCH .../status. */
export interface StatusChangePayload extends ListQuery {
  status?: StageStatus;
  blocker?: string;
  holdReason?: string;
  reason?: string;
  blockerText?: string;
  completionDate?: string | Date;
  note?: string;
  force?: boolean;
}

/** A stage with its `owner` populated, as the stage queries return it. */
type StageDoc = IProjectWorkflowStage & { owner?: unknown };
/** A sibling stage reduced to what the dependency gate reads. */
type StageDependency = Pick<IProjectWorkflowStage, 'name' | 'stageKey' | 'status' | 'dependsOn'>;

interface StageOwnerRef {
  _id?: Types.ObjectId;
  id?: unknown;
  name?: string;
  email?: string;
}

/**
 * Conditional field validation.
 *   Blocked   -> blocker (mandatory)
 *   On Hold   -> holdReason / reason (mandatory)
 *   Completed -> completionDate (mandatory)
 */
export function validateStatusPayload(status: StageStatus, payload: StatusChangePayload = {}): void {
  if (!STAGE_STATUS_VALUES.includes(status)) {
    throw ApiError.badRequest(`Invalid status "${status}". Allowed values: ${STAGE_STATUS_VALUES.join(', ')}`);
  }
  const rule = STATUS_RULES[status];
  const errors: string[] = [];

  if (rule) {
    for (const field of rule.required) {
      const value = payload[field];
      if (value === undefined || value === null || String(value).trim() === '') {
        errors.push(`${rule.label} is required when status is "${status}"`);
      }
    }
  }
  if (status === STAGE_STATUS.COMPLETED && payload.completionDate) {
    const date = new Date(payload.completionDate);
    if (Number.isNaN(date.getTime())) errors.push('completionDate is not a valid date');
  }
  if (errors.length) {
    throw ApiError.unprocessable(errors.join('; '), { code: 'STATUS_CONDITIONAL_FIELDS', details: errors });
  }
}

/** Dependency gate: a stage cannot start while a dependency is still open. */
function assertDependenciesSatisfied(stage: StageDependency, siblings: StageDependency[]): void {
  if (!stage.dependsOn?.length) return;
  const unmet = siblings.filter(
    (s) => stage.dependsOn.includes(s.stageKey) && s.status !== STAGE_STATUS.COMPLETED,
  );
  if (unmet.length) {
    throw ApiError.conflict(
      `Stage "${stage.name}" depends on ${unmet.map((s) => `"${s.name}" (${s.status})`).join(', ')}. Complete the dependencies first.`,
      { code: 'UNMET_DEPENDENCIES', details: unmet.map((s) => s.stageKey) },
    );
  }
}

export async function listStages(projectId: string, user: AuthUser | null, query: ListQuery = {}) {
  assertObjectId(projectId, 'project id');
  const project = await Project.findById(projectId).lean();
  if (!project) throw ApiError.notFound('Project not found');
  assertProjectAccess(user, project);

  const filter: Record<string, unknown> = { project: project._id };
  if (query.status) filter.status = query.status;
  if (query.owner) filter.owner = query.owner;
  if (query.clientVisibleOnly === 'true' && !canSeeInternalData(user)) filter.clientVisible = true;

  let stages = (await ProjectWorkflowStage.find(filter)
    .populate('owner', 'name email role avatarColor isActive')
    .populate('documents', 'originalName mimeType size version createdAt clientVisible')
    .sort({ order: 1 })
    .lean()) as unknown as Array<StageDoc & { isMine?: boolean }>;

  if (!canSeeInternalData(user)) {
    stages = stages.filter((s) => s.clientVisible === true);
  }
  if (!hasFullProjectScope(user)) {
    // IT members still see the whole board of an assigned project.
    stages = stages.map((s) => ({
      ...s,
      isMine: String((s.owner as StageOwnerRef | null)?._id || s.owner) === String(user?.id),
    }));
  }
  return { project, stages };
}

export async function getStage(projectId: string, stageId: string, user: AuthUser | null) {
  assertObjectId(projectId, 'project id');
  assertObjectId(stageId, 'stage id');
  const project = await Project.findById(projectId).lean();
  if (!project) throw ApiError.notFound('Project not found');
  assertProjectAccess(user, project);

  const stage = (await ProjectWorkflowStage.findOne({ _id: stageId, project: project._id })
    .populate('owner', 'name email role avatarColor')
    .populate('documents', 'originalName mimeType size version createdAt')
    .lean()) as unknown as StageDoc | null;
  if (!stage) throw ApiError.notFound('Stage not found in this project');
  if (!canSeeInternalData(user) && !stage.clientVisible) {
    throw ApiError.notFound('Stage not found in this project');
  }
  return { project, stage };
}

/**
 * The ONLY place workflow status is mutated.
 * Triggered exclusively by PATCH /api/projects/:projectId/stages/:stageId/status.
 * Uploading documents, adding remarks or any background job never calls this.
 */
export async function updateStageStatus(
  projectId: string,
  stageId: string,
  payload: StatusChangePayload,
  { actor, req }: { actor?: AuthUser | null; req?: Request },
) {
  assertObjectId(projectId, 'project id');
  assertObjectId(stageId, 'stage id');

  const project = await Project.findById(projectId).lean();
  if (!project) throw ApiError.notFound('Project not found');
  assertProjectAccess(actor, project, { write: true });

  const stage = await ProjectWorkflowStage.findOne({ _id: stageId, project: project._id });
  if (!stage) throw ApiError.notFound('Stage not found in this project');

  const toStatus = payload.status as StageStatus;
  validateStatusPayload(toStatus, payload);

  const siblings = await ProjectWorkflowStage.find({ project: project._id }).lean();
  if (([STAGE_STATUS.IN_PROGRESS, STAGE_STATUS.COMPLETED] as StageStatus[]).includes(toStatus)) {
    assertDependenciesSatisfied(stage, siblings);
  }

  const fromStatus = stage.status;
  if (fromStatus === toStatus && !payload.force) {
    throw ApiError.conflict(`Stage "${stage.name}" is already "${toStatus}"`, { code: 'STATUS_UNCHANGED' });
  }

  const before = {
    status: fromStatus,
    owner: stage.owner ? String(stage.owner) : null,
    dueDate: stage.dueDate,
    blocker: stage.blocker || '',
    holdReason: stage.holdReason || '',
    completionDate: stage.completionDate,
  };

  stage.status = toStatus;
  stage.updatedBy = actorId(actor);

  if (payload.blocker !== undefined) stage.blocker = payload.blocker || '';
  if (payload.holdReason !== undefined) stage.holdReason = payload.holdReason || '';
  if (payload.reason !== undefined && toStatus === STAGE_STATUS.ON_HOLD) stage.holdReason = payload.reason;
  if (payload.blockerText !== undefined) stage.blocker = payload.blockerText;

  if (toStatus === STAGE_STATUS.IN_PROGRESS && !stage.startedAt) stage.startedAt = new Date();
  if (toStatus === STAGE_STATUS.COMPLETED) {
    stage.completionDate = payload.completionDate ? new Date(payload.completionDate) : new Date();
    stage.completedAt = new Date();
  } else {
    stage.completionDate = null;
    stage.completedAt = null;
  }
  if (toStatus === STAGE_STATUS.NOT_STARTED) {
    stage.startedAt = null;
    stage.completionDate = null;
    stage.completedAt = null;
  }
  if (!isBlocked(toStatus)) stage.blocker = isBlocked(toStatus) ? stage.blocker : '';
  if (toStatus !== STAGE_STATUS.ON_HOLD && toStatus !== STAGE_STATUS.BLOCKED) stage.holdReason = '';

  await stage.save();

  /** Append-only history entry - one per change. */
  const history = await StageStatusHistory.create({
    project: project._id,
    stage: stage._id,
    stageName: stage.name,
    stageKey: stage.stageKey,
    fromStatus,
    toStatus,
    note: payload.note || '',
    blocker: stage.blocker || '',
    holdReason: stage.holdReason || '',
    completionDate: stage.completionDate,
    changedBy: actor?.id,
    changedAt: new Date(),
  });

  await recordAudit({
    actor,
    entityType: ENTITY_TYPES.PROJECT_WORKFLOW_STAGE,
    entityId: stage._id,
    entityLabel: `${project.name} / ${stage.name}`,
    action: AUDIT_ACTIONS.STATUS_CHANGED,
    oldValue: before,
    newValue: {
      status: stage.status,
      owner: stage.owner ? String(stage.owner) : null,
      dueDate: stage.dueDate,
      blocker: stage.blocker || '',
      holdReason: stage.holdReason || '',
      completionDate: stage.completionDate,
    },
    metadata: { historyId: String(history._id), manual: true },
    req,
  });

  await notifyStageStatusChange({ stage, project, actor, fromStatus, toStatus });
  integrationService
    .onStageStatusChanged({ stage, project: project as IProject, fromStatus, toStatus })
    .catch(() => {});

  return { stage, history };
}

export async function getStatusHistory(projectId: string, stageId: string, actor: AuthUser | null, query: ListQuery = {}) {
  assertObjectId(projectId, 'project id');
  assertObjectId(stageId, 'stage id');
  const project = await Project.findById(projectId).lean();
  if (!project) throw ApiError.notFound('Project not found');
  assertProjectAccess(actor, project);

  const stage = await ProjectWorkflowStage.findOne({ _id: stageId, project: project._id }).lean();
  if (!stage) throw ApiError.notFound('Stage not found in this project');

  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, unknown> = { stage: stage._id };
  if (!canSeeInternalData(actor)) filter.toStatus = STAGE_STATUS.COMPLETED;

  const [items, total] = await Promise.all([
    StageStatusHistory.find(filter)
      .populate('changedBy', 'name email role')
      .sort({ changedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    StageStatusHistory.countDocuments(filter),
  ]);

  return { project, stage, items, page, limit, total };
}

/** Full project history stream used by the board drawer. */
export async function getProjectHistory(projectId: string, actor: AuthUser | null, query: ListQuery = {}) {
  const project = await Project.findById(projectId).lean();
  if (!project) throw ApiError.notFound('Project not found');
  assertProjectAccess(actor, project);

  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, unknown> = { project: project._id };
  const [items, total] = await Promise.all([
    StageStatusHistory.find(filter)
      .populate('changedBy', 'name email role')
      .populate('stage', 'name stageKey order clientVisible')
      .sort({ changedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    StageStatusHistory.countDocuments(filter),
  ]);
  return { project, items, page, limit, total };
}

/** Assign / re-assign a single stage owner + due date. */
export async function assignStage(
  projectId: string,
  stageId: string,
  payload: { owner?: string | null; dueDate?: string | Date | null },
  { actor, req }: { actor?: AuthUser | null; req?: Request },
) {
  const project = await Project.findById(projectId).lean();
  if (!project) throw ApiError.notFound('Project not found');
  assertProjectAccess(actor, project, { write: true });

  const stage = await ProjectWorkflowStage.findOne({ _id: stageId, project: project._id });
  if (!stage) throw ApiError.notFound('Stage not found in this project');

  const previousOwner = stage.owner ? String(stage.owner) : null;

  if (payload.owner !== undefined) stage.owner = (payload.owner || null) as Types.ObjectId | null;
  if (payload.dueDate !== undefined) stage.dueDate = (payload.dueDate || null) as Date | null;
  stage.updatedBy = actorId(actor);
  await stage.save();

  await notifyStageAssignment({ stage: { ...stage.toObject(), previousOwner }, project, actor, req });

  return stage;
}

/** Internal remarks. Never exposed to client-scoped users (see filterClientData). */
export async function addStageRemark(
  projectId: string,
  stageId: string,
  { remark, actor, req }: { remark?: string; actor?: AuthUser | null; req?: Request },
) {
  const project = await Project.findById(projectId).lean();
  if (!project) throw ApiError.notFound('Project not found');
  assertProjectAccess(actor, project, { write: true });

  const stage = await ProjectWorkflowStage.findOne({ _id: stageId, project: project._id });
  if (!stage) throw ApiError.notFound('Stage not found in this project');

  const before = stage.internalRemarks;
  stage.internalRemarks = `${stage.internalRemarks ? `${stage.internalRemarks}\n` : ''}[${new Date().toISOString()}] ${remark}`;
  stage.updatedBy = actorId(actor);
  await stage.save();

  await recordAudit({
    actor,
    entityType: ENTITY_TYPES.PROJECT_WORKFLOW_STAGE,
    entityId: stage._id,
    entityLabel: `${project.name} / ${stage.name}`,
    action: AUDIT_ACTIONS.REMARK_ADDED,
    oldValue: { internalRemarks: before },
    newValue: { internalRemarks: stage.internalRemarks },
    metadata: { note: 'Remark does not change workflow status (manual status rule)' },
    req,
  });
  return stage;
}

export async function getBoardData(userContext: AuthUser | null, query: ListQuery = {}) {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.mine === 'true') filter.owner = userContext?.id;
  if (query.clientVisibleOnly === 'true') filter.clientVisible = true;

  const stages = await ProjectWorkflowStage.find(filter)
    .populate('project', 'name code status priority client')
    .populate('owner', 'name email role avatarColor')
    .sort({ dueDate: 1, order: 1 })
    .lean();

  return stages;
}

export { ACTIVE_STAGE_STATUSES };
