import type { Request } from 'express';
import type { Types } from 'mongoose';
import { User, ProjectWorkflowStage, Project, Notification, StageStatusHistory } from '../models/index';
import ApiError from '../utils/ApiError';
import { ACTIVE_STAGE_STATUSES, AUDIT_ACTIONS, ENTITY_TYPES, STAGE_STATUS, STAGE_STATUS_VALUES } from '../utils/constants';
import { buildProjectScope, hasFullProjectScope, hasPermission } from './accessService';
import { recordAudit as writeAudit } from './auditService';
import { parsePagination, toPlain } from '../utils/helpers';
import type { AuditAction, AuthUser, EntityType, StageStatus } from '../types/domain';
import type { IProject, IProjectWorkflowStage, IUser, ListQuery } from '../types/models';

const ACTIVE_FILTER = { status: { $in: ACTIVE_STAGE_STATUSES } };

export interface CreateUserInput extends ListQuery {
  name: string;
  email: string;
  password: string;
  role: string;
  jobTitle?: string;
  department?: string;
  team?: string;
  phone?: string;
  avatarColor?: string;
}

export interface UpdateUserInput extends ListQuery {
  name?: string;
  jobTitle?: string;
  department?: string;
  team?: string;
  phone?: string;
  avatarColor?: string;
  role?: string;
  isActive?: boolean;
}

/** Audit context passed alongside every mutating user call. */
export interface RequestContext {
  actor?: AuthUser | null;
  req?: Request;
}

interface ReassignInput {
  newOwnerId: string;
  projectIds?: string[];
  note?: string;
  actor?: AuthUser | null;
  req?: Request;
}

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
 * `updatedBy` / `changedBy` are typed as ObjectId but callers pass the string id
 * from `req.user`; Mongoose casts it on write.
 */
const actorId = (actor?: AuthUser | null): Types.ObjectId => actor?.id as unknown as Types.ObjectId;

const assertObjectId = (id: unknown, label: string) => {
  if (!/^[a-f\d]{24}$/i.test(String(id))) throw ApiError.badRequest(`Invalid ${label}`);
};

export async function listUsers(_actor: AuthUser | null, query: ListQuery = {}) {
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, unknown> = {};
  if (query.role) filter.role = query.role;
  if (query.isActive !== undefined) filter.isActive = query.isActive;
  if (query.team) filter.team = query.team;
  if (query.department) filter.department = query.department;
  if (query.search) {
    filter.$or = [
      { name: { $regex: String(query.search), $options: 'i' } },
      { email: { $regex: String(query.search), $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .populate('role', 'name key accessScope isClientScoped canSeeInternalData')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  /* One aggregation instead of a query per user for the board's workload column. */
  const userIds = items.map((u) => u._id);
  let assignmentCounts: Array<{ _id: unknown; count: number }> = [];
  if (userIds.length) {
    assignmentCounts = await ProjectWorkflowStage.aggregate<{ _id: unknown; count: number }>([
      { $match: { owner: { $in: userIds }, status: { $in: ACTIVE_STAGE_STATUSES } } },
      { $group: { _id: '$owner', count: { $sum: 1 } } },
    ]);
  }
  const counts = new Map(assignmentCounts.map((c) => [String(c._id), c.count]));

  return {
    items: items.map((u) => ({ ...u, activeAssignments: counts.get(String(u._id)) || 0 })),
    page,
    limit,
    total,
  };
}

export async function getUserById(id: string) {
  assertObjectId(id, 'user id');
  return User.findById(id)
    .populate('role', 'name key accessScope isClientScoped canSeeInternalData permissions')
    .lean();
}

/** Lightweight list for assignment dropdowns. */
export async function getAssignableUsers(_actor: AuthUser | null) {
  return User.find({ isActive: true })
    .select('name email role team avatarColor')
    .populate('role', 'name key accessScope isClientScoped canSeeInternalData')
    .sort({ name: 1 })
    .lean();
}

export async function createUser(payload: CreateUserInput, { actor, req }: RequestContext) {
  const email = String(payload.email).toLowerCase().trim();
  const existing = await User.findOne({ email });
  if (existing) throw ApiError.conflict('A user with that email already exists');

  const roleDoc = await User.db.model('Role').findById(payload.role);
  if (!roleDoc) throw ApiError.badRequest('Invalid role');

  const user = await User.create({
    name: payload.name,
    email,
    password: payload.password,
    role: roleDoc._id,
    jobTitle: payload.jobTitle || '',
    department: payload.department || '',
    team: payload.team || '',
    phone: payload.phone || '',
    avatarColor: payload.avatarColor || '#4f6bed',
    isActive: true,
    createdBy: actorId(actor),
  });

  await recordAudit({
    actor,
    entityType: ENTITY_TYPES.USER,
    entityId: user._id,
    entityLabel: user.name,
    action: AUDIT_ACTIONS.CREATED,
    newValue: { name: user.name, email: user.email, role: String(roleDoc._id), team: user.team },
    req,
  });

  return user;
}

export async function updateUser(id: string, payload: UpdateUserInput, { actor, req }: RequestContext) {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');

  const editable = ['name', 'jobTitle', 'department', 'team', 'phone', 'avatarColor'] as const;
  for (const field of editable) {
    if (payload[field] !== undefined) (user as unknown as Record<string, unknown>)[field] = payload[field];
  }
  if (payload.role) {
    const roleDoc = await User.db.model('Role').findById(payload.role);
    if (!roleDoc) throw ApiError.badRequest('Invalid role');
    user.role = roleDoc._id;
  }
  if (payload.isActive !== undefined) user.isActive = payload.isActive;
  user.updatedBy = actorId(actor);
  await user.save();

  const after = (await User.findById(user._id).populate('role', 'name').lean()) as unknown as IUser & {
    role: { _id: Types.ObjectId; name: string } | null;
  };

  await recordAudit({
    actor,
    entityType: ENTITY_TYPES.USER,
    entityId: user._id,
    entityLabel: user.name,
    action: AUDIT_ACTIONS.UPDATED,
    oldValue: { name: user.name, role: user.role ? String(user.role) : '', team: user.team, department: user.department, jobTitle: user.jobTitle, isActive: true },
    newValue: { name: after.name, role: after.role ? String(after.role._id) : '', team: after.team, department: after.department, jobTitle: after.jobTitle, isActive: after.isActive },
    req,
  });

  return after;
}

export async function deleteUser(id: string, { actor, req }: { actor?: AuthUser | null; req?: Request }) {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');

  const { count } = await getActiveAssignments(String(user._id));
  if (count > 0) {
    throw new ApiError(
      409,
      `User has ${count} active stage assignment(s). Reassign them before deletion.`,
      { code: 'USER_HAS_ACTIVE_ASSIGNMENTS', details: { activeAssignments: count } as unknown as string[] },
    );
  }

  await User.deleteOne({ _id: user._id });

  await recordAudit({
    actor,
    entityType: ENTITY_TYPES.USER,
    entityId: user._id,
    entityLabel: user.name,
    action: AUDIT_ACTIONS.DELETED,
    oldValue: { name: user.name, email: user.email },
    req,
  });
  return true;
}

/** Open (non-completed) stage assignments owned by a user. */
export async function getActiveAssignments(userId: string) {
  const stages = await ProjectWorkflowStage.find({ owner: userId, ...ACTIVE_FILTER })
    .populate('project', 'name code status')
    .sort({ dueDate: 1 })
    .lean();

  return {
    count: stages.length,
    stages: stages.map((s) => {
      const project = s.project as unknown as { _id: Types.ObjectId; name: string; code: string } | null;
      return {
        id: String(s._id),
        name: s.name,
        stageKey: s.stageKey,
        status: s.status,
        dueDate: s.dueDate,
        project: project ? { id: String(project._id), name: project.name, code: project.code } : null,
      };
    }),
  };
}

/** Bulk owner transfer used when a user leaves or changes role. */
export async function reassignUserAssignments(userId: string, { newOwnerId, projectIds, note, actor, req }: ReassignInput) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  const newOwner = await User.findById(newOwnerId);
  if (!newOwner) throw ApiError.badRequest('Invalid new owner');

  const filter: Record<string, unknown> = { owner: user._id, ...ACTIVE_FILTER };
  if (projectIds && projectIds.length) {
    filter.project = { $in: projectIds };
  }

  const stages = await ProjectWorkflowStage.find(filter).populate('project', 'name code');
  const moved: Array<{
    stageId: string;
    name: string;
    project: string;
    from: string;
    to: string;
    status: StageStatus;
    previousStatus: StageStatus;
    note?: string;
  }> = [];

  for (const stage of stages) {
    const project = stage.project as unknown as { name?: string } | null;
    const previousStatus = stage.status;
    stage.owner = newOwner._id;
    stage.updatedBy = actorId(actor);
    await stage.save();

    await Notification.create({
      recipient: newOwner._id,
      type: 'assignment',
      title: 'Stage assigned to you',
      message: `Stage "${stage.name}" of project ${project?.name || ''} is now assigned to you.`,
      entityType: ENTITY_TYPES.PROJECT_WORKFLOW_STAGE,
      entityId: stage._id,
    });

    await StageStatusHistory.create({
      project: stage.project,
      stage: stage._id,
      stageName: stage.name,
      stageKey: stage.stageKey,
      fromStatus: previousStatus,
      toStatus: stage.status,
      note: note || `Reassigned from ${user.name} to ${newOwner.name}`,
      blocker: stage.blocker || '',
      holdReason: stage.holdReason || '',
      completionDate: stage.completionDate,
      changedBy: actorId(actor),
      changedAt: new Date(),
    });

    moved.push({
      stageId: String(stage._id),
      name: stage.name,
      project: project?.name || '',
      from: user.name,
      to: newOwner.name,
      status: stage.status,
      previousStatus,
      note,
    });
  }

  await recordAudit({
    actor,
    entityType: ENTITY_TYPES.USER,
    entityId: user._id,
    entityLabel: user.name,
    action: AUDIT_ACTIONS.REASSIGNED,
    oldValue: { owner: user.name, activeAssignments: moved.length },
    newValue: { owner: newOwner.name, note: note || 'Reassigned active stage assignments' },
    metadata: { reassignedStages: moved.length, stageIds: moved.map((m) => m.stageId) },
    req,
  });

  return { reassigned: moved.length, from: user.name, to: newOwner.name, stages: moved };
}

export async function accessibleProjects(actor: AuthUser | null) {
  if (hasFullProjectScope(actor)) return { projects: [], total: 0 };
  const projects = await Project.find(buildProjectScope(actor)).select('name code status').lean();
  return { projects, total: projects.length };
}

/** Whether the user can be deactivated right now, and what blocks it. */
export async function deactivateUserGuardPreview(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  const assignments = await getActiveAssignments(userId);

  return {
    user,
    assignments,
    canDeactivate: assignments.count === 0,
  };
}

export async function deactivateUser(
  id: string,
  { reason, actor, req }: { reason?: string; actor?: AuthUser | null; req?: Request },
) {
  if (!hasPermission(actor, 'user', 'deactivate')) throw ApiError.forbidden('Missing permission: user:deactivate');

  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  if (actor?.id && String(actor.id) === String(user._id)) {
    throw ApiError.badRequest('You cannot deactivate your own account');
  }

  const { stages, count } = await getActiveAssignments(String(user._id));
  if (count > 0) {
    throw new ApiError(
      409,
      `User has ${count} active stage assignment(s). Reassign them before deactivating.`,
      {
        code: 'USER_HAS_ACTIVE_ASSIGNMENTS',
        details: {
          activeAssignments: count,
          assignments: stages,
          resolution: `POST /api/users/${user._id}/reassign with { newOwnerId }`,
        } as unknown as string[],
      },
    );
  }

  user.isActive = false;
  user.deactivationReason = reason || '';
  user.deactivatedAt = new Date();
  await user.save();

  await recordAudit({
    actor,
    entityType: ENTITY_TYPES.USER,
    entityId: user._id,
    entityLabel: user.name,
    action: AUDIT_ACTIONS.DEACTIVATED,
    oldValue: { isActive: true, name: user.name, email: user.email },
    newValue: { isActive: false, name: user.name, email: user.email, reason: reason || '' },
    metadata: { reason: reason || '', deactivatedAt: user.deactivatedAt },
    req,
  });
  return user;
}

export async function reactivateUser(id: string, { actor, req }: { actor?: AuthUser | null; req?: Request }) {
  if (!hasPermission(actor, 'user', 'update')) throw ApiError.forbidden('Missing permission: user:update');

  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  if (user.isActive) throw ApiError.conflict('User is already active');

  const before = { isActive: user.isActive, deactivatedAt: user.deactivatedAt, deactivationReason: user.deactivationReason };

  user.isActive = true;
  user.deactivatedAt = null;
  user.deactivationReason = '';
  user.updatedBy = actorId(actor);
  await user.save();

  await recordAudit({
    actor,
    entityType: ENTITY_TYPES.USER,
    entityId: user._id,
    entityLabel: user.name,
    action: AUDIT_ACTIONS.ACTIVATED,
    oldValue: before,
    newValue: { isActive: true, deactivatedAt: null, deactivationReason: '' },
    req,
  });
  return user;
}

export { STAGE_STATUS, STAGE_STATUS_VALUES, toPlain, IProject, IProjectWorkflowStage };
