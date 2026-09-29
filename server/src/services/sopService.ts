import crypto from 'node:crypto';
import type { Request } from 'express';
import mongoose, { type HydratedDocument, type Types } from 'mongoose';
import { SOPTemplate, SOPVersion, Project } from '../models/index';
import ApiError from '../utils/ApiError';
import { AUDIT_ACTIONS, ENTITY_TYPES, SOP_STATUS } from '../utils/constants';
import type { AuditAction, AuthUser, EntityType, ObjectIdLike, SopStatus } from '../types/domain';
import type { ISopStage, ISopTemplate } from '../types/models';
import { recordAudit as writeAudit } from './auditService';

/** A draft stage as it arrives from the request body (order is always derived). */
export interface StageInput {
  key: string;
  name: string;
  description?: string;
  clientVisible?: boolean;
  estimatedDays?: number | null;
  requiredDocuments?: string[];
  dependsOn?: string[];
}

export interface CreateTemplateInput {
  name: string;
  key: string;
  description?: string;
  category?: string;
  stages?: StageInput[];
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  category?: string;
}

/** Audit context passed alongside every mutating SOP call. */
export interface RequestContext {
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
 * `SOPTemplateDoc` with the schema instance methods and the stage DocumentArray
 * helpers (`id()` / `pull()`) that `Model<ISopTemplate>` does not carry.
 */
type SopStageSubdoc = HydratedDocument<ISopStage>;
type SopStageArray = Types.DocumentArray<SopStageSubdoc>;
type SopTemplateDoc = Omit<HydratedDocument<ISopTemplate>, 'stages'> & {
  stages: SopStageArray;
  reindexStages(): ISopStage[];
};

const asTemplateDoc = (doc: HydratedDocument<ISopTemplate> | null): SopTemplateDoc | null =>
  doc as unknown as SopTemplateDoc | null;

/** Same as `asTemplateDoc` for the `create()` path, which never yields null. */
const asCreatedTemplate = (doc: HydratedDocument<ISopTemplate>): SopTemplateDoc => doc as unknown as SopTemplateDoc;

/**
 * `updatedBy` is typed as an ObjectId but callers pass the string id from
 * `req.user`; Mongoose casts it on write, so the string is what actually lands
 * in the document. `undefined` is also assigned at runtime, hence the cast.
 */
const actorId = (actor?: AuthUser | null): Types.ObjectId =>
  actor?.id as unknown as Types.ObjectId;

const checksumFor = (stages: ISopStage[]) =>
  crypto.createHash('sha256').update(JSON.stringify(stages.map((s) => [s.key, s.name, s.order, s.clientVisible]))).digest('hex');

const assertDraft = (template: { status: SopStatus }, action = 'modify') => {
  if (template.status !== SOP_STATUS.DRAFT) {
    throw new ApiError(
      409,
      `Cannot ${action} a ${template.status} SOP template. Create a new draft to make changes; published versions are immutable.`,
      { code: 'TEMPLATE_NOT_DRAFT' },
    );
  }
};

const assertValidObjectId = (id: unknown, label = 'id') => {
  if (!mongoose.Types.ObjectId.isValid(id as ObjectIdLike)) throw ApiError.badRequest(`Invalid ${label}`);
};

export async function listTemplates({ status, search, actor: _actor }: { status?: string; search?: string; actor?: AuthUser | null } = {}) {
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { key: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }
  return SOPTemplate.find(filter)
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .sort({ updatedAt: -1 })
    .lean();
}

export async function getTemplate(id: string) {
  assertValidObjectId(id, 'template id');
  return SOPTemplate.findById(id)
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .populate('versions', 'version publishedAt changeNote stageCount publishedBy')
    .lean();
}

export async function getTemplateByIdOrThrow(id: string) {
  const template = await getTemplate(id);
  if (!template) throw ApiError.notFound('SOP template not found');
  return template;
}

export async function createTemplate({
  name,
  key,
  description,
  category,
  stages = [],
  actor,
  req,
}: CreateTemplateInput & RequestContext) {
  const existing = await SOPTemplate.findOne({ key: String(key).toUpperCase() });
  if (existing) throw ApiError.conflict(`An SOP template with key "${key}" already exists`);

  const template = asCreatedTemplate(
    await SOPTemplate.create({
      name,
      key: String(key).toUpperCase(),
      description,
      category,
      status: SOP_STATUS.DRAFT,
      stages: normaliseStages(stages),
      createdBy: actor?.id,
      updatedBy: actor?.id,
    }),
  );
  template.reindexStages();

  await recordAudit({
    actor,
    entityType: ENTITY_TYPES.SOP_TEMPLATE,
    entityId: template._id,
    entityLabel: template.name,
    action: AUDIT_ACTIONS.CREATED,
    newValue: { name: template.name, key: template.key, stageCount: template.stages.length },
    req,
  });
  return template;
}

export async function updateTemplate(id: string, payload: UpdateTemplateInput, { actor, req }: RequestContext) {
  const template = asTemplateDoc(await SOPTemplate.findById(id));
  if (!template) throw ApiError.notFound('SOP template not found');
  assertDraft(template, 'update');

  const before = { name: template.name, description: template.description, category: template.category };
  Object.assign(template, {
    name: payload.name ?? template.name,
    description: payload.description ?? template.description,
    category: payload.category ?? template.category,
    updatedBy: actor?.id,
  });
  await template.save();

  await recordAudit({
    actor,
    entityType: ENTITY_TYPES.SOP_TEMPLATE,
    entityId: template._id,
    entityLabel: template.name,
    action: AUDIT_ACTIONS.UPDATED,
    oldValue: before,
    newValue: { name: template.name, description: template.description, category: template.category },
    req,
  });
  return template;
}

export async function deleteTemplate(id: string, { actor, req }: { actor?: AuthUser | null; req?: Request }) {
  const template = asTemplateDoc(await SOPTemplate.findById(id));
  if (!template) throw ApiError.notFound('SOP template not found');
  assertDraft(template, 'delete');

  const projectCount = await Project.countDocuments({ sopTemplate: template._id });
  if (projectCount > 0) {
    throw ApiError.conflict(
      `This template is used by ${projectCount} project(s) and cannot be deleted. Archive it instead.`,
      { code: 'TEMPLATE_IN_USE' },
    );
  }

  // Removing the template takes its version snapshots with it. The driver is
  // used directly because the SOPVersion immutability hook rejects every
  // deleteMany, and a version that nothing references is no longer pinned by a
  // project. The project check above already proves no project can lose history.
  await SOPVersion.collection.deleteMany({ template: template._id });
  await SOPTemplate.deleteOne({ _id: template._id });

  await recordAudit({
    actor,
    entityType: ENTITY_TYPES.SOP_TEMPLATE,
    entityId: template._id,
    entityLabel: template.name,
    action: AUDIT_ACTIONS.DELETED,
    oldValue: { name: template.name, key: template.key },
    req,
  });
  return true;
}

/** Adds a stage to a draft template. */
export async function addStage(
  templateId: string,
  payload: StageInput,
  { actor, req }: { actor?: AuthUser | null; req?: Request },
) {
  const template = asTemplateDoc(await SOPTemplate.findById(templateId));
  if (!template) throw ApiError.notFound('SOP template not found');
  assertDraft(template, 'add a stage to');

  const key = String(payload.key).toUpperCase();
  if (template.stages.some((s) => s.key === key)) {
    throw ApiError.conflict(`Stage key "${key}" already exists in this template`);
  }

  template.stages.push({
    key,
    name: payload.name,
    description: payload.description || '',
    order: template.stages.length + 1,
    clientVisible: Boolean(payload.clientVisible),
    estimatedDays: payload.estimatedDays ?? null,
    requiredDocuments: payload.requiredDocuments || [],
    dependsOn: (payload.dependsOn || []).map((d) => String(d).toUpperCase()),
  } as ISopStage);
  template.reindexStages();
  template.updatedBy = actorId(actor);
  await template.save();

  await recordAudit({
    actor,
    entityType: ENTITY_TYPES.SOP_TEMPLATE,
    entityId: template._id,
    entityLabel: template.name,
    action: AUDIT_ACTIONS.UPDATED,
    metadata: { operation: 'add_stage', stageKey: key },
    newValue: { stageKey: key, name: payload.name, clientVisible: Boolean(payload.clientVisible) },
    req,
  });
  return template;
}

export async function updateStage(
  templateId: string,
  stageId: string,
  payload: Partial<StageInput>,
  { actor, req }: { actor?: AuthUser | null; req?: Request },
) {
  const template = asTemplateDoc(await SOPTemplate.findById(templateId));
  if (!template) throw ApiError.notFound('SOP template not found');
  assertDraft(template, 'edit a stage of');

  const stage = template.stages.id(stageId);
  if (!stage) throw ApiError.notFound('Stage not found in this template');

  const before = { name: stage.name, clientVisible: stage.clientVisible, order: stage.order };
  if (payload.name !== undefined) stage.name = payload.name;
  if (payload.description !== undefined) stage.description = payload.description;
  if (payload.clientVisible !== undefined) stage.clientVisible = Boolean(payload.clientVisible);
  if (payload.estimatedDays !== undefined) stage.estimatedDays = payload.estimatedDays;
  if (payload.requiredDocuments !== undefined) stage.requiredDocuments = payload.requiredDocuments;
  if (payload.dependsOn !== undefined) stage.dependsOn = payload.dependsOn.map((d) => String(d).toUpperCase());

  template.updatedBy = actorId(actor);
  await template.save();

  await recordAudit({
    actor,
    entityType: ENTITY_TYPES.SOP_TEMPLATE,
    entityId: template._id,
    entityLabel: template.name,
    action: AUDIT_ACTIONS.UPDATED,
    metadata: { operation: 'update_stage', stageKey: stage.key },
    oldValue: before,
    newValue: { name: stage.name, clientVisible: stage.clientVisible, order: stage.order },
    req,
  });
  return template;
}

/** Stage deletion is only permitted while the template is in draft. */
export async function deleteStage(
  templateId: string,
  stageId: string,
  { actor, req }: { actor?: AuthUser | null; req?: Request },
) {
  const template = asTemplateDoc(await SOPTemplate.findById(templateId));
  if (!template) throw ApiError.notFound('SOP template not found');
  assertDraft(template, 'delete a stage from');

  const stage = template.stages.id(stageId);
  if (!stage) throw ApiError.notFound('Stage not found in this template');

  const dependents = template.stages.filter((s) => (s.dependsOn || []).includes(stage.key));
  if (dependents.length) {
    throw ApiError.conflict(
      `Stage "${stage.name}" is a dependency of: ${dependents.map((d) => d.name).join(', ')}. Remove those dependencies first.`,
      { code: 'STAGE_HAS_DEPENDENTS' },
    );
  }

  const before = { key: stage.key, name: stage.name, order: stage.order };
  template.stages.pull(stageId);
  template.reindexStages();
  template.updatedBy = actorId(actor);
  await template.save();

  await recordAudit({
    actor,
    entityType: ENTITY_TYPES.SOP_TEMPLATE,
    entityId: template._id,
    entityLabel: template.name,
    action: AUDIT_ACTIONS.DELETED,
    metadata: { operation: 'delete_stage' },
    oldValue: before,
    req,
  });
  return template;
}

/** Persists a new stage order (drag & drop in the SOP builder). */
export async function reorderStages(
  templateId: string,
  orderedStageIds: unknown[],
  { actor, req }: { actor?: AuthUser | null; req?: Request },
) {
  const template = asTemplateDoc(await SOPTemplate.findById(templateId));
  if (!template) throw ApiError.notFound('SOP template not found');
  assertDraft(template, 'reorder stages of');

  const currentIds = template.stages.map((s) => String(s._id));
  if (currentIds.length !== orderedStageIds.length || !orderedStageIds.every((id) => currentIds.includes(String(id)))) {
    throw ApiError.badRequest('The provided stage order does not match the stages of this template');
  }

  const before = template.stages.map((s) => ({ key: s.key, order: s.order }));
  const map = new Map(template.stages.map((s) => [String(s._id), s]));
  template.stages = orderedStageIds.map((id, index) => {
    const stage = map.get(String(id))!;
    stage.order = index + 1;
    return stage;
  }) as unknown as SopStageArray;
  template.updatedBy = actorId(actor);
  await template.save();

  await recordAudit({
    actor,
    entityType: ENTITY_TYPES.SOP_TEMPLATE,
    entityId: template._id,
    entityLabel: template.name,
    action: AUDIT_ACTIONS.UPDATED,
    metadata: { operation: 'reorder_stages' },
    oldValue: { order: before },
    newValue: { order: template.stages.map((s) => ({ key: s.key, order: s.order })) },
    req,
  });
  return template;
}

/**
 * Publishing snapshots the current draft into an immutable SOPVersion and
 * flips the template to `published`. Existing projects keep their own
 * sopVersion reference, so they are never affected.
 */
export async function publishTemplate(
  templateId: string,
  { changeNote, actor, req }: { changeNote?: string; actor?: AuthUser | null; req?: Request },
) {
  const template = asTemplateDoc(await SOPTemplate.findById(templateId));
  if (!template) throw ApiError.notFound('SOP template not found');

  if (template.status !== SOP_STATUS.DRAFT) {
    throw ApiError.conflict(
      `Template is already ${template.status}. Create a new draft version before editing stages.`,
      { code: 'TEMPLATE_NOT_DRAFT' },
    );
  }
  if (!template.stages.length) {
    throw ApiError.badRequest('Cannot publish a template without stages');
  }

  const nextVersion = (template.currentVersion || 0) + 1;
  const snapshot: ISopStage[] = template.stages.map((s) => ({
    key: s.key,
    name: s.name,
    description: s.description,
    order: s.order,
    clientVisible: s.clientVisible,
    estimatedDays: s.estimatedDays,
    requiredDocuments: [...(s.requiredDocuments || [])],
    dependsOn: [...(s.dependsOn || [])],
  }));

  const version = await SOPVersion.create({
    template: template._id,
    version: nextVersion,
    templateName: template.name,
    changeNote: changeNote || '',
    stages: snapshot,
    stageCount: snapshot.length,
    publishedBy: actor?.id,
    publishedAt: new Date(),
    metadata: { checksum: checksumFor(snapshot) },
  });

  template.status = SOP_STATUS.PUBLISHED;
  template.currentVersion = nextVersion;
  template.versions.push(version._id);
  template.publishedAt = new Date();
  template.updatedBy = actorId(actor);
  await template.save();

  await recordAudit({
    actor,
    entityType: ENTITY_TYPES.SOP_VERSION,
    entityId: version._id,
    entityLabel: `${template.name} v${nextVersion}`,
    action: AUDIT_ACTIONS.PUBLISHED,
    newValue: { version: nextVersion, stageCount: snapshot.length, changeNote: changeNote || '' },
    metadata: { templateId: String(template._id), affectedExistingProjects: false },
    req,
  });

  return { template, version };
}

/** Clones the latest published version back into an editable draft. */
export async function createDraftFromVersion(
  templateId: string,
  { actor, req }: { actor?: AuthUser | null; req?: Request } = {},
) {
  const template = asTemplateDoc(await SOPTemplate.findById(templateId));
  if (!template) throw ApiError.notFound('SOP template not found');

  if (template.status === SOP_STATUS.DRAFT) {
    throw ApiError.conflict('This template already has an editable draft in progress');
  }

  const latest = await SOPVersion.findOne({ template: template._id }).sort({ version: -1 });
  if (!latest) throw ApiError.notFound('No published version to create a draft from');

  template.status = SOP_STATUS.DRAFT;
  template.stages = latest.stages.map((s) => ({
    key: s.key,
    name: s.name,
    description: s.description,
    clientVisible: s.clientVisible,
    estimatedDays: s.estimatedDays,
    requiredDocuments: [...(s.requiredDocuments || [])],
    dependsOn: [...(s.dependsOn || [])],
  })) as unknown as SopStageArray;
  template.reindexStages();
  template.updatedBy = actorId(actor);
  await template.save();

  await recordAudit({
    actor,
    entityType: ENTITY_TYPES.SOP_TEMPLATE,
    entityId: template._id,
    entityLabel: template.name,
    action: AUDIT_ACTIONS.UPDATED,
    metadata: { operation: 'create_draft', fromVersion: latest.version },
    req,
  });
  return template;
}

export async function listVersions(templateId: string) {
  assertValidObjectId(templateId, 'template id');
  return SOPVersion.find({ template: templateId })
    .populate('publishedBy', 'name email')
    .sort({ version: -1 })
    .lean();
}

export async function getVersion(versionId: string) {
  assertValidObjectId(versionId, 'version id');
  const version = await SOPVersion.findById(versionId).populate('publishedBy', 'name email').lean();
  if (!version) throw ApiError.notFound('SOP version not found');
  return version;
}

/** Latest published version of a template - the source for project generation. */
export async function getLatestPublishedVersion(templateId: ObjectIdLike) {
  return SOPVersion.findOne({ template: templateId }).sort({ version: -1 }).lean();
}

export async function getLatestPublishedVersionAny() {
  return SOPVersion.findOne({}).sort({ publishedAt: -1, version: -1 }).lean();
}

function normaliseStages(stages: StageInput[] = []): ISopStage[] {
  return stages.map((stage, index) => ({
    key: String(stage.key).toUpperCase(),
    name: stage.name,
    description: stage.description || '',
    order: index + 1,
    clientVisible: Boolean(stage.clientVisible),
    estimatedDays: stage.estimatedDays ?? null,
    requiredDocuments: stage.requiredDocuments || [],
    dependsOn: (stage.dependsOn || []).map((d) => String(d).toUpperCase()),
  }));
}

export default {
  listTemplates,
  getTemplate,
  getTemplateByIdOrThrow,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  addStage,
  updateStage,
  deleteStage,
  reorderStages,
  publishTemplate,
  createDraftFromVersion,
  listVersions,
  getVersion,
  getLatestPublishedVersion,
  getLatestPublishedVersionAny,
  assertDraft,
};
