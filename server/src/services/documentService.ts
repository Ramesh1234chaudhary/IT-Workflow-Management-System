import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { Document, Project, ProjectWorkflowStage } from '../models/index';
import type { ProjectWorkflowStageDoc } from '../models/ProjectWorkflowStage';
import ApiError from '../utils/ApiError';
import { AUDIT_ACTIONS, ENTITY_TYPES } from '../utils/constants';
import { assertProjectAccess, hasFullProjectScope } from './accessService';
import { recordAudit } from './auditService';
import type { AuthUser } from '../types/domain';
import type { Response, Request } from 'express';

const streamFile = (absolutePath: string, res: Response): void => {
  fs.createReadStream(absolutePath)
    .on('error', () => {
      if (!res.headersSent) res.status(404).json({ message: 'Stored file is no longer available' });
    })
    .pipe(res);
};

/**
 * Uploading a document NEVER changes workflow status.
 * The stage status is re-read only to assert that this invariant holds; if a
 * caller ever tried to smuggle a status change through this path it would throw.
 */
async function assertStatusUntouched(
  stageBefore: { status: string } | null,
  stageAfter: { status: string } | null
): Promise<void> {
  if (stageBefore && stageAfter && stageBefore.status !== stageAfter.status) {
    throw new ApiError(
      500,
      'Invariant violation: a document upload must never change workflow status',
      { code: 'STATUS_MUTATION_VIOLATION' },
    );
  }
}

interface ListDocumentsQuery {
  stageId?: string;
  latestOnly?: 'true' | 'false';
}

export async function listDocuments(
  projectId: string,
  actor: AuthUser | null,
  query: ListDocumentsQuery = {}
) {
  const project = await Project.findById(projectId).lean();
  if (!project) throw ApiError.notFound('Project not found');
  assertProjectAccess(actor, project);

  const filter: Record<string, unknown> = { project: project._id };
  if (query.stageId) filter.stage = query.stageId;
  if (query.latestOnly === 'true') filter.isLatest = true;

  return Document.find(filter)
    .populate('uploadedBy', 'name email')
    .sort({ createdAt: -1 })
    .lean();
}

interface StoreDocumentInput {
  projectId: string;
  stageId?: string;
  file: Express.Multer.File;
  description?: string;
  clientVisible?: boolean;
  actor: AuthUser | null;
  req?: Request | null;
  uploadsDir: string;
}

export async function storeDocument({
  projectId,
  stageId,
  file,
  description,
  clientVisible,
  actor,
  req,
}: StoreDocumentInput) {
  const project = await Project.findById(projectId);
  if (!project) throw ApiError.notFound('Project not found');
  assertProjectAccess(actor, project, { write: true });

  let stage: ProjectWorkflowStageDoc | null = null;
  let stageBefore: { status: string } | null = null;
  if (stageId) {
    stage = await ProjectWorkflowStage.findOne({ _id: stageId, project: project._id });
    if (!stage) throw ApiError.notFound('Stage not found in this project');
    stageBefore = { status: stage.status };
  }

  const checksum = await sha256File(file.path);
  const previous = await Document.findOne({ project: project._id, originalName: file.originalname })
    .sort({ version: -1 })
    .lean();

  const doc = await Document.create({
    project: project._id,
    stage: stage ? stage._id : null,
    originalName: file.originalname,
    storedName: file.filename,
    mimeType: file.mimetype,
    size: file.size,
    checksum,
    description: description || '',
    version: previous ? previous.version + 1 : 1,
    isLatest: true,
    supersedes: previous ? previous._id : null,
    clientVisible: Boolean(clientVisible),
    uploadedBy: actor?.id,
  });

  if (previous) {
    await Document.updateOne({ _id: previous._id }, { $set: { isLatest: false } });
  }

  if (stage) {
    stage.documents.push(doc._id);
    // NOTE: stage.status is intentionally untouched.
    await stage.save();
    const stageAfter = await ProjectWorkflowStage.findById(stage._id).lean<{ status: string }>();
    await assertStatusUntouched(stageBefore, stageAfter);
  }

  await recordAudit({
    actor,
    entityType: ENTITY_TYPES.DOCUMENT,
    entityId: doc._id,
    entityLabel: doc.originalName,
    action: AUDIT_ACTIONS.DOCUMENT_UPLOADED,
    newValue: {
      project: project.name,
      stage: stage ? stage.name : null,
      version: doc.version,
      size: doc.size,
    },
    metadata: { statusUnchanged: true, rule: 'manual-status-only' },
    req,
  });

  return doc;
}

interface DownloadDocumentOptions {
  uploadsDir: string;
}

export async function downloadDocument(
  documentId: string,
  actor: AuthUser | null,
  res: Response,
  { uploadsDir }: DownloadDocumentOptions
) {
  const doc = await Document.findById(documentId);
  if (!doc) throw ApiError.notFound('Document not found');

  const project = await Project.findById(doc.project).lean();
  if (!project) throw ApiError.notFound('Project not found');
  assertProjectAccess(actor, project);

  const absolutePath = path.resolve(uploadsDir, doc.storedName);
  if (!fs.existsSync(absolutePath)) throw ApiError.notFound('Stored file is missing from the server');

  res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.originalName)}"`);
  res.setHeader('Content-Length', doc.size);
  streamFile(absolutePath, res);
  return doc;
}

interface DeleteDocumentOptions {
  actor: AuthUser | null;
  req?: Request | null;
}

export async function deleteDocument(
  documentId: string,
  { actor, req }: DeleteDocumentOptions
) {
  const doc = await Document.findById(documentId);
  if (!doc) throw ApiError.notFound('Document not found');

  const project = await Project.findById(doc.project).lean();
  if (!project) throw ApiError.notFound('Project not found');
  assertProjectAccess(actor, project, { write: true });

  await ProjectWorkflowStage.updateMany({ documents: doc._id }, { $pull: { documents: doc._id } });
  await Document.deleteOne({ _id: doc._id });

  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  const absolutePath = path.resolve(uploadsDir, doc.storedName);
  fs.promises.unlink(absolutePath).catch(() => {});

  await recordAudit({
    actor,
    entityType: ENTITY_TYPES.DOCUMENT,
    entityId: doc._id,
    entityLabel: doc.originalName,
    action: AUDIT_ACTIONS.DOCUMENT_DELETED,
    oldValue: { originalName: doc.originalName, version: doc.version, project: project.name },
    req,
  });
  return true;
}

export async function documentVersions(documentId: string) {
  const doc = await Document.findById(documentId).lean();
  if (!doc) throw ApiError.notFound('Document not found');
  return Document.find({ project: doc.project, originalName: doc.originalName })
    .populate('uploadedBy', 'name email')
    .sort({ version: -1 })
    .lean();
}

function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!filePath) return resolve('');
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk: Buffer) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

export { hasFullProjectScope };