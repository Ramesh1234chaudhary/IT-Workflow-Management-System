import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import { STAGE_STATUS, STAGE_STATUS_VALUES } from '../utils/constants';
import type { IProjectWorkflowStage } from '../types/models';

/**
 * A stage instance generated on a project from a published SOP version.
 *
 * `status` is only ever changed through PATCH /api/projects/:id/stages/:id/status.
 * Side effects such as a document upload or a remark must never mutate it.
 */
const projectWorkflowStageSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    sopVersion: { type: mongoose.Schema.Types.ObjectId, ref: 'SOPVersion', required: true },

    stageKey: { type: String, required: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    order: { type: Number, required: true, min: 1 },
    clientVisible: { type: Boolean, default: false },
    estimatedDays: { type: Number, default: null },
    requiredDocuments: { type: [String], default: [] },
    dependsOn: { type: [String], default: [], uppercase: true },

    status: {
      type: String,
      enum: STAGE_STATUS_VALUES,
      default: STAGE_STATUS.NOT_STARTED,
      index: true,
    },

    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    dueDate: { type: Date, default: null },
    startedAt: { type: Date, default: null },

    blocker: { type: String, default: '' },
    holdReason: { type: String, default: '' },
    completionDate: { type: Date, default: null },
    completedAt: { type: Date, default: null },

    documents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }],
    /** Internal-only note, stripped for client-scoped users. */
    internalRemarks: { type: String, default: '' },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'projectworkflowstages' },
);

projectWorkflowStageSchema.index({ project: 1, order: 1 });
projectWorkflowStageSchema.index({ project: 1, stageKey: 1 }, { unique: true });
projectWorkflowStageSchema.index({ owner: 1, status: 1 });

export type ProjectWorkflowStageDoc = HydratedDocument<IProjectWorkflowStage>;
export const ProjectWorkflowStage: Model<IProjectWorkflowStage> = mongoose.model<IProjectWorkflowStage>(
  'ProjectWorkflowStage',
  projectWorkflowStageSchema,
);
export default ProjectWorkflowStage;
