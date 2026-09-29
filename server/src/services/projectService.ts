import type { Types } from 'mongoose';
import type { Request } from 'express';
import { Project, ProjectWorkflowStage, SOPTemplate, User } from '../models/index';
import ApiError from '../utils/ApiError';
import { ACTIVE_STAGE_STATUSES, AUDIT_ACTIONS, ENTITY_TYPES, PRIORITY, PROJECT_STATUS, STAGE_STATUS } from '../utils/constants';
import { assertProjectAccess, buildProjectScope, canSeeInternalData, hasFullProjectScope } from './accessService';
import { recordAudit as writeAudit } from './auditService';
import { getLatestPublishedVersion } from './sopService';
import { parsePagination } from '../utils/helpers';
import type { AuditAction, AuthUser, EntityType, Priority, ProjectStatus } from '../types/domain';
import type { IProjectWorkflowStage, ListQuery } from '../types/models';

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
 * `updatedBy` / `createdBy` are typed as ObjectId but callers pass the string id
 * from `req.user`; Mongoose casts it on write.
 */
const actorId = (actor?: AuthUser | null): Types.ObjectId => actor?.id as unknown as Types.ObjectId;

/** Only the identity of a template is needed to resolve its latest version. */
type LeanTemplateRef = { _id: Types.ObjectId };

const PROJECT_POPULATE = [
  { path: 'client', select: 'name email role isActive' },
  { path: 'projectManager', select: 'name email role isActive' },
  { path: 'members', select: 'name email role isActive' },
  { path: 'createdBy', select: 'name email' },
];

const assertObjectId = (id: unknown, label: string) => {
  if (!/^[a-f\d]{24}$/i.test(String(id))) throw ApiError.badRequest(`Invalid ${label}`);
};

/** Body of POST /api/projects. */
export interface CreateProjectInput extends ListQuery {
  name: string;
  code?: string;
  description?: string;
  priority?: Priority;
  sopTemplate?: string;
  client: string;
  projectManager: string;
  members?: string[];
  startDate?: string | Date;
  targetEndDate?: string | Date | null;
  internalRemarks?: string;
  tags?: string[];
  actor?: AuthUser | null;
  req?: Request;
}

export interface UpdateProjectInput extends ListQuery {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  priority?: Priority;
  client?: string;
  projectManager?: string;
  members?: string[];
  startDate?: string | Date;
  targetEndDate?: string | Date | null;
  internalRemarks?: string;
  actor?: AuthUser | null;
  req?: Request;
}

export interface StageAssignment {
  stageId: string;
  owner?: string | null;
  dueDate?: string | Date | null;
}

export async function listProjects(user: AuthUser | null, query: ListQuery = {}) {
  const { page, limit, skip } = parsePagination(query);
  const scope = buildProjectScope(user);

  const filter: Record<string, unknown> = { ...scope };
  if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;
  if (query.client) filter.client = query.client;
  if (query.projectManager) filter.projectManager = query.projectManager;
  if (query.search) {
    filter.$and = [
      {
        $or: [
          { name: { $regex: String(query.search), $options: 'i' } },
          { code: { $regex: String(query.search), $options: 'i' } },
        ],
      },
    ];
  }

  const [projects, total] = await Promise.all([
    Project.find(filter).populate(PROJECT_POPULATE).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Project.countDocuments(filter),
  ]);

  /* Board rows carry per-stage status, so pull them in one aggregate. */
  const projectIds = projects.map((p) => p._id);
  const grouped = new Map<string, Array<Pick<IProjectWorkflowStage, 'project' | 'status' | 'order' | 'clientVisible' | 'dueDate' | 'owner' | 'name' | 'stageKey'>>>();
  if (projectIds.length) {
    const stageDocs = await ProjectWorkflowStage.find({ project: { $in: projectIds } })
      .select('project status order clientVisible dueDate owner name stageKey')
      .sort({ order: 1 })
      .lean();
    for (const s of stageDocs) {
      const key = String(s.project);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(s as never);
    }
  }

  const canSeeInternal = canSeeInternalData(user);
  const enriched = projects.map((p) => {
    const all = grouped.get(String(p._id)) || [];
    const visible = canSeeInternal ? all : all.filter((s) => s.clientVisible === true);
    return {
      ...p,
      stages: visible,
      _stageStats: {
        total: all.length,
        visible: visible.length,
        completed: all.filter((s) => s.status === STAGE_STATUS.COMPLETED).length,
      },
    };
  });

  return { projects: enriched, page, limit, total };
}

export async function getProjectById(id: string) {
  assertObjectId(id, 'project id');
  return Project.findById(id).populate(PROJECT_POPULATE).lean();
}

/** The project plus its full stage board, filtered for the caller's visibility. */
export async function getProjectWithStages(id: string, user: AuthUser | null) {
  assertObjectId(id, 'project id');
  const project = await Project.findById(id).populate(PROJECT_POPULATE).lean();
  if (!project) throw ApiError.notFound('Project not found');
  assertProjectAccess(user, project);

  const allStages = await ProjectWorkflowStage.find({ project: project._id })
    .populate('owner', 'name email role avatarColor')
    .populate('documents', 'originalName mimeType size version createdAt')
    .sort({ order: 1 })
    .lean();

  const stages = canSeeInternalData(user) ? allStages : allStages.filter((s) => s.clientVisible === true);
  return { project, stages, allStageCount: allStages.length };
}

export interface RequestContext {
  actor: AuthUser;
  req: Request;
}

/** POST /api/projects - stages are generated from the latest published SOP version. */
export async function createProject(payload: CreateProjectInput, { actor, req }: RequestContext) {
  const members = Array.isArray(payload.members) ? payload.members.map(String) : [];
  const startDate = payload.startDate ? new Date(payload.startDate) : new Date();

  let template: LeanTemplateRef | null = null;
  let version: Awaited<ReturnType<typeof getLatestPublishedVersion>> = null;
  if (payload.sopTemplate) {
    template = (await SOPTemplate.findById(payload.sopTemplate).lean()) as LeanTemplateRef | null;
    if (!template) throw ApiError.notFound('SOP template not found');
    version = await getLatestPublishedVersion(template._id as unknown as Types.ObjectId);
  } else {
    version = await getLatestPublishedVersion(
      ((await SOPTemplate.findOne({ status: 'published' }).lean()) as LeanTemplateRef | null)?._id as unknown as Types.ObjectId,
    );
  }
  if (!version) {
    throw ApiError.badRequest('No published SOP version is available to generate workflow stages from');
  }

  const client = await User.findById(payload.client);
  if (!client) throw ApiError.badRequest('Invalid client user');

  const projectManager = await User.findById(payload.projectManager).populate('role', 'name isClientScoped');
  if (!projectManager) throw ApiError.badRequest('Invalid project manager');
  if ((projectManager as unknown as { role: { isClientScoped?: boolean } | null }).role?.isClientScoped) {
    throw ApiError.badRequest('A client-scoped user cannot be the project manager');
  }

  const code = payload.code || `PRJ-${Date.now().toString(36).toUpperCase()}`;

  const project = await Project.create({
    name: payload.name,
    code,
    description: payload.description || '',
    status: PROJECT_STATUS.PLANNED,
    priority: payload.priority || PRIORITY.MEDIUM,
    sopTemplate: template?._id,
    sopVersion: version._id,
    sopVersionNumber: version.version,
    client: payload.client,
    projectManager: payload.projectManager,
    members: [...new Set(members)],
    startDate,
    targetEndDate: payload.targetEndDate ? new Date(payload.targetEndDate) : null,
    createdBy: actor?.id,
    internalRemarks: payload.internalRemarks || '',
    tags: payload.tags || [],
  });

  /* Generate one stage per SOP stage, offsetting due dates from the project start. */
  const created = await ProjectWorkflowStage.insertMany(
    version.stages.map((d, index) => ({
      project: project._id,
      sopVersion: version._id,
      stageKey: d.key,
      name: d.name,
      description: d.description,
      order: d.order ?? index + 1,
      clientVisible: d.clientVisible,
      status: STAGE_STATUS.NOT_STARTED,
      dependsOn: d.dependsOn || [],
      requiredDocuments: d.requiredDocuments || [],
      estimatedDays: d.estimatedDays ?? null,
      dueDate: project.targetEndDate || (d.estimatedDays ? addDays(startDate, d.estimatedDays) : null),
    })),
  );

  await recordAudit({
    actor,
    entityType: ENTITY_TYPES.PROJECT,
    entityId: project._id,
    entityLabel: project.name,
    action: AUDIT_ACTIONS.CREATED,
    newValue: {
      name: project.name,
      code: project.code,
      sopTemplate: String(template?._id || ''),
      sopVersion: String(version._id),
      sopVersionNumber: version.version,
      generatedStages: created.length,
    },
    metadata: { autoGeneratedStages: created.length, projectStatus: PROJECT_STATUS.PLANNED, note: 'Stages generated from published SOP' },
    req,
  });

  return { project, generatedStages: created.length, version };
}

export async function updateProject(id: string, payload: UpdateProjectInput, { actor, req }: UpdateProjectInput) {
  const project = await Project.findById(id);
  if (!project) throw ApiError.notFound('Project not found');
  assertProjectAccess(actor, project, { write: true });

  const before = {
    name: project.name,
    status: project.status,
    priority: project.priority,
    projectManager: project.projectManager ? String(project.projectManager) : null,
    targetEndDate: project.targetEndDate,
  };

  ['name', 'description', 'priority', 'status', 'targetEndDate', 'startDate', 'internalRemarks'].forEach((field) => {
    if (payload[field] !== undefined) (project as unknown as Record<string, unknown>)[field] = payload[field];
  });
  if (payload.members) project.members = [...new Set(payload.members.map(String))] as unknown as Types.ObjectId[];
  if (payload.projectManager) project.projectManager = payload.projectManager as unknown as Types.ObjectId;

  const statusChanged = payload.status && payload.status !== before.status;
  await project.save();

  await recordAudit({
    actor,
    entityType: ENTITY_TYPES.PROJECT,
    entityId: project._id,
    entityLabel: project.name,
    action: AUDIT_ACTIONS.UPDATED,
    oldValue: { ...before },
    newValue: {
      name: project.name,
      status: project.status,
      priority: project.priority,
      projectManager: project.projectManager ? String(project.projectManager) : null,
      targetEndDate: project.targetEndDate,
    },
    req,
  });

  if (statusChanged) {
    const stages = await ProjectWorkflowStage.find({ project: project._id, status: { $ne: STAGE_STATUS.COMPLETED } });
    for (const s of stages) s.status = STAGE_STATUS.NOT_STARTED;
    await stages.map((s) => s.save());
  }

  return project;
}

export async function deleteProject(id: string, { actor, req }: { actor?: AuthUser | null; req?: Request }) {
  const project = await Project.findById(id);
  if (!project) throw ApiError.notFound('Project not found');
  assertProjectAccess(actor, project, { write: true });

  const before = { name: project.name, code: project.code, status: project.status };
  await Project.deleteOne({ _id: project._id });
  await ProjectWorkflowStage.deleteMany({ project: project._id });

  await recordAudit({
    actor,
    entityType: ENTITY_TYPES.PROJECT,
    entityId: project._id,
    entityLabel: project.name,
    action: AUDIT_ACTIONS.DELETED,
    oldValue: before,
    metadata: { cascade: 'project_workflow_stages' },
    req,
  });
  return true;
}

/** GET /api/projects/options - lightweight list for dropdowns. */
export async function projectOptions(user: AuthUser | null) {
  const filter: Record<string, unknown> = { ...buildProjectScope(user) };
  return Project.find(filter).select('name code status priority client').sort({ name: 1 }).lean();
}

/** Stages the Create Project form would generate, without writing anything. */
export async function previewStages({ sopTemplate, startDate, targetEndDate }: { sopTemplate?: string; startDate?: string; targetEndDate?: string }) {
  let version: Awaited<ReturnType<typeof getLatestPublishedVersion>> = null;
  if (sopTemplate) {
    const template = (await SOPTemplate.findById(sopTemplate).lean()) as LeanTemplateRef | null;
    if (!template) throw ApiError.notFound('SOP template not found');
    version = await getLatestPublishedVersion(template._id as unknown as Types.ObjectId);
  } else {
    const latestTemplate = (await SOPTemplate.findOne({ status: 'published' }).lean()) as LeanTemplateRef | null;
    if (latestTemplate) version = await getLatestPublishedVersion(latestTemplate._id as unknown as Types.ObjectId);
  }

  if (!version) return { stages: [], templateName: null, version: null, clientVisibleStages: 0, internalStages: 0 };

  const base = startDate ? new Date(startDate) : new Date();
  const stages = version.stages.map((d, index) => ({
    stageKey: d.key,
    name: d.name,
    order: d.order ?? index + 1,
    clientVisible: d.clientVisible,
    estimatedDays: d.estimatedDays ?? null,
    dependsOn: d.dependsOn || [],
    dueDate: targetEndDate || (d.estimatedDays ? addDays(base, d.estimatedDays) : null),
  }));

  return {
    stages,
    templateName: version.templateName,
    version: version.version,
    clientVisibleStages: stages.filter((s) => s.clientVisible).length,
    internalStages: stages.filter((s) => !s.clientVisible).length,
  };
}

/** PATCH /api/projects/:id/stages/assign - bulk owner + due date assignment. */
export async function assignStages(
  projectId: string,
  assignments: StageAssignment[],
  { actor, req }: { actor?: AuthUser | null; req?: Request },
) {
  const project = await Project.findById(projectId);
  if (!project) throw ApiError.notFound('Project not found');
  assertProjectAccess(actor, project, { write: true });

  const stages = await ProjectWorkflowStage.find({ project: project._id });
  const results: Array<{ stageId: unknown; success: boolean; message?: string }> = [];

  for (const assignment of assignments) {
    const stage = stages.find((s) => String(s._id) === String(assignment.stageId));
    if (!stage) {
      results.push({ stageId: assignment.stageId, success: false, message: 'Stage not found in this project' });
      continue;
    }
    if (assignment.owner !== undefined) stage.owner = (assignment.owner || null) as Types.ObjectId | null;
    if (assignment.dueDate !== undefined) stage.dueDate = (assignment.dueDate || null) as Date | null;
    stage.updatedBy = actorId(actor);
    await stage.save();
    results.push({ stageId: assignment.stageId, success: true });
  }

  await recordAudit({
    actor,
    entityType: ENTITY_TYPES.PROJECT,
    entityId: project._id,
    entityLabel: project.name,
    action: AUDIT_ACTIONS.ASSIGNED,
    metadata: { assignmentCount: assignments.length, failed: results.filter((r) => !r.success).length },
    req,
  });

  return results;
}

/** Users who can be assigned to a stage, honouring the requester's read scope. */
export async function assignableUsers(user: AuthUser | null) {
  const filter: Record<string, unknown> = { isActive: true };
  if (!hasFullProjectScope(user)) {
    const seen = new Set<string>();
    const stages = await ProjectWorkflowStage.find({
      project: buildProjectScope(user),
      status: { $in: ACTIVE_STAGE_STATUSES },
    }).select('owner');
    for (const s of stages) if (s.owner) seen.add(String(s.owner));
    filter._id = { $in: [...seen] };
  }
  return User.find(filter).select('name email role team avatarColor').sort({ name: 1 }).lean();
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

export { PROJECT_STATUS };
