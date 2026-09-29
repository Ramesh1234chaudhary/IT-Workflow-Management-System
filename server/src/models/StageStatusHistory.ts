import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import type { IStageStatusHistory } from '../types/models';
import { STAGE_STATUS_VALUES } from '../utils/constants';

/** Append-only record written on every manual status change. */
const stageStatusHistorySchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    stage: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectWorkflowStage', required: true, index: true },
    stageName: { type: String, default: '' },
    stageKey: { type: String, default: '' },

    fromStatus: { type: String, enum: STAGE_STATUS_VALUES, default: null },
    toStatus: { type: String, enum: STAGE_STATUS_VALUES, required: true },

    note: { type: String, default: '' },
    blocker: { type: String, default: '' },
    holdReason: { type: String, default: '' },
    completionDate: { type: Date, default: null },

    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    changedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, collection: 'stagestatushistory' },
);

stageStatusHistorySchema.index({ project: 1, changedAt: -1 });
stageStatusHistorySchema.index({ stage: 1, changedAt: -1 });

function blockMutation(next: (err?: Error) => void) {
  const error = Object.assign(new Error('Stage status history is append-only.'), { status: 409, code: 'APPEND_ONLY' });
  return next(error);
}

stageStatusHistorySchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne'], blockMutation);
stageStatusHistorySchema.pre(['deleteOne', 'deleteMany', 'findOneAndDelete'], blockMutation);

export type StageStatusHistoryDoc = HydratedDocument<IStageStatusHistory>;
export const StageStatusHistory: Model<IStageStatusHistory> = mongoose.model<IStageStatusHistory>(
  'StageStatusHistory',
  stageStatusHistorySchema,
);
export default StageStatusHistory;
