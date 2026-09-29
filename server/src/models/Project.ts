import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import { PRIORITY, PROJECT_STATUS } from '../utils/constants';
import type { IProject } from '../types/models';

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Project name is required'], trim: true, maxlength: 150 },
    code: { type: String, required: true, trim: true, uppercase: true, unique: true },
    description: { type: String, trim: true, default: '' },

    status: { type: String, enum: Object.values(PROJECT_STATUS), default: PROJECT_STATUS.PLANNED, index: true },
    priority: { type: String, enum: Object.values(PRIORITY), default: PRIORITY.MEDIUM },

    sopTemplate: { type: mongoose.Schema.Types.ObjectId, ref: 'SOPTemplate', required: true },
    /** Immutable published snapshot - never changes after the project is created. */
    sopVersion: { type: mongoose.Schema.Types.ObjectId, ref: 'SOPVersion', required: true, index: true },
    sopVersionNumber: { type: Number, default: null },

    client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    projectManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    startDate: { type: Date, default: null },
    targetEndDate: { type: Date, default: null },

    /** Internal-only context, never serialised for client-scoped users. */
    internalRemarks: { type: String, default: '' },
    tags: { type: [String], default: [] },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'projects' },
);

projectSchema.index({ name: 'text', code: 'text', description: 'text' });

export type ProjectDoc = HydratedDocument<IProject>;
export const Project: Model<IProject> = mongoose.model<IProject>('Project', projectSchema);
export default Project;
