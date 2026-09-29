import mongoose, { type HydratedDocument, type Model, type Types } from 'mongoose';
import { ACCESS_SCOPE } from '../utils/constants';
import type { IPermission, IRole } from '../types/models';

/**
 * Roles are database driven. Nothing in the API compares against a hard coded
 * role name - authorisation is evaluated from:
 *   permissions[]        module:action pairs
 *   accessScope          'all' | 'assigned', drives data scoping
 *   isClientScoped       true => responses are stripped by filterClientData
 *   canSeeInternalData   false => internal remarks and documents stay server side
 */
const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    key: { type: String, required: true, trim: true, lowercase: true, unique: true },
    description: { type: String, trim: true, default: '' },

    accessScope: {
      type: String,
      enum: Object.values(ACCESS_SCOPE),
      default: ACCESS_SCOPE.ASSIGNED,
    },
    isClientScoped: { type: Boolean, default: false },
    canSeeInternalData: { type: Boolean, default: true },

    permissions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Permission' }],

    isSystem: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    userCount: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'roles' },
);

roleSchema.virtual('permissionKeys').get(function permissionKeys(this: { permissions?: IPermission[] | Types.ObjectId[] }) {
  return (this.permissions ?? [])
    .map((p) => (p && typeof p === 'object' && 'key' in p ? p.key : null))
    .filter((k): k is string => Boolean(k));
});

roleSchema.set('toJSON', { virtuals: true });

export type RoleDoc = HydratedDocument<IRole>;
export const Role: Model<IRole> = mongoose.model<IRole>('Role', roleSchema);
export default Role;
