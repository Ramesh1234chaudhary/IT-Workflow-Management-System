import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import type { IDocument } from '../types/models';

const documentSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    stage: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectWorkflowStage', default: null, index: true },

    originalName: { type: String, required: true, trim: true },
    storedName: { type: String, required: true },
    mimeType: { type: String, default: 'application/octet-stream' },
    size: { type: Number, default: 0 },
    checksum: { type: String, default: '' },
    description: { type: String, default: '' },

    /** Re-uploading the same logical name bumps this instead of replacing the row. */
    version: { type: Number, default: 1 },
    isLatest: { type: Boolean, default: true },
    supersedes: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', default: null },

    clientVisible: { type: Boolean, default: false },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'documents' },
);

documentSchema.index({ project: 1, originalName: 1, version: -1 });

export type DocumentDoc = HydratedDocument<IDocument>;
export const Document: Model<IDocument> = mongoose.model<IDocument>('Document', documentSchema);
export default Document;
