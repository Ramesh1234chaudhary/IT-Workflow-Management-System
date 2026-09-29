import { AuditLog, Permission, Project, ProjectWorkflowStage, Role, User } from '../models/index';
import { STAGE_STATUS, STAGE_STATUS_VALUES } from '../utils/constants';
import { buildProjectScope, hasFullProjectScope } from './accessService';
import { parsePagination, startOfDay, endOfDay } from '../utils/helpers';
import type { AuthUser } from '../types/domain';
import type { ListQuery } from '../types/models';

/** Paginated, filterable audit trail. Read-only - there is no write endpoint. */
export async function listAuditLogs(_actor: AuthUser | null, query: ListQuery = {}) {
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, unknown> = {};

  if (query.entityType) filter.entityType = query.entityType;
  if (query.entityId) filter.entityId = query.entityId;
  if (query.action) filter.action = query.action;
  if (query.actor) filter.actor = query.actor;
  if (query.search) {
    filter.$or = [
      { actorName: { $regex: String(query.search), $options: 'i' } },
      { entityLabel: { $regex: String(query.search), $options: 'i' } },
      { action: { $regex: String(query.search), $options: 'i' } },
    ];
  }
  if (query.from || query.to) {
    const range: Record<string, Date> = {};
    if (query.from) range.$gte = startOfDay(query.from);
    if (query.to) range.$lte = endOfDay(query.to);
    filter.createdAt = range;
  }

  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);

  return { items, page, limit, total };
}

export async function auditFacets(_actor: AuthUser | null) {
  const [entityTypes, actions] = await Promise.all([
    AuditLog.distinct('entityType'),
    AuditLog.distinct('action'),
  ]);
  return { entityTypes: entityTypes.sort(), actions: actions.sort() };
}

export async function entityTimeline(
  entityType: string,
  entityId: string,
  query: ListQuery = {}
) {
  const { page, limit, skip } = parsePagination(query);
  const filter = { entityType, entityId };
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  return { items, page, limit, total };
}

/** Admin reporting aggregations. */
export async function projectProgressReport(actor: AuthUser | null, query: ListQuery = {}) {
  const scope = hasFullProjectScope(actor) ? {} : buildProjectScope(actor);
  const match: Record<string, unknown> = { ...scope };
  if (query.status) match.status = query.status;

  const projects = await Project.find(match).lean();
  if (!projects.length) return { projects: [], totals: emptyTotals() };

  const stages = await ProjectWorkflowStage.find({ project: { $in: projects.map((p) => p._id) } }).lean();

  const byProject = new Map<string, typeof stages>();
  for (const stage of stages) {
    const key = String(stage.project);
    if (!byProject.has(key)) byProject.set(key, []);
    byProject.get(key)!.push(stage);
  }

  const rows = projects.map((project) => {
    const list = byProject.get(String(project._id)) || [];
    const completed = list.filter((s) => s.status === STAGE_STATUS.COMPLETED).length;
    const blocked = list.filter((s) => s.status === STAGE_STATUS.BLOCKED).length;
    const onHold = list.filter((s) => s.status === STAGE_STATUS.ON_HOLD).length;
    const overdue = list.filter(
      (s) => s.dueDate && s.status !== STAGE_STATUS.COMPLETED && new Date(s.dueDate) < new Date(),
    ).length;
    return {
      projectId: project._id,
      name: project.name,
      code: project.code,
      status: project.status,
      priority: project.priority,
      sopVersion: project.sopVersionNumber,
      totalStages: list.length,
      completedStages: completed,
      blockedStages: blocked,
      onHoldStages: onHold,
      overdueStages: overdue,
      completionRate: list.length ? Math.round((completed / list.length) * 100) : 0,
      targetEndDate: project.targetEndDate,
    };
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.projects += 1;
      acc.totalStages += r.totalStages;
      acc.completedStages += r.completedStages;
      acc.blockedStages += r.blockedStages;
      acc.onHoldStages += r.onHoldStages;
      acc.overdueStages += r.overdueStages;
      return acc;
    },
    { projects: 0, totalStages: 0, completedStages: 0, blockedStages: 0, onHoldStages: 0, overdueStages: 0, completionRate: 0 },
  );
  totals.completionRate = totals.totalStages ? Math.round((totals.completedStages / totals.totalStages) * 100) : 0;

  return { projects: rows, totals };
}

export async function stageDistributionReport(actor: AuthUser | null) {
  const scope = hasFullProjectScope(actor) ? {} : buildProjectScope(actor);
  const projects = await Project.find(scope).select('_id').lean();
  const projectIds = projects.map((p) => p._id);

  const counts = await ProjectWorkflowStage.aggregate<{ _id: string; count: number }>([
    { $match: { project: { $in: projectIds } } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const byStatus: Record<string, number> = STAGE_STATUS_VALUES.reduce(
    (acc, status) => ({ ...acc, [status]: 0 }),
    {} as Record<string, number>
  );
  counts.forEach((row) => {
    if (row._id) byStatus[row._id] = row.count;
  });
  return { byStatus, total: Object.values(byStatus).reduce((a, b) => a + b, 0) };
}

export async function workloadReport(actor: AuthUser | null) {
  const scope = hasFullProjectScope(actor) ? {} : buildProjectScope(actor);
  const projects = await Project.find(scope).select('_id name code').lean();

  const assignments = await ProjectWorkflowStage.aggregate<{ _id: string; count: number }>([
    {
      $match: {
        project: { $in: projects.map((p) => p._id) },
        owner: { $ne: null },
        status: { $ne: STAGE_STATUS.COMPLETED },
      },
    },
    { $group: { _id: '$owner', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const users = await User.find({ _id: { $in: assignments.map((a) => a._id) } })
    .populate('role', 'name')
    .select('name email role department team')
    .lean();

  const nameMap = new Map(users.map((u) => [String(u._id), u]));
  return {
    total: assignments.reduce((sum, a) => sum + a.count, 0),
    items: assignments
      .filter((a) => nameMap.has(String(a._id)))
      .map((a) => {
        // The workload table keys rows by `id`, which a lean document does not
        // have, so the shape is mapped explicitly instead of spread.
        const user = nameMap.get(String(a._id))!;
        return {
          id: String(user._id),
          name: user.name,
          email: user.email,
          role: isPopulatedRole(user.role)
            ? { id: String(user.role._id), _id: String(user.role._id), name: user.role.name }
            : null,
          department: user.department ?? null,
          team: user.team ?? null,
          activeAssignments: a.count,
        };
      }),
  };
}

const isPopulatedRole = (role: unknown): role is { _id: unknown; name: string } =>
  !!role && typeof role === 'object' && 'name' in role;

export async function summaryReport(actor: AuthUser | null) {
  const scope = hasFullProjectScope(actor) ? {} : buildProjectScope(actor);
  const [projects, users, roles, permissions, auditCount] = await Promise.all([
    Project.countDocuments(scope),
    User.countDocuments({}),
    Role.countDocuments({ isActive: true }),
    Permission.countDocuments({ isActive: true }),
    AuditLog.countDocuments({}),
  ]);
  return { projects, users, roles, permissions, auditEntries: auditCount };
}

function emptyTotals() {
  return {
    projects: 0,
    totalStages: 0,
    completedStages: 0,
    blockedStages: 0,
    onHoldStages: 0,
    overdueStages: 0,
    completionRate: 0,
  };
}