import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import { SOP_STATUS } from '../utils/constants';
import type { ISopStage, ISopTemplate } from '../types/models';

export const sopStageSchema = new mongoose.Schema(
  {
    key: { type: String, required: [true, 'Stage key is required'], trim: true, uppercase: true },
    name: { type: String, required: [true, 'Stage name is required'], trim: true, maxlength: 150 },
    description: { type: String, trim: true, default: '' },
    order: { type: Number, required: true, min: 1 },
    /** When false the stage is stripped from every client-scoped response. */
    clientVisible: { type: Boolean, default: false },
    estimatedDays: { type: Number, default: null, min: 0 },
    requiredDocuments: { type: [String], default: [] },
    /** Keys of stages that must be Completed before this one may start. */
    dependsOn: { type: [String], default: [], uppercase: true },
  },
  { _id: true, timestamps: true },
);

/**
 * A template is only ever edited while `status === 'draft'`. Publishing snapshots
 * the stages into an immutable SOPVersion, so projects keep the exact workflow
 * they were generated from.
 */
const sopTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Template name is required'], trim: true, maxlength: 150 },
    key: { type: String, required: true, trim: true, uppercase: true, unique: true },
    description: { type: String, trim: true, default: '' },
    category: { type: String, trim: true, default: 'General' },

    status: {
      type: String,
      enum: Object.values(SOP_STATUS),
      default: SOP_STATUS.DRAFT,
      index: true,
    },

    currentVersion: { type: Number, default: 0 },
    versions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SOPVersion' }],

    stages: { type: [sopStageSchema], default: [] },

    publishedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'soptemplates' },
);

sopTemplateSchema.index({ status: 1, createdAt: -1 });

/** Keeps `order` a dense 1..n sequence after any structural change. */
sopTemplateSchema.methods.reindexStages = function reindexStages(this: { stages: ISopStage[] }) {
  this.stages.sort((a, b) => a.order - b.order);
  this.stages.forEach((stage, index) => {
    stage.order = index + 1;
  });
  return this.stages;
};

export type SOPTemplateDoc = HydratedDocument<ISopTemplate>;
export const SOPTemplate: Model<ISopTemplate> = mongoose.model<ISopTemplate>('SOPTemplate', sopTemplateSchema);
export default SOPTemplate;
