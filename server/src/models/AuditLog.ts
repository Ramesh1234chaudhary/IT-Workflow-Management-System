import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import type { IAuditLog } from '../types/models';

/**
 * Append-only audit trail. Each state change writes one record; there are
 * deliberately no update or delete routes for this collection.
 */
const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    actorName: { type: String, default: 'System' },
    actorEmail: { type: String, default: '' },
    actorRole: { type: String, default: '' },

    entityType: { type: String, required: true, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    entityLabel: { type: String, default: '' },

    action: { type: String, required: true, index: true },
    oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },

    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'auditlogs' },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });

function blockMutation(next: (err?: Error) => void) {
  const error = Object.assign(new Error('Audit log entries are immutable.'), { status: 409, code: 'APPEND_ONLY' });
  return next(error);
}

auditLogSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne'], blockMutation);
auditLogSchema.pre(['deleteOne', 'deleteMany', 'findOneAndDelete'], blockMutation);

export type AuditLogDoc = HydratedDocument<IAuditLog>;
export const AuditLog: Model<IAuditLog> = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
export default AuditLog;
