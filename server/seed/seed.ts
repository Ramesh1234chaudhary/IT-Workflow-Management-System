/**
 * ---------------------------------------------------------------------------
 * Seed script
 * ---------------------------------------------------------------------------
 * Creates:
 *   - the full module/action permission matrix
 *   - the 4 roles with DB driven scopes
 *   - one user per role (plus 3 extra IT members and 1 extra client)
 *   - one published SOP template with exactly 5 stages (3 clientVisible,
 *     2 internal) and its immutable v1 snapshot
 *   - 3 demo projects with auto-generated workflow stages, owners, status
 *     history and audit entries
 *
 * Run with:  npm run seed        (from the server folder)
 *            npm run seed        (from the repo root)
 * ---------------------------------------------------------------------------
 */

import mongoose, { type Types } from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/db';
import logger from '../src/utils/logger';
import type { AccessScope, Priority, StageStatus } from '../src/types/domain';
import type { IPermission } from '../src/types/models';
import type {
  ProjectDoc,
  RoleDoc,
  SOPTemplateDoc,
  SOPVersionDoc,
  UserDoc,
} from '../src/models/index';
import {
  AuditLog,
  Document,
  Notification,
  Permission,
  Project,
  ProjectWorkflowStage,
  RefreshToken,
  Role,
  SOPTemplate,
  SOPVersion,
  StageStatusHistory,
  User,
} from '../src/models/index';
import {
  ACCESS_SCOPE,
  AUDIT_ACTIONS,
  ENTITY_TYPES,
  PRIORITY,
  PROJECT_STATUS,
  STAGE_STATUS,
} from '../src/utils/constants';

/* ------------------------------ Permissions ------------------------------ */

/** [module, action, description] - the authoritative permission matrix. */
type PermissionTuple = readonly [string, string, string];

const PERMISSION_DEFINITIONS: PermissionTuple[] = [
  ['auth', 'login', 'Sign in to the application'],
  ['auth', 'refresh', 'Rotate the refresh token'],
  ['auth', 'logout', 'Sign out and revoke the session'],

  ['user', 'create', 'Create user accounts'],
  ['user', 'read', 'View users and their assignments'],
  ['user', 'update', 'Edit user profiles and roles'],
  ['user', 'delete', 'Delete user accounts'],
  ['user', 'deactivate', 'Deactivate a user (blocked by active assignments)'],
  ['user', 'reassign', 'Reassign stage ownership to another user'],

  ['role', 'create', 'Create roles'],
  ['role', 'read', 'View roles and the permission matrix'],
  ['role', 'update', 'Update role permissions and scope'],
  ['role', 'delete', 'Delete non-system roles'],

  ['permission', 'read', 'View the module/action permission catalogue'],
  ['permission', 'update', 'Edit permission descriptions'],

  ['sop', 'create', 'Create SOP templates and stages'],
  ['sop', 'read', 'View SOP templates'],
  ['sop', 'update', 'Edit SOP templates (draft only)'],
  ['sop', 'delete', 'Delete SOP templates or stages (draft only)'],
  ['sop', 'publish', 'Publish an immutable SOP version'],
  ['sop', 'reorder', 'Reorder SOP stages'],
  ['sop', 'version:read', 'View SOP version history'],

  ['project', 'create', 'Create projects (auto-generates stages)'],
  ['project', 'read', 'View projects within the assigned scope'],
  ['project', 'readAll', 'View every project regardless of assignment'],
  ['project', 'update', 'Edit project details'],
  ['project', 'delete', 'Delete projects'],
  ['project', 'assign', 'Assign stage owners and due dates'],

  ['stage', 'read', 'View workflow stages'],
  ['stage', 'updateStatus', 'Manually change stage status'],
  ['stage', 'assign', 'Assign a single stage'],
  ['stage', 'remark', 'Add internal remarks'],
  ['stage', 'readHistory', 'View stage status history'],

  ['document', 'upload', 'Upload documents (never changes status)'],
  ['document', 'read', 'List and download documents'],
  ['document', 'delete', 'Delete documents'],

  ['audit', 'read', 'View the append-only audit trail'],

  ['report', 'read', 'View analytics reports'],
  ['report', 'export', 'Export report data'],

  ['notification', 'read', 'Read in-app notifications'],
  ['notification', 'create', 'Send notifications'],
];

const ALL_KEYS = PERMISSION_DEFINITIONS.map(([m, a]) => `${m}:${a}`);

/** Identity helper: keeps the role tables readable without changing their data. */
const pick = (...keys: string[]): string[] => keys;

/* --------------------------------- Roles --------------------------------- */

interface IRoleSeed {
  name: string;
  key: string;
  description: string;
  accessScope: AccessScope;
  isClientScoped: boolean;
  canSeeInternalData: boolean;
  permissions: string[];
}

const ROLE_DEFINITIONS: IRoleSeed[] = [
  {
    name: 'Super Admin',
    key: 'super_admin',
    description: 'Configures SOP templates, publishes versions and manages the RBAC model.',
    accessScope: ACCESS_SCOPE.ALL,
    isClientScoped: false,
    canSeeInternalData: true,
    permissions: pick(...ALL_KEYS),
  },
  {
    name: 'Admin',
    key: 'admin',
    description: 'Manages users, creates projects from published SOPs and reviews the audit trail.',
    accessScope: ACCESS_SCOPE.ALL,
    isClientScoped: false,
    canSeeInternalData: true,
    permissions: pick(
      'user:create', 'user:read', 'user:update', 'user:delete', 'user:deactivate', 'user:reassign',
      'role:read', 'permission:read',
      'sop:read', 'sop:version:read',
      'project:create', 'project:read', 'project:readAll', 'project:update', 'project:delete', 'project:assign',
      'stage:read', 'stage:assign', 'stage:readHistory',
      'document:read', 'document:download',
      'audit:read',
      'report:read', 'report:export',
      'notification:read',
    ),
  },
  {
    name: 'IT Team Member',
    key: 'it_team_member',
    description: 'Works the assigned projects and updates stage status manually.',
    accessScope: ACCESS_SCOPE.ASSIGNED,
    isClientScoped: false,
    canSeeInternalData: true,
    permissions: pick(
      'sop:read', 'sop:version:read',
      'project:read',
      'stage:read', 'stage:updateStatus', 'stage:remark', 'stage:readHistory',
      'document:upload', 'document:read', 'document:download',
      'report:read',
      'notification:read',
    ),
  },
  {
    name: 'Client / Operations',
    key: 'client_operations',
    description: 'Read-only view of client-visible stages. All restricted data is stripped at the API.',
    accessScope: ACCESS_SCOPE.ASSIGNED,
    isClientScoped: true,
    canSeeInternalData: false,
    permissions: pick('project:read', 'stage:read', 'sop:read'),
  },
];

/* --------------------------------- Users --------------------------------- */

interface IUserSeed {
  name: string;
  email: string;
  password: string;
  roleKey: string;
  jobTitle: string;
  department: string;
  team: string;
  avatarColor: string;
}

const USERS: IUserSeed[] = [
  { name: 'Samantha Root', email: 'superadmin@example.com', password: 'SuperAdmin@123', roleKey: 'super_admin', jobTitle: 'Head of IT Operations', department: 'IT', team: 'IT Leadership', avatarColor: '#6a1b9a' },
  { name: 'Arjun Mehta', email: 'admin@example.com', password: 'Admin@123', roleKey: 'admin', jobTitle: 'IT Program Manager', department: 'IT', team: 'IT Program Office', avatarColor: '#1565c0' },
  { name: 'Priya Nair', email: 'itmember@example.com', password: 'ITMember@123', roleKey: 'it_team_member', jobTitle: 'Senior Infrastructure Engineer', department: 'IT', team: 'Infrastructure', avatarColor: '#00897b' },
  { name: 'Rohit Sharma', email: 'itmember2@example.com', password: 'ITMember@123', roleKey: 'it_team_member', jobTitle: 'Network Engineer', department: 'IT', team: 'Network', avatarColor: '#2e7d32' },
  { name: 'Neha Kulkarni', email: 'itmember3@example.com', password: 'ITMember@123', roleKey: 'it_team_member', jobTitle: 'Security Analyst', department: 'IT', team: 'Security', avatarColor: '#ef6c00' },
  { name: 'Daniel Carter', email: 'client@example.com', password: 'Client@123', roleKey: 'client_operations', jobTitle: 'Operations Lead', department: 'Operations', team: 'North America Ops', avatarColor: '#c2185b' },
  { name: 'Maria Gonzalez', email: 'client2@example.com', password: 'Client@123', roleKey: 'client_operations', jobTitle: 'Regional Operations Manager', department: 'Operations', team: 'LATAM Ops', avatarColor: '#5e35b1' },
];

/* ---------------------------------- SOP ---------------------------------- */

/** A stage as authored in the template, before the 1-based `order` is assigned. */
interface ITemplateStageSeed {
  key: string;
  name: string;
  description: string;
  clientVisible: boolean;
  estimatedDays: number;
  requiredDocuments: string[];
  dependsOn: string[];
}

interface ITemplateSeed {
  name: string;
  key: string;
  category: string;
  description: string;
  stages: ITemplateStageSeed[];
}

const TEMPLATE: ITemplateSeed = {
  name: 'IT Project Delivery SOP',
  key: 'IT_DELIVERY',
  category: 'Service Delivery',
  description:
    'Standard end-to-end workflow for delivering an internal IT service request, from requirement capture through to go-live handover.',
  stages: [
    {
      key: 'REQ',
      name: 'Requirement Gathering',
      description: 'Capture the business requirement, scope, stakeholders and success criteria.',
      clientVisible: true,
      estimatedDays: 3,
      requiredDocuments: ['Requirement Document'],
      dependsOn: [],
    },
    {
      key: 'INFRA',
      name: 'Infrastructure Provisioning',
      description: 'Provision servers, network, storage and access for the agreed solution.',
      clientVisible: true,
      estimatedDays: 5,
      requiredDocuments: ['Provisioning Checklist'],
      dependsOn: ['REQ'],
    },
    {
      key: 'SEC',
      name: 'Security & Compliance Review',
      description: 'Internal security review, threat assessment and compliance sign-off. Not shared with the client.',
      clientVisible: false,
      estimatedDays: 4,
      requiredDocuments: ['Security Assessment', 'Compliance Sign-off'],
      dependsOn: ['INFRA'],
    },
    {
      key: 'TEST',
      name: 'System Integration & Testing',
      description: 'Integrate with upstream/downstream systems and execute UAT with the business.',
      clientVisible: true,
      estimatedDays: 7,
      requiredDocuments: ['UAT Sign-off Report'],
      dependsOn: ['SEC'],
    },
    {
      key: 'GOLIVE',
      name: 'Go-Live & Handover',
      description: 'Cutover, hypercare and knowledge transfer to the operations team. Internal handover notes only.',
      clientVisible: false,
      estimatedDays: 2,
      requiredDocuments: ['Handover Pack'],
      dependsOn: ['TEST'],
    },
  ],
};

/* --------------------------------- Projects -------------------------------- */

/**
 * Per-stage intent for a demo project. Every field is optional so that the
 * `|| {}` lookups used below stay typed without changing the seeded rows.
 */
interface IStagePlanEntry {
  status?: StageStatus;
  owner?: string | null;
  completedDaysAgo?: number;
  blocker?: string;
  holdReason?: string;
}

interface IProjectSeed {
  name: string;
  code: string;
  description: string;
  priority: Priority;
  clientEmail: string;
  managerEmail: string;
  memberEmails: string[];
  startOffsetDays: number;
  targetOffsetDays: number;
  internalRemarks: string;
  tags: string[];
  stagePlan: Record<string, IStagePlanEntry>;
}

const PROJECTS: IProjectSeed[] = [
  {
    name: 'Warehouse Inventory Modernisation',
    code: 'PRJ-WH-001',
    description: 'Replace the legacy inventory spreadsheet and on-premise WMS with a cloud hosted solution.',
    priority: PRIORITY.HIGH,
    clientEmail: 'client@example.com',
    managerEmail: 'admin@example.com',
    memberEmails: ['itmember@example.com', 'itmember2@example.com'],
    startOffsetDays: -30,
    targetOffsetDays: 25,
    internalRemarks: 'Escalation risk: vendor SLA not yet countersigned. Keep internal only.',
    tags: ['warehouse', 'cloud-migration'],
    stagePlan: {
      REQ: { status: STAGE_STATUS.COMPLETED, owner: 'itmember@example.com', completedDaysAgo: 25 },
      INFRA: { status: STAGE_STATUS.COMPLETED, owner: 'itmember2@example.com', completedDaysAgo: 18 },
      SEC: { status: STAGE_STATUS.IN_PROGRESS, owner: 'itmember3@example.com' },
      TEST: { status: STAGE_STATUS.NOT_STARTED, owner: null },
      GOLIVE: { status: STAGE_STATUS.NOT_STARTED, owner: null },
    },
  },
  {
    name: 'Finance Cloud Migration',
    code: 'PRJ-FIN-002',
    description: 'Migrate finance reporting workloads to the corporate cloud tenancy.',
    priority: PRIORITY.CRITICAL,
    clientEmail: 'client2@example.com',
    managerEmail: 'admin@example.com',
    memberEmails: ['itmember@example.com', 'itmember3@example.com'],
    startOffsetDays: -12,
    targetOffsetDays: 40,
    internalRemarks: 'Blocking dependency on the finance close calendar. Do not schedule cutover in month end.',
    tags: ['finance', 'cloud'],
    stagePlan: {
      REQ: { status: STAGE_STATUS.COMPLETED, owner: 'itmember@example.com', completedDaysAgo: 8 },
      INFRA: { status: STAGE_STATUS.IN_PROGRESS, owner: 'itmember2@example.com' },
      SEC: { status: STAGE_STATUS.ON_HOLD, owner: 'itmember3@example.com', holdReason: 'Awaiting updated data residency policy from the compliance team' },
      TEST: { status: STAGE_STATUS.NOT_STARTED, owner: null },
      GOLIVE: { status: STAGE_STATUS.NOT_STARTED, owner: null },
    },
  },
  {
    name: 'Branch Network Refresh',
    code: 'PRJ-NET-003',
    description: 'Replace legacy branch switches and harden remote access for 40 sites.',
    priority: PRIORITY.MEDIUM,
    clientEmail: 'client@example.com',
    managerEmail: 'admin@example.com',
    memberEmails: ['itmember2@example.com'],
    startOffsetDays: -5,
    targetOffsetDays: 60,
    internalRemarks: 'Regional vendor dependency; escalate to infra lead if site 12 slips.',
    tags: ['network', 'branch'],
    stagePlan: {
      REQ: { status: STAGE_STATUS.IN_PROGRESS, owner: 'itmember2@example.com' },
      INFRA: { status: STAGE_STATUS.BLOCKED, owner: 'itmember2@example.com', blocker: 'Switch hardware shipment delayed by 3 weeks at customs' },
      SEC: { status: STAGE_STATUS.NOT_STARTED, owner: null },
      TEST: { status: STAGE_STATUS.NOT_STARTED, owner: null },
      GOLIVE: { status: STAGE_STATUS.NOT_STARTED, owner: null },
    },
  },
];

/* --------------------------------- Helpers -------------------------------- */

/** Email -> created user, shared by the project and notification seeders. */
type UserMap = Map<string, UserDoc>;

const daysFromNow = (days: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};

/**
 * Collections are cleared through the raw driver so the append-only guards on
 * AuditLog / StageStatusHistory / SOPVersion do not block the reset.
 */
async function wipe(): Promise<void> {
  const models = [
    AuditLog,
    Notification,
    Document,
    StageStatusHistory,
    ProjectWorkflowStage,
    Project,
    SOPVersion,
    SOPTemplate,
    RefreshToken,
    User,
    Role,
    Permission,
  ];
  await Promise.all(models.map((model) => model.collection.deleteMany({})));
}

async function seedPermissions(): Promise<Array<IPermission & { _id: Types.ObjectId }>> {
  await Permission.insertMany(
    PERMISSION_DEFINITIONS.map(([module, action, description]) => ({
      module,
      action,
      key: `${module}:${action}`,
      description,
      isActive: true,
    })),
    { ordered: false },
  );
  return Permission.find().lean();
}

async function seedRoles(permissions: Array<IPermission & { _id: Types.ObjectId }>): Promise<RoleDoc[]> {
  const byKey = new Map<string, Types.ObjectId>(permissions.map((p) => [p.key, p._id] as const));
  const created: RoleDoc[] = [];
  for (const def of ROLE_DEFINITIONS) {
    const role = await Role.create({
      name: def.name,
      key: def.key,
      description: def.description,
      accessScope: def.accessScope,
      isClientScoped: def.isClientScoped,
      canSeeInternalData: def.canSeeInternalData,
      isSystem: true,
      isActive: true,
      // Every key in ROLE_DEFINITIONS exists in PERMISSION_DEFINITIONS, so the
      // undefined branch of `Map.get` is only a type-level possibility.
      permissions: def.permissions.map((key) => byKey.get(key)).filter(Boolean) as Types.ObjectId[],
    });
    created.push(role);
  }
  return created;
}

async function seedUsers(roles: RoleDoc[]): Promise<UserMap> {
  const roleByKey = new Map<string, RoleDoc>(roles.map((r) => [r.key, r] as const));
  const created: UserMap = new Map();
  for (const def of USERS) {
    const user = await User.create({
      name: def.name,
      email: def.email,
      password: def.password,
      role: roleByKey.get(def.roleKey)!._id,
      jobTitle: def.jobTitle,
      department: def.department,
      team: def.team,
      avatarColor: def.avatarColor,
      isActive: true,
    });
    created.set(def.email, user);
  }
  return created;
}

async function seedSOP(superAdmin: UserDoc): Promise<{ template: SOPTemplateDoc; version: SOPVersionDoc }> {
  const stages = TEMPLATE.stages.map((s, index) => ({ ...s, order: index + 1 }));

  const template = await SOPTemplate.create({
    name: TEMPLATE.name,
    key: TEMPLATE.key,
    description: TEMPLATE.description,
    category: TEMPLATE.category,
    status: 'draft',
    stages,
    createdBy: superAdmin._id,
    updatedBy: superAdmin._id,
  });

  // Publish -> immutable version 1
  const version = await SOPVersion.create({
    template: template._id,
    version: 1,
    templateName: template.name,
    changeNote: 'Initial publication of the IT delivery workflow.',
    stages: stages.map((s) => ({
      key: s.key,
      name: s.name,
      description: s.description,
      order: s.order,
      clientVisible: s.clientVisible,
      estimatedDays: s.estimatedDays,
      requiredDocuments: [...s.requiredDocuments],
      dependsOn: [...s.dependsOn],
    })),
    stageCount: stages.length,
    publishedBy: superAdmin._id,
    publishedAt: new Date(),
  });

  template.status = 'published';
  template.currentVersion = 1;
  template.versions.push(version._id);
  template.publishedAt = version.publishedAt;
  await template.save();

  return { template, version };
}

async function seedProjects(version: SOPVersionDoc, users: UserMap, superAdmin: UserDoc): Promise<ProjectDoc[]> {
  const created: ProjectDoc[] = [];

  for (const def of PROJECTS) {
    const client = users.get(def.clientEmail)!;
    const manager = users.get(def.managerEmail)!;
    const members = def.memberEmails.map((email) => users.get(email)!._id);

    const project = await Project.create({
      name: def.name,
      code: def.code,
      description: def.description,
      priority: def.priority,
      status: PROJECT_STATUS.IN_PROGRESS,
      sopTemplate: version.template,
      sopVersion: version._id,
      sopVersionNumber: version.version,
      client: client._id,
      projectManager: manager._id,
      members,
      startDate: daysFromNow(def.startOffsetDays),
      targetEndDate: daysFromNow(def.targetOffsetDays),
      internalRemarks: def.internalRemarks,
      tags: def.tags,
      createdBy: superAdmin._id,
      updatedBy: superAdmin._id,
    });

    const versionStages = [...version.stages].sort((a, b) => a.order - b.order);
    const stageDocs = versionStages.map((s) => {
      const plan: IStagePlanEntry = def.stagePlan[s.key] || {};
      const ownerEmail = plan.owner ? users.get(plan.owner) : null;
      const completed = plan.status === STAGE_STATUS.COMPLETED;
      return {
        project: project._id,
        sopVersion: version._id,
        stageKey: s.key,
        name: s.name,
        description: s.description,
        order: s.order,
        clientVisible: s.clientVisible,
        estimatedDays: s.estimatedDays,
        requiredDocuments: [...s.requiredDocuments],
        dependsOn: [...s.dependsOn],
        status: plan.status || STAGE_STATUS.NOT_STARTED,
        owner: ownerEmail ? ownerEmail._id : null,
        dueDate: project.targetEndDate,
        startedAt: plan.status === STAGE_STATUS.NOT_STARTED ? null : daysFromNow(def.startOffsetDays + 1),
        completedAt: completed ? daysFromNow(-(plan.completedDaysAgo || 1)) : null,
        completionDate: completed ? daysFromNow(-(plan.completedDaysAgo || 1)) : null,
        blocker: plan.blocker || '',
        holdReason: plan.holdReason || '',
        internalRemarks: s.clientVisible ? '' : 'Internal handling notes - never exposed to client accounts.',
        updatedBy: manager._id,
      };
    });

    const createdStages = await ProjectWorkflowStage.insertMany(stageDocs);
    await seedHistory(project, createdStages, def, users, manager);

    await AuditLog.create({
      actor: superAdmin._id,
      actorName: superAdmin.name,
      actorEmail: superAdmin.email,
      actorRole: 'Super Admin',
      entityType: ENTITY_TYPES.PROJECT,
      entityId: project._id,
      entityLabel: project.name,
      action: AUDIT_ACTIONS.CREATED,
      oldValue: null,
      newValue: { name: project.name, code: project.code, sopVersionNumber: version.version, generatedStages: createdStages.length },
      metadata: { autoGeneratedStages: createdStages.length, seeded: true },
    });

    created.push(project);
  }

  return created;
}

/** Only the freshly inserted stage fields the history builder reads. */
interface ISeededStage {
  _id: Types.ObjectId;
  stageKey: string;
  name: string;
  status: StageStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  completionDate: Date | null;
}

/** Status transitions are written in a different flavour per transition kind. */
interface IHistoryEntry {
  project: Types.ObjectId;
  stage: Types.ObjectId;
  stageName: string;
  stageKey: string;
  fromStatus: StageStatus;
  toStatus: StageStatus;
  note: string;
  completionDate?: Date | null;
  blocker?: string;
  holdReason?: string;
  changedBy: Types.ObjectId;
  changedAt: Date | null;
}

async function seedHistory(
  project: ProjectDoc,
  stages: ISeededStage[],
  def: IProjectSeed,
  users: UserMap,
  manager: UserDoc,
): Promise<void> {
  const entries: IHistoryEntry[] = [];

  stages.forEach((stage) => {
    const plan: IStagePlanEntry = def.stagePlan[stage.stageKey] || {};
    const ownerEmail = plan.owner || def.managerEmail;
    const owner = users.get(ownerEmail)!;

    if (stage.status === STAGE_STATUS.NOT_STARTED) return;

    const inProgressDate = stage.startedAt || new Date();
    entries.push({
      project: project._id,
      stage: stage._id,
      stageName: stage.name,
      stageKey: stage.stageKey,
      fromStatus: STAGE_STATUS.NOT_STARTED,
      toStatus: STAGE_STATUS.IN_PROGRESS,
      note: 'Work started',
      changedBy: owner._id,
      changedAt: inProgressDate,
    });

    if (plan.completedDaysAgo) {
      entries.push({
        project: project._id,
        stage: stage._id,
        stageName: stage.name,
        stageKey: stage.stageKey,
        fromStatus: STAGE_STATUS.IN_PROGRESS,
        toStatus: STAGE_STATUS.COMPLETED,
        note: 'Signed off',
        completionDate: stage.completionDate,
        changedBy: owner._id,
        changedAt: stage.completedAt,
      });
    }
    if (plan.blocker) {
      entries.push({
        project: project._id,
        stage: stage._id,
        stageName: stage.name,
        stageKey: stage.stageKey,
        fromStatus: STAGE_STATUS.IN_PROGRESS,
        toStatus: STAGE_STATUS.BLOCKED,
        note: 'Blocked',
        blocker: plan.blocker,
        changedBy: owner._id,
        changedAt: daysFromNow(-2),
      });
    }
    if (plan.holdReason) {
      entries.push({
        project: project._id,
        stage: stage._id,
        stageName: stage.name,
        stageKey: stage.stageKey,
        fromStatus: STAGE_STATUS.IN_PROGRESS,
        toStatus: STAGE_STATUS.ON_HOLD,
        note: 'Paused',
        holdReason: plan.holdReason,
        changedBy: owner._id,
        changedAt: daysFromNow(-4),
      });
    }
  });

  if (entries.length) {
    await StageStatusHistory.insertMany(entries);
    await AuditLog.insertMany(
      entries.map((e) => ({
        actor: e.changedBy,
        actorName: users.get(def.memberEmails[0])?.name || manager.name,
        actorEmail: manager.email,
        actorRole: 'Admin',
        entityType: ENTITY_TYPES.PROJECT_WORKFLOW_STAGE,
        entityId: e.stage,
        entityLabel: `${project.name} / ${e.stageName}`,
        action: AUDIT_ACTIONS.STATUS_CHANGED,
        oldValue: { status: e.fromStatus },
        newValue: { status: e.toStatus, blocker: e.blocker || '', holdReason: e.holdReason || '' },
        metadata: { manual: true, seeded: true },
        createdAt: e.changedAt,
      })),
    );
  }
}

async function seedNotifications(users: UserMap): Promise<void> {
  const itMember = users.get('itmember@example.com')!;
  const admin = users.get('admin@example.com')!;
  await Notification.insertMany([
    {
      recipient: itMember._id,
      type: 'assignment',
      title: 'New stage assigned to you',
      message: 'You were assigned "Requirement Gathering" on Warehouse Inventory Modernisation.',
      entityType: ENTITY_TYPES.PROJECT_WORKFLOW_STAGE,
      isRead: false,
    },
    {
      recipient: admin._id,
      type: 'info',
      title: 'SOP published',
      message: 'IT Project Delivery SOP v1 is now live and available for new projects.',
      entityType: ENTITY_TYPES.SOP_VERSION,
      isRead: true,
    },
  ]);
}

/* ---------------------------------- Main ---------------------------------- */

async function main(): Promise<void> {
  await connectDatabase();
  logger.info('Seeding database...');

  await wipe();
  const permissions = await seedPermissions();
  logger.info(`  permissions: ${permissions.length}`);

  const roles = await seedRoles(permissions);
  logger.info(`  roles: ${roles.length}`);

  const users = await seedUsers(roles);
  logger.info(`  users: ${users.size}`);

  const superAdmin = users.get('superadmin@example.com')!;
  const { template, version } = await seedSOP(superAdmin);
  logger.info(`  SOP template "${template.name}" published as v${version.version} (${version.stages.length} stages)`);

  const projects = await seedProjects(version, users, superAdmin);
  logger.info(`  projects: ${projects.length} (with auto-generated workflow stages)`);

  await seedNotifications(users);
  logger.info('  notifications: 2');

  logger.info('');
  logger.info('Seed complete. Sign in with:');
  logger.info('  Super Admin        superadmin@example.com  / SuperAdmin@123');
  logger.info('  Admin              admin@example.com      / Admin@123');
  logger.info('  IT Team Member     itmember@example.com   / ITMember@123');
  logger.info('  Client / Ops       client@example.com     / Client@123');
  logger.info('');
}

main()
  .then(async () => {
    await disconnectDatabase();
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(async (err) => {
    logger.error('Seed failed', err);
    await disconnectDatabase().catch(() => {});
    process.exit(1);
  });
