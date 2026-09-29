import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import { sopStageSchema } from './SOPTemplate';
import type { ISopVersion } from '../types/models';

function blockMutation(next: (err?: Error) => void) {
  const error = Object.assign(new Error('SOPVersion documents are immutable once published. Publish a new version instead.'), {
    status: 409,
    code: 'IMMUTABLE_VERSION',
  });
  return next(error);
}

/** Immutable snapshot taken at publish time; projects pin the version they used. */
const sopVersionSchema = new mongoose.Schema(
  {
    template: { type: mongoose.Schema.Types.ObjectId, ref: 'SOPTemplate', required: true, index: true },
    version: { type: Number, required: true, min: 1 },
    templateName: { type: String, required: true, trim: true },
    changeNote: { type: String, trim: true, default: '' },
    stages: { type: [sopStageSchema], default: [] },
    stageCount: { type: Number, default: 0 },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    publishedAt: { type: Date, default: Date.now },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: 'sopversions',
    // Immutability is enforced by the hooks below rather than the schema option.
    immutable: false,
  },
);

sopVersionSchema.index({ template: 1, version: 1 }, { unique: true });

sopVersionSchema.pre('save', function preventSave(next: (err?: Error) => void) {
  if (!this.isNew) return blockMutation(next);
  return next();
});

sopVersionSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne'], blockMutation);
sopVersionSchema.pre(
  ['deleteOne', 'deleteMany', 'findOneAndDelete'],
  (next: (err?: Error) => void) => next(Object.assign(new Error('SOPVersion documents are immutable and cannot be deleted.'), { status: 409, code: 'IMMUTABLE_VERSION' })),
);

export type SOPVersionDoc = HydratedDocument<ISopVersion>;
export const SOPVersion: Model<ISopVersion> = mongoose.model<ISopVersion>('SOPVersion', sopVersionSchema);
export default SOPVersion;
