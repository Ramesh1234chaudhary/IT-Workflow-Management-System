import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import type { IRefreshToken } from '../types/models';

/**
 * One row per issued refresh token. Rotation writes a new row and marks the old
 * one replaced; presenting a rotated token again revokes the whole family, which
 * is how token reuse is detected.
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    familyId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: null },
    replacedByTokenHash: { type: String, default: null },
    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
  },
  { timestamps: true, collection: 'refreshtokens' },
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

refreshTokenSchema.methods.isActive = function isActive(this: IRefreshToken) {
  return !this.revokedAt && this.expiresAt.getTime() > Date.now();
};

export type RefreshTokenDoc = HydratedDocument<IRefreshToken>;
export const RefreshToken: Model<IRefreshToken> = mongoose.model<IRefreshToken>('RefreshToken', refreshTokenSchema);
export default RefreshToken;
