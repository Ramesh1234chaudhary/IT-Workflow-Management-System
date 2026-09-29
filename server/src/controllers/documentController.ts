import env from '../config/env';
import * as documentService from '../services/documentService';
import { publicDocument } from '../utils/serializers';
import { HTTP_STATUS } from '../utils/constants';
import { asyncHandler } from '../utils/helpers';
import type { AuthUser } from '../types/domain.js';
import type { Request, Response } from 'express';

const requireUser = (req: Request): AuthUser => {
  if (!req.user) throw new Error('Authentication required');
  return req.user;
};

/** GET /api/projects/:projectId/documents */
export const listDocuments = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const documents = await documentService.listDocuments(req.params.projectId, user, req.query);
  return res.status(HTTP_STATUS.OK).json({ success: true, items: documents.map(d => publicDocument(d as Record<string, unknown>)) });
});

/** POST /api/projects/:projectId/documents - upload never changes stage status */
export const uploadDocument = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  if (!req.file) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'No file uploaded (field name must be "document")' });
  }
  const doc = await documentService.storeDocument({
    projectId: req.params.projectId,
    stageId: req.body?.stageId || null,
    file: req.file,
    description: req.body?.description,
    clientVisible: String(req.body?.clientVisible) === 'true',
    actor: user,
    req,
    uploadsDir: env.uploads.dir,
  });
  return res.status(HTTP_STATUS.CREATED).json({
    success: true,
    message: `Document uploaded as version ${doc.version}. Workflow status was not changed.`,
    document: publicDocument(doc as unknown as Record<string, unknown>),
  });
});

/** GET /api/documents/:id/download */
export const downloadDocument = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  await documentService.downloadDocument(req.params.id, user, res, { uploadsDir: env.uploads.dir });
});

/** DELETE /api/documents/:id */
export const deleteDocument = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  await documentService.deleteDocument(req.params.id, { actor: user, req });
  return res.status(HTTP_STATUS.OK).json({ success: true, message: 'Document deleted' });
});

/** GET /api/documents/:id/versions */
export const documentVersions = asyncHandler(async (req: Request, res: Response) => {
  const versions = await documentService.documentVersions(req.params.id);
  return res.status(HTTP_STATUS.OK).json({ success: true, items: versions.map(v => publicDocument(v as Record<string, unknown>)) });
});

export default { listDocuments, uploadDocument, downloadDocument, deleteDocument, documentVersions };
