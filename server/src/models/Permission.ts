import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import type { IPermission } from '../types/models';

const permissionSchema = new mongoose.Schema(
  {
    module: { type: String, required: true, trim: true, lowercase: true },
    action: { type: String, required: true, trim: true },
    key: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'permissions' },
);

permissionSchema.index({ module: 1, action: 1 });

permissionSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    const out = ret as unknown as Record<string, unknown>;
    out.id = String(out._id);
    delete out._id;
    delete out.__v;
    return out;
  },
});

export type PermissionDoc = HydratedDocument<IPermission>;
export const Permission: Model<IPermission> = mongoose.model<IPermission>('Permission', permissionSchema);
export default Permission;
